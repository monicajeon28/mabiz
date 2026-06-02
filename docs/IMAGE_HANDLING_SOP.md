# 이미지 처리 통합 SOP (Standard Operating Procedure)
**Version**: 2.0 | **Date**: 2026-06-02 | **Status**: 🟢 Production Ready

---

## 📋 개요

이 SOP는 마비즈 CRM에서 이미지 업로드, 압축, 자동 저장, 라이브러리 관리를 위한 **6가지 핵심 영역**의 표준 절차를 정의합니다.

**기대 효과**:
- 월 저장소 비용 40% 절감 ($1,200 → $720/월)
- 업로드 시간 75% 단축 (120s → 30s)
- 자동화율 95% 달성 (수동작업 5% → 0%)
- 사용자 만족도 38% 증대 (65% → 90%)

---

## 📊 6가지 핵심 영역 (도메인별 SOP)

### **SOP #1: 경로 오류 수정 (Route Correction)**

#### 문제 정의
- 현재: `/api\landing-pages\images` (백슬래시 혼용)
- 목표: `/api/landing-pages/images` (정확한 슬래시)
- 영향: 이미지 업로드 실패, 404 에러, 사용자 혼란

#### 수정 범위
| 파일 | 수정 대상 | 우선순위 |
|------|---------|---------|
| `src/components/image-library/ImageLibraryModal.tsx` | fetch URL 경로 | **P0** |
| `src/lib/image-upload-utils.ts` | 경로 구성 로직 | **P0** |
| `src/app/api/landing-pages/images/route.ts` | API 경로 정의 | **P0** |
| `src/app/(dashboard)/landing-pages/page.tsx` | 클라이언트 코드 | **P1** |
| 테스트 파일들 | 경로 검증 | **P1** |

#### 체크리스트

- [ ] **검토 단계** (15분)
  - [ ] 현재 모든 경로를 Grep으로 검색: `grep -r "landing-pages" src/`
  - [ ] 백슬래시 혼용 패턴 식별: `grep -r "api\\\\.*images" src/`
  - [ ] 프로덕션 로그 확인: 최근 이미지 업로드 실패 건수
  - [ ] **체크 기준**: 백슬래시 패턴 0개 확인

- [ ] **수정 단계** (30분)
  - [ ] ImageLibraryModal.tsx의 fetch URL을 `/api/landing-pages/images`로 수정
  - [ ] 경로 구성 함수를 URL.pathname 또는 path.join 사용으로 변경
  - [ ] API 라우트 핸들러 확인 및 정규화
  - [ ] 동적 경로 세그먼트 검증
  - [ ] **체크 기준**: 모든 수정 파일에서 백슬래시 0개

- [ ] **테스트 단계** (20분)
  - [ ] TypeScript 컴파일: `npx tsc --noEmit` ✅
  - [ ] 로컬 테스트: 이미지 업로드 1회 성공
  - [ ] Network 탭에서 요청 URL 확인 (경로 정확성)
  - [ ] 성공 응답: HTTP 200 + 이미지 URL 반환
  - [ ] **체크 기준**: 테스트 3회 연속 성공

- [ ] **배포 단계** (10분)
  - [ ] 커밋: `fix: correct image upload API route paths`
  - [ ] PR 생성 및 리뷰
  - [ ] Vercel 배포 자동화
  - [ ] 프로덕션 로그 모니터링 (24시간)
  - [ ] **체크 기준**: 이미지 업로드 실패율 0%

#### 담당자 및 완료 일정
| 단계 | 담당자 | 예정일 | 완료일 | 상태 |
|------|--------|--------|--------|------|
| 검토 | 개발자 | 2026-06-02 | __ | ⬜ |
| 수정 | 개발자 | 2026-06-02 | __ | ⬜ |
| 테스트 | QA | 2026-06-02 | __ | ⬜ |
| 배포 | DevOps | 2026-06-02 | __ | ⬜ |

---

### **SOP #2: 이미지 압축 (Image Compression)**

#### 문제 정의
- 현재: 원본 사이즈 그대로 저장 (평균 2.8MB)
- 목표: 포맷별 압축 (GIF 유지, JPEG 300-500KB, PNG 400-700KB)
- 영향: 저장소 비용, 업로드 속도, 대역폭 사용

#### 압축 목표 (포맷별)

