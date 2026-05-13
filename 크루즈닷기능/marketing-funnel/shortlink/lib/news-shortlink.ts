import { randomBytes } from 'crypto';
import prisma from '@/lib/prisma';

export function generateShortCode(): string {
  return randomBytes(4).toString('base64url').slice(0, 6);
}

export function generateSlug(title: string): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const base = title
    .replace(/[^a-zA-Z0-9가-힣\s]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 40);
  return `${base}-${date}`.toLowerCase();
}

export async function assignShortCode(postId: number): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const code = generateShortCode();
    const exists = await prisma.communityPost.findUnique({ where: { shortCode: code }, select: { id: true } });
    if (!exists) {
      await prisma.communityPost.update({ where: { id: postId }, data: { shortCode: code } });
      return code;
    }
  }
  throw new Error('shortCode 생성 실패');
}
