# TASK-017: 퍼널 상태 전이 자동화 - 구현 완료

## 1단계: DB 스키마 설계 ✓

### 마이그레이션 파일
- **파일**: `src/app/api/b2b/migrate/route.ts`
- **추가 사항**:
  - `ContactFunnelState` 테이블 생성
  - 필드: `id`, `organizationId`, `contactId`, `status`, `nextScheduledAt`, `metadata`
  - 인덱스: `organizationId_contactId` (UNIQUE), `organizationId_status`, `nextScheduledAt`

### 생성된 테이블 구조
```sql
CREATE TABLE "ContactFunnelState" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organizationId TEXT NOT NULL,
  contactId TEXT NOT NULL REFERENCES "Contact"(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'PENDING',
  nextScheduledAt TIMESTAMPTZ,
  metadata JSONB,
  createdAt TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updatedAt TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ContactFunnelState_org_contact_unique UNIQUE (organizationId, contactId)
);
```

---

## 2단계: Prisma 스키마 + 상태 머신 정의 ✓

### Prisma 모델
- **파일**: `prisma/schema.prisma`
- **모델명**: `ContactFunnelState`
- **관계**: Contact와 1:1 관계 추가 (`funnelState` relation)

### 상태 머신 정의
- **파일**: `src/lib/funnel-state-machine.ts` (신규)
- **상태 타입**: `type FunnelState = 'PENDING' | 'ACTIVE' | 'WAITING' | 'COMPLETED' | 'FAILED' | 'ARCHIVED'`

#### 상태 전이 규칙
```
PENDING   → [ACTIVE, ARCHIVED]
ACTIVE    → [WAITING, FAILED, COMPLETED, ARCHIVED]
WAITING   → [ACTIVE, FAILED, COMPLETED, ARCHIVED]
COMPLETED → [ARCHIVED]
FAILED    → [ACTIVE, ARCHIVED]        // 재시도 가능
ARCHIVED  → []                         // 최종 상태 (되돌릴 수 없음)
```

#### 제공 함수
- `isValidTransition(from, to, method)` - 상태 전이 유효성 검사
- `getStateLabel(state)` - 한글 상태명
- `getStateColor(state)` - UI 색상
- `getStateProgress(state)` - 진행도 (0-100)
- `getAvailableTransitions(from)` - 가능한 다음 상태 목록

---

## 3단계: API 엔드포인트 ✓

### 1. 목록 조회
- **경로**: `GET /api/funnel-states/list`
- **파라미터**: `status` (필터), `limit` (상한 100), `offset`
- **응답**: 고객 상태 목록 + 페이지네이션

### 2. 상태 전이
- **경로**: `POST /api/funnel-states/[id]/transition`
- **요청 본문**:
  ```json
  {
    "newState": "ACTIVE",
    "reason": "실패 사유 (FAILED일 때)",
    "metadata": { "notes": "추가 메모" }
  }
  ```
- **검증**:
  - 상태 전이 규칙 확인
  - IDOR 방지 (organizationId 검증)
  - 최종 상태(ARCHIVED) 되돌릴 수 없음

### 3. 상태 생성
- **경로**: `POST /api/funnel-states/create`
- **파라미터**: `contactId`
- **동작**: 고객별 초기 상태 PENDING으로 생성

### 4. 상태 상세 조회
- **경로**: `GET /api/funnel-states/[id]`
- **응답**: 상태 정보 + 가능한 다음 상태 목록

### 5. 통계 조회
- **경로**: `GET /api/funnel-states/stats`
- **응답**:
  - 상태별 고객 수
  - 변환율 (PENDING → COMPLETED)
  - 평균 체류일수
  - 각 상태별 집계 데이터

---

## 4단계: UI 페이지 ✓

### 주요 페이지
- **경로**: `/dashboard/funnel-states`
- **파일**: `src/app/(dashboard)/funnel-states/page.tsx`

#### 구성 요소

1. **헤더 + 설명**
   - 제목, 부제목

2. **KPI 카드 (6개)**
   - 상태별 고객 수 (클릭 가능)
   - 각 카드는 해당 상태로 필터링

3. **통계 카드 (3개)**
   - 변환율 (%)
   - 평균 체류일수
   - 총 고객 수

4. **필터링**
   - 상태 필터 (드롭다운)
   - 기본값: 전체

5. **고객 목록 테이블**
   - 열: 고객명, 전화번호, 상태, 변경일, 액션
   - 상태별 배지 색상 (Gray/Blue/Yellow/Green/Red/Slate)
   - "관리" 버튼 → 상태 변경 모달

### 상태 변경 모달
- **파일**: `src/components/funnel/FunnelStateModal.tsx`
- **기능**:
  - 고객 정보 표시 (이름, 전화, 이메일)
  - 현재 상태 표시
  - 상태 변경 드롭다운 (가능한 상태만)
  - FAILED 상태일 때: 실패 사유 입력 필드
  - 추가 메모 입력 필드
  - 메타데이터 JSON 표시
  - 상태 변경 버튼

