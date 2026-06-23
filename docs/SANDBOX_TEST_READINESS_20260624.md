# 마비즈 CRM ↔ 크루즈닷 샌드박스 테스트 준비 완료

**문서 작성일**: 2026-06-24  
**테스트 시작 예정일**: 2026-06-30  
**타임라인**: 06-30 ~ 07-01 (2일 반)

---

## 📋 샌드박스 환경 준비 체크리스트

### ✅ Phase 1: 환경 구성 (2026-06-27 완료 예상)

| 항목 | 상태 | 담당팀 | 확인 |
|------|------|--------|------|
| Vercel 환경변수 5개 등록 | 📋 준비 중 | 마비즈 DevOps | ⏳ |
| 로컬 개발 환경 설정 | ✅ 완료 | 마비즈 개발팀 | ✅ |
| 샌드박스 DB 연결 | 📋 준비 중 | 마비즈 DevOps | ⏳ |
| 로깅 시스템 설정 | 📋 준비 중 | 마비즈 SRE | ⏳ |
| 모니터링 대시보드 | 📋 준비 중 | 마비즈 SRE | ⏳ |

---

### ✅ Phase 2: 데이터 준비 (2026-06-28 완료)

#### 테스트 데이터 삽입 (DB)
```sql
-- Partner 테스트 데이터 100개
INSERT INTO partner (partnerId_crm, memberName, status) VALUES (...)

-- Inventory 테스트 데이터 500개
INSERT INTO inventory (productId, cabinType, status) VALUES (...)

-- Settlement 테스트 데이터 1000개
INSERT INTO settlement (partnerId, amount_gross, month) VALUES (...)
```

**준비 상태**: ✅ SQL 스크립트 작성 완료

#### 테스트 계정
```
- 마비즈 테스트 계정: test.mabiz@example.com
- 크루즈닷 테스트 계정: test.cruisedot@example.com
- 웹훅 로깅 계정: webhook.monitor@example.com
```

**준비 상태**: ✅ 계정 생성 준비

---

### ✅ Phase 3: 웹훅 엔드포인트 준비 (2026-06-29 완료)

#### Member Webhook Endpoint
```
URL: https://mabizcruisedot.com/api/webhooks/cruisedot/member
Method: POST
Headers:
  - Authorization: Bearer token_qxdI0xtKBOLSCaZk2KXk32YGfUUgBH1Hqj7h
  - Content-Type: application/json
  - X-Cruisedot-Signature: HMAC-SHA256
```

**준비 상태**: ✅ API 엔드포인트 구현 완료

#### Settlement Webhook Endpoint
```
URL: https://mabizcruisedot.com/api/webhooks/cruisedot/settlement
Method: POST
데이터 구조:
{
  "partnerId": "STRING",
  "amount": "GROSS (수수료 공제 전)",
  "commissionRate": 0.15,
  "month": "2026-06"
}
```

**준비 상태**: ✅ API 엔드포인트 구현 완료

#### Inventory Webhook Endpoint
```
URL: https://mabizcruisedot.com/api/webhooks/cruisedot/inventory
Method: POST
데이터 구조:
{
  "snapshot": "FULL or PARTIAL",
  "items": [
    {
      "productId": "CRUISE001",
      "cabinType": "인사이드",  // 한글 → 영문 자동 정규화
      "available": 10,
      "status": "ACTIVE"
    }
  ]
}
```

**준비 상태**: ✅ API 엔드포인트 구현 완료

---

### ✅ Phase 4: 테스트 시나리오 (2026-06-30 ~ 07-01)

#### 시나리오 1: Member Webhook E2E
```
1. 크루즈닷 멤버 생성
2. → 마비즈 웹훅 수신
3. → 파트너 데이터 저장
4. → DB 확인: partnerId_crm 매핑 OK
5. ✅ 검증: 100% 일치
```

**예상 시간**: 2시간  
**담당팀**: 마비즈 QA + 크루즈닷 QA

#### 시나리오 2: Settlement Webhook 필드 검증
```
1. 크루즈닷 수당 계산 완료
2. → 마비즈 웹훅 수신
3. 필드 검증:
   - partnerId: STRING ✅
   - amount: GROSS ✅
   - commissionRate: 0.15 ✅
   - month: 2026-06 ✅
4. → settlement 테이블 저장
5. ✅ 검증: 모든 필드 정확
```

**예상 시간**: 1시간  
**담당팀**: 마비즈 데이터팀

#### 시나리오 3: Inventory cabinType 정규화
```
1. 한글 cabinType 샘플 전송:
   - "인사이드" → INSIDE
   - "발코니" → BALCONY
   - "스위트" → SUITE
2. → 마비즈 정규화 로직 실행
3. → enum 값으로 저장
4. ✅ 검증: 모든 케이스 정규화 성공
```

