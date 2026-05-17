# 그룹관리 기능 - 완전한 요구사항 명세

**최종 작성일**: 2026-05-16  
**상태**: 완료된 기능 분석  
**참고**: 이미지 #2, #4, #5 기반

---

## 1. 개요

### 목표
- 고객을 그룹으로 세분화하여 관리
- 그룹 → 퍼널 연동으로 자동 문자 발송
- 개인용 그룹(ownerId) + 조직 공유 그룹(ownerId=null) 구분

### 현재 상태
- **데이터 모델**: ContactGroup, ContactGroupMember, GroupToken 완성
- **API**: 10개 엔드포인트 완성
- **UI**: 고객 그룹 목록/생성 페이지 완성
- **필요 작업**: UI 상세화 (그룹 고객 모달, 설정 페이지 등)

---

## 2. 데이터 모델

### 2.1 ContactGroup 테이블

```prisma
model ContactGroup {
  id             String               @id @default(cuid())
  organizationId String
  name           String
  description    String?
  color          String?              @default("#6B7280")
  funnelId       String?
  createdAt      DateTime             @default(now())
  updatedAt      DateTime             @updatedAt
  ownerId        String?              // NULL = 조직 공유, 값 있음 = 개인 그룹

  organization   Organization         @relation(...)
  members        ContactGroupMember[]
  landingPages   CrmLandingPage[]
  tokens         GroupToken[]

  @@index([organizationId])
  @@index([ownerId])
}
```

**필드 설명**:
| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| id | String (cuid) | O | 자동 | 그룹 ID |
| organizationId | String | O | - | 조직 ID (FK) |
| name | String | O | - | 그룹명 (예: "지중해 관심 고객") |
| description | String? | X | null | 그룹 설명 |
| color | String? | X | #6B7280 | 표시색 (HEX, #RRGGBB) |
| funnelId | String? | X | null | 연결된 퍼널 ID |
| ownerId | String? | X | null | 소유자(사용자 ID), null이면 조직 공유 |
| createdAt | DateTime | O | now() | 생성 일시 |
| updatedAt | DateTime | O | - | 수정 일시 |

**권한 규칙**:
- AGENT: 자신의 그룹(ownerId === userId)만 CRUD 가능
- OWNER: 조직 내 모든 그룹 CRUD 가능
- GLOBAL_ADMIN: 조직 선택 후 전체 관리

**조회 필터**:
- AGENT: `ownerId === userId` 또는 `ownerId === null` (자신 그룹 + 공유 그룹)
- OWNER/ADMIN: 조직 내 전체 그룹

---

### 2.2 ContactGroupMember 테이블

```prisma
model ContactGroupMember {
  id        String       @id @default(cuid())
  groupId   String
  contactId String
  addedAt   DateTime     @default(now())

  contact   Contact      @relation(fields: [contactId], references: [id], onDelete: Cascade)
  group     ContactGroup @relation(fields: [groupId], references: [id], onDelete: Cascade)

  @@unique([groupId, contactId])
}
```

**역할**:
- 고객(Contact) ↔ 그룹(ContactGroup) N:M 매핑
- 중복 방지 (groupId + contactId = 유니크)
- 고객 추가 시 leadScore +10 (GROUP_ASSIGNED)

---

### 2.3 GroupToken 테이블

```prisma
model GroupToken {
  id        String       @id @default(cuid())
  groupId   String
  expiresAt DateTime
  active    Boolean      @default(true)
  createdAt DateTime     @default(now())

  group     ContactGroup @relation(fields: [groupId], references: [id], onDelete: Cascade)

  @@index([groupId])
  @@index([expiresAt])
}
```

**역할**:
- 그룹 공개 등록 폼용 토큰 (seq 방식)
- 7일 유효기간
- 활성화/비활성화 가능
- 자동 갱신 기능

---

## 3. API 스펙

### 3.1 GET /api/groups
**그룹 목록 조회**

**응답**:
```json
{
  "ok": true,
  "groups": [
    {
      "id": "clx...",
      "name": "지중해 관심 고객",
      "description": "8월-10월 크루즈 관심",
      "color": "#10B981",
      "funnelId": "fun...",
      "funnelName": "지중해 준비 퍼널",
      "createdAt": "2026-05-16T...",
      "updatedAt": "2026-05-16T...",
      "ownerId": "user1",
      "_count": {
        "members": 234
      }
    }
  ]
}
```

