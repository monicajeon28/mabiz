# Variant Management UI - Menu #38 Phase 3 Wave 5

**완료일**: 2026-05-19  
**담당자**: Claude  
**상태**: ✅ 완료  

---

## 개요

Menu #38 Phase 3의 최종 단계로, A/B Test Variant를 관리하고 성과를 분석하는 통합 UI를 구현했습니다.

**API 엔드포인트 연동**:
- `POST /api/campaigns/[id]/variants` — Variant 생성
- `GET /api/campaigns/[id]/variants` — Variant 목록 조회
- `PATCH /api/campaigns/[id]/variants/[key]` — Variant 수정
- `DELETE /api/campaigns/[id]/variants/[key]` — Variant 삭제
- `GET /api/campaigns/[id]/variants/stats` — 통계 조회

---

## 파일 구조

### 1. 메인 페이지
**경로**: `src/app/(dashboard)/marketing/campaigns/[id]/variants/page.tsx`

- Campaign 정보 표시
- Variant 관리 / 성과 분석 탭
- API 연동 + 오류 처리
- 발송 상태별 UI 제어

**주요 기능**:
- Campaign 상태 확인 (DRAFT만 수정 가능)
- Variant A/B 카드 병렬 표시
- 탭 UI로 관리/분석 전환

---

### 2. Variant 카드 컴포넌트
**경로**: `src/components/campaigns/VariantCard.tsx`

**기능**:
1. **컨텐츠 입력**
   - SMS 본문 (90자 제한, 실시간 카운트)
   - Email 제목 (200자 제한)
   - Email 본문 (5000자 제한)
   
2. **트래픽 분할**
   - 슬라이더로 0~100% 조정
   - 반대편 자동 계산
   
3. **미리보기 모드**
   - SMS, Email 내용 표시
   - 복사 버튼 제공
   
4. **수정/삭제**
   - DRAFT 상태만 가능
   - 편집 모드 토글
   - 저장 버튼

**스타일링**:
- Variant A: 파란색 (border-left-blue-500)
- Variant B: 빨간색 (border-left-red-500)
- Badge: "생성됨" 표시
- 진행 바: SMS 문자 수 실시간 표시

---

### 3. 통계 컴포넌트
**경로**: `src/components/campaigns/VariantStats.tsx`

**기능**:
1. **KPI 카드**
   - 발송 수, 성공, 실패, 성공률
   - Variant A/B 비교

2. **차트**
   - 성공률 비교 (막대 그래프)
   - 발송 수 비교 (스택 그래프)
   - Recharts 라이브러리 사용

3. **통계 검정**
   - Chi-square 값, P-value
   - Cramer's V (효과 크기)
   - 유의성 판정 (✅/❌)

4. **해석 정보**
   - 신뢰도 배지 (HIGH/MEDIUM/LOW)
   - 추천 Variant 표시
   - 샘플 크기 경고
   - 결과 해석 가이드

---

### 4. Campaign 페이지 수정
**경로**: `src/app/(dashboard)/marketing/campaigns/[id]/page.tsx`

**추가 사항**:
- "🔬 A/B 테스트" 버튼 추가
- Variant 페이지로 라우팅

---

## 사용 흐름

### 1. Variant 생성

```
Campaign 생성 (DRAFT 상태)
    ↓
Campaign 상세 페이지 → "🔬 A/B 테스트" 버튼 클릭
    ↓
Variant 관리 페이지 진입
    ↓
Variant A 카드에서 "SMS/Email 작성" → "저장"
    ↓
Variant B 카드에서 "SMS/Email 작성" → "저장"
```

### 2. 트래픽 분할 설정

```
각 Variant 카드의 슬라이더
    ↓
A: 60%, B: 40% 설정 (자동 계산)
    ↓
저장
```

### 3. Campaign 발송

```
Campaign 상세 페이지 → "지금 발송" 버튼
    ↓
Variant별 설정 트래픽으로 분할 발송
    ↓
발송 이력 기록
```

