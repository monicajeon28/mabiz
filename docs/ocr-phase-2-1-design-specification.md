# OCR Phase 2-1: 여권 텍스트 자동 추출 설계 (2026-06-19)

## 📋 Executive Summary

**목표**: 여권 사진 업로드 → 자동 텍스트 인식 → 폼 자동 입력으로 사용자 입력 시간 80% 단축

**현황**: 
- ✅ Gemini Vision API 이미 통합 (src/lib/passport-ocr.ts)
- ✅ 파트너/관리자 OCR 엔드포인트 완성 (partner/admin ocr-to-apis routes)
- ❌ 고객/파트너 UI에서 OCR 결과를 폼에 자동 입력 미구현
- ❌ OCR 신뢰도 표시 (정확도 점수) 미구현
- ❌ 수동 수정 UI (클릭으로 재입력) 미구현

**기술 스택**:
- Gemini 2.0 Flash (기본 모델)
- Next.js 15 API Routes (server-side 전용)
- Prisma ORM (gmTraveler + gmPassportSubmissionGuest)
- Google Vision API (또는 Tesseract.js 보조)

**성과 메트릭**:
```
현재: 수동입력 평균 5분 × 여행당 5명 = 25분/여행
목표: 자동입력 1분 + 수정 1분 = 2분/여행 (92% 단축)
정확도: 90%+ (현재 Gemini 95%+ 성과)
오타감소: 80% (자동입력 vs 수동입력)
```

---

## 🏗️ Architecture Overview

### 1. 현재 시스템 (Phase 1: 기본 OCR)

```
┌─────────────────────────────────────────────────────────┐
│ 고객/파트너 여권 사진 업로드                           │
│ (/public/[token]/upload or /partner/ocr)               │
└────────────────────┬────────────────────────────────────┘
                     │ (이미지 URL)
                     ▼
┌─────────────────────────────────────────────────────────┐
│ src/lib/passport-ocr.ts                                │
│ extractPassportFromBuffer()                             │
│ + Gemini Vision API 호출                               │
│ + JSON 파싱 + 정규식 백업                              │
│ + 날짜 정규화 (yyyy-MM-dd)                             │
└────────────────────┬────────────────────────────────────┘
                     │ 
                     ▼
┌─────────────────────────────────────────────────────────┐
│ /api/passport/admin/ocr-to-apis                        │
│ /api/passport/partner/ocr (2개 엔드포인트)              │
│ + Traveler DB 저장                                      │
│ + PassportSubmissionGuest 동기화                        │
│ + 감사 로그 (submittedBy + source)                      │
└────────────────────┬────────────────────────────────────┘
                     │ (JSON response: {ok, data, message})
                     ▼
┌─────────────────────────────────────────────────────────┐
│ UI (수동으로 응답값을 폼에 입력 필요) ❌               │
│ - 여권번호, 영문이름, 생년월일 등 수동입력              │
└─────────────────────────────────────────────────────────┘
```

### 2. Phase 2-1: UI 자동 입력 (신규)

