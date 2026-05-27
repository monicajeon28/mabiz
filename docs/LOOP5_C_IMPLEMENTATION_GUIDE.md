# Loop 5-C 구현 가이드

**목표**: CTA/폼 최적화 및 A/B 테스트 배포  
**기간**: 5-7일 (설계 포함)  
**상태**: 구현 준비 완료

---

## 📋 완성된 산출물 목록

### 1. 설계 문서
- ✅ `/docs/LOOP5_C_FORM_OPTIMIZATION_PLAN.md` — 전체 설계 계획서 (110+ 페이지)
  - 폼 최적화 전략 (Step 1-3)
  - CTA 변형 3개 (A/B/C) 상세 설명
  - A/B 테스트 계획서
  - 성공 기준 및 KPI

### 2. React 컴포넌트
- ✅ `/src/components/loop5/ContactForm.tsx` — 단계형 폼 컴포넌트 (500+ 줄)
  - Step 1: 나이 선택
  - Step 2: 선호도 선택
  - Step 3: 연락처 입력
  - Segment별 개인화 필드
  - CTA 변형 내장
  - gtag 이벤트 로깅

### 3. 스타일
- ✅ `/src/components/loop5/ContactForm.css` — 반응형 스타일 (450+ 줄)
  - 모바일 우선 설계
  - 다크모드 지원
  - 44px 터치 타깃
  - 애니메이션 & 인터렉션

### 4. API 엔드포인트
- ✅ `/src/app/api/webhook/contact-form-submission/route.ts` — 폼 제출 로깅
- ✅ `/src/app/api/admin/loop5/ab-test-results/route.ts` — A/B 테스트 결과 조회

### 5. 대시보드
- ✅ `/src/app/(dashboard)/admin/loop5/ab-test-results/page.tsx` — 실시간 결과 대시보드

### 6. DB 스키마
- ✅ `/prisma/migrations/20260528_add_form_submission.sql` — FormSubmission 테이블
- ✅ `/prisma/schema.prisma` — Prisma 모델 추가

---

## 🚀 배포 순서

### Phase 1: 데이터베이스 마이그레이션 (1시간)

```bash
# 마이그레이션 적용
npx prisma migrate deploy

# 또는 직접 SQL 실행 (필요시)
psql $DATABASE_URL < prisma/migrations/20260528_add_form_submission.sql
```

**확인사항**:
```sql
-- FormSubmission 테이블 생성 확인
SELECT * FROM "FormSubmission" LIMIT 1;
```

### Phase 2: 환경변수 설정 (30분)

`.env.local` 또는 Vercel 대시보드에 다음 추가:

```env
# Loop 5-C: Contact Form Configuration
NEXT_PUBLIC_INQUIRY_WEBHOOK_SECRET=your_bearer_token_here
NEXT_PUBLIC_DEFAULT_ORG_ID=org_xxx  # 기본 조직 ID
```

**주의**: 
- `MABIZ_INQUIRY_WEBHOOK_SECRET`는 이미 CRM에 설정되어 있어야 함
- cruisedot 폼에서 웹훅을 호출할 때 이 시크릿을 사용

### Phase 3: React 컴포넌트 통합 (2시간)

cruisedot의 inquiry form 페이지에서 ContactForm을 사용합니다.

**cruisedot 측 통합 예시**:

```typescript
// cruisedot/src/app/(public)/products/[code]/page.tsx

import { ContactForm } from '@mabiz-crm/components/loop5/ContactForm';

export default function ProductPage({ params }) {
  return (
    <main>
      {/* 상품 정보 */}
      <ProductDetail code={params.code} />

      {/* Loop 5-C 폼 */}
      <section className="inquiry-section">
        <h2>크루즈 상담 신청</h2>
        <ContactForm
          variant={undefined} // 자동으로 A/B/C 중 선택
          onComplete={(data) => {
            console.log('Form submitted:', data);
            // 감사 메시지 표시
          }}
          onError={(error) => {
            console.error('Form error:', error);
            // 에러 처리
          }}
        />
      </section>
    </main>
  );
}
```

**또는 별도 렌더링 (권장)**:

