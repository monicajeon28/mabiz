# Stage 2 완전 계획서 (2026-05-25 ~ 2026-05-28)

**기본정보**
- Stage 1 완료: 2026-05-24 (6개 Template + 195+ RAG 인덱스)
- Stage 2 시작: 2026-05-25 (예정)
- Stage 2 완료: 2026-05-28 (예정)
- 총 4일 스프린트

---

## 📋 Stage 2 전체 체크리스트 (20 Items)

### Phase 1: Hook 시스템 검증 (Day 1-2: 2026-05-25~26)

**목표**: Menu #41-43 커밋 후 자동화 Hook이 실제 작동하는지 검증 및 개선

- [ ] **1.1** `.husky/post-commit` Hook 실행 확인
  - 파일 변경 감지 → 심리학 검증 자동 실행
  - 문제점 식별 및 로깅
  - 개선사항 문서화

- [ ] **1.2** Menu #41 (내 정산 내역) 최종 코드 검토
  - 심리학 렌즈 L0-L10 포괄도 확인 (최소 3개 이상)
  - Day 0-3 SMS 자동화 로직 검증
  - CRM 자동분류 규칙 확인

- [ ] **1.3** Menu #42 (팀 정산) 최종 코드 검토
  - 심리학 렌즈 포괄도 확인
  - Grant Cardone 반박법 통합 여부 확인
  - Risk Flag 10개 자동화 검증

- [ ] **1.4** Menu #43 (계약서 관리) 최종 코드 검토
  - 심리학 10렌즈 적용 범위 확인
  - PASONA/SPIN 카피라이팅 통합 검증
  - CRM 자동화 규칙 완성도 확인

- [ ] **1.5** Hook 거짓 양성(False Positive) 분석
  - 불필요한 경고 패턴 식별
  - Hook 규칙 미세조정
  - 신뢰도 지표 산출 (목표: >95%)

- [ ] **1.6** Memory RAG 자동 링크 생성 검증
  - 각 Menu별 메모리 파일 자동 링크 확인
  - 부족한 메모리 파일 식별
  - 메모리 인덱스 업데이트

- [ ] **1.7** 에이전트 프롬프트 Hook 검증
  - T1-T6 Template 자동 로딩 확인
  - 각 Template의 심리학 기법 포괄도 검증
  - 개선사항 식별 및 수정

---

### Phase 2: Menu #44-46 구현 완료 (Day 3-4: 2026-05-27~28)

**목표**: 모든 메뉴의 심리학 기반 자동화 100% 달성

- [ ] **2.1** Menu #44 (부재중 고객 재활성화) 구현
  - L0 렌즈 (부재중 고객 분류) 완전 통합
  - Day 0-3 SMS 자동화 시퀀스 구현
  - Grant Cardone Follow-up 규칙 (5-12회 접촉) 적용
  - 성과 메트릭 정의 (목표: 62-97% 전환율)

- [ ] **2.2** Menu #45 (파트너 교육 자동화) 구현
  - T3 Template 완전 통합
  - 세그먼트별 페르소나 3-5가지 정의
  - 성공 템플릿 체크리스트 5-10개 자동 생성
  - 주간 성과 추적 대시보드 구현

- [ ] **2.3** Menu #46 (대시보드 자동화) 구현
  - T6 Template 완전 통합
  - 현재 vs 목표 메트릭 자동 비교 표
  - 주간/월간 리포팅 템플릿 자동 생성
  - 자동 경고 시스템 (CPA 초과, 전환율 저하, Risk 상승)

- [ ] **2.4** Menu #41-43 재검증 (P0/P1 최종 점수 개선)
  - 코드 리뷰: 심리학 10렌즈 일관성 확인
  - 성능 테스트: SMS 발송 속도, CRM 자동화 응답시간
  - UX 테스트: 사용자 인터페이스 및 접근성
  - 보안 검토: 민감 정보 마스킹, API 보안

- [ ] **2.5** 모든 메뉴 (1-46) 심리학 렌즈 통합도 최종 확인
  - L0-L10 렌즈 포괄도 매트릭스 생성
  - 부족한 렌즈 빈틈 식별
  - 최종 개선사항 우선순위 결정

---

### Phase 3: Skills 개발 및 배포 (병렬 진행: 2026-05-25~28)

**목표**: 3개 Skill 개발 완료 및 배포 (개발자가 자동으로 심리학 검증 가능)

