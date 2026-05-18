-- Menu #38 Phase 4 Track 1: Delta SMS 렌탈 시퀀스 마이그레이션
-- SmsTemplate 테이블에 심리학 기반 세그먼테이션 필드 추가

-- segmentCode: 세그먼트 코드 (A: 자유여행, B: 크루즈, C: 호텔)
ALTER TABLE "SmsTemplate"
ADD COLUMN "segmentCode" VARCHAR(1),
ADD COLUMN "psychologyTag" VARCHAR(255);

-- segmentCode 인덱스 추가 (빠른 쿼리)
CREATE INDEX "idx_sms_template_segment_code" ON "SmsTemplate"("organizationId", "segmentCode");

-- psychologyTag 인덱스 추가 (심리학 태그별 분석)
CREATE INDEX "idx_sms_template_psychology_tag" ON "SmsTemplate"("organizationId", "psychologyTag");

-- triggerType별 인덱스 최적화 (Day 0~3 시퀀스 조회)
CREATE INDEX "idx_sms_template_trigger_sequence" ON "SmsTemplate"("organizationId", "triggerType", "triggerOffset");

-- 코멘트 추가 (메타데이터)
COMMENT ON COLUMN "SmsTemplate"."segmentCode" IS 'PASONA 세그먼트: A(자유여행), B(크루즈), C(호텔)';
COMMENT ON COLUMN "SmsTemplate"."psychologyTag" IS '적용 심리학 이론: Loss Aversion, Scarcity, Social Proof, Narrative Transportation, Urgency, Commitment, Reassurance';
COMMENT ON COLUMN "SmsTemplate"."triggerType" IS 'SMS 트리거 유형: PURCHASE(구매), ABANDONED(장바구니), WAKE_UP(재참여), OTHER(기타)';
COMMENT ON COLUMN "SmsTemplate"."triggerOffset" IS '트리거 이후 분 단위 딜레이 (Day 0~30, 0=즉시, 1440=1일, 2880=2일, 4320=3일)';
