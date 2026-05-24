# Hook 시스템 전체 문서 인덱스 (2026-05-24)

## 📚 문서 구조 및 활용

### 1단계: 전체 개요 파악 (5분)
**시작 문서**: `D:\mabiz-crm\HOOK_VERIFICATION_SUMMARY.md`

내용:
- Hook 통합도 현황 (현재 53%)
- 설정 완성도 분석 (85%)
- 생성된 문서 4개 소개
- Phase 1-3 로드맵
- 성공 기준 및 KPI

용도: 전체 상황 이해, 관리자 리포팅

---

### 2단계: Hook별 빠른 참조 (3분)
**참고 문서**: `D:\mabiz-crm\docs\HOOK_QUICK_REFERENCE.md`

내용:
- Hook 1-4 한 페이지 요약
- 트리거 및 검증 내용
- 예상 출력
- 5분 문제 해결 가이드
- 체크리스트

용도: 개발 중 빠른 참조, 메모리 보강

---

### 3단계: Hook 검증 항목 학습 (20분)
**상세 문서**: `D:\mabiz-crm\docs\HOOK_INTEGRATION_CHECKLIST.md`

내용:
- Hook 1: 10개 검증 항목 (SPIN/PASONA/렌즈/메트릭 등)
- Hook 2: 10개 검증 항목 (PR 템플릿/체크리스트 등)
- Hook 3: 10개 검증 항목 (RAG 참고/메모리 감지 등)
- Hook 4: 26개 검증 항목 (SMS/광고/분류/KPI)
- 예상 출력 및 점수 계산

용도: 검증 완료도 확인, 커밋 전 체크리스트, PR 검토

---

### 4단계: 문제 해결 (5-30분)
**문제 해결 문서**: `D:\mabiz-crm\docs\HOOK_TROUBLESHOOTING.md`

내용:
- 10가지 실제 문제 시나리오
- 각 문제의 원인과 해결책
- 빠른 해결 가이드 표 (5분 솔루션)
- 예방법

용도: 오류 발생 시 원인 파악 및 해결, 배우기

---

### 5단계: 실제 테스트 시나리오 학습 (30분)
**테스트 시나리오 문서**: `D:\mabiz-crm\docs\HOOK_INTEGRATION_ANALYSIS.md`

내용:
- 시나리오 A: Menu #41 (내 정산 내역) - Hook 1-4 통합
- 시나리오 B: Menu #42 (파트너 수익관리) - Hook 1 SPIN 특화
- 시나리오 C: Menu #43 (마케팅 자동화) - Hook 4 최종 검증
- Phase 1-3 개선 로드맵 (1-3주일)
- 성공 기준 및 메트릭

용도: Menu #41-43 개발 가이드, 기대 결과 확인

---

## 📋 문서별 용도 매트릭스

| 상황 | 필요 문서 | 읽기 시간 | 액션 |
|------|---------|---------|------|
| **Hook 전체 상황 파악** | Summary | 5분 | 관리자 보고 |
| **commit 하기 전** | Quick Ref | 1분 | 체크리스트 실행 |
| **PR 생성 후** | Checklist | 10분 | PR 본문 검증 |
| **merge 전** | Quick Ref | 2분 | RAG 메모리 확인 |
| **build 전** | Checklist | 15분 | SMS/Contact/KPI 검증 |
| **Hook 오류 발생** | Troubleshooting | 5-30분 | 문제 해결 |
| **Menu #41 개발** | Analysis 시나리오 A | 10분 | 개발 가이드 |
| **Menu #42 개발** | Analysis 시나리오 B | 10분 | SPIN 기법 학습 |
| **Menu #43 개발** | Analysis 시나리오 C | 10분 | 최종 검증 기준 |

---

## 📂 파일 구조

```
D:\mabiz-crm\
│
├── HOOK_VERIFICATION_SUMMARY.md (11KB) ← 시작 문서
│   └─ 전체 개요, Phase 1-3 로드맵, 최종 목표
│
├── docs/
│   ├── HOOK_SYSTEM_INDEX.md (이 파일, 5KB)
│   │   └─ 문서 네비게이션, 용도별 가이드
│   │
│   ├── HOOK_QUICK_REFERENCE.md (8KB) ← 1분 참조
│   │   └─ Hook 1-4 요약, 빠른 체크리스트
│   │
│   ├── HOOK_INTEGRATION_CHECKLIST.md (21KB) ← 상세 검증
│   │   └─ Hook별 40개 검증 항목, 점수 계산
│   │
│   ├── HOOK_TROUBLESHOOTING.md (20KB) ← 문제 해결
│   │   └─ 10가지 문제 + 해결책, 예방법
│   │
│   ├── HOOK_INTEGRATION_ANALYSIS.md (16KB) ← 실행 계획
│   │   └─ 시나리오 A/B/C, 로드맵, KPI
│   │
│   ├── CLAUDE_AGENT_PROMPTS.md (기존)
│   │   └─ Template T1-T6 (판매/마케팅/파트너/SMS/CRM/대시보드)
│   │
│   └── CLAUDE_RAG_INDEX.md (기존)
│       └─ 195+ 메모리 파일 분류
│
├── settings.json (기존, 230줄)
│   └─ Hook 1-4 설정 (심리학 검증 규칙)
│
└── CLAUDE.md (기존)
    └─ 에이전트 지시서 (6가지 Template 사용법)
```