```
┌─────────────────────────────────────────────────────────────────┐
│ FE: 여권 사진 업로드                                            │
│ FormData: image (File) + tripId + userId (선택)                │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ 신규 API: POST /api/passport/[public|partner|admin]/ocr         │
│ 1. 이미지 업로드 (Google Drive 또는 Local)                      │
│ 2. Gemini Vision 호출                                           │
│ 3. 신뢰도 계산 (confidence: 0-100)                              │
│ 4. JSON 응답 (data + confidence + warnings)                     │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ FE: 자동 폼 입력 + 신뢰도 표시                                  │
│ 1. OCR 필드 → 폼 입력 (즉시 반영)                              │
│ 2. 신뢰도 배지 (90%+ GREEN, 70-90% YELLOW, <70% RED)          │
│ 3. 수정 버튼 (클릭시 재입력 가능)                              │
│ 4. 경고 배너 (미인식 필드 강조)                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📐 API Specification

### POST /api/passport/[scope]/ocr

**경로 파라미터**:
- `scope`: `public` (고객) | `partner` (파트너) | `admin` (관리자)

**요청 본문** (FormData):
```javascript
{
  image: File,              // 여권 사진 (JPEG/PNG, 10MB 이하)
  tripId?: number,          // 여행 ID (선택)
  userId?: number,          // 고객 ID (선택)
  submissionId?: number,    // 제출 ID (선택)
  language?: string         // 'ko' | 'en' (기본값: 'ko')
}
```

**응답 성공** (200):
```json
{
  "ok": true,
  "message": "OCR 처리 완료",
  "data": {
    "korName": "김철수",
    "engSurname": "KIM",
    "engGivenName": "CHULSU",
    "passportNo": "M12345678",
    "sex": "M",
    "dateOfBirth": "1990-05-15",
    "dateOfIssue": "2020-03-10",
    "passportExpiryDate": "2030-03-10",
    "nationality": "KOR"
  },
  "confidence": 95,          // 신뢰도 (0-100)
  "warnings": ["영문 이름"],  // 미인식 필드
  "hasMinimum": true,        // 최소 정보 충족
  "processingTimeMs": 2340   // 처리시간
}
```

**응답 실패** (400/403/500):
```json
{
  "ok": false,
  "message": "여권 정보를 읽을 수 없습니다. 더 선명한 이미지를 사용해주세요.",
  "code": "PASSPORT_OCR_UNREADABLE",
  "suggestions": [
    "좋은 조명 아래에서 촬영해주세요.",
    "여권을 평평하게 놓고 촬영해주세요.",
    "여권 정보 페이지만 촬영해주세요."
  ]
}
```

---

## 🧮 신뢰도 점수 계산 (Confidence Scoring)

**목표**: 90%+ 정확도 달성 + 사용자에게 신뢰도 시각화

### 계산 알고리즘

```typescript
function calculateConfidence(result: PassportExtractResult): {
  confidence: number;      // 0-100
  level: 'high' | 'medium' | 'low';
  issues: string[];
} {
  let score = 100;
  const issues: string[] = [];

  // 1. 필드 완성도 (-5점/필드)
  const fieldCount = [
    result.data.korName,
    result.data.engSurname,
    result.data.engGivenName,
    result.data.passportNo,
    result.data.dateOfBirth,
    result.data.dateOfIssue,
    result.data.passportExpiryDate,
  ].filter(f => !!f).length;
  
  const missingFields = 7 - fieldCount;
  score -= missingFields * 5;
  if (missingFields > 0) issues.push(`${missingFields}개 필드 미인식`);

  // 2. 최소 정보 확인 (-20점)
  if (!result.hasMinimum) {
    score -= 20;
    issues.push('여권번호 또는 이름 미인식');
  }

  // 3. 여권번호 형식 검증 (-15점)
  const passportNo = result.data.passportNo || '';
  if (passportNo && !/^[A-Z]{1,2}[0-9]{7,8}$/.test(passportNo)) {
    score -= 15;
    issues.push('여권번호 형식 의심');
  }

  // 4. 날짜 유효성 검증 (-10점/잘못된 날짜)
  [
    result.data.dateOfBirth,
    result.data.dateOfIssue,
    result.data.passportExpiryDate,
  ].forEach(date => {
    if (date && !/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(date)) {
      score -= 10;
      issues.push('날짜 형식 오류');
    }
  });

  // 5. 영문 성/이름 포함 여부 (-10점)
  if (!result.data.engSurname || !result.data.engGivenName) {
    score -= 10;
    issues.push('영문 이름 미완성');
  }

  // 6. 이미지 품질 지표 (Gemini에서 반환 시)
  // (추후 Gemini에서 '흐린 이미지', '기울어짐' 등 피드백 추가)
  if (result.warnings && result.warnings.length >= 5) {
    score -= 10;
    issues.push('여러 필드 미인식 (이미지 품질 의심)');
  }

  const confidence = Math.max(0, Math.min(100, score));
  const level = confidence >= 85 ? 'high' : confidence >= 70 ? 'medium' : 'low';

  return { confidence, level, issues };
}
```

### 신뢰도 레벨 매핑

| 점수 | 레벨 | UI 색상 | 사용자 액션 | 자동 저장 |
|------|------|--------|-----------|---------|
| 85-100 | 🟢 HIGH | Green | 자동 저장 권장 | ✅ Yes |
| 70-84 | 🟡 MEDIUM | Yellow | 수정 후 저장 권장 | ⚠️ 경고 |
| 0-69 | 🔴 LOW | Red | 수동 입력 권장 | ❌ No |

---

## 🎨 UI/UX 설계

### 1. 업로드 인터페이스

```
┌─────────────────────────────────────────────────────────┐
│ 여권 정보 입력                                          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ 📸 여권 사진 업로드                                    │
│ ┌──────────────────────────────────────────────────┐  │
│ │ 파일을 여기에 놓거나 클릭해서 선택하세요        │  │
│ │ (JPEG, PNG | 최대 10MB)                        │  │
│ └──────────────────────────────────────────────────┘  │
│                                                         │
│ ○ OCR로 자동입력 (권장)                               │
│ ○ 수동입력                                            │
│                                                         │
│ [다음 단계]                                            │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 2. OCR 처리 중 (로딩)

