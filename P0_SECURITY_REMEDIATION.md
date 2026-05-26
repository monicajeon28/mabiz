# P0 Critical Security Remediation Guide (2026-05-27)

## 상태: 2/7 커밋 완료 ✅

| ID | 문제 | 상태 | 담당 | 예상 | 
|----|------|------|------|------|
| ISS-01 | Contact 자동생성 missing | ✅ 완료 | Agent | 2026-05-27 |
| ISS-09 | Inventory sync 웹훅 missing | ✅ 완료 | Agent | 2026-05-27 |
| SEC-M5 | Session 삭제 에러 핸들링 | ✅ 완료 | Agent | 2026-05-27 |
| SEC-M1 | DB credentials 평문 저장 | ⏳ 대기 | **사용자** | 2026-05-27 |
| SEC-C1-C6 | cruisedot 보안 (6개) | ⏳ 대기 | **Agent** | 2026-05-28 |
| ISS-04 | Refund 시 SMS flag 초기화 | ⏳ 계획 | Agent | 2026-05-27 |

---

## 🔐 SEC-M1: 데이터베이스 자격증명 보안 (사용자 승인 필수)

### 현재 상태
```
.env.local (git untracked - 누수 위험 없음)
├── DATABASE_URL="postgresql://user:password@neon.local/db"
├── NEON_API_KEY="..."
└── SUPABASE_PASSWORD="..."
```

### 위험도
- **CRITICAL**: Commit history에 DB 자격증명이 있으면 `git log` 검색 → 탈취
- **영향**: Production 데이터베이스 직접 접근 가능

### 필요한 조치 (사용자 실행)

#### 1️⃣ Git history에서 민감 데이터 제거 (선택)
```bash
# ⚠️ 주의: 이 명령은 git history를 재작성합니다 (협업자 영향 가능)
# 단일 개발자 또는 main 보호 규칙이 있으면 괜찮음

git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch .env.local .env' \
  --prune-empty --tag-name-filter cat -- --all

# Verification
git log --all --source --full-history -- .env.local | head -10
# (output should be empty)

git log --all --source --full-history -- .env | head -10
# (output should be empty)
```

#### 2️⃣ Vercel 환경 변수 설정 (필수)
```bash
# Vercel Dashboard 또는 CLI로 설정
vercel env add DATABASE_URL
# 입력: postgresql://user:password@...

vercel env add NEON_API_KEY
# 입력: your-neon-api-key

vercel env add SUPABASE_PASSWORD
# 입력: your-supabase-password

# 모든 환경에서 활성화 확인 (Production, Preview, Development)
vercel env list
```

#### 3️⃣ .gitignore 확인
```bash
# .gitignore에 이미 .env* 패턴 있는지 확인
grep "\.env" .gitignore
# 없으면 추가
echo ".env.local" >> .gitignore
echo ".env.*.local" >> .gitignore
```

#### 4️⃣ 기존 커밋 감사 (선택)
```bash
# 최근 커밋에서 민감 문자열 검색
git log -p --all -S "postgresql://" | head -100
git log -p --all -S "password=" | head -100

# 발견되면 git filter-branch 실행
```

### 예상 시간
- 조치 없음: ~2분 (설정 이미 안전함)
- 히스토리 정리: ~10분 (force push 기다림)
- Vercel 설정: ~5분

---

## 🔓 Cruisedot 보안 이슈 (6개 - 별도 처리)

### 현재 코드베이스 위치
다음 경로가 **mabiz CRM**에 포함되어 있는지 확인 필요:
```
src/pages/api/accounts/create.ts     # SEC-C3: default password
src/pages/api/admin/...              # SEC-C2: plaintext admin password  
src/utils/flow/condition.ts          # SEC-C4: eval() RCE
src/middleware/cors.ts               # SEC-C6: CORS over-open
[Database]                           # SEC-C5: unencrypted PII
```

### cruisedot가 별도 폴더에 있으면
- 별도 전담 agent로 처리
- P0 fix commit batch 2 (cruisedot)로 진행