---

## 5단계: Contact 생성 시 자동 연동 ✓

### Contact 생성 API 수정
- **파일**: `src/app/api/contacts/route.ts`
- **동작**: 고객 생성 후 자동으로 `ContactFunnelState` 레코드 생성 (PENDING 상태)

---

## 6단계: 메뉴 추가 ✓

### 사이드바 네비게이션 추가
- **파일**: `src/components/layout/SidebarNav.tsx`
- **위치**: "마케팅 자동화" 섹션 내
- **메뉴**: "퍼널 상태 관리" (`/funnel-states`)

---

## 검증 체크리스트

### DB & Prisma
- [x] ContactFunnelState 테이블 마이그레이션 추가
- [x] Prisma 스키마 동기화 (`npx prisma generate`)
- [x] Contact ↔ ContactFunnelState 관계 설정

### 상태 머신
- [x] isValidTransition 함수 구현
- [x] ARCHIVED 최종 상태 보호 (되돌릴 수 없음)
- [x] FAILED → ACTIVE 재시도 허용

### API
- [x] 목록 조회 엔드포인트 (필터, 페이지네이션)
- [x] 상태 전이 엔드포인트 (IDOR 방지)
- [x] 상태 생성 엔드포인트 (upsert)
- [x] 상세 조회 엔드포인트
- [x] 통계 엔드포인트

### UI
- [x] 퍼널 상태 관리 페이지
- [x] 상태별 KPI 카드 (클릭 필터)
- [x] 변환율/평균 체류일수/총 고객 수 카드
- [x] 필터/정렬 UI
- [x] 고객 목록 테이블 (상태별 배지)
- [x] 상태 변경 모달
- [x] 사이드바 메뉴 추가

### 보안
- [x] organizationId 검증 (모든 엔드포인트)
- [x] IDOR 방지 (특정 리소스 접근)
- [x] 상태 전이 규칙 검증

### 데이터 무결성
- [x] 메타데이터 JSONB 저장 (실패 사유, 메모)
- [x] 최종 상태 보호 (ARCHIVED 되돌릴 수 없음)
- [x] 타임스탬프 자동 관리 (createdAt, updatedAt)

---

## 구현 파일 목록

| 파일 | 설명 |
|------|------|
| `src/app/api/b2b/migrate/route.ts` | 마이그레이션 (ContactFunnelState 테이블) |
| `prisma/schema.prisma` | Prisma 모델 추가 |
| `src/lib/funnel-state-machine.ts` | 상태 머신 정의 (신규) |
| `src/app/api/funnel-states/list/route.ts` | 목록 조회 API (신규) |
| `src/app/api/funnel-states/[id]/route.ts` | 상세 조회 API (신규) |
| `src/app/api/funnel-states/[id]/transition/route.ts` | 상태 전이 API (신규) |
| `src/app/api/funnel-states/create/route.ts` | 상태 생성 API (신규) |
| `src/app/api/funnel-states/stats/route.ts` | 통계 API (신규) |
| `src/app/(dashboard)/funnel-states/page.tsx` | 퍼널 상태 관리 페이지 (신규) |
| `src/components/funnel/FunnelStateModal.tsx` | 상태 변경 모달 (신규) |
| `src/components/funnel/FunnelStateKanban.tsx` | Kanban 보드 (신규, 선택사항) |
| `src/components/layout/SidebarNav.tsx` | 사이드바 메뉴 추가 |
| `src/app/api/contacts/route.ts` | Contact 생성 시 자동 연동 |

---

## 배포 전 체크사항

1. **마이그레이션 실행**
   ```bash
   curl -X POST http://localhost:3000/api/b2b/migrate \
     -H "Authorization: Bearer <GLOBAL_ADMIN_TOKEN>" \
     -H "Content-Type: application/json"
   ```

2. **Prisma 클라이언트 재생성**
   ```bash
   npx prisma generate
   ```

3. **테스트 시나리오**
   - 고객 생성 → ContactFunnelState 자동 생성 (PENDING)
   - PENDING → ACTIVE (가능)
   - ACTIVE → FAILED (가능)
   - FAILED → ACTIVE (재시도)
   - COMPLETED → ARCHIVED (최종)
   - ARCHIVED → * (불가능)

---

## 추후 개선사항 (선택사항)

1. **Kanban 보드 UI**
   - 6개 열로 상태별 카드 표시
   - 드래그앤드롭으로 상태 변경 (추가 작업)

2. **자동화**
   - 스케줄된 상태 전이 (`nextScheduledAt` 활용)
   - 특정 조건에서 자동 상태 변경

3. **알림**
   - 상태 변경 시 이메일/SMS 발송
   - 오래된 상태 알림

4. **분석**
   - 상태별 머물러 있는 시간 분포
   - 병목 상태 분석
   - 모드별 성공률 추이
