# 03. 몰 연동 규약 (DB 소유권 + provision API + 봉인 경로)

## 1. DB 소유권 규칙 (DB_SHARING 기준 + 정책 변경 반영)
- 두 시스템 **같은 Neon DB 공유**(SSoT=Neon). 별도 동기화/ETL 불필요 — 한쪽이 쓰면 다른 쪽이 즉시 읽음.
- 기존 명세(2026-05): `User`/`AffiliateProfile`/`AffiliateRelation` = **몰 소유, CRM 읽기 전용**.
- **정책 변경(2026-06): 발급(생성)을 CRM으로 이전** → 이 문서가 새 규약.

| 테이블 | 생성(write) | 운영 수정 | 조회 |
|---|---|---|---|
| `User` (어필리에이트) | **CRM** | 비번/상태=CRM, 기타 일부 몰 | 양쪽 |
| `AffiliateProfile` | **CRM** | 상태(정지/활성)·관계·표시정보=몰 가능 | 양쪽 |
| `AffiliateRelation` | CRM(발급 시) / 몰(재배정) | 몰 | 양쪽 |
| `AffiliateSale`/`CommissionLedger` | 몰(결제·정산) | 몰, CRM은 status만 | 양쪽 |

> 금지: `User`/`AffiliateProfile`/`AffiliateRelation`의 **컬럼 rename·삭제**(로그인·역할·정산 깨짐). 컬럼 추가는 ALTER만.

## 2. 발급 방식 2안 (CRM팀 선택)

### 방식 ① CRM이 DB에 직접 INSERT (권장: 가장 단순)
- CRM이 `User` + `AffiliateProfile` (+ 판매원이면 `AffiliateRelation`) 를 `01_데이터모델` 스펙대로 직접 생성.
- 같은 DB라 몰이 즉시 인식 → 로그인 가능.
- 발급 직후 **몰 provision API 호출**(아래)로 기본 링크·고객그룹 생성.

### 방식 ② CRM은 트리거만, 몰이 row 생성 (대안)
- CRM이 몰의 발급 API를 호출 → 몰이 User/Profile 생성 + 부수효과.
- 이 경우 몰에 "CRM 전용 발급 API"가 필요(provision을 발급까지 확장).

> 권장: **방식 ①** (계약·발급 주체가 CRM이라는 정책에 부합, 몰 발급경로 완전 봉인 가능).

## 3. 몰 provision API 규약 (발급 후 부수효과 생성용) — 신규
CRM이 row를 만든 뒤 호출하면 몰이 파트너몰 기본 셋업을 완성한다.

```
POST /api/internal/affiliate/provision
Authorization: Bearer <INTERNAL_PROVISION_SECRET>   # 신규 env, CRM과 공유
Content-Type: application/json

{
  "userId": 12345,                 # CRM이 만든 User.id (또는 mallUserId)
  "type": "SALES_AGENT",           # BRANCH_MANAGER | SALES_AGENT | PRE_SALES
  "managerProfileId": 678          # 판매원/프리세일즈면 소속 대리점장 profile.id (선택)
}
```
동작(몰):
1. `userId`로 AffiliateProfile 확인(없으면 400)
2. `autoSetupAffiliateProfile` → 기본 어필리에이트 링크 + 기본 고객그룹 생성
3. `syncSalesAgentMentor` → AffiliateRelation 보정(managerProfileId 있을 때)
4. 결과 `{ ok, links, customerGroupId }` 반환

> 이러면 "발급=CRM, 부수효과=몰"로 책임이 깔끔히 나뉜다(옵션 D). 멱등성 보장(이미 있으면 skip).

## 4. 몰에서 "봉인"할 발급 경로 4개 (CRM 준비 완료 후 차단)
CRM 발급이 셋업된 뒤에만 차단할 것. 차단 전엔 발급 공백 발생.

1. 🔴 **로그인 자동생성** — `app/api/auth/login/route.ts` (boss/sales/pre + 기본비번이면 자동 계정생성) → **최우선 차단**. 안 막으면 정책 무력화.
2. **인력관리 수동 발급** — `POST /api/admin/affiliate/profiles` 의 create 분기 → 차단(조회 GET은 유지)
3. **계약 승인 발급** — `POST .../contracts/[id]/approve` → 계약이 CRM이면 발급 제거(또는 엔드포인트 비활성)
4. (확인) **계약 완료** — `.../contracts/[id]/complete` 는 PDF/메일/동기화만(발급 X), 유지 가능

## 5. 현재 CRM 웹훅 현황(참고)
- `POST /api/webhooks/crm/affiliate-created` 존재(계약승인 수신). **단 User를 만들지 않고 조회만 → 없으면 skip.** 방식 ①(CRM 직접 INSERT) 채택 시 이 웹훅은 불필요하거나 보조용.
- 인증: HMAC(`CRUISEDOT_WEBHOOK_SECRET`).
