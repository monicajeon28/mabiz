# 신뢰도 시스템 빠른 시작 가이드

**초등학생도 이해하는 버전**

---

## 🎯 신뢰도란?

판매원이 **얼마나 믿을 수 있는지** 점수를 매기는 시스템입니다.

```
판매 100건 중 30건 환불 → 환불율 30% → 신뢰도 낮음 ⚠️
판매 100건 중 5건 환불 → 환불율 5% → 신뢰도 높음 ✅
```

---

## 📊 4가지 상태

### 1️⃣ GOOD (좋음) ✅
- **환불율**: 30% 미만
- **신뢰도**: 70점 이상
- **사용 가능**: 모든 기능

```
예: 100명 판매 중 20명 환불
→ 환불율 20%
→ 신뢰도 80점
→ 상태: GOOD
```

### 2️⃣ WARNING (경고) ⚠️
- **환불율**: 30% ~ 35%
- **신뢰도**: 65-70점
- **표시**: 대시보드에 경고 메시지
- **사용 가능**: 판매 가능

```
예: 100명 판매 중 32명 환불
→ 환불율 32%
→ 신뢰도 68점
→ 상태: WARNING
→ 메시지: "조금 더 신경 써주세요"
```

### 3️⃣ RESTRICTED (제한) 🚫
- **환불율**: 35% ~ 40%
- **신뢰도**: 60-65점
- **불가능**: 새 상품 등록 불가
- **가능**: 기존 상품 관리만 가능

```
예: 100명 판매 중 37명 환불
→ 환불율 37%
→ 신뢰도 63점
→ 상태: RESTRICTED
→ 조치: "새 상품 등록 차단"
```

### 4️⃣ SUSPENDED (정지) 🔒
- **환불율**: 40% 이상
- **신뢰도**: 60점 미만
- **불가능**: 로그인 차단
- **필요한 일**: 관리자 상담

```
예: 100명 판매 중 42명 환불
→ 환불율 42%
→ 신뢰도 58점
→ 상태: SUSPENDED
→ 조치: "로그인 차단"
```

---

## 🔄 자동 계산

### 언제 계산되나요?

#### 1. 환불이 발생했을 때 (즉시)
```
고객 환불 처리
↓
신뢰도 자동 계산
↓
상태 변경 감지
↓
알림 발송
```

#### 2. 매일 오전 2:00 (자동)
```
시스템: "모든 판매원의 신뢰도를 다시 계산합니다"
↓
환불율 업데이트
↓
상태 변경 확인
↓
로그 기록
```

---

## 🆘 신뢰도가 떨어졌을 때

### 해결방법 1: 환불 이유 제거 (이의 제기)

만약 환불이 **판매원의 잘못이 아니었다면**?

```
판매원: "저도 피해자예요!"
↓
이의 제기 제출
- 이유: "상품이 나빴어요"
- 증거: Google Drive 파일 링크
↓
관리자: 검토
↓
승인 시: 신뢰도 복구
```

### 해결방법 2: 판매 개선

```
환불율 낮추기 → 신뢰도 상승
- 상품 설명 명확히
- 고객 만족도 높이기
- 배송 문제 해결
```

---

## 📋 API 6가지 (개발자용)

### API 1: 내 신뢰도 확인
```javascript
GET /api/trust-score/{userId}

응답:
{
  trustScore: 68,
  status: "WARNING",
  refundRate: 32,
  message: "조금 더 신경 써주세요"
}
```

### API 2: 신뢰도 다시 계산
```javascript
POST /api/trust-score/{userId}/calculate

응답:
{
  trustScore: 70,
  status: "GOOD",
  statusChanged: true,  // 상태가 바뀌었나?
  previousStatus: "WARNING"
}
```

### API 3: 상태 변경 (관리자만)
```javascript
PATCH /api/trust-score/{userId}/status

요청:
{
  status: "SUSPENDED",
  reason: "반복적 부정행위"
}
```

### API 4: 이의 제기
```javascript
POST /api/trust-score/{userId}/appeal

요청:
{
  reason: "PRODUCT_DEFECT",  // 상품이 나빴어요
  evidenceUrls: ["https://drive.google.com/..."]
}

응답:
{
  id: "appeal_123",
  status: "PENDING"  // 검토 대기 중
}
```

### API 5: 이의 검토 (관리자만)
```javascript
PATCH /api/trust-score/appeal/{appealId}/review

요청:
{
  status: "APPROVED",  // 승인
  adminReview: "증거 확인됨",
  appliedAction: "RESTORE"  // 신뢰도 복구
}
```

### API 6: 기록 조회
```javascript
GET /api/trust-score/{userId}/audit-logs

응답:
[
  {
    eventType: "REFUND",
    description: "환불 1건 처리됨",
    createdAt: "2026-06-19T10:30:00Z"
  },
  {
    eventType: "STATUS_CHANGE",
    description: "상태 변경: GOOD → WARNING",
    createdAt: "2026-06-19T10:30:05Z"
  }
]
```

---

## 🛠️ 구현 순서 (6단계)

### Phase 1️⃣: 데이터베이스 설계 (30분)
- Prisma 스키마 3개 테이블 추가
- 마이그레이션 실행

