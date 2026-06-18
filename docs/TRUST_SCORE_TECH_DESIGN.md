# 신뢰도 시스템 기술 설계 완성본

**작성일**: 2026-06-19  
**상태**: ✅ 설계 완료  
**구현 준비도**: 100% (복사-붙여넣기 가능)

---

## 📦 생성된 파일 목록 (8개)

### 📄 문서 (7개)

| 파일 | 크기 | 용도 | 독자 |
|------|------|------|------|
| **TRUST_SCORE_README.md** | 12.7KB | 목차 + 빠른 시작 | 모두 |
| **TRUST_SCORE_API_SPEC.md** | 15.9KB | 6개 API 상세 스펙 (초등학생 수준) | 개발자 |
| **TRUST_SCORE_QUICK_START.md** | 8.6KB | 10분 이해 가이드 | 관리자 + 개발자 |
| **TRUST_SCORE_IMPLEMENTATION_GUIDE.md** | 29.9KB | 완전한 구현 코드 (복사가능) | 개발자 |
| **기존 법률/정책 문서** | 74.1KB | 법률 검토 완료 | 법무팀 |
| **기타 참고 문서** | 53.5KB | 배포/체크리스트 | 배포팀 |

### 💻 코드 (1개)

| 파일 | 라인수 | 용도 |
|------|--------|------|
| **src/types/trust-score.ts** | 280줄 | TypeScript 타입 정의 + 상수 |

**총 문서량**: ~150KB (읽기 시간: 2-3시간)  
**총 코드량**: ~280줄 (구현 시간: 3-5일)

---

## 🎯 핵심 설계 (초등학생 수준)

### 개념: 신뢰도

```
판매 기록을 보고 "이 판매원을 믿을 수 있는가?" 점수를 매기기
```

### 공식

```
신뢰도 점수 = 100 - 환불율

예시:
- 100명 판매, 10명 환불 → 환불율 10% → 신뢰도 90점 ✅
- 100명 판매, 35명 환불 → 환불율 35% → 신뢰도 65점 ⚠️
- 100명 판매, 42명 환불 → 환불율 42% → 신뢰도 58점 🚫
```

### 4가지 상태

```
GOOD (✅) ← 환불율 < 30% ← 신뢰도 70점 이상
├─ 모든 기능 사용 가능
└─ 메시지: "훌륭해요! 계속 잘해주세요"

WARNING (⚠️) ← 환불율 30-35% ← 신뢰도 65-70점
├─ 판매 가능
└─ 메시지: "조금 더 신경 써주세요"

RESTRICTED (🚫) ← 환불율 35-40% ← 신뢰도 60-65점
├─ 새 상품 등록 불가
├─ 기존 상품 관리 가능
└─ 메시지: "개선이 필요합니다"

SUSPENDED (🔒) ← 환불율 ≥ 40% ← 신뢰도 < 60점
├─ 로그인 차단
├─ 이의 제기만 가능
└─ 메시지: "계정이 정지되었습니다"
```

---

## 🔧 기술 구현 (6 Phase)

### Phase 1️⃣: Prisma 스키마 (30분)

3개 테이블 추가:

```
TrustScore
├─ id (고유 ID)
├─ userId (누가?)
├─ totalSales (총 판매)
├─ totalRefunds (총 환불)
├─ refundRate (환불율 %)
├─ trustScore (신뢰도 0-100)
├─ status (상태: GOOD/WARNING/RESTRICTED/SUSPENDED)
└─ 기타

TrustAppeal
├─ id (고유 ID)
├─ trustScoreId (어느 신뢰도?)
├─ reason (이유)
├─ evidenceUrls (증거)
└─ status (검토 상태)

TrustAuditLog
├─ id (고유 ID)
├─ userId (누가?)
├─ eventType (뭐가 일어났나?)
└─ description (자세한 설명)
```

### Phase 2️⃣: API 구현 (3일)

6개 API:

```
API 1: GET /api/trust-score/{userId}
       → 신뢰도 조회 (누구나)

API 2: POST /api/trust-score/{userId}/calculate
       → 신뢰도 재계산 (본인/관리자)

API 3: PATCH /api/trust-score/{userId}/status
       → 상태 변경 (관리자만)

API 4: POST /api/trust-score/{userId}/appeal
       → 이의 제기 (본인)

API 5: PATCH /api/trust-score/appeal/{appealId}/review
       → 이의 검토 (관리자만)

API 6: GET /api/trust-score/{userId}/audit-logs
       → 기록 조회 (본인/관리자)
```