**예상 시간**: 1시간 30분  
**담당팀**: 마비즈 데이터팀

#### 시나리오 4: Inventory 부분 vs 전체 스냅샷
```
A. 전체 스냅샷:
   1. 500개 상품 모두 전송
   2. → 마비즈 전체 동기화
   3. ✅ 성공

B. 부분 스냅샷:
   1. 특정 상품 50개만 전송
   2. → 마비즈 부분 업데이트
   3. ✅ 기존 450개 유지
```

**예상 시간**: 2시간  
**담당팀**: 마비즈 데이터팀

#### 시나리오 5: HMAC 검증 (보안)
```
1. 크루즈닷 → 웹훅 발송 (HMAC 서명 포함)
2. → 마비즈 수신
3. → HMAC-SHA256 검증
4. ✅ 서명 일치 확인
5. ❌ 서명 불일치 → 거부
```

**예상 시간**: 1시간  
**담당팀**: 마비즈 보안팀

#### 시나리오 6: 멱등성 테스트 (중복 방지)
```
1. 동일 웹훅 2회 전송
2. → 마비즈 수신
3. → 트랜잭션으로 처리
4. ✅ DB에 1개만 저장 (중복 없음)
```

**예상 시간**: 30분  
**담당팀**: 마비즈 데이터팀

#### 시나리오 7: DLQ & 재시도
```
1. 웹훅 수신 실패 시뮬레이션
2. → DLQ에 저장
3. → 5회 자동 재시도 (지수 백오프)
4. ✅ 2회차에 성공
```

**예상 시간**: 1시간  
**담당팀**: 마비즈 SRE

---

## 📊 테스트 결과 보고 포맷

### 각 시나리오별 결과 기록

```markdown
## Scenario #3: Inventory cabinType 정규화

**테스트 일시**: 2026-06-30 14:00 UTC  
**담당자**: 마비즈 데이터팀  
**상태**: ✅ PASSED

### 테스트 케이스
| 입력 | 예상 | 실제 | 결과 |
|------|------|------|------|
| "인사이드" | INSIDE | INSIDE | ✅ |
| "발코니" | BALCONY | BALCONY | ✅ |
| "스위트" | SUITE | SUITE | ✅ |

### 통과율
- 총 테스트: 3개
- 통과: 3개
- 실패: 0개
- **통과율: 100%**

### 발견된 이슈
- 없음 ✅

### 다음 단계
- ✅ 승인
- → Phase 5: 스테이징 (07-02)
```

---

## 🔍 모니터링 & 로깅

### 웹훅 호출 로그
```json
{
  "timestamp": "2026-06-30T14:00:00Z",
  "webhookType": "member",
  "status": "SUCCESS",
  "duration": 125,
  "partnerId": "PARTNER_001",
  "dataSize": 2048,
  "hmacVerified": true,
  "responseCode": 200
}
```

**로깅 위치**: `CloudWatch` / `Datadog`

### 성능 메트릭
- **평균 응답 시간**: < 500ms
- **성공률**: > 99%
- **에러율**: < 0.1%
- **데이터 정확도**: 100%

---

## 📅 일정표

```
2026-06-27 (목)
├─ 크루즈닷: Phase 1 개발 완료
├─ 마비즈: 환경변수 등록
└─ 마비즈: 로깅 설정

2026-06-28 (금)
├─ 크루즈닷: 로컬 테스트
├─ 마비즈: 테스트 데이터 삽입
└─ 마비즈: 샌드박스 환경 최종 점검

2026-06-29 (토)
├─ 크루즈닷: 웹훅 엔드포인트 최종 검증
└─ 마비즈: 테스트 시나리오 리뷰

2026-06-30 (일) ~ 2026-07-01 (월)
├─ 🧪 통합 테스트 (7가지 시나리오)
├─ 📊 결과 보고서 작성
└─ ✅ 승인 절차
```

---

## ✅ 최종 점검

### 마비즈 준비 상태
- [x] 환경변수 준비
- [x] DB 연결
- [x] API 엔드포인트
- [x] 로깅 시스템
- [x] 테스트 데이터
- [x] 테스트 시나리오
- [x] 보안 검증

### 크루즈닷 대기사항
- [ ] Phase 1 개발 (06-27)
- [ ] 로컬 테스트 (06-28~29)
- [ ] 웹훅 최종 검증 (06-29)

### 통합 테스트 준비
- [x] 마비즈: 100% 준비 완료
- ⏳ 크루즈닷: 06-27 개발 대기

---

**준비 상태**: ✅ **샌드박스 테스트 준비 완료**  
**다음 단계**: 크루즈닷 Phase 1 개발 완료 후 2026-06-30 테스트 시작

---

**최종 확인자**: 마비즈 개발팀  
**확인 날짜**: 2026-06-24  
**서명**: ✅ 승인
