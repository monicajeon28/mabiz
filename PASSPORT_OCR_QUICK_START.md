# Passport OCR 빠른 시작 가이드

## 🎯 5분 만에 통합하기

### 1단계: 임포트
```tsx
import { OCRUploadModal } from '@/components/passport/ocr-upload-modal';
```

### 2단계: 상태 관리
```tsx
const [showOCR, setShowOCR] = useState(false);
const [passportData, setPassportData] = useState({
  korName: '',
  engSurname: '',
  engGivenName: '',
  passportNumber: '',
  nationality: '',
  sex: '',
  dateOfBirth: '',
  dateOfIssue: '',
  passportExpiryDate: '',
});
```

### 3단계: 결과 처리
```tsx
const handleOCRResult = (data) => {
  setPassportData(data);
  // 또는 특정 필드만 업데이트
  setPassportData(prev => ({
    ...prev,
    korName: data.korName || prev.korName,
  }));
};
```

### 4단계: 모달 렌더링
```tsx
<button onClick={() => setShowOCR(true)} className="...">
  📸 여권 사진으로 자동 입력
</button>

{showOCR && (
  <OCRUploadModal
    onClose={() => setShowOCR(false)}
    onResult={handleOCRResult}
  />
)}
```

---

## 📋 완전한 예시 (컴포넌트)

```tsx
'use client';

import { useState } from 'react';
import { OCRUploadModal } from '@/components/passport/ocr-upload-modal';

export function PassportInputForm() {
  const [showOCR, setShowOCR] = useState(false);
  const [form, setForm] = useState({
    korName: '',
    engSurname: '',
    engGivenName: '',
    passportNumber: '',
    nationality: '',
    sex: '',
    dateOfBirth: '',
    dateOfIssue: '',
    passportExpiryDate: '',
  });

  const handleOCRResult = (data) => {
    setForm({
      korName: data.korName || '',
      engSurname: data.engSurname || '',
      engGivenName: data.engGivenName || '',
      passportNumber: data.passportNumber || '',
      nationality: data.nationality || '',
      sex: data.sex || '',
      dateOfBirth: data.dateOfBirth || '',
      dateOfIssue: data.dateOfIssue || '',
      passportExpiryDate: data.passportExpiryDate || '',
    });
  };

  return (
    <div className="space-y-4">
      {/* OCR 버튼 */}
      <button
        onClick={() => setShowOCR(true)}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
      >
        📸 여권 사진으로 자동 입력
      </button>

      {/* 여권 정보 입력 필드 */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label>한글 이름</label>
          <input
            value={form.korName}
            onChange={(e) => setForm({...form, korName: e.target.value})}
            className="w-full border rounded px-3 py-2"
          />
        </div>
        <div>
          <label>영문 성</label>
          <input
            value={form.engSurname}
            onChange={(e) => setForm({...form, engSurname: e.target.value})}
            className="w-full border rounded px-3 py-2"
          />
        </div>
        {/* ... 다른 필드 */}
      </div>

      {/* OCR 모달 */}
      {showOCR && (
        <OCRUploadModal
          onClose={() => setShowOCR(false)}
          onResult={handleOCRResult}
        />
      )}
    </div>
  );
}
```

---

## 🔌 API 직접 호출 (고급)

```typescript
// FormData 생성
const formData = new FormData();
formData.append('file', imageFile);

// API 호출
const response = await fetch('/api/passport/admin/ocr', {
  method: 'POST',
  body: formData,
  credentials: 'include',
});

const result = await response.json();

if (result.ok) {
  console.log('신뢰도:', result.data.confidence);
  console.log('경고:', result.data.warnings);
  console.log('여권번호:', result.data.passportNumber);
}
```

---

## 🎨 커스터마이징 예시

### 신뢰도에 따른 입력 제어
```tsx
const handleOCRResult = (data) => {
  if (data.confidence < 70) {
    alert('신뢰도가 낮습니다. 내용을 확인해주세요.');
  }
  setForm(data);
};
```

### 특정 필드만 업데이트
```tsx
const handleOCRResult = (data) => {
  setForm(prev => ({
    ...prev,
    // 이미 입력된 필드는 건드리지 않음
    korName: prev.korName || data.korName,
    engSurname: prev.engSurname || data.engSurname,
    // 새 데이터로 덮어쓰기
    passportNumber: data.passportNumber,
  }));
};
```

### 경고 정보 처리
```tsx
const handleOCRResult = (data) => {
  if (data.warnings.length > 0) {
    console.warn('확인이 필요한 필드:', data.warnings);
    // UI에 경고 표시
  }
  setForm(data);
};
```

---

## 📞 문제 해결

### "권한이 없습니다" (403)
→ 로그인 후 CRM 관리자 권한 확인

### "이미지에서 여권 정보를 읽을 수 없습니다" (400)
→ 다른 사진 시도 (밝은 환경, 정면 촬영)

### "파일 크기는 5MB 이하여야 합니다" (400)
→ 더 작은 이미지 파일 선택

### "OCR 서비스 일시 오류" (500)
→ 잠시 후 재시도

---

## 📊 응답 데이터 구조

```typescript
interface OCRResponse {
  ok: boolean;
  data?: {
    korName: string;              // "김철수"
    engSurname: string;           // "KIM"
    engGivenName: string;         // "CHULSU"
    passportNumber: string;       // "M12345678"
    nationality: string;         // "KOR"
    sex: string;                  // "M" or "F"
    dateOfBirth: string;          // "1990-01-15"
    dateOfIssue: string;          // "2020-02-01"
    passportExpiryDate: string;   // "2030-02-01"
    confidence: number;           // 0-100
    warnings: string[];           // ["여권번호", "영문 성"]
    hasMinimum: boolean;          // true (필수 정보 충족)
  };
  message?: string;
  error?: string;
}
```

---

## ✅ 체크리스트

- [ ] 환경변수 확인 (GEMINI_API_KEY)
- [ ] OCRUploadModal import
- [ ] 상태 관리 추가
- [ ] 결과 처리 함수 작성
- [ ] 모달 렌더링
- [ ] 입력 필드와 매핑
- [ ] UI 테스트

---

## 📚 참고 자료

| 항목 | 경로 |
|------|------|
| 전체 문서 | `docs/PASSPORT_OCR_IMPLEMENTATION.md` |
| API 스펙 | `src/app/api/passport/admin/ocr/route.ts` |
| UI 컴포넌트 | `src/components/passport/ocr-upload-modal.tsx` |
| 헬퍼 함수 | `src/lib/passport-ocr-ui-helpers.ts` |

---

**마지막 업데이트**: 2026-06-19