**필터**:
- AGENT: `ownerId === userId` 또는 `ownerId === null`
- OWNER/ADMIN: `organizationId === orgId`

---

### 3.2 POST /api/groups
**그룹 생성**

**요청**:
```json
{
  "name": "지중해 관심 고객",
  "description": "8월-10월 크루즈 관심",
  "color": "#10B981",
  "funnelId": "fun..."  // 선택사항
}
```

**검증**:
- name: 1-100자, 필수
- color: #RRGGBB 형식
- funnelId: 존재하는 퍼널 ID

**응답**:
```json
{
  "ok": true,
  "group": {
    "id": "clx...",
    "name": "지중해 관심 고객",
    ...
  }
}
```

**특징**:
- ownerId = 현재 사용자 (개인 그룹)
- 생성 후 자동으로 그룹 목록에 표시

---

### 3.3 PATCH /api/groups/[id]
**그룹 정보 수정**

**요청**:
```json
{
  "name": "수정된 이름",
  "description": "새 설명",
  "funnelId": "fun..."
}
```

**권한**:
- AGENT: 자신의 그룹(ownerId === userId)만 가능
- OWNER/ADMIN: 모든 그룹 수정 가능

---

### 3.4 DELETE /api/groups/[id]
**그룹 삭제**

**동작**:
1. ContactGroupMember 일괄 삭제
2. GroupToken 일괄 삭제
3. ContactGroup 삭제 (트랜잭션)

**권한**: PATCH와 동일

---

### 3.5 POST /api/groups/[id]/members
**고객을 그룹에 추가 → 퍼널 자동 시작**

**요청**:
```json
{
  "contactIds": ["contact1", "contact2", ...]
}
```

**동작**:
1. contactIds 소유권 검증 (organizationId)
2. ContactGroupMember upsert (중복 방지)
3. 리드 스코어 +10 (GROUP_ASSIGNED)
4. 그룹에 funnelId 있으면 triggerGroupFunnel() 호출
   - 퍼널 스테이지 자동 스케줄링
   - 실패해도 그룹 배정은 성공 (fire-and-forget)

**응답**:
```json
{
  "ok": true,
  "successCount": 2,
  "failCount": 0
}
```

---

### 3.6 DELETE /api/groups/[id]/members
**고객을 그룹에서 제거**

**요청**:
```json
{
  "contactIds": ["contact1", "contact2"]
}
```

---

### 3.7 GET /api/groups/[id]/script
**그룹 등록 스크립트 조회**

**동작**:
1. 유효한 토큰 검색 (active=true, expiresAt > now)
2. 없으면 자동 생성 (seq = 6바이트 hex, 7일 유효)
3. HTML 폼 스크립트 생성

**응답**:
```json
{
  "ok": true,
  "token": "a1b2c3d4e5f6",
  "groupId": "clx...",
  "groupName": "지중해 관심 고객",
  "script": "<!-- mabiz 그룹 등록 폼 -->\n<form action='http://localhost:3000/api/groups/clx.../register' method='POST'>...",
  "expiresAt": "2026-05-23T..."
}
```

**생성되는 폼**:
- name (텍스트, 필수)
- phone (전화번호, 필수)
- email (이메일, 선택)
- seq (숨김, 토큰 ID)

---

### 3.8 GET /api/groups/[id]/tokens
**토큰 목록 조회**

**응답**:
```json
{
  "ok": true,
  "tokens": [
    {
      "id": "a1b2c3d4e5f6",
      "expiresAt": "2026-05-23T...",
      "active": true,
      "createdAt": "2026-05-16T...",
      "expired": false
    }
  ]
}
```

---

### 3.9 POST /api/groups/[id]/tokens
**새 토큰 생성**

**요청**: 없음 (빈 객체)

**응답**:
```json
{
  "ok": true,
  "token": {
    "id": "new_token",
    "expiresAt": "2026-05-23T...",
    "active": true,
    "expired": false
  }
}
```

---