| 포맷 | 원본 크기 | 목표 크기 | 압축율 | 설정값 |
|------|---------|---------|--------|--------|
| **JPEG (사진)** | 3-5 MB | 300-500 KB | 85-92% | quality: 80, mozjpeg: true |
| **PNG (스크린샷)** | 2-4 MB | 400-700 KB | 80-85% | quality: 75, lossless: true |
| **GIF (애니메이션)** | 1-8 MB | 500-2 MB | 50-75% | **재압축 금지** (원본 유지) |
| **WebP (최적화)** | 1-3 MB | 200-400 KB | 90-95% | quality: 85 (미래용) |

#### 구현 범위

| 파일 | 기능 | 우선순위 |
|------|------|---------|
| `src/lib/image-compression.ts` | Sharp 기반 압축 엔진 | **P0** |
| `src/app/api/image-library/route.ts` | 업로드 시 자동 압축 | **P0** |
| `src/components/image-library/ImageLibraryModal.tsx` | 클라이언트 최적화 (선택) | **P1** |
| `src/lib/browser-image-compression-utils.ts` | 브라우저 압축 (선택) | **P2** |

#### 체크리스트

- [ ] **설계 및 검토** (30분)
  - [ ] Sharp 라이브러리 확인: `npm list sharp`
  - [ ] 현재 이미지 통계 수집: 포맷별 평균 크기
  - [ ] 압축 전략 결정: 손실/무손실 기준 설정
  - [ ] 성능 임팩트 분석: CPU/메모리 사용량 예측
  - [ ] **체크 기준**: 압축 설정 3가지 이상 정의

- [ ] **서버 압축 구현** (2시간)
  - [ ] `src/lib/image-compression.ts` 작성
    ```typescript
    // 필수 함수
    async function compressImage(buffer, mimeType, maxWidth = 1920)
    async function getCompressionStats(original, compressed)
    function getQualityByFormat(mimeType)
    ```
  - [ ] API 라우트에 압축 로직 통합
  - [ ] 에러 처리 (Sharp 실패 시 원본 사용)
  - [ ] 압축 통계 로깅 (DB 저장용)
  - [ ] **체크 기준**: JPEG/PNG/GIF 각 1개씩 테스트

- [ ] **클라이언트 최적화** (1시간, 선택)
  - [ ] `browser-image-compression` 라이브러리 설치
  - [ ] 업로드 전 클라이언트 압축 (선택적)
  - [ ] 진행률 표시 (Compression in progress...)
  - [ ] 사용자 피드백: 원본 vs 압축 크기 비교
  - [ ] **체크 기준**: 파일 크기 50% 이상 감소

- [ ] **모니터링 대시보드** (1시간)
  - [ ] 압축 메트릭 수집 API
  - [ ] 월별 저장소 절감액 계산
  - [ ] 포맷별 평균 압축율 추적
  - [ ] 이상 감지 알림 (압축 실패율 > 5%)
  - [ ] **체크 기준**: 대시보드에서 실시간 메트릭 확인

- [ ] **테스트 및 검증** (1시간)
  - [ ] 단위 테스트: 포맷별 압축 함수
    ```typescript
    test('JPEG compression: 3MB → 400KB', ...)
    test('PNG compression: 2MB → 500KB', ...)
    test('GIF: 무손실 유지 (재압축 금지)', ...)
    ```
  - [ ] 통합 테스트: 업로드 → 압축 → 저장
  - [ ] 성능 테스트: 대용량 이미지 (50MB)
  - [ ] 품질 확인: 압축 이미지 시각적 검증
  - [ ] **체크 기준**: 모든 테스트 통과, 품질 기준 충족

- [ ] **배포 및 모니터링** (30분)
  - [ ] 커밋: `feat: implement image compression (85-92% reduction)`
  - [ ] 환경변수 설정: 압축 품질 설정값
  - [ ] Vercel 배포
  - [ ] 24시간 모니터링 (압축율, CPU, 에러율)
  - [ ] **체크 기준**: 실제 압축율 목표치 이상 달성

#### 담당자 및 완료 일정
| 단계 | 담당자 | 예정일 | 완료일 | 상태 |
|------|--------|--------|--------|------|
| 설계 | 아키텍트 | 2026-06-02 | __ | ⬜ |
| 서버 구현 | 백엔드 | 2026-06-03 | __ | ⬜ |
| 클라이언트 | 프론트엔드 | 2026-06-04 | __ | ⬜ |
| 모니터링 | DevOps | 2026-06-04 | __ | ⬜ |
| 배포 | DevOps | 2026-06-05 | __ | ⬜ |

---

### **SOP #3: Drive 자동 저장 (Auto-Save to Google Drive)**

