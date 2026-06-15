import { notFound } from 'next/navigation';
import prisma from '@/lib/prisma';

interface Props {
  params: Promise<{ contactId: string }>;
  searchParams: Promise<{ group?: string }>;
}

// SMS 발송 일정 타입 (message 필드 제거 — PII 노출 방지)
interface SmsSchedule {
  id: string;
  scheduledAt: Date;
  status: string;
  round: number | null;
}

// 이메일 발송 일정 타입
interface EmailSchedule {
  id: string;
  scheduledAt: Date;
  status: string;
  day: number;
  subject: string;
}

// 날짜를 한글로 표현 (오늘/내일/모레/N일 후)
function formatRelativeDay(scheduledAt: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetDay = new Date(
    scheduledAt.getFullYear(),
    scheduledAt.getMonth(),
    scheduledAt.getDate(),
  );
  const diffMs = targetDay.getTime() - today.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return '오늘';
  if (diffDays === 1) return '내일';
  if (diffDays === 2) return '모레';
  return `${diffDays}일 후`;
}

export default async function ConfirmPage({ params, searchParams }: Props) {
  const { contactId } = await params;
  const { group: groupId } = await searchParams;

  // 연락처 조회 (공개 접근 — contactId 존재 여부만 확인)
  // PII 보호: name/email 최소 필드만 조회, 표시 시 마스킹 적용
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    select: { id: true, name: true, email: true },
  });

  if (!contact) {
    notFound();
  }

  // 이름 마스킹: "김철수" → "김○○", 1글자 이름은 그대로
  const maskedName =
    contact.name.length > 1
      ? contact.name[0] + '○○'
      : contact.name;

  // 이메일 마스킹: "kim12@gmail.com" → "ki***@gmail.com"
  const maskedEmail =
    contact.email
      ? contact.email.replace(/^(.{2}).+(@.+)$/, '$1***$2')
      : null;

  // 그룹명 조회 (groupId가 있을 때만)
  let groupName: string | null = null;
  if (groupId) {
    const group = await prisma.contactGroup.findUnique({
      where: { id: groupId },
      select: { name: true },
    });
    groupName = group?.name ?? null;
  }

  // SMS Day 0-3 발송 일정 조회 (PENDING 상태, 최대 10개)
  const rawSmsSchedules = await prisma.scheduledSms.findMany({
    where: {
      contactId,
      status: 'PENDING',
    },
    orderBy: { scheduledAt: 'asc' },
    take: 10,
    select: {
      id: true,
      scheduledAt: true,
      status: true,
      round: true,
      // message 필드 제거 — 공개 페이지에서 SMS 내용 노출 방지 (PII)
    },
  });
  const smsSchedules: SmsSchedule[] = rawSmsSchedules;

  // 이메일 Day 0-3 발송 일정 조회 (PENDING 상태, 최대 10개)
  const rawEmailSchedules = await prisma.scheduledEmailMessage.findMany({
    where: {
      contactId,
      status: 'PENDING',
    },
    orderBy: { scheduledAt: 'asc' },
    take: 10,
    select: {
      id: true,
      scheduledAt: true,
      status: true,
      day: true,
      subject: true,
    },
  });
  const emailSchedules: EmailSchedule[] = rawEmailSchedules;

  const hasEmail = !!contact.email && emailSchedules.length > 0;

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)',
        padding: '24px 16px',
        fontFamily: "'Pretendard', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: '480px',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
        }}
      >
        {/* 섹션 1: 신청 완료 헤더 */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: '20px',
            padding: '32px 24px',
            textAlign: 'center',
            boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
          }}
        >
          <div
            style={{
              width: '72px',
              height: '72px',
              background: '#dcfce7',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              fontSize: '36px',
            }}
          >
            ✅
          </div>
          <h1
            style={{
              fontSize: '24px',
              fontWeight: '800',
              color: '#1A1A1A',
              margin: '0 0 12px',
              lineHeight: '1.3',
            }}
          >
            신청 완료!
          </h1>
          <p
            style={{
              fontSize: '18px',
              color: '#333333',
              margin: '0',
              lineHeight: '1.6',
            }}
          >
            <strong>{maskedName}</strong>님, 안녕하세요!
          </p>
          {groupName && (
            <p
              style={{
                fontSize: '16px',
                color: '#666666',
                margin: '8px 0 0',
                lineHeight: '1.6',
              }}
            >
              <strong style={{ color: '#16a34a' }}>{groupName}</strong>에 신청이 완료됐습니다.
            </p>
          )}
          {!groupName && (
            <p
              style={{
                fontSize: '16px',
                color: '#666666',
                margin: '8px 0 0',
                lineHeight: '1.6',
              }}
            >
              신청이 완료됐습니다.
            </p>
          )}
        </div>

        {/* 섹션 2: SMS 발송 일정 */}
        {smsSchedules.length > 0 && (
          <div
            style={{
              background: '#ffffff',
              borderRadius: '20px',
              padding: '24px',
              boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
            }}
          >
            <h2
              style={{
                fontSize: '20px',
                fontWeight: '700',
                color: '#1A1A1A',
                margin: '0 0 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span>📱</span> 문자가 이렇게 발송됩니다
            </h2>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              {smsSchedules.map((sms, index) => {
                const relDay = formatRelativeDay(sms.scheduledAt);
                const isSent = sms.status === 'SENT';
                const dayLabel =
                  sms.round !== null ? `Day ${sms.round}` : `${index + 1}번째`;

                return (
                  <div
                    key={sms.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '14px 16px',
                      background: isSent ? '#f0fdf4' : '#f9fafb',
                      borderRadius: '12px',
                      border: `1px solid ${isSent ? '#bbf7d0' : '#e5e7eb'}`,
                    }}
                  >
                    <span style={{ fontSize: '20px', lineHeight: '1' }}>
                      {isSent ? '✅' : '⏳'}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                        }}
                      >
                        <span
                          style={{
                            fontSize: '12px',
                            fontWeight: '700',
                            color: '#6b7280',
                            background: '#e5e7eb',
                            borderRadius: '6px',
                            padding: '2px 8px',
                          }}
                        >
                          {dayLabel}
                        </span>
                        <span
                          style={{
                            fontSize: '14px',
                            fontWeight: '600',
                            color: '#374151',
                          }}
                        >
                          {relDay}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 섹션 3: 이메일 발송 일정 (이메일 있을 때만) */}
        {hasEmail && (
          <div
            style={{
              background: '#ffffff',
              borderRadius: '20px',
              padding: '24px',
              boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
            }}
          >
            <h2
              style={{
                fontSize: '20px',
                fontWeight: '700',
                color: '#1A1A1A',
                margin: '0 0 8px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span>📧</span> 이메일도 받아보세요
            </h2>
            <p
              style={{
                fontSize: '14px',
                color: '#666666',
                margin: '0 0 16px',
                lineHeight: '1.6',
              }}
            >
              {maskedEmail}으로 같은 일정에 이메일도 발송됩니다.
            </p>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              {emailSchedules.map((email) => {
                const relDay = formatRelativeDay(email.scheduledAt);
                const isSent = email.status === 'SENT';

                return (
                  <div
                    key={email.id}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                      padding: '14px 16px',
                      background: isSent ? '#f0fdf4' : '#f9fafb',
                      borderRadius: '12px',
                      border: `1px solid ${isSent ? '#bbf7d0' : '#e5e7eb'}`,
                    }}
                  >
                    <span style={{ fontSize: '20px', lineHeight: '1', marginTop: '2px' }}>
                      {isSent ? '✅' : '⏳'}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          marginBottom: '4px',
                        }}
                      >
                        <span
                          style={{
                            fontSize: '12px',
                            fontWeight: '700',
                            color: '#6b7280',
                            background: '#e5e7eb',
                            borderRadius: '6px',
                            padding: '2px 8px',
                          }}
                        >
                          Day {email.day}
                        </span>
                        <span
                          style={{
                            fontSize: '14px',
                            fontWeight: '600',
                            color: '#374151',
                          }}
                        >
                          {relDay}
                        </span>
                      </div>
                      <p
                        style={{
                          fontSize: '14px',
                          color: '#6b7280',
                          margin: '0',
                          lineHeight: '1.5',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {email.subject}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 섹션 4: 안내 문구 (발송 일정이 없을 때도 표시) */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: '20px',
            padding: '24px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
            textAlign: 'center',
          }}
        >
          <p
            style={{
              fontSize: '16px',
              color: '#374151',
              margin: '0 0 8px',
              lineHeight: '1.6',
              fontWeight: '600',
            }}
          >
            담당자가 곧 연락드릴 예정입니다.
          </p>
          <p
            style={{
              fontSize: '14px',
              color: '#9ca3af',
              margin: '0',
              lineHeight: '1.6',
            }}
          >
            문자 및 이메일을 확인해 주세요.
          </p>
        </div>
      </div>
    </div>
  );
}
