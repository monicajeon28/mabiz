# Phase 3 Track A/C/D 병렬 실행 체크리스트

**목표:** 3가지 높은 우선순위 작업을 병렬로 진행하여 Phase 3 검증 완성

**일정:** 2026-05-22 ~ 2026-06-21 (4주)

---

## 개요 (Executive Summary)

### Track A: 50콜 실전 검증
- 목표: 24가지 이의처리 전략 +20-30% 효과 검증
- 산출물: 통계 분석 보고서 + Best Practices 가이드
- 기간: 1주(콜 수집) + 3일(분석)
- 기대효과: 기존 55% → 76% 전환율 (+21%)

### Track C: SMS 온보딩 마법사
- 목표: 1400명 고객의 세그먼트 필드 자동 수집 (성공률 85%)
- 산출물: 4단계 SMS 설계 + NLP 파싱 함수
- 기간: 3.5일(설계+구현)
- 기대효과: 70%의 미입력 고객 자동분류

### Track D: A/B 테스트 할당 알고리즘
- 목표: 200콜 A/B 테스트 무작위 배치 + Crossover 제어
- 산출물: Block Randomization + Stratification 함수 + 12주 일정
- 기간: 3.5일(설계+구현)
- 기대효과: 통계적 유의성 90% 이상 신뢰도 확보

---

## Phase 1: 설계 & 준비 (Day 1-2: 5월 22-23)

### Track A: 사전 준비

- [ ] A5 이의처리 가이드 최종 검토 (TRACK_A_50CALL_VALIDATION_PLAN.md)
- [ ] 5명 상담사 훈련 스케줄 확정
  - [ ] Day 2 역할극 10시간 예약
  - [ ] 24가지 이의 분류 완료
  - [ ] 기본 대응 문구 암기 확인
- [ ] CallLog 데이터 모델 확장 검토
  - [ ] objectionTypes: string[]
  - [ ] objectionHandling: Json?
  - [ ] customerReaction: string?
  - [ ] counselorName: string?
  - [ ] tags: string[]

### Track C: 설계

- [ ] TRACK_C_SMS_ONBOARDING_DESIGN.md 최종 검토 완료
- [ ] 4단계 SMS 문구 최종화
  - [ ] Day 0: 결혼상태 (미혼/결혼/기타)
  - [ ] Day 1: 결혼년수 + 자녀 (복합)
  - [ ] Day 2: 현재 나이 (18-100세)
  - [ ] Day 3: 여행목적 (5가지)
- [ ] NLP 파싱 함수 구현 (sms-onboarding-parser.ts)
  - [ ] parseMaritalStatus() 완성
  - [ ] parseMarriageAndChildren() 완성
  - [ ] parseAge() 완성
  - [ ] parseTravelPurpose() 완성
  - [ ] 5가지 테스트 케이스 검증
- [ ] Prisma 스키마 검토
  - [ ] Contact.marriageStatus ✓ (이미 추가됨)
  - [ ] Contact.marriageDate ✓
  - [ ] Contact.childrenAges ✓
  - [ ] Contact.childrenCount ✓
  - [ ] Contact.ageInYears ✓
  - [ ] Contact.travelPurpose (추가 필요? 또는 enum으로 관리?)

### Track D: 설계

- [ ] TRACK_D_ALLOCATION_ALGORITHM.md 최종 검토 완료
- [ ] 상담사 5명 기존 전환율 데이터 수집
  - [ ] 상담사A: 55%
  - [ ] 상담사B: 52%
  - [ ] 상담사C: 48%
  - [ ] 상담사D: 45%
  - [ ] 상담사E: 42%
- [ ] Block Randomization 알고리즘 검증
- [ ] Stratification 계획 확인
  - [ ] HIGH: 상담사 A, B
  - [ ] MIDDLE: 상담사 C
  - [ ] LOW: 상담사 D, E
