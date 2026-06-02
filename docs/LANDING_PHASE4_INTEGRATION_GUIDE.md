# Landing Phase 4 통합 가이드

## 🚀 빠른 시작 (Copy-Paste)

### 1단계: SignupForm에 통합

**파일:** `src/app/(dashboard)/landing/cruisedot/components/SignupForm.tsx`

```tsx
import { processLandingFormSubmission } from '@/lib/landing-contact-integration';
import { useState } from 'react';

export default function SignupForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const formData = new FormData(e.currentTarget);
      
      const result = await processLandingFormSubmission({
        name: formData.get('name') as string,
        phone: formData.get('phone') as string,
        email: formData.get('email') as string,
        budgetRange: formData.get('budgetRange') as string,
        hasPassport: formData.get('hasPassport') === 'on',
        travelersCount: parseInt(formData.get('travelersCount') as string) || 1,
        organizationId: 'org_123', // 실제 조직 ID로 변경
        interests: [formData.get('interest') as string]
      });

      if (result.error) {
        console.error(result.error);
        setSuccessMessage('죄송합니다. 다시 시도해주세요.');
      } else {
        setSuccessMessage(result.successMessage);
        console.log('Contact Created:', result.contactId);
        console.log('Lens Detected:', result.lens);
        console.log('Lead Score:', result.leadScore);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* 기존 폼 필드 */}
      <input name="name" placeholder="이름" required />
      <input name="phone" placeholder="전화번호" required />
      <input name="email" placeholder="이메일" />
      <select name="budgetRange">
        <option value="">예산 선택</option>
        <option value="33-50">33~50만원</option>
        <option value="50-70">50~70만원</option>
        <option value="70-100">70~100만원</option>
        <option value="100+">100만원 이상</option>
      </select>

      {successMessage && (
        <div className="text-blue-600 font-semibold">
          {successMessage}
        </div>
      )}

      <button type="submit" disabled={isLoading}>
        {isLoading ? '처리 중...' : '신청하기'}
      </button>
    </form>
  );
}
```

---

### 2단계: TermPopover 적용

**파일:** `src/app/(dashboard)/landing/cruisedot/page.tsx`

```tsx
import TermPopover from './components/TermPopover';

export default function CruisedotPage() {
  return (
    <div>
      {/* Problem Section */}
      <section>
        <p>
          "부모님까지 모시고 갔는데 최악이었어요. 시간 버리고 돈 버린... 
          <TermPopover term="인솔자" /> 없이 가는 게 이렇게 위험한 줄..."
        </p>
      </section>

      {/* Solution Section */}
      <section>
        <h2>
          <TermPopover term="베테랑" /> 
          <TermPopover term="인솔자" />와 함께하는 
          <TermPopover term="세미패키지" /> 여행
        </h2>
      </section>

      {/* Gold Member */}
      <section>
        <p>
          당신의 크루즈 여행을 완성하는 
          <TermPopover term="선사직결" /> 시스템
        </p>
      </section>
    </div>
  );
}
```

---

### 3단계: UX 최적화 토큰 적용

**파일:** `src/app/(dashboard)/landing/cruisedot/page.tsx` 또는 `components/*.tsx`

```tsx
import {
  FONT_SIZES,
  COLOR_PALETTE,
  BUTTON_STYLES,
  SECTION_PADDING,
  buttonClass,
  textSizeClass,
  a11yClass
} from '@/lib/landing-ux-optimization';

export default function CruisedotPage() {
  return (
    <>
      {/* Hero 제목 (32-48px) */}
      <h1 className={`${textSizeClass('hero_heading')} ${a11yClass()}`}>
        크루즈 여행의 모든 것
      </h1>

      {/* 본문 텍스트 (16-18px) */}
      <p className={textSizeClass('body')}>
        전문가와 함께하는 안전한 여행
      </p>

      {/* Primary CTA 버튼 */}
      <button className={buttonClass('primary', 'mobile')}>
        지금 신청하기
      </button>

      {/* 섹션 간격 */}
      <section className={SECTION_PADDING.spacious}>
        {/* 내용 */}
      </section>
    </>
  );
}
```

---

## 📊 SMS Day 0-3 자동 발송 확인

### Contact 생성 후 확인

```bash
# 1. DB에서 Contact 확인
SELECT id, name, phone, adminMemo, tags 
FROM Contact 
WHERE phone = '010-1234-5678' 
ORDER BY createdAt DESC 
LIMIT 1;

# adminMemo에 SMS 일정이 JSON으로 저장됨
# 예: {"contactId":"...", "lens":"L1", "sequences":[...]}

# 2. CRM 워크플로우에서 자동 발송 처리
# (실제 발송은 CRM 엔진이 담당)
```

### SMS 발송 로그

```
[SMS Scheduled] Contact: contact_abc123, Lens: L1, Days: 0-3
[Manager Assignment Pending] Contact: contact_abc123, Lens: L1, ManagerType: value_expert
```

---

## 🎯 렌즈별 동작 검증

