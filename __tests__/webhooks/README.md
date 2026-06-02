# Webhook 테스트 스위트

마비즈 CRM 환불/결제 Webhook 통합 테스트

---

## 📂 파일 구조

```
__tests__/webhooks/
├── README.md (이 파일)
└── cruisedot-refund.test.ts (12개 테스트 케이스)
```

---

## 🎯 테스트 케이스 (12가지)

### 정상 Flow
- ✅ Test 1: 정상 환불 완료
- ✅ Test 2: 환불 거절 처리

### 안정성
- ✅ Test 3: 중복 처리 (eventId 멱등성)
- ✅ Test 4: 동시성 안전성
- ✅ Test 8: 원자성 (트랜잭션)

### 보안
- ✅ Test 5: 조직 격리 (Cross-tenant)
- ✅ Test 10: 에러 처리 (400/401/422)

### 데이터 무결성
- ✅ Test 6: Contact 폴백
- ✅ Test 7: 다중 Contact 처리
- ✅ Test 11: 수당 취소
- ✅ Test 12: 메모 기록

### Future (Cron Job 필요)
- ⏳ Test 9: 타임아웃 처리 (30일→EXPIRED)

---

## 🚀 실행

### 전체 테스트
```bash
npm test -- cruisedot-refund.test.ts
```

### 특정 테스트
```bash
npm test -- --testNamePattern="should process normal refund"
```

### 커버리지
```bash
npm test -- cruisedot-refund.test.ts --coverage
```

---

## 📊 검증 항목

| 항목 | 상태 |
|------|------|
| Jest 구현 | ✅ |
| Mock 전략 | ✅ |
| 에러 처리 | ✅ |
| 보안 (organizationId) | ✅ |
| 중복 처리 (eventId) | ✅ |
| 트랜잭션 (원자성) | ✅ |
| 동시성 | ✅ |
| Cron Job | ⏳ |

---

## 📖 상세 문서

👉 `docs/WEBHOOK_STEP5_TEST_IMPLEMENTATION.md`

---

**마지막 업데이트**: 2026-06-02
