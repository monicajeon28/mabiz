# 그룹관리 기능 - 최종 요약 & 체크리스트

---

## 📋 산출물 목록

### 1. 요구사항 명세서
- **파일**: `GROUP_MANAGEMENT_REQUIREMENTS.md`
- **내용**: 
  - 데이터 모델 상세 (ContactGroup, ContactGroupMember, GroupToken)
  - 15개 API 엔드포인트 완전 스펙
  - 필드 설명, 검증, 권한 규칙
  - 성능 최적화, 보안 체크리스트

### 2. 데이터 흐름 & 시퀀스
- **파일**: `GROUP_MANAGEMENT_FLOWS.md`
- **내용**:
  - 고객 추가 → 퍼널 자동 시작 흐름
  - 공개 등록 폼 (토큰) 흐름
  - SMS 블래스트 발송 프로세스
  - 권한별 조회 범위
  - 트랜잭션 & 오류 처리
  - 관계도 & 성능 최적화

### 3. UI/UX 상세 명세
- **파일**: `GROUP_MANAGEMENT_UI_SPEC.md`
- **내용**:
  - 페이지 레이아웃 (목록, 폼, 모달)
  - 컴포넌트 상세 (카드, 버튼, 입력)
  - 상태별 UI (로딩, 오류, 완료)
  - 반응형 디자인 (모바일/태블릿/데스크톱)
  - 접근성 & 키보드 단축키

---

## ✅ 현재 구현 상태

### 백엔드 (완료)

| 기능 | 상태 | 엔드포인트 |
|------|------|----------|
| 그룹 목록 조회 | ✅ | GET /api/groups |
| 그룹 생성 | ✅ | POST /api/groups |
| 그룹 정보 수정 | ✅ | PATCH /api/groups/[id] |
| 그룹 삭제 | ✅ | DELETE /api/groups/[id] |
| 고객 추가 | ✅ | POST /api/groups/[id]/members |
| 고객 제거 | ✅ | DELETE /api/groups/[id]/members |
| 스크립트 조회 | ✅ | GET /api/groups/[id]/script |
| 토큰 목록 | ✅ | GET /api/groups/[id]/tokens |
| 토큰 생성 | ✅ | POST /api/groups/[id]/tokens |
| 토큰 관리 | ✅ | PATCH /api/groups/[id]/tokens |
| 공개 등록 | ✅ | POST /api/groups/[id]/register |
| 그룹 복제 | ✅ | POST /api/groups/[id]/clone |
| 내보내기 | ✅ | GET /api/groups/[id]/export |
| 가져오기 | ✅ | POST /api/groups/import |
| SMS 블래스트 | ✅ | POST /api/groups/[id]/blast |

### 프론트엔드

| 기능 | 상태 | 위치 |
|------|------|------|
| 그룹 목록 페이지 | ✅ | /src/app/(dashboard)/groups/page.tsx |
| 새 그룹 생성 폼 | ✅ | 인라인 |
| 지역 그룹 초기화 | ✅ | 버튼 |
| 복제 | ✅ | 버튼 |
| 내보내기 | ✅ | 버튼 + 클립보드 |
| 가져오기 모달 | ✅ | ImportModal |
| SMS 즉시발송 | ✅ | 블래스트 패널 |
| **그룹 상세 모달** | ⚠️ | 미구현 (우선순위 P1) |
| **고객 리스트 모달** | ⚠️ | 미구현 (우선순위 P1) |
| **스크립트 관리 UI** | ⚠️ | 미구현 (우선순위 P1) |
| **설정 탭** | ⚠️ | 미구현 (우선순위 P1) |

---

## 📊 데이터 모델 요약

### ContactGroup (그룹)
```
id          String (CUID)
name        String (1-100자)
description String? (설명)
color       String (HEX #RRGGBB)
funnelId    String? (연결된 퍼널)
ownerId     String? (소유자, null=공유)
organizationId String (조직)
createdAt   DateTime
updatedAt   DateTime
```

### ContactGroupMember (그룹 멤버)
```
id        String
groupId   String (FK)
contactId String (FK)
addedAt   DateTime

고유성: (groupId, contactId)
```

### GroupToken (등록 폼 토큰)
```
id        String (6바이트 hex)
groupId   String (FK)
expiresAt DateTime (7일 유효)
active    Boolean (활성화 여부)
createdAt DateTime
```

---

## 🔐 권한 규칙

### 그룹 조회
| 역할 | 조회 대상 |
|------|---------|
| AGENT | 자신 그룹 + 공유 그룹 |
| OWNER | 조직 모든 그룹 |
| GLOBAL_ADMIN | 첫 번째 조직 모든 그룹 |

