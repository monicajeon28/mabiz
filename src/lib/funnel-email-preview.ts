/**
 * Email 미리보기 + 렌더링 헬퍼
 *
 * UI 및 API에서 사용할 편의 함수들
 * - renderEmailPreview(): 변수 치환 후 HTML 미리보기
 * - prepareMultiChannelSequence(): SMS + Email 동시 준비
 */

import {
  selectFunnelEmailTemplate,
  getFunnelEmailTemplateByDay,
  getEmailSubjectByDay,
  renderEmailTemplate,
  EmailSequence,
  EmailSubjects,
  LENS_EMAIL_SUBJECTS_V2,
} from "@/lib/funnel-email-templates";
import { getFunnelSmsTemplateByDay } from "@/lib/funnel-sms-templates";

/**
 * 이메일 미리보기 데이터 구조
 */
export interface EmailPreviewData {
  day: 0 | 1 | 2 | 3;
  lens: string;
  subject: string;
  body: string;
  charCount: number;
  estimatedReadTime: string; // "3분"
  psychology: string[]; // ["L5 신뢰", "L7 동반자"]
  tone: "Trust" | "Solution" | "Social Proof" | "Urgency" | "Excitement";
}

/**
 * 멀티채널 시퀀스 (SMS + Email)
 */
export interface MultiChannelSequence {
  day: 0 | 1 | 2 | 3;
  lens: string;
  sms: {
    text: string;
    charCount: number;
    sendCount: 1 | 2; // SMS vs LMS (90자/건)
  };
  email: {
    subject: string;
    body: string;
    charCount: number;
  };
  scheduledTime: string; // ISO timestamp
  notes: string;
}

/**
 * Email 미리보기 생성
 *
 * @param lens 렌즈 (L0, L1, L2, L6, L10)
 * @param day 회차 (0, 1, 2, 3)
 * @param variables 고객 변수
 * @returns 미리보기 데이터
 */
export function renderEmailPreview(
  lens: string,
  day: 0 | 1 | 2 | 3,
  variables: Record<string, string | number>
): EmailPreviewData {
  const templateBody = getFunnelEmailTemplateByDay(lens, day);
  const templateSubject = getEmailSubjectByDay(lens, day);

  const body = renderEmailTemplate(templateBody, variables);
  const subject = renderEmailTemplate(templateSubject, variables);

  // Psychology mapping
  const psychologyMap: Record<string, string[]> = {
    L0: ["L5 신뢰", "L7 동반자"],
    L1: ["L1 가격 비교", "L3 차별성"],
    L2: ["L2 준비불안 해소", "L9 안전감"],
    L6: ["L6 손실회피", "L6 희소성"],
    L10: ["L10 즉시구매", "L5 자기투영"],
  };

  const toneMap: Record<string, any> = {
    0: "Trust",
    1: "Solution",
    2: "Social Proof",
    3: "Urgency",
  };

  const estimatedReadTime = `${Math.ceil(body.length / 200)}분`;

  return {
    day,
    lens,
    subject,
    body,
    charCount: body.length,
    estimatedReadTime,
    psychology: psychologyMap[lens] || ["L0 기본"],
    tone: toneMap[day] || "Trust",
  };
}

/**
 * 멀티채널 시퀀스 생성 (SMS + Email 동시)
 *
 * @param lens 렌즈
 * @param day 회차
 * @param variables 고객 변수
 * @param scheduleTime Day 기반 자동 계산 (선택사항)
 * @returns 멀티채널 시퀀스
 *
 * 예시:
 *   const seq = prepareMultiChannelSequence("L6", 2, { name: "김철수", ... });
 *   // SMS: 긴박감 메시지, Email: 손실회피 narrative
 */
