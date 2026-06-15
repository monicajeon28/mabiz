import { Contact, ContactVisibility, ContactWithSharing } from '@/types/contact';
import { UserRole } from '@prisma/client';

/**
 * 연락처 공유 가능 여부 확인
 * ADMIN_ONLY는 공유 불가, SHARED는 공유 가능
 */
export function canShareContact(
  contact: Contact | ContactWithSharing,
  currentUserId: string
): boolean {
  if (!contact.visibility) return false;
  if (contact.visibility === 'ADMIN_ONLY') return false;
  return contact.visibility === 'SHARED';
}

/**
 * 사용자 역할 기반 연락처 조회 필터링
 * GLOBAL_ADMIN: 모든 연락처 조회
 * AGENT: 본인이 생성하거나 공유받은 연락처만 조회
 * MANAGER: 팀원 연락처 + 공유받은 연락처 조회
 */
export function buildContactQuery(
  role: UserRole | string,
  userId: string,
  organizationId?: string
): Record<string, any> {
  // GLOBAL_ADMIN은 필터 없음
  if (role === 'GLOBAL_ADMIN') {
    return {};
  }

  // AGENT: 본인이 생성하거나 공유받은 연락처
  if (role === 'AGENT' || role === 'BRANCH_MANAGER') {
    return {
      OR: [
        {
          assignedUserId: userId,
        },
        {
          sharedWith: {
            some: {
              sharedTo: userId,
            },
          },
        },
      ],
    };
  }

  // MANAGER: 팀 소속 사용자 + 본인 연락처 + 공유받은 연락처
  // (추후 BranchAssignment를 통해 팀원 조회 필요)
  return {
    OR: [
      {
        assignedUserId: userId,
      },
      {
        sharedWith: {
          some: {
            sharedTo: userId,
          },
        },
      },
    ],
  };
}

/**
 * 조직의 사용자가 공유받은 연락처 목록 조회
 */
export async function getSharedContacts(
  organizationId: string,
  userId: string,
  prisma: any
): Promise<ContactWithSharing[]> {
  try {
    const contacts = await prisma.contact.findMany({
      where: {
        sourceOrgId: organizationId,
        sharedWith: {
          some: {
            sharedTo: userId,
          },
        },
      },
      include: {
        sharedWith: true,
        groups: {
          include: {
            group: true,
          },
        },
        callLogs: {
          orderBy: {
            createdAt: 'desc',
          },
        },
        memos: {
          orderBy: {
            createdAt: 'desc',
          },
        },
        vipSequences: true,
      },
    });

    return contacts as ContactWithSharing[];
  } catch (error) {
    console.error(`[getSharedContacts] 오류: organizationId=${organizationId}, userId=${userId}`, error);
    return [];
  }
}

/**
 * 연락처 공유 권한 검증
 * - 소유자만 공유 가능
 * - visibility가 SHARED인 경우만 공유 가능
 */
export function canUserShareContact(
  contact: ContactWithSharing,
  userId: string
): boolean {
  // 본인이 할당받은 연락처인지 확인
  if (contact.assignedUserId !== userId) {
    return false;
  }

  // visibility가 SHARED인지 확인
  return contact.visibility === 'SHARED';
}

/**
 * 연락처 조회 권한 검증
 * - ADMIN_ONLY: 할당자만 조회 가능
 * - SHARED: 할당자 + 공유받은 사용자 조회 가능
 */
export function canUserViewContact(
  contact: ContactWithSharing,
  userId: string
): boolean {
  // 할당자는 항상 조회 가능
  if (contact.assignedUserId === userId) {
    return true;
  }

  // ADMIN_ONLY는 할당자만 조회 가능
  if (contact.visibility === 'ADMIN_ONLY') {
    return false;
  }

  // SHARED인 경우 공유받은 사용자 확인
  if (contact.visibility === 'SHARED') {
    return contact.sharedWith?.some((share) => share.sharedTo === userId) || false;
  }

  return false;
}

/**
 * 연락처 편집 권한 검증
 * - 할당자만 편집 가능
 */
export function canUserEditContact(
  contact: ContactWithSharing,
  userId: string
): boolean {
  return contact.assignedUserId === userId;
}