```
┌─────────────────────────────────────────────────────────┐
│ 여권 정보 인식 중...                                   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│     [████████░░░░░░░░░░] 60% 완료                     │
│                                                         │
│     🔄 AI가 여권 정보를 읽고 있습니다.                │
│        (약 3-5초 소요)                                 │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 3. OCR 결과 (자동 입력)

```
┌─────────────────────────────────────────────────────────┐
│ 여권 정보 (자동 인식 완료)                             │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ 신뢰도: 🟢 95% (매우 높음)                            │
│ [다시 촬영]                                            │
│                                                         │
│ 영문 성명 *                                            │
│ [KIM CHULSU                  ] [수정]                │
│ (인식됨)                                              │
│                                                         │
│ 생년월일 *                                             │
│ [1990-05-15                  ] [수정]                │
│ (인식됨)                                              │
│                                                         │
│ 여권번호 *                                             │
│ [M12345678                   ] [수정]                │
│ ⚠️ 형식 검증됨 (M + 8자리 숫자)                      │
│                                                         │
│ 성별 *                                                 │
│ ○ 남성  ● 여성                                        │
│ (인식됨)                                              │
│                                                         │
│ 발급일 *                                               │
│ [2020-03-10                  ] [수정]                │
│ (인식됨)                                              │
│                                                         │
│ 만료일 *                                               │
│ [2030-03-10                  ]                         │
│ (인식됨) ⚠️ 유효기간: 3년 8개월                      │
│                                                         │
│ [다음 단계 (자동 저장)]  [수정하기]                   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 4. 수정 모드 (클릭 후)

```
┌─────────────────────────────────────────────────────────┐
│ 여권번호 수정                                          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ 영문 성명 (원본: KIM CHULSU)                         │
│ [                             ]                        │
│ 형식: 영문 성 + 영문 이름 (각각 10자 이하)           │
│                                                         │
│ [확인]  [취소]                                         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 5. 낮은 신뢰도 (자동입력 실패)

```
┌─────────────────────────────────────────────────────────┐
│ ⚠️ 여권 정보 인식 실패                                │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ 신뢰도: 🔴 45% (너무 낮음)                           │
│                                                         │
│ 미인식 항목:                                           │
│ - 여권번호                                             │
│ - 생년월일                                             │
│ - 발급일                                              │
│                                                         │
│ 해결 방법:                                             │
│ 1. 좋은 조명 아래에서 다시 촬영해주세요              │
│ 2. 여권을 평평하게 놓고 수평으로 촬영해주세요        │
│ 3. 여권 정보 페이지(사진 있는 쪽)만 촬영해주세요      │
│                                                         │
│ [다시 촬영]  [수동으로 입력하기]                      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 📁 File Structure & Implementation

### Phase 2-1 신규 파일

