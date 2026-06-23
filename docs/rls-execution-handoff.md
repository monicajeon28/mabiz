# RLS P0-1/4 실행 인수인계서

**상태**: 준비 완료 | **마감**: 2026-06-25 09:00 UTC  
**담당**: 보안팀 | **검증**: CI/CD 자동화

---

## 📦 산출물 (완성 상태)

### ✅ 1. 구현 가이드
**파일**: `docs/supabase-rls-setup-guide.md`

**내용**:
- [x] Phase 1: 사전 준비 (Supabase 프로젝트 확인)
- [x] Phase 2: RLS 정책 설정 (7개 테이블 SQL 정책)
- [x] Phase 3: 검증 (자동 스크립트 + curl 테스트)
- [x] Phase 4: 코드 변경 (필요시 검토)
- [x] Phase 5: 모니터링 & 롤백
- [x] Phase 6: Vercel 배포

**사용 방법**:
```bash
# 전체 읽기
cat docs/supabase-rls-setup-guide.md

# 특정 정책만 보기
grep -A 30 "Policy 1: crm_backup" docs/supabase-rls-setup-guide.md
```

---

### ✅ 2. 자동 검증 스크립트
**파일**: `scripts/validate-rls.mjs`

**기능**:
- [x] SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY 환경변수 확인
- [x] 7개 테이블 RLS 정책 조회
- [x] 정책 개수 확인 (1개 이상)
- [x] 타이밍: Phase 3 자동 검증용

**실행**:
```bash
# 로컬 검증
npx node scripts/validate-rls.mjs

# 예상 출력:
# ✅ crm_backup: RLS enabled, 3 policies found
# ✅ admin_message: RLS enabled, 2 policies found
# ...
# 🎉 모든 RLS 정책이 정상입니다!

# 종료 코드: 0 (성공) 또는 1 (실패)
```

---

### ✅ 3. 빠른 체크리스트
**파일**: `docs/rls-quick-checklist.md`

**내용**:
- [x] Phase 1-7 단계별 체크리스트
- [x] 각 Phase별 담당자 + 예상 시간
- [x] curl 테스트 명령어 포함
- [x] 문제 해결 FAQ

**사용 방법**:
```
1. docs/rls-quick-checklist.md 열기
2. Phase 1-7 순서대로 진행
3. 각 항목 완료 시 [✅] 체크
4. 증거 스크린샷 저장
```

---

## 🎯 실행 순서 (담당자별)

### 담당자: 보안팀 리드

**Phase 1 (5분)**: 사전 준비
```
1. Supabase > https://app.supabase.com 로그인
2. 프로젝트 선택: monicajeon28
3. Settings > Database > Connection Info 확인
4. .env 파일에 SUPABASE_URL 있는지 확인
5. .env 파일에 SUPABASE_SERVICE_ROLE_KEY 있는지 확인

✅ 체크:
- [ ] Supabase 로그인 완료
- [ ] 프로젝트 선택 완료
- [ ] 환경변수 2개 확인됨
```

**Phase 2 (15분)**: RLS 정책 실행
```
1. Supabase > SQL Editor > New Query
2. docs/supabase-rls-setup-guide.md 열기
3. "Policy 1: crm_backup" 섹션으로 이동
4. SQL 블록 전체 복사 (ALTER TABLE ... CREATE INDEX까지)
5. SQL Editor에 붙여넣기
6. "Run" 버튼 클릭
7. ✅ "ALTER TABLE | Created policy" 메시지 확인
8. 정책 2-7 반복

✅ 체크 (각 정책마다):
- [ ] crm_backup: ✅
- [ ] admin_message: ✅
- [ ] contact_backup: ✅
- [ ] payment_log: ✅
- [ ] user_session: ✅
- [ ] integration_log: ✅
- [ ] organization_secret: ✅
```

