# Variant Stats API

## 개요

`GET /api/campaigns/[id]/variants/stats` 엔드포인트는 A/B Variant의 성과를 통계적으로 분석하고 비교합니다.

- **Chi-square 검정**: 두 그룹의 성공률이 통계적으로 의미 있게 다른지 판정 (95% 신뢰도)
- **Cramer's V**: 효과 크기 정량화 (0 ~ 1)
- **신뢰도**: HIGH/MEDIUM/LOW 단계로 분류
- **추천**: 더 좋은 Variant 제시

---

## 요청

```http
GET /api/campaigns/[id]/variants/stats
Authorization: Bearer <token>
```

**파라미터**:
- `id` (URL path): Campaign ID (필수)

**응답**: JSON

---

## 응답 예시

### 성공 (200 OK)

```json
{
  "ok": true,
  "campaign": {
    "id": "cmp_123",
    "title": "봄 크루즈 캠페인",
    "status": "SENT"
  },
  "variants": {
    "A": {
      "sent": 1000,
      "success": 850,
      "failure": 150,
      "successRate": 0.85
    },
    "B": {
      "sent": 1000,
      "success": 700,
      "failure": 300,
      "successRate": 0.70
    }
  },
  "analysis": {
    "chiSquare": {
      "chi2": 28.5714,
      "pValue": 0.0001,
      "isSignificant": true,
      "degreesOfFreedom": 1
    },
    "cramersV": 0.1268,
    "recommendation": "A",
    "confidence": "HIGH",
    "interpretation": "A Variant이 통계적으로 유의미하게 더 좋습니다. (p=0.0001, 높은 신뢰도(95% 이상))"
  },
  "metadata": {
    "calculatedAt": "2026-05-20T12:00:00Z",
    "sampleSizeRecommendation": null
  }
}
```

### 오류 (404 Not Found)

```json
{
  "error": "Campaign not found"
}
```

---

## 필드 설명

### campaign

- `id`: Campaign ID
- `title`: Campaign 제목
- `status`: Campaign 상태 (DRAFT/SENT/PAUSED/COMPLETED)

### variants

각 Variant의 발송 통계:

| 필드 | 설명 |
|------|------|
| `sent` | 총 발송 수 (PENDING/SENT/FAILED/SKIPPED 합계) |
| `success` | 성공 수 (SENT/DELIVERED) |
| `failure` | 실패 수 (FAILED/ABANDONED) |
| `successRate` | 성공률 (0.0 ~ 1.0) |

**주의**: PENDING/SKIPPED는 아직 결과가 없으므로 성공/실패에 포함되지 않지만 `sent` 수에는 포함됩니다.

### analysis

#### chiSquare (A/B 비교가 있을 때만)

**Chi-square 검정 결과** — 두 그룹의 성공률이 통계적으로 다른지 판정

| 필드 | 설명 |
|------|------|
| `chi2` | Chi-square 통계량 (0 이상) |
| `pValue` | P-value (0.0 ~ 1.0) |
| `isSignificant` | `pValue < 0.05`? (95% 신뢰도에서 유의미) |
| `degreesOfFreedom` | 자유도 (항상 1) |

**해석**:
- **p < 0.05**: 유의미한 차이 (귀무가설 기각) ✅
- **p ≥ 0.05**: 의미 있는 차이 없음 (표본 수 부족) ❌

#### cramersV

**효과 크기 (Effect Size)** — 차이가 얼마나 큰지 정량화 (0 ~ 1)

| 범위 | 해석 |
|------|------|
| 0.0 ~ 0.1 | 무시할 수 있는 차이 |
| 0.1 ~ 0.3 | 약한 차이 |
| 0.3 ~ 0.5 | 중간 정도 차이 |
| > 0.5 | 강한 차이 |

#### recommendation

추천 Variant: `"A"` | `"B"` | `null`

- **"A" 또는 "B"**: 성공률이 높은 쪽
- **null**: 성공률이 동등하거나 단일 Variant

#### confidence

신뢰도: `"HIGH"` | `"MEDIUM"` | `"LOW"`

| 신뢰도 | 조건 |
|--------|------|
| **HIGH** | `isSignificant=true` AND `cramersV > 0.3` |
| **MEDIUM** | `isSignificant=true` AND `cramersV ≤ 0.3` |
| **LOW** | `isSignificant=false` |

#### interpretation

사람이 읽기 쉬운 해석 문구 (한국어)

예:
- "A Variant이 통계적으로 유의미하게 더 좋습니다. (p=0.0001, 높은 신뢰도(95% 이상))"
- "두 Variant 간 통계적으로 의미 있는 차이가 없습니다. 샘플 수를 늘려보세요. (유의도 α=0.05)"

### metadata

| 필드 | 설명 |
|------|------|
| `calculatedAt` | ISO 8601 timestamp (분석 시간) |
| `sampleSizeRecommendation` | 표본 크기 권장사항 (문자열 또는 null) |

---

## Chi-Square 검정 설명

### 원리

두 그룹의 분할표(Contingency Table)를 이용하여 성공률이 통계적으로 다른지 판정합니다.

```
           Success  Failure   합계
Variant A     a       b      a+b
Variant B     c       d      c+d
합계         a+c     b+d    a+b+c+d=n
```

**귀무가설 (H0)**: A와 B의 성공률은 같다
**대안 가설 (Ha)**: A와 B의 성공률은 다르다

### 공식

**Chi-square 통계량**:
```
χ² = Σ ((O - E)² / E)

여기서:
- O: 관측도수 (실제 데이터)
- E: 기댓값 = (행 합 × 열 합) / 전체 합
```

