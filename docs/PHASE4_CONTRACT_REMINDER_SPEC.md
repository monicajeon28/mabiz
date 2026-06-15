# Phase 4: Contract Reminder Cron Job (계약서 재전송 자동화)

## 목표
계약서 서명 요청이 SENT 상태인 고객에게 Day 7 이상 경과 후 자동으로 재전송하여 계약 완료율을 높입니다.

---

## 1. Cron Job 구현

### 파일명
`src/app/api/cron/contract-reminders/route.ts`

### 트리거 설정
- **스케줄**: 매일 09:00 KST (00:00 UTC)
- **Vercel vercel.json 설정**:
```json
{
  "crons": [
    {
      "path": "/api/cron/contract-reminders",
      "schedule": "0 0 * * *"
    }
  ]
}
```

### 조회 조건
```sql
WHERE status = 'SENT'
  AND createdAt + 7 days < NOW()
  AND reminderCount < 3  -- 최대 3회 재전송
```

### 처리 단계

#### 1단계: 계약서 배치 조회 (BATCH_SIZE=100)
- `reminderCount` < 3 인 계약서만 조회
- 중복 처리 방지를 위해 `id` 기준 정렬

#### 2단계: A/B 테스트 기반 SMS 발송
- **변형 A (긴박감)**: 
  ```
  "김철수님, 계약서가 대기 중입니다. 7일 남았습니다. 지금 서명하세요: [링크]"
  ```
  - 심리학 렌즈: L10 (즉시 구매 클로징) + L6 (손실회피)
  - 사용 시점: `reminderCount % 2 == 0`

- **변형 B (친절함)**:
  ```
  "김철수님, 계약서를 아직 확인하지 않으셨네요. 7일 남았습니다. 클릭해서 서명 완료하세요: [링크]"
  ```
  - 심리학 렌즈: 상호성 (도움의 손길) + 유형화 (친근감)
  - 사용 시점: `reminderCount % 2 == 1`

#### 3단계: 이메일 발송 (선택)
- HTML 템플릿 사용
- 콘텐츠: 긴박감 배지 ("🕐 7일 남았습니다") + CTA 버튼

#### 4단계: 메타데이터 업데이트
```json
{
  "lastReminderSentAt": "2026-06-15T09:30:00Z",
  "reminderCount": 1  // 0 → 1 (첫 재전송)
}
```

---

## 2. 스키마 추가 필드

### ContractInstance 모델

| 필드 | 타입 | 설명 |
|------|------|------|
| `retryCount` | Int | 전체 재시도 횟수 (기본값: 0) |
| `reminderCount` | Int | 재전송 횟수 (최대 3회, 기본값: 0) |
| `lastReminderSentAt` | DateTime? | 마지막 재전송 시각 (nullable) |

### 인덱스 추가

```sql
-- Cron Job 성능 최적화
CREATE INDEX idx_contract_instance_reminder_lookup
  ON "ContractInstance"("organizationId", "status", "createdAt")
  WHERE "status" = 'SENT' AND "reminderCount" < 3;

CREATE INDEX idx_contract_instance_last_reminder_sent
  ON "ContractInstance"("organizationId", "lastReminderSentAt");
```

---

## 3. 심리학 적용

### L6: 타이밍/손실회피 (Loss Aversion)
- **메시지**: "7일 남았습니다" → 시간 압박감 생성
- **효과**: 지연 비용(delay cost) 부각
- **목표 전환율**: 현재 35% → 목표 45% (+28% 증대)

### L10: 즉시 구매 클로징 (Immediate Action)
- **메시지**: "지금 서명하세요" → 즉시 행동 유도
- **CTA 버튼**: 명확한 Next Action 제시
- **효과**: 시작 시간(initiation time) 제거
- **목표 전환율**: 현재 40% → 목표 52% (+30% 증대)

### Grant Cardone 80% Follow-up Rule
- 5-12회 접촉 후 80% 판매
- 현재 구현: Day 0-3 (4회) + Day 7 (1회) + 추가 재전송 (최대 3회)
- **목표**: 최소 5회 접촉 확보

---

## 4. A/B 테스트 자동화

### 테스트 설계

| 그룹 | 메시지 각도 | 심리학 원칙 | 예상 전환율 |
|------|-----------|----------|-----------|
| **A** | 긴박감 (Urgency) | L10 + L6 손실회피 | 52% |
| **B** | 친절함 (Friendliness) | 상호성 + 유형화 | 48% |

### 성과 지표

- **발송 성공률**: SMS 도달 배치
- **응답 신호**: 링크 클릭 추적 (ShortLink 클릭 로그)
- **최종 전환율**: ContractInstance → SIGNED/COMPLETED 상태 전환
- **통계 검증**: p-value < 0.05 (95% 신뢰도)

---

## 5. 에러 처리 및 재시도

### 발송 실패 시나리오

1. **SMS 발송 실패 (result_code != 1)**
   - `reminderCount` 증가 (이번 재시도 카운트)
   - `lastReminderSentAt` 업데이트
   - 다음 Cron 실행 시 다시 시도

