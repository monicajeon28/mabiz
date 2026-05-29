-- SMS 라이브 방송 템플릿 시드 데이터
-- category: LIVE_BROADCAST (3개 템플릿)
-- 생성일: 2026-05-29

INSERT INTO "SmsTemplate" (
  id,
  "organizationId",
  category,
  title,
  content,
  "triggerType",
  "triggerOffset",
  "isSystem",
  "usageCount",
  "createdAt",
  "updatedAt",
  "psychologyTag",
  "segmentCode"
) VALUES
(
  'live-broadcast-day-of-invitation',
  NULL,
  'LIVE_BROADCAST',
  '라이브방송 당일 초대',
  '[이름]님, 오늘 오후 8시 크루즈 라이브 방송을 진행합니다! 카카오톡 오픈채팅방으로 들어오세요 → https://open.kakao.com/o/plREDDUh',
  'LIVE_DAY',
  0,
  TRUE,
  0,
  NOW(),
  NOW(),
  'URGENCY',
  'LIVE_AUDIENCE'
),
(
  'live-broadcast-1hr-before',
  NULL,
  'LIVE_BROADCAST',
  '라이브방송 1시간 전 알림',
  '[이름]님, 1시간 후 [상품명] 라이브 방송 시작합니다. 방송 한정 특가 공개 예정! 지금 입장 → https://open.kakao.com/o/plREDDUh',
  'LIVE_REMINDER',
  -60,
  TRUE,
  0,
  NOW(),
  NOW(),
  'SCARCITY',
  'LIVE_AUDIENCE'
),
(
  'live-broadcast-followup',
  NULL,
  'LIVE_BROADCAST',
  '방송 후 팔로업',
  '[이름]님 오늘 방송 참여 감사합니다! [상품명] 방송 특가는 48시간만 유효합니다. 상담 문의: [담당자]',
  'POST_LIVE',
  0,
  TRUE,
  0,
  NOW(),
  NOW(),
  'LOSS_AVERSION',
  'LIVE_PARTICIPANT'
);