export function prepareMultiChannelSequence(
  lens: string,
  day: 0 | 1 | 2 | 3,
  variables: Record<string, string | number>,
  scheduleTime?: string
): MultiChannelSequence {
  // SMS 준비 (TODO: SMS 템플릿 함수 필요)
  const smsText = "[SMS 추후 구현]";
  const smsCharCount = smsText.length;
  const smsSendCount = smsCharCount > 90 ? (2 as const) : (1 as const);

  // Email 준비
  const emailPreview = renderEmailPreview(lens, day, variables);

  // 기본 스케줄 계산 (Day 기반)
  const now = new Date();
  let scheduledDate = new Date(now);
  if (!scheduleTime) {
    scheduledDate.setDate(scheduledDate.getDate() + day);
    scheduledDate.setHours(9, 0, 0, 0); // 오전 9시
  }

  // 채널별 톤 설명
  const notesMap: Record<string, Record<number, string>> = {
    L0: {
      0: "SMS: 빠른 신뢰 구축 | Email: 매니저 소개 + 신뢰 구축",
      1: "SMS: 상품 소개 | Email: 3가지 상품 상세 설명",
      2: "SMS: 사회증명 | Email: 92% 고객후기",
      3: "SMS: 최종 강조 | Email: 보증 + 최종 CTA",
    },
    L1: {
      0: "SMS: 가격 자신감 | Email: 투명한 비용 구조",
      1: "SMS: 경쟁 우위 | Email: 비교표 + 할부 설명",
      2: "SMS: 할부 홍보 | Email: 할부 성공사례",
      3: "SMS: 내일 할인 하락 | Email: 할인 계산식",
    },
    L2: {
      0: "SMS: 가이드 약속 | Email: 5단계 준비 로드맵",
      1: "SMS: 준비 단계 | Email: 타임라인 + 체크리스트",
      2: "SMS: 사례 증명 | Email: 89명의 준비 현황",
      3: "SMS: 마지막 격려 | Email: 최종 준비 스케줄",
    },
    L6: {
      0: "SMS: 자리 긴급 공지 | Email: 3개월 마감 패턴",
      1: "SMS: 자리 감소 | Email: 시간당 자리 감소율",
      2: "SMS: 마지막 72시간 | Email: 후회 사례 + 타이머",
      3: "SMS: 24시간 최후 | Email: 선택지 4가지",
    },
    L10: {
      0: "SMS: 축하 + 즉시 | Email: 상위 100명 확정",
      1: "SMS: 예약 확정 | Email: 예약번호 + 다음 단계",
      2: "SMS: 준비 모멘텀 | Email: 준비 현황 + 성공률",
      3: "SMS: 최종 축하 | Email: 현실화 감정 + 약속",
    },
  };

  const notes = notesMap[lens]?.[day] || "멀티채널 자동화";

  return {
    day,
    lens,
    sms: {
      text: smsText,
      charCount: smsCharCount,
      sendCount: smsSendCount,
    },
    email: {
      subject: emailPreview.subject,
      body: emailPreview.body,
      charCount: emailPreview.charCount,
    },
    scheduledTime: scheduleTime || scheduledDate.toISOString(),
    notes,
  };
}

/**
 * 렌즈 메타데이터 조회 (대시보드용)
 */
export interface LensMetadata {
  lens: string;
  name: string;
  description: string;
  psychology: string[];
  targetSegment: string;
  conversionExpectation: string; // "35%" → "55%"
  colors: { primary: string; secondary: string };
}

export function getLensMetadata(lens: string): LensMetadata {
  const metadata: Record<string, LensMetadata> = {
    L0: {
      lens: "L0",
      name: "신규 고객 (기본)",
      description: "신뢰 구축 + 매니저 소개",
      psychology: ["L5 신뢰", "L7 동반자"],
      targetSegment: "전체 (기본값)",
      conversionExpectation: "35% → 45%",
      colors: { primary: "#1e3a5f", secondary: "#e0e7ff" },
    },
    L1: {
      lens: "L1",
      name: "가격 민감 고객",
      description: "가격 비교 + 할부 강조",
      psychology: ["L1 가격 비교", "L3 차별성"],
      targetSegment: "저예산 선호",
      conversionExpectation: "25% → 50%",
      colors: { primary: "#f59e0b", secondary: "#fef3c7" },
    },
    L2: {
      lens: "L2",
      name: "준비 불안 고객",
      description: "불안 해소 + 가이드 제공",
      psychology: ["L2 준비불안 해소", "L9 안전감"],
      targetSegment: "첫 여행 / 복잡한 여행",
      conversionExpectation: "30% → 60%",
      colors: { primary: "#10b981", secondary: "#d1fae5" },
    },
    L6: {
      lens: "L6",
      name: "시간/긴박감 고객",
      description: "희소성 + 손실회피",
      psychology: ["L6 손실회피", "L6 희소성"],
      targetSegment: "결정 불명확 / 지연형",
      conversionExpectation: "20% → 65%",
      colors: { primary: "#ef4444", secondary: "#fee2e2" },
    },
    L10: {
      lens: "L10",
      name: "즉시 구매 고객",
      description: "축하 + 모멘텀 유지",
      psychology: ["L10 즉시구매", "L5 자기투영"],
      targetSegment: "이미 구매 확정",
      conversionExpectation: "90% → 95%",
      colors: { primary: "#27ae60", secondary: "#d5f4e6" },
    },
  };

  return metadata[lens] || metadata["L0"]!;
}

/**
 * 모든 렌즈 목록 조회
 */
export function getAllLensMetadata(): LensMetadata[] {
  return ["L0", "L1", "L2", "L6", "L10"].map((lens) => getLensMetadata(lens));
}