**Phase 3 (5분)**: 시각적 검증
```
1. Supabase > Table Editor
2. crm_backup 테이블 선택
3. "Row Level Security" 탭 클릭
4. ✅ RLS enabled (초록 토글)
5. ✅ Policies 섹션에 정책 3개 이상
6. 나머지 6개 테이블 반복

✅ 체크 (각 테이블마다):
- [ ] crm_backup: RLS ✅, Policies ✅
- [ ] admin_message: RLS ✅, Policies ✅
- [ ] contact_backup: RLS ✅, Policies ✅
- [ ] payment_log: RLS ✅, Policies ✅
- [ ] user_session: RLS ✅, Policies ✅
- [ ] integration_log: RLS ✅, Policies ✅
- [ ] organization_secret: RLS ✅, Policies ✅

📸 스크린샷: crm_backup Row Level Security 탭 (증거용)
```

---

### 담당자: 엔지니어

**Phase 4 (2분)**: 자동 검증
```bash
# 프로젝트 루트에서 실행
cd /d/mabiz-crm
npx node scripts/validate-rls.mjs

# 예상:
# 🔒 Supabase RLS 검증 시작...
# ✅ crm_backup: RLS enabled, 3 policies found
# ...
# 🎉 모든 RLS 정책이 정상입니다!

✅ 체크:
- [ ] 스크립트 실행 성공 (0 에러)
- [ ] 7개 테이블 모두 ✅
- [ ] 종료 코드 0

📝 결과:
종료코드: _____ (0이어야 함)
실패 테이블: _____ (없어야 함)
```

**Phase 5 (4분)**: API 테스트
```bash
# Anon 키 테스트 (차단되어야 함)
export ANON_KEY="pk_anon_xxxxxxxxxxxx"  # .env에서 복사
export PROJECT_ID="xxxxxxxxxxxx"         # Supabase URL에서 https://[PROJECT_ID].supabase.co
export SERVICE_ROLE_KEY="sk_service_role_xxxxxxxxxxxx"  # .env에서 복사

# 테스트 1: Anon 접근 차단
curl -X GET "https://${PROJECT_ID}.supabase.co/rest/v1/crm_backup?limit=1" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -w "\nHTTP Status: %{http_code}\n"

# 예상: 403 Forbidden

# 테스트 2: Service Role 접근 허용
curl -X GET "https://${PROJECT_ID}.supabase.co/rest/v1/crm_backup?limit=1" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -w "\nHTTP Status: %{http_code}\n"

# 예상: 200 OK + 데이터

✅ 체크:
- [ ] Anon 접근: 403 Forbidden (메시지: "row level security policy")
- [ ] Service Role: 200 OK + 데이터

📝 결과:
Anon 상태코드: _____ (403이어야 함)
Service Role 상태코드: _____ (200이어야 함)
```

---

### 담당자: DevOps

**Phase 6 (3분)**: Vercel 환경변수 설정
```
1. Vercel 대시보드 > mabizcruisedot 프로젝트 선택
2. Settings > Environment Variables
3. "Add New" 버튼
4. 입력:
   - Key: SUPABASE_SERVICE_ROLE_KEY
   - Value: sk_service_role_xxxxxxxxxxxx (copy from .env)
   - Environments: ✅ Production, ✅ Preview
5. "Save" 버튼

✅ 체크:
- [ ] 환경변수 생성 완료
- [ ] Production 체크 ✅
- [ ] Preview 체크 ✅
- [ ] 저장 완료

📝 결과:
변수명: SUPABASE_SERVICE_ROLE_KEY
환경: Production, Preview
생성 시각: _____ (UTC)
```

**Phase 7 (5분)**: 배포 후 검증
```bash
# Vercel에 변수가 반영되었는지 확인 (배포 후 3-5분)

# Cron 테스트
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://mabizcruisedot.com/api/cron/full-backup

# 예상:
# ✅ 200 OK
# {"status":"success","backedUpRows":123,...}

# Google Drive 확인
# 1. Google Drive 열기
# 2. "mabiz-crm-backup" 폴더 확인
# 3. 최신 타이밍에 파일 생성됨

✅ 체크:
- [ ] Cron 상태코드: 200
- [ ] Google Drive 백업 파일 생성됨
- [ ] 타이밍: 최근 24시간 내

📝 결과:
Cron 상태코드: _____ (200이어야 함)
백업 파일명: _____ (예: crm_backup_2026-06-24.json)
생성 시각: _____ (UTC)
```