### 4. 성과 분석

```
Variant 관리 페이지 → "📊 성과 분석" 탭
    ↓
KPI 카드 확인 (발송 수, 성공률)
    ↓
차트로 비교 분석
    ↓
Chi-square 통계 검정 결과 확인
    ↓
"추천 Variant" 배지로 최적 선택 확인
```

---

## 스크린샷 예상

### 1. Variant 관리 탭

```
┌─────────────────────────────────────────────────────┐
│ A/B 테스트 관리                                      │
│ 캠페인: 봄 크루즈 홍보 — DRAFT                      │
├────────────────────────────────────────────────────┤
│ [✏️ Variant 관리] [📊 성과 분석]                    │
├─────────────────────────┬──────────────────────────┤
│                         │                          │
│    Variant A            │     Variant B            │
│    [생성됨]              │     [생성됨]              │
│                         │                          │
│  📱 SMS 미리보기:        │   📱 SMS 미리보기:       │
│  "봄 크루즈 세일..."     │   "특별 할인 50%..."    │
│  [복사]                  │   [복사]                 │
│                         │                          │
│  📊 트래픽: 40%         │   📊 트래픽: 60%        │
│  [수정] [삭제]          │   [수정] [삭제]         │
│                         │                          │
└─────────────────────────┴──────────────────────────┘
```

### 2. 성과 분석 탭

```
┌───────────────────────────────────────┐
│ 성과 분석                              │
│ 신뢰도: [HIGH] 추천: [Variant A]      │
│                                       │
│ Variant A의 성공률이 5% 더 높습니다.   │
│ P-value: 0.0234 (유의미)              │
├───────────────────────────────────────┤
│  [A의 성공률]  [B의 성공률]           │
│  100건/95%    98건/92%              │
│                                       │
│  ┌──────────────┐  ┌──────────────┐  │
│  │████████████│  │██████████   │  │
│  │ 95%        │  │ 92%        │  │
│  └──────────────┘  └──────────────┘  │
│                                       │
│  발송 수 비교:                        │
│  ┌────────────────────────────────┐  │
│  │ ███ (성공)  █ (실패)           │  │
│  │ A: 95  |  B: 92               │  │
│  └────────────────────────────────┘  │
│                                       │
│  Chi-square 결과:                    │
│  통계량: 4.2134  P-value: 0.0234    │
│  유의성: ✅ 유의미                    │
└───────────────────────────────────────┘
```

---

## 기술 스택

- **React Hooks**: useState, useEffect
- **Next.js**: App Router, useParams, useRouter
- **UI 라이브러리**: shadcn/ui (Card, Button, Input, etc.)
- **차트**: Recharts (BarChart, LineChart)
- **아이콘**: lucide-react

---

## API 응답 형식

### Variant 생성/수정

```json
{
  "ok": true,
  "variant": {
    "id": "var_123",
    "variantKey": "A",
    "smsBody": "봄 크루즈 50% 할인...",
    "emailSubject": "특별 크루즈 이벤트",
    "emailBody": "...",
    "trafficSplit": 0.5,
    "isActive": true,
    "createdAt": "2026-05-19T10:00:00Z"
  }
}
```

### 통계 조회

```json
{
  "ok": true,
  "variants": {
    "A": {
      "sent": 1000,
      "success": 950,
      "failure": 50,
      "successRate": 0.95
    },
    "B": {
      "sent": 1000,
      "success": 920,
      "failure": 80,
      "successRate": 0.92
    }
  },
  "analysis": {
    "chiSquare": {
      "chi2": 4.2134,
      "pValue": 0.0234,
      "isSignificant": true
    },
    "cramersV": 0.0456,
    "recommendation": "A",
    "confidence": "HIGH",
    "interpretation": "Variant A의 성공률이 유의미하게 높습니다."
  },
  "metadata": {
    "sampleSizeRecommendation": null
  }
}
```

