/**
 * Menu #38 Phase 3-β: Contact 스냅샷 캐싱
 *
 * 목적:
 * - 재시도 시 Contact DB 조회 제거 (N+1 쿼리 최적화)
 * - 발송 당시 연락처 정보 보존 (이름/전화/이메일 변경 추적 불필요)
 * - 재시도 로직에서 스냅샷 사용으로 성능 개선
 *
 * 특징:
 * - ContactSnapshot 구조 정의 (id + phone + email + name)
 * - 메모리 캐시 (발송 배치 내) + 선택적 Redis 캐시 (장시간 재시도용)
 * - sendToContactByTemplate() 호출 시 snapshot 함께 전달
 * - retrySendingMessage() 호출 시 캐시된 snapshot 사용
 */

export interface ContactSnapshot {
  id: string;
  phone: string | null;
  email: string | null;
  name?: string | null;
}

/**
 * 메모리 기반 Contact 스냅샷 캐시
 * - 발송 배치 중 사용 (BATCH_SIZE = 150건)
 * - 배치 완료 후 자동 정리 (메모리 누수 방지)
 */
export class ContactSnapshotCache {
  private cache: Map<string, ContactSnapshot> = new Map();

  /**
   * 스냅샷 저장
   */
  set(contactId: string, snapshot: ContactSnapshot): void {
    this.cache.set(contactId, snapshot);
  }

  /**
   * 스냅샷 조회 (있으면 반환, 없으면 null)
   */
  get(contactId: string): ContactSnapshot | null {
    return this.cache.get(contactId) ?? null;
  }

  /**
   * 일괄 저장
   */
  setMany(snapshots: ContactSnapshot[]): void {
    snapshots.forEach((snapshot) => {
      this.cache.set(snapshot.id, snapshot);
    });
  }

  /**
   * 캐시 크기
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * 캐시 정리 (배치 완료 후)
   */
  clear(): void {
    this.cache.clear();
  }
}

/**
 * Redis 기반 Contact 스냅샷 캐시 (장시간 재시도용)
 * - TTL: 72시간 (3일, 최대 재시도 기간)
 * - 키 형식: `contact:snapshot:{contactId}`
 */
export async function cacheContactSnapshotToRedis(
  contactId: string,
  snapshot: ContactSnapshot,
  redis: any
): Promise<void> {
  const key = `contact:snapshot:${contactId}`;
  const ttlSeconds = 72 * 60 * 60; // 72시간

  try {
    await redis.setex(key, ttlSeconds, JSON.stringify(snapshot));
  } catch (err) {
    // Redis 실패는 무시 (메모리 캐시 사용)
    console.warn(`[ContactSnapshot] Redis 저장 실패: ${contactId}`, err);
  }
}

/**
 * Redis에서 Contact 스냅샷 조회
 */
export async function getContactSnapshotFromRedis(
  contactId: string,
  redis: any
): Promise<ContactSnapshot | null> {
  const key = `contact:snapshot:${contactId}`;

  try {
    const json = await redis.get(key);
    if (!json) return null;

    return JSON.parse(json) as ContactSnapshot;
  } catch (err) {
    // Redis 실패는 무시
    console.warn(`[ContactSnapshot] Redis 조회 실패: ${contactId}`, err);
    return null;
  }
}

/**
 * Redis에서 Contact 스냅샷 삭제
 */
export async function deleteContactSnapshotFromRedis(
  contactId: string,
  redis: any
): Promise<void> {
  const key = `contact:snapshot:${contactId}`;

  try {
    await redis.del(key);
  } catch (err) {
    // Redis 실패는 무시
    console.warn(`[ContactSnapshot] Redis 삭제 실패: ${contactId}`, err);
  }
}