### 그룹 수정/삭제
| 역할 | 가능 대상 |
|------|---------|
| AGENT | 자신 그룹만 (ownerId === userId) |
| OWNER | 모든 그룹 |
| GLOBAL_ADMIN | 모든 그룹 |

---

## 🔄 핵심 워크플로우

### 1️⃣ 그룹 생성 → 고객 추가 → 퍼널 자동 시작
```
POST /api/groups
├─ name, description, color, funnelId
└─ ownerId = 현재 사용자

POST /api/groups/[id]/members
├─ contactIds 소유권 검증
├─ ContactGroupMember upsert
├─ 리드 스코어 +10
└─ funnelId 있으면 triggerGroupFunnel()
   ├─ VipCareSequence 생성
   ├─ 스테이지별 scheduledAt 계산
   └─ Cron이 매일 발송

결과: 고객 → 그룹 배정 → 퍼널 시작 → SMS 자동 발송
```

### 2️⃣ 공개 등록 폼 (토큰 검증)
```
GET /api/groups/[id]/script
├─ 유효한 토큰 검색
└─ 없으면 자동 생성 (seq, 7일)

파트너 웹사이트에 HTML 폼 embed
└─ <form action="/api/groups/[id]/register">

고객이 폼 제출
POST /api/groups/[id]/register
├─ seq 토큰 검증 (active, expiresAt)
├─ Contact upsert
├─ ContactGroupMember 추가
└─ 퍼널 자동 시작

결과: 랜딩페이지 신청 → 자동 그룹 배정 → 퍼널 시작
```

### 3️⃣ SMS 일괄 발송 (블래스트)
```
POST /api/groups/[id]/blast
├─ dryRun=true: 대상 확인만 (200명 제한 안내)
└─ dryRun=false: 실제 발송
   ├─ 필터: optOutAt=null, phone ≠ '', SmsOptOut 체크
   ├─ 배시: 10건씩 병렬 (Vercel 타임아웃 방지)
   ├─ 치환: [고객명] → Contact.name
   └─ 응답: sentCount, blockedCount, failedCount

결과: 그룹 전체에 즉시 SMS 발송
```

---

## 🎯 구현 우선순위

### P0 (완료 및 유지)
- [x] 데이터 모델
- [x] API 기본 CRUD
- [x] 퍼널 자동 시작
- [x] 그룹 목록 페이지 (기본)
- [x] SMS 블래스트

### P1 (권장, 다음 세션)
- [ ] 그룹 상세 모달 (고객, 스크립트, 설정 탭)
- [ ] 토큰 관리 UI
- [ ] 고객 리스트 모달
- [ ] 그룹 설정 탭 (정보 수정, 삭제)
- [ ] UI/UX 정제 (반응형, 접근성)

### P2 (선택, 나중)
- [ ] 계층 구조 (parentGroupId)
- [ ] 담당자 할당 (assignedUserId)
- [ ] 성능 분석 (퍼널 성공률)
- [ ] 벌크 고객 업로드 (CSV/Excel)

---

## 🔍 테스트 시나리오

### 1. 그룹 생성 → 고객 추가
```bash
# 1. 퍼널 생성
POST /api/funnels { name: "테스트 퍼널" }
→ fun_id

# 2. 그룹 생성
POST /api/groups { name: "테스트 그룹", funnelId: fun_id }
→ grp_id, ownerId: user1

# 3. 고객 추가
POST /api/groups/grp_id/members { contactIds: ["c1", "c2"] }
→ VipCareSequence 2개 생성 확인

# 4. 권한 확인
[AGENT user2로 변경]
GET /api/groups → grp_id 보이지 않음 (user2가 소유하지 않고 공유 아님)

[OWNER로 변경]
GET /api/groups → grp_id 보임 (조직 모든 그룹)
```

### 2. 공개 등록 폼
```bash
# 1. 토큰 자동 생성
GET /api/groups/grp_id/script
→ token.id, script HTML

# 2. HTML 폼 렌더링
<form action="/api/groups/grp_id/register" method="POST">
  <input name="seq" value="a1b2c3d4e5f6" />
  <input name="name" value="홍길동" />
  <input name="phone" value="010-1234-5678" />
  <button>제출</button>
</form>

# 3. 폼 제출
POST /api/groups/grp_id/register
├─ seq 검증 (유효, 활성, 미만료)
├─ Contact 생성 또는 수정
├─ ContactGroupMember 추가
└─ 퍼널 시작 → FunnelEntry 생성
```

