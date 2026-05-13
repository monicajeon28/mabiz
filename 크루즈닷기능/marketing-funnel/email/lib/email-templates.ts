/**
 * O-1: 이메일 템플릿 정의
 * Handlebars 템플릿 문법 사용
 * 각 템플릿은 예약 확인, 탑승 리마인더 등의 자동 이메일
 */

export interface EmailTemplateConfig {
  name: string;
  subject: string;
  body: string;
  variables: string[];
}

export const emailTemplates: Record<string, EmailTemplateConfig> = {
  // 예약 확인 이메일
  reservationConfirmation: {
    name: 'reservation-confirmation',
    subject: '예약 확인 - {{shipName}} {{departureDate}}',
    body: `안녕하세요!

크루즈 예약이 완료되었습니다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ 예약 정보
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

선박명: {{shipName}}
출발일: {{departureDate}}
선실 타입: {{cabinType}}
탑승인원: {{passengerCount}}명
예약 금액: {{amount}}원
예약 번호: {{bookingId}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 다음 단계
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. 탑승 안내: {{boardingUrl}}
2. 예약 관리: {{manageUrl}}
3. 취소하기: {{cancelUrl}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

예약해주셔서 감사합니다!
더 궁금한 사항이 있으시면 언제든지 연락주세요.

크루즈닷몰
support@cruise.com | 1588-0000`,
    variables: [
      'shipName',
      'departureDate',
      'cabinType',
      'passengerCount',
      'amount',
      'bookingId',
      'boardingUrl',
      'manageUrl',
      'cancelUrl',
    ],
  },

  // 탑승 리마인더 이메일 (출발 5일 전)
  boardingReminder: {
    name: 'boarding-reminder',
    subject: '⏰ 탑승 안내 - {{shipName}} (출발일 5일 전)',
    body: `안녕하세요, {{customerName}}님!

출발이 5일 남았습니다.
탑승을 위해 필요한 정보를 안내해드립니다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚢 탑승 정보
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

선박명: {{shipName}}
출발일: {{departureDate}}
탑승 시간: {{boardingTime}}
탑승 장소: {{boardingLocation}}
예약 번호: {{bookingId}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 준비 물품
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- 여권 (원본)
- 예약 확인서
- 신용카드 (선내 결제용)
- 의료보험 정보

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔗 빠른 링크
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

온라인 체크인: {{checkInUrl}}
여행 정보: {{travelInfoUrl}}

탑승이 가까워졌습니다!
질문이 있으시면 연락주세요.

크루즈닷몰
support@cruise.com | 1588-0000`,
    variables: [
      'customerName',
      'shipName',
      'departureDate',
      'boardingTime',
      'boardingLocation',
      'bookingId',
      'checkInUrl',
      'travelInfoUrl',
    ],
  },

  // 결제 영수증
  paymentReceipt: {
    name: 'payment-receipt',
    subject: '결제 완료 - {{amount}}원',
    body: `안녕하세요!

결제가 완료되었습니다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ 결제 정보
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

결제액: {{amount}}원
결제일: {{paymentDate}}
결제 방법: {{paymentMethod}}
거래 ID: {{transactionId}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 예약 정보
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

선박명: {{shipName}}
출발일: {{departureDate}}
예약 번호: {{bookingId}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📄 영수증
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

영수증 다운로드: {{receiptUrl}}

결제해주셔서 감사합니다.
즐거운 여행 되세요!

크루즈닷몰
support@cruise.com | 1588-0000`,
    variables: [
      'amount',
      'paymentDate',
      'paymentMethod',
      'transactionId',
      'shipName',
      'departureDate',
      'bookingId',
      'receiptUrl',
    ],
  },

  // 환불 확인 이메일
  refundConfirmation: {
    name: 'refund-confirmation',
    subject: '환불 처리 완료 - {{refundAmount}}원',
    body: `안녕하세요!

환불이 정상 처리되었습니다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ 환불 정보
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

환불액: {{refundAmount}}원
환불일: {{refundDate}}
환불 사유: {{refundReason}}
거래 ID: {{transactionId}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💳 환불 계좌
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

은행: {{bankName}}
계좌: {{accountMasked}}

환불은 3-5 영업일 이내에 계좌로 입금됩니다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

불편을 드렸으며 죄송합니다.
더 궁금한 사항은 support@cruise.com으로 연락주세요.

크루즈닷몰
support@cruise.com | 1588-0000`,
    variables: [
      'refundAmount',
      'refundDate',
      'refundReason',
      'transactionId',
      'bankName',
      'accountMasked',
    ],
  },

  // 예약 취소 확인
  cancellationConfirmation: {
    name: 'cancellation-confirmation',
    subject: '예약 취소 완료 - {{bookingId}}',
    body: `안녕하세요!

예약이 정상 취소되었습니다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ 취소 정보
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

예약 번호: {{bookingId}}
취소일: {{cancellationDate}}
선박명: {{shipName}}
출발일: {{departureDate}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 환불 예정
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

환불 예정액: {{refundAmount}}원
환불 예정일: {{refundExpectedDate}}
취소 수수료: {{cancellationFee}}원

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

예약을 취소해주셨습니다.
다음에 더 좋은 서비스로 뵐 수 있기를 바랍니다.

크루즈닷몰
support@cruise.com | 1588-0000`,
    variables: [
      'bookingId',
      'cancellationDate',
      'shipName',
      'departureDate',
      'refundAmount',
      'refundExpectedDate',
      'cancellationFee',
    ],
  },
};

/**
 * 이메일 템플릿 Seed 데이터
 * Prisma seed에서 사용
 */
export function getEmailTemplatesSeed() {
  return Object.values(emailTemplates).map((template) => ({
    name: template.name,
    subject: template.subject,
    body: template.body,
    variables: template.variables,
    isActive: true,
  }));
}