### Phase 3️⃣: 자동 트리거 (1일)

```
트리거 1: 환불 처리 후 자동 계산
├─ Settlement "REFUNDED" 저장
├─ calculateTrustScore() 호출
├─ 상태 변경 감지
└─ 알림 발송

트리거 2: 매일 오전 2:00 자동 재계산
├─ 모든 사용자 순회
├─ 환불율 재계산
├─ 상태 변경 확인
└─ 로그 기록

트리거 3: 이의 제기 승인 후
├─ APPROVED + RESTORE
├─ 환불 1건 제거 시뮬레이션
└─ 신뢰도 재계산
```

### Phase 4️⃣: UI 연결 (2일)

```
UI 1: 대시보드 카드
├─ 신뢰도 점수 표시 (큼)
├─ 상태 표시 (색상)
├─ 메시지 표시
└─ [자세히 보기] 버튼

UI 2: 상세 페이지
├─ 신뢰도 요약 (4칸)
├─ 최근 활동 (테이블)
└─ [이의 제기] 버튼 (WARNING 이상)

UI 3: 이의 제기 모달
├─ 이유 선택 (드롭다운)
├─ 증거 첨부 (Google Drive)
└─ 제출 버튼
```

### Phase 5️⃣: 테스트 (1일)

```
테스트 1: 단위 테스트
├─ calculateTrustScore() 함수
├─ determineStatus() 함수
└─ getAccessPermissions() 함수

테스트 2: 통합 테스트
├─ API 1-6 모두 호출
├─ DB 저장 확인
└─ 에러 처리 확인

테스트 3: 자동 트리거 테스트
├─ 환불 후 신뢰도 변경 확인
├─ Cron 실행 확인
└─ 상태 변경 로그 확인
```

### Phase 6️⃣: 배포 (1일)

```
배포 전:
- npx tsc --noEmit (타입 확인)
- npm test (테스트 실행)
- npx prisma migrate status (마이그레이션 확인)

배포:
- npx vercel --prod (배포)
- vercel.json Cron 확인 (매일 2:00 실행)

배포 후:
- 모니터링 설정
- 로그 확인
- 관리자 교육
```

---

## 📊 데이터 흐름

### 흐름 1: 환불 처리

```
고객 환불 요청
    ↓
POST /api/settlements/{id}/refund
    ↓ (환불 저장)
Settlement.status = "REFUNDED"
    ↓ (자동 트리거)
calculateTrustScore(partnerId)
    ↓ (신뢰도 계산)
refundRate = (totalRefunds / totalSales) * 100
trustScore = 100 - refundRate
    ↓ (상태 결정)
if refundRate >= 35% then status = RESTRICTED
if refundRate >= 40% then status = SUSPENDED
    ↓ (저장)
TrustScore 업데이트
    ↓ (상태 변경 감지)
if status !== previousStatus then
  - TrustAuditLog 기록
  - 사용자에게 알림 발송
    ↓ (로그인 차단 확인)
if status = SUSPENDED then
  - 다음 로그인 시 차단
```

### 흐름 2: 이의 제기

```
판매원: "저 환불은 저 잘못이 아니었어요"
    ↓
POST /api/trust-score/{userId}/appeal
    ↓ (이의 저장)
TrustAppeal.status = "PENDING"
    ↓ (관리자가 검토)
PATCH /api/trust-score/appeal/{appealId}/review
    ↓ (승인 또는 거부)
if status = APPROVED and appliedAction = RESTORE then
  - 환불 1건 제거 시뮬레이션
  - refundRate = (totalRefunds - 1) / totalSales * 100
  - trustScore 재계산
  - TrustScore 업데이트
  - 판매원에게 승인 알림
else
  - 판매원에게 거부 알림
```

### 흐름 3: 일일 재계산

```
매일 오전 2:00 (Cron)
    ↓
GET /api/cron/daily-trust-score-calculation
    ↓ (모든 사용자 순회)
for each user in users {
    ↓ (환불율 재계산)
    refundRate = (totalRefunds / totalSales) * 100
    ↓ (상태 변경 확인)
    if newStatus !== oldStatus then
      - TrustScore 업데이트
      - TrustAuditLog 기록
      - 상태 변경 감지
}
    ↓ (완료)
로그 기록: "530명 업데이트, 12명 상태 변경"
```