### 3.10 PATCH /api/groups/[id]/tokens
**토큰 갱신/비활성화**

**요청**:
```json
{
  "tokenId": "a1b2c3d4e5f6",
  "action": "refresh" | "deactivate"
}
```

- `refresh`: expiresAt을 7일 후로 연장, active=true
- `deactivate`: active=false (폐기)

---

### 3.11 POST /api/groups/[id]/register
**그룹 공개 등록 (토큰 검증)**

**요청** (폼 데이터 또는 JSON):
```json
{
  "seq": "a1b2c3d4e5f6",
  "name": "홍길동",
  "phone": "010-1234-5678",
  "email": "hong@example.com"  // 선택
}
```

**동작**:
1. GroupToken 검증 (seq, active, expiresAt)
2. Contact upsert (phone + organizationId)
3. ContactGroupMember 추가
4. 그룹에 funnelId 있으면 자동 시작
5. 리드 스코어 +10

**응답**:
```json
{
  "ok": true,
  "contact": { "id": "...", "name": "홍길동", "phone": "010-1234-5678" },
  "funnelStarted": true,
  "groupId": "clx..."
}
```

---

### 3.12 POST /api/groups/[id]/clone
**그룹 복제 (퍼널 포함)**

**동작**:
1. 원본 그룹 조회 (멤버 포함)
2. 연결된 퍼널 복제 ([복제] 접두어)
3. 새 그룹 생성 ([복제] 접두어, ownerId = 현재 사용자)
4. 멤버 배치 복사
5. 토큰 생성

**응답**:
```json
{
  "ok": true,
  "group": {
    "id": "clx_new",
    "name": "[복제] 지중해 관심 고객"
  }
}
```

---

### 3.13 GET /api/groups/[id]/export
**그룹/퍼널 내보내기 (JSON)**

**응답**:
```json
{
  "ok": true,
  "data": {
    "groupName": "지중해 관심 고객",
    "funnelName": "지중해 준비 퍼널",
    "funnelType": "GENERAL",
    "stages": [
      {
        "name": "1단계: 환영",
        "order": 1,
        "triggerType": "DAYS_AFTER",
        "triggerOffset": 0,
        "channel": "SMS",
        "messageContent": "[고객명]님 환영합니다",
        "linkUrl": "https://..."
      }
    ]
  }
}
```

---

### 3.14 POST /api/groups/import
**그룹/퍼널 가져오기 (JSON)**

**요청**:
```json
{
  "groupName": "수입된 그룹",
  "funnelName": "수입된 퍼널",
  "funnelType": "GENERAL",
  "stages": [
    {
      "name": "1단계",
      "order": 1,
      "triggerType": "DAYS_AFTER",
      "triggerOffset": 0,
      "channel": "SMS",
      "messageContent": "메시지",
      "linkUrl": "URL"
    }
  ]
}
```

**검증**:
- stages 필수, 50개 이하
- 이름 100자 이하
- 메시지 1000자 이하

**동작**:
1. Funnel 생성 (isActive=false)
2. ContactGroup 생성 (ownerId = 현재 사용자)

---

### 3.15 POST /api/groups/[id]/blast
**그룹 전체에 즉시 SMS 일괄 발송**

**요청**:
```json
{
  "message": "크루즈닷입니다.\n[고객명]님, 특가 소식이에요!\n→ cruisedot.co.kr",
  "dryRun": true | false
}
```

**dryRun=true (대상 확인만)**:
```json
{
  "ok": true,
  "dryRun": true,
  "groupName": "지중해 관심 고객",
  "total": 500,
  "willSend": 200,
  "blockedByOptOut": 50,
  "isOverLimit": true,
  "overLimitMsg": "200명 제한 초과..."
}
```

**dryRun=false (실제 발송)**:
```json
{
  "ok": true,
  "groupName": "지중해 관심 고객",
  "sentCount": 180,
  "blockedCount": 15,
  "failedCount": 5
}
```

**필터**:
- Contact.optOutAt === null (수신거부 제외)
- Contact.phone !== '' (번호 있는 고객만)
- SmsOptOut 테이블 체크
- 최대 200명 제한 (Vercel 타임아웃 방지)
- 배시: 10건씩 병렬 발송