---

## 📊 진행 상황 추적 (Daily Standup 용)

### 🟢 Day 1 (2026-06-24)

**Morning (09:00 UTC)**
```
- [ ] Phase 1 완료 (보안팀 리드)
- [ ] Phase 2 완료 (보안팀 리드)
- [ ] Phase 3 완료 (보안팀 리드)
```

**Afternoon (14:00 UTC)**
```
- [ ] Phase 4 완료 (엔지니어)
- [ ] Phase 5 완료 (엔지니어)
```

**Evening (18:00 UTC)**
```
- [ ] Phase 6 완료 (DevOps)
- [ ] Phase 7 검증 준비
```

---

### 🟡 Day 2 (2026-06-25)

**Morning (09:00 UTC)**
```
- [ ] Phase 7 완료 (DevOps)
- [ ] 최종 검증 (모든 팀)
- [ ] P0 완료 판정
```

---

## 🚨 에스컬레이션 (문제 발생 시)

### 문제: RLS 정책 SQL 실행 오류
```
상황: SQL Editor에서 "Syntax Error" 또는 "Permission Denied"
대응:
  1. 오류 메시지 스크린샷 저장
  2. Slack #security-ops 채널에 보고
  3. docs/supabase-rls-setup-guide.md Phase 5 "롤백" 섹션 참고
  4. RLS 비활성화 후 재시도
```

### 문제: 자동 검증 스크립트 실패
```
상황: npx node scripts/validate-rls.mjs 실패
대응:
  1. 환경변수 확인: echo $SUPABASE_SERVICE_ROLE_KEY
  2. 스크린샷 + 에러 메시지 저장
  3. Slack에 보고
  4. Phase 3 (수동 검증)으로 진행
```

### 문제: Vercel 배포 안 됨
```
상황: 환경변수 설정 후 배포 실패
대응:
  1. Vercel > Deployments 확인
  2. 빌드 로그 확인
  3. SUPABASE_SERVICE_ROLE_KEY 값 재확인
  4. Settings > Deployment > Rebuild 클릭
```

---

## ✅ 완료 조건

모든 항목 완료:
```
[P0-1] 사전 준비 ✅
[P0-2] RLS 정책 실행 (7개 테이블) ✅
[P0-3] 시각적 검증 ✅
[P0-4] 자동 검증 스크립트 ✅
[P0-5] API 테스트 (Anon 차단 + Service Role 허용) ✅
[P0-6] Vercel 환경변수 설정 ✅
[P0-7] 배포 후 Cron 검증 ✅

최종 상태: ✅ P0 COMPLETE
```

---

## 📝 증거 수집 (최종 제출용)

모든 팀이 완료 후 아래 증거물 제출:

```
증거물 체크리스트:
- [ ] Supabase RLS 정책 스크린샷 (Table Editor > Row Level Security)
- [ ] SQL Editor 실행 결과 스크린샷 ("Query Executed Successfully")
- [ ] 자동 검증 스크립트 실행 결과 (터미널)
- [ ] curl 테스트 결과 (Anon 403 + Service Role 200)
- [ ] Vercel 환경변수 설정 스크린샷
- [ ] Google Drive 백업 파일 스크린샷
- [ ] 체크리스트 최종 완료 사진

보관 위치: docs/rls-completion-evidence/ (새 폴더)
정리: docs/RLS_P0_COMPLETED_2026-06-25.md (최종 보고)
```

---

## 🎯 최종 확인

```
날짜: ________
시간: ________ UTC
담당자: ________
상태: ✅ COMPLETE

서명: ________
```

---

**시작**: 2026-06-24 | **마감**: 2026-06-25 09:00 UTC | **상태**: 준비완료 ✅