---

## 💾 데이터베이스 스키마

### TrustScore (신뢰도)

```sql
CREATE TABLE TrustScore (
  id              VARCHAR(255) PRIMARY KEY,
  userId          VARCHAR(255) UNIQUE NOT NULL,
  totalSales      INT DEFAULT 0,
  totalRefunds    INT DEFAULT 0,
  refundRate      FLOAT DEFAULT 0,
  trustScore      INT DEFAULT 100,
  status          VARCHAR(50) DEFAULT 'GOOD',
  nextThreshold   INT DEFAULT 35,
  warningCount    INT DEFAULT 0,
  lastCalculatedAt TIMESTAMP,
  statusChangedAt TIMESTAMP NULL,
  
  FOREIGN KEY (userId) REFERENCES User(id),
  INDEX idx_userId (userId),
  INDEX idx_status (status)
);
```

### TrustAppeal (이의)

```sql
CREATE TABLE TrustAppeal (
  id              VARCHAR(255) PRIMARY KEY,
  trustScoreId    VARCHAR(255) NOT NULL,
  reason          VARCHAR(255) NOT NULL,
  evidenceUrls    JSON,
  status          VARCHAR(50) DEFAULT 'PENDING',
  adminReview     TEXT NULL,
  requestedAction VARCHAR(50) NULL,
  appliedAction   VARCHAR(50) NULL,
  createdAt       TIMESTAMP,
  reviewedAt      TIMESTAMP NULL,
  reviewedBy      VARCHAR(255) NULL,
  
  FOREIGN KEY (trustScoreId) REFERENCES TrustScore(id),
  INDEX idx_status (status),
  INDEX idx_trustScoreId (trustScoreId)
);
```

### TrustAuditLog (기록)

```sql
CREATE TABLE TrustAuditLog (
  id              VARCHAR(255) PRIMARY KEY,
  userId          VARCHAR(255) NOT NULL,
  eventType       VARCHAR(50) NOT NULL,
  previousValue   JSON NULL,
  newValue        JSON NULL,
  description     TEXT NOT NULL,
  triggeredBy     VARCHAR(255) NULL,
  createdAt       TIMESTAMP,
  
  INDEX idx_userId (userId),
  INDEX idx_eventType (eventType)
);
```

---

## 🔐 권한 설계

### API 권한 매트릭스

| API | 누구 | GET | POST | PATCH |
|-----|------|-----|------|-------|
| API 1: 조회 | 본인 ✅, 관리자 ✅ | ✅ | - | - |
| API 2: 계산 | 본인 ✅, 관리자 ✅ | - | ✅ | - |
| API 3: 상태변경 | 관리자 ✅ (관리자만) | - | - | ✅ |
| API 4: 이의제기 | 본인 ✅ | - | ✅ | - |
| API 5: 이의검토 | 관리자 ✅ (관리자만) | - | - | ✅ |
| API 6: 로그 | 본인 ✅, 관리자 ✅ | ✅ | - | - |

### 상태별 액세스 권한

| 상태 | 로그인 | 판매 | 새상품 | 설정 |
|------|--------|------|--------|------|
| GOOD | ✅ | ✅ | ✅ | ✅ |
| WARNING | ✅ | ✅ | ✅ | ✅ |
| RESTRICTED | ✅ | ✅ | 🚫 | ✅ |
| SUSPENDED | 🚫 | 🚫 | 🚫 | 이의만 |

---

## 🚀 배포 체크리스트

### Pre-Deployment (배포 전)

- [ ] Prisma 마이그레이션 작성
  ```bash
  npx prisma migrate dev --name add_trust_score
  ```

- [ ] TypeScript 타입 확인
  ```bash
  npx tsc --noEmit
  ```

- [ ] 6개 API 모두 구현
  ```bash
  src/app/api/trust-score/
  ├─ [userId]/route.ts (API 1)
  ├─ [userId]/calculate/route.ts (API 2)
  ├─ [userId]/status/route.ts (API 3)
  ├─ [userId]/appeal/route.ts (API 4)
  ├─ [userId]/audit-logs/route.ts (API 6)
  └─ appeal/[appealId]/review/route.ts (API 5)
  ```

- [ ] 자동 트리거 구현
  - 환불 API에 `calculateTrustScore()` 추가
  - Cron API 구현: `src/app/api/cron/daily-trust-score-calculation.mjs`

