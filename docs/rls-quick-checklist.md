# Supabase RLS P0 체크리스트 (24시간 내)

**우선순위**: P0 긴급 | **마감**: 2026-06-25  
**담당**: 보안팀 | **검증**: CI/CD 자동화

---

## 🚀 빠른 시작 (5분)

### 1단계: 가이드 읽기 (5분)
```bash
# 전체 가이드 읽기
cat docs/supabase-rls-setup-guide.md

# 핵심 정책만 보기
grep -A 10 "Policy 1:" docs/supabase-rls-setup-guide.md
```

### 2단계: Supabase 대시보드 열기 (2분)
```
1. https://app.supabase.com 접속
2. 프로젝트 선택: monicajeon28
3. 좌측 메뉴 > SQL Editor > New Query
```

### 3단계: RLS 정책 실행 (5분)
```
1. 가이드에서 "Policy 1: crm_backup" SQL 복사
2. SQL Editor에 붙여넣기
3. "Run" 버튼 클릭
4. ✅ "ALTER TABLE | Created policy" 확인
5. 정책 2-7 반복
```

---

## 📋 상세 체크리스트

### Phase 1: 사전 준비
- [ ] Supabase 프로젝트 로그인 (monicajeon28)
- [ ] Settings > Database > Connection Info 확인
- [ ] .env 파일에 SUPABASE_URL 있음
- [ ] .env 파일에 SUPABASE_SERVICE_ROLE_KEY 있음

**담당**: 보안팀 리드  
**예상 시간**: 5분  
**체크**: `echo $SUPABASE_SERVICE_ROLE_KEY` (값이 나와야 함)

---

### Phase 2: RLS 정책 실행 (Supabase 대시보드)

#### 정책 1: crm_backup
```sql
-- ✅ 실행 버튼: SQL Editor > Run
ALTER TABLE crm_backup ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full_access" ON crm_backup FOR ALL 
USING (auth.jwt() ->> 'role' = 'service_role' OR current_user_id IS NULL)
WITH CHECK (auth.jwt() ->> 'role' = 'service_role' OR current_user_id IS NULL);
CREATE POLICY "block_anonymous_users" ON crm_backup FOR ALL 
USING (auth.jwt() IS NOT NULL) WITH CHECK (false);
CREATE POLICY "org_admin_select" ON crm_backup FOR SELECT 
USING (auth.uid()::text = (SELECT user_id FROM organization WHERE id = crm_backup.org_id AND role = 'GLOBAL_ADMIN' LIMIT 1));
CREATE INDEX IF NOT EXISTS idx_crm_backup_org_created ON crm_backup(org_id, created_at DESC);
```

- [ ] SQL 복사 (docs/supabase-rls-setup-guide.md 정책 1)
- [ ] SQL Editor에 붙여넣기
- [ ] "Run" 버튼
- [ ] ✅ 성공 메시지 확인

**예상 출력**:
```
Query Executed Successfully
ALTER TABLE | Created policy "service_role_full_access" | ...
```

---

#### 정책 2-7: 나머지 테이블
- [ ] admin_message (정책 2)
- [ ] contact_backup (정책 3)
- [ ] payment_log (정책 4)
- [ ] user_session (정책 5)
- [ ] integration_log (정책 6)
- [ ] organization_secret (정책 7 - 가장 엄격함)

**각 정책마다:**
1. docs/supabase-rls-setup-guide.md에서 정책 SQL 복사
2. SQL Editor에 붙여넣기
3. "Run" 버튼
4. ✅ 성공 확인

**담당**: 보안팀 리드  
**예상 시간**: 15분 (7개 테이블 × 2분)  
**체크**: SQL Editor > History에서 모두 "Executed Successfully" 표시

---

### Phase 3: 시각적 검증 (Supabase 대시보드)
- [ ] Table Editor 열기
- [ ] crm_backup 테이블 선택
- [ ] "Row Level Security" 탭 클릭
- [ ] ✅ RLS enabled (초록 토글)
- [ ] ✅ 정책 3개 이상 표시

**각 테이블마다 반복**:
1. admin_message ✅
2. contact_backup ✅
3. payment_log ✅
4. user_session ✅
5. integration_log ✅
6. organization_secret ✅

**담당**: 보안팀 리드  
**예상 시간**: 5분  
**스크린샷**: 최종 증거로 저장

---

### Phase 4: 로컬 자동 검증
```bash
# 프로젝트 루트에서 실행
npx node scripts/validate-rls.mjs

# 예상 출력:
# ✅ crm_backup: RLS enabled, 3 policies found
# ✅ admin_message: RLS enabled, 2 policies found
# ...
# 🎉 모든 RLS 정책이 정상입니다!
```

- [ ] 스크립트 실행 (0 에러)
- [ ] 7개 테이블 모두 ✅ 확인
- [ ] 🎉 완료 메시지 출력

**담당**: 엔지니어  
**예상 시간**: 2분  
**체크**: `echo $?` = 0 (성공)

---

### Phase 5: API 테스트 (curl)