- [ ] Monday.com API 키 확인
  - [ ] API Key: MONDAY_API_KEY ✓?
  - [ ] Board ID: MONDAY_AB_TEST_BOARD_ID ✓?
  - [ ] 권한 확인 (Task 생성 권한)

---

## Phase 2: 구현 & 통합 (Day 2-4: 5월 23-25)

### Track A: 구현

- [ ] CallLog 스키마 마이그레이션 (Day 2)
  - [ ] Prisma migration 작성
  - [ ] 필드 추가: objectionTypes, objectionHandling, customerReaction, counselorName, tags
  - [ ] npm run db:push 실행
- [ ] 상담사 훈련 자료 최종 준비 (Day 2)
  - [ ] 24가지 이의 각각의 대응 문구 정리
  - [ ] 역할극 시나리오 5개 세트
  - [ ] 기록 양식 (Excel 또는 Google Sheets)
- [ ] 콜 기록 시스템 테스트 (Day 2-3)
  - [ ] 테스트 콜 5개 기록 (상담사별 1콜)
  - [ ] JSON 구조 검증
  - [ ] 통계 쿼리 테스트 (이의별 회복율 계산)

### Track C: 구현

- [ ] NLP 파싱 함수 구현 완료 (Day 2)
  - [ ] src/lib/contact/sms-onboarding-parser.ts ✓ (완성됨)
  - [ ] 5가지 테스트 케이스 실행
    - [ ] "결혼 5년, 아이 2명 10살 8살" → 100% 신뢰도
    - [ ] "결혼 3년, 자녀 없음" → 70% 신뢰도
    - [ ] "45" → 95% 신뢰도
    - [ ] "45살입니다" → 95% 신뢰도
    - [ ] "휴식이 가장 중요해요" → 90% 신뢰도
- [ ] 폴백 전략 구현 (Day 3)
  - [ ] 신뢰도 80% 이상 → auto_save
  - [ ] 50-80% → manual_review (상담사 검토)
  - [ ] 20-50% → retry_sms (재질문)
  - [ ] 20% 미만 → call_required (전화)
- [ ] 자동분류 트리거 구현 (Day 3-4)
  - [ ] Contact.autoSegment 자동 계산 함수
  - [ ] segment-classifier.ts와 통합
  - [ ] 태그 자동 추가 (seg:A, seg:B, seg:C, seg:D)
  - [ ] Contact.segmentUpdatedAt 기록
- [ ] SMS 발송 스케줄 설정 (Day 4)
  - [ ] Day 0 발송 시간: 08:00 또는 21:00 선택
  - [ ] Day 1/2/3 발송 시간: 일관성 있게 설정
  - [ ] 응답 대기: 각 24시간

### Track D: 구현

- [ ] A/B 할당 함수 구현 (Day 2-3)
  - [ ] src/lib/analytics/ab_test_allocation.ts ✓ (완성됨)
  - [ ] generateBlockRandomization()
  - [ ] stratifyByHistoricalPerformance()
  - [ ] applyCrossoverDesign()
  - [ ] generateAllocationSchedule()
- [ ] 할당 결과 검증 (Day 3)
  - [ ] Block Randomization: 각 상담사 A 24-26, B 22-24회
  - [ ] Stratification: HIGH/MIDDLE/LOW별 균등 분배
  - [ ] Crossover: Week 4-6, 10-12에서 A/B 스왑 확인
  - [ ] validateAllocation() 함수 실행
- [ ] Monday.com API 테스트 (Day 4)
  - [ ] API 키 검증
  - [ ] 테스트 태스크 1개 생성
  - [ ] 태스크 조회 확인
  - [ ] 태스크 업데이트 확인
  - [ ] 삭제 (테스트 후)
- [ ] 12주 할당 일정 생성 (Day 4)
  - [ ] generateAllocationSchedule() 실행
  - [ ] Excel 파일로 내보내기 (TRACK_D_ALLOCATION_SCHEDULE.csv)
  - [ ] 상담사별 확인 (각 40콜, A/B 50:50)