```
src/
├── lib/
│   ├── passport-ocr.ts (기존 ✅ - 수정 없음)
│   ├── passport-ocr-confidence.ts (신규)
│   │   └── calculateConfidence(result)
│   │   └── getConfidenceLevel(score)
│   │   └── getConfidenceSuggestions(issues)
│   │
│   └── passport-ocr-validators.ts (신규)
│       └── validatePassportNumber(no)
│       └── validateDate(date)
│       └── validateName(name)
│
├── app/api/passport/
│   ├── [public]/ocr/route.ts (신규)
│   │   └── POST (고객용: 토큰 검증)
│   │
│   ├── partner/ocr/route.ts (기존 수정 ⚠️)
│   │   └── POST (이미지 업로드 + OCR + 신뢰도)
│   │
│   └── admin/ocr/route.ts (신규)
│       └── POST (이미지 업로드 + OCR + 신뢰도)
│
└── app/(dashboard)/passport/
    └── components/OcrUploadCard.tsx (신규)
        └── 이미지 업로드 UI
        └── 신뢰도 표시
        └── 자동 폼 입력
```

### 기존 파일 수정 (기본값 유지)

| 파일 | 수정 | 이유 |
|------|------|------|
| src/lib/passport-ocr.ts | ❌ 수정 없음 | 이미 안정화, 인식 회귀 방지 |
| /partner/ocr/route.ts | ✅ 응답에 confidence 추가 | 신뢰도 계산 |
| /admin/ocr-to-apis/route.ts | ✅ 응답에 confidence 추가 | 신뢰도 계산 |

---

## 🔧 구현 세부사항

### 1. POST /api/passport/[scope]/ocr (신규)

```typescript
/**
 * 여권 사진 → OCR 처리 → 신뢰도 계산
 * 
 * scope: 'public' | 'partner' | 'admin'
 * 
 * Request (FormData):
 *   - image: File (JPEG/PNG, ≤10MB)
 *   - tripId?: number
 *   - userId?: number
 *   - submissionId?: number
 * 
 * Response:
 *   {
 *     ok: boolean,
 *     data?: PassportNormalizedData,
 *     confidence: number,        // 신뢰도 0-100
 *     level: 'high' | 'medium' | 'low',
 *     warnings: string[],
 *     hasMinimum: boolean,
 *     suggestions?: string[]     // 개선 제안 (신뢰도 낮을 시)
 *   }
 */

export async function POST(req: NextRequest) {
  try {
    // 1. 권한 검증 (scope별)
    let ctx = null;
    if (scope === 'public') {
      ctx = await validatePublicToken(req);
    } else if (scope === 'partner') {
      ctx = await requirePartnerContext();
    } else if (scope === 'admin') {
      ctx = await requireCrmManager();
    }
    
    // 2. FormData 파싱
    const formData = await req.formData();
    const image = formData.get('image') as File;
    const imageBuffer = await image.arrayBuffer();
    
    // 3. OCR 처리
    const extracted = await extractPassportFromBuffer(
      Buffer.from(imageBuffer),
      image.type,
      { model: process.env.GEMINI_MODEL_NAME || 'gemini-2.0-flash' }
    );
    
    // 4. 신뢰도 계산
    const { confidence, level, issues } = calculateConfidence(extracted);
    
    // 5. 응답
    return NextResponse.json({
      ok: true,
      data: extracted.data,
      confidence,
      level,
      warnings: extracted.warnings,
      hasMinimum: extracted.hasMinimum,
      suggestions: getSuggestions(level, issues),
      processingTimeMs: Date.now() - startTime
    });
  } catch (error) {
    // ... 에러 처리
  }
}
```

### 2. calculateConfidence() 구현

