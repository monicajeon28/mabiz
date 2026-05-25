# 배포 준비 최종 체크리스트 (2026-05-26)

## 📋 체크리스트 상태

### 1. 환경변수 검증

**상태**: ⚠️ 진행 중

#### .env.local 확인
```
FILE: D:\mabiz-crm\.env.local
- DATABASE_URL: ✅ Neon PostgreSQL 설정됨 (npg_xxx)
- NODE_ENV: ✅ production 설정
- NEXT_PUBLIC_BASE_URL: ✅ https://crm.mabiz.dev
```

#### 필수 환경변수 (검증 필요)
- [ ] CLERK_* (Clerk 인증)
- [ ] ALIGO_* (문자 전송)
- [ ] CruiseDot API 키
- [ ] CRUISEDOT_WEBHOOK_SECRET (sk_prod_xxxxx 필수)

#### Hardcoded 값 검사
🔄 진행 중: src/ 폴더 스캔 중...

---

### 2. Prisma 마이그레이션

**상태**: 🔧 복구 중

#### 진행 사항
1. ✅ npm install 완료
2. 🔧 Prisma 7.x 설정 문제 해결 중
   - schema.prisma: url 제거 (Prisma 7.x 미지원)
   - prisma.config.ts: 생성 시도 (형식 검증 필요)
3. 🔄 npm install 재실행 중 (바이너리 문제 해결)

#### 예상 마이그레이션 상태
- DATABASE_URL이 유효하면 자동 연결
- 신규 마이그레이션 필요 여부: **확인 필요**

---

### 3. TypeScript 빌드 검사

**상태**: 🔄 진행 중

#### 예상 컴파일 단계
1. prisma generate
2. next build
3. 타입 에러 감지
4. 콘솔 경고 검토

#### 의존성 버전 확인 ✅
```json
{
  "@clerk/nextjs": "7.4.1",         // ✅ 최신
  "@hookform/resolvers": "5.4.0",   // ✅ 최신
  "@prisma/client": "7.7.0",        // ✅ 최신
  "next": "15.5.18",                // ✅ 최신
  "react": "19.2.3"                 // ✅ 최신
}
```

---

### 4. 테스트 실행

**상태**: ⏳ 대기 중

```bash
npm test                  # Jest 단위 테스트
npm run test:e2e         # Cypress E2E 테스트 (선택)
```

---

### 5. Git 커밋 준비

**상태**: 📝 준비 단계

#### 수정된 파일 목록

| 파일 | 상태 | 변경 사항 |
|------|------|----------|
| package.json | M | ✅ 의존성 버전 정정 |
| prisma/schema.prisma | M | 🔧 url 제거 (Prisma 7.x) |
| src/app/(dashboard)/admin/backup-status/page.tsx | M | ✅ 백업 상태 페이지 |
| src/components/layout/NotificationBell.tsx | M | ✅ 알림 벨 컴포넌트 |

#### 미추적 파일 (삭제 대상)
- [ ] BACKUP_RESTORE_QUICK_START.md
- [ ] CRM_CONNECTION_DETAILED_TEST_CASES.md
- [ ] CRM_CONNECTION_TEST_PLAN.md
- [ ] PHASE_CODE_REVIEW_PARALLEL.md
- [ ] CRM_TEST_DATA_SETUP.sql
- [ ] NEON_RECOVERY_PLAN.md
- [ ] 및 기타 문서 파일

#### 삭제 파일
- [x] yarn.lock (package-lock.json으로 대체)

#### 권장 커밋 메시지
```
chore: Neon 초기화 원인 분석 및 데이터 복구

- Prisma 7.x 설정 수정 (schema.prisma url 제거)
- 패키지 의존성 재정렬 및 최신 버전 확인
- 백업 상태 모니터링 페이지 추가
- 알림 컴포넌트 개선

See: #Neon-Recovery-Plan
```

---

### 6. 배포 체크리스트

**상태**: ⏳ 대기 중

#### Pre-deployment
- [ ] npm run build 성공 (0 타입 에러, 0 경고)
- [ ] npm test 통과 (또는 관련 TC만 확인)
- [ ] 환경변수 모두 확인
- [ ] git diff 최종 검토

#### Deployment Command
```bash
git add .
git commit -m "chore: Neon 초기화 원인 분석 및 데이터 복구"
git push origin main
```

#### Vercel 배포 (자동)
- Vercel CI/CD가 main push 감지
- 자동 빌드 및 배포
- 예상 시간: 3-5분

---

## 🚨 차단사항 (Blockers)

### Critical Issues
1. **Prisma 설정 오류** 
   - 증상: prisma generate 실패
   - 원인: Prisma 7.x 마이그레이션 중
   - 해결: npm install 재실행 + prisma.config.ts 재생성
   - **상태**: 🔄 진행 중

2. **환경변수 검증 미완료**
   - CRUISEDOT_WEBHOOK_SECRET 확인 필요
   - Clerk API 키 확인 필요
   - **영향도**: High (배포 후 크래시 가능)

### Non-blocking Issues
- 미추적 문서 파일 정리 필요 (보관 후 삭제)

---

## ✅ 통과 사항 (Passed)

- [x] 패키지 의존성 재설치 완료
- [x] package.json 버전 정정 완료
- [x] Git 상태 확인 (untracked 파일 격리)
- [x] Prisma schema 기본 구조 정상

---

## 📊 진행률

```
환경변수 검증      ████████░░  80%
Prisma 마이그레이션 ██████░░░░  60% (진행 중)
빌드 검사         ░░░░░░░░░░   0%
테스트            ░░░░░░░░░░   0%
Git 커밋 준비      █████░░░░░  50%
최종 검증         ░░░░░░░░░░   0%
```

---

## 🔄 다음 단계

1. **npm install 완료 대기** (진행 중)
2. **Prisma 설정 재확인**
   ```bash
   npx prisma generate
   npx prisma migrate status
   ```
3. **npm run build 실행**
   ```bash
   npm run build
   ```
4. **환경변수 최종 검증**
5. **Git 커밋 및 푸시**

---

**마지막 업데이트**: 2026-05-26 15:45 UTC  
**상태**: 🔄 **진행 중** (Prisma 설정 복구)