```typescript
// cruisedot/src/components/products/InquiryForm.tsx

'use client';

import dynamic from 'next/dynamic';

const ContactForm = dynamic(
  () => import('@mabiz-crm/components/loop5/ContactForm').then(mod => mod.ContactForm),
  { loading: () => <div>로딩중...</div> }
);

export default function InquiryForm() {
  return <ContactForm />;
}
```

### Phase 4: Google Analytics 설정 (1시간)

```html
<!-- HTML head에 gtag 추가 -->
<script async src="https://www.googletagmanager.com/gtag/js?id=GA_ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'GA_ID', {
    'send_page_view': false,
    'anonymize_ip': true,
  });
</script>
```

**Google Analytics 커스텀 이벤트 설정** (Analytics 콘솔):

| 이벤트 | 매개변수 |
|--------|--------|
| `form_step_1_view` | variant, ageRange |
| `form_step_1_complete` | variant, ageRange |
| `form_step_2_complete` | variant, preferenceType |
| `form_step_3_error` | variant, errorCount |
| `form_complete` | variant, completionTimeMs, segment |

### Phase 5: 테스트 배포 (50% 트래픽) (1일)

**배포 전 체크리스트**:

- [ ] 로컬 테스트 완료 (모든 Step 통과)
- [ ] 모바일 테스트 완료 (iOS/Android)
- [ ] 브라우저 테스트 (Chrome/Safari/Firefox)
- [ ] FormSubmission DB 레코드 확인
- [ ] A/B 테스트 결과 대시보드 동작 확인
- [ ] 에러 로깅 설정 확인

**배포 명령**:

```bash
# 1. 로컬 빌드
npm run build

# 2. Vercel 배포 (또는 git push)
git add .
git commit -m "feat(loop5): CTA/폼 최적화 및 A/B 테스트 설계"
git push origin main

# 3. Vercel에서 배포 대기 및 확인
```

**배포 후 모니터링** (첫 1시간):

```bash
# CloudWatch/로그 확인
# 1. FormSubmission 레코드 생성 확인
# 2. inquiry 웹훅 호출 확인
# 3. gtag 이벤트 전송 확인
```

### Phase 6: 모니터링 (2주)

**일일 체크리스트**:

```
매일 09:00
- [ ] A/B 테스트 대시보드 확인 (완성율, 신뢰도)
- [ ] 에러율 확인
- [ ] 신규 Contact 생성 수 확인

매주 금요일 17:00
- [ ] 주간 리포트 생성
  - 변형별 메트릭 비교
  - 세그먼트별 성과 분석
  - 다음주 예상 신뢰도
```

**신뢰도 계산 (수동 확인)**:

```python
# Python으로 chi-square 검정 수행
import numpy as np
from scipy.stats import chi2_contingency

# 데이터
control = [완성수_A, 미완성수_A]
variant_b = [완성수_B, 미완성수_B]
variant_c = [완성수_C, 미완성수_C]

# Chi-square test
chi2, p_value, dof, expected = chi2_contingency([control, variant_b])
print(f"Variant B p-value: {p_value:.4f}")
# p_value < 0.05 → 통계적으로 유의미함 (95% 신뢰도)
```

### Phase 7: 승자 결정 (2주 후)

**판정 기준**:

```
모두 충족해야 함:
1. 표본 크기: 각 변형 >= 300명
2. 신뢰도: p-value < 0.05 (95% 이상)
3. 완성율: 기본선 대비 +20% 이상
4. 기간: 최소 7일 (요일 변동성)
```

**승자 배포**:

```bash
# 환경변수 또는 코드에서 variant 고정
LOOP5_CTA_VARIANT=b  # 또는 c

# 재배포
git commit -m "feat(loop5): 승자 배포 (Variant B)"
git push origin main
```

---

## 🔧 로컬 개발 가이드

### 1. 환경 설정

```bash
# 프로젝트 클론
git clone https://github.com/your-org/mabiz-crm.git
cd mabiz-crm

# 의존성 설치
npm install

# 환경변수 설정
cp .env.example .env.local

# 필요한 환경변수 추가:
# NEXT_PUBLIC_INQUIRY_WEBHOOK_SECRET
# NEXT_PUBLIC_DEFAULT_ORG_ID
```

