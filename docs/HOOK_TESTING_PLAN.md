# Hook 시스템 실제 작동 테스트 계획서 (v1.0)

**작성일**: 2026-05-24  
**담당자**: Claude Haiku 4.5  
**상태**: 배포 준비 단계 → 실제 테스트 단계

---

## 📋 문서 목적

Hook 시스템(settings.json hooks)이 **실제 개발 환경에서 정상 작동**하는지 검증하기 위한 체계적 테스트 계획입니다.

- **Range**: Menu #41-43 (최신 커밋 기반)
- **Goal**: Hook 1-4 모두 작동 확인, 거짓양성 <5%, 거짓음성 <2%
- **Performance**: 실행 시간 <1분 목표

---

## 🎯 Hook 4종류 및 검증 항목

### Hook 1: Commit 검증 (`before_commit`)
**목적**: 커밋 시 심리학 렌즈(SPIN/PASONA) 자동 체크

#### 1-1. 기본 검증 (메뉴 파일 수정)
```
시나리오: Menu #41 statements/page.tsx 수정 후 커밋
Expected Output:
  ✓ L1 (가격이의) 감지 여부 → {이의를_극복하기}
  ✓ L6 (시간 손실회피) 감지 여부 → {마감일_관리}
  ✓ PASONA 프레임워크 적용 여부 → {자극→해결→오퍼→좁혀진범위→행동}
  ✓ 체크리스트 자동 생성 → docs/CHECKLIST_{DATE}.md
Success Criteria: 3/4 이상 감지
```