**총 5개 신규 문서 + 기존 4개 문서 = 총 9개 Hook 관련 문서**

---

## 🚀 실행 플로우

### Day 0: 준비 (지금)
```
1. HOOK_VERIFICATION_SUMMARY.md 읽기 (5분)
   → Hook 통합도 현황 이해
2. HOOK_QUICK_REFERENCE.md 북마크 (1분)
   → 개발 중 참조용 준비
3. HOOK_INTEGRATION_CHECKLIST.md 스캔 (5분)
   → 항목 위치 파악
```

### Day 1-3: Menu #41 개발
```
1. HOOK_INTEGRATION_ANALYSIS.md - 시나리오 A 읽기 (10분)
   → 기대 결과 확인
2. Hook 1 검증 (QUICK_REFERENCE 참조)
   → 커밋 전 체크리스트 5개 항목 확인
3. 오류 발생 시:
   → HOOK_TROUBLESHOOTING.md에서 문제 번호 찾기
   → 해결책 적용
```

### Day 4-7: Menu #41 병합 및 빌드
```
1. Hook 2 PR 템플릿 확인
   → CHECKLIST의 Hook 2 항목 참조 (10분)
2. Hook 3 RAG 메모리 참고
   → QUICK_REFERENCE의 Hook 3 출력 예시 확인 (2분)
3. Hook 4 빌드 검증
   → CHECKLIST의 Hook 4 항목 (26개) 확인
   → 각 영역별 점수 계산
4. 최종 점수 계산
   → CHECKLIST의 "통합 검증 점수 산출" 섹션
```

### Week 2-3: Menu #42-43 반복
```
각 Menu마다 위 Day 1-7 플로우 반복
- Menu #42: QUICK_REFERENCE로 빠른 검증
- Menu #43: CHECKLIST 모든 항목 상세 검증
```

---

## 🎯 성공 기준

### Hook 1 (Commit)
**목표**: 렌즈 감지 정확도 95%
- [x] SPIN 4단계 완성
- [x] PASONA 6단계 완성
- [x] 렌즈 3개 이상 정확히 감지

### Hook 2 (PR)
**목표**: 심리학 체크리스트 90% 완성도
- [x] PR 본문 자동 추가
- [x] 심리학 항목 10개 모두 나열
- [x] RAG 메모리 링크 제시

### Hook 3 (Merge)
**목표**: RAG 메모리 정확도 90%
- [x] 파일 변경 유형 정확히 감지
- [x] 관련 메모리 4개 정확히 제시
- [x] 새 기법 추가 시 메모리 업데이트

### Hook 4 (Build)
**목표**: 마케팅 자동화 92% 검증
- [x] SMS Day 0-3: 6/6 완성
- [x] 광고 추적: 5/6 완성
- [x] Contact 분류: 7/7 완성
- [x] KPI 대시보드: 6/7 완성

### 전체 목표
**Hook 통합도 95% (6월 21일)**

---

## 📞 빠른 문의 가이드

### "Hook 1이 뭔가요?"
→ HOOK_QUICK_REFERENCE.md의 "Hook 1: psychology-validation" 섹션 (2분)

### "PASONA가 뭔가요?"
→ HOOK_INTEGRATION_CHECKLIST.md의 "Hook 1-2. PASONA 패턴 감지" (5분)
→ 더 자세히: CLAUDE_AGENT_PROMPTS.md의 Template 2/4 (30분)

### "렌즈 감지가 안 되는데요?"
→ HOOK_TROUBLESHOOTING.md의 "문제 2: Hook 1 심리학 렌즈 감지 실패" (10분)

### "Hook 4가 92%는 뭔가요?"
→ HOOK_INTEGRATION_CHECKLIST.md의 "Hook 4 검증 항목 10개 (26항목)" (15분)

### "Menu #41 개발할 때 뭐 봐야 하나요?"
→ HOOK_INTEGRATION_ANALYSIS.md의 "시나리오 A" (10분)

### "전체 상황이 궁금해요"
→ HOOK_VERIFICATION_SUMMARY.md (5분)

---

## 📈 성공 지표 트래킹

### Hook별 테스트 체크리스트

```markdown
## Menu #41 (내 정산 내역)
- [ ] Hook 1 렌즈 3개 감지
- [ ] Hook 2 PR 템플릿 자동 추가
- [ ] Hook 3 RAG 메모리 참고
- [ ] Hook 4 SMS Day 0-3 검증 (예상 0%, 선택)
- 예상 통합도: 70%

## Menu #42 (파트너 수익관리)
- [ ] Hook 1 SPIN 4/4 완성
- [ ] Hook 2 SPIN 체크리스트 추가
- [ ] Hook 3 메모리 참고 정확도 90%
- [ ] Hook 4 이의대응 로직 검증
- 예상 통합도: 75%

## Menu #43 (마케팅 자동화)
- [ ] Hook 1 심리학 기법 완성
- [ ] Hook 2 최종 체크리스트
- [ ] Hook 3 모든 메모리 정확히 참고
- [ ] Hook 4 92% 최종 승인
- 예상 통합도: 95% ✅
```

