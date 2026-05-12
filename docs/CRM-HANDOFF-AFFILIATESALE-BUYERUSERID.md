# [크루즈닷몰 → CRM 전달] AffiliateSale 테이블 컬럼 추가 안내

**전달일**: 2026-05-11  
**담당**: 크루즈닷몰 개발팀  
**수신**: mabiz CRM 개발팀  
**긴급도**: 일반 (기존 기능 영향 없음, 신규 컬럼 추가만)

---

## 요약 (한 줄)

> `AffiliateSale` 테이블에 `buyerUserId` 컬럼 1개를 추가했습니다.  
> CRM 기존 코드는 전혀 건드릴 필요 없습니다.

---

## 변경 내용

### 추가된 컬럼

| 항목 | 내용 |
|------|------|
| 테이블 | `AffiliateSale` |
| 컬럼명 | `buyerUserId` |
| 타입 | `INTEGER` (nullable) |
| 참조 | `User(id) ON DELETE SET NULL` |
| 목적 | 구매자(User) 직접 연결 — 기존에는 Reservation을 통해 간접 조회만 가능했음 |

### 추가된 인덱스

```sql
CREATE INDEX IF NOT EXISTS "AffiliateSale_buyerUserId_idx" ON "AffiliateSale"("buyerUserId");
```

---

## CRM팀이 해주셔야 할 것 (딱 2줄 SQL)

공유 Neon DB에 아래 SQL을 직접 실행해 주세요.

```sql
-- 1. 컬럼 추가
ALTER TABLE "AffiliateSale"
  ADD COLUMN IF NOT EXISTS "buyerUserId" INTEGER REFERENCES "User"(id) ON DELETE SET NULL;

-- 2. 인덱스 추가
CREATE INDEX IF NOT EXISTS "AffiliateSale_buyerUserId_idx"
  ON "AffiliateSale"("buyerUserId");
```

> `IF NOT EXISTS` / `IF NOT EXISTS` 구문이 있으므로 이미 적용됐어도 에러 없이 넘어갑니다.

---

## 기존 CRM 코드 영향 분석

| CRM 기존 작업 | 영향 |
|--------------|------|
| AffiliateSale.status 쓰기 | **영향 없음** — 컬럼 추가만, 기존 컬럼 변경 없음 |
| AffiliateSale.approvedAt 쓰기 | **영향 없음** |
| AffiliateSale 조회 (SELECT) | **영향 없음** — 새 컬럼은 nullable이라 기존 쿼리 결과 변화 없음 |
| AffiliateSale INSERT | **영향 없음** — buyerUserId는 크루즈닷몰 webhook이 자동 기록 |

**결론: CRM 코드 수정 불필요. SQL 실행만 해주시면 됩니다.**

---

## 기술 배경 (선택 읽기)

기존 구조:
```
AffiliateSale ──(Reservation.affiliateSaleId)──> Reservation ──> User
```

신규 구조:
```
AffiliateSale ──(buyerUserId)──────────────────────────────────> User  ← 직접 연결 추가
AffiliateSale ──(Reservation.affiliateSaleId)──> Reservation ──> User  ← 기존 유지
```

크루즈닷몰 결제 webhook이 구매 완료 시 자동으로 `buyerUserId`를 기록합니다.

---

## 기존 데이터 백필 (선택 사항)

신규 컬럼 적용 후, 기존 AffiliateSale 레코드에도 구매자를 소급 적용하려면:

```sql
UPDATE "AffiliateSale" s
SET "buyerUserId" = r."mainUserId"
FROM "Reservation" r
WHERE r."affiliateSaleId" = s.id
  AND r."mainUserId" IS NOT NULL
  AND s."buyerUserId" IS NULL;
```

> 선택 사항입니다. 실행 안 해도 신규 결제부터는 자동 기록됩니다.

---

## 문의

크루즈닷몰 개발팀으로 연락 주세요.
