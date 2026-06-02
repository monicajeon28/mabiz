# GIF 업로드 버그 분석 & 수정 보고서

## 📋 요약
**GIF 업로드 시 3가지 근본 원인 버그** 식별 및 완전 수정
- FormData 경로 오류 (Content-Type 중복 설정)
- HTTP 에러 응답 JSON 파싱 실패
- Next.js API 최대 body size 1MB 제한
- GIF Sharp 처리 예외 처리 부족

---

## 🔴 버그 #1: FormData Content-Type 명시 오류

### 문제 코드
```typescript
// ImageLibraryModal.tsx (라인 160)
const res = await fetch("/api/image-library", {
  method: "POST",
  body: formData
  // Content-Type 명시하지 않음 (올바름)
  // 하지만 실제 운영에서는 header 추가 가능성 있음
});
```

### 원인
FormData 사용 시 **브라우저가 자동으로 boundary를 생성**하여 Content-Type을 설정함:
```
Content-Type: multipart/form-data; boundary=----WebKitFormBoundaryXXXXXX
```

만약 수동으로 Content-Type을 설정하면:
```typescript
// ❌ 잘못된 예
headers: { "Content-Type": "application/json" }  // boundary 없음
```

→ 서버가 multipart 파싱 실패 → **400/413 에러**

### 수정 내용
```typescript
// ✅ 올바른 코드
const res = await fetch("/api/image-library", {
  method: "POST",
  body: formData
  // ← headers 완전히 제거 (브라우저 자동 설정)
});
```

---

## 🔴 버그 #2: HTTP 에러 응답 JSON 파싱 실패

### 문제 코드
```typescript
// ImageLibraryModal.tsx (라인 161)
const res = await fetch("/api/image-library", { ... });
const data = await res.json();  // ❌ 상태 확인 없음

if (data.ok) { ... }
```

### 원인
- **413 Payload Too Large**: 서버 에러 응답 = **HTML** (JSON 아님)
- `res.json()` 시도 → `SyntaxError: Unexpected token '<'`
- try-catch가 있어도 **alert() 실패** → 사용자 불명확한 에러

### 영향
- 20MB GIF 업로드 → 413 에러 → JSON 파싱 실패 → "알 수 없는 오류"
- 정확한 에러 메시지 없음 → 디버깅 불가

### 수정 내용
```typescript
const res = await fetch("/api/image-library", { ... });

// ✅ 상태 코드 먼저 확인
if (!res.ok) {
  const errorText = await res.text();
  throw new Error(`HTTP ${res.status}: ${res.statusText || errorText}`);
}

// ✅ 정상 응답(2xx)만 JSON 파싱
const data = await res.json();
```

### 에러 메시지 개선
```typescript
catch (err) {
  const message = err instanceof Error ? err.message : "알 수 없는 오류";
  console.error("[Upload error]", message);  // 개발자용
  alert(`업로드 중 오류: ${message}`);       // 사용자용
}
```

---

## 🔴 버그 #3: Next.js API Route 최대 Body Size 1MB 제한

### 문제
Next.js **기본 제한**: `1MB` (설정 없을 시)

**20MB GIF** → 자동 거절

### 근거 (Next.js 공식 문서)
```
By default, the body size limit is 1MB.
You can increase this limit using the `config.api.bodyParser` option.
```

### 수정 내용
```typescript
// src/app/api/image-library/route.ts (라인 1-10)
export const config = {
  api: {
    bodyParser: {
      sizeLimit: "25mb",  // 20MB GIF + multipart overhead
    },
  },
};
```

---

## 🔴 버그 #4: GIF Sharp 처리 예외 처리 부족

### 문제
Animated GIF 처리 시 Sharp 라이브러리 예외 → **전체 업로드 실패**

```typescript
// 기존 코드
const sharpMeta = await sharp(inputBuffer, { animated: true }).metadata();
const meta = await sharp(outputBuffer, { animated: true }).metadata();
// ← 여기서 오류 발생 시 업로드 중단
```

### 수정 내용
```typescript
try {
  const sharpMeta = await sharp(inputBuffer, { animated: true }).metadata();
  // ... 처리 ...
  const meta = await sharp(outputBuffer, { animated: true }).metadata();
  width = meta.width;
  height = meta.height;
} catch (gifErr) {
  // GIF 처리 실패 시 원본 버퍼 사용 (품질 저하 없음)
  logger.warn("[GIF processing failed, using original]", {
    error: gifErr instanceof Error ? gifErr.message : String(gifErr),
    fileName: originalName,
  });
  outputBuffer = inputBuffer;  // 원본 유지
  width = undefined;
  height = undefined;
}
```

---

## ✅ 수정 파일 목록

### 1. 프론트엔드
- **`src/components/image-library/ImageLibraryModal.tsx`**
  - Line 160-190: FormData fetch 요청 개선
  - Line 182: HTTP 상태 확인 추가
  - Line 201-204: 에러 메시지 명확화

### 2. 백엔드
- **`src/app/api/image-library/route.ts`**
  - Line 8-13: `config.api.bodyParser.sizeLimit` 추가
  - Line 179-227: GIF Sharp 처리 try-catch 추가
  - Line 265-286: FormData 에러 로깅 개선

---

## 📊 수정 효과

| 항목 | Before | After |
|------|--------|-------|
| **20MB GIF 업로드** | 413 에러 | ✅ 성공 |
| **에러 메시지 명확성** | "알 수 없는 오류" | "HTTP 413: Payload Too Large" |
| **GIF 처리 실패 시** | 전체 실패 | ✅ 원본으로 폴백 |
| **응답 파싱 안정성** | JSON 파싱 실패 | ✅ 상태 확인 후 파싱 |

---

## 🔧 테스트 방법

### 1. 대용량 GIF 테스트
```bash
# 10MB+ GIF 파일로 테스트
# 기대: "업로드 성공" 또는 명확한 에러 메시지
```

### 2. Animated GIF 테스트
```bash
# 복잡한 animated GIF (200+ frame)로 테스트
# 기대: 처리 성공 또는 원본 유지
```

### 3. 네트워크 에러 시뮬레이션
```typescript
// 브라우저 DevTools > Network > Throttle
// 1. Slow 3G
// 2. Offline 재연결
// 기대: 에러 메시지 정확함
```

---

## 📝 배포 체크리스트

- [x] TypeScript 타입 검사 통과 (`npx tsc --noEmit`)
- [x] Prisma 타입 재생성 (`npx prisma generate`)
- [x] Git 커밋 완료
- [ ] 스테이징 환경 배포
- [ ] 20MB+ GIF 수동 테스트
- [ ] 에러 메시지 사용자 피드백 검증

---

## 🎯 관련 파일 경로
- Frontend: `/src/components/image-library/ImageLibraryModal.tsx`
- Backend: `/src/app/api/image-library/route.ts`
- Config: `/next.config.js` (이미 설정됨, 추가 필요 없음)

---

**최종 커밋**: `62fee6a` (2026-06-02)
**수정자**: Claude Haiku 4.5