#### 5-1: Anon 키 차단 테스트
```bash
# Anon 키로 접근 시도 (차단되어야 함)
ANON_KEY="pk_anon_xxxxxxxxxxxx"  # .env에서 복사
PROJECT_ID="your-project-id"    # Supabase URL에서 복사

curl -X GET "https://${PROJECT_ID}.supabase.co/rest/v1/crm_backup?limit=1" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Content-Type: application/json"

# 예상:
# ❌ 403 Forbidden
# {"message":"The request violated a row level security policy"}
```

- [ ] Anon 키 접근 차단됨 ✅ (403)
- [ ] 에러 메시지: "row level security policy"

**담당**: 엔지니어  
**예상 시간**: 2분

---

#### 5-2: Service Role 접근 테스트
```bash
# Service Role 키로 접근 (성공해야 함)
SERVICE_ROLE_KEY="sk_service_role_xxxxxxxxxxxx"  # .env에서 복사

curl -X GET "https://${PROJECT_ID}.supabase.co/rest/v1/crm_backup?limit=1" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json"

# 예상:
# ✅ 200 OK
# [{"id":"...", "org_id":"...", ...}]
```

- [ ] Service Role 접근 성공 ✅ (200)
- [ ] 데이터 배열 반환됨

**담당**: 엔지니어  
**예상 시간**: 2분

---

### Phase 6: Vercel 환경변수 설정
- [ ] Vercel 대시보드 접속
- [ ] 프로젝트 선택
- [ ] Settings > Environment Variables
- [ ] SUPABASE_SERVICE_ROLE_KEY 추가
  - Key: `SUPABASE_SERVICE_ROLE_KEY`
  - Value: `sk_service_role_xxxxxxxxxxxx`
  - Environments: ✅ Production ✅ Preview
- [ ] "Save" 버튼

**담당**: DevOps  
**예상 시간**: 2분  
**검증**: Deployments > Preview에서 변수 확인

---

### Phase 7: 배포 후 검증
```bash
# 배포된 앱에서 Cron 실행
curl https://mabizcruisedot.com/api/cron/full-backup \
  -H "Authorization: Bearer $CRON_SECRET"

# 예상:
# ✅ 200 OK
# {"status":"success", "backedUpRows":123, ...}
```

- [ ] 배포 완료
- [ ] Cron 실행 성공 (200)
- [ ] Google Drive 백업 생성됨 (확인)

**담당**: DevOps + 엔지니어  
**예상 시간**: 5분  
**검증**: Google Drive > mabiz-crm-backup 폴더 확인

---

## 🎯 최종 체크리스트

```
[P0-1] Phase 1: 사전 준비
  ✅ Supabase 로그인
  ✅ 환경변수 확인

[P0-2] Phase 2: RLS 정책 실행 (7개 테이블)
  ✅ crm_backup
  ✅ admin_message
  ✅ contact_backup
  ✅ payment_log
  ✅ user_session
  ✅ integration_log
  ✅ organization_secret

[P0-3] Phase 3: 시각적 검증
  ✅ 모든 테이블 RLS enabled
  ✅ 정책 카운트 확인

[P0-4] Phase 4: 자동 검증
  ✅ npx node scripts/validate-rls.mjs 실행
  ✅ 0 에러

[P0-5] Phase 5: API 테스트
  ✅ Anon 키 차단 (403)
  ✅ Service Role 접근 (200)

[P0-6] Phase 6: Vercel 설정
  ✅ 환경변수 추가

[P0-7] Phase 7: 배포 검증
  ✅ Cron 실행 성공
  ✅ Google Drive 백업 확인

========================================
✅ 모든 항목 완료 → P0 종료
⏰ 마감: 2026-06-25
📞 담당: 보안팀 리드
```

---

## ⚠️ 문제 해결

### Q: "RPC 함수를 찾을 수 없음" 오류
**A**: Supabase 대시보드 > SQL Editor에서 수동으로 정책 확인
```sql
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE tablename = 'crm_backup'
ORDER BY tablename, policyname;
```

### Q: Anon 키로 접근했는데 데이터가 나옴
**A**: RLS 정책이 아직 적용 안 됨. 단계 재확인:
1. Supabase > Table Editor > crm_backup > Row Level Security
2. ✅ RLS enabled 토글 확인
3. 정책 목록 확인

### Q: Service Role 키로 접근해도 오류
**A**: service_role_key가 잘못됨:
```bash
# .env 파일 확인
grep SUPABASE_SERVICE_ROLE_KEY .env
# sk_service_role_xxxxx... 형태여야 함
```

### Q: 정책 실행 후 "Permission denied" 오류
**A**: 관리자 권한 필요. Supabase 프로젝트 소유자 계정으로 실행

---

## 📞 연락처

- **보안팀 리드**: [담당자명]
- **Slack**: #security-ops
- **이슈 추적**: GitHub Issues > P0 urgent
- **에스컬레이션**: Slack > security-incidents

---

**시작일**: 2026-06-24 | **마감**: 2026-06-25 | **상태**: P0