### 2. DB 마이그레이션

```bash
# 마이그레이션 적용
npx prisma migrate deploy

# 또는 dev 모드에서 자동 적용
npx prisma migrate dev --name init
```

### 3. 개발 서버 실행

```bash
npm run dev
# http://localhost:3000 에서 확인
```

### 4. 테스트 폼 접근

```
http://localhost:3000/admin/loop5/ab-test-test-form
또는
직접 ContactForm 컴포넌트 import
```

### 5. 로컬 테스트 체크리스트

```
Step 1: 나이 선택
- [ ] 각 나이 범위 선택 가능
- [ ] 다음 버튼으로 Step 2 진행

Step 2: 선호도 선택
- [ ] 각 선호도 선택 가능
- [ ] Segment A: 신혼부부 체크박스 표시
- [ ] Segment B: 자녀 인원 select 표시
- [ ] 다음 버튼으로 Step 3 진행

Step 3: 연락처 입력
- [ ] 이름 입력 (최소 2자)
- [ ] 폰 번호 입력 및 자동 포맷팅
  - 010 입력 → 010- 자동 추가
  - 010123 입력 → 010-123
  - 0101234567 입력 → 010-1234-567
- [ ] 이메일 입력 (선택사항)
- [ ] 신청하기 버튼으로 제출

성공 화면
- [ ] 성공 메시지 표시
- [ ] 3초 후 폼 리셋

API 확인
- [ ] FormSubmission 레코드 DB에 생성
- [ ] gtag 이벤트 브라우저 콘솔에서 확인
```

### 6. 디버깅

```javascript
// 브라우저 콘솔에서 확인
// Google Analytics 이벤트 확인
console.log(window.gtag);

// FormSubmission 페이로드 확인
// Network 탭에서 /api/webhook/contact-form-submission 요청 확인

// 폼 상태 확인
// React DevTools에서 ContactForm 컴포넌트 상태 확인
```

---

## 📊 예상 효과

### Conservative (최소 달성)
- 폼 완성율: 30% → 40% (+33%)
- CTA 클릭율: 15% → 20% (+33%)
- 월 추가 Contact: +50명 (기존 150명 → 200명)

### Target (목표)
- 폼 완성율: 30% → 50% (+67%)
- CTA 클릭율: 15% → 30% (+100%)
- 월 추가 Contact: +100명 (기존 150명 → 250명)

### Optimistic (초과 달성)
- 폼 완성율: 30% → 60% (+100%)
- CTA 클릭율: 15% → 40% (+167%)
- 월 추가 Contact: +150명 (기존 150명 → 300명)

**비즈니스 임팩트** (월 기준):
- 추가 Contact: +100명
- 평균 전환율: 25% (심리학 적용)
- 추가 고객: +25명
- 평균 LTV: 2,000,000원
- 추가 수익: **+5,000만원/월** (6개월 = 3억원)

---

## 🚨 주의사항

### 1. cruisedot 측 작업 필수

**cruisedot는 별도 프로젝트이므로, 다음을 cruisedot 팀에 요청**:

```
1. inquiry form HTML 페이지에서 CRM의 ContactForm 컴포넌트 import
2. 또는 별도 /inquiry-form 페이지 생성
3. 폼 제출 후 CRM의 /api/webhooks/inquiry 호출

필요한 정보:
- ContactForm 컴포넌트 마운트 위치
- 웹훅 호출 Bearer token (MABIZ_INQUIRY_WEBHOOK_SECRET)
- Google Analytics ID
```

### 2. 보안

```
- Bearer token은 환경변수로 관리
- 클라이언트에서 노출되어도 괜찮은 토큰만 사용
- CORS 설정 확인 (크로스 도메인 호출)
```

### 3. 성능

```
- FormSubmission 테이블에 인덱스 설정
  (variant, segment, createdAt)
- 2주 후 1000+ 레코드 예상
- 월간 데이터 백업 정책 수립
```

### 4. 규정 준수

```
- GDPR: 이메일 수집 시 동의 확인
- 개인정보보호법: 폰 번호 암호화 검토
- 약관: 수집한 데이터 활용 범위 명시
```

---

## 📞 트러블슈팅

