import { addMinutes } from 'date-fns';

export interface SmsDay0_3Schedule {
  day: number;
  delayMinutes: number;
  label: string;
  phase: string;
}

/**
 * 에빙하우스 망각곡선 기반 Day 0-3 SMS 발송 일정
 * - Day 0 2h: 50%→80% 기억 회복
 * - Day 1 10h: 30%→70% 기억 회복
 * - Day 3 72h: 15%→75% 기억 회복
 * - Day 7 168h: 5% 재참여 (선택)
 */
export const SMS_DAY0_3_SCHEDULE: SmsDay0_3Schedule[] = [
  {
    day: 0,
    delayMinutes: 120, // 2시간 후
    label: 'P (절박감) + A (공감)',
    phase: 'P_A'
  },
  {
    day: 1,
    delayMinutes: 1440 + 600, // 다음날 10:00 (1440분 + 10시간 = 24시간 + 600분)
    label: 'S (해결책) + 공감 강화',
    phase: 'S'
  },
  {
    day: 3,
    delayMinutes: 4320 + 840, // 3일 후 14:00 (4320분 = 3일 + 840분)
    label: 'O (제안) + N (한정) + 최후 기회',
    phase: 'O_N'
  },
  {
    day: 7,
    delayMinutes: 10080 + 600, // 7일 후 10:00 (10080분 = 7일)
    label: 'A (Follow-up)',
    phase: 'FOLLOW_UP'
  }
];

/**
 * 콜 시간으로부터 각 Day별 스케줄된 시간 계산
 */
export function calculateScheduledTime(callTime: Date, day: number): Date {
  const schedule = SMS_DAY0_3_SCHEDULE.find(s => s.day === day);
  if (!schedule) {
    throw new Error(`Invalid day: ${day}`);
  }
  return addMinutes(callTime, schedule.delayMinutes);
}

/**
 * A/B 테스트 그룹 랜덤 배정 (50%/50%)
 */
export function assignAbTestVariant(): 'default' | 'variantb' {
  return Math.random() < 0.5 ? 'default' : 'variantb';
}

/**
 * 세그먼트별 템플릿 ID 생성
 * A = newlywed, B = family, C = couple
 */
export function getTemplateId(
  segment: 'newlywed' | 'family' | 'couple',
  day: number,
  variant: 'default' | 'variantb'
): string {
  const segmentCode = segment === 'newlywed' ? 'A' : segment === 'family' ? 'B' : 'C';
  return `${segmentCode}${day}_${variant}`;
}
