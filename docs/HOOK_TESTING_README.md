# Hook 시스템 테스트 최종 가이드

**버전**: 1.0  
**작성일**: 2026-05-24  
**상태**: 테스트 준비 완료

---

## 🎯 개요

마비즈 CRM의 **Hook 시스템**이 배포되었습니다. 이 문서는 Hook 1-4가 **실제로 작동하는지 검증**하기 위한 최종 가이드입니다.

| Hook | 기능 | 검증 기준 | 상태 |
|------|------|---------|------|
| **Hook 1** | Commit: 렌즈 감지 + 체크리스트 생성 | L1+L6 3/4 이상 | ✅ 준비 |
| **Hook 2** | PR: 자동 체크리스트 주입 | 항목 ≥3개, 정확도 ≥90% | ✅ 준비 |
| **Hook 3** | Merge: 메모리 자동 생성 | 파일 3개, 링크 100% | ✅ 준비 |
| **Hook 4** | Build: SMS/KPI 검증 | Day0-3 + KPI 완료 | ✅ 준비 |

---

## 📚 문서 구조

```
docs/
├── HOOK_TESTING_PLAN.md
│   └─ 전체 테스트 계획, 검증 기준, 예상 결과
│
├── HOOK_TEST_SCENARIOS.md
│   └─ 3일차 실행 가이드 (Step-by-step)
│   └─ Day 1: Hook 1-2 테스트
│   └─ Day 2: Hook 3-4 테스트
│   └─ Day 3: 통합 검증
│
├── HOOK_IMPLEMENTATION_DETAILS.md
│   └─ Hook 1-4 기술 사양 (구현 코드 포함)
│   └─ 검증 로직, 메모리 파일 생성 규칙
│
└── HOOK_TESTING_README.md (이 파일)
    └─ 빠른 시작 가이드
```

---

## 🚀 빠른 시작 (5분)

### Step 1: 현재 상태 확인
```bash
cd D:/mabiz-crm
git status
# 깨끗한 상태인지 확인
```

### Step 2: Day 1 테스트 실행
```bash
# Menu #41 파일에 L1/L6 주석 추가
code src/app/\(dashboard\)/statements/page.tsx

# Hook 1 검증 (자동 실행)
git add src/app/\(dashboard\)/statements/page.tsx
git commit -m "test(hook1): Menu #41 L1+L6 렌즈 테스트"

# 결과 확인
ls -la docs/CHECKLIST_*.md
cat docs/CHECKLIST_*.md
```

### Step 3: Day 2 테스트 실행
```bash
# Branch 생성 및 PR
git checkout -b test/hook2-menu41
git push -u origin test/hook2-menu41

# PR 생성 (Hook 2 자동 실행)
gh pr create --title "test(hook2): Menu #41 심리학 체크리스트"

# Merge (Hook 3 자동 실행)
gh pr merge --squash --delete-branch

# Build (Hook 4 자동 실행)
npm build
```

### Step 4: 결과 확인
```bash
# Hook 3 메모리 파일 생성 확인
ls -la ~/.claude/projects/D--mabiz-crm/memory/ | grep menu_41

# Hook 4 KPI 결과 확인
grep -E "응답율|KPI|효과" build.log
```

---

## ✅ 검증 체크리스트

### Hook 1: Commit 검증
```
☐ 체크리스트 파일 생성됨 (docs/CHECKLIST_*.md)
☐ L1 렌즈 감지됨 ("정산액 보호")
☐ L6 렌즈 감지됨 ("마감일 임박")
☐ PASONA 6단계 매핑 완성
☐ 실행 시간 <30초
```

### Hook 2: PR 검증
```
☐ PR Description에 체크리스트 자동 추가됨
☐ 체크 항목 ≥3개
☐ 심리학 적용도 % 계산됨
☐ PASONA 테이블 생성됨
☐ 정확도 ≥90%
☐ 실행 시간 <20초
```

### Hook 3: Merge 검증
```
☐ [[menu_41_statements_complete]] 메모리 파일 생성됨
☐ [[l1_lens_applied_menu_41]] 메모리 파일 생성됨
☐ [[l6_lens_applied_menu_41]] 메모리 파일 생성됨
☐ CLAUDE_RAG_INDEX.md 업데이트됨
☐ Cross-reference 링크 100% 무결
☐ 실행 시간 <45초
```