```typescript
// 각 렌즈별로 정확한 메시지가 선택되는지 검증
import { selectSmsSequence } from '@/lib/landing-sms-templates';

console.log(selectSmsSequence('L0').day0);  // 기본 신뢰 구축
console.log(selectSmsSequence('L1').day0);  // 가격 민감
console.log(selectSmsSequence('L6').day0);  // 긴박감
console.log(selectSmsSequence('L10').day0); // 축하 + 클로징
```

---

## 🔍 Lead Score 검증

```typescript
import { generateRiskFlagsAndScore } from '@/lib/landing-contact-integration';

const { riskFlags, leadScore } = await generateRiskFlagsAndScore(
  'contact_123',
  'org_123',
  {
    name: '김철수',
    phone: '010-1234-5678',
    email: 'kim@example.com',
    hasPassport: false,      // -10점
    budgetRange: '33-50',    // -5점
    travelersCount: 2,       // +15점
    organizationId: 'org_123'
  }
);

console.log(riskFlags);  // ['no_passport', 'price_sensitive']
console.log(leadScore);  // 50 - 10 - 5 + 15 = 50점
```

---

## 🎨 다크모드 검증

모든 색상은 자동으로 다크모드 지원:

```tsx
{/* 라이트 모드: bg-white, text-gray-900 */}
{/* 다크 모드: bg-gray-800, text-white */}
<div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
  이 텍스트는 자동으로 다크모드 지원
</div>
```

---

## ⌨️ 키보드 네비게이션 검증

```bash
# 다음 과정으로 테스트:
1. Tab 키 → 모든 버튼/입력에 포커스 이동
2. Enter 또는 Space → TermPopover 열기
3. ESC → TermPopover 닫기 (포커스 자동 복귀)
4. Tab 이동 → 모든 상호작용 요소 순회 가능
```

---

## 📱 모바일 반응형 검증

```bash
# 브라우저 개발자 도구에서 테스트:
375px  (iPhone SE)    → text-3xl, h-11 버튼, 터치 44×44px
768px  (iPad)         → text-4xl, md: 적용
1024px (데스크톱)     → text-5xl, lg: 적용, 최대 너비

# 확인 사항:
✅ 폰트 크기 자동 증가
✅ 버튼 높이 최소 44px
✅ 간격 자동 조정
```

---

## 🚀 성과 추적 (KPI)

### Day 0-3 SMS 응답율

```
현재 (Day 0 즉시 발송):
- 응답율: 15% (업계 평균 8-12%)
- 변환율: 30% (응답자 중)
- Total: 15% × 30% = 4.5%

목표 (Day 0-3 PASONA 적용):
- 응답율: 45% (+3배)
- 변환율: 35% (+5%)
- Total: 45% × 35% = 15.75% (+3.5배)
```

### Lead Score 분포

```
0-25점   (높은 위험) → 자동 리마인더 (Day 7)
25-50점  (중간)     → 정상 처리
50-75점  (양호)     → VIP 추적
75-100점 (우수)     → 상급 매니저 할당
```

---

## 🔧 트러블슈팅

### SMS가 발송되지 않음

**원인:** CRM 워크플로우 엔진이 Contact adminMemo의 SMS 일정을 읽지 않음

**해결:**
1. Contact adminMemo 확인: `SELECT adminMemo FROM Contact WHERE id = '...'`
2. JSON 형식 검증: `JSON.parse(adminMemo)` 성공 확인
3. CRM 워크플로우 로그 확인

### 렌즈 감지가 L0만 반환됨

**원인:** `detectLens()` 함수의 heuristics가 Contact 필드와 맞지 않음

**해결:**
1. Contact 필드 확인: `budgetRange`, `tags`, `purchasedAt` 등
2. `landing-contact-integration.ts`의 `detectLens()` 함수 업데이트
3. 각 렌즈의 감지 조건 재정의

### TermPopover가 보이지 않음

**원인:** z-index 충돌

**해결:**
```tsx
// TermPopover의 z-index를 높임
<div className="... z-50">  // z-20에서 z-50로 변경
```

---

## 📚 다음 단계

### Phase 5: 성과 대시보드
```
/admin/landing-analytics
- 실시간 응답율, 전환율
- 렌즈별 성과 분해
- A/B 테스트 결과
```

### Phase 6: Webhook 통합
```
결제 완료 → Day 0 SMS 즉시 발송
문의 → 렌즈 감지 → 자동 대응 스크립트
```

---

## 📝 체크리스트

```
□ SignupForm에 processLandingFormSubmission 연결
□ TermPopover 페이지에 적용
□ 버튼/입력에 UX 토큰 적용
□ Contact 생성 확인 (DB)
□ adminMemo에 SMS 일정 저장 확인
□ Lead Score 계산 확인 (40-100점)
□ 렌즈 감지 검증 (L0-L10)
□ 키보드 네비게이션 테스트
□ 다크모드 테스트
□ 모바일 반응형 테스트 (375px-1440px)
□ SMS 응답율 모니터링 시작
```

---

**최종 상태:** 🎉 Phase 4-B 통합 준비 완료!
