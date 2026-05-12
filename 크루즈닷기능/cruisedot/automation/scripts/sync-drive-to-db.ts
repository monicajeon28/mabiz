#!/usr/bin/env tsx
/**
 * Google Drive → MallProductContent 자동 연결 스크립트
 *
 * - PRODUCTS 폴더 (18YuEBt313yyKI3F7PSzjFFRF3Af-bVPH) 상품코드 서브폴더 우선
 * - UPLOADS_IMAGES 폴더 (1fWbPelIoftl1DqXLayZNle7z-DSYzvl8) 보조
 * - 첫 번째 이미지 → thumbnail
 * - 전체 이미지 → detailBlocks
 * 실행: npx tsx scripts/sync-drive-to-db.ts
 */

import 'dotenv/config';
import { google } from 'googleapis';
import { createPrivateKey } from 'crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const PRODUCTS_FOLDER_ID = '18YuEBt313yyKI3F7PSzjFFRF3Af-bVPH';
const UPLOADS_IMAGES_FOLDER_ID = '1fWbPelIoftl1DqXLayZNle7z-DSYzvl8';

function buildDriveImageUrl(fileId: string): string {
  return `https://lh3.googleusercontent.com/d/${fileId}`;
}

function getDrive() {
  let pk = (process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY || '').trim();
  pk = pk.replace(/\\n/g, '\n');
  const body = pk
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '');
  const chunks = body.match(/.{1,64}/g) || [];
  pk = `-----BEGIN PRIVATE KEY-----\n${chunks.join('\n')}\n-----END PRIVATE KEY-----`;
  try {
    const k = createPrivateKey({ key: pk, format: 'pem' });
    pk = k.export({ format: 'pem', type: 'pkcs8' }) as string;
  } catch (_) {}

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL,
      private_key: pk,
    },
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });
  return google.drive({ version: 'v3', auth });
}

type DriveFile = { id: string; name: string; mimeType: string };
type DriveFolder = { id: string; name: string };

async function listSubfolders(drive: ReturnType<typeof getDrive>, parentId: string): Promise<DriveFolder[]> {
  const all: DriveFolder[] = [];
  let pageToken: string | undefined;
  do {
    const r: any = await drive.files.list({
      q: `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'nextPageToken,files(id,name)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      corpora: 'allDrives',
      pageSize: 100,
      pageToken,
    });
    all.push(...(r.data.files || []));
    pageToken = r.data.nextPageToken;
  } while (pageToken);
  return all;
}

async function listImagesInFolder(drive: ReturnType<typeof getDrive>, folderId: string): Promise<DriveFile[]> {
  const all: DriveFile[] = [];
  let pageToken: string | undefined;
  do {
    const r: any = await drive.files.list({
      q: `'${folderId}' in parents and mimeType contains 'image/' and trashed=false`,
      fields: 'nextPageToken,files(id,name,mimeType)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      corpora: 'allDrives',
      pageSize: 100,
      orderBy: 'name',
      pageToken,
    });
    all.push(...(r.data.files || []));
    pageToken = r.data.nextPageToken;
  } while (pageToken);
  return all.filter(f => f.id && f.name && f.mimeType.startsWith('image/'));
}

function buildDetailBlocks(images: DriveFile[]) {
  return images.map((img, idx) => ({
    type: 'image' as const,
    order: idx,
    url: buildDriveImageUrl(img.id),
    alt: img.name.replace(/\.[^.]+$/, ''),
    fileId: img.id,
    source: 'google-drive',
  }));
}

async function main() {
  const drive = getDrive();

  // 1. DB 상품 목록 조회
  const products = await prisma.cruiseProduct.findMany({
    select: { productCode: true, packageName: true },
  });
  console.log(`\n[DB] 총 ${products.length}개 상품`);

  // 2. Drive 폴더 목록 조회
  const [productsFolders, uploadsFolders] = await Promise.all([
    listSubfolders(drive, PRODUCTS_FOLDER_ID),
    listSubfolders(drive, UPLOADS_IMAGES_FOLDER_ID),
  ]);

  console.log(`[Drive] PRODUCTS 폴더: ${productsFolders.length}개 서브폴더`);
  console.log(`[Drive] UPLOADS_IMAGES 폴더: ${uploadsFolders.length}개 서브폴더`);

  // productCode → folderId 매핑 (PRODUCTS 우선, UPLOADS_IMAGES 보조)
  const folderMap = new Map<string, { id: string; source: string }>();
  for (const f of uploadsFolders) {
    folderMap.set(f.name, { id: f.id, source: 'uploads-images' });
  }
  for (const f of productsFolders) {
    // PRODUCTS 폴더가 우선
    folderMap.set(f.name, { id: f.id, source: 'products' });
  }

  // 3. 각 상품 처리
  let successCount = 0;
  let skipCount = 0;
  let noFolderCount = 0;

  for (const product of products) {
    const { productCode } = product;
    const folder = folderMap.get(productCode);

    if (!folder) {
      console.log(`  ⚠️  [${productCode}] Drive 폴더 없음 — 스킵`);
      noFolderCount++;
      continue;
    }

    try {
      // 해당 폴더의 이미지 파일 목록
      const images = await listImagesInFolder(drive, folder.id);

      if (images.length === 0) {
        console.log(`  ⚠️  [${productCode}] 이미지 없음 (${folder.source}) — 스킵`);
        noFolderCount++;
        continue;
      }

      // 썸네일: 이름에 'thumbnail' 포함 우선, 없으면 첫 번째
      const thumbnailFile =
        images.find(f => f.name.toLowerCase().includes('thumbnail')) || images[0];
      const thumbnailUrl = buildDriveImageUrl(thumbnailFile.id);
      const detailBlocks = buildDetailBlocks(images);

      // 기존 MallProductContent 조회 (layout 보존용)
      const existing = await prisma.mallProductContent.findUnique({
        where: { productCode },
        select: { productCode: true, thumbnail: true, layout: true },
      });

      if (existing?.thumbnail) {
        console.log(`  ✅ [${productCode}] 이미 연결됨 — 업데이트`);
      } else {
        console.log(`  🔗 [${productCode}] ${images.length}개 이미지 연결 (${folder.source})`);
      }

      // 기존 layout JSON 보존하며 detailBlocks 업데이트
      const prevLayout = (existing?.layout && typeof existing.layout === 'object' ? existing.layout : {}) as Record<string, unknown>;
      const layoutData = {
        ...prevLayout,
        detailBlocks,
        thumbnail: thumbnailUrl,
      };

      await prisma.mallProductContent.upsert({
        where: { productCode },
        update: {
          thumbnail: thumbnailUrl,
          layout: layoutData,
          updatedAt: new Date(),
        },
        create: {
          productCode,
          thumbnail: thumbnailUrl,
          layout: layoutData,
          isActive: true,
          updatedAt: new Date(),
        },
      });

      successCount++;
    } catch (err) {
      console.error(`  ❌ [${productCode}] 처리 실패:`, (err as Error).message);
      skipCount++;
    }
  }

  console.log(`\n===== 완료 =====`);
  console.log(`✅ 연결 성공: ${successCount}개`);
  console.log(`⚠️  Drive 폴더/이미지 없음: ${noFolderCount}개`);
  console.log(`⏭️  스킵: ${skipCount}개`);

  await prisma.$disconnect();
}

main().catch(async e => {
  console.error('Error:', e.message);
  await prisma.$disconnect();
  process.exit(1);
});
