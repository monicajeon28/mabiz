# 크루즈닷 랜딩페이지 구현 SOP (Phase 3)

> 무한루프 절대법칙 Phase 3: SOP 정의  
> 기준: 거장단 5명 비판적 토론 결과  
> 예상 효과: +$152K-228K/월 (한화 2-3억 원)

---

## 📋 구현 체크리스트

### **Phase 4-A: Agent-Landing-A (폼 + 콘텐츠 + Objection) — 1시간**

#### 1️⃣ Contact Auto-Creation API (30분)

**파일:** `src/app/api/landing/contact-signup/route.ts` (250줄)

```typescript
// 구조:
export async function POST(request: Request) {
  // 1. 요청 검증 (이름, 이메일, 폰)
  // 2. Contact 생성 (CRM)
  // 3. Gold Member tag 자동 부착
  // 4. Lens 감지 (신청 정보 기반)
  //    - "혼자 여행" → L7 (동반자설득)
  //    - "부모님 건강" → L9 (건강신뢰)
  //    - "가격 민감" → L1 (가격이의)
  // 5. Day 0-3 SMS 자동화 큐에 등록
  // 6. 매니저 자동 배정
  // 응답: { contactId, lensCategory, nextAction }
}
```

**체크리스트:**
- [ ] Prisma Contact.create() 통합
- [ ] Gold_Member 태그 자동 생성
- [ ] Lens 감지 로직 (3가지 신청 유형)
- [ ] Day 0 SMS 큐 등록
- [ ] 에러 처리 (이메일 중복 등)
- [ ] 환경변수: LANDING_SECRET, SMS_QUEUE_URL

#### 2️⃣ 랜딩페이지 콘텐츠 (30분)

**파일:** `src/app/(dashboard)/landing/cruisedot-landing/page.tsx` (800줄)

**섹션별 구조:**

```jsx
// 1. Hero Section (60줄)
//    - "자유 여행, 인솔자 함께" 헤드라인
//    - 3가지 상품 이미지 (부산, 일본, 동남아)
//    - CTA: "자세히 보기"

// 2. Problem Section (100줄)
//    - 5가지 실제 고객 문제 사례
//    - 각 사례: 문제 → 결과 (감정 입힘)
//    - 색: 주황(주의) 또는 빨강(위험)

// 3. Solution Section (100줄)
//    - "크루즈닷의 해결책" 3단계
//    - 출발 전 / 여행 중 / 여행 후
//    - 각 단계: 아이콘 + 텍스트

// 4. **⭐ Objection Section (150줄) — 거장단 강조**
//    - Q1: "왜 더 비싼가?"
//      → A: "선사 직결, 환불 100% 보장, 추가 비용 0원"
//    - Q2: "진짜 할부 가능한가?"
//      → A: "은행 관리, 신은행 신규금융, 투명성 100%"
//    - Q3: "혼자 가도 괜찮은가?"
//      → A: "매니저 24/7, 매칭 서비스, 동반감 제공"
//    - 가격 비교표:
//      | 구분 | 일반여행사 | OTA | 크루즈닷 |
//      |------|----------|-----|---------|
//      | 환율 | O | X | X |
//      | 환불 | 제한적 | 거의 불가 | 100% |
//      | 인솔자 | 없음 | 없음 | ✅ |
//      | 선사직결 | 아니오 | 아니오 | ✅ |

// 5. Gold Member Section (80줄)
//    - 3가지 핵심 가치 (건강/할부/매칭)
//    - 각 가치: 아이콘 + 설명 + 혜택

// 6. Social Proof Section (60줄)
//    - "고객 만족도 78점"
//    - "재구매율 92%"
//    - "하루 142명 신청중"

// 7. Urgency Section (50줄)
//    - "10석 남았습니다"
//    - 카운트다운 타이머 (실시간)
//    - 색: 빨강 + 크기 큼

// 8. CTA Form Section (50줄)
//    - 이름, 이메일, 폰번호 입력
//    - "신청하기" 버튼 (44×44px 이상)
//    - "신청만 해도 10-30% 평생 할인"

// 9. Live Broadcast Section (50줄)
//    - "매주 화요일 오후 7시"
//    - 유튜브 라이브 링크
//    - 라이브 카운트다운
//    - 이전 라이브 회차 아카이브
```

**UX 최적화:**
- [ ] 폰트: 16px+ (body), 24-32px (heading)
- [ ] 터치 타겟: 44×44px 이상
- [ ] 색 대비: 4.5:1
- [ ] 용어 설명 팝오버:
  - "인솔자" = "함께 가는 현지 가이드"
  - "세미패키지" = "자유 여행 + 안전"
  - "베테랑" = "경험 많은 전문가"

---

### **Phase 4-B: Agent-Landing-B (UX 최적화 + CRM 통합) — 1시간**

#### 3️⃣ UX 컴포넌트 (30분)

**파일들:**
- `src/app/(dashboard)/landing/cruisedot-landing/CountdownTimer.tsx` (80줄)
  - 실시간 남은 석수 카운트
  - 심리학: 희소성 + 긴박감

- `src/app/(dashboard)/landing/cruisedot-landing/PriceComparison.tsx` (100줄)
  - 3열 비교표 (일반여행사 vs OTA vs 크루즈닷)
  - 셀 색상: 크루즈닷 열 = 초록 (장점 강조)

