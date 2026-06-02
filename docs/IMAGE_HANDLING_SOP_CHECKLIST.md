# 이미지 처리 SOP 빠른 체크리스트
**Version**: 2.0 | **Date**: 2026-06-02 | **Status**: 🟢 Ready

---

## 📋 한눈에 보는 6가지 SOP 체크리스트

### **☑️ SOP #1: 경로 오류 수정 (Route Correction)**
**기간**: 1시간 | **우선순위**: **P0** | **담당**: 개발자

#### 검토 (15분)
- [ ] `grep -r "landing-pages" src/` 실행
- [ ] 백슬래시 패턴 확인: `grep -r "api\\\\.*images"`
- [ ] 프로덕션 로그에서 404 에러 건수 확인

#### 수정 (30분)
- [ ] ImageLibraryModal.tsx 경로 변경
- [ ] `src/lib/image-upload-utils.ts` 수정
- [ ] API 라우트 정규화

#### 테스트 (20분)
- [ ] `npx tsc --noEmit` ✅ 통과
- [ ] 로컬 이미지 업로드 1회 성공
- [ ] Network 탭 URL 확인

#### 배포 (10분)
- [ ] 커밋: `fix: correct image upload API route paths`
- [ ] Vercel 배포
- [ ] 24시간 모니터링

#### 완료 기준 ✓
```
❌ 백슬래시 패턴 0개
✅ 이미지 업로드 실패율 0%
✅ TypeScript 에러 0개
```

---

### **☑️ SOP #2: 이미지 압축 (Image Compression)**
**기간**: 2-3일 | **우선순위**: **P0** | **담당**: 백엔드 + 프론트엔드

#### 설계 (30분)
- [ ] Sharp 라이브러리 설치: `npm install sharp`
- [ ] 압축 목표 확인
  - JPEG: 3-5MB → 300-500KB (85-92%)
  - PNG: 2-4MB → 400-700KB (80-85%)
  - GIF: 1-8MB → 500-2MB (50-75%, 재압축 금지)
- [ ] 포맷별 품질 설정 결정
- [ ] 성능 임팩트 분석

#### 서버 구현 (2시간)
- [ ] `src/lib/image-compression.ts` 작성 (300-400줄)
  ```typescript
  async function compressImage(buffer, mimeType, maxWidth = 1920)
  async function getCompressionStats(original, compressed)
  function getQualityByFormat(mimeType)
  ```
- [ ] API 라우트에 통합
- [ ] 에러 처리 (Sharp 실패 시 원본 사용)

#### 클라이언트 최적화 (1시간, 선택)
- [ ] `npm install browser-image-compression`
- [ ] 업로드 전 클라이언트 압축 (선택)
- [ ] 진행률 표시

#### 모니터링 (1시간)
- [ ] 압축 메트릭 API 구현
- [ ] 월별 저장소 절감액 계산 대시보드

#### 테스트 (1시간)
```bash
# 단위 테스트
npm test -- image-compression.test.ts

# 성능 테스트
# 50MB GIF 업로드 테스트
```

#### 배포
- [ ] 커밋: `feat: implement image compression (85-92% reduction)`
- [ ] 환경변수 설정
- [ ] Vercel 배포
- [ ] 24시간 모니터링

#### 완료 기준 ✓
```
✅ 평균 파일크기: 2.8MB → 0.6MB (-78%)
✅ 압축율 달성: JPEG 85%+, PNG 80%+, GIF 무손실
✅ 업로드 시간: 120s → 30s (-75%)
```

---

### **☑️ SOP #3: Drive 자동 저장 (Auto-Save to Google Drive)**
**기간**: 3-4일 | **우선순위**: **P0** | **담당**: 전체 팀

#### Google Drive 설정 (1시간)
- [ ] Google Cloud Console에서 서비스 계정 생성
- [ ] JSON 키 다운로드
- [ ] 환경변수 설정 (3개)
  ```env
  GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL=xxx@yyy.iam.gserviceaccount.com
  GOOGLE_DRIVE_PRIVATE_KEY="-----BEGIN..."
  GOOGLE_DRIVE_PROJECT_ID=xxx
  ```
