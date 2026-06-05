/**
 * APIS 협업 편집 기반 헬퍼 (Phase 0)
 *
 * 모든 탑승객(Traveler) 쓰기를 "변경 + 감사로그 기록 + 낙관적 잠금"으로 묶는다.
 * - 쓰기와 audit를 같은 트랜잭션에 묶어 '수정했는데 누가 바꿨는지 기록 안 됨'을 코드상 차단.
 * - version 불일치 시 충돌(409)로 막아 '마지막 저장이 앞사람 입력을 덮어쓰는' lost-update 방지.
 * - updatedBy = 마지막 수정자(userId), updatedAt = @updatedAt 자동 갱신.
 */
import prisma from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

/** 낙관적 잠금 충돌 — 다른 사람이 먼저 수정함. latest로 최신본 반환. */
export class TravelerVersionConflict extends Error {
  constructor(public latest: unknown) {
    super('TRAVELER_VERSION_CONFLICT');
    this.name = 'TravelerVersionConflict';
  }
}

/** 대상 탑승객 없음 */
export class TravelerNotFound extends Error {
  constructor() {
    super('TRAVELER_NOT_FOUND');
    this.name = 'TravelerNotFound';
  }
}

/** Traveler 수정 가능 필드 화이트리스트 (임의 컬럼 주입 방지) */
const EDITABLE_FIELDS = [
  'roomNumber', 'isSingleCharge', 'engSurname', 'engGivenName', 'korName',
  'residentNum', 'gender', 'birthDate', 'passportNo', 'issueDate', 'expiryDate',
  'nationality', 'notes', 'phone', 'companionGroupId', 'roomingGroupId',
  'passportImage', 'passportDriveUrl',
] as const;

type EditableField = typeof EDITABLE_FIELDS[number];

export interface WriteTravelerParams {
  travelerId: number;
  /** 변경할 필드들 (화이트리스트 외 키는 무시) */
  changes: Partial<Record<EditableField, unknown>>;
  /** 수정자 userId (OrganizationMember/GlobalAdmin). 없으면 null 기록 */
  userId: number | null;
  /** 낙관적 잠금: 제공 시 현재 version과 비교, 불일치하면 충돌 */
  expectedVersion?: number;
  /** 감사 action 라벨 (기본 TRAVELER_UPDATE) */
  action?: string;
}

/**
 * 탑승객 1건을 안전하게 수정한다. 변경 + version+1 + updatedBy + 감사로그를 한 트랜잭션으로.
 * @throws TravelerVersionConflict version 불일치
 * @throws TravelerNotFound 대상 없음
 */
export async function writeTravelerWithAudit(params: WriteTravelerParams) {
  const { travelerId, changes, userId, expectedVersion, action } = params;

  // 화이트리스트로 정제 (undefined 제외)
  const safe: Record<string, unknown> = {};
  for (const k of EDITABLE_FIELDS) {
    if (k in changes && changes[k] !== undefined) safe[k] = changes[k];
  }

  return prisma.$transaction(async (tx) => {
    const cur = await tx.gmTraveler.findUnique({ where: { id: travelerId } });
    if (!cur) throw new TravelerNotFound();

    // 낙관적 잠금
    if (expectedVersion !== undefined && cur.version !== expectedVersion) {
      throw new TravelerVersionConflict(cur);
    }

    // 변경 전/후 스냅샷 (변경 필드만 — 감사로그 가독성)
    const curRecord = cur as unknown as Record<string, unknown>;
    const oldValue: Record<string, unknown> = {};
    const newValue: Record<string, unknown> = {};
    for (const k of Object.keys(safe)) {
      oldValue[k] = curRecord[k];
      newValue[k] = safe[k];
    }

    const updated = await tx.gmTraveler.update({
      where: { id: travelerId },
      data: {
        ...(safe as Prisma.GmTravelerUpdateInput),
        version: { increment: 1 },
        updatedBy: userId,
      },
    });

    await tx.gmReservationAudit.create({
      data: {
        reservationId: cur.reservationId,
        userId,
        action: action ?? 'TRAVELER_UPDATE',
        oldValue: JSON.stringify(oldValue),
        newValue: JSON.stringify(newValue),
        metadata: { travelerId } as Prisma.InputJsonValue,
      },
    });

    return updated;
  });
}