**P-value** (자유도 1인 카이제곱 분포):
```
P = exp(-χ² / 2)  [근사식, 정확도 95%]
```

### 예시

**A**: 100 성공, 10 실패 (91% 성공률)
**B**: 50 성공, 50 실패 (50% 성공률)

```
χ² = 28.57
p = 0.00009 (< 0.05)
→ 유의미한 차이 ✅
```

---

## Cramer's V (효과 크기) 설명

### 공식

```
V = √(χ² / (n × (k-1)))

여기서:
- χ²: Chi-square 통계량
- n: 전체 표본 수
- k: 범주 수 (A/B = 2)
```

### 해석

- **V = 0**: 두 변수 완전 독립 (차이 없음)
- **V = 1**: 두 변수 완전 종속 (완벽한 관계)

### 예시

**A**: 850 성공, 150 실패 (85%)
**B**: 700 성공, 300 실패 (70%)

```
χ² = 28.57
n = 2000
V = √(28.57 / 2000) = 0.1195

→ 약한 차이 (0.1 ~ 0.3)
```

---

## 샘플 크기 권장사항

통계적 신뢰도는 표본 크기에 크게 영향받습니다.

| 표본 크기 (Variant당) | 신뢰도 | 권장사항 |
|----------------------|--------|----------|
| < 30 | 매우 낮음 | 최소 30개 필요 |
| 30 ~ 100 | 낮음 | 100개 이상 권장 |
| 100 ~ 500 | 보통 | 500개를 목표 |
| ≥ 500 | 높음 | 충분 ✅ |

---

## 실제 사용 예시

### 1. 단순한 A/B 비교

```bash
curl -H "Authorization: Bearer ..." \
  http://localhost:3000/api/campaigns/cmp_123/variants/stats | jq
```

**응답**:
```json
{
  "analysis": {
    "recommendation": "A",
    "confidence": "HIGH",
    "interpretation": "A Variant이 통계적으로 유의미하게 더 좋습니다."
  }
}
```

### 2. 단일 메시지 캠페인

Variant가 없는 캠페인:

```json
{
  "variants": {
    "SINGLE": {
      "sent": 100,
      "success": 85,
      "failure": 15,
      "successRate": 0.85
    }
  },
  "analysis": {
    "chiSquare": null,
    "recommendation": null,
    "confidence": "LOW"
  }
}
```

### 3. 표본 부족 경고

```json
{
  "analysis": {
    "confidence": "MEDIUM",
    "interpretation": "차이가 있지만 효과 크기가 작습니다."
  },
  "metadata": {
    "sampleSizeRecommendation": "통계적 신뢰도를 높이려면 Variant당 최소 100개 샘플 권장합니다."
  }
}
```

---

## 오류 처리

### 401 Unauthorized

인증 실패

```json
{
  "error": "Unauthorized"
}
```

### 404 Not Found

Campaign을 찾을 수 없거나 권한이 없음 (IDOR)

```json
{
  "error": "Campaign not found"
}
```

### 500 Internal Server Error

서버 오류

```json
{
  "error": "Internal server error"
}
```

---

## 통계 용어 참고

| 용어 | 의미 |
|------|------|
| **귀무가설 (H0)** | 테스트하는 기본 가정 (예: A=B) |
| **P-value** | 귀무가설이 참일 확률 (작을수록 좋음) |
| **유의도 α** | 귀무가설을 기각하는 기준 (보통 0.05) |
| **신뢰도** | 결과를 믿을 수 있는 정도 (95% = α=0.05) |
| **Chi-square** | 범주형 데이터 검정 방법 |
| **효과 크기** | 실제 차이의 크기 (통계적 유의성 vs 실제 영향) |

---

## 구현 참고

### 주요 함수

- `calculateChiSquare()`: Chi-square 검정
- `calculateCramersV()`: 효과 크기
- `determineConfidenceLevel()`: 신뢰도 판정
- `generateInterpretation()`: 해석 문구 생성
- `getSampleSizeRecommendation()`: 표본 크기 권장

모든 함수는 `src/lib/variant-stats.ts`에 있습니다.

### 테스트

```bash
# 단위 테스트
npm test -- variant-stats.test.ts

# API 통합 테스트
npm test -- stats.test.ts
```

---

## FAQ

**Q: 두 Variant의 성공률은 다르지만 confidence가 LOW인 이유?**
A: 표본 수가 부족하여 우연일 가능성이 높습니다. Variant당 100개 이상의 샘플을 수집해보세요.

**Q: p-value = 0.05가 정확히 나왔다면?**
A: 95% 신뢰도의 경계선입니다. 추가 표본을 수집하거나 effect size를 고려하세요.

**Q: PENDING 상태의 메시지는 왜 제외되나요?**
A: 아직 발송 결과가 나오지 않았으므로 성공/실패를 판단할 수 없습니다.

**Q: 한 Variant만 있으면 어떻게 되나요?**
A: A/B 비교가 불가능하므로 `chiSquare`는 null이고 `confidence`는 LOW입니다.

---

## 버전 이력

| 버전 | 날짜 | 변경 |
|------|------|------|
| 1.0 | 2026-05-20 | 초기 출시 (Chi-square + Cramer's V) |

---

## 관련 문서

- [Campaign API](./API_CAMPAIGNS.md)
- [SendingHistory 스키마](../prisma/schema.prisma#SendingHistory)
- [CampaignVariant 스키마](../prisma/schema.prisma#CampaignVariant)