- [ ] Drive 폴더 생성: `마비즈-CRM/이미지`
- [ ] 서비스 계정 권한 부여 (편집자)

#### Prisma 스키마 (30분)
- [ ] DriveFile 모델 추가
  ```prisma
  model DriveFile {
    id String @id @default(cuid())
    localFileId String?
    driveFileId String
    driveUrl String
    fileName String
    mimeType String
    size Int
    syncedAt DateTime @default(now())
    lastModified DateTime @updatedAt
    organizationId String
    createdBy String
  }
  ```
- [ ] 마이그레이션: `npx prisma migrate dev --name add_drive_file`
- [ ] 타입 생성: `npx prisma generate`

#### API 개발 (2-3시간)
- [ ] `src/lib/google-drive.ts` (300-400줄)
  ```typescript
  async function initializeDriveAuth()
  async function uploadToDrive(fileBuffer, fileName, mimeType)
  async function getFileMetadata(fileId)
  async function deleteFromDrive(fileId)
  async function getSharedLink(fileId)
  ```
- [ ] `src/app/api/drive/upload/route.ts` (POST)
- [ ] `src/app/api/drive/sync/route.ts` (GET)
- [ ] `src/app/api/cron/drive-sync/route.ts` (1분 주기)

#### UI 통합 (2시간)
- [ ] 업로드 후 진행상황 표시
  ```
  🔄 Drive에 저장 중... (1/1)
  ✅ 완료! 링크: [공유]
  ```
- [ ] "Drive 동기" 수동 버튼
- [ ] 동기 상태 표시 (✓ / ◯)

#### 테스트 (1.5시간)
- [ ] 단위 테스트: Drive API (모킹)
- [ ] 통합 테스트: 업로드 → Drive → 메타데이터
- [ ] E2E 테스트: UI에서 업로드 → Drive 확인

#### 배포
- [ ] 커밋: `feat: auto-save images to Google Drive (hybrid model)`
- [ ] 환경변수 확인 (프로덕션)
- [ ] Vercel 배포
- [ ] 24시간 모니터링

#### 완료 기준 ✓
```
✅ 자동화율: 20% → 95%+ 달성
✅ 모든 이미지 Drive에 저장 확인
✅ 파일 메타데이터 DB에 정확히 저장
```

---

### **☑️ SOP #4: 라이브러리 복수선택 (Multi-Select Image Library)**
**기간**: 1-2일 | **우선순위**: **P0** | **담당**: 프론트엔드

#### UI 설계 (30분)
- [ ] 체크박스 위치: 이미지 좌상단
- [ ] 선택 시각화: 파란색 테두리 + ✓
- [ ] 선택 카운트: "N/M 선택됨" 배지
- [ ] 전체선택/해제 토글 버튼

#### 상태 관리 (1시간)
- [ ] `useState<Set<string | number>>`
- [ ] 선택/해제 토글 함수
- [ ] 전체선택 함수
- [ ] 선택 상태 초기화 (모달 닫을 때)

#### 컴포넌트 수정 (1.5시간)
- [ ] ImageLibraryModal.tsx
  ```typescript
  const [selectedImageIds, setSelectedImageIds] = useState<Set<string|number>>(new Set());
  const toggleImageSelection = (id) => {...}
  const toggleSelectAll = () => {...}
  const insertMultipleImages = () => {...}
  ```
- [ ] ImageGrid.tsx: 체크박스 추가
- [ ] 버튼 텍스트 동적화: "✓ 선택한 이미지 3개 삽입"

#### UX 개선 (1시간)
- [ ] 시각적 피드백 (테두리, 아이콘)
- [ ] 호버 상태: 명확한 커서
- [ ] 키보드 단축키 (Ctrl+A, Shift+Click)
- [ ] 선택 확인 대화

