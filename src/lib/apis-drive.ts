/**
 * APIS 명단 Google Drive 저장 (멱등)
 * - uploadApisToDrive(productCode): APIS 엑셀을 생성해 Drive에 저장
 * - Trip.id 기반 멱등: GmTrip.googleFolderId / spreadsheetId 재사용
 * - 탑승객 0명(빈 명단)이면 폴더·파일을 만들지 않고 skip → 빈 명단 덮어쓰기로 인한 데이터 소실 차단
 */
import prisma from '@/lib/prisma';
import { findOrCreateFolder, uploadXlsxIdempotent, deleteDriveFile } from '@/lib/drive-client';
import { fetchApisData, buildApisWorkbook, APIS_HEADERS } from '@/lib/apis-excel';
import { logger } from '@/lib/logger';

/**
 * trip.id 단위 advisory lock namespace.
 * 같은 namespace를 쓰는 다른 락과 충돌하지 않도록 임의의 고정 정수를 키 클래스로 사용.
 * pg_advisory_xact_lock(classid, objid) 2-int 형태 → (NAMESPACE, trip.id)로 직렬화.
 */
const APIS_DRIVE_LOCK_NAMESPACE = 0x4150_4953; // 'APIS'

export type UploadApisResult = {
  folderId?: string;
  fileId?: string;
  viewUrl?: string;
  travelerCount: number;
  skipped?: boolean;
};

/** Drive 파일/폴더명에 사용할 수 없는 문자를 '_'로 치환 후 100자 컷 */
function sanitize(name: string): string {
  return name.replace(/[\/\\?%*:|"<>]/g, '_').slice(0, 100);
}

/**
 * 특정 상품코드의 APIS 명단을 Google Drive에 저장 (멱등)
 * @returns travelerCount 0 또는 Trip 미존재(id=0)면 { skipped: true }
 */
export async function uploadApisToDrive(productCode: string): Promise<UploadApisResult> {
  // ── 1. 데이터 조회 ───────────────────────────────────────────
  const data = await fetchApisData(productCode);
  if (!data) {
    // 상품코드 자체가 없음 → 저장할 명단 없음으로 처리(폴더·파일 생성 안 함)
    return { skipped: true, travelerCount: 0 };
  }

  const { trip, dataRows, depDateYmd, travelerCount } = data;

  // ── 2. 빈 명단 가드 (데이터 소실 차단) ───────────────────────
  // trip.id === 0 (CruiseProduct 폴백, 실제 Trip 레코드 없음) 또는 탑승객 0명이면
  // 폴더·파일을 만들지 않고 skip → 기존 Drive 명단을 빈 양식으로 덮어쓰지 않음
  if (trip.id === 0 || travelerCount === 0) {
    // 탑승객 0명이고 기존 파일이 있으면 삭제
    if (travelerCount === 0 && trip.id !== 0) {
      try {
        const existingTrip = await prisma.gmTrip.findUnique({
          where: { id: trip.id },
          select: { spreadsheetId: true },
        });
        if (existingTrip?.spreadsheetId) {
          await deleteDriveFile(existingTrip.spreadsheetId);
          logger.info('APIS Drive 파일 삭제', { productCode, tripId: trip.id, fileId: existingTrip.spreadsheetId });
          // DB에서 spreadsheetId 제거
          await prisma.gmTrip.update({
            where: { id: trip.id },
            data: { spreadsheetId: null },
          });
        }
      } catch (err) {
        logger.error('APIS Drive 파일 삭제 실패', { productCode, tripId: trip.id, err });
        // 삭제 실패해도 계속 진행
      }
    }
    return { skipped: true, travelerCount };
  }

  // ── 3. 폴더명 구성 ───────────────────────────────────────────
  const packageLabel = trip.packageName ?? trip.cruiseName ?? trip.shipName;
  const folderName = sanitize(`${productCode}_${depDateYmd}_${packageLabel}`);

  // ── 4. 루트 폴더 확인 ────────────────────────────────────────
  const rootId = process.env.GOOGLE_DRIVE_PASSPORT_FOLDER_ID;
  if (!rootId) {
    throw new Error('GOOGLE_DRIVE_PASSPORT_FOLDER_ID 미설정');
  }

  // ── 5. 워크북 생성 ───────────────────────────────────────────
  const buf = buildApisWorkbook(data.titleText, productCode, data.depDateKor, dataRows, APIS_HEADERS);
  const fileName = `APIS_${productCode}_${depDateYmd}.xlsx`;

  // ── 6. trip.id 직렬화 트랜잭션 (동시 저장 멱등성 보장) ──────────
  // [P1/idempotency] findOrCreateFolder / uploadXlsxIdempotent 모두 list→create의
  // 비원자 패턴이라, 같은 trip에 대해 동시 요청이 들어오면 둘 다 '없음'으로 판정해
  // 폴더('APIS명단'·상품폴더)·xlsx를 중복 생성하고 고아가 잔존한다.
  // → pg_advisory_xact_lock(NAMESPACE, trip.id)로 trip 단위 직렬화.
  //   두 번째 요청은 첫 트랜잭션 커밋까지 블록되었다가, 락 획득 후 googleFolderId/
  //   spreadsheetId를 재조회하면 이미 채워져 있어 생성 없이 그대로 재사용 → 멱등.
  // Drive 네트워크 I/O를 트랜잭션 안에서 수행하므로 timeout을 넉넉히 둔다(D1: 저빈도 수동 단일 OWNER).
  const { folderId, fileId, viewUrl } = await prisma.$transaction(
    async (tx) => {
      // (a) trip.id 단위 트랜잭션 advisory lock — 동시 진입 직렬화
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${APIS_DRIVE_LOCK_NAMESPACE}::int, ${trip.id}::int)`;

      // (b) 락 획득 후 최신 상태 재조회 (선행 요청이 채워 둔 ID를 반영)
      const lockedTrip = await tx.gmTrip.findUnique({
        where: { id: trip.id },
        select: { googleFolderId: true, spreadsheetId: true },
      });

      // (c) 폴더 확보 (멱등): 이미 있으면 list 생략하고 재사용
      let resolvedFolderId: string;
      if (lockedTrip?.googleFolderId) {
        resolvedFolderId = lockedTrip.googleFolderId;
      } else {
        const apisRootId = await findOrCreateFolder('APIS명단', rootId);
        resolvedFolderId = await findOrCreateFolder(folderName, apisRootId);
      }

      // (d) xlsx 멱등 업로드: 기존 fileId 있으면 덮어쓰기, 없으면 동일 이름 탐색→생성
      const uploaded = await uploadXlsxIdempotent(
        buf,
        fileName,
        resolvedFolderId,
        lockedTrip?.spreadsheetId,
      );

      // (e) GmTrip 업데이트 (조회·업데이트만, 스키마 변경 없음)
      // 주석: spreadsheetId 칸에 xlsx fileId 저장(Google Sheets 아님, Drive 파일 ID)
      await tx.gmTrip.update({
        where: { id: trip.id },
        data: { googleFolderId: resolvedFolderId, spreadsheetId: uploaded.fileId },
      });

      return { folderId: resolvedFolderId, fileId: uploaded.fileId, viewUrl: uploaded.viewUrl };
    },
    { timeout: 60_000, maxWait: 30_000 },
  );

  logger.info('APIS Drive 저장 완료', { productCode, tripId: trip.id, folderId, fileId, travelerCount });

  return { folderId, fileId, viewUrl, travelerCount };
}