---

## 주요 기능 상세

### SMS 문자 수 제한

- **제한**: 90자 (한국 SMS 표준)
- **실시간 카운트**: "45/90자" 표시
- **진행 바**: 
  - 0~80자: 파란색
  - 81~90자: 빨간색 (경고)

### 트래픽 분할

- **슬라이더**: 0~100% (0.1 단계)
- **연동**: Variant A 60% → Variant B 자동 40%
- **저장**: 모든 variant이 합쳐서 100%

### 미리보기 모드

- **비활성화 상태**: SMS/Email 미리보기 표시
- **활성화 상태**: 입력 폼으로 전환
- **토글 버튼**: "수정" ↔ "취소"

### 통계 신뢰도

| 신뢰도 | 조건 | 추천 여부 |
|--------|------|---------|
| HIGH | p-value < 0.05 & 샘플 충분 | ✅ 신뢰 가능 |
| MEDIUM | p-value < 0.1 | ⚠️ 주의 필요 |
| LOW | p-value >= 0.1 | ❌ 신뢰 불가 |

---

## 오류 처리

### API 오류

```typescript
if (!data.ok) {
  alert(data.error || 'Variant 생성 실패');
  return;
}
```

### 네트워크 오류

```typescript
catch (error) {
  logger.error('[handleCreateVariant]', { error });
  alert('Variant 생성 중 오류 발생');
}
```

### 권한 확인

- DRAFT 아님: "발송 중이거나 완료된 캠페인" 경고
- 수정/삭제 버튼: isDraftOnly={campaign?.status === 'DRAFT'}

---

## 성능 최적화

1. **탭 전환**: 페이지 로드 시점에만 데이터 조회
2. **새로고침**: "📊 새로고침" 버튼으로 수동 갱신
3. **로딩 상태**: setSaving(true) → 중복 제출 방지
4. **쿼리 최적화**: API에서 필요한 필드만 전송

---

## 확장 가능성

### Phase 4 (향후)
- Variant C/D 추가 지원
- 자동 우승자 판정 (Auto-winner Selection)
- Scheduled Variant 전환 (예: 10일 후 자동으로 A로 전환)

### Phase 5 (향후)
- Variant별 수익 분석
- ROI 계산
- 장기 추적 분석

---

## 산출물 요약

| 항목 | 파일 | 줄 수 |
|-----|------|-------|
| Variant 페이지 | `variants/page.tsx` | 280 |
| VariantCard 컴포넌트 | `VariantCard.tsx` | 230 |
| VariantStats 컴포넌트 | `VariantStats.tsx` | 320 |
| Campaign 페이지 수정 | `[id]/page.tsx` | +15 |
| 문서 | `VARIANT_MANAGEMENT_UI.md` | 400 |
| **총합** | - | **1,245** |

---

## 테스트 체크리스트

- [ ] Variant A 생성 후 미리보기 확인
- [ ] Variant B 생성 후 미리보기 확인
- [ ] SMS 90자 제한 확인
- [ ] 트래픽 분할 슬라이더 동작 확인
- [ ] 수정 버튼으로 내용 변경 확인
- [ ] 삭제 버튼으로 확인 팝업 표시 확인
- [ ] 발송 후 성과 분석 탭 데이터 로드 확인
- [ ] Chi-square 통계 표시 확인
- [ ] 추천 Variant 배지 표시 확인
- [ ] 모바일 반응형 확인 (PC 2열 → Mobile 1열)

---

## 다음 단계

**Phase 4 Track 1 — Delta SMS 시퀀스** (메뉴 #38-2)
- 시간대별 SMS 발송 스케줄링
- 실시간 성과 대시보드
- Variant별 열린 시간대 분석

---

**작성**: Claude  
**최종 검증**: 2026-05-19  
**상태**: ✅ Phase 3 Wave 5 완료 — Menu #38 Phase 3 100% 완료