### 3. SMS 블래스트
```bash
# 1. 대상 확인
POST /api/groups/grp_id/blast
{ message: "[고객명]님, 특가!", dryRun: true }
→ willSend: 180명

# 2. 실제 발송
POST /api/groups/grp_id/blast
{ message: "[고객명]님, 특가!", dryRun: false }
→ sentCount: 180, blockedCount: 15, failedCount: 5
```

### 4. 권한 검증 (IDOR 방지)
```bash
# AGENT user1이 다른 조직의 고객을 자신 그룹에 추가 시도
POST /api/groups/grp_user1/members
{ contactIds: ["contact_org2"] }

# 백엔드: organizationId 검증
const validContacts = await prisma.contact.findMany({
  where: {
    id: { in: ["contact_org2"] },
    organizationId: org1  ← contact_org2는 org2 소유
  }
});
// 결과: 빈 배열
→ 400 "유효한 고객이 없습니다"
```

---

## 📝 로깅 이벤트

```
[GroupCreate]          그룹 생성
[GroupUpdate]          그룹 수정
[GroupDelete]          그룹 삭제
[GroupMember]          고객 추가 (퍼널 트리거)
[GroupClone]           그룹 복제
[GroupExport]          내보내기
[GroupImport]          가져오기
[GroupBlast]           SMS 발송
[AutoCreateGroupToken] 토큰 자동 생성
[CreateGroupToken]     토큰 수동 생성
[RefreshGroupToken]    토큰 갱신
[DeactivateGroupToken] 토큰 비활성화
[GroupRegister]        공개 등록 신청
[FunnelTrigger]        퍼널 시작
```

---

## 🛡️ 보안 체크리스트

- [x] IDOR 방지: organizationId 검증
- [x] 권한 검증: role 기반 필터링
- [x] SQL Injection: Prisma 파라미터화
- [x] 토큰 검증: active, expiresAt
- [x] 메시지 검증: 길이 제한 (1000자)
- [x] 배치 제한: 200명 (DDoS 방지)
- [x] 트랜잭션: 원자적 삭제
- [x] 민감 데이터: Contact 직접 노출 없음

---

## 📚 문서 참고

### 코드 위치
```
/src/app/(dashboard)/groups/page.tsx        → UI
/src/app/api/groups/**/*.ts                 → API
/prisma/schema.prisma                       → 데이터 모델
/src/lib/funnel-trigger.ts                  → 퍼널 로직
/src/lib/aligo.ts                           → SMS 발송
```

### 관련 기능
- Funnel (퍼널)
- VipCareSequence (VIP 케어)
- CrmLandingPage (랜딩페이지)
- SmsOptOut (수신거부)

---

## 🚀 다음 단계

### 단기 (1-2주)
1. **그룹 상세 모달 구현**
   - 탭: 고객, 스크립트, 설정
   - 고객 리스트 테이블
   - 토큰 관리 UI

2. **UI/UX 정제**
   - 반응형 디자인 테스트 (모바일/태블릿)
   - 로딩 상태 개선
   - 토스트 알림 추가

3. **통합 테스트**
   - 퍼널 자동 시작 검증
   - SMS 발송 실제 테스트
   - 권한 시나리오

### 중기 (3-4주)
1. 계층 구조 지원 (parentGroupId)
2. 담당자 할당 기능
3. 고객 성능 분석

### 장기 (1개월+)
1. 그룹별 대시보드
2. 벌크 고객 업로드
3. 동적 세그먼테이션 규칙

---

## 📞 문의사항 FAQ

### Q: 그룹을 삭제하면?
A: ContactGroupMember 삭제, GroupToken 삭제, ContactGroup 삭제 (트랜잭션). Contact는 유지.

### Q: 한 고객이 여러 그룹에 속할 수 있나?
A: 네. ContactGroupMember는 N:M 관계.

### Q: 퍼널 실패하면?
A: 그룹 배정은 성공으로 응답 (fire-and-forget). 로그만 기록.

### Q: 토큰 만료되면?
A: 새 토큰 생성 또는 기존 토큰 갱신 (PATCH). 만료된 토큰으로는 등록 불가.

### Q: SMS 발송 비용?
A: 조직의 Aligo 계정에서 차감.

---

## 📞 연락처

**마비즈 CRM 개발팀**
- 프로젝트: mabiz-crm
- 저장소: D:\mabiz-crm
- 코드 리뷰 체크리스트: PARTNER_DASHBOARD_CODE_REVIEW.json

---

**최종 작성**: 2026-05-16  
**상태**: 분석 완료 (구현 85%, UI 정제 필요)  
**다음 리뷰**: 다음 세션 시작 시 P1 작업 진행