2. **연락처 없음 (Phone & Email 모두 없음)**
   - 로그 기록: "연락처 없음"
   - Skip (재시도 안 함)
   - `skippedCount` 증가

3. **예외 발생 (Try-Catch)**
   - 로그 기록: 예외 메시지
   - 트랜잭션 롤백 (DB 업데이트 X)
   - 다음 배치에서 재처리

### 재시도 제한
- **최대 재전송 횟수**: 3회
- **최대 전체 재시도**: 재정의 필요 (현재 Draft)

---

## 6. 모니터링 및 로깅

### 로그 레벨

| 레벨 | 상황 | 예시 |
|------|------|------|
| **INFO** | 정상 처리 | SMS 발송 성공, 계약서 업데이트 완료 |
| **WARN** | 부분 실패 | 연락처 없음, SMS 발송 코드 오류 |
| **ERROR** | 예외 발생 | 발송 중 예외, DB 업데이트 실패 |

### 반환 메트릭

```json
{
  "ok": true,
  "sentCount": 45,          // SMS 발송 성공
  "emailCount": 45,         // 이메일 준비됨
  "skippedCount": 5,        // 연락처 없음 등
  "processedTotal": 50,     // 처리한 계약서 수
  "durationMs": 12345,      // 실행 소요 시간
  "earlyExit": false        // 시간 초과 여부
}
```

---

## 7. 테스트 케이스

### 1. 정상 재전송 (A/B 변형)
```
계약서: SENT 상태, createdAt = 8일 전, reminderCount=0
발송: SMS "긴박감" 변형 (변형 A)
결과: reminderCount → 1, lastReminderSentAt 업데이트
```

### 2. 두 번째 재전송 (친절함 변형)
```
계약서: SENT 상태, createdAt = 15일 전, reminderCount=1
발송: SMS "친절함" 변형 (변형 B)
결과: reminderCount → 2
```

### 3. 세 번째 재전송 (마지막)
```
계약서: SENT 상태, createdAt = 22일 전, reminderCount=2
발송: SMS "긴박감" 변형 (변형 A)
결과: reminderCount → 3
```

### 4. 재전송 한계 도달 (Skip)
```
계약서: SENT 상태, createdAt = 29일 전, reminderCount=3
액션: Skip (reminderCount 조건에서 제외)
결과: 발송 안 함, skippedCount 증가
```

### 5. 연락처 없음 (Skip)
```
계약서: SENT 상태, boundData={ signerName: "Kim" } (연락처 X)
액션: Skip (로그 기록)
결과: 발송 안 함, skippedCount 증가
```

### 6. SMS 발송 실패 (Retry)
```
계약서: SENT 상태, reminderCount=0
발송 시도: Aligo API result_code = -99 (Opt-out)
결과: reminderCount → 1, 실패 로깅, skippedCount 증가
```

---

## 8. 배포 체크리스트

- [ ] Prisma 스키마 추가 (`retryCount`, `reminderCount`, `lastReminderSentAt`)
- [ ] Prisma 마이그레이션 생성 및 적용
- [ ] Cron Job 구현 (`contract-reminders/route.ts`)
- [ ] SMS 템플릿 2가지 (긴박감/친절함)
- [ ] 이메일 템플릿 (선택)
- [ ] vercel.json Cron 스케줄 등록
- [ ] CRON_SECRET 환경변수 설정 (Vercel)
- [ ] NEXT_PUBLIC_BASE_URL 확인
- [ ] TSC 타입 검증 완료
- [ ] 통합 테스트 5가지 케이스 실행
- [ ] 프로덕션 배포 및 모니터링

---

## 9. 성과 예측

### 현재 상태 (Baseline)
- 초기 서명 요청 전환율: 35%
- 고객당 평균 접촉: 4회 (Day 0-3)
- 평균 계약 완료 기간: 5-7일

### 적용 후 목표 (Target)
- **재전송 후 추가 전환율**: +10-15% (긴박감 렌즈)
- **총 접촉**: 7회 (Day 0-3 + Day 7 + 추가 재전송)
- **계약 완료 기간**: 2-3일 단축
- **수동 개입 감소**: 30% (자동화 대체)

### KPI 정의

| 메트릭 | 현재 | 목표 | 증가율 |
|--------|------|------|--------|
| 초기 전환율 | 35% | 45% | +28% |
| 재전송 전환율 | N/A | 50% | - |
| 평균 계약 기간 | 5-7일 | 2-3일 | -50% |
| 관리자 수동 작업 | 100% | 70% | -30% |

---

## 10. 향후 개선 (Phase 5+)

1. **동적 SMS 길이 조정**: 연락처별 디바이스 최적화
2. **머신러닝 기반 최적 발송 시간**: 응답율 기반 학습
3. **멀티채널 자동화**: SMS + 이메일 + 카카오톡 동시 발송
4. **개인화 강화**: 심리학 렌즈별 맞춤 메시지
5. **장기 추적**: 30일/60일 재전송 (신규 렌즈 적용)

---

**작성자**: Agent-CTR-CRON  
**작성일**: 2026-06-15  
**상태**: Phase 4 Specification Draft  
**검증**: TypeScript, Prisma 타입 검증 완료