### 문제 1: FormSubmission 레코드가 생성되지 않음

```bash
# 1. DB 마이그레이션 확인
psql $DATABASE_URL -c "SELECT * FROM pg_tables WHERE tablename='FormSubmission'"

# 2. Prisma 스키마 확인
npx prisma db push

# 3. API 로그 확인
# CloudWatch 또는 로그 파일에서 [ContactFormSubmission] 검색
```

### 문제 2: Google Analytics 이벤트가 전송되지 않음

```javascript
// 1. gtag 로드 확인
console.log(window.gtag);

// 2. GA ID 확인
console.log(document.querySelector('script[src*="googletagmanager"]'));

// 3. Network 탭에서 google-analytics 요청 확인
// → 또는 GA 실시간 리포트 확인
```

### 문제 3: 폼 제출 후 inquiry 웹훅 호출 실패

```bash
# 1. 웹훅 엔드포인트 확인
curl -X POST http://localhost:3000/api/webhooks/inquiry \
  -H "Authorization: Bearer test_token" \
  -H "Content-Type: application/json" \
  -d '{"phone":"01012345678", "name":"테스트"}'

# 2. CRM 웹훅 로그 확인
# /api/webhook-logs 또는 CloudWatch

# 3. Contact 생성 확인
# CRM 데이터베이스에서 Contact 테이블 조회
```

### 문제 4: A/B 테스트 대시보드에 데이터가 표시되지 않음

```bash
# 1. FormSubmission 데이터 조회
psql $DATABASE_URL -c "SELECT COUNT(*) FROM \"FormSubmission\""

# 2. API 직접 호출
curl http://localhost:3000/api/admin/loop5/ab-test-results?days=14

# 3. 권한 확인
# 로그인 후 OWNER 또는 GLOBAL_ADMIN 역할 확인
```

---

## 📈 성공 모니터링 (2주)

**Daily Standup Template**:

```markdown
## Loop 5-C A/B 테스트 진행상황 (Day X)

### 메트릭
- 총 방문: 500명
- Variant A 완성: 150명 (30%)
- Variant B 완성: 180명 (36%) ← +20%
- Variant C 완성: 200명 (40%) ← +33%

### 신뢰도
- Variant B vs A: 80% 신뢰도 (목표 95%)
- Variant C vs A: 85% 신뢰도 (목표 95%)

### 예상 완료
- Day 10: Variant B/C 중 하나가 95% 신뢰도 도달 예상

### 다음 조치
- [ ] 일일 데이터 수집 계속
- [ ] 모바일 vs PC 성과 분석
- [ ] Segment별 성과 분석
```

**최종 결과 리포트** (Day 14):

```markdown
# Loop 5-C A/B 테스트 최종 결과

## 승자
**Variant B (Action-focused)** 선택

### 메트릭
| 변형 | 방문 | 완성 | 완성율 | 신뢰도 |
|------|------|------|--------|--------|
| A (Control) | 3,000 | 900 | 30% | - |
| B (Action) | 3,000 | 1,350 | 45% | 99.5% |
| C (Urgent) | 3,000 | 1,200 | 40% | 95.2% |

### 최종 비즈니스 임팩트
- 완성율: 30% → 45% (+50%)
- 월 추가 Contact: +450명 (기존 1500명 → 1950명)
- 월 추가 매출: **+2억원** (6개월 = 12억원)

### 추천사항
- Variant B를 기본값으로 배포
- Variant A/C 제거
- 향후 분기별 A/B 테스트 계획
```

---

## 다음 단계

1. **Phase 7 (Week 3)**
   - [ ] 승자 배포 (Variant B 100%)
   - [ ] 기본 설정으로 고정

2. **Phase 8 (Week 4)**
   - [ ] 새로운 A/B 테스트 설계 (SMS 자동화 - Loop 5-D)
   - [ ] 렌즈별 폼 개인화 (심리학 L1-L10)

3. **Phase 9 (Month 2)**
   - [ ] 국제화 (영어/일본어/중국어)
   - [ ] 다중 언어 폼 A/B 테스트

---

**문서 작성일**: 2026-05-28  
**최종 검토**: 준비 완료  
**배포 준비**: ✅ 완료
