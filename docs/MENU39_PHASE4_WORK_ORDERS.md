# Menu #39 Phase 4: 5개 상품 × CRM 완전 통합 - 최종 작업지시서

## 의사결정 확정

### 모든 트랙 의사결정 확정 사항

| 트랙 | 의사결정 | 선택 | 이유 |
|------|--------|------|------|
| **α** | Prisma 스키마 수정 | `segment` + `recommendedProduct` 필드 추가 | 세그먼트 필터링 & 추천 추적 용이 |
| **γ** | SMS 발송 타이밍 | 즉시 발송 (Contact 생성 직후) | 고객 참여도 최대화 |
| **γ** | SMS 메시지 커스터마이징 | 고정 템플릿 5개 (A~E) | 1차 단순 구현, 2차 확장 |
| **γ** | SMS 실패 재시도 | 1회만 | SMS 번호 오류 재시도 낮음 |
| **δ** | P2 우선순위 | Toast → Animation → Logging → Performance | 의존성 최소, UX 순 |

---

## Track A: Contact API 자동화

### A-1: Prisma 스키마 수정

**파일**: `prisma/schema.prisma`

**필드 추가** (Contact 모델):
```prisma
model Contact {
  // ... 기존 필드
  segment              String?              // A, B, C, D, E
  recommendedProduct   String?              // GOLD_MEMBERSHIP, AI_PACKAGE 등
  // ...
}
```

**마이그레이션 생성**:
```bash
npx prisma migrate dev --name add_contact_segment_recommend
```

**예상 시간**: 15분

---

### A-2: Contact POST API 수정

**파일**: `src/app/api/contacts/route.ts`

**수정 위치**: POST 핸들러 (현재 라인 156~244)

**변경 사항**:
1. Request body에서 `age`, `maritalStatus`, `childrenCount` 추출
2. `detectSegment()` 호출 → segment 값 결정
3. `recommendProducts(segment)` 호출 → 첫 번째 추천 상품 저장
4. Prisma `contact.create()` 시 segment, recommendedProduct 포함

**코드 예시**:
```typescript
import { detectSegment } from '@/lib/segment-detector';
import { recommendProducts } from '@/lib/product-recommender';

// POST 핸들러 내부
const segment = detectSegment({
  age: body.age,
  maritalStatus: body.maritalStatus || 'UNKNOWN',
  childrenCount: body.childrenCount || 0,
});

const recommendations = recommendProducts(segment);
const recommendedProduct = recommendations[0]?.code || null;

const contact = await prisma.contact.create({
  data: {
    // ... 기존 필드
    segment,
    recommendedProduct,
  },
});
```

**예상 시간**: 30분

---

### A-3: 테스트 작성

**파일**: `__tests__/api/contacts-create-with-segment.test.ts`

**테스트 케이스**:
- ✅ 30대 기혼 자녀0 → segment=A, recommendedProduct=AI_PACKAGE
- ✅ 40대 기혼 자녀2 → segment=B, recommendedProduct=AI_PACKAGE
- ✅ 나이 미입력 → segment=UNKNOWN 처리
- ✅ maritalStatus 빈 문자열 → segment 정상 처리

**예상 시간**: 30분

**Track A 총 시간**: 1시간 15분

---

## Track B: 대시보드 추천 위젯

### B-1: API 엔드포인트 구현

**파일**: `src/app/api/dashboard/recommendations/route.ts` (신규)

**응답 형식**:
```json
{
  "segment_distribution": {
    "A": 12,
    "B": 8,
    "C": 5,
    "D": 3,
    "E": 2
  },
  "conversion_rates": {
    "A": 0.45,
    "B": 0.38,
    "C": 0.42,
    "D": 0.28,
    "E": 0.35
  },
  "top_products": [
    { "name": "AI_PACKAGE", "count": 15 },
    { "name": "GOLD_MEMBERSHIP", "count": 12 }
  ]
}
```

**쿼리 로직**:
1. Contact 집계 → segment별 분포
2. SalesPlaybook (완료된 거래) → segment별 전환율
3. recommendedProduct 빈도 → top_products