### Hook 4: Build 검증
```
☐ SMS Day 0 메시지 검증됨
☐ SMS Day 1 메시지 검증됨
☐ SMS Day 2 메시지 검증됨
☐ SMS Day 3 메시지 검증됨
☐ PASONA 6단계 매핑 완료
☐ 심리학 트리거 3개+ 감지됨 (Loss, Urgency, Scarcity)
☐ KPI 계산 완료 (응답율 18%, CPA $3.36, 월간 $2,100)
☐ Build 시간 <1분
```

### 종합 검증
```
☐ Hook 1-4 모두 순차 정상 작동
☐ 전체 성공률 ≥95%
☐ 심각한 오류 없음
☐ 거짓양성 <5%
☐ 거짓음성 <2%
```

---

## 🎓 사용 방법별 가이드

### 방법 1: 전체 테스트 (권장)
**소요 시간**: 4시간 (Day 1-3)

1. **HOOK_TESTING_PLAN.md** 읽기 (30분)
   - Hook 1-4 개요, 검증 기준 이해

2. **HOOK_TEST_SCENARIOS.md** 실행 (3시간)
   - Step-by-step 가이드 따라 실행
   - Day 1: Hook 1-2 테스트
   - Day 2: Hook 3-4 테스트
   - Day 3: 통합 검증

3. 결과 문서화
   - HOOK_TEST_REPORT_20260524.md 생성

---

### 방법 2: 빠른 검증 (30분)
**목표**: Hook 모두 작동 확인만 필요

```bash
# 1. Hook 1 검증
git add src/app/\(dashboard\)/statements/page.tsx
git commit -m "test: Hook 1"
ls docs/CHECKLIST_*.md  # ✓ 생성 확인

# 2. Hook 2 검증
git checkout -b test/hook2
git push -u origin test/hook2
gh pr create --title "test: Hook 2"
# PR Description 자동 업데이트 확인 ✓

# 3. Hook 3 검증
gh pr merge --squash
ls ~/.claude/projects/D--mabiz-crm/memory/ | grep menu_41  # ✓ 3개 파일

# 4. Hook 4 검증
npm build 2>&1 | grep "응답율"  # ✓ KPI 계산 확인
```

---

### 방법 3: 특정 Hook만 검증

#### Hook 1만 테스트
```bash
# Menu #41 수정 + 커밋
git add src/app/\(dashboard\)/statements/page.tsx
git commit -m "test(hook1): ..."

# 확인
cat docs/CHECKLIST_*.md
```

#### Hook 2만 테스트
```bash
# Branch + PR 생성
git checkout -b test/hook2
git push -u origin test/hook2
gh pr create --title "test(hook2): ..."

# PR Body 확인
gh pr view
```

#### Hook 3만 테스트
```bash
# Branch 병합
git merge test/hook2

# 메모리 파일 확인
ls ~/.claude/projects/D--mabiz-crm/memory/ | grep menu_41
```

#### Hook 4만 테스트
```bash
# Build 실행
npm build

# 로그 확인
grep "KPI\|응답율" build.log
```

---

## 📊 예상 결과 (Menu #41 기준)

### Hook 1: 체크리스트 예시
```markdown
# 심리학 검증 체크리스트 (2026-05-24)

## 감지된 렌즈
- [x] L1 (Loss Aversion)
- [x] L6 (Timing/FOMO)
- [ ] L3 (Differentiation)

## PASONA 매핑
- [x] P (Problem)
- [x] A (Agitate)
- [x] S (Solution)
- [x] O (Offer)
- [x] N (Narrow)
- [x] A (Action)

## 파일 목록
- src/app/(dashboard)/statements/page.tsx
```

### Hook 2: PR Description 예시
```
## 심리학 검증 (Hook 2 자동 생성)

### 적용된 렌즈
- [x] L1 (Loss Aversion)
- [x] L6 (Timing/FOMO)
- [ ] L3 (Differentiation)

### 심리학 적용도
**92%** (목표: 80% 이상) ✅ 배포 준비 완료
```

### Hook 3: 메모리 파일
```
생성되는 파일:
- [[menu_41_statements_complete]]
- [[l1_lens_applied_menu_41]]
- [[l6_lens_applied_menu_41]]
```

### Hook 4: Build 결과
```
✓ SMS 응답율 예상: 18.5%
✓ CPA: $3.36 (목표 -20% 달성)
✓ 월간 효과: $2,100
✓ ROI: 320%
```

---