#### 일괄 삽입 로직 (1.5시간)
```typescript
insertMultipleImages() {
  // 1. 선택 검증
  // 2. 커서 위치 기억
  // 3. 각 이미지 삽입 (순차)
  // 4. 커서 최종 조정
  // 5. 선택 상태 초기화
  // 6. 성공 토스트
}
```

#### 테스트 (1시간)
- [ ] 단위 테스트: 선택/해제 로직
- [ ] E2E: 3개 이미지 선택 → 삽입 → 본문 확인
- [ ] 엣지 케이스: 0개, 전체, 범위 선택

#### 배포
- [ ] 커밋: `feat: add multi-select image library`
- [ ] Vercel 배포
- [ ] 사용자 교육 (메일/Slack)

#### 완료 기준 ✓
```
✅ 복수 이미지 선택 UI 구현
✅ 일괄 삽입 기능 정상 작동
✅ 사용자 테스트 100% 만족 (3명 이상)
```

---

### **☑️ SOP #5: 에러 처리 강화 (Error Handling Enhancement)**
**기간**: 3-4일 | **우선순위**: **P0** | **담당**: 전체 팀

#### 에러 코드 정의 (1시간)
- [ ] `src/lib/error-codes.ts` (350-400줄)
  ```typescript
  export function getErrorResponse(code, context) {...}
  export function isRetryable(statusCode) {...}
  export function getRetryDelay(attempt) {...}
  
  export const ErrorCodes = {
    VALIDATION_ERROR: { status: 400, ... },
    PAYLOAD_TOO_LARGE: { status: 413, ... },
    SERVER_ERROR: { status: 500, ... },
    ...
  }
  ```
- [ ] 50+ 에러 코드 정의
- [ ] 각 에러마다 사용자 메시지

#### 재시도 엔진 (1.5시간)
- [ ] `src/lib/retry-engine.ts` (300-350줄)
  ```typescript
  async function retryWithExponentialBackoff(fn, options) {
    // 지수 백오프: 500ms → 1s → 2s → ...
    // 지터: ±10% 무작위 지연
    // 최대: 3회
  }
  ```
- [ ] 타입 안전 제네릭

#### UI 컴포넌트 (2시간)
- [ ] `src/components/ErrorFeedback.tsx` (400-450줄)
  ```typescript
  <ErrorFeedback /> - 인라인 (검증)
  <ErrorToast /> - 토스트 (크기 초과)
  <ErrorBanner /> - 배너 (서버)
  ```
- [ ] 자동 재시도 진행률 표시
- [ ] 색상 구분 (빨강/황색/주황색)

#### API 수정 (2-3시간)
- [ ] 기존 API 5-10개 수정 (우선순위 P0)
  ```typescript
  // Before
  return NextResponse.json({ ok: false }, { status: 500 });
  
  // After
  return NextResponse.json(
    getErrorResponse('VALIDATION_ERROR', {...}),
    { status: 400 }
  );
  ```
- [ ] 에러 로깅 (operationId)

#### Webhook 재시도 (1.5시간)
- [ ] `src/lib/webhook-retry-queue.ts` (300줄)
- [ ] DB 테이블: WebhookRetryQueue
- [ ] Cron Job: 1분마다 처리

#### 문서화 (1시간)
- [ ] ERROR_HANDLING_QUICK_START.md
- [ ] ERROR_HANDLING_IMPLEMENTATION_EXAMPLES.md
- [ ] 개발자/사용자 가이드

#### 테스트 (2시간)
- [ ] 단위 테스트: 에러 생성, 재시도
- [ ] 통합 테스트: API + UI
- [ ] E2E: 에러 → 재시도 → 성공
- [ ] 커버리지: 80% 이상

#### 배포
- [ ] 커밋: `feat: enhanced error handling (400/413/500)`
- [ ] 환경변수 설정
- [ ] Vercel 배포
- [ ] 24시간 모니터링

#### 완료 기준 ✓
```
✅ 에러 코드별 정확한 상태 구분 (400/413/500)
✅ 재시도 성공율: 0% → 85%
✅ 사용자 피드백 UI 3가지 변형 구현
✅ 지원팀 요청: 100/월 → 30/월 (-70%)
```