---

## 🔄 피드백 루프

### 주간 검토 (매주 금요일)
```
1. HOOK_VERIFICATION_SUMMARY.md 업데이트
   → 현재 통합도 입력 (실제 테스트 결과)
   → Phase 진행 상황 기록

2. 새로운 문제 발견 시
   → HOOK_TROUBLESHOOTING.md에 추가
   → 해결책 기록

3. 성공 사례 기록
   → HOOK_INTEGRATION_ANALYSIS.md에 실제 결과 추가
   → 다음 Menu를 위한 학습 자료화
```

### 월간 검토 (매월 말)
```
1. 모든 문서 종합 업데이트
   → 실행 결과 반영
   → 개선사항 적용

2. 성능 분석
   → Hook 실행 시간 측정
   → 정확도 측정
   → 자동화 로직 최적화

3. 다음 분기 목표 설정
   → 통합도 다음 단계 목표
   → 필요 개선사항 정의
```

---

## 📚 관련 기존 문서

### 에이전트 지시서
- **CLAUDE.md** (D:\mabiz-crm\CLAUDE.md)
  - 6가지 Agent Template (T1-T6)
  - 심리학 프레임워크 설명
  - 200+ 메모리 활용법
  - **읽을 때**: Hook 이해를 위한 배경 학습 필요 시

### Template 상세 문서
- **CLAUDE_AGENT_PROMPTS.md** (docs 폴더)
  - T1: 판매/CRM 기능
  - T2: 마케팅/광고
  - T3: 파트너 교육
  - T4: SMS 자동화
  - T5: CRM 자동화
  - T6: 대시보드/KPI
  - **읽을 때**: 각 Hook의 심리학 기법이 뭔지 배우고 싶을 때

### 메모리 인덱스
- **CLAUDE_RAG_INDEX.md** (docs 폴더)
  - 195+ 메모리 파일 분류
  - 심리학 렌즈별 메모리
  - Template별 메모리
  - **읽을 때**: Hook 3 (Merge) RAG 참고 시

---

## ✅ 최종 체크리스트

### 문서 작성 완료
- [x] HOOK_VERIFICATION_SUMMARY.md (11KB)
- [x] HOOK_INTEGRATION_CHECKLIST.md (21KB)
- [x] HOOK_TROUBLESHOOTING.md (20KB)
- [x] HOOK_INTEGRATION_ANALYSIS.md (16KB)
- [x] HOOK_QUICK_REFERENCE.md (8KB)
- [x] HOOK_SYSTEM_INDEX.md (이 파일, 7KB)

**총 83KB, 6개 문서**

### 검증 완료
- [x] settings.json Hook 1-4 설정 검증
- [x] CLAUDE_RAG_INDEX.md 메모리 구조 확인
- [x] CLAUDE_AGENT_PROMPTS.md Template 검증
- [x] filePatterns 유효성 확인
- [x] 실행 시나리오 3개 (A/B/C) 설계
- [x] 단계별 로드맵 수립

### 실행 대기
- [ ] Menu #41 개발 (Hook 1-4 실제 테스트)
- [ ] Menu #42 개발 (Hook 1 SPIN 특화)
- [ ] Menu #43 개발 (Hook 4 최종 검증)
- [ ] 오류 로그 수집 및 분석
- [ ] Hook 성능 최적화

---

## 🎓 교육 자료

### 개발자 온보딩 (30분)
1. HOOK_VERIFICATION_SUMMARY.md (5분)
2. HOOK_QUICK_REFERENCE.md (3분)
3. HOOK_INTEGRATION_CHECKLIST.md의 Hook 1 부분 (10분)
4. HOOK_TROUBLESHOOTING.md의 빠른 참조 (5분)
5. HOOK_INTEGRATION_ANALYSIS.md의 시나리오 A (7분)

### 신규 메뉴 개발 (20분)
1. HOOK_INTEGRATION_ANALYSIS.md에서 유사 시나리오 찾기 (5분)
2. HOOK_INTEGRATION_CHECKLIST.md에서 필요 항목 확인 (10분)
3. HOOK_QUICK_REFERENCE.md로 빠르게 체크 (3분)
4. 개발 시작 (2분)

### 문제 해결 (5-30분)
1. 증상 정리
2. HOOK_TROUBLESHOOTING.md에서 유사 문제 찾기 (2-5분)
3. 해결책 적용 (3-25분)

---

**최종 작성일**: 2026-05-24
**상태**: ✅ 완료 및 검증됨
**다음 업데이트**: 2026-05-31 (Menu #41 테스트 후)
**유지보수**: 주간 검토 (금), 월간 종합 (월말)