#### 문제 정의
- 현재: 이미지 로컬 저장만 (클라우드 백업 없음)
- 목표: 업로드 후 자동으로 Google Drive에 저장
- 영향: 데이터 손실 방지, 백업 자동화, 버전 관리

#### 아키텍처 선택: **옵션 C (하이브리드)** - 권장
- 중요 문서만 자동화 (계약서, 여권)
- 나머지는 수동 "Drive 동기" 버튼 제공
- 자동화율 달성 목표: **95%+**

#### 구현 범위

| 파일 | 기능 | 우선순위 |
|------|------|---------|
| `src/lib/google-drive.ts` | Drive API 래퍼 (Service Account) | **P0** |
| `src/app/api/drive/upload/route.ts` | Drive 업로드 API | **P0** |
| `src/app/api/drive/sync/route.ts` | 동기화 엔드포인트 | **P0** |
| `src/app/api/cron/drive-sync/route.ts` | 1분 주기 Cron | **P1** |
| `src/lib/drive-metadata.ts` | 파일 메타데이터 관리 | **P1** |
| Prisma schema | DriveFile 모델 추가 | **P0** |

#### 체크리스트

- [ ] **Google Drive 설정** (1시간)
  - [ ] Google Cloud Console에서 서비스 계정 생성
  - [ ] JSON 키 다운로드 및 환경변수 설정
    ```env
    GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL=xxx@yyy.iam.gserviceaccount.com
    GOOGLE_DRIVE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
    GOOGLE_DRIVE_PROJECT_ID=xxx
    ```
  - [ ] Google Drive에 조직 공용 폴더 생성 (`마비즈-CRM/이미지`)
  - [ ] 서비스 계정 권한 부여 (편집자)
  - [ ] **체크 기준**: 권한 정상 부여, 테스트 파일 업로드 성공

- [ ] **Prisma 스키마 업데이트** (30분)
  - [ ] DriveFile 모델 추가
    ```prisma
    model DriveFile {
      id              String @id @default(cuid())
      localFileId     String? // 로컬 파일 ID 참조
      driveFileId     String  // Google Drive File ID
      driveUrl        String  // Drive 공유 링크
      fileName        String
      mimeType        String
      size            Int
      syncedAt        DateTime @default(now())
      lastModified    DateTime @updatedAt
      organizationId  String
      createdBy       String
      
      @@unique([localFileId, organizationId])
      @@index([organizationId])
      @@index([syncedAt])
    }
    ```
  - [ ] 마이그레이션: `npx prisma migrate dev --name add_drive_file`
  - [ ] Prisma 타입 생성: `npx prisma generate`
  - [ ] **체크 기준**: 스키마 유효성 검사 통과

- [ ] **Drive API 라이브러리** (2시간)
  - [ ] `src/lib/google-drive.ts` 작성 (300-400줄)
    ```typescript
    // 필수 함수
    export async function initializeDriveAuth()
    export async function uploadToDrive(fileBuffer, fileName, mimeType, folderId?)
    export async function getFileMetadata(fileId)
    export async function createOrUpdateFile(...)
    export async function deleteFromDrive(fileId)
    export async function getSharedLink(fileId)
    
    // 에러 처리
    class DriveError extends Error {...}
    function handleDriveError(error) {...}
    ```
  - [ ] 인증 토큰 캐싱 (메모리)
  - [ ] 재시도 로직 (지수 백오프, 3회)
  - [ ] 타임아웃 설정 (15초)
  - [ ] **체크 기준**: 단위 테스트 100% 통과

- [ ] **업로드 API 구현** (1.5시간)
  - [ ] `src/app/api/drive/upload/route.ts` 작성 (POST)
    ```typescript
    // Request body
    {
      fileBuffer: Buffer
      fileName: string
      mimeType: string
      localFileId?: string
      documentType: 'contract' | 'passport' | 'report' | 'image'
    }
    
    // Response
    {
      success: boolean
      fileId: string
      driveUrl: string
      syncedAt: string
      size: number
    }
    ```
  - [ ] 문서 타입별 폴더 자동 분류
  - [ ] 중복 파일 감지 (MD5 해시)
  - [ ] 메타데이터 DB 저장
  - [ ] **체크 기준**: 테스트 3회 연속 성공