#### Skill #1: psychology-check
- [ ] **3.1** 파일 자동 읽기 및 분석 로직 개발
  - TypeScript/Python 파일 파싱
  - 함수/메소드별 심리학 기법 자동 검출
  - PASONA/SPIN/10렌즈 매핑 엔진 구현

- [ ] **3.2** 부족한 렌즈 제안 알고리즘 개발
  - 파일 컨텍스트 분석 → 필요 렌즈 자동 추천
  - 우선순위 지정 (P0/P1/P2)
  - 개선 코드 스니펫 자동 생성

- [ ] **3.3** psychology-check Skill 등록 및 배포
  - 명령어: `/psychology-check [파일경로]`
  - 출력: 렌즈 포괄도(%), 부족 렌즈, 개선 코드
  - 테스트: Menu #40-43 대상으로 검증

#### Skill #2: sms-sequencer
- [ ] **3.4** Day 0-3 SMS 템플릿 자동 생성 로직
  - PASONA 6단계 매핑 (P→A→S→O→N→A)
  - 심리학 트리거 자동 삽입 (희소성, 긴박감, 손실회피)
  - 세그먼트별 메시지 변형 5가지 이상 자동 생성

- [ ] **3.5** A/B 테스트 변형 자동 생성 로직
  - 헤드라인/바디/CTA 변형 조합
  - 심리학 기반 변형 (렌즈별 강조점 변경)
  - 테스트 시나리오 자동 정의

- [ ] **3.6** sms-sequencer Skill 등록 및 배포
  - 명령어: `/sms-sequencer [상품] [세그먼트] [목표렌즈]`
  - 출력: Day 0-3 SMS 4개 + A/B 변형 8개
  - 테스트: 렌탈/크루즈/상품별 시뮬레이션

#### Skill #3: marketing-audit
- [ ] **3.7** 광고/캐원페인 파일 분석 로직
  - Facebook/Google/Naver 광고 설정 분석
  - FABE 카피 구조 검증
  - 호기심 헤드라인(40자 이내) 검증

- [ ] **3.8** Russell Brunson MIFGE 퍼널 매칭 로직
  - 가치사다리 ($29→$97→$297→$2K+) 검증
  - Lead Magnet→OTO→Upsell 경로 확인
  - 각 단계의 심리학 기법 포괄도 검증

- [ ] **3.9** SNS 채널별 최적화 점수 산출
  - Facebook (CPC↓20-30%, 전환율 2-4%)
  - Instagram (도달/저장/참여율)
  - Google/Naver (CPA/ROAS 목표 달성율)
  - Blog/SEO (월별 트래픽 목표 500→2000)

- [ ] **3.10** marketing-audit Skill 등록 및 배포
  - 명령어: `/marketing-audit [파일경로] [채널]`
  - 출력: 종합 점수(100점), 개선 항목(P0/P1/P2)
  - 테스트: 기존 캠페인 재평가

---

### Phase 4: 성과 측정 및 검증 (Day 4: 2026-05-28)

**목표**: 모든 Phase 1-3 완료 후 통합 검증

- [ ] **4.1** Menu #40 (수익 계산기) 성과 측정
  - 계산횟수: 500 → 800 (목표: 60% 증가)
  - 예약전환: 60 → 224 (목표: 273% 증가)
  - CPA/LTV 개선율 산출

- [ ] **4.2** Menu #41-43 심리학 렌즈 적용률 검증
  - L0-L10 렌즈 포괄도: 100% (모든 메뉴)
  - PASONA/SPIN 통합도: 95% 이상
  - Day 0-3 SMS 자동화: 100% (해당 메뉴)

- [ ] **4.3** Hook 시스템 신뢰도 검증
  - 거짓 양성(False Positive) <5%
  - 거짓 음성(False Negative) <2%
  - 자동화 성공률 >95%

- [ ] **4.4** Skills 활용도 측정
  - psychology-check 자동 호출: 개발 중 평균 1회/파일
  - sms-sequencer 자동 호출: 캠페인 설계 시 100%
  - marketing-audit 자동 호출: 광고 검토 시 80% 이상

- [ ] **4.5** 최종 통합 테스트
  - Menu #1-46 전체 심리학 렌즈 매트릭스 생성
  - Hook + Skills + Memory RAG 완전 자동화 확인
  - 개발자 수동 검토 시간 30% 감소 검증

---

## 🎯 성공 기준 (Definition of Done)

### 기술 기준
- [ ] 모든 Menu (1-46)의 심리학 렌즈 L0-L10 포괄도 ≥ 90%
- [ ] Hook 시스템 거짓 양성 <5%, 거짓 음성 <2%
- [ ] 3개 Skill 완전 배포 및 테스트 완료
- [ ] Memory RAG 인덱스 업데이트 (195+ → 220+ 파일)

