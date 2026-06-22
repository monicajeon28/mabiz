# 마비즈 CRM 메뉴맵 (2026-06-22)

## 📊 권한 체계 개요

### 역할 계층 (RBAC: Role-Based Access Control)
```
GLOBAL_ADMIN (관리자, 레벨 100)
    ├── 모든 조직의 DB 접근 + 삭제 권한
    └── 감사 로그, 백업, 웹훅 모니터링 가능

OWNER (대리점장, 레벨 50)
    ├── 자기 조직 전체 DB 접근
    ├── 소속 AGENT(판매원) DB 접근
    └── 마케팅 + 랜딩페이지 + 이메일/문자 퍼널 관리 가능

AGENT (판매원, 레벨 40)
    ├── 할당된 고객만 접근 (createdBy / assignedUserId / sharedWith)
    ├── 삭제 불가 (소프트삭제만)
    └── 마케팅/랜딩페이지 접근 불가

FREE_SALES (프리세일즈, 레벨 10)
    ├── 고객 DB 접근 불가
    └── 내 판매 현황 + 어필리에이트 링크만 접근 가능

UNKNOWN (미인증, 레벨 0)
    └── 공개 페이지만 접근 가능
```

### 권한 검사 파일들
- `src/lib/rbac.ts` — 핵심 RBAC 함수 (buildContactWhere, maskContactInfo, canDelete 등)
- `src/lib/route-rules.ts` — URL 경로별 접근 규칙 (15개 규칙)
- `src/components/layout/SidebarNav.tsx` — 사이드바 메뉴 필터링 (역할별 표시/숨김)

---

## 🗂️ 전체 메뉴맵

### **섹션 1: CRM** (모든 역할, 일부 OWNER/GLOBAL_ADMIN만)