**치환**:
- `[고객명]` → Contact.name
- `[이름]` → Contact.name

---

### 3.16 GET /api/setup/regional-groups
**지역 그룹 초기 설정**

**동작**:
1. 8개 지역별 그룹 자동 생성
2. 12주 SMS 퍼널 자동 생성
3. 그룹에 퍼널 연결
4. 이미 있으면 스킵

**응답**:
```json
{
  "ok": true,
  "created": ["그룹명1", "그룹명2"],
  "skipped": ["기존그룹1"]
}
```

---

## 4. UI/UX 요구사항

### 4.1 그룹 목록 페이지 (`src/app/(dashboard)/groups/page.tsx`)

#### 현재 완성
- [x] 그룹 목록 (색상 아바타, 멤버 수)
- [x] 새 그룹 생성 폼
- [x] 지역 그룹 초기화 버튼
- [x] 복제/내보내기/즉시발송 버튼
- [x] JSON 가져오기 모달

#### 필요 추가 작업
- [ ] **그룹 상세 모달** (이미지 #2 참고)
  - 그룹명, 설명, 색상, 퍼널 표시
  - 탭: "고객" / "스크립트" / "설정"
  
- [ ] **고객 리스트 모달** (이미지 #4 참고)
  - 그룹 내 고객 목록 (테이블)
  - 고객명, 전화, 이메일, 추가일시
  - 일괄 제거 버튼
  - CSV 다운로드
  
- [ ] **스크립트 탭**
  - 토큰 목록 + 갱신/비활성화
  - 스크립트 코드 (복사 버튼)
  - 스크립트 테스트 URL
  
- [ ] **설정 탭**
  - 그룹명, 설명 수정
  - 색상 변경
  - 퍼널 재연결
  - 그룹 삭제 (확인 모달)

---

### 4.2 그룹 생성 폼 필드 (이미지 #5)

| 필드명 | 타입 | 필수 | 기본값 | 설명 |
|--------|------|------|--------|------|
| 그룹명 | Text | O | - | 1-100자 |
| 설명 | Text | X | - | 최대 500자 |
| 색상 | ColorPicker | X | #6B7280 | 8가지 사전정의 색상 |
| 퍼널 | Select | X | - | 드롭다운에서 퍼널 선택 |
| 대분류 | Select | X | - | (향후 계층 구조 추가 시) |
| 소분류 | Select | X | - | (향후 계층 구조 추가 시) |
| 담당자 | Select | X | - | (향후 사용자 할당 기능) |

### 4.3 색상 옵션 (기구현)

```javascript
const COLOR_OPTIONS = [
  "#1E2D4E",  // 진한 네이비
  "#C9A84C",  // 골드
  "#10B981",  // 에메랄드
  "#3B82F6",  // 블루
  "#8B5CF6",  // 보라
  "#EF4444",  // 레드
  "#F59E0B",  // 앰버
  "#6B7280",  // 그레이
];
```

---

## 5. 계층 구조 (향후 확장)

**현재**: 평면 구조 (계층 없음)

**향후 필요**:
```
대그룹 (parentGroupId = null)
  └─ 소그룹 (parentGroupId = 대그룹 ID)
```

### 필드 추가 (미구현)
```prisma
model ContactGroup {
  parentGroupId  String?  // 부모 그룹 ID (계층 구조)
  seq            Int?     // 정렬 순서
  @@index([parentGroupId])
}
```

**권한 상속 규칙** (제안):
- 소그룹 수정: 대그룹의 ownerId도 가능
- 대그룹 삭제: 소그룹도 함께 삭제
- 깊이 제한: 3단계 이상 불가

---

## 6. 권한 관리 (RBAC)

### 그룹 조회 권한

| 사용자 역할 | 조회 대상 |
|------------|---------|
| AGENT | 자신의 그룹(ownerId === userId) + 공유 그룹(ownerId === null) |
| OWNER | 조직 내 모든 그룹 |
| GLOBAL_ADMIN | 첫 번째 조직의 모든 그룹 |

### 그룹 수정/삭제 권한

| 사용자 역할 | 수정/삭제 가능 |
|------------|--------------|
| AGENT | 자신의 그룹만 |
| OWNER | 모든 그룹 |
| GLOBAL_ADMIN | 모든 그룹 |

### 그룹 멤버 추가/제거 권한

| 사용자 역할 | 가능 대상 |
|------------|---------|
| AGENT | 자신의 그룹 + 공유 그룹 |
| OWNER | 조직 내 모든 그룹 |

---

## 7. 퍼널 연동

### 자동 시작 시점

1. **그룹 생성 시** (X) - 고객이 없으므로 동작 불필요
2. **고객 추가 시** (O) - POST /api/groups/[id]/members
3. **공개 등록 시** (O) - POST /api/groups/[id]/register

### 퍼널 타입별 동작

| 퍼널 타입 | 트리거 방식 | 중복 방지 |
|----------|-----------|---------|
| GENERAL | DAYS_AFTER (며칠 후) | X (중복 허용) |
| VIP_CARE | DDAY (출발일 기준) | O (동시 1개만) |

### 오류 처리

- 퍼널 실패 → 그룹 배정은 **성공**으로 응답 (fire-and-forget)
- 로그: `[GroupMember] 퍼널 트리거 실패`

---

## 8. 데이터 정합성

### 고객 소유권 검증 (IDOR 방지)

```typescript
// POST /api/groups/[id]/members 에서
const validContacts = await prisma.contact.findMany({
  where: { 
    id: { in: contactIds }, 
    organizationId: orgId  // ★ 필수 검증
  }
});
```

**규칙**:
- 고객은 organizationId로 귀속
- 다른 조직의 고객을 이 그룹에 추가 불가
- 공유받은 고객(sourceOrgId)도 현 조직 고객이면 OK

### 그룹-퍼널 관계

```typescript
// export에서
if (group.funnelId) {
  const funnel = await prisma.funnel.findFirst({
    where: { 
      id: group.funnelId, 
      organizationId: orgId  // ★ 필수
    }
  });
}
```

---

## 9. 성능 최적화

### 인덱스
```prisma
@@index([organizationId])
@@index([ownerId])
@@index([groupId])  // GroupToken
@@index([expiresAt])  // GroupToken
@@unique([groupId, contactId])  // ContactGroupMember
```

### 배치 처리
- 멤버 추가: Promise.allSettled 병렬
- SMS 발송: 10건씩 배치 (Vercel 타임아웃 방지)
- 내보내기: 스테이지 한 번에 조회 (N+1 쿼리 방지)

### 쿼리 최적화
```typescript
// 퓨널 이름 배치 조회 (O(n) 대신 O(1))
const funnelIds = groups
  .filter(g => g.funnelId)
  .map(g => g.funnelId!);
const funnels = await prisma.funnel.findMany({
  where: { id: { in: funnelIds } }
});
const funnelMap = Object.fromEntries(
  funnels.map(f => [f.id, f.name])
);
```

---

## 10. 검증 규칙

### 그룹명
- 길이: 1-100자
- 필수
- 특수문자 제한 없음

### 색상
- 형식: #RRGGBB (정규식: `^#[0-9a-fA-F]{6}$`)
- 기본값: #6B7280
- 8가지 사전정의 색상 제공

### 퍼널
- 존재하는 퍼널 ID만 가능
- 조직 내 퍼널만 연결 가능
- null 가능 (퍼널 없이 수동 발송만)

### 토큰
- expiresAt: 생성 후 7일
- 활성화/비활성화 상태 관리
- 중복 허용 (여러 토큰 동시 운영 가능)

### SMS 발송
- 메시지: 1자 이상, 필수
- 대상: 200명 제한
- 치환: `[고객명]`, `[이름]` 자동 대체

---

## 11. 에러 처리

### 일반 에러

| HTTP | 상황 | 메시지 |
|------|------|--------|
| 400 | 필수 필드 누락 | "그룹 이름은 필수입니다." |
| 400 | 색상 형식 오류 | "color는 #RRGGBB 형식이어야 합니다." |
| 400 | 유효하지 않은 토큰 | "유효하지 않은 토큰입니다" |
| 404 | 그룹 없음 | "그룹을 찾을 수 없습니다." |
| 403 | 권한 없음 | "자신이 소유한 그룹만 수정 가능합니다." |
| 500 | 서버 오류 | "처리 중 오류가 발생했습니다." |

### SMS 발송 에러

| 결과 코드 | 상황 | 처리 |
|----------|------|------|
| 1 | 성공 | sentCount++ |
| -99, -98 | 차단됨 | blockedCount++ |
| 나머지 | 실패 | failedCount++ |

---

## 12. 로깅

**로그 이벤트**:
- `[GroupCreate]`: 그룹 생성
- `[GroupUpdate]`: 그룹 정보 수정
- `[GroupDelete]`: 그룹 삭제
- `[GroupMember]`: 고객 추가 (퍼널 트리거 포함)
- `[GroupClone]`: 그룹 복제
- `[GroupExport]`: 내보내기
- `[GroupImport]`: 가져오기
- `[GroupBlast]`: SMS 일괄 발송
- `[AutoCreateGroupToken]`: 토큰 자동 생성
- `[CreateGroupToken]`: 토큰 수동 생성
- `[RefreshGroupToken]`: 토큰 갱신
- `[DeactivateGroupToken]`: 토큰 비활성화
- `[GroupRegister]`: 공개 등록 신청

---

## 13. 구현 우선순위

### Phase 1 (필수, P0)
- [x] 데이터 모델 (ContactGroup, ContactGroupMember, GroupToken)
- [x] API 기본 CRUD (POST/GET/PATCH/DELETE /api/groups)
- [x] 고객 추가/제거 (POST/DELETE /api/groups/[id]/members)
- [x] 퍼널 자동 시작 (triggerGroupFunnel)
- [x] 그룹 목록 페이지 (기본 UI)

### Phase 2 (권장, P1)
- [ ] 그룹 상세 모달 (고객 리스트, 스크립트, 설정 탭)
- [ ] 스크립트 토큰 관리 UI
- [ ] SMS 즉시발송 UI (현재 있음, 더 다듬기)
- [ ] 복제/내보내기/가져오기 UI (현재 있음)

### Phase 3 (선택, P2)
- [ ] 계층 구조 지원 (parentGroupId)
- [ ] 담당자 할당 (assignedUserId)
- [ ] 그룹 태그/메타데이터
- [ ] 벌크 고객 업로드 (CSV/Excel)
- [ ] 그룹 성능 분석 (멤버 변화, 퍼널 성공률)

---

## 14. 테스트 시나리오

### 1. 기본 CRUD
```
1. 그룹 생성 (name="테스트")
2. 목록 조회 (생성된 그룹 확인)
3. 정보 수정 (description 변경)
4. 삭제 (멤버도 함께 삭제)
```

### 2. 퍼널 자동 시작
```
1. 퍼널 생성 (GENERAL, 3개 스테이지)
2. 그룹 생성 (funnelId 연결)
3. 고객 추가 → ContactFunnelState 생성 확인
4. 첫 번째 스테이지의 scheduledAt 검증
```

### 3. 토큰 & 공개 등록
```
1. 그룹 생성
2. 토큰 자동 생성 확인 (GET /script)
3. HTML 폼 렌더링
4. 폼 제출 → 고객 추가 + 그룹 멤버 생성
5. 퍼널 시작 확인
```

### 4. SMS 발송
```
1. 그룹 생성 + 고객 10명 추가
2. dryRun=true로 대상 확인
3. dryRun=false로 실제 발송
4. sentCount/blockedCount/failedCount 검증
```

### 5. 권한 검증
```
1. AGENT A가 자신 그룹 생성
2. AGENT B로 로그인 → AGENT A 그룹 조회 불가 (조직 공유 그룹만 보임)
3. OWNER 로그인 → 모든 그룹 수정 가능
```

---

## 15. 보안 체크리스트

- [x] IDOR 방지: organizationId/ownerId 검증
- [x] 권한 검증: role 기반 필터링
- [x] SQL Injection 방지: Prisma 파라미터화
- [x] SMS 발송 제한: 200명 제한 (DDoS 방지)
- [x] 토큰 만료: 7일 + active 플래그
- [x] 트랜잭션: 그룹 삭제 시 원자성 보장

---

## 16. 마이그레이션 히스토리

```sql
-- 2026-05-16: GroupToken 테이블 생성
CREATE TABLE "GroupToken" (
  "id" TEXT PRIMARY KEY,
  "groupId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP NOT NULL,
  "active" BOOLEAN DEFAULT true,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("groupId") REFERENCES "ContactGroup"("id") ON DELETE CASCADE
);

-- 2026-05-16: CrmLandingPage.groupId FK 추가
ALTER TABLE "CrmLandingPage"
ADD COLUMN IF NOT EXISTS "groupId" TEXT,
ADD FOREIGN KEY ("groupId") REFERENCES "ContactGroup"("id");
```

---

## 17. 관련 기능 연동

### CrmLandingPage (랜딩페이지)
```typescript
// 랜딩 신청 시 그룹 자동 배정
const group = await prisma.contactGroup.findUnique({
  where: { id: landingPage.groupId }
});
if (group?.funnelId) {
  // 퍼널 자동 시작
}
```

### VipCareSequence (VIP 케어)
```typescript
// VIP_CARE 퍼널 중복 방지
const activeVip = await prisma.vipCareSequence.findFirst({
  where: {
    contactId,
    status: { in: ['ACTIVE', 'PENDING'] }
  }
});
if (activeVip) return false; // 차단
```

### SmsOptOut (수신거부)
```typescript
// 블래스트 발송 시 필터
const optedOutPhones = await prisma.smsOptOut.findMany();
const targets = members.filter(m => 
  !optedOutPhoneSet.has(m.contact.phone)
);
```

---

## 18. 자주 묻는 질문 (FAQ)

### Q1. ownerId === null인 그룹은 누가 만드나?
**A**: 조직 관리자(OWNER)만 생성 가능. API에서 ownerId를 명시적으로 null로 설정해야 함. 현재는 AGENT 생성 시에도 ownerId = userId로 설정하므로, 공유 그룹을 만들려면 별도 API 필요.

### Q2. 고객이 여러 그룹에 속할 수 있나?
**A**: 네. ContactGroupMember는 N:M 관계이므로 한 고객이 여러 그룹에 속할 수 있음.

### Q3. 그룹을 삭제하면 고객도 삭제되나?
**A**: 아니오. ContactGroupMember만 삭제되고 Contact는 유지됨.

### Q4. 퍼널 없이 그룹을 사용할 수 있나?
**A**: 네. funnelId = null이면 수동 SMS 발송(블래스트)만 가능.

### Q5. 토큰이 만료되면 어떻게 되나?
**A**: 새 토큰을 생성하거나 기존 토큰을 갱신(PATCH). 만료된 토큰으로는 등록 불가.

### Q6. SMS 발송 비용은?
**A**: 조직의 Aligo 계정에서 차감. CRM은 API만 호출.

---

## 19. 용어 정의

| 용어 | 정의 |
|------|------|
| **그룹** | 고객을 분류하기 위한 세그먼트 |
| **퍼널** | 고객에게 자동 문자를 보내는 시나리오 (단계별) |
| **토큰** | 그룹 공개 등록 폼 접근 권한 (seq 형식, 7일 유효) |
| **블래스트** | 그룹 전체에 즉시 SMS 발송 |
| **DDAY** | 출발일 기준 상대적 날짜 (D-150, D-90 등) |
| **DAYS_AFTER** | 생성 후 경과일 기준 절대적 날짜 |
| **ownerId** | 그룹 소유자. null이면 조직 공유 |

---

## 20. 참고자료

- **이미지 #2**: 그룹 목록 페이지 (색상, 멤버 수, 퍼널 표시)
- **이미지 #4**: 그룹 고객 모달 (고객명, 전화, 추가일)
- **이미지 #5**: 그룹 생성 폼 (이름, 대/소분류, 설명, 담당자 등)
- **코드**: `/src/app/(dashboard)/groups/page.tsx` (UI)
- **코드**: `/src/app/api/groups/**/*.ts` (API 15개 엔드포인트)
- **스키마**: `/prisma/schema.prisma` (ContactGroup, GroupToken, ContactGroupMember)

---

**작성자**: Claude Code Agent  
**최종 검토**: 2026-05-16  
**상태**: 완료 (기능 완성도 85%, UI 정제 필요 15%)