---

## Phase 3: 배포 및 시작 (Day 5: 5월 25)

### Track A: 배포

- [ ] CallLog 마이그레이션 확정
- [ ] 상담사 5명 최종 훈련 (Day 5 오전)
  - [ ] A5 가이드 배포
  - [ ] 역할극 2시간씩
  - [ ] 신뢰도 80% 이상 확인
- [ ] 콜 기록 양식 배포
  - [ ] 상담사별 기록 시스템 설명
  - [ ] 폴백 시스템 설명 (신뢰도 기반)
- [ ] 50콜 수집 시작 (Day 5-12)
  - [ ] 목표: 주당 50콜 (Day 5-11)

### Track C: 배포

- [ ] NLP 파싱 함수 배포 (프로덕션)
  - [ ] npm run build 통과 확인
  - [ ] 타입스크립트 컴파일 에러 0개
- [ ] SMS 온보딩 마법사 테스트 (Day 5)
  - [ ] 테스트 고객 5명 대상 수동 배포
  - [ ] Day 0 SMS 발송 테스트
  - [ ] 응답 수집 및 파싱 테스트
- [ ] 1400명 대상 자동 배포 (Day 5 오후)
  - [ ] CRM에서 marriageStatus null인 고객 자동 추출
  - [ ] Day 0 SMS 대량 발송 (알리고 API)
  - [ ] 응답 수집 시작

### Track D: 배포

- [ ] 할당 알고리즘 검증 완료
  - [ ] validateAllocation() 경고 없음
  - [ ] 모든 상담사 A/B 50:50 확인
- [ ] Week 1 Monday.com 태스크 자동 생성 (Day 5)
  - [ ] 10개 태스크 생성 (상담사 5명 × 2)
  - [ ] 각 태스크 확인
  - [ ] 상담사별 알림 설정
- [ ] A/B 테스트 시작 (Day 5)
  - [ ] 상담사들에게 Week 1 할당 공지
  - [ ] Monday.com 대시보드 오픈
  - [ ] 초기 콜 3-5개 수집 (정상 작동 확인)

---

## Phase 4: 수집 & 모니터링 (Day 6-13: 5월 26-6월 2)

### Track A: 모니터링

- [ ] 일일 콜 수집 확인 (목표: 주당 50콜)
  - [ ] Day 6-7 (주중): 30콜 달성?
  - [ ] Day 8-9 (주중): 추가 15콜?
  - [ ] Day 10-11 (주말): 추가 5콜?
  - [ ] Day 12 (월): 누적 50콜?
- [ ] CallLog 기록 품질 확인
  - [ ] objectionTypes 기록 완전한가?
  - [ ] objectionHandling JSON 구조 정확한가?
  - [ ] customerReaction 기록되었는가?
- [ ] 중간 분석 (Day 10)
  - [ ] 콜 30개 기준 임시 통계 (이의별 회복율)
  - [ ] 예상효과 80% 달성하는가?

### Track C: 모니터링

- [ ] Day 0-1 응답 수집 (Day 6-8)
  - [ ] 1400명 중 응답율 목표: 85% (1190명)
  - [ ] 파싱 성공율 목표: 95% (1130명)
  - [ ] 폴백 필요 고객: ~60명 (재질문 또는 전화)
- [ ] Day 1-2 응답 수집 (Day 8-10)
  - [ ] 결혼년수 추출 성공율: 85-90%
  - [ ] 자녀 나이 추출 성공율: 80-85%
- [ ] Day 2-3 응답 수집 (Day 10-13)
  - [ ] 나이 추출 성공율: 90-95%
  - [ ] 여행목적 추출 성공율: 75-80%
- [ ] 자동분류 진행 모니터링
  - [ ] Contact.autoSegment 업데이트: 몇 명?
  - [ ] seg:A/B/C/D 태그 기록: 정확한가?

### Track D: 모니터링