- [ ] **Cron 동기화 구현** (1시간)
  - [ ] `src/app/api/cron/drive-sync/route.ts` (1분 주기)
    ```typescript
    // 로직
    1. 미동기 이미지 조회 (syncedAt = null)
    2. 배치 처리 (1회 최대 10개)
    3. Drive 업로드
    4. DriveFile 레코드 생성
    5. 통계 로깅
    ```
  - [ ] 스케줄러 설정: `/(cron)/drive-sync` (1분)
  - [ ] 동시 실행 방지 (Lock 메커니즘)
  - [ ] 실패 재시도 (Day 0/1/3/7)
  - [ ] **체크 기준**: Cron 자동 실행, 로그 확인

- [ ] **메타데이터 관리** (1시간)
  - [ ] 파일 미리보기 URL 생성
  - [ ] 버전 이력 추적 (Drive 기능)
  - [ ] 공유 권한 관리
  - [ ] 삭제 정책 (로컬 삭제 시 Drive 유지)
  - [ ] **체크 기준**: 메타데이터 DB에 정확히 저장

- [ ] **UI 통합** (2시간)
  - [ ] 업로드 후 진행상황 표시
    ```
    🔄 Drive에 저장 중... (1/1 완료)
    ✅ 성공! 링크: [공유 링크]
    ```
  - [ ] "Drive 동기" 수동 버튼 추가
  - [ ] 동기 상태 표시 (동기됨 ✓ / 미동기 ◯)
  - [ ] **체크 기준**: UI에서 모든 상태 확인 가능

- [ ] **테스트 및 검증** (1.5시간)
  - [ ] 단위 테스트: Drive API 함수 (모킹)
  - [ ] 통합 테스트: 업로드 → Drive 저장 → 메타데이터
  - [ ] E2E 테스트: UI에서 "업로드" 클릭 → Drive 확인
  - [ ] 성능 테스트: 100개 동시 Cron 실행
  - [ ] **체크 기준**: 모든 테스트 통과, Drive에 파일 실제 저장

- [ ] **배포 및 모니터링** (1시간)
  - [ ] 환경변수 확인 (프로덕션)
  - [ ] Drive 폴더 권한 확인
  - [ ] 커밋: `feat: auto-save images to Google Drive (hybrid model)`
  - [ ] Vercel 배포
  - [ ] 24시간 모니터링 (동기율, 실패율, 용량)
  - [ ] **체크 기준**: 자동화율 95%+ 달성

#### 담당자 및 완료 일정
| 단계 | 담당자 | 예정일 | 완료일 | 상태 |
|------|--------|--------|--------|------|
| Drive 설정 | DevOps | 2026-06-02 | __ | ⬜ |
| Prisma | DBA | 2026-06-02 | __ | ⬜ |
| API 개발 | 백엔드 | 2026-06-03~04 | __ | ⬜ |
| UI 통합 | 프론트엔드 | 2026-06-04~05 | __ | ⬜ |
| 테스트 | QA | 2026-06-05 | __ | ⬜ |
| 배포 | DevOps | 2026-06-06 | __ | ⬜ |

---

### **SOP #4: 라이브러리 복수선택 (Multi-Select Image Library)**

#### 문제 정의
- 현재: 1개씩만 선택 가능 (비효율)
- 목표: 복수 선택 후 일괄 삽입
- 영향: 이메일 템플릿 작성 시간 30-40% 단축

#### 구현 범위

| 파일 | 기능 | 우선순위 |
|------|------|---------|
| `src/components/image-library/ImageLibraryModal.tsx` | 체크박스 UI | **P0** |
| `src/components/image-library/ImageGrid.tsx` | 이미지 선택 상태 | **P0** |
| `src/lib/image-selection.ts` | 선택 상태 관리 (선택) | **P1** |

#### 체크리스트

- [ ] **UI 설계** (30분)
  - [ ] 체크박스 위치: 이미지 좌상단 (Tailwind absolute)
  - [ ] 선택 상태 시각화: 파란색 테두리 + ✓ 아이콘
  - [ ] 선택 카운트 표시: "N/M 선택됨"
  - [ ] 전체선택/해제 토글 버튼
  - [ ] **체크 기준**: 디자인 3가지 이상 Figma에서 검토

- [ ] **상태 관리** (1시간)
  - [ ] React Hook 구현: `useState<Set<string | number>>`
  - [ ] 선택/해제 토글 함수
  - [ ] 전체선택 함수
  - [ ] 선택 상태 초기화 (모달 닫을 때)
  - [ ] **체크 기준**: TypeScript 타입 검사 100% 통과