---

### **☑️ SOP #6: 사용자 메시지 및 진행률 (User Messaging & Progress)**
**기간**: 1-2일 | **우선순위**: **P1** | **담당**: 프론트엔드

#### 메시지 설계 (1시간)
- [ ] 단계별 메시지 20+ 작성
- [ ] 톤/스타일 가이드
  - ✓ 따뜻한 톤 ("완료했어요!")
  - ✓ 기술 용어 피하기
  - ✓ 행동 제안 포함
- [ ] 길이: 50자 이하

#### 진행률 컴포넌트 (1.5시간)
- [ ] `src/components/ProgressMessage.tsx` (200-250줄)
  ```typescript
  {
    status: 'compressing' | 'uploading' | 'saving' | 'retry' | 'success' | 'error'
    progress: number (0-100)
    message: string
    onDismiss: () => void
    duration?: number
  }
  ```
- [ ] Tailwind CSS 반응형
- [ ] 애니메이션 (부드러운 진행률)
- [ ] 색상 구분

#### 상태 관리 (1시간)
- [ ] `src/lib/progress-tracker.ts`
  ```typescript
  class ProgressTracker {
    updateStatus(status, message)
    updateProgress(percent)
    finish(message)
    error(message)
  }
  ```
- [ ] React Context (전역)
- [ ] 메시지 큐

#### 업로드 훅 (1.5시간)
- [ ] `src/hooks/useUploadProgress.ts`
  ```typescript
  {
    isUploading: boolean
    progress: number
    status: string
    message: string
    error: Error | null
    uploadFile: (file) => Promise
  }
  ```
- [ ] FileReader API + FormData
- [ ] 진행 이벤트

#### UI 통합 (1.5시간)
- [ ] ImageLibraryModal에 ProgressMessage 추가
- [ ] 단계별 메시지 (압축 → Drive → 완료)
- [ ] 진행률 바 (실시간)
- [ ] 에러 메시지 + 제안

#### 다국어 (1시간)
- [ ] i18n 파일로 분리
- [ ] 한국어 + 영어
- [ ] 사용자 설정 자동 적용

#### 테스트 (1.5시간)
- [ ] 단위 테스트: 메시지 로직
- [ ] 컴포넌트 테스트: 렌더링
- [ ] E2E: 전체 플로우

#### 배포
- [ ] 커밋: `feat: add user messaging and progress indicators`
- [ ] Vercel 배포
- [ ] 피드백 수집 (1주)

#### 완료 기준 ✓
```
✅ 메시지 20개+ 작성 및 검토
✅ 진행률 바 3가지 상태 UI
✅ 사용자 만족도: 65% → 90% (+38%)
```

---

## 🎯 전체 통합 체크리스트

### **Phase 1: 기초 (2026-06-02 ~ 2026-06-05)**
```
SOP #1 경로 오류 수정
├─ [ ] 검토 (15분)
├─ [ ] 수정 (30분)
├─ [ ] 테스트 (20분)
└─ [ ] 배포 (10분)
   Status: ⬜

SOP #5 에러 처리 (기초)
├─ [ ] 에러 코드 정의 (1시간)
├─ [ ] 재시도 엔진 (1.5시간)
└─ [ ] UI 컴포넌트 (2시간)
   Status: ⬜

SOP #6 메시지 설계
├─ [ ] 메시지 작성 (1시간)
└─ [ ] 진행률 UI 설계
   Status: ⬜
```

### **Phase 2: 확장 (2026-06-05 ~ 2026-06-10)**
```
SOP #2 이미지 압축
├─ [ ] 설계 (30분)
├─ [ ] 서버 구현 (2시간)
├─ [ ] 클라이언트 (1시간)
└─ [ ] 모니터링 (1시간)
   Status: ⬜

SOP #3 Drive 자동 저장
├─ [ ] Drive 설정 (1시간)
├─ [ ] Prisma (30분)
├─ [ ] API 개발 (2-3시간)
└─ [ ] UI 통합 (2시간)
   Status: ⬜

SOP #4 라이브러리 복수선택
├─ [ ] UI 설계 (30분)
├─ [ ] 상태 관리 (1시간)
└─ [ ] 컴포넌트 (1.5시간)
   Status: ⬜
```