- [ ] Monday.com 진행률 추적
  - [ ] Week 1 태스크 진행도 확인 (목표: 50콜 달성 %)
  - [ ] 각 상담사별 진행도 비교
  - [ ] 지연 상담사 파악 및 독려
- [ ] Week 2 할당 준비 (Day 10-12)
  - [ ] Week 2 태스크 자동 생성 확인
  - [ ] Crossover 적용 확인 (특히 해당 주에 스왑되는 상담사)
  - [ ] 상담사 재공지

---

## Phase 5: 분석 (Day 14-17: 6월 3-6)

### Track A: 통계 분석

- [ ] 데이터 정제 (Day 14)
  - [ ] 50콜 모두 수집 확인
  - [ ] 결손값(NULL) 제거
  - [ ] 이상치 검토
- [ ] 이의별 회복율 계산 (Day 14)
  - [ ] 24가지 이의 각각의 회복율
  - [ ] TOP 5 이의 식별
  - [ ] 95% CI 계산
- [ ] 세그먼트별 분석 (Day 15)
  - [ ] Segment A/B/C/D별 회복율 비교
  - [ ] ANOVA 또는 t-test 실행
  - [ ] 통계적 유의성 확인
- [ ] 상담사별 분석 (Day 15)
  - [ ] 5명 상담사 성과 비교
  - [ ] 강점/약점 이의 식별
  - [ ] 상담사별 개선안 도출
