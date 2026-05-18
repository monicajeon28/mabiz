# Menu #38 Phase 4 Track 1: Delta SMS 렌탈 3일 시퀀스

## 개요
렌탈(자유여행/크루즈/호텔) 구매 후 3일 마케팅 자동화 SMS 시퀀스
- PASONA 심리학 기반
- 3가지 세그먼트 변형 (자유여행/크루즈/호텔)
- 4개 메시지 (Day 0~3)

## 파일 구조

### 1. 데이터 JSON
**파일**: `data/delta_sms_sequence.json`

4개 메시지, 각 3가지 세그먼트 변형:
```
Day 0 (구매직후 2시간 내, 09:00): 불안해소
  - Loss Aversion + Reassurance
  - 환불 정책 안내 + 불안감 완화
  
Day 1 (다음날 오전 10:00): 선택 고민 해결
  - Narrative Transportation + Social Proof
  - 여행 준비 가이드 + 의사결정 지원
  
Day 2 (2일차 오후 14:00): 희소성 트리거
  - Scarcity + Urgency
  - 인기 객실 2개 남음 + 업그레이드 권유
  
Day 3 (3일차 저녁 19:00): 최종 확인
  - Call-to-Action + Commitment
  - D-25일 최종 체크리스트
```

### 2. 마이그레이션 SQL
**디렉토리**: `prisma/migrations/20260519000004_extend_sms_template_psychology/`

SmsTemplate 테이블 확장:
- `segmentCode` (VARCHAR): A(자유여행), B(크루즈), C(호텔)
- `psychologyTag` (VARCHAR): Loss Aversion, Scarcity, Social Proof 등
- 3개 신규 인덱스 추가

### 3. Prisma 스키마
**파일**: `prisma/schema.prisma`

SmsTemplate 모델 업데이트:
```prisma
model SmsTemplate {
  ...
  triggerType    String?       // PURCHASE, ABANDONED, WAKE_UP, OTHER
  triggerOffset  Int?          // Day 0~30 offset (분)
  segmentCode    String?       // A/B/C
  psychologyTag  String?       // 심리학 태그
  ...
  @@index([organizationId, segmentCode])
  @@index([organizationId, triggerType, triggerOffset])
  @@index([organizationId, psychologyTag])
}
```

### 4. 시드 스크립트
**파일**: `scripts/seed_delta_sms_sequence.ts`

데이터베이스에 템플릿 자동 생성:
```bash
npx tsx scripts/seed_delta_sms_sequence.ts --org-id <orgId>
```

## 실행 순서

### Step 1: 마이그레이션 적용
```bash
npx prisma migrate deploy
```

### Step 2: 시드 실행 (선택사항)
```bash
npx tsx scripts/seed_delta_sms_sequence.ts --org-id cl1234567890abcdef
```

결과:
- 12개 SmsTemplate 생성 (4 메시지 × 3 세그먼트)
- category: `DELTA_SMS_RENTAL`
- isSystem: true

## PASONA 매핑

| Day | 단계 | 심리학 | 메시지 핵심 |
|-----|------|--------|-----------|
| 0 | Problem | Loss Aversion | "환불 100% 가능" → 불안감 제거 |
| 1 | Agitate/Solution | Narrative Transport | 여행 준비 가이드 제공 |
| 2 | Narrow | Scarcity + Urgency | "2개 남음" → 즉시 행동 |
| 3 | Action | Commitment | "D-25 최종 확인" → 구매 확정 |

## 세그먼트별 변형

### A: 자유여행
- 비자/여권 확인
- 현지 심카드/앱
- 자유 일정 변경

### B: 크루즈
- 탑승 수속 서류
- 선실 위치 확인
- 스위트룸 업그레이드

### C: 호텔
- 객실층/뷰 선택
- 조식 예약
- 라운지/스파 혜택

## 성과 지표

예상 구독율: 18% (PASONA+손실회피)
예상 클릭율: Day 2 > Day 3 > Day 1 > Day 0
예상 업그레이드율: 15% (희소성 트리거)

---

**생성일**: 2026-05-19  
**트랙**: Menu #38 Phase 4 Track 1 Wave 1 (Agent α)  
**상태**: ✅ 완료 (마이그레이션 대기 중)
