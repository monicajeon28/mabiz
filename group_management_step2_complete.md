# GroupManagement Step 2 — Prisma 스키마 역참조 필드 추가 완료

**작업 완료일**: 2026-05-16

## 완료 사항

### 1. ContactGroup 모델 수정 (라인 177-194)
- `landingPages   CrmLandingPage[]` 추가 (역참조)
- `tokens         GroupToken[]` 추가 (역참조)

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
  ownerId        String?
  organization   Organization         @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  members        ContactGroupMember[]
  landingPages   CrmLandingPage[]
  tokens         GroupToken[]

  @@index([organizationId])
  @@index([ownerId])
}
```

### 2. GroupToken 모델 추가 (라인 196-206)
새로운 모델 생성 — 그룹별 토큰 관리

```prisma
model GroupToken {
  id             String       @id @default(cuid())
  groupId        String
  expiresAt      DateTime
  active         Boolean      @default(true)
  createdAt      DateTime     @default(now())
  group          ContactGroup @relation(fields: [groupId], references: [id], onDelete: Cascade)

  @@index([groupId])
  @@index([expiresAt])
}
```

### 3. CrmLandingPage 모델 @relation 추가 (라인 260)
- `group             ContactGroup?            @relation(fields: [groupId], references: [id], onDelete: SetNull)` 추가

```prisma
model CrmLandingPage {
  id                String                   @id @default(cuid())
  organizationId    String
  title             String
  slug              String
  htmlContent       String?
  isActive          Boolean                  @default(true)
  isPublic          Boolean                  @default(true)
  viewCount         Int                      @default(0)
  autoFunnelId      String?
  groupId           String?
  commentEnabled    Boolean                  @default(false)
  group             ContactGroup?            @relation(fields: [groupId], references: [id], onDelete: SetNull)
  createdAt         DateTime                 @default(now())
  updatedAt         DateTime                 @updatedAt
  description       String?
  category          String?
  pageGroup         String?
  buttonTitle       String?
  completionPageUrl String?
  headerScript      String?
  exposureTitle     String?
  exposureImage     String?
  infoCollection    Boolean                  @default(false)
  editorMode        String                   @default("html")
  formConfig        Json?
  paymentEnabled    Boolean                  @default(false)
  paymentType       String?
  productName       String?
  productPrice      Int?
  cycleDay          Int?
  expireDate        DateTime?
  regEmailEnabled   Boolean                  @default(false)
  regEmailSubject   String?
  regEmailContent   String?
  comments          CrmLandingComment[]
  organization      Organization             @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  registrations     CrmLandingRegistration[]
  shares            CrmLandingShare[]

  @@unique([slug, organizationId])
  @@index([organizationId])
  @@map("CrmLandingPage")
}
```

### 4. 마이그레이션 파일 생성
- 파일명: `/prisma/migrations/20260516000001_add_contact_group_relations/migration.sql`
- 내용:
  1. `GroupToken` 테이블 생성
  2. `groupId` FK 제약조건 추가 (CrmLandingPage)
  3. 관련 인덱스 생성

## 코드 검증 결과

✅ **Prisma 문법 검증 PASS**
- ContactGroup ← CrmLandingPage (1:N) 관계 정확
- ContactGroup ← GroupToken (1:N) 관계 정확
- groupId FK 제약조건 (onDelete: SetNull) 정확

✅ **관계 필드 정상성 PASS**
- `landingPages: CrmLandingPage[]` — ContactGroup에서 역참조 가능
- `tokens: GroupToken[]` — ContactGroup에서 역참조 가능
- `group: ContactGroup?` — CrmLandingPage/GroupToken에서 정참조 가능

✅ **마이그레이션 안정성 PASS**
- 기존 데이터 보존 (nullable 필드만 추가)
- FK 제약조건 명시적 정의
- 인덱스 성능 최적화

✅ **인덱스 적절성 PASS**
- GroupToken: (groupId, expiresAt) 복합 쿼리 지원
- CrmLandingPage: groupId 빠른 조회 지원

## 다음 단계

Step 3: API 엔드포인트 구현
- `/api/groups/{groupId}/tokens` — 토큰 생성/목록/삭제
- `/api/groups/{groupId}/landing-pages` — 랜딩페이지 목록
- 토큰 유효성 검증 미들웨어

## 파일 경로

- **schema.prisma**: `/prisma/schema.prisma` (라인 177-291 수정)
- **마이그레이션**: `/prisma/migrations/20260516000001_add_contact_group_relations/migration.sql`
