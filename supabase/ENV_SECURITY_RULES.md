# Supabase 환경변수 보안 규칙

**마지막 업데이트**: 2026-06-19

---

## 📋 환경변수 매트릭스

| 변수 | 값 | 로컬 (.env.local) | Vercel | 공개 (git) | 용도 |
|------|-----|-----|-----|-----|------|
| **SUPABASE_URL** | https://cnynywuxapxvythbcagz.supabase.co | ✅ 필수 | ✅ 필수 | ❌ 비공개 | Supabase 프로젝트 URL |
| **SUPABASE_ANON_KEY** | eyJ... (공개키) | ✅ 필수 | ✅ 필수 | ✅ 공개 OK | 클라이언트용, 브라우저 OK |
| **SUPABASE_SERVICE_ROLE_KEY** | eyJ... (비밀키) | ✅ 필수 (로컬만) | ✅ Secret (서버만) | ❌ **절대 금지** | 서버 API 전용 |
| **NEXT_PUBLIC_SUPABASE_URL** | https://cnynywuxapxvythbcagz.supabase.co | ✅ 필수 | ✅ 필수 | ✅ 공개 OK | 클라이언트용 (접두사: NEXT_PUBLIC_) |

---

## 🔐 보안 규칙

### Rule 1: SERVICE_ROLE_KEY는 git에 절대 노출 금지

```bash
# ❌ 절대 금지
git add .env.local
git commit -m "add secrets"
git push

# ✅ 올바른 방법
# .gitignore에 이미 추가됨
grep ".env.local" .gitignore  # 확인

# 실수로 커밋한 경우 (긴급 복구)
git rm --cached .env.local
git commit -m "remove .env.local from git history"
git push
```

### Rule 2: .env.local 파일 관리

```bash
# 로컬 개발 환경 (Windows)
# D:\mabiz-crm\.env.local

SUPABASE_URL="https://cnynywuxapxvythbcagz.supabase.co"
SUPABASE_ANON_KEY="eyJ..."  # 공개키, 괜찮음
SUPABASE_SERVICE_ROLE_KEY="eyJ..."  # 비밀키, 절대 git push 금지

# 파일 권한 설정 (Windows)
# icacls ".env.local" /grant:r "%USERNAME%:F" /inheritance:r
```

### Rule 3: Vercel 환경변수 설정 (서버 전용)

```bash
# Vercel 콘솔 → Settings → Environment Variables

1. SUPABASE_URL
   - Value: https://cnynywuxapxvythbcagz.supabase.co
   - Environment: Production / Preview / Development
   - Exposed: ❌ (브라우저 노출 안 함)

2. SUPABASE_SERVICE_ROLE_KEY
   - Value: eyJ... (복사해서 붙여넣기)
   - Environment: Production (서버에서만)
   - Exposed: ❌ (비밀)

3. SUPABASE_ANON_KEY
   - Value: eyJ... (공개키)
   - Environment: All
   - Exposed: ✅ (공개, 브라우저 OK)

4. NEXT_PUBLIC_SUPABASE_URL
   - Value: https://cnynywuxapxvythbcagz.supabase.co
   - Environment: All
   - Exposed: ✅ (공개, 접두사 NEXT_PUBLIC_)
```

### Rule 4: 코드에서 환경변수 사용

```typescript
// ✅ 올바른 사용법

// lib/supabase-server.ts (서버 전용)
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // ✅ 서버에서만 접근

// lib/supabase-client.ts (클라이언트)
const anonKey = process.env.SUPABASE_ANON_KEY; // ✅ 공개키
const anonKey2 = process.env.NEXT_PUBLIC_SUPABASE_URL; // ✅ NEXT_PUBLIC_ 접두사

// ❌ 절대 금지
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // 클라이언트 JS에서 금지
console.log(serviceRoleKey); // 브라우저 콘솔에 노출됨
```

### Rule 5: git 커밋 전 확인

```bash
# .env.local이 실수로 커밋될 위험이 있는지 확인
git status

# 절대 이렇게 하면 안 됨
git add .env.local  ❌
git add .env.*      ❌
git add *.local     ❌

# 현재 상태 확인
git ls-files | grep -E "\.env|secret|token|key"
# 결과: (출력 없어야 함 = 안전)
```

---

## ✅ 배포 전 체크리스트

### Phase 1: 로컬 개발 (Windows)

- [ ] .env.local 파일 생성
  ```bash
  # D:\mabiz-crm\.env.local
  SUPABASE_URL="https://cnynywuxapxvythbcagz.supabase.co"
  SUPABASE_ANON_KEY="eyJ..."
  SUPABASE_SERVICE_ROLE_KEY="eyJ..."
  NEXT_PUBLIC_SUPABASE_URL="https://cnynywuxapxvythbcagz.supabase.co"
  ```

- [ ] .gitignore 확인
  ```bash
  grep ".env.local" .gitignore
  # 결과: .env.local (또는 *.local)
  ```

- [ ] 절대 git add하지 않음
  ```bash
  git status | grep ".env.local"
  # 결과: (출력 없음 = 안전)
  ```

### Phase 2: Vercel 프로덕션

- [ ] Vercel 콘솔 로그인
  ```bash
  vercel login
  ```

- [ ] SUPABASE_SERVICE_ROLE_KEY 추가
  ```bash
  vercel env add SUPABASE_SERVICE_ROLE_KEY
  # 값: [Supabase 콘솔에서 복사]
  # Environment: Production
  ```