- [ ] 통합 테스트 실행
  ```bash
  npm test -- trust-score
  ```

- [ ] UI 연결
  - 대시보드에 TrustScoreCard 추가
  - 상세 페이지 구현

### Deployment (배포)

- [ ] Vercel 배포
  ```bash
  npx vercel --prod
  ```

- [ ] Cron 설정 확인
  ```json
  {
    "crons": [{
      "path": "/api/cron/daily-trust-score-calculation",
      "schedule": "0 2 * * *"
    }]
  }
  ```

- [ ] 환경변수 설정
  ```
  DATABASE_URL=...
  CRON_SECRET=...
  ```

### Post-Deployment (배포 후)

- [ ] 모니터링 설정
  - API 응답시간 모니터링
  - 에러 로그 모니터링
  - Cron 실행 확인

- [ ] 관리자 교육
  - API 사용법
  - 이의 제기 검토 절차
  - 상태 변경 방법

- [ ] 사용자 공지
  - 신뢰도 시스템 설명
  - 환불 정책
  - 이의 제기 방법

---

## 📈 성능 최적화

### 쿼리 최적화

```typescript
// ❌ 느린 쿼리
const trust = await prisma.trustScore.findUnique({
  where: { userId },
  include: { appeals: true, auditLogs: true } // 불필요한 조인
});

// ✅ 빠른 쿼리
const trust = await prisma.trustScore.findUnique({
  where: { userId }
});
```

### 캐싱 전략

```typescript
// 신뢰도는 자주 변하지 않으므로 캐싱 가능
const cached = await redis.get(`trust_score:${userId}`);
if (cached) return JSON.parse(cached);

const trust = await prisma.trustScore.findUnique({...});
await redis.setex(`trust_score:${userId}`, 3600, JSON.stringify(trust));
```

### 인덱싱

```sql
-- 필수 인덱스
CREATE INDEX idx_trust_score_userId ON TrustScore(userId);
CREATE INDEX idx_trust_score_status ON TrustScore(status);
CREATE INDEX idx_trust_appeal_status ON TrustAppeal(status);
CREATE INDEX idx_audit_log_userId ON TrustAuditLog(userId);
```

---

## 🐛 에러 처리

### 공통 에러 코드

```
400 Bad Request
├─ INVALID_STATUS: 유효하지 않은 상태
└─ INSUFFICIENT_EVIDENCE: 증거 부족

403 Forbidden
├─ UNAUTHORIZED: 권한 없음
└─ ACCOUNT_SUSPENDED: 계정 정지 (로그인 차단)

404 Not Found
├─ USER_NOT_FOUND: 사용자 없음
├─ TRUST_SCORE_NOT_FOUND: 신뢰도 없음
└─ APPEAL_NOT_FOUND: 이의 없음

500 Internal Server Error
└─ SERVER_ERROR: 서버 오류
```

### 재시도 로직

```typescript
// 자동 재시도 (최대 3회)
async function retryAPI(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await sleep(1000 * (i + 1)); // 지수 백오프
    }
  }
}
```

---

## 📞 지원

### 구현 도중 문제?

1. **신뢰도가 계산되지 않음**
   - Settlement 테이블 확인: `status = 'REFUNDED'` 있는지
   - API 2 수동 호출: `POST /api/trust-score/{userId}/calculate`
   - 로그 확인: TrustAuditLog

2. **상태가 변경 안 됨**
   - 환불율 확인: 임계값 넘었는지
   - 수동 상태 변경: `PATCH /api/trust-score/{userId}/status`
   - Cron 실행: 매일 2:00 UTC

3. **이의 제기 안 보임**
   - TrustAppeal 테이블 확인
   - status = 'PENDING' 확인
   - 관리자 권한 확인

---

## ✅ 최종 체크리스트

```
✅ 설계 완료 (이 문서)
✅ API 스펙 완성 (TRUST_SCORE_API_SPEC.md)
✅ 구현 가이드 작성 (TRUST_SCORE_IMPLEMENTATION_GUIDE.md)
✅ TypeScript 타입 정의 (src/types/trust-score.ts)

⏳ 다음: Phase 1 (Prisma 스키마) 구현 시작
   예상 소요 시간: 30분 ~ 5일 (전체)
```

---

**문서 생성 일시**: 2026-06-19  
**최종 수정**: 2026-06-19  
**상태**: ✅ 완성 (구현 준비 완료)