### cruisedot이 mabiz-crm/cruisedot에 있으면
- 아래 fixes 적용

---

## 📋 P0 Remaining Checklist

### mabiz CRM (3/7 ✅)
- [x] **ISS-01**: Contact 자동생성 (Payment webhook)
- [x] **ISS-09**: Inventory sync 웹훅
- [x] **SEC-M5**: Session 삭제 에러 핸들링
- [ ] **SEC-M1**: DB credentials 제거 (Vercel env vars)
- [ ] **ISS-02**: UPSERT 멱등성 강화 (Payment race condition)
- [ ] **ISS-04**: Refund 시 SMS flag 초기화
- [ ] **ISS-07**: Inquiry 담당자 자동할당

### cruisedot (0/6)
- [ ] **SEC-C1**: JWT 토큰 .env → Vercel
- [ ] **SEC-C2**: Admin 비번 평문 → bcrypt
- [ ] **SEC-C3**: Default 비번 제거
- [ ] **SEC-C4**: eval() → safe expression parser
- [ ] **SEC-C5**: PII 암호화 (residentId, bankAccount)
- [ ] **SEC-C6**: CORS whitelist (not null/*)

---

## ✅ Deployment Gating Checklist

**사용자가 Vercel 배포하기 전에 이 체크리스트 완료:**

```
[ ] 1. 모든 P0 커밋 (ISS-01, ISS-09, SEC-M5) 로컬에서 테스트
      - Payment webhook: Contact 없을 때 자동생성 확인
      - Inventory webhook: 재고 업데이트 확인
      - Logout: Session 삭제 에러 로그 확인

[ ] 2. 환경 변수 설정 (Vercel)
      - DATABASE_URL, NEON_API_KEY, SUPABASE_PASSWORD
      - CRUISEDOT_WEBHOOK_SECRET 추가
      - CRUISEDOT_INVENTORY_WEBHOOK_SECRET 추가 (신규)

[ ] 3. Webhook secret 생성 및 설정
      - MABIZ_INQUIRY_WEBHOOK_SECRET (확인)
      - CRUISEDOT_WEBHOOK_SECRET (확인)
      - CRUISEDOT_INVENTORY_WEBHOOK_SECRET (신규)

[ ] 4. cruisedot 웹훅 구성
      - 예약 생성 시 inventory 웹훅 활성화
      - 웹훅 URL: https://mabiz.vercel.app/api/webhooks/cruisedot-inventory

[ ] 5. 데이터 마이그레이션 (선택)
      - 기존 좀비 세션 정리: DELETE FROM mabizSession WHERE createdAt < NOW() - INTERVAL '30 days'
      - 기존 Contact 정합성 확인

[ ] 6. Production 모니터링 활성화
      - Sentry 에러 추적 확인
      - Daily check workflow 확인
      - Weekly report 수신 확인
```

---

## 🚀 커밋 이력

| Commit | 내용 | 시간 |
|--------|------|------|
| `28e2c57` | fix(webhooks): Contact & Inventory sync [ISS-01, ISS-09] | 2026-05-27 |
| `9ac0f58` | fix(auth): Session 삭제 에러 핸들링 [SEC-M5] | 2026-05-27 |

---

## 📌 다음 단계 (사용자 승인 필요)

```
1. 위 P0 커밋 3개 로컬 테스트 완료
   ↓
2. SEC-M1 (DB credentials) 조치 여부 결정
   - 조치 필요 → git filter-branch 실행 (협업 영향 있음)
   - 조치 불필요 → Vercel env vars만 설정 (권장)
   ↓
3. 나머지 P0 이슈 (ISS-02/04/07, SEC-C1-6) 우선순위 결정
   - High: ISS-02 (race condition), ISS-04 (refund)
   - Medium: ISS-07 (assign), SEC-C* (cruisedot)
   ↓
4. Vercel 배포 결정
   - "Vercel 배포는 내가 결정해"
   - Agent는 커밋까지만 준비 완료
```

---

**작성**: 2026-05-27 | **담당**: User + Agent | **상태**: 3/7 완료, 사용자 대기 중
