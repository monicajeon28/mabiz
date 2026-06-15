import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

/**
 * 입력 검증 함수
 * 서명자명, 이메일, 전화 형식 검증
 */
export function validateDuplicateInput(input: {
  newSignerName: string;
  newSignerEmail: string;
  newSignerPhone?: string;
}): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  // 서명자명 검증
  if (!input.newSignerName || input.newSignerName.trim().length < 2) {
    errors.newSignerName = "서명자명은 2글자 이상이어야 합니다";
  }

  // 이메일 검증
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!input.newSignerEmail || !emailRegex.test(input.newSignerEmail)) {
    errors.newSignerEmail = "유효한 이메일 형식이 아닙니다";
  }

  // 전화 검증 (선택사항, 형식만 확인)
  if (input.newSignerPhone) {
    const phoneRegex = /^[\d\-\+\(\)\s]+$/;
    if (!phoneRegex.test(input.newSignerPhone)) {
      errors.newSignerPhone = "유효한 전화번호 형식이 아닙니다";
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Contact 생성 또는 선택 함수
 * existingContactId가 있으면 그 Contact 사용
 * 없으면 새 Contact 생성
 */
export async function resolveContactForDuplicate(
  organizationId: string,
  contactData: {
    name: string;
    email: string;
    phone?: string;
  },
  existingContactId?: string
): Promise<string> {
  // 기존 Contact 사용
  if (existingContactId) {
    const contact = await prisma.contact.findUnique({
      where: { id: existingContactId },
    });

    if (!contact || contact.organizationId !== organizationId) {
      throw new Error("연락처를 찾을 수 없습니다");
    }

    return existingContactId;
  }

  // 새 Contact 생성
  const newContact = await prisma.contact.create({
    data: {
      organizationId,
      name: contactData.name,
      email: contactData.email,
      phone: contactData.phone || "",
      createdAt: new Date(),
    },
  });

  return newContact.id;
}

/**
 * ContractInstance 복제 함수
 * 기존 인스턴스를 기반으로 새 인스턴스 생성
 * 트랜잭션 내부에서만 호출 가능
 */
export async function duplicateContractInstanceTx(
  tx: Prisma.TransactionClient,
  originalInstanceId: string,
  newContactId: string,
  organizationId: string
) {
  // 기존 인스턴스 조회
  const originalInstance = await tx.contractInstance.findUnique({
    where: { id: originalInstanceId },
    include: {
      template: {
        select: { id: true, name: true, psychologyLenses: true },
      },
    },
  });

  if (!originalInstance) {
    throw new Error("계약서를 찾을 수 없습니다");
  }

  if (originalInstance.organizationId !== organizationId) {
    throw new Error("접근 권한이 없습니다");
  }

  // 새 인스턴스 생성
  const newInstance = await tx.contractInstance.create({
    data: {
      organizationId,
      templateId: originalInstance.templateId,
      contactId: newContactId,
      // 기존 boundData 복사
      boundData: originalInstance.boundData || {},
      // DRAFT 상태로 초기화
      status: "DRAFT",
      // SMS 필드 초기화
      smsDay0Sent: false,
      smsDay0SentAt: null,
      smsDay1Sent: false,
      smsDay1SentAt: null,
      smsDay2Sent: false,
      smsDay2SentAt: null,
      smsDay3Sent: false,
      smsDay3SentAt: null,
      // 유효기한 설정 (24시간)
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      // 렌즈 복사
      appliedLenses: originalInstance.appliedLenses || [],
      // 재시도 필드 초기화
      retryCount: 0,
      reminderCount: 0,
      lastReminderSentAt: null,
    },
  });

  return newInstance;
}

/**
 * 최근 Contact 목록 조회 (모달 드롭다운용)
 * organizationId 기준으로 최근 10개 Contact 반환
 */
export async function getRecentContacts(
  organizationId: string,
  limit: number = 10
) {
  const contacts = await prisma.contact.findMany({
    where: { organizationId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return contacts;
}

/**
 * 전화번호 형식 자동 수정 (하이픈 추가)
 * 010-1234-5678 형식으로 변환
 */
export function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");

  if (cleaned.length === 10) {
    return cleaned.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3");
  } else if (cleaned.length === 11) {
    return cleaned.replace(/(\d{3})(\d{4})(\d{4})/, "$1-$2-$3");
  }

  return phone;
}