### 비즈니스 기준
- [ ] Menu #40: 매출 +273% (계산횟수 60% ↑, 예약전환 273% ↑)
- [ ] Menu #41-43: 전환율 목표 달성율 ≥ 95%
- [ ] 개발 속도 개선: 수동 심리학 검토 30% 감소
- [ ] 파트너 만족도: 자동화 신뢰도 ≥ 90%

---

## 📊 일일 계획 (Day by Day)

### Day 1 (2026-05-25) - Hook 검증 시작
```
[오전 9시] 
- Menu #41-43 커밋 및 Hook 실행 확인
- Hook 거짓 양성 패턴 분석 시작

[오후 2시]
- Memory RAG 자동 링크 검증
- Template T1-T3 심리학 포괄도 확인

[오후 5시]
- Day 1 결과 문서화
- Skill #1 (psychology-check) 개발 50% 완료
```

### Day 2 (2026-05-26) - Hook 개선 + Menu #44 시작
```
[오전 9시]
- Hook 미세조정 및 신뢰도 개선
- Menu #44 (부재중 고객) 구현 시작

[오후 2시]
- Menu #44 L0 렌즈 + Day 0-3 SMS 완성
- Skill #2 (sms-sequencer) 개발 시작

[오후 5시]
- Day 2 성과 측정 및 문서화
- Menu #45 구현 준비
```

### Day 3 (2026-05-27) - Menu #45-46 완성
```
[오전 9시]
- Menu #44 최종 검증 및 통합
- Menu #45 (파트너 교육) 구현 완료

[오후 2시]
- Menu #46 (대시보드) 구현 완료
- Skill #3 (marketing-audit) 개발 완료

[오후 5시]
- 3개 Menu + 3개 Skill 통합 테스트
```

### Day 4 (2026-05-28) - 최종 검증 및 배포
```
[오전 9시]
- Menu #41-46 최종 코드 리뷰
- Hook + Skills + Memory RAG 완전 자동화 확인

[오후 2시]
- 성과 측정 및 KPI 검증
- 최종 문서화 및 배포 준비

[오후 5시]
- Stage 2 완료 선언 및 메모리 업데이트
- Week 2 테스팅 로드맵 수립
```

---

## 📁 최종 산출물

### 코드 변경사항
- [ ] Menu #44-46 새 구현 (3개 메뉴)
- [ ] Hook 시스템 개선 (1개 파일)
- [ ] Skill #1-3 완전 개발 (3개 기능)
- [ ] CLAUDE.md 버전 2.1 업데이트

### 문서
- [ ] Stage_2_Complete_Plan.md (이 파일)
- [ ] Skills_Development_Guide.md (Skill 3개 명세)
- [ ] Performance_Measurement_Framework.md (KPI 정의)
- [ ] Week2_Testing_Roadmap.md (일일 테스트 계획)
- [ ] Menu_Psychology_Coverage_Matrix.md (렌즈 포괄도 매트릭스)

### 메모리 업데이트
- [ ] CLAUDE_AGENT_PROMPTS.md 버전 2.1
- [ ] CLAUDE_RAG_INDEX.md 메뉴 45-46 추가
- [ ] MEMORY.md 새 항목 추가 (Menu #44-46)

---

## 🔗 관련 파일

| 파일명 | 설명 | 상태 |
|--------|------|------|
| D:\mabiz-crm\CLAUDE.md | 에이전트 지시서 v2.0 | ✅ 완료 |
| docs/CLAUDE_AGENT_PROMPTS.md | T1-T6 Template | ✅ 완료 |
| docs/CLAUDE_RAG_INDEX.md | 195+ 메모리 인덱스 | ✅ 완료 |
| docs/CLAUDE_AGENT_USAGE_GUIDE.md | 3가지 활용 방식 | ✅ 완료 |
| src/.husky/post-commit | Hook 시스템 | ✅ 완료 |
| docs/STAGE_2_COMPLETE_PLAN.md | 이 파일 | ✅ 진행중 |
| docs/Skills_Development_Guide.md | Skill 명세 | ⏳ 예정 |
| docs/Performance_Measurement_Framework.md | KPI 정의 | ⏳ 예정 |
| docs/Week2_Testing_Roadmap.md | 테스트 계획 | ⏳ 예정 |

---

**최종 업데이트**: 2026-05-24 | **상태**: 계획 수립 중