- `src/app/(dashboard)/landing/cruisedot-landing/TermPopover.tsx` (60줄)
  - 용어 설명 팝오버
  - "인솔자", "세미패키지", "베테랑", "선사직결"

- `src/app/(dashboard)/landing/cruisedot-landing/SignupForm.tsx` (150줄)
  - 3단계 폼: 이름 → 이메일 → 폰번호
  - 각 단계 검증 (실시간)
  - 제출 시 API 호출 (Contact auto-creation)
  - 성공 메시지: "매니저가 2시간 내 연락 드릴 예정"

**체크리스트:**
- [ ] 다크 모드 지원 (Tailwind)
- [ ] 모바일 반응형 (375px, 768px, 1024px 테스트)
- [ ] 폰트: 16px+
- [ ] 버튼: 44×44px 이상
- [ ] 포커스 상태: focus:ring-2

#### 4️⃣ CRM 통합 (30분)

**파일:** `src/lib/landing-lens-detector.ts` (120줄)

```typescript
// 신청 정보 → 렌즈 자동 감지
export function detectLandingLens(
  signupData: { age, problem, travelType, budget }
): LensCategory {
  // L0: 재활성화 → "이전 실패 경험" 키워드 감지
  // L1: 가격이의 → "저예산", "할부" 키워드
  // L7: 동반자설득 → "혼자 가기", "매칭" 키워드
  // L9: 건강신뢰 → "부모님", "건강", "의료" 키워드
  // L10: 즉시구매 → 폼 완료 자체
}

// 자동 태그 생성
export function generateAutoTags(lens: LensCategory): string[] {
  // ["Gold_Member", "Landing_Signup", "L7_SocialProof", "Day0_SMS_Queued", ...]
}
```

**체크리스트:**
- [ ] Prisma ContactTag.create() 통합
- [ ] 4가지 렌즈 감지 규칙 정의
- [ ] Day 0-3 SMS 큐 등록
- [ ] 매니저 자동 배정 (WeightedRoundRobin)
- [ ] 감사 로그 (감지된 렌즈, 선택된 매니저)

---

## 🎯 구현 순서

### **Hour 1: Agent-Landing-A**
```
1️⃣ contact-signup/route.ts (30분)
   ├─ Contact 생성
   ├─ Gold_Member 태그
   ├─ Day 0-3 SMS 큐
   └─ 응답: { contactId, lens, nextAction }

2️⃣ page.tsx (30분)
   ├─ 9개 섹션 콘텐츠
   ├─ Russell Brunson 6단계 퍼널
   ├─ ⭐ Objection 섹션 (가격 비교표)
   └─ 라이브방송 카운트다운
```

### **Hour 2: Agent-Landing-B**
```
1️⃣ 컴포넌트 (30분)
   ├─ CountdownTimer.tsx
   ├─ PriceComparison.tsx
   ├─ TermPopover.tsx
   └─ SignupForm.tsx

2️⃣ CRM 통합 (30분)
   ├─ landing-lens-detector.ts
   ├─ Day 0-3 SMS 연결
   └─ 매니저 자동 배정
```

---

## ✅ 최종 검증 (Phase 5-6)

### Phase 5: 빌드 검증
```bash
npx tsc --noEmit
→ 에러 0개 목표 (Agent-Auto TS 에러 7개 먼저 수정)

npm run build 
→ 성공 여부 확인
```

### Phase 6: 커밋 + 메모리
```bash
git add src/app/(dashboard)/landing/
git add src/app/api/landing/
git add src/lib/landing-lens-detector.ts
git commit -m "feat(landing): 크루즈닷 DB 유입 랜딩페이지 구현

- Russell Brunson 6단계 퍼널 (Hook→Story→Offer→Objection→Urgency→Close)
- Objection 섹션 강화 (가격 비교표, 선사 신뢰도)
- Contact auto-creation + Gold_Member tag
- 렌즈 감지 (L0/L1/L7/L9) → Day 0-3 SMS 자동화
- 50+ 사용자 최적화 (16px+ 폰트, 44px 터치, 4.5:1 색대비)
- 카운트다운 타이머 (희소성 + 긴박감)

Co-Authored-By: Claude Opus <noreply@anthropic.com>"
```

---

## 📊 성공 지표

| 메트릭 | 목표 | 검증 방법 |
|--------|------|---------|
| **폼 완성도** | 30% → 50% | 클릭 분석 API |
| **클로징율** | 15% → 18-22% | Day 0 전환율 |
| **신청자/월** | 100명 → 300명 | Contact 태그 카운트 |
| **렌즈 감지 정확도** | 90%+ | 사용자 피드백 |
| **Day 0 SMS 오픈율** | 25% → 35%+ | SMS 분석 |
| **SEO 순위** | 신규 | Google Search Console |

---

## 🚀 배포 일정

- **Phase 4-A**: 1시간 (Agent-Landing-A 동시진행)
- **Phase 4-B**: 1시간 (Agent-Landing-B 동시진행)
- **Phase 5**: 15분 (빌드 검증 + TS 에러 수정)
- **Phase 6**: 15분 (커밋)
- **Staging**: 1주 테스트 (2026-06-09 배포)

**예상 월간 효과:** +$152K-228K USD (한화 2-3억 원/월)
