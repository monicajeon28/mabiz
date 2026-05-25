# Vercel 빌드 실패 원인 분석 - 문서 인덱스

**분석 완료**: 2026-05-26  
**총 이슈**: 4개 (P0: 2, P1: 1, P2: 1)  
**빌드 상태**: 🔴 차단됨 (P0 해결 필요)

---

## 📋 빠른 시작 (5분)

> **지금 해야 할 일**: 3개 파일의 JSON import 경로를 `@/../../` → `@/../`로 변경

### 최소 필요 작업

```bash
# 3개 파일에서 다음 변경
@/../../TRACK_A_OBJECTIONS.json  →  @/../TRACK_A_OBJECTIONS.json

# 영향 파일
1. src/lib/objections/validation.ts
2. src/app/(dashboard)/contacts/[id]/ContactCallTab.tsx
3. src/app/(dashboard)/contacts/[id]/page.tsx

# 검증
npm install && npx prisma generate && npm run build
```

---

## 📚 문서 가이드

### 1. 📄 **BUILD_ERROR_SUMMARY.txt** (지금 읽을 것)

**대상**: 모든 개발자  
**난이도**: 🟢 매우 쉬움  
**소요 시간**: 3분  
**포함 내용**:
- ✅ 발견된 4개 이슈 요약
- ✅ 즉시 해결책 (단계별)
- ✅ 예상 효과
- ✅ 다음 단계

**언제 읽을 것**:
- 현재 상황을 빠르게 파악하고 싶을 때
- 어떤 문서부터 읽어야 할지 모를 때

---

### 2. ⚡ **BUILD_ERROR_FIX_GUIDE.md** (다음에 읽을 것)

**대상**: 수정을 실행할 개발자  
**난이도**: 🟢 매우 쉬움  
**소요 시간**: 10분  
**포함 내용**:
- ✅ 3개 파일 수정 방법 (복사-붙여넣기 코드)
- ✅ 자동 수정 명령어 (Bash/PowerShell)
- ✅ 단계별 검증 방법
- ✅ 자주 묻는 질문 (FAQ)

**언제 읽을 것**:
- 실제 수정을 시작하기 전에
- 정확히 무엇을 어디서 바꿀지 알아야 할 때
- 자동 수정 스크립트가 필요할 때

**핵심 액션**:
```bash
# 1. 수정 실행 (복사-붙여넣기)
# 2. 검증 실행 (npm run build)
# 3. 커밋 푸시
```

---

### 3. 🔍 **FULL_BUILD_ERROR_AUDIT.md** (배경 이해)

**대상**: 기술 리더, 코드 리뷰어  
**난이도**: 🟡 중간  
**소요 시간**: 15분  
**포함 내용**:
- ✅ P0/P1/P2 에러 상세 분석
- ✅ 영향받는 기능 목록
- ✅ 각 에러의 해결책
- ✅ 체크리스트 및 검증 방법
- ✅ 예상 효과

**언제 읽을 것**:
- 배포 전에 모든 이슈를 이해하고 싶을 때
- 팀에 현황을 설명해야 할 때
- P1, P2 항목도 함께 처리하고 싶을 때

**섹션별 목차**:
1. 요약 (표)
2. P0 빌드 차단 에러 (2가지)
3. P1 배포 위험 (1가지)
4. P2 타입 경고 (1가지)
5. 수정 순서 및 우선순위
6. 최종 체크리스트

---

### 4. 📊 **BUILD_ERROR_TECHNICAL_ANALYSIS.md** (깊이 있는 이해)

**대상**: 백엔드 개발자, DevOps, 아키텍처 리뷰어  
**난이도**: 🟠 중상  
**소요 시간**: 20분  
**포함 내용**:
- ✅ 경로 해석 메커니즘 (TypeScript 관점)
- ✅ 번들러 (Turbopack) 관점의 실패 원인
- ✅ 로컬 vs 빌드 환경 차이
- ✅ 번들 분석 방법
- ✅ 근본 원인 분석 (RCA)
- ✅ 장기 솔루션 (구조 개선)
- ✅ 예방책

**언제 읽을 것**:
- 왜 이런 에러가 발생했는지 깊이 있게 이해하고 싶을 때
- 비슷한 에러를 다시 발생하지 않도록 하고 싶을 때
- 팀의 기술 표준을 개선하고 싶을 때

**핵심 섹션**:
1. 근본 원인: @/../../ 경로 문제
2. 파일 레벨 분석
3. 빌드 프로세스 상세
4. 실제 에러 메시지 분석
5. 장기 솔루션 (파일 구조 개선)

---

## 🎯 읽기 순서 가이드

### 시나리오 1: "빨리 수정하고 싶어" (5분)

```
1. 현재 문서 (3분 읽기)
   ↓
2. BUILD_ERROR_FIX_GUIDE.md (수정 실행, 5분)
   ↓
3. npm run build (검증, 2분)
   ↓
4. git push (배포, 1분)
```