| # | 메뉴명 | 파일경로 | 허가 역할 | 권한 검사 상태 |
|----|--------|---------|---------|--------------|
| 1 | 대시보드 | `/dashboard` | 모두 (로그인 필수) | ✅ MEMBER+ (route-rules) |
| 2 | 고객 관리 | `/contacts` | 모두 | ✅ 역할별 필터 (buildContactWhere) |
| 3 | 문의 고객 | `/contacts/inquiries` | 모두 | ✅ 역할별 필터 |
| 4 | 구매 고객 | `/contacts/purchased` | 모두 | ✅ 역할별 필터 |
| 5 | DB 관리 | `/db` | 모두 | ✅ 역할별 필터 |
| 6 | 교육 구매자 | `/b2b/buyers` | OWNER, GLOBAL_ADMIN | ✅ 사이드바 필터 |
| 7 | 교육 문의자 | `/b2b/inquirers` | OWNER, GLOBAL_ADMIN | ✅ 사이드바 필터 |
| 8 | 팀 성과 | `/team` | OWNER, GLOBAL_ADMIN | ✅ 사이드바 필터 |
| 9 | 전체 고객(관리자) | `/contacts/all` | GLOBAL_ADMIN | ✅ route-rules 차단 (OWNER/AGENT → /contacts로 리다이렉트) |
| 10 | 어필리에이트 성과 | `/team/affiliate` | GLOBAL_ADMIN | ✅ 사이드바 필터 |
| 11 | 대리점 관리 | `/admin/organizations` | GLOBAL_ADMIN | ✅ route-rules (/admin/*) |

---

### **섹션 2: GMcruise** (GLOBAL_ADMIN, OWNER, AGENT - FREE_SALES 제외)

| # | 메뉴명 | 파일경로 | 허가 역할 | 권한 검사 상태 |
|----|--------|---------|---------|--------------|
| 12 | 판매 관리 | `/affiliate-sales` | OWNER, GLOBAL_ADMIN | ✅ 사이드바 필터 + API 권한 |
| 13 | 골드회원 | `/gold-members` | 모두 | ✅ 역할별 필터 |
| 14 | 골드문의 | `/gold-inquiries` | 모두 | ✅ 역할별 필터 |
| 15 | 급여명세 | `/payslips` | 모두 | ✅ 개인/조직/env resolve |
| 16 | 커미션 원장 | `/commission-ledger` | OWNER, GLOBAL_ADMIN | ✅ 사이드바 필터 |
| 17 | 연말정산 | `/year-end-report` | OWNER, GLOBAL_ADMIN | ✅ 사이드바 필터 |
| 18 | 상품 관리 | `/products` | OWNER, GLOBAL_ADMIN | ✅ 사이드바 필터 |
| 19 | 크루즈닷 회원관리 | `/members` | GLOBAL_ADMIN | ✅ 사이드바 필터 |
| 20 | 어필리에이트 발급 | `/affiliate-issuance` | GLOBAL_ADMIN | ✅ 사이드바 필터 |
| 21 | 여권 관리 | `/passport` | OWNER, GLOBAL_ADMIN | ✅ 사이드바 필터 |
| 22 | APIS 관리 | `/passport/apis` | OWNER, GLOBAL_ADMIN | ✅ 사이드바 필터 |
| 23 | 파트너 현황 | `/partner-dashboard` | OWNER, GLOBAL_ADMIN | ✅ 사이드바 필터 |

---

### **섹션 3: 마케팅 캠페인** (GLOBAL_ADMIN, OWNER, AGENT - 일부 기능 제한)

| # | 메뉴명 | 파일경로 | 허가 역할 | 권한 검사 상태 |
|----|--------|---------|---------|--------------|
| 24 | 마케팅 대시보드 | `/marketing` | OWNER, GLOBAL_ADMIN | ✅ route-rules + 사이드바 필터 |
| 25 | 랜딩 매출관리 | `/marketing/sales` | OWNER, GLOBAL_ADMIN | ✅ route-rules + 사이드바 필터 |
| 26 | 문자 CRM | `/messages` | 모두 | ✅ SMS 채널 권한 (resolveUserSmsConfig) |
| 27 | 발송 기록 | `/sms-logs` | 모두 | ✅ 역할별 필터 |
| 28 | 자동문자 | `/funnel-sms` | OWNER, GLOBAL_ADMIN | ✅ route-rules (AGENT → /messages로 리다이렉트) |
| 29 | 자동이메일 | `/funnel-email` | OWNER, GLOBAL_ADMIN | ✅ route-rules |
| 30 | 랜딩페이지 | `/landing-pages` | MEMBER+, OWNER 이상 | ✅ route-rules (/landing-pages* 차단) |
| 31 | 결제 관리 | `/payments` | OWNER, GLOBAL_ADMIN | ✅ route-rules + 사이드바 필터 |
| 32 | 상담 링크 | `/links` | OWNER, GLOBAL_ADMIN | ✅ route-rules + 사이드바 필터 |
| 33 | 이미지 라이브러리 | `/image-library` | OWNER, GLOBAL_ADMIN | ✅ route-rules + organizationId 격리 |

---

### **섹션 4: 그룹관리** (모든 역할, AGENT도 가능)

| # | 메뉴명 | 파일경로 | 허가 역할 | 권한 검사 상태 |
|----|--------|---------|---------|--------------|
| 34 | 그룹 관리 | `/groups` | 모두 | ✅ 역할별 필터 (organizationId 기반) |

---

### **섹션 5: 영업 도구** (모두, 수익계산기는 GLOBAL_ADMIN만)

| # | 메뉴명 | 파일경로 | 허가 역할 | 권한 검사 상태 |
|----|--------|---------|---------|--------------|
| 35 | 영업 도구함 | `/tools` | 모두 | ✅ 호출 페이지 |
| 36 | 상품 교육 | `/training` | 모두 | ✅ 공개 |
| 37 | 콜 스크립트 | `/call-scripts` | 모두 | ✅ QA 라이브러리 (공개) |
| 38 | 수익 계산기 | `/tools/profit-calculator` | GLOBAL_ADMIN | ✅ route-rules 차단 (OWNER/AGENT → /tools로 리다이렉트) |

---

### **섹션 6: 정산·서류** (모두, 팀정산은 OWNER 이상)

| # | 메뉴명 | 파일경로 | 허가 역할 | 권한 검사 상태 |
|----|--------|---------|---------|--------------|
| 39 | 내 정산 내역 | `/statements` | 모두 | ✅ 개인 정산만 (userId 기반) |
| 40 | 팀 정산 | `/team-statements` | OWNER, GLOBAL_ADMIN | ✅ 사이드바 필터 |
| 41 | 계약서 관리 | `/contracts` | 모두 | ✅ 역할별 필터 |
| 42 | 서류 관리 | `/documents` | 모두 | ✅ 역할별 필터 |
| 43 | 계약서 템플릿 | `/contracts/templates` | GLOBAL_ADMIN | ✅ 사이드바 필터 |

---

### **특수: FREE_SALES 역할 (프리세일즈)**

| # | 메뉴명 | 파일경로 | 허가 역할 | 권한 검사 상태 |
|----|--------|---------|---------|--------------|
| 44 | 내 판매 현황 | `/my-sales` | FREE_SALES | ✅ 사이드바 분기 (isFreeSales 플래그) |

---

### **관리자 전용: /admin/** (GLOBAL_ADMIN만)

| # | 메뉴명 | 파일경로 | 허가 역할 | 권한 검사 상태 |
|----|--------|---------|---------|--------------|
| 45 | 대리점 관리 | `/admin/organizations` | GLOBAL_ADMIN | ✅ route-rules (/admin/*) |
| 46 | 파트너 정지 | `/admin/partner-suspensions` | GLOBAL_ADMIN | ✅ route-rules |
| 47 | 파트너 신청 | `/admin/partner-applications` | GLOBAL_ADMIN | ✅ route-rules |
| 48 | 대리점 매출 | `/admin/affiliate-sales-by-partner` | GLOBAL_ADMIN | ✅ route-rules |
| 49 | 매출 승인 | `/admin/affiliate/sales-confirmation` | GLOBAL_ADMIN | ✅ route-rules |
| 50 | 파트너 경고 | `/admin/affiliate/partner-alert` | GLOBAL_ADMIN | ✅ route-rules |
| 51 | 발송 모니터링 | `/admin/sending-monitor` | GLOBAL_ADMIN | ✅ route-rules |
| 52 | 웹훅 모니터링 | `/admin/webhook-monitor` | GLOBAL_ADMIN | ✅ route-rules |
| 53 | 웹훅 리포트 | `/admin/webhook-reports` | GLOBAL_ADMIN | ✅ route-rules |
| 54 | 감사 로그 | `/admin/audit-logs` | GLOBAL_ADMIN | ✅ route-rules |
| 55 | 백업 상태 | `/admin/backup-status` | GLOBAL_ADMIN | ✅ route-rules |
| 56 | 그룹 통계 | `/admin/groups-stats` | GLOBAL_ADMIN | ✅ route-rules |
| 57 | Loop5 대시보드 | `/admin/loop5/dashboard` | GLOBAL_ADMIN | ✅ route-rules |
| 58 | Loop5 A/B 테스트 | `/admin/loop5/ab-test-results` | GLOBAL_ADMIN | ✅ route-rules |

---

### **기타: 공개 페이지 & 특수 경로**

| # | 메뉴명 | 파일경로 | 허가 역할 | 권한 검사 상태 |
|----|--------|---------|---------|--------------|
| 59 | 계약서 서명 | `/contract/sign/[docId]` | PUBLIC | ✅ 토큰 기반 검증 |
| 60 | PNR 조회 | `/pnr/[reservationId]` | PUBLIC | ✅ route-rules (UNKNOWN) |
| 61 | 여권 서명 | `/passport/[token]` | PUBLIC | ✅ 토큰 기반 검증 |
| 62 | 구매확인 페이지 | `/confirm/[contactId]` | PUBLIC | ✅ 토큰 기반 검증 |
| 63 | 랜딩페이지 | `/p/[slug]` | PUBLIC | ✅ 토큰 기반 검증 |
| 64 | 403 Forbidden | `/403-forbidden` | PUBLIC | ✅ 에러 페이지 |

---

## 🔐 권한 검사 방식별 분류

### **1. 사이드바 필터** (UI 레벨)
- `SidebarNav.tsx`의 `roles` 배열로 메뉴 표시/숨김
- **메뉴는 숨겨지지만 URL 직접 접근은 가능** → API에서 재검증 필수

```typescript
// 예: 마케팅은 OWNER/GLOBAL_ADMIN만
{ href: "/marketing", icon: BarChart2, label: "마케팅 대시보드", 
  roles: ["GLOBAL_ADMIN", "OWNER"] },
```

### **2. Route Rules** (URL 리다이렉트)
- `route-rules.ts`의 ROUTE_RULES 배열로 15개 경로 제어
- **접근 불가시 자동 리다이렉트** (대체로 /contacts 또는 /403-forbidden)

```typescript
// 예: /marketing은 OWNER 이상만, 아니면 /contacts로 리다이렉트
{ pattern: '/marketing', requiredRole: 'OWNER', redirectTo: '/contacts' },
```

### **3. API 권한 검사** (서버 레벨)
- `getAuthContext()` → `buildContactWhere(ctx)` → WHERE 절 자동생성
- **role별로 다른 데이터 필터링**

```typescript
// OWNER: 자기 조직만
{ organizationId: ctx.organizationId, visibility: { not: 'ADMIN_ONLY' } }

// AGENT: 할당된/작성한/공유받은 고객만
{ organizationId, OR: [
  { assignedUserId: userId },
  { createdBy: userId },
  { sharedWith: { some: { sharedTo: userId } } }
] }
```

### **4. 데이터 마스킹** (PII 보호)
- `maskContactInfo(contact, ctx)` 함수로 phone/email/name 마스킹
- **역할별 마스킹 정책**:
  - GLOBAL_ADMIN: 마스킹 없음 (전체 PII 접근)
  - OWNER: 부분 마스킹 (010-XXXX-5678, u***@example.com)
  - AGENT: 할당된 고객은 전체, 공유받은 고객은 마스킹
  - FREE_SALES: 전체 마스킹

---

## 🚨 권한 검사 순서 (리스크 순서)

### **우선순위 1: API 권한 검사** (필수)
모든 POST/PATCH/DELETE 요청에서:
```typescript
const ctx = await getAuthContext(); // 미인증 시 throw
if (ctx.role === 'FREE_SALES') throw new Error('FREE_SALES_NO_ACCESS');
```

### **우선순위 2: URL 리다이렉트** (경로 제어)
- `/admin/*` → GLOBAL_ADMIN만 허가
- `/marketing` → OWNER 이상만 허가
- `/tools/profit-calculator` → GLOBAL_ADMIN만 허가

### **우선순위 3: 사이드바 필터** (UI 편의)
- 메뉴를 숨겨서 직관적 UX 제공
- **단, 직접 URL 접근은 불가** (route-rules 필요)

### **우선순위 4: 데이터 마스킹** (정보보호)
- API 응답 전에 `maskContactInfo()` 적용
- 공유받은 고객의 민감정보 보호

---

## 📋 현재 상태 체크리스트

### ✅ 완료된 권한 검사
- [x] RBAC 역할 계층 (4단계: GLOBAL_ADMIN > OWNER > AGENT > FREE_SALES)
- [x] buildContactWhere() → 고객 목록 자동 필터링
- [x] Route rules 15개 경로 (route-rules.ts)
- [x] 사이드바 메뉴 필터 (SidebarNav.tsx)
- [x] 데이터 마스킹 (phone/email/name)
- [x] 삭제 권한 제한 (GLOBAL_ADMIN/OWNER만)
- [x] 휴지통 조회 권한 (OWNER 이상)

### ⚠️ 개선 필요 (P2)
- [ ] FREE_SALES 미보호 경로: `/tools`, `/training`, `/call-scripts` (사이드바는 미표시이지만 URL 직접 접근 가능)
- [ ] 개별 페이지 별 getAuthContext() 추가 필요 (page.tsx 서버 렌더링)
- [ ] API 응답에 maskContactInfo() 일관적 적용 확인

---

## 🛠️ 개발 가이드

### API 엔드포인트 작성 시 필수 템플릿

```typescript
import { getAuthContext, buildContactWhere, canDelete } from '@/lib/rbac';

export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext(); // 미인증 시 자동 throw
    
    // 역할 기반 필터
    if (ctx.role === 'FREE_SALES') throw new Error('FREE_SALES_NO_ACCESS');
    
    // 고객 목록 조회 (자동 필터)
    const contacts = await db.contact.findMany({
      where: buildContactWhere(ctx, { /* 추가 필터 */ }),
    });
    
    // 데이터 마스킹
    return Response.json(contacts.map(c => maskContactInfo(c, ctx)));
  } catch (e) {
    return Response.json({ error: e.message }, { status: 403 });
  }
}
```

### 페이지 (page.tsx) 서버 렌더링 권한 검사

```typescript
import { getAuthContext } from '@/lib/rbac';
import { redirect } from 'next/navigation';

export default async function Page() {
  const ctx = await getAuthContext();
  
  // 권한 검사
  if (ctx.role === 'AGENT') {
    redirect('/contacts'); // 판매원은 마케팅 접근 불가
  }
  
  return <YourComponent />;
}
```

---

## 📊 통계

| 분류 | 개수 |
|------|------|
| 전체 메뉴 | 64개 |
| GLOBAL_ADMIN 전용 | 14개 |
| OWNER+ (OWNER/GLOBAL_ADMIN) | 20개 |
| FREE_SALES 전용 | 1개 |
| 공개 페이지 | 6개 |
| Route Rules | 15개 |
| RBAC 함수 | 15개+ |

---

**최종 업데이트**: 2026-06-22 | **버전**: 1.0 (CRM 메뉴맵 완성)