**예상 시간**: 1시간 30분

---

### B-2: 위젯 컴포넌트

**파일**: `src/app/(dashboard)/components/RecommendationWidget.tsx` (신규)

**형태**: BarChart (recharts)
- X축: 세그먼트 (A~E)
- Y축: 세그먼트별 고객 수
- 색상: 세그먼트별 구분 (A=파랑, B=초록, C=주황, D=빨강, E=보라)
- 추가 정보: 각 세그먼트 옆에 전환율 표시 (%)

**컴포넌트 구조**:
```tsx
export const RecommendationWidget: React.FC = async () => {
  const data = await fetch('/api/dashboard/recommendations');
  // ...BarChart 렌더링
}
```

**예상 시간**: 2시간

---

### B-3: 대시보드 통합

**파일**: `src/app/(dashboard)/dashboard/page.tsx`

**통합 위치**: 기존 6~8개 KPI 카드 다음 섹션

**변경**: RecommendationWidget import & 렌더링 (40줄)

**예상 시간**: 1시간

---

### B-4: 테스트 작성

**파일**: `__tests__/api/dashboard-recommendations.test.ts`

**테스트 케이스**:
- ✅ API 응답 형식 검증
- ✅ segment_distribution 합계 = 전체 Contact 수
- ✅ conversion_rates 범위 [0~1]
- ✅ top_products 정렬 순서

**예상 시간**: 1시간

**Track B 총 시간**: 5시간 30분

---

## Track C: SMS 자동화

### C-1: Contact API에 SMS 발송 로직 추가

**파일**: `src/app/api/contacts/route.ts` (A-2에서 수정한 파일)

**추가 로직** (Contact 생성 직후):
```typescript
// 세그먼트별 SMS 템플릿 조회
const template = await prisma.smsTemplate.findFirst({
  where: {
    segmentCode: segment,
    category: 'AUTO_RECOMMEND',
    organizationId: body.organizationId || null,
  },
});

if (template) {
  // 즉시 발송 (SMS API 호출)
  await sendSms({
    phone: body.phone,
    message: template.content,
    organizationId: body.organizationId,
  });
  
  // SmsLog 기록
  await prisma.smsLog.create({
    data: {
      phone: body.phone,
      message: template.content,
      status: 'SENT',
      sentAt: new Date(),
    },
  });
}
```

**예상 시간**: 1시간

---

### C-2: 세그먼트별 SMS 템플릿 시딩

**파일**: `src/lib/seeds/sms-templates.ts` (신규)

**5개 템플릿** (Contact 생성 시 자동 조회):
```typescript
const SEGMENT_SMS_TEMPLATES = {
  A: {
    category: 'AUTO_RECOMMEND',
    title: '세그먼트 A 추천',
    content: '[이름]님을 위한 프리미엄 AI 패키지 추천 🤖\nLINK: https://...',
    segmentCode: 'A',
  },
  // B, C, D, E도 동일 형식
};
```

**실행**: 초기 DB 설정 시 또는 마이그레이션 스크립트로

**예상 시간**: 1시간

---

### C-3: 테스트 작성

**파일**: `__tests__/api/contacts-sms-auto.test.ts`

**테스트 케이스**:
- ✅ Contact 생성 → SMS 즉시 발송 (mock)
- ✅ segment=A → 올바른 템플릿 선택
- ✅ 발송 실패 → SmsLog에 FAILED 기록
- ✅ opt-out 번호 → SMS 발송 스킵

**예상 시간**: 1시간

**Track C 총 시간**: 3시간

---

## Track D: P2 개선사항

### D-1: Toast 알림 추가 (1.5시간)

**적용 파일**:
- `src/app/(dashboard)/contacts/[id]/page.tsx` (Contact 상세)
- `src/app/(dashboard)/contacts/[id]/recommend-banner.tsx` (추천 배너)
- `src/app/(dashboard)/training/page.tsx` (교육 페이지)