```typescript
// src/lib/passport-ocr-confidence.ts

export function calculateConfidence(
  result: PassportExtractResult
): { confidence: number; level: ConfidenceLevel; issues: string[] } {
  let score = 100;
  const issues: string[] = [];

  // 1. 필드 완성도 검사 (7개 필드)
  const completedFields = countCompletedFields(result.data);
  const missingFields = 7 - completedFields;
  score -= missingFields * 5;  // 각 필드 5점
  
  if (missingFields > 0) {
    issues.push(`${missingFields}개 필드 미인식`);
  }

  // 2. 최소 정보 (여권번호 or 이름)
  if (!result.hasMinimum) {
    score -= 20;
    issues.push('여권번호 또는 이름 미인식');
  }

  // 3. 여권번호 형식 검증
  if (result.data.passportNo && !isValidPassportFormat(result.data.passportNo)) {
    score -= 15;
    issues.push('여권번호 형식 의심 (M/뒤 8자리)');
  }

  // 4. 날짜 유효성 검증
  [
    { value: result.data.dateOfBirth, name: '생년월일' },
    { value: result.data.dateOfIssue, name: '발급일' },
    { value: result.data.passportExpiryDate, name: '만료일' },
  ].forEach(({ value, name }) => {
    if (value && !isValidDate(value)) {
      score -= 10;
      issues.push(`${name} 형식 오류`);
    }
  });

  // 5. 영문 성/이름 완성도
  if (!result.data.engSurname || !result.data.engGivenName) {
    score -= 10;
    issues.push('영문 이름 미완성');
  }

  // 6. 여러 필드 미인식 시 이미지 품질 저하
  if (result.warnings && result.warnings.length >= 5) {
    score -= 10;
    issues.push('여러 필드 미인식 (이미지 품질 의심)');
  }

  const confidence = Math.max(0, Math.min(100, score));
  const level = getConfidenceLevel(confidence);

  return { confidence, level, issues };
}

function getConfidenceLevel(score: number): 'high' | 'medium' | 'low' {
  if (score >= 85) return 'high';
  if (score >= 70) return 'medium';
  return 'low';
}

function countCompletedFields(data: PassportNormalizedData): number {
  return [
    data.korName,
    data.engSurname,
    data.engGivenName,
    data.passportNo,
    data.dateOfBirth,
    data.dateOfIssue,
    data.passportExpiryDate,
  ].filter(f => !!f).length;
}
```

### 3. FE: OcrUploadCard.tsx (신규)