- [ ] **컴포넌트 수정** (1.5시간)
  - [ ] ImageLibraryModal.tsx
    ```typescript
    // 추가 상태
    const [selectedImageIds, setSelectedImageIds] = useState<Set<string|number>>(new Set());
    
    // 함수들
    const toggleImageSelection = (id) => {...}
    const toggleSelectAll = () => {...}
    const insertMultipleImages = () => {...}
    ```
  - [ ] ImageGrid.tsx: 각 이미지에 선택 체크박스
  - [ ] 버튼 텍스트 동적화: "✓ 선택한 이미지 3개 삽입"
  - [ ] **체크 기준**: 모든 선택/해제 기능 동작 확인

- [ ] **UX 개선** (1시간)
  - [ ] 선택 이미지에 시각적 피드백 (테두리, 아이콘)
  - [ ] 호버 상태: 명확한 커서 변화
  - [ ] 키보드 단축키 (선택)
    - `Ctrl+A`: 전체 선택
    - `Shift+Click`: 범위 선택
  - [ ] 선택 확인 대화: "3개 이미지를 삽입하시겠습니까?"
  - [ ] **체크 기준**: 사용자 테스트 3명 이상 100% 만족

- [ ] **일괄 삽입 로직** (1.5시간)
  - [ ] insertMultipleImages() 함수
    ```typescript
    // 로직
    1. 선택 검증 (0개면 에러)
    2. 커서 위치 기억
    3. 각 이미지마다 삽입 (순차)
    4. 커서 최종 위치 조정
    5. 선택 상태 초기화
    6. 성공 토스트
    ```
  - [ ] 커서 위치 정확성 검증
  - [ ] 이미지 사이 줄바꿈 처리
  - [ ] 에러 처리 (삽입 실패 시 롤백)
  - [ ] **체크 기준**: 3-5개 이미지 삽입 테스트 통과

- [ ] **테스트** (1시간)
  - [ ] 단위 테스트: 선택/해제 로직
  - [ ] 통합 테스트: UI + 삽입 로직
  - [ ] E2E 테스트: 3개 이미지 선택 → 삽입 → 본문 확인
  - [ ] 엣지 케이스: 0개 선택, 전체 선택, 범위 선택
  - [ ] **체크 기준**: 모든 테스트 통과

- [ ] **배포** (30분)
  - [ ] 커밋: `feat: add multi-select image library (30-40% time save)`
  - [ ] PR 리뷰
  - [ ] Vercel 배포
  - [ ] 사용자 교육 (메일/Slack)
  - [ ] **체크 기준**: 프로덕션에서 정상 동작 확인

#### 담당자 및 완료 일정
| 단계 | 담당자 | 예정일 | 완료일 | 상태 |
|------|--------|--------|--------|------|
| 설계 | UX디자인 | 2026-06-02 | __ | ⬜ |
| 구현 | 프론트엔드 | 2026-06-03 | __ | ⬜ |
| 테스트 | QA | 2026-06-04 | __ | ⬜ |
| 배포 | DevOps | 2026-06-04 | __ | ⬜ |

---

### **SOP #5: 에러 처리 강화 (Error Handling Enhancement)**

#### 문제 정의
- 현재: 모든 에러를 500으로 응답 (정보 부족)
- 목표: 상태 코드별 정확한 에러 (400/413/500)
- 영향: 사용자 경험 38% 개선, 지원팀 요청 70% 감소

#### 에러 분류

| 상태 | 오류 타입 | 해결책 | 재시도 |
|------|---------|-------|--------|
| **400** | 검증 오류 (필드 누락) | 사용자가 수정 | ❌ |
| **413** | 크기 초과 (>100MB) | 자동 압축 후 재시도 | ✅ 3회 |
| **500** | 서버 오류 | 자동 재시도 | ✅ 3회 |

#### 구현 범위

| 파일 | 기능 | 우선순위 |
|------|------|---------|
| `src/lib/error-codes.ts` | 에러 코드 정의 + 응답 | **P0** |
| `src/lib/retry-engine.ts` | 지수 백오프 재시도 | **P0** |
| `src/components/ErrorFeedback.tsx` | 사용자 피드백 UI | **P0** |
| `src/lib/webhook-retry-queue.ts` | Webhook 재시도 큐 | **P1** |

#### 체크리스트

- [ ] **에러 코드 정의** (1시간)
  - [ ] error-codes.ts 작성 (350-400줄)
    ```typescript
    // 필수 함수
    export function getErrorResponse(code, context)
    export function isRetryable(statusCode)
    export function getRetryDelay(attempt)
    
    // 에러 타입
    export const ErrorCodes = {
      VALIDATION_ERROR: { status: 400, message: '...' },
      PAYLOAD_TOO_LARGE: { status: 413, message: '...' },
      SERVER_ERROR: { status: 500, message: '...' },
      ...
    }
    ```
  - [ ] 50+ 에러 코드 정의
  - [ ] 각 에러마다 사용자 메시지 작성
  - [ ] **체크 기준**: 에러 코드 완성도 100%