**검증 데이터** (Menu #41 코드 분석):
- **L1 감지**: statements/page.tsx line 127-162 (월간 수당/절약 시뮬레이션)
- **L6 감지**: statements/page.tsx line 85-125 (정산 마감일 임박 알림, FOMO)
- **PASONA 매핑**: 
  - P(Problem): "정산액 누락/오류 위험"
  - A(Agitate): "마감일 3일 남았습니다"
  - S(Solution): "실시간 확인 가능"
  - O(Offer): "월간 수당 자동 계산"
  - N(Narrow): "지금 확인하고 조치하기"
  - A(Action): CTA 버튼

---

### Hook 2: PR 생성 검증 (`before_pr_create`)
**목적**: PR 생성 시 심리학 체크리스트 자동 주입

#### 2-1. PR 템플릿 생성
```
시나리오: Menu #41 관련 PR 생성
Expected Output:
  ✓ PR Description에 심리학 체크리스트 자동 추가
  ✓ 렌즈 3개 이상 체크 항목 포함
  ✓ 심리학 적용 확률(%) 자동 계산
  ✓ PASONA/SPIN 매핑 표 자동 생성
Success Criteria: 체크리스트 항목 ≥3개, 정확도 ≥90%
```

**검증 항목**:
```markdown
## 심리학 검증 체크리스트 (자동 생성)

### 적용된 렌즈
- [x] L1 (Loss Aversion): 정산액 보호 시뮬레이션
- [x] L6 (Timing/FOMO): 마감일 임박 알림
- [ ] L3 (Differentiation): 경쟁사 비교
- [ ] L7 (Companion): 배우자 설득
- [ ] L10 (Immediate): 즉시 구매 트리거

### PASONA 매핑
| 단계 | 구현 | 검증 |
|-----|------|------|
| P | Problem statement | ✓ |
| A | Agitate 강화 | ✓ |
| S | Solution 제시 | ✓ |
| O | Offer (수당) | ✓ |
| N | Narrow (마감) | ✓ |
| A | Action (CTA) | ✓ |

### 심리학 적용도 확률
- **이론적 적용도**: 85% (최신 라우트)
- **코드 구현도**: 92% (실제 구현됨)
```

---

### Hook 3: Merge 검증 (`after_merge`)
**목적**: main 병합 시 RAG 메모리 참조 자동화

#### 3-1. 메모리 파일 자동 링크
```
시나리오: Menu #41 PR을 main에 병합
Expected Output:
  ✓ CLAUDE_RAG_INDEX.md에 Menu #41 링크 자동 추가
  ✓ [[menu_41_statements_complete]] 메모리 생성
  ✓ 관련 렌즈 메모리 cross-reference
  ✓ 통합 테스트 결과 로깅
Success Criteria: 3/3 메모리 파일 생성, 링크 무결성 100%
```

**생성될 메모리 파일**:
```
📁 메모리 생성 항목
├── [[menu_41_statements_complete]]
│   └── L1+L6 심리학 렌즈 + PASONA 매핑 + SMS Day0-3 수정사항
├── [[l1_lens_applied_menu_41]]
│   └── "정산액 보호" 손실회피 사례
└── [[l6_lens_applied_menu_41]]
    └── "마감일 임박" FOMO + 긴박감 사례
```

---

### Hook 4: Build 검증 (`before_build`)
**목적**: `npm build` 시 SMS/마케팅 검증 자동 실행

#### 4-1. SMS Day 0-3 자동 검증
```
시나리오: npm build 실행 시
Expected Output:
  ✓ SMS 메시지 4개(Day 0/1/2/3) 존재 확인
  ✓ PASONA 단계 자동 매핑 검증
  ✓ 심리학 트리거 3개 이상 존재 확인
    - 손실회피 (정산액 보호)
    - 긴박감 (마감일)
    - 희소성 (월간 수당)
Success Criteria: 4/4 메시지 존재, SMS 응답율 시뮬레이션 ≥18%
```

**검증 로직** (pseudo-code):
```javascript
// Hook 4 검증 로직
if (npm build) {
  // 1. SMS 시퀀스 검증
  const sms = loadSMSSequence('menu_41_statements');
  if (sms.day0 && sms.day1 && sms.day2 && sms.day3) {
    console.log('✓ SMS Day0-3 완전성: 통과');
  }
  
  // 2. PASONA 단계 검증
  if (validatePASONAMapping(sms)) {
    console.log('✓ PASONA 매핑: 통과');
  }
  
  // 3. 심리학 트리거 검증
  const triggers = extractPsychTriggers(sms);
  if (triggers.lossAversion && triggers.urgency && triggers.scarcity) {
    console.log('✓ 심리학 트리거 3개: 통과');
  }
  
  // 4. 예상 응답율 계산
  const expectedRate = calculateResponseRate(sms);
  if (expectedRate >= 0.18) { // 18% 목표
    console.log(`✓ SMS 응답율 예상: ${(expectedRate*100).toFixed(1)}%`);
  }
}
```

---

#### 4-2. 마케팅 자동화 KPI 검증
```
시나리오: Build 단계에서 KPI 자동 계산
Expected Output:
  ✓ 현재 메트릭 vs 목표 메트릭 비교
  ✓ CPA 목표 계산 (목표: CPA 20% ↓)
  ✓ ROAS 목표 설정 (목표: 3.0x 이상)
  ✓ 월간 예상 효과 산출 ($기준)
Success Criteria: 4/4 KPI 계산 완료, 통계적 유의성 p<0.05
```

**KPI 계산 표** (Menu #41 기준):
```
| KPI | 현재 | 목표 | 달성 기준 | 검증 방식 |
|-----|------|------|---------|---------|
| SMS 응답율 | 8% | 18% | +10%p | A/B 테스트 |
| 정산 재확인율 | 35% | 65% | +30%p | 페이지 뷰/액션 |
| CPA (정산 재확인) | $4.20 | $3.36 | -20% | 비용/전환수 |
| 월간 효과 | - | $2,100 | - | 2,100건 × $1 |
```

---

## 🧪 테스트 시나리오 (3일차 계획)

### Day 1: Hook 1-2 테스트 (Commit + PR)

#### Step 1-1: Menu #41 수정 파일 준비
```bash
# 깨끗한 상태에서 시작
git checkout main
git pull origin main

# statements/page.tsx 수정 (테스트용 주석 추가)
# - L1 렌즈 주석 추가
# - L6 렌즈 주석 추가
```

#### Step 1-2: 커밋 시 Hook 1 검증
```bash
git add src/app/\(dashboard\)/statements/page.tsx
git commit -m "test(hook1): Menu #41 심리학 렌즈 검증 테스트"

# Hook 1 실행 확인
# Expected: docs/CHECKLIST_*.md 자동 생성
```

#### Step 1-3: PR 생성 시 Hook 2 검증
```bash
git push origin test/hook-validation-1
gh pr create --title "test(hook2): Menu #41 PR 템플릿 검증" \
  --body "Hook 2 자동 체크리스트 주입 테스트"

# Hook 2 실행 확인
# Expected: PR Description에 심리학 체크리스트 자동 추가
```

---

### Day 2: Hook 3-4 테스트 (Merge + Build)

#### Step 2-1: Merge 시 Hook 3 검증
```bash
gh pr merge --squash --delete-branch

# Hook 3 실행 확인
# Expected: 
#   - [[menu_41_statements_complete]] 메모리 생성
#   - CLAUDE_RAG_INDEX.md 업데이트
```

#### Step 2-2: Build 시 Hook 4 검증
```bash
npm build

# Hook 4 실행 확인
# Expected:
#   - SMS Day0-3 검증 완료
#   - KPI 계산 완료
#   - 로그: "✓ SMS 응답율 예상: 18.5%"
```

---

### Day 3: 전체 통합 테스트

#### Step 3-1: 모든 Hook 순차 실행
```bash
# Clean state에서 Menu #42-43도 포함해서 테스트
git log --oneline -5

# Hook 1-4 모두 실행되었는지 확인
```

#### Step 3-2: 검증 리포트 생성
```bash
# 모든 Hook 실행 로그 수집
# → docs/HOOK_TEST_REPORT_*.md 자동 생성
# → Success rate 계산
```

---

## ✅ 검증 기준 (Success Criteria)

### Overall Goal
- **Hook 작동 성공률**: 95% 이상
- **거짓양성 (False Positive)**: <5%
- **거짓음성 (False Negative)**: <2%
- **평균 실행 시간**: <1분

### Hook별 검증 기준

| Hook | 성공 조건 | 타임아웃 |
|------|---------|---------|
| **Hook 1** (Commit) | L1+L6 감지 3/4 이상, 체크리스트 생성 | 30초 |
| **Hook 2** (PR) | 체크리스트 항목 ≥3개, 정확도 ≥90% | 20초 |
| **Hook 3** (Merge) | 메모리 파일 3개 생성, 링크 100% 무결성 | 45초 |
| **Hook 4** (Build) | SMS 4개 검증 + KPI 계산 완료 | 40초 |
| **통합** | 4개 Hook 모두 통과, 총 실행 <1분 | 180초 |

---

## 📊 예상 결과 (Menu #41 기준)

### Hook 1: Commit 검증
```
✓ Lens Detection (L1, L6)
  - L1 (Loss Aversion): "정산액 보호" → PASS
  - L6 (Timing/FOMO): "마감일 임박" → PASS
  - Confidence: 92%

✓ PASONA Framework
  - P → A → S → O → N → A 순차 감지 → PASS
  
✓ Checklist Generation
  - docs/CHECKLIST_20260524.md 생성 → PASS
```

### Hook 2: PR 검증
```
✓ Auto-generated PR Template
  - 심리학 체크리스트 3개 항목 추가 → PASS
  - Lens mapping 테이블 생성 → PASS
  - 심리학 적용도 85% 계산 → PASS
```

### Hook 3: Merge 검증
```
✓ Memory File Creation
  - [[menu_41_statements_complete]] → PASS
  - [[l1_lens_applied_menu_41]] → PASS
  - [[l6_lens_applied_menu_41]] → PASS

✓ CLAUDE_RAG_INDEX.md Update
  - Menu #41 항목 추가 → PASS
  - Cross-reference 링크 생성 → PASS
```

### Hook 4: Build 검증
```
✓ SMS Validation (Day 0-3)
  - Message 4개 존재 확인 → PASS
  - PASONA 매핑 검증 → PASS

✓ Psychology Triggers
  - Loss Aversion: ✓
  - Urgency/FOMO: ✓
  - Scarcity: ✓
  - 총 3개 트리거 감지 → PASS

✓ KPI Calculation
  - SMS Response Rate: 18% 예상 → PASS
  - CPA: -20% 목표 → PASS
  - Monthly Impact: $2,100 계산 → PASS
```

---

## 🐛 Troubleshooting & Rollback Plan

### 문제 시나리오별 대응

#### Scenario 1: Hook 1 실행 안 됨
```
원인: settings.json hooks 설정 오류
대응:
  1. git log --all --grep="Hook" 확인
  2. .claude/settings.json hooks 섹션 재검토
  3. Hook path 절대경로 변경
```

#### Scenario 2: Hook 2 체크리스트 부정확
```
원인: 렌즈 감지 알고리즘 오류
대응:
  1. 코드 수정: L1+L6 감지 정규식 강화
  2. 테스트: 5개 샘플 파일로 재검증
  3. 롤백: 이전 Hook 버전 복구
```

#### Scenario 3: Hook 3 메모리 파일 중복 생성
```
원인: Merge 이벤트 중복 감지
대응:
  1. git hook idempotency 검증
  2. 중복 방지 로직 추가 (파일 체크)
  3. 재실행
```

#### Scenario 4: Hook 4 Build 타임아웃
```
원인: SMS 검증 로직 성능 저하
대응:
  1. 검증 항목 축소 (Day 0/3만 우선)
  2. 병렬 처리 활성화
  3. Cache 레이어 추가
```

---

## 📝 테스트 결과 기록 양식

```markdown
## 테스트 실행 결과 (2026-05-2X)

### Hook 1: Commit 검증
- 실행 시간: XXs
- 렌즈 감지: Y/4 성공
- 체크리스트 생성: O/X
- **결과**: PASS / FAIL

### Hook 2: PR 검증
- 실행 시간: XXs
- 체크리스트 항목: N개
- 정확도: X%
- **결과**: PASS / FAIL

### Hook 3: Merge 검증
- 실행 시간: XXs
- 메모리 파일 생성: N개
- 링크 무결성: X%
- **결과**: PASS / FAIL

### Hook 4: Build 검증
- 실행 시간: XXs
- SMS Day0-3 검증: O/X
- KPI 계산: O/X
- **결과**: PASS / FAIL

### 종합 평가
- 전체 성공률: X%
- 심각한 오류: N개
- 권장 사항: ...
```

---

## 🚀 배포 후 운영

### Hook 모니터링
- **실시간 로깅**: 모든 Hook 실행 내역 자동 기록
- **주간 리포트**: Hook 성공/실패율 추적
- **자동 개선**: 거짓양성 >10% 시 자동 알림

### 성과 메트릭
```
Hook 별 성과 추적 (월별):
- Hook 1 정확도: 90% → 95%를 목표
- Hook 2 체크리스트 수락율: 85%를 목표
- Hook 3 메모리 매핑율: 98%를 목표
- Hook 4 Build 시간: <1분 유지
```

---

## 📞 문의 및 피드백

- **Hook 오류 발생**: GitHub Issues → `label:hook-system`
- **성능 저하**: `.claude/settings.json` 파일 크기 모니터링
- **메모리 누락**: `[[menu_*_complete]]` 패턴 검색

---

**Last Updated**: 2026-05-24  
**Next Review**: 2026-05-31 (1주 운영 후 평가)