- [ ] SUPABASE_URL 추가
  ```bash
  vercel env add SUPABASE_URL
  # 값: https://cnynywuxapxvythbcagz.supabase.co
  # Environment: Production
  ```

- [ ] SUPABASE_ANON_KEY 추가
  ```bash
  vercel env add SUPABASE_ANON_KEY
  # 값: [Supabase 콘솔에서 복사]
  # Environment: Production
  ```

- [ ] NEXT_PUBLIC_SUPABASE_URL 추가
  ```bash
  vercel env add NEXT_PUBLIC_SUPABASE_URL
  # 값: https://cnynywuxapxvythbcagz.supabase.co
  # Environment: Production
  ```

- [ ] Vercel 환경변수 확인
  ```bash
  vercel env list
  ```

### Phase 3: git 보안 확인

- [ ] .env.local이 git에 없는지 확인
  ```bash
  git log --all --full-history -- ".env.local" | head
  # 결과: (출력 없음 = 안전)
  ```

- [ ] 최근 커밋에서 SECRET이 없는지 확인
  ```bash
  git show HEAD | grep -iE "secret|token|key|password" | head
  # 결과: (출력 없음 = 안전)
  ```

- [ ] 실수로 커밋한 경우 (긴급)
  ```bash
  # 모든 커밋 히스토리에서 .env.local 제거
  git filter-branch --tree-filter 'rm -f .env.local' -- --all
  
  # 강제 푸시 (위험! 팀 공지 필수)
  git push origin --force --all
  
  # Supabase에서 키 재발급 (필수!)
  ```

---

## 🔍 보안 감시 (모니터링)

### 자동 감시 (GitHub Actions)

```yaml
# .github/workflows/security-check.yml
name: Security Check

on: [push, pull_request]

jobs:
  secrets:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Scan for secrets
        uses: trufflesecurity/trufflehog@main
        with:
          path: ./
          base: ${{ github.event.repository.default_branch }}
          head: HEAD
```

### 수동 감시

```bash
# 로컬에서 비밀 스캔
npx trufflehog filesystem . --json | jq .

# git 히스토리에서 민감한 데이터 탐색
git log -p --all -S "SUPABASE_SERVICE_ROLE_KEY" | head -20

# 환경변수 파일 확인
ls -la .env*
```

---

## 📞 긴급 대응 (키 노출 시)

### Step 1: 즉시 조치 (5분 내)

```bash
# 1. Supabase에서 현재 키 확인
# → Supabase 콘솔 → Project Settings → API

# 2. 새로운 API 키 재발급
# → Supabase 콘솔 → 기존 키 삭제 → 새 키 생성

# 3. 모든 환경변수 업데이트
# → .env.local 수정 (로컬)
# → Vercel 환경변수 업데이트 (프로덕션)
```

### Step 2: git 히스토리 정리 (1시간 내)

```bash
# 모든 커밋 히스토리에서 비밀 제거
git filter-branch --tree-filter 'rm -f .env.local' HEAD
git push origin --force --all
```

### Step 3: 팀 공지 (즉시)

```
[긴급] Supabase 키 노출 대응 완료

1. 새로운 API 키로 재발급됨
2. 기존 키는 모두 비활성화됨
3. git 히스토리에서 제거됨
4. 모든 서버 배포 완료됨

다음 단계:
- 로컬 .env.local 업데이트 (새 키 사용)
- Vercel 배포 확인
- 테스트: /api/test/rls-validation
```

---

## 💡 FAQ

### Q1: NEXT_PUBLIC_ 접두사가 있으면 공개인가?

**A**: 네. `NEXT_PUBLIC_`로 시작하는 변수는 브라우저에 노출됩니다.

```typescript
// ✅ 공개 변수 (브라우저에서 접근 가능)
console.log(process.env.NEXT_PUBLIC_SUPABASE_URL);  // 브라우저 콘솔에서 보임

// ❌ 비공개 변수 (서버에서만)
console.log(process.env.SUPABASE_SERVICE_ROLE_KEY); // undefined (클라이언트)
```

따라서 **민감한 정보(키, 비밀번호)는 절대 NEXT_PUBLIC_ 접두사 사용 금지**.

### Q2: .env.local을 팀원과 공유하려면?

**A**: 절대 git을 사용하지 마세요. 대신:

```bash
# Option 1: LastPass, 1Password 등 보안 저장소
# → 각자 로컬에서 .env.local 파일 생성

# Option 2: Vercel 콘솔에서 개발 환경변수 공유
# → Vercel Settings → Environment Variables
# → Environment: Development (전체 팀이 접근)

# Option 3: AWS Secrets Manager (프로덕션)
# → 역할 기반 접근 제어 (IAM)
```

### Q3: CI/CD 파이프라인에서 환경변수를 사용하려면?

**A**: GitHub Secrets를 사용하세요.

```yaml
# .github/workflows/deploy.yml
env:
  SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - run: npm run build
        env:
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
```

---

## 📚 참고 자료

- [Supabase API Keys Security](https://supabase.com/docs/guides/auth/managing-user-data)
- [Next.js Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)
- [GitHub Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- [OWASP: Secrets Management](https://owasp.org/www-community/Sensitive_Data_Exposure)

---

**마지막 업데이트**: 2026-06-19  
**상태**: ✅ 준비 완료  
**담당자**: mabiz-crm Agent
