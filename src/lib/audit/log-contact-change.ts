import prisma from '@/lib/prisma';

export interface LogContactChangeOpts {
  contactId: string;
  organizationId: string;
  userId?: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'IMPORT';
  fieldChanged?: string;
  oldValue?: any;
  newValue?: any;
  reason?: string;
}

/**
 * Contact 변경 이력을 기록하는 헬퍼 함수
 * 실패 시 로그만 출력하고 메인 작업은 계속 진행 (non-blocking)
 */
export async function logContactChange(opts: LogContactChangeOpts): Promise<void> {
  try {
    await prisma.contactAuditLog.create({
      data: {
        contactId: opts.contactId,
        organizationId: opts.organizationId,
        userId: opts.userId,
        action: opts.action,
        fieldChanged: opts.fieldChanged,
        oldValue: opts.oldValue ? JSON.stringify(opts.oldValue) : null,
        newValue: opts.newValue ? JSON.stringify(opts.newValue) : null,
        reason: opts.reason,
      },
    });
  } catch (err) {
    console.error('[logContactChange] 실패:', {
      contactId: opts.contactId,
      action: opts.action,
      fieldChanged: opts.fieldChanged,
      error: err instanceof Error ? err.message : String(err),
    });
    // 실패해도 메인 작업 계속 (non-blocking)
  }
}

/**
 * 여러 필드 변경을 한 번에 로깅
 * 각 필드별로 별도의 AuditLog 엔트리 생성
 */
export async function logContactChanges(opts: {
  contactId: string;
  organizationId: string;
  userId?: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'IMPORT';
  changes: Array<{
    fieldChanged: string;
    oldValue: any;
    newValue: any;
    reason?: string;
  }>;
}): Promise<void> {
  for (const change of opts.changes) {
    await logContactChange({
      contactId: opts.contactId,
      organizationId: opts.organizationId,
      userId: opts.userId,
      action: opts.action,
      fieldChanged: change.fieldChanged,
      oldValue: change.oldValue,
      newValue: change.newValue,
      reason: change.reason,
    });
  }
}