### Phase 2️⃣: API 구현 (3일)
- 6개 API 작성 + 테스트

### Phase 3️⃣: 자동 트리거 (1일)
- 환불 후 자동 계산
- 일일 정시 재계산 Cron

### Phase 4️⃣: UI 연결 (2일)
- 대시보드 카드 표시
- 상세 페이지 구축

### Phase 5️⃣: 테스트 (1일)
- 통합 테스트 실행
- 버그 수정

### Phase 6️⃣: 배포 (1일)
- Vercel 배포
- 모니터링

---

## 💻 실제 코드 예시

### 신뢰도 계산 함수
```typescript
// src/lib/trust-score.ts

export function calculateTrustScore(totalSales, totalRefunds) {
  // 1. 환불율 계산
  const refundRate = (totalRefunds / totalSales) * 100;
  
  // 2. 신뢰도 점수 (100 - 환불율)
  const trustScore = 100 - refundRate;
  
  // 3. 상태 결정
  let status;
  if (refundRate < 30) status = 'GOOD';
  else if (refundRate < 35) status = 'WARNING';
  else if (refundRate < 40) status = 'RESTRICTED';
  else status = 'SUSPENDED';
  
  return { trustScore, refundRate, status };
}
```

### API 조회 예시
```javascript
// JavaScript 클라이언트

async function checkMyTrustScore() {
  const userId = getCurrentUserId();
  
  const response = await fetch(
    `/api/trust-score/${userId}`
  );
  
  const data = await response.json();
  
  console.log(`내 신뢰도: ${data.trustScore}점`);
  console.log(`상태: ${data.status}`);
  console.log(`메시지: ${data.message}`);
  
  // 상태별 조치
  if (data.status === 'WARNING') {
    showWarningBanner('조금 더 신경 써주세요');
  }
}
```

---

## ⚡ 주요 트리거

### 환불 처리 후 자동 흐름
```
Payment API (환불 저장)
↓
TrustScore 재계산
↓
상태 변경? → YES → TrustAuditLog 기록
↓
상태 변경? → YES → 사용자 알림 발송
↓
로그인 가능 확인 (SUSPENDED는 차단)
```

### 이의 제기 승인 후 자동 흐름
```
관리자 검토 (이의 승인)
↓
appliedAction = "RESTORE" 확인
↓
환불 1건 제거 시뮬레이션
↓
TrustScore 재계산
↓
신뢰도 복구 (예: 32% → 31%)
↓
TrustAuditLog 기록
```

---

## 🚨 자주 묻는 질문

### Q1: 신뢰도가 음수가 될 수 있나요?
A: 아니요. 최소 0점, 최대 100점입니다.

### Q2: SUSPENDED되면 영구적인가요?
A: 아니요. 관리자가 상태를 변경하면 로그인 가능합니다.

### Q3: 환불이 판매원의 잘못이 아니면?
A: 이의 제기를 제출하세요. 관리자가 검토 후 승인하면 신뢰도 복구됩니다.

### Q4: 신뢰도는 공개되나요?
A: 본인과 관리자만 볼 수 있습니다.

### Q5: 환불율이 떨어지는데 신뢰도가 안 올라가요?
A: `POST /api/trust-score/{userId}/calculate` 로 수동 계산하세요.

---

## 📁 파일 구조

```
docs/
├── TRUST_SCORE_README.md                ← 법률 가이드
├── TRUST_SCORE_API_SPEC.md              ← 상세 API 스펙
├── TRUST_SCORE_IMPLEMENTATION_GUIDE.md  ← 구현 가이드
└── TRUST_SCORE_QUICK_START.md           ← 이 파일

src/
├── types/
│   └── trust-score.ts                   ← TypeScript 타입
├── lib/
│   └── trust-score.ts                   ← 계산 함수
├── app/api/
│   ├── trust-score/
│   │   ├── [userId]/route.ts            ← API 1: 조회
│   │   ├── [userId]/calculate/route.ts  ← API 2: 계산
│   │   ├── [userId]/status/route.ts     ← API 3: 상태변경
│   │   ├── [userId]/appeal/route.ts     ← API 4: 이의제기
│   │   ├── [userId]/audit-logs/route.ts ← API 6: 로그
│   │   └── appeal/[appealId]/review/route.ts ← API 5: 검토
│   └── cron/
│       └── daily-trust-score-calculation.mjs ← 일일 계산

prisma/
└── schema.prisma                        ← 3개 모델 추가
```

---

## ✅ 완성 후 확인사항

- [ ] Prisma 마이그레이션 완료
- [ ] 6개 API 모두 테스트됨
- [ ] 자동 트리거 정상 작동
- [ ] UI에서 신뢰도 표시됨
- [ ] 통합 테스트 통과
- [ ] `npx tsc --noEmit` 0 에러
- [ ] Vercel 배포 완료
- [ ] 모니터링 설정 완료

---

## 📚 참고 문서

1. **TRUST_SCORE_README.md** - 법률 및 정책
2. **TRUST_SCORE_API_SPEC.md** - 상세 API 명세서
3. **TRUST_SCORE_IMPLEMENTATION_GUIDE.md** - 코드 구현 (복사-붙여넣기)

---

**시작하기**: Phase 1 (Prisma 스키마) 구현 → 30분 소요