## 🐛 문제 해결

### 문제 1: Hook 1이 체크리스트를 생성하지 않음
```bash
# 1. Hook 파일 존재 확인
ls .git/hooks/pre-commit

# 2. 권한 확인
chmod +x .git/hooks/pre-commit

# 3. 수동 실행
bash .git/hooks/pre-commit

# 4. 로그 확인
cat .claude/hook-logs/hook1_*.json
```

### 문제 2: Hook 2가 PR Description을 업데이트하지 않음
```bash
# 1. GitHub 연동 확인
gh auth status

# 2. PR 생성 로그 확인
gh pr create --help

# 3. 수동 업데이트
gh pr edit <PR_NUMBER> --body "$(cat template.md)"
```

### 문제 3: Hook 3이 메모리 파일을 생성하지 않음
```bash
# 1. 메모리 디렉토리 존재 확인
ls ~/.claude/projects/D--mabiz-crm/memory/

# 2. 권한 확인
chmod 755 ~/.claude/projects/D--mabiz-crm/memory/

# 3. 메모리 파일 수동 생성
# → HOOK_IMPLEMENTATION_DETAILS.md 참고하여 수동 생성
```

### 문제 4: Hook 4 Build 타임아웃
```bash
# 1. SMS 검증 로직 축소
# Day 0/3만 우선 검증으로 변경

# 2. 병렬 처리 활성화
# Promise.all() 사용으로 성능 개선

# 3. 캐시 추가
# 동일 파일 재검증 시 캐시 활용
```

---

## 📈 성공 기준

### 최소 요구사항 (80점)
```
☐ Hook 1-4 모두 실행됨
☐ 거짓양성 <10%
☐ 거짓음성 <5%
☐ 평균 실행 시간 <2분
```

### 권장 기준 (90점)
```
☐ Hook 1-4 모두 정상 작동
☐ 거짓양성 <5%
☐ 거짓음성 <2%
☐ 평균 실행 시간 <1분
```

### 우수 기준 (95점+)
```
☐ Hook 1-4 모두 완벽 작동
☐ 거짓양성 <2%
☐ 거짓음성 <1%
☐ 평균 실행 시간 <45초
```

---

## 🎯 테스트 후 다음 단계

### 배포 체크리스트
- [ ] Hook 테스트 완료 (HOOK_TEST_REPORT_*.md)
- [ ] 모든 Hook 성공률 ≥95%
- [ ] Menu #41-43 심리학 렌즈 적용 확인
- [ ] SMS Day0-3 시퀀스 검증 완료
- [ ] RAG 메모리 파일 3개+ 생성 확인

### 배포 (2026-05-27)
```bash
# 최종 커밋
git commit -m "test: Hook 시스템 배포 완료

✓ Hook 1: Commit 검증 (렌즈 감지)
✓ Hook 2: PR 체크리스트 자동 주입
✓ Hook 3: Merge 메모리 자동 생성
✓ Hook 4: Build SMS/KPI 검증

성공률: 95% 이상 달성
테스트 기간: 2026-05-24 ~ 2026-05-26"

# 배포
git push origin main
```

### 배포 후 모니터링
```bash
# 주간 Hook 성공률 추적
# → .claude/hook-logs/*.json 모니터링

# 월간 리포트 생성
# → Hook별 성과 메트릭 정리
```

---

## 📞 문의

- **Hook 관련 이슈**: `.claude/hook-logs/` 로그 확인
- **메모리 파일 누락**: `docs/CLAUDE_RAG_INDEX.md` 업데이트 확인
- **성능 문제**: Hook 4 build.log 확인

---

## 📝 참고 자료

| 문서 | 용도 |
|------|------|
| [HOOK_TESTING_PLAN.md](./HOOK_TESTING_PLAN.md) | 전체 계획, 검증 기준 |
| [HOOK_TEST_SCENARIOS.md](./HOOK_TEST_SCENARIOS.md) | Step-by-step 실행 가이드 |
| [HOOK_IMPLEMENTATION_DETAILS.md](./HOOK_IMPLEMENTATION_DETAILS.md) | 기술 상세 사양 |
| [CLAUDE_RAG_INDEX.md](./CLAUDE_RAG_INDEX.md) | RAG 메모리 인덱스 |

---

**버전**: 1.0  
**마지막 업데이트**: 2026-05-24  
**다음 리뷰**: 2026-05-31 (1주 운영 후)