### **Phase 3: 최적화 (2026-06-10 ~ 2026-06-15)**
```
SOP #5 고도화
├─ [ ] API 수정 (2-3시간)
├─ [ ] Webhook 재시도 (1.5시간)
└─ [ ] 모니터링 (1시간)
   Status: ⬜

SOP #6 배포 준비
├─ [ ] 다국어 (1시간)
└─ [ ] 피드백 수집
   Status: ⬜
```

### **Phase 4: 배포 (2026-06-15 ~ 2026-06-20)**
```
[ ] 최종 통합 테스트
[ ] 프로덕션 배포
[ ] 24시간 모니터링
[ ] 사용자 교육
```

---

## 📊 완료 확인 매트릭스

| SOP | 우선순위 | 기간 | 담당 | 검토 | 수정 | 테스트 | 배포 | 상태 |
|-----|---------|------|------|------|------|--------|------|------|
| #1 경로 | **P0** | 1h | 개발 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| #2 압축 | **P0** | 2-3d | 백엔드 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| #3 Drive | **P0** | 3-4d | 전체 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| #4 복수 | **P0** | 1-2d | 프론트 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| #5 에러 | **P0** | 3-4d | 전체 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| #6 메시지 | **P1** | 1-2d | 프론트 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |

---

## 🎯 성과 목표 체크리스트

### **정량 목표**
```
파일크기 감소
├─ [ ] Before: 2.8MB
├─ [ ] After: 0.6MB
└─ [ ] 달성도: -78% ✅

업로드 시간
├─ [ ] Before: 120s
├─ [ ] After: 30s
└─ [ ] 달성도: -75% ✅

저장소 비용
├─ [ ] Before: $3,000/월
├─ [ ] After: $1,800/월
└─ [ ] 달성도: -40% ✅

자동화율
├─ [ ] Before: 20%
├─ [ ] After: 95%+
└─ [ ] 달성도: +375% ✅

사용자 만족도
├─ [ ] Before: 65%
├─ [ ] After: 90%
└─ [ ] 달성도: +38% ✅

지원팀 요청
├─ [ ] Before: 100/월
├─ [ ] After: 30/월
└─ [ ] 달성도: -70% ✅
```

### **정성 목표**
```
[ ] 사용자 경험 개선 (신뢰도 증대)
[ ] 운영 부담 감소 (자동화)
[ ] 데이터 안정성 증대 (Cloud 백업)
[ ] 개발자 생산성 증대 (표준화)
```

---

## 🚀 즉시 실행 가이드

### **오늘 할 일 (2026-06-02)**
```bash
# 1. SOP 문서 리뷰 (30분)
cat docs/IMAGE_HANDLING_SOP.md

# 2. 담당자 배정 (30분)
# - SOP #1: 개발자
# - SOP #2: 백엔드
# - SOP #3: 전체 팀 리더
# - SOP #4: 프론트엔드
# - SOP #5: 개발자
# - SOP #6: 프론트엔드

# 3. SOP #1 시작 (1시간)
grep -r "landing-pages" src/
```

### **이번주 할 일**
```bash
# Phase 1 완료 (SOP #1, #5 기초, #6 설계)
npm run tsc --noEmit

# 팀 미팅 (진행 상황 공유)
# 예상: 이번주 내 50% 완료
```

### **다음주 할 일**
```bash
# Phase 2 시작 (SOP #2, #3, #4)
# 병렬 진행 (3개 팀 동시)
# 예상: 다음주 내 80% 완료
```

---

**마지막 업데이트**: 2026-06-02  
**버전**: 2.0  
**상태**: 🟢 프로덕션 준비 완료