- [ ] **재시도 엔진** (1.5시간)
  - [ ] retry-engine.ts 작성 (300-350줄)
    ```typescript
    // 필수 함수
    export async function retryWithExponentialBackoff(fn, options)
    
    // 지수 백오프: 500ms → 1s → 2s → ...
    // 지터 적용: ±10% 무작위 지연 (thundering herd 방지)
    // 최대 재시도: 3회
    ```
  - [ ] 지수 백오프 계산 (2^attempt * 500ms)
  - [ ] 지터(jitter) 추가 (±10%)
  - [ ] 타임아웃 설정 (10초)
  - [ ] **체크 기준**: 재시도 테스트 3회 성공

- [ ] **UI 컴포넌트** (2시간)
  - [ ] ErrorFeedback.tsx (400-450줄)
    ```typescript
    // 3가지 변형
    <ErrorFeedback /> - 인라인 (검증 오류용)
    <ErrorToast /> - 토스트 (크기 초과용)
    <ErrorBanner /> - 배너 (서버 오류용)
    
    // 필수 기능
    - 에러 메시지 + 행동 제안
    - 자동 재시도 진행률 표시
    - 닫기 버튼 + 자동 사라지기
    ```
  - [ ] 타입 안전성 (TypeScript)
  - [ ] 색상 구분 (빨강/황색/주황색)
  - [ ] 애니메이션 (부드러운 나타남/사라짐)
  - [ ] **체크 기준**: 3가지 변형 모두 시각적 검증

- [ ] **API 수정** (2-3시간)
  - [ ] 기존 API 5-10개 수정 (우선순위 P0)
    ```typescript
    // Before
    return NextResponse.json({ ok: false }, { status: 500 });
    
    // After
    return NextResponse.json(
      getErrorResponse('VALIDATION_ERROR', {
        message: '이름은 필수입니다',
        field: 'name'
      }),
      { status: 400 }
    );
    ```
  - [ ] 에러 로깅 추가 (operationId)
  - [ ] 요청 추적 ID 생성
  - [ ] **체크 기준**: 모든 수정 API TypeScript 통과

- [ ] **Webhook 재시도** (1.5시간)
  - [ ] webhook-retry-queue.ts (300줄)
  - [ ] DB 테이블: WebhookRetryQueue
  - [ ] Cron Job: 1분마다 재시도 처리
  - [ ] 최대 5회 재시도 (5분 → 10분 → 20분 → ...)
  - [ ] **체크 기준**: Webhook 재시도 테스트 통과

- [ ] **모니터링 대시보드** (1시간)
  - [ ] 실시간 에러율 표시
  - [ ] 에러 타입별 분포 (차트)
  - [ ] 재시도 성공율 추적
  - [ ] 자동 알림 (에러율 > 5%)
  - [ ] **체크 기준**: 대시보드에서 모든 메트릭 확인

- [ ] **문서화** (1시간)
  - [ ] ERROR_HANDLING_QUICK_START.md (5분 이해용)
  - [ ] ERROR_HANDLING_IMPLEMENTATION_EXAMPLES.md (코드 예제)
  - [ ] 개발자 가이드
  - [ ] 사용자 가이드
  - [ ] **체크 기준**: 문서 완성도 100%

- [ ] **테스트** (2시간)
  - [ ] 단위 테스트: 에러 생성, 재시도 로직
  - [ ] 통합 테스트: API + UI 에러 처리
  - [ ] E2E 테스트: 에러 발생 → 재시도 → 성공
  - [ ] 성능 테스트: 대량 에러 동시 처리
  - [ ] **체크 기준**: 모든 테스트 80% 이상 커버리지

- [ ] **배포** (1시간)
  - [ ] 환경변수 설정 (에러 로깅 레벨)
  - [ ] 커밋: `feat: enhanced error handling (400/413/500 distinction)`
  - [ ] Vercel 배포
  - [ ] 24시간 모니터링
  - [ ] 팀 교육 (에러 처리 가이드)
  - [ ] **체크 기준**: 프로덕션 에러율 정상화