```typescript
// src/app/(dashboard)/passport/components/OcrUploadCard.tsx

'use client';

import { useState } from 'react';
import { useDropZone } from '@/lib/dropzone';

export function OcrUploadCard({
  onOcrComplete,
  tripId,
  userId,
}: {
  onOcrComplete: (data: PassportNormalizedData, confidence: number) => void;
  tripId?: number;
  userId?: number;
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OcrResult | null>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);

  const handleImageSelect = async (file: File) => {
    setSelectedImage(file);
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('image', file);
      if (tripId) formData.append('tripId', tripId.toString());
      if (userId) formData.append('userId', userId.toString());

      const res = await fetch('/api/passport/ocr', {
        method: 'POST',
        body: formData,
      });

      const ocrResult = await res.json();

      if (ocrResult.ok) {
        setResult(ocrResult);
        // 자동으로 폼에 입력
        onOcrComplete(ocrResult.data, ocrResult.confidence);
      } else {
        // 에러 표시
        showErrorBanner(ocrResult);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. 업로드 영역 */}
      <DropZone onSelect={handleImageSelect} loading={loading} />

      {/* 2. 로딩 (처리 중) */}
      {loading && <LoadingSpinner />}

      {/* 3. 신뢰도 배지 + 결과 */}
      {result && !loading && (
        <ConfidenceDisplay
          confidence={result.confidence}
          level={result.level}
          warnings={result.warnings}
          issues={result.issues}
        />
      )}

      {/* 4. 개선 제안 */}
      {result?.suggestions && result.confidence < 85 && (
        <SuggestionBanner suggestions={result.suggestions} />
      )}
    </div>
  );
}

function ConfidenceDisplay({
  confidence,
  level,
  warnings,
  issues,
}: {
  confidence: number;
  level: 'high' | 'medium' | 'low';
  warnings: string[];
  issues: string[];
}) {
  const colorMap = {
    high: 'bg-green-100 border-green-300 text-green-800',
    medium: 'bg-yellow-100 border-yellow-300 text-yellow-800',
    low: 'bg-red-100 border-red-300 text-red-800',
  };

  const iconMap = { high: '🟢', medium: '🟡', low: '🔴' };

  return (
    <div className={`p-4 border rounded ${colorMap[level]}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{iconMap[level]}</span>
          <div>
            <div className="font-bold">신뢰도: {confidence}%</div>
            <div className="text-sm">
              {level === 'high' && '매우 높음'}
              {level === 'medium' && '보통 - 수정 후 저장 권장'}
              {level === 'low' && '너무 낮음 - 수동 입력 권장'}
            </div>
          </div>
        </div>
        <button className="text-sm font-semibold underline">다시 촬영</button>
      </div>

      {/* 미인식 필드 */}
      {warnings.length > 0 && (
        <div className="mt-3 text-sm">
          <strong>미인식:</strong> {warnings.join(', ')}
        </div>
      )}

      {/* 개선 제안 */}
      {issues.length > 0 && (
        <div className="mt-3 text-sm">
          <strong>문제:</strong>
          <ul className="list-disc ml-5">
            {issues.map((issue, i) => (
              <li key={i}>{issue}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
```

---

## 🔒 보안 체크리스트

| 항목 | 구현 | 비고 |
|------|------|------|
| SSRF 방지 | ✅ | 허용 도메인 화이트리스트 (Google Drive만) |
| 파일 크기 제한 | ✅ | 10MB 상한 |
| 타임아웃 | ✅ | 15초 (Gemini 호출) |
| 권한 검증 | ✅ | requirePartnerContext + IDOR 방지 |
| 민감정보 마스킹 | ✅ | 로그에 여권번호 마스킹 |
| AES-256 암호화 | ✅ | DB 저장 시 여권번호 암호화 |
| 감사 로그 | ✅ | submittedBy + source + processedAt |

---

## ⚡ 성능 최적화

| 항목 | 목표 | 방법 |
|------|------|------|
| **OCR 처리** | <3s | Gemini 2.0 Flash (가벼운 모델) |
| **이미지 업로드** | <1s | FormData + fetch (병렬) |
| **폼 자동입력** | <0.2s | React state 즉시 업데이트 |
| **신뢰도 계산** | <0.1s | 단순 점수 집계 (DB 쿼리 없음) |
| **전체 UX** | <5s | 로딩 바 + 진행도 표시 |

**병목 분석**:
1. Gemini API 호출: 2-3s (고정)
2. 이미지 인코딩: 0.5s (크기 의존)
3. JSON 파싱: <0.1s
4. 폼 입력: <0.2s

**개선 방안**:
- 이미지 사전 압축 (50KB 이하로 축소)
- Gemini 배치 처리 불가 (단건 처리만 가능)
- 캐싱 불가 (각 여권은 고유)

---

## 🧪 테스트 전략

### Unit Tests

```typescript
// src/lib/__tests__/passport-ocr-confidence.test.ts

describe('calculateConfidence', () => {
  it('완벽한 결과 → 95-100점', () => {
    const result = createMockResult({
      korName: '김철수',
      engSurname: 'KIM',
      engGivenName: 'CHULSU',
      passportNo: 'M12345678',
      dateOfBirth: '1990-05-15',
      dateOfIssue: '2020-03-10',
      passportExpiryDate: '2030-03-10',
    });
    
    const { confidence, level } = calculateConfidence(result);
    expect(confidence).toBeGreaterThanOrEqual(90);
    expect(level).toBe('high');
  });

  it('필드 3개 미인식 → 70-80점 (MEDIUM)', () => {
    const result = createMockResult({
      korName: '', // missing
      engSurname: 'KIM',
      engGivenName: '', // missing
      passportNo: 'M12345678',
      dateOfBirth: '1990-05-15',
      dateOfIssue: '', // missing
      passportExpiryDate: '2030-03-10',
    });
    
    const { confidence, level } = calculateConfidence(result);
    expect(confidence).toBeGreaterThanOrEqual(70);
    expect(confidence).toBeLessThan(85);
    expect(level).toBe('medium');
  });

  it('여권번호 형식 오류 → -15점', () => {
    const result = createMockResult({
      passportNo: 'INVALID_NO', // not M+8digits
    });
    
    const { confidence, issues } = calculateConfidence(result);
    expect(issues).toContain('여권번호 형식 의심');
  });
});
```

### Integration Tests

```typescript
// e2e/passport-ocr.spec.ts

describe('OCR Upload Flow', () => {
  it('여권 사진 업로드 → 자동 폼 입력 → 저장', async () => {
    // 1. 파트너 로그인
    await page.goto('/partner/login');
    
    // 2. 여권 업로드 페이지
    await page.goto('/partner/passport/submit');
    
    // 3. 이미지 업로드
    await page.setInputFiles('input[type="file"]', './fixtures/passport.jpg');
    
    // 4. OCR 처리 대기
    await page.waitForSelector('[data-testid="confidence-badge"]');
    
    // 5. 신뢰도 확인
    const confidence = await page.textContent('[data-testid="confidence-value"]');
    expect(confidence).toMatch(/[0-9]+%/);
    
    // 6. 폼 자동입력 확인
    const nameInput = await page.inputValue('input[name="engName"]');
    expect(nameInput).toBe('KIM CHULSU');
    
    // 7. 저장 버튼
    await page.click('button:has-text("다음 단계")');
    await expect(page).toHaveURL(/passport\/submit\?step=2/);
  });

  it('낮은 신뢰도 → 재촬영 제안', async () => {
    // ... (흐린 이미지 업로드)
    await page.setInputFiles('input[type="file"]', './fixtures/blurry.jpg');
    
    // 신뢰도 배지 확인
    const badge = await page.locator('[data-testid="confidence-badge"]');
    await expect(badge).toHaveClass(/bg-red-100/); // LOW
    
    // 재촬영 버튼
    await page.click('button:has-text("다시 촬영")');
  });
});
```

### 테스트 데이터 (여권 이미지)

```
fixtures/
├── passport-clear.jpg         (95점)
├── passport-slightly-blur.jpg (85점)
├── passport-tilted.jpg        (75점)
├── passport-dark.jpg          (65점)
├── passport-blurry.jpg        (45점)
├── passport-partial.jpg       (35점, 최소값 미달)
├── passport-english.jpg       (영문 여권, 95점)
└── passport-korean.jpg        (한국 여권, 95점)
```

---

## 📅 Implementation Roadmap

### Phase 2-1: Core OCR (이번)

| 날짜 | 태스크 | 담당 | 완료 |
|------|--------|------|------|
| 06-19 | 신뢰도 계산 라이브러리 | Agent-1 | - |
| 06-19 | POST /api/passport/ocr 엔드포인트 | Agent-1 | - |
| 06-20 | OcrUploadCard.tsx UI | Agent-2 | - |
| 06-20 | 폼 자동입력 로직 | Agent-2 | - |
| 06-21 | 통합테스트 (e2e) | Agent-3 | - |
| 06-21 | 배포 (Vercel) | 사용자 | - |

### Phase 2-2: 고급 기능 (다음)

| 기능 | 설명 | 우선순위 |
|------|------|---------|
| **사진 가이드** | 여권 촬영 각도/조명 실시간 피드백 | P2 |
| **배치 OCR** | 여러 고객 여권 일괄 처리 | P2 |
| **문서 크롭** | 자동 여권 영역 추출 | P1 |
| **다국어 지원** | 중국/일본 여권 | P2 |
| **OCR 캐싱** | 동일 여권 재요청 시 캐시 사용 | P3 |

---

## 🎯 Success Criteria (배포 전 체크)

```
✅ 신뢰도 점수 알고리즘 검증 (정확도 90%+ 여권에서 85점 이상)
✅ OCR 응답 시간 <3초 (Gemini 호출 포함)
✅ 폼 자동입력 <0.2초
✅ UI/UX 50대 친화적 (버튼 48px, 글자 16px)
✅ 에러 메시지 한글 100% (기술용어 제거)
✅ 보안 체크 (SSRF, 파일크기, 권한)
✅ e2e 테스트 통과 (5가지 시나리오)
✅ 배포 후 Sentry 모니터링 (에러율 0%)
```

---

## 📌 Reference

### 기존 문서
- D:\mabiz-crm\docs\passport-automation-design-20260605.md
- D:\mabiz-crm\src\lib\passport-ocr.ts (Gemini Vision 통합)

### Gemini Vision API
- Model: `gemini-2.0-flash` (기본) / `gemini-1.5-pro` (고정확)
- Max output tokens: 800 (여권 추출용)
- Temperature: 0 (일관된 출력)

### 한국 여권 포맷
- 번호: M + 8자리 숫자 (예: M12345678)
- 유효기간: 10년 (성인) / 5년 (미성년)
- MRZ (기계판독대): 하단 2줄 (백업 필드)

---

**문서 작성**: 2026-06-19  
**최종 수정**: -  
**버전**: 1.0

