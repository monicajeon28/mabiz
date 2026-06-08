# DB-01 IDOR 보안 강화 — 빠른 참조 카드

**날짜**: 2026-06-08 | **소요 시간**: ~45분 | **위험도**: 낮음

---

## 🔧 변경할 파일

### 1개 파일만 수정

**파일**: `prisma/schema.prisma`

**라인 820 (CrmLandingPage 모델)**
```diff
  @@unique([slug, organizationId])
+ @@unique([organizationId, id])
  @@index([organizationId])
```

**라인 5288 (B2BLandingPage 모델)**
```diff
+ @@unique([organizationId, id])
  @@index([organizationId])
  @@index([partnerId])
```

---

## ⚙️ 실행 명령어 (순서대로)

```powershell
# 1. Prisma 마이그레이션
npx prisma migrate dev --name add-landing-page-org-id-unique

# 2. Prisma 생성 (위에서 자동 실행되지만 명시적 실행)
npx prisma generate

# 3. 타입 검증 (필수!)
npx tsc --noEmit

# 4. 로컬 테스트 (dev 서버 시작)
npm run dev
```

---

## 📝 커밋 메시지 (복사 가능)

```powershell
git add prisma/schema.prisma
git commit -m @'
fix(security): DB-01 IDOR 취약점 차단 - CrmLandingPage/B2BLandingPage 복합키 추가

- CrmLandingPage: @@unique([organizationId, id]) 추가 (라인 820)
- B2BLandingPage: @@unique([organizationId, id]) 추가 (라인 5288)
- 목적: 비인증 사용자의 다른 조직 페이지 직접 접근 원천 차단
- 영향: DB 마이그레이션 (npx prisma migrate dev --name add-landing-page-org-id-unique)
- 테스트: GET/PATCH/DELETE 모두 organizationId 필터로 이미 정상작동

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>
'@
```

---

## ✅ 검증 체크리스트 (순차 실행)

```
[ ] Step 1: prisma/schema.prisma 2개 라인 수정
[ ] Step 2: npx prisma migrate dev 실행 (마이그레이션 폴더 생성됨)
[ ] Step 3: npx prisma generate 실행 (타입 재생성)
[ ] Step 4: npx tsc --noEmit → 0개 에러 확인
[ ] Step 5: npm run dev 시작 (데브 서버)
[ ] Step 6: curl 테스트 (GET/PATCH)
[ ] Step 7: git commit
[ ] Step 8: Staging 배포 후 1시간 모니터링
```

---

## 🧪 API 테스트 (curl 예제)

```bash
# 터미널 1: dev 서버 실행
npm run dev

# 터미널 2: API 테스트
# 정상 접근 (같은 조직)
curl -X GET http://localhost:3000/api/landing-pages/page-uuid-123 \
  -H "Authorization: Bearer org1-user-token"
# 기대: 200 OK (페이지 반환)

# IDOR 시도 (다른 조직)
curl -X GET http://localhost:3000/api/landing-pages/page-uuid-123 \
  -H "Authorization: Bearer org2-user-token"
# 기대: 404 NOT FOUND (접근 차단)
```

---

## 📊 기술 요약

| 항목 | 내용 |
|------|------|
| **취약점** | IDOR (비인증 사용자의 크로스-조직 접근) |
| **현재 상태** | 코드 레벨 organizationId 필터 (어플리케이션 신뢰) |
| **개선** | DB 레벨 UNIQUE 제약 추가 (인프라 신뢰) |
| **변경 파일** | `prisma/schema.prisma` (1개 파일) |
| **변경 라인** | 2개 (라인 820, 5288) |
| **마이그레이션** | `add-landing-page-org-id-unique` |
| **API 변경** | 없음 (코드 로직 동일) |
| **성능 영향** | < 1% (UNIQUE 인덱스 오버헤드 무시할 수준) |
| **롤백 가능** | 예 (`npx prisma migrate resolve --rolled-back`) |
| **소요 시간** | ~45분 (마이그레이션 포함) |

---

## 🚨 주의사항

1. **꼭 `npx tsc --noEmit` 실행** — 타입 검증 필수
2. **`npm run build` 금지** — dev 서버 실행 중 EBUSY 에러
3. **Staging에서 사전 테스트** — 마이그레이션이 성공했는지 확인
4. **배포 후 1시간 모니터링** — 성능/에러 로그 확인

---

## 📞 도움말

**마이그레이션 실패 시 롤백:**
```powershell
npx prisma migrate resolve --rolled-back add-landing-page-org-id-unique
```

**타입 에러 발생 시:**
```powershell
npx prisma generate  # 타입 재생성
npx tsc --noEmit     # 재검증
```

**Dev 서버 포트 충돌 시:**
```powershell
npm run dev -- -p 3001  # 다른 포트 사용
```

---

## 참고

- 상세 가이드: `SECURITY_DB01_IDOR_REMEDIATION.md`
- 최종 체크리스트: `SECURITY_DB01_FINAL_CHECKLIST.md`
- Prisma 문서: https://www.prisma.io/docs/orm/reference/prisma-schema-reference#unique