**추가 로직**:
```typescript
import { useToast } from '@/lib/use-toast';

const { toast } = useToast();

// Contact 저장 성공
toast({
  title: "저장 완료",
  description: "고객 정보가 저장되었습니다.",
  variant: "default",
});

// SMS 발송 성공
toast({
  title: "메시지 발송",
  description: "세그먼트 추천 메시지가 발송되었습니다.",
});
```

**예상 시간**: 1시간 30분

---

### D-2: Framer Motion 애니메이션 (2.5시간)

**적용 파일**:
- `recommend-banner.tsx` (fade-in 진입)
- `training/page.tsx` (탭 전환 슬라이드)
- `playbook-viewer` (필터 적용 시 애니메이션)

**애니메이션 종류**:
- Fade-in: opacity 0→1 (0.3초)
- Slide: x -20→0 (0.4초)
- Scale: scale 0.95→1 (0.3초)

**예시**:
```typescript
import { motion } from 'framer-motion';

<motion.div
  initial={{ opacity: 0, y: -10 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.3 }}
>
  {/* 콘텐츠 */}
</motion.div>
```

**예상 시간**: 2시간 30분

---

### D-3: 로깅 강화 (1시간)

**적용 파일**:
- `src/lib/segment-detector.ts`
- `src/app/(dashboard)/tools/playbook-viewer/page.tsx`
- `recommend-banner.tsx`

**로깅 추가**:
```typescript
logger.log('[ContactDetail]', {
  action: 'load-data',
  contactId,
  segment,
  status: 'success',
});

logger.log('[SegmentDetector]', {
  action: 'detect-segment',
  age,
  maritalStatus,
  segment: result,
  status: 'success',
});
```

**예상 시간**: 1시간

---

### D-4: 성능 최적화 (2시간)

**최적화 항목**:
1. `useMemo` for `recommendProducts()` (playbook-viewer, contact detail)
2. `useCallback` for toggle handlers (training page)
3. 쿼리 최적화: Contact 조회 시 segment 포함 (N+1 방지)

**예시**:
```typescript
const recommendations = useMemo(() => {
  return recommendProducts(segment);
}, [segment]);

const handleToggle = useCallback((code: ProductCode) => {
  setSelectedProduct(code);
}, []);
```

**예상 시간**: 2시간

**Track D 총 시간**: 7시간

---

## 최종 통합 일정

| 트랙 | 예상 시간 | 병렬 예상 |
|------|---------|---------|
| **A** (Contact API) | 1.25h | 1.25h |
| **B** (대시보드 위젯) | 5.5h | 5.5h |
| **C** (SMS 자동화) | 3h | 3h |
| **D** (P2 개선) | 7h | 7h |
| **순차 합계** | 16.75h | |
| **병렬 예상 (동시)** | | **7시간** |

**실제 예상**: 7시간 (4개 에이전트 병렬 + 병목 Track B: 5.5h)

---

## 코드 검토 기준 (10렌즈)

1. **보안**: SQL Injection 방지 (Prisma ORM 사용), 환경변수 마스킹
2. **성능**: useMemo/useCallback 적용, 쿼리 최적화
3. **접근성**: aria-label 추가 (Toast, 애니메이션 버튼)
4. **UX**: 애니메이션 자연스러움, 에러 메시지 명확성
5. **확장성**: 세그먼트 추가 시 enum 확장 용이
6. **에러 처리**: SMS 발송 실패 → Toast + Log
7. **테스트**: 각 트랙별 unit test 작성
8. **유지보수**: 주석 최소, 함수명 명확
9. **호환성**: 기존 API 파라미터 하위호환 (Contact.segment optional)
10. **비즈니스**: 세그먼트 × 상품 추천 매트릭스 검증

---

## 다음 단계: Step 4 사용자 승인 대기

이 작업지시서가 확정되면:
1. **Step 5**: 4개 에이전트 병렬 구현 시작
2. **Step 6**: 10렌즈 코드 검토 (감독자)
3. **Step 7**: 메모리 업데이트 (Menu #39 Phase 4 완료)
4. **Step 8**: 다음 메뉴 계획 (Menu #40)