### 시나리오 2: "정확히 이해하고 수정하고 싶어" (20분)

```
1. BUILD_ERROR_SUMMARY.txt (이해, 3분)
   ↓
2. FULL_BUILD_ERROR_AUDIT.md (분석, 10분)
   ↓
3. BUILD_ERROR_FIX_GUIDE.md (수정, 5분)
   ↓
4. npm run build (검증, 2분)
```

### 시나리오 3: "모든 것을 알고 싶어" (40분)

```
1. BUILD_ERROR_SUMMARY.txt (개요, 3분)
   ↓
2. FULL_BUILD_ERROR_AUDIT.md (상세 감사, 10분)
   ↓
3. BUILD_ERROR_TECHNICAL_ANALYSIS.md (기술 분석, 15분)
   ↓
4. BUILD_ERROR_FIX_GUIDE.md (수정 가이드, 5분)
   ↓
5. 수정 실행 및 검증 (7분)
```

---

## 📊 각 문서의 역할

| 문서 | 독자 | 핵심 질문 | 시간 | 액션 |
|------|------|----------|------|------|
| **SUMMARY.txt** | 모두 | 뭐가 잘못됐나? | 3min | 전체 파악 |
| **FIX_GUIDE.md** | 개발자 | 어떻게 고치지? | 10min | 수정 실행 |
| **AUDIT.md** | 리더 | 모든 이슈가 뭐지? | 15min | P1/P2도 처리 |
| **TECHNICAL.md** | 아키텍트 | 왜 이렇게? | 20min | 예방책 수립 |

---

## ⚡ 즉시 실행 체크리스트

### 5분 안에 하기

```
[ ] BUILD_ERROR_SUMMARY.txt 읽기
[ ] 3개 파일 위치 확인 (find 명령어)
[ ] @/../../ → @/../ 수정 (sed 또는 에디터)
[ ] npm install 실행
[ ] npx prisma generate 실행
[ ] npm run build 실행
[ ] 빌드 성공 확인
```

### 배포 전 체크

```
[ ] P0 에러 모두 수정
[ ] P1 권장 수정 (선택)
[ ] P2 타입 정정 (선택)
[ ] 로컬 npm run build 성공
[ ] /dashboard/contacts 페이지 로드 테스트
[ ] git commit 메시지 명확히 작성
[ ] git push origin main
[ ] Vercel 배포 로그 확인
[ ] 페이지 접속 테스트
```

---

## 🔗 파일 간 링크

```
BUILD_ERROR_SUMMARY.txt (현재 문서)
  ├→ READ NEXT: BUILD_ERROR_FIX_GUIDE.md (수정 방법)
  ├→ DETAILED: FULL_BUILD_ERROR_AUDIT.md (전체 분석)
  └→ TECHNICAL: BUILD_ERROR_TECHNICAL_ANALYSIS.md (원인 분석)

BUILD_ERROR_FIX_GUIDE.md
  ├→ BACK: BUILD_ERROR_SUMMARY.txt
  ├→ DETAILS: FULL_BUILD_ERROR_AUDIT.md
  └→ VERIFY: npm run build

FULL_BUILD_ERROR_AUDIT.md
  ├→ BACK: BUILD_ERROR_SUMMARY.txt
  ├→ HOW-TO: BUILD_ERROR_FIX_GUIDE.md
  └→ WHY: BUILD_ERROR_TECHNICAL_ANALYSIS.md

BUILD_ERROR_TECHNICAL_ANALYSIS.md
  └→ BACK: FULL_BUILD_ERROR_AUDIT.md
```

---

## 💡 핵심 포인트 (5초 요약)

**문제**: JSON import 경로가 잘못됨  
**위치**: 3개 파일  
**수정**: 한 글자 변경 (`@/../../` → `@/../`)  
**시간**: 5분  
**결과**: 빌드 성공

---

## 🚀 최종 명령어

```bash
# 한 번에 해결
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i "s|@/../../TRACK_A_OBJECTIONS\.json|@/../TRACK_A_OBJECTIONS.json|g" {} \;
rm -rf node_modules package-lock.json
npm install
npx prisma generate
npm run build
git add -A
git commit -m "fix: JSON import 경로 수정"
git push origin main
```

---

## 📞 도움말

**문서 읽는 데 막혔다면**:
- → BUILD_ERROR_FIX_GUIDE.md의 FAQ 섹션 확인

**수정하는 데 막혔다면**:
- → BUILD_ERROR_FIX_GUIDE.md의 "자동 수정 명령어" 복사-붙여넣기

**배포 후 에러가 나면**:
- → Sentry 대시보드에서 에러 확인
- → 브라우저 DevTools Console 확인

**장기적으로 이런 에러를 막으려면**:
- → BUILD_ERROR_TECHNICAL_ANALYSIS.md의 "예방책" 섹션 읽기

---

**작성**: 2026-05-26  
**상태**: ✅ 완료, 준비됨  
**다음 액션**: BUILD_ERROR_FIX_GUIDE.md로 이동