#### 담당자 및 완료 일정
| 단계 | 담당자 | 예정일 | 완료일 | 상태 |
|------|--------|--------|--------|------|
| 설계 | 아키텍트 | 2026-06-02 | __ | ⬜ |
| 구현 | 개발자 | 2026-06-03~04 | __ | ⬜ |
| 문서화 | 기술 저자 | 2026-06-04 | __ | ⬜ |
| 테스트 | QA | 2026-06-05 | __ | ⬜ |
| 배포 | DevOps | 2026-06-05 | __ | ⬜ |

---

### **SOP #6: 사용자 메시지 및 진행률 (User Messaging & Progress)**

#### 문제 정의
- 현재: 처리 중 상태 불명 (사용자 불안감)
- 목표: 단계별 메시지 + 진행률 표시
- 영향: 사용자 신뢰도 30% 증대

#### 메시지 가이드

| 단계 | 메시지 | 지속시간 | 아이콘 |
|------|--------|---------|--------|
| **압축 중** | "🔄 이미지 압축 중... (1.2MB → 450KB)" | 2-5s | ⏳ |
| **Drive 저장** | "🔄 Google Drive에 저장 중... (1/1)" | 1-3s | 📁 |
| **업로드 완료** | "✅ 완료! 링크: [공유]" | 3s 후 사라짐 | ✓ |
| **재시도** | "🔄 다시 시도 중... (2/3)" | 변동 | ↻ |
| **실패** | "❌ 오류 발생 (413: 파일 크기 초과). 파일을 분할하세요." | 지속 | ✗ |

#### 구현 범위

| 파일 | 기능 | 우선순위 |
|------|------|---------|
| `src/components/ProgressMessage.tsx` | 진행률 UI | **P0** |
| `src/lib/progress-tracker.ts` | 진행 상태 관리 | **P1** |
| `src/hooks/useUploadProgress.ts` | 업로드 훅 | **P1** |

#### 체크리스트

- [ ] **메시지 설계** (1시간)
  - [ ] 단계별 메시지 10+ 작성
  - [ ] 톤/스타일 가이드라인
    - ✓ "완료"보다는 "완료했어요!" (따뜻함)
    - ✓ 기술 용어 피하기 ("오류" 대신 "문제")
    - ✓ 행동 제안 포함 ("다시 시도" 버튼)
  - [ ] 길이 제한 (50자 이하)
  - [ ] **체크 기준**: 메시지 20개 이상 검토

- [ ] **진행률 컴포넌트** (1.5시간)
  - [ ] ProgressMessage.tsx (200-250줄)
    ```typescript
    // Props
    {
      status: 'compressing' | 'uploading' | 'saving' | 'retry' | 'success' | 'error'
      progress: number (0-100)
      message: string
      onDismiss: () => void
      duration: number? (밀리초, 기본 3000)
    }
    
    // 기능
    - 진행률 바 (smooth animation)
    - 상태별 아이콘 (동적)
    - 자동 사라지기 (duration 후)
    - 닫기 버튼
    ```
  - [ ] Tailwind CSS로 반응형 디자인
  - [ ] 애니메이션 (부드러운 진행률 증가)
  - [ ] 색상 구분 (파랑/초록/빨강)
  - [ ] **체크 기준**: 시각적 검증 3가지 상태

- [ ] **상태 관리** (1시간)
  - [ ] progress-tracker.ts 작성
    ```typescript
    // 필수 함수
    export class ProgressTracker {
      updateStatus(status, message)
      updateProgress(percent)
      finish(message)
      error(message)
    }
    ```
  - [ ] React Context 사용 (전역 상태)
  - [ ] 메시지 큐 (동시 여러 메시지 처리)
  - [ ] **체크 기준**: 단위 테스트 100% 통과

- [ ] **업로드 훅** (1.5시간)
  - [ ] useUploadProgress.ts 작성
    ```typescript
    // 반환
    {
      isUploading: boolean
      progress: number (0-100)
      status: string
      message: string
      error: Error | null
      uploadFile: (file) => Promise
    }
    ```
  - [ ] FileReader API + FormData
  - [ ] 진행 이벤트 수집
  - [ ] 에러 처리
  - [ ] **체크 기준**: 실제 파일 업로드 테스트

- [ ] **UI 통합** (1.5시간)
  - [ ] ImageLibraryModal에 ProgressMessage 추가
  - [ ] 업로드/압축/Drive 저장 단계별 메시지
  - [ ] 진행률 바 업데이트 (실시간)
  - [ ] 에러 발생 시 제안 메시지
  - [ ] **체크 기준**: 전체 플로우 시각적 검증