- [ ] 기대효과 검증 (Day 16)
  - [ ] 50콜의 최종 전환율 계산
  - [ ] 이전 4주 평균 전환율과 비교 (Chi-square test)
  - [ ] Effect Size (Cohen's h) 계산
  - [ ] 통계적 유의성 (p-value) 확인
- [ ] 보고서 작성 (Day 16-17)
  - [ ] TRACK_A_50CALL_VALIDATION_RESULT.md
  - [ ] TRACK_A_BEST_PRACTICES.md

### Track C: 통계 분석

- [ ] 응답 데이터 정리 (Day 14)
  - [ ] 총 고객 수
  - [ ] Day 0-3 각 단계별 응답자 수
  - [ ] 폴백 필요 고객 수
- [ ] 파싱 정확도 분석 (Day 14)
  - [ ] 각 NLP 함수의 성공율
  - [ ] 신뢰도별 분포
  - [ ] 오류 유형 분류 (false positive, false negative)
- [ ] 자동분류 결과 분석 (Day 15)
  - [ ] Contact.autoSegment 분포 (A/B/C/D/unclassified)
  - [ ] 기대 분포와 실제 분포 비교
  - [ ] 품질 지표 (정밀도, 재현율)
- [ ] 개선안 도출 (Day 16)
  - [ ] NLP 함수 개선 필요 부분
  - [ ] 폴백 전략 효과성 평가
  - [ ] Phase 2 고도화 방안
- [ ] 보고서 작성 (Day 16-17)
  - [ ] TRACK_C_ONBOARDING_STATISTICS.md
  - [ ] TRACK_C_SMS_IMPROVEMENTS.md

### Track D: 검증

- [ ] 할당 균형 검증 (Day 14)
  - [ ] 각 상담사 A/B 콜 수 확인 (기대: 20±1)
  - [ ] Stratum별 분포 확인
  - [ ] Crossover 적용 확인
- [ ] 통계 파워 확인 (Day 15)
  - [ ] 표본 크기: 200콜 ✓
  - [ ] 효과 크기 추정 (A vs B 예상 차이)
  - [ ] 신뢰도/파워 계산
- [ ] 알고리즘 최적화 (Day 16)
  - [ ] 추가 Crossover 필요한가?
  - [ ] Block size 조정 필요한가?
  - [ ] Week 2-12에 대한 예측 모델링
- [ ] 보고서 작성 (Day 16-17)
  - [ ] TRACK_D_ALLOCATION_SCHEDULE_FINAL.md
  - [ ] TRACK_D_STATISTICAL_POWER.md

---

## Phase 6: 최종 완성 및 차기 계획 (Day 18: 6월 7)

- [ ] 3개 Track 산출물 통합 검토
  - [ ] Track A: Best Practices 가이드 최종화
  - [ ] Track C: SMS 마법사 Phase 2 계획 (Day 4-7 응답 기반)
  - [ ] Track D: Week 2-12 일정 확정
- [ ] 경영진 보고 자료 준비
  - [ ] Executive Summary (1페이지)
  - [ ] 주요 발견사항 3가지
  - [ ] 차기 Action Items (Track A 최적화, Track C Phase 2, Track D 실행 확대)
- [ ] Phase 4 준비 계획
  - [ ] Week 2-12 A/B 테스트 실행 (Track D)
  - [ ] SMS 마법사 고도화 (Track C Phase 2)
  - [ ] Call Script 최적화 (기존 Track B와 Track A 결과 통합)

---

## 성공 기준

### Track A ✅
- [ ] 50콜 수집 완료
- [ ] 이의별 회복율 ≥70%
- [ ] 기대효과 +20-30% 달성 (통계적 유의성 p<0.05)
- [ ] Best Practices 가이드 생성

### Track C ✅
- [ ] 4단계 SMS 마법사 설계 및 구현 완료
- [ ] NLP 파싱 5가지 테스트 케이스 모두 통과
- [ ] 1400명 대상 Day 0 SMS 배포 완료
- [ ] 자동분류 트리거 작동 확인 (Contact.autoSegment 업데이트)
- [ ] 폴백 시스템 정상 작동 (신뢰도 기반 자동/수동/재질문/전화)

### Track D ✅
- [ ] Block Randomization 공식 검증
- [ ] Stratification 3레이어 완성
- [ ] Crossover 스케줄 적용 확인
- [ ] Monday.com 연동 테스트 완료 (API 호출 성공)
- [ ] 12주 할당 일정 확정 (각 상담사 A/B 50:50)
- [ ] Week 1 태스크 10개 자동 생성 및 배포

---

## 리스크 및 대응

### Track A 리스크
| 리스크 | 확률 | 영향 | 대응 |
|--------|------|------|------|
| 콜 수집 지연 (목표 50콜 미달성) | 중 | 높음 | 상담사 독려, 추가 보상 제공 |
| 이의 기록 누락 | 중 | 중간 | 상담사 훈련 강화, 자동 검증 로직 추가 |
| 통계적 유의성 부족 (p>0.05) | 낮음 | 높음 | 추가 50콜 수집, 분석 기간 연장 |

### Track C 리스크
| 리스크 | 확률 | 영향 | 대응 |
|--------|------|------|------|
| NLP 파싱 오류율 높음 (신뢰도 <50%) | 중 | 높음 | 재질문 자동화, 상담사 수동 검토 |
| SMS 응답율 저조 (<70%) | 중간 | 중간 | SMS 문구 개선, 발송 시간 최적화 |
| Contact.autoSegment 업데이트 지연 | 낮음 | 낮음 | 배치 프로세스 최적화 |

### Track D 리스크
| 리스크 | 확률 | 영향 | 대응 |
|--------|------|------|------|
| Monday.com API 장애 | 낮음 | 중간 | 폴백: 수동 CSV 배포, Slack 알림 |
| 상담사 할당 거부/이탈 | 낮음 | 높음 | 사전 동의, 인센티브 제공 |
| Block Randomization 알고리즘 오류 | 낮음 | 높음 | 독립 검증(다른 개발자), Unit test |

---

## 의존성 및 순서

```
Day 1-2: 설계 (병렬)
  ├─ Track A: A5 가이드 검토 + 상담사 훈련 계획
  ├─ Track C: SMS 설계 + NLP 함수 개발 준비
  └─ Track D: 상담사 데이터 수집 + 알고리즘 설계

Day 2-4: 구현 (병렬)
  ├─ Track A: CallLog 스키마 + 상담사 훈련
  ├─ Track C: NLP 구현 + 폴백 전략 → SMS 배포 준비
  └─ Track D: 할당 함수 구현 + Monday.com 테스트

Day 5: 배포 (순차)
  1. Track A: 상담사 훈련 + 콜 기록 시작
  2. Track C: SMS Day 0 배포 시작
  3. Track D: Week 1 태스크 생성 + A/B 테스트 시작

Day 6-13: 모니터링 (병렬)
Day 14-17: 분석 (병렬)
Day 18: 최종 완성
```

---

## 커뮤니케이션 계획

### 상담사 대상
- [ ] Day 1: Track A 훈련 일정 공지 (메일/카톡)
- [ ] Day 2: A5 가이드 배포 및 1시간 설명회
- [ ] Day 5: 최종 훈련 + 콜 기록 양식 배포
- [ ] 주간: Monday.com 진행률 공유 (매주 금요일)

### 경영진 대상
- [ ] Day 1: Phase 3 Track A/C/D 계획 보고 (5분)
- [ ] Day 10: 중간 점검 (콜 30개, SMS 응답 700+ 예상)
- [ ] Day 18: 최종 결과 보고 (15분)
- [ ] 월간: Track별 KPI 대시보드 (자동 업데이트)

### 개발팀 대상
- [ ] Day 1: 구현 요구사항 공유 (GitHub Issues)
- [ ] Day 2-4: 일일 Standup (구현 진행도)
- [ ] Day 5: 배포 체크리스트 확인
- [ ] Day 14-17: 분석 결과 통합

---

## 산출물 최종 체크리스트

### Track A
- [ ] TRACK_A_50CALL_VALIDATION_RESULT.md (2000자 이상)
- [ ] TRACK_A_BEST_PRACTICES.md (1500자 이상)
- [ ] CallLog 데이터 (50개 레코드, 완전한 필드)
- [ ] 통계 CSV (이의별 회복율, 세그먼트별 분석, 상담사별 비교)

### Track C
- [ ] TRACK_C_SMS_ONBOARDING_DESIGN.md (이미 생성됨)
- [ ] src/lib/contact/sms-onboarding-parser.ts (이미 생성됨)
- [ ] TRACK_C_ONBOARDING_STATISTICS.md
- [ ] SMS 응답 데이터 (1400명 × 4일 = 5600+ 레코드)
- [ ] Contact 업데이트 로그 (1400명, autoSegment 기록)

### Track D
- [ ] TRACK_D_ALLOCATION_ALGORITHM.md (이미 생성됨)
- [ ] src/lib/analytics/ab_test_allocation.ts (이미 생성됨)
- [ ] TRACK_D_ALLOCATION_SCHEDULE_FINAL.csv
- [ ] TRACK_D_STATISTICAL_POWER.md
- [ ] Monday.com 태스크 (총 48개: 주당 10개 × 12주, 아직 Week 1만 생성)

---

## 다음 세션 준비

### 메모리에 저장할 항목
- [ ] 3개 Track의 최종 산출물 경로
- [ ] 주요 발견사항 3-5가지
- [ ] Phase 4 계획 (Track A 최적화, Track C Phase 2, Track D 확대)
- [ ] 상담사별 강점/약점 (Track A 분석 결과)
- [ ] SMS 파싱 오류 패턴 (Track C 분석 결과)

### 차기 작업 (Phase 4 준비)
- [ ] Week 2-12 A/B 테스트 실행 계획
- [ ] SMS 마법사 고도화 (Day 4-7 응답 분석 기반)
- [ ] Call Script 최적화 (Track A 이의처리 + Track B 스크립트 통합)
- [ ] 콜 성과 대시보드 구축 (실시간 A/B 효과 추적)

---

## 승인 및 서명

**프로젝트 매니저:** 

**기술 리더:** 

**경영진:** 

**작성 일자:** 2026-05-22

**최종 수정:** 
