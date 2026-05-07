# 크루즈닷몰 → mabiz CRM 연동 인수인계서

> **작성일**: 2026-05-07  
> **수신**: 크루즈닷몰(GMcruise) 개발팀  
> **발신**: mabiz CRM 팀

---

## ✅ CRM 팀이 확인해줘야 할 것 (필수)

### 1. 파트너 가입 알림 시점 결정

`syncPartnerSignupToMabiz` 함수는 GMcruise 쪽에 이미 구현되어 있습니다.  
**이 함수를 어느 시점에 호출할지 CRM 팀이 답변**해주어야 합니다.

> **아래 셋 중 하나를 선택해주세요:**
>
> **A)** `AffiliateProfile` 생성 시 (계약서 없이 즉시 알림)  
> **B)** 계약서 서명 완료 시 (`/admin/affiliate/contracts/{id}/complete` API 호출 후)  
> **C)** 관리자가 파트너 상태를 `ACTIVE`로 변경한 시점

선택 결과에 따라 GMcruise 코드에서 호출 위치가 달라집니다.  
**결정 후 GMcruise 개발팀에게 회신 필요.**

---

### 2. CRM DB 마이그레이션 + 초기 계정 생성 완료 여부

`DB_SHARING.md` 7번 항목 기준으로 CRM 측이 아래를 실행했는지 확인:

```bash
# CRM 레포 루트에서 실행 (DATABASE_URL = 크루즈닷몰과 동일한 Neon 연결 문자열)
npx prisma migrate deploy        # CRM 전용 테이블 생성
node scripts/seed-global-admin.js  # 최초 로그인 계정 등록
```

> ⚠️ 이 두 명령을 실행하지 않으면 GMcruise 웹훅이 연결되어도  
> DB 쓰기 시 `relation does not exist` 오류가 납니다.

---

## 🔧 GMcruise 팀이 직접 해야 할 것 (CRM 불필요)

### 작업 1 — Vercel 환경변수 6쌍 추가

Vercel 대시보드 → **mabiz 프로젝트** → Settings → Environment Variables

아래 6개를 추가합니다 (값은 CRM 팀에서 전달받은 것 사용):

| 키 | 설명 |
|----|------|
| `DATABASE_URL` | 크루즈닷몰과 동일한 Neon 연결 문자열 |
| `MABIZ_SESSION_SECRET` | 세션 쿠키 서명 시크릿 (랜덤 64자) |
| `MABIZ_WEBHOOK_SECRET` | GMcruise → CRM 웹훅 인증 토큰 |
| `NEXT_PUBLIC_APP_URL` | CRM 배포 URL (예: `https://mabiz.vercel.app`) |
| `OPENAI_API_KEY` | AI 기능용 (없으면 AI 기능 비활성) |
| `ALIGO_API_KEY` | SMS 발송용 (없으면 SMS 비활성) |

```
# 생성 방법 (터미널에서 바로 복사·실행)
openssl rand -hex 32   # MABIZ_SESSION_SECRET 값으로 사용
openssl rand -hex 32   # MABIZ_WEBHOOK_SECRET 값으로 사용
```

---

### 작업 2 — GOLD_MEMBERSHIP 시드 실행

> GMcruise Neon 콘솔 → SQL Editor에 아래를 복사·실행

```sql
-- ProductInquiry FK 제약 해소용 — GOLD_MEMBERSHIP 상품 레코드 생성
-- 이미 존재하면 아무것도 하지 않음 (ON CONFLICT DO NOTHING)
INSERT INTO "CruiseProduct" (
  "productCode",
  "cruiseLine",
  "shipName",
  "packageName",
  "nights",
  "days",
  "itineraryPattern",
  "saleStatus",
  "isPopular",
  "isRecommended",
  "isPremium",
  "updatedAt"
)
VALUES (
  'GOLD_MEMBERSHIP',
  '크루즈닷',
  '-',
  '골드회원권',
  0,
  0,
  '[]'::jsonb,
  '판매중',
  false,
  false,
  false,
  NOW()
)
ON CONFLICT ("productCode") DO NOTHING;

-- 확인
SELECT id, "productCode", "packageName" FROM "CruiseProduct" WHERE "productCode" = 'GOLD_MEMBERSHIP';
```

또는 CRM 레포에 있는 스크립트를 실행해도 됩니다:

```bash
# mabiz-crm 레포 루트에서
npx tsx scripts/seed-gold-membership.ts
```

---

## 📋 전체 체크리스트

```
[ ] CRM 팀: 파트너 가입 알림 시점 A/B/C 중 선택 → GMcruise 팀에 회신
[ ] CRM 팀: npx prisma migrate deploy 실행 완료
[ ] CRM 팀: seed-global-admin.js 실행 → 최초 로그인 계정 생성 완료
[ ] GMcruise 팀: Vercel mabiz 프로젝트 환경변수 6개 추가
[ ] GMcruise 팀: GOLD_MEMBERSHIP 시드 SQL 실행 (Neon 콘솔 또는 스크립트)
[ ] 양쪽: 웹훅 연결 테스트 (파트너 1명 테스트 가입 → CRM 반영 확인)
```

---

## 🔗 참고 문서

- `docs/DB_SHARING.md` — 공유 테이블 명세 + 의존 컬럼 목록
- `scripts/seed-gold-membership.ts` — GOLD_MEMBERSHIP 시드 스크립트

---

_문의: mabiz CRM 팀 / 스키마 변경 전 반드시 양쪽 팀 협의_