- [ ] **다국어 지원** (1시간)
  - [ ] 메시지를 i18n 파일로 분리
  - [ ] 한국어 + 영어
  - [ ] 사용자 언어 설정에 따라 자동 선택
  - [ ] **체크 기준**: 한영 번역 검증 2명 이상

- [ ] **테스트** (1.5시간)
  - [ ] 단위 테스트: 메시지 생성 로직
  - [ ] 컴포넌트 테스트: ProgressMessage 렌더링
  - [ ] 통합 테스트: 업로드 → 메시지 표시
  - [ ] E2E 테스트: 사용자 관점 전체 플로우
  - [ ] **체크 기준**: 모든 테스트 통과

- [ ] **배포** (30분)
  - [ ] 커밋: `feat: add user messaging and progress indicators`
  - [ ] PR 리뷰
  - [ ] Vercel 배포
  - [ ] 사용자 피드백 수집 (1주)
  - [ ] **체크 기준**: 사용자 만족도 90% 이상

#### 담당자 및 완료 일정
| 단계 | 담당자 | 예정일 | 완료일 | 상태 |
|------|--------|--------|--------|------|
| 메시지 설계 | 카피라이터 | 2026-06-02 | __ | ⬜ |
| UI 구현 | 프론트엔드 | 2026-06-03 | __ | ⬜ |
| 테스트 | QA | 2026-06-04 | __ | ⬜ |
| 배포 | DevOps | 2026-06-04 | __ | ⬜ |

---

## 📋 통합 완료 체크리스트

모든 6가지 SOP 완료 후 최종 검증:

### **Phase 1: 기초 (2026-06-02 ~ 2026-06-05)**
- [ ] **SOP #1**: 경로 오류 수정 (100% 통과)
- [ ] **SOP #5**: 에러 처리 강화 (기초 구현)
- [ ] **SOP #6**: 메시지 설계 완료

### **Phase 2: 확장 (2026-06-05 ~ 2026-06-10)**
- [ ] **SOP #2**: 이미지 압축 (서버 + 클라이언트)
- [ ] **SOP #3**: Drive 자동 저장 (하이브리드 모델)
- [ ] **SOP #4**: 라이브러리 복수선택

### **Phase 3: 최적화 (2026-06-10 ~ 2026-06-15)**
- [ ] **SOP #5**: 에러 처리 고도화 (모니터링, 알림)
- [ ] 통합 성능 테스트 (Load testing)
- [ ] 사용자 교육 자료 작성

### **Phase 4: 배포 (2026-06-15 ~ 2026-06-20)**
- [ ] 프로덕션 배포
- [ ] 24시간 모니터링
- [ ] 사용자 피드백 수집 (1주)

---

## 📊 성과 목표

### **정량 목표**

| 지표 | Before | After | 개선도 |
|------|--------|-------|--------|
| **평균 파일크기** | 2.8MB | 0.6MB | **-78%** |
| **업로드 시간** | 120s | 30s | **-75%** |
| **저장소 비용** | $3,000/월 | $1,800/월 | **-40%** |
| **자동화율** | 20% | 95% | **+375%** |
| **사용자 만족도** | 65% | 90% | **+38%** |
| **지원팀 요청** | 100/월 | 30/월 | **-70%** |

### **정성 목표**
- ✅ 사용자 경험 개선 (신뢰도 증대)
- ✅ 운영 부담 감소 (자동화)
- ✅ 데이터 안정성 증대 (Cloud 백업)
- ✅ 개발자 생산성 증대 (표준화)

---

## 🚀 시작하기

### **즉시 실행 (오늘)**
```bash
# 1. SOP #1 검토
grep -r "landing-pages" src/ | grep "\\\\"

# 2. SOP #5 기초 구현
cd src/lib && touch error-codes.ts retry-engine.ts

# 3. SOP #6 메시지 설계
# 메시지 20개+ 작성 (Google Docs)
```

### **이주일 내 완료**
```bash
# Phase 1 체크리스트 실행
npm run tsc --noEmit

# 각 SOP별 담당자 배정
# 병렬 진행 (최대 3개 SOP 동시)
```

---

## 📞 문의 및 피드백

- **SOP 변경**: 새 요구사항 발생 시 즉시 업데이트
- **진행 상황**: 주간 리포팅 (금요일 5시)
- **이슈 에스컬레이션**: 예상 지연 시 즉시 보고

---

**마지막 업데이트**: 2026-06-02  
**버전**: 2.0 (6가지 SOP 통합)  
**상태**: 🟢 프로덕션 준비 완료

