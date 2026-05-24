# Hook Integration Checklist (2026-05-24)

## 개요
이 체크리스트는 4개 Hook(Commit/PR/Merge/Build)이 실제로 작동하는지 확인하는 구체적인 검증 항목입니다.

---

## Hook 1: psychology-validation (Commit 전)

### 검증 목표
커밋 전 코드가 SPIN/PASONA/심리학 10렌즈 기준을 충족하는지 확인

### 작동 원리
- Trigger: `git commit` 명령 실행 시
- Condition: `src/app/api/**`, `src/app/(dashboard)/**` 파일 변경 감지
- Action: 자동 검증 + 보고서 출력 (commit 진행 가능/불가능)

### 검증 항목 10개

#### 1. SPIN 패턴 감지 (이의대응 관련 파일)
- [ ] 파일명 패턴 확인: `**/objection*`, `**/rebuttal*`, `**/response*` 매칭 여부
- [ ] 매칭된 경우 아래 4단계 모두 존재?
  - [ ] S (Situation): 고객의 현재 상황 명시 ("지난 3개월 환불율 XX%")
  - [ ] P (Problem): 문제 명확화 ("높은 환불율 = 고객 불만족")
  - [ ] I (Implication): 심각성 최소 2-3가지 확대 (손실액, 평판, 기회손실)
  - [ ] N (Need/Payoff): 해결책 2개 + 정량적 목표 ("환불율 5% → 월 ₩XXK 회복")

#### 2. PASONA 패턴 감지 (마케팅/SMS 파일)
- [ ] 파일명 패턴 확인: `**/sms*`, `**/message*`, `**/campaign*`, `**/marketing*` 매칭 여부
- [ ] 매칭된 경우 아래 6단계 모두 존재?
  - [ ] P (Problem): 고객의 문제 명시 ("저수익", "시간부족", "불안감")
  - [ ] A (Agitate): 감정 자극 ("경쟁사는 30% 더 벌고 있다", "지금 신청하면 ₩300K 보너스")
  - [ ] S (Solution): 구체적 해결책 ("우리 상품 선택", "5분 신청")
  - [ ] O (Offer): 명확한 오퍼 ("초대 보너스 ₩300K + 즉시 정산")
  - [ ] N (Narrow): 타겟팅 ("파트너님 전용", "오늘만")
  - [ ] A (Action): 명확한 CTA ("지금 신청하기", "더 알아보기")

#### 3. 심리학 10렌즈 감지 (코드 전체)
- [ ] 최소 3개 이상 렌즈 명시적 발견?
  - [ ] L0: 부재중고객재활성화 (`inactivityDays`, `reactivation`, `comeback`)
  - [ ] L1: 가격이의대응 (`price`, `cost`, `expense`, `affordable`)
  - [ ] L2: 준비복잡불안 (`preparation`, `readiness`, `timeline`, `guide`)
  - [ ] L3: 차별성미인지 (`differentiation`, `competitor`, `comparison`)
  - [ ] L4: 기항지선택불안 (`destination`, `choice`, `flexibility`)
  - [ ] L5: 적합성의심 (`suitable`, `fit`, `compatibility`, `medical`)
  - [ ] L6: 타이밍손실회피 (`timing`, `now`, `today`, `deadline`, `limited`)
  - [ ] L7: 동반자설득 (`companion`, `family`, `spouse`, `friend`)
  - [ ] L8: 재구매습관화 (`repurchase`, `repeat`, `habit`, `lifetime`)
  - [ ] L9: 의료신뢰 (`health`, `safety`, `medical`, `trust`, `doctor`)
  - [ ] L10: 즉시구매클로징 (`close`, `decide`, `commit`, `now`)

#### 4. 코드 구조 검증
- [ ] 함수/변수명 일관성: camelCase/snake_case 일관성 확인
- [ ] 타입 안전성: TypeScript 타입 명시 (any 최소화)
- [ ] 에러 처리: try-catch 또는 에러 경계 있는가?

#### 5. PASONA Day 0-3 SMS 시퀀스 검증 (SMS 파일만)
- [ ] Day 0 메시지 (2시간 내): 초기 액션 + P/A 단계?
  - [ ] 예시: "지금 신청하면 월 추가 수익 확인! 5분만 확인해보세요"
- [ ] Day 1 메시지 (다음날 오전): Follow-up + S 단계?
  - [ ] 예시: "경쟁사보다 30% 높은 수익? 진짜일까? 확인 →"
- [ ] Day 2 메시지 (다음다음날): 가치 강조 + O 단계?
  - [ ] 예시: "실제 파트너 월 ₩2M 수익 창출 중. 사례 보기 →"
- [ ] Day 3 메시지 (3일차 오후): 긴박감 + A 단계?
  - [ ] 예시: "마감 임박! 오늘 결정 시 초대 보너스 ₩300K"

#### 6. 성과 메트릭 명시 (신규 기능/메뉴 파일)
- [ ] 현재 전환율 % 명시? (기존 벤치마크)
- [ ] 목표 전환율 % 명시? (심리학 적용 후)
- [ ] 기대 상승율 계산? ((목표-현재)/현재 * 100)
- [ ] CPA/LTV 목표 명시? (선택)

#### 7. 세그먼트별 페르소나 검증 (마케팅 파일)
- [ ] 신민형 전략 적용? (욕망깨우기 → 프리미엄 → 비용해결 → 클로징)
- [ ] 모니카 전략 적용? (감정재연결 → 가치재정의 → 이의대응)
- [ ] Russell Brunson 적용? (Hook → Story → Offer → Objection → Urgency → Close)

#### 8. 이의대응 시나리오 5개 이상 (판매 파일)
- [ ] 가격 이의 (가치 재정의): "이게 왜 비싼가?"
- [ ] 준비 이의 (불안 해소): "준비가 복잡할 것 같아"
- [ ] 기항지 이의 (차별성 강조): "다른 곳도 비슷한데?"
- [ ] 자유 이의 (유연성 증명): "나중에 해도 되지 않나?"
- [ ] 의료/능력 이의 (권위성): "진짜 안전한가?"

#### 9. CRM 자동분류 규칙 (Contact 필드)
- [ ] 렌즈 필드 존재 (contacts.lens)? L0-L10 매핑
- [ ] 자동 분류 로직 활성화?
  - [ ] 부재중 기간별 L0 자동 분류
  - [ ] 가격 민감도 L1 자동 분류
  - [ ] 준비도 점수 L2 자동 계산
  - [ ] 타이밍 L6 실시간 감지

#### 10. Risk Flag 자동 생성 (선택)
- [ ] 10개 Risk Flag 정의되었는가? (또는 최소 3개)
  - [ ] RF1: 고환불율 (>20%)
  - [ ] RF2: 장시간 부재 (>6개월)
  - [ ] RF3: 저가격 민감도 (L1 고위험)
  - [ ] RF4: 준비 복잡도 과다 (L2 고위험)
  - [ ] RF5: 경쟁사 언급 (L3 위협)

### 예상 Hook 1 출력

```
✓ PASONA 검증: 6/6 완성 ✓
⚠ 심리학 렌즈: L6만 감지, 최소 3개 필요
→ 추천: L3, L10 추가 적용

Commit 진행? (Y/n):
```

---

## Hook 2: psychology-checklist (PR 생성 전)

### 검증 목표
PR 본문에 심리학 체크리스트 자동 추가 및 완성도 확인

### 작동 원리
- Trigger: `gh pr create` 명령 실행 시
- Condition: 변경 파일 >10개 또는 라인 변경 >500
- Action: PR 본문 템플릿 자동 추가

### 검증 항목 10개

#### 1. PR 본문 심리학 섹션 자동 추가
- [ ] PR 생성 후 본문에 "심리학 기반 코드 리뷰" 섹션 존재?
- [ ] 자동 추가된 체크리스트 10렌즈 모두 나열?
  - [ ] L0-L10 옵션 제시
  - [ ] 체크박스 형식 제공

#### 2. 심리학 10렌즈 실제 적용 확인
- [ ] 코드에서 감지된 렌즈 개수 >= 3개?
- [ ] 감지 결과 자동 체크표시 (☑)?
- [ ] 미적용 렌즈에 추천 메시지? ("추가 권장")

#### 3. SMS 자동화 Day 0-3 체크리스트
- [ ] PR 본문에 Day 0-3 항목 4개 모두 제시?
- [ ] 각 Day별 예시 메시지 포함?

#### 4. Grant Cardone 판매 기법 체크리스트
- [ ] 콜드콜 4단계 (Prospecting→Qualifying→Presenting→Closing) 제시?
- [ ] LISTEN-ISOLATE-VALID 이의대응 구조 제시?
- [ ] 5-12회 Follow-up 명시?

#### 5. PASONA 프레임워크 체크리스트
- [ ] P→A→S→O→N→A 6단계 제시?
- [ ] 코드에서 감지된 단계 자동 마킹?

#### 6. 성과 메트릭 정의 자동화
- [ ] 현재 vs 목표 메트릭 테이블 제시?
- [ ] 필수 메트릭 4가지:
  - [ ] 전환율: 현재 __% → 목표 __% (변화율 계산)
  - [ ] CPA: 현재 ___원 → 목표 ___원 (절감율 계산)
  - [ ] LTV: 현재 ___원 → 목표 ___원 (증가율 계산)
  - [ ] Day 3 최종전환율: 목표 __% (심리학 적용 후)

#### 7. 마케팅 채널별 최적화 체크리스트
- [ ] 채널별 목표 제시?
  - [ ] Facebook: CPC 20-30% ↓, 전환율 2-4%
  - [ ] Instagram: 40개 해시태그, 쇼핑기능 활성화
  - [ ] Google: Performance Max, ROAS 3.0배 목표
  - [ ] SMS/Email: PASONA Day 0-3 시퀀스
  - [ ] Blog: SEO 1500-2000자, 4-6 키워드

#### 8. RAG 메모리 참고 링크 자동 추가
- [ ] PR 본문 하단에 "참고 메모리" 섹션?
- [ ] 최소 3-4개 관련 메모리 파일 링크?
  - [ ] docs/CLAUDE_RAG_INDEX.md
  - [ ] docs/CLAUDE_AGENT_PROMPTS.md
  - [ ] docs/CLAUDE_AGENT_USAGE_GUIDE.md
  - [ ] 관련 Template 파일 링크

#### 9. Reviewer 자동 할당 (선택)
- [ ] 코드 리뷰어 자동 지정?
  - [ ] 심리학 전문가 (Grant Cardone/PASONA)
  - [ ] 마케팅 자동화 전문가
  - [ ] 성과 측정 전문가

#### 10. PR 승인 기준 명시
- [ ] PR 머지 조건 자동 제시?
  - [ ] 심리학 10렌즈 최소 3개 적용 ✓
  - [ ] Day 0-3 자동화 시퀀스 완성 ✓
  - [ ] 성과 메트릭 정의 ✓
  - [ ] 코드 리뷰 승인 ✓

### 예상 Hook 2 출력

```
PR Body 자동 추가:

## 심리학 기반 코드 리뷰

### 심리학 적용
- [x] L6: 타이밍결정손실회피
- [ ] L3: 차별성미인지 (추가 권장)
- [ ] L10: 즉시구매클로징 (추가 권장)

실제 적용: 1/3개 ⚠

### 자동화 시퀀스
- [x] Day 0-3 SMS 모두 포함 ✓

PR URL: https://github.com/mabiz/crm/pull/1245
```

---

## Hook 3: rag-memory-reference (Merge 전)

### 검증 목표
Merge 전 RAG 메모리 자동 참고 및 관련 문서 제시

### 작동 원리
- Trigger: `git merge --ff` 또는 GitHub PR merge 시
- Condition: `target branch == main` AND 파일 변경 감지
- Action: 관련 RAG 메모리 4개 자동 추천

### 검증 항목 10개

#### 1. 파일 변경 유형 자동 분류
- [ ] 변경 파일 패턴 감지 (설정된 4가지):
  - [ ] 판매콜센터: `src/app/api/**/call**`, `**/sales**`
  - [ ] 마케팅자동화: `src/app/api/**/campaign**`, `**/sms**`
  - [ ] CRM분류: `src/lib/utils/classify**`, `prisma/schema.prisma`
  - [ ] 대시보드KPI: `src/app/(dashboard)/dashboard**`, `**/analytics**`

#### 2. RAG 인덱스 자동 매핑
- [ ] CLAUDE_RAG_INDEX.md 파일 자동 읽음?
- [ ] 변경 유형별 관련 메모리 3순위 자동 추천?
  - [ ] 1순위: 가장 관련 높음
  - [ ] 2순위: 보조 참고
  - [ ] 3순위: 선택 참고
  - [ ] 4순위: 앞서 구현 사례

#### 3. 판매콜센터 관련 Merge
- [ ] 판매 파일 변경 감지 시 아래 메모리 자동 제시?
  - [ ] grant_cardone_closing.md
  - [ ] grant_cardone_rebuttal.md
  - [ ] cold_call_script_v6_complete.md

#### 4. 마케팅자동화 관련 Merge
- [ ] SMS/캠페인 파일 변경 감지 시 아래 메모리 자동 제시?
  - [ ] pasona_framework_complete.md
  - [ ] rental_sms_3day_sequence.md
  - [ ] sns_facebook_advertising.md

#### 5. CRM분류 관련 Merge
- [ ] Contact 분류 파일 변경 감지 시 아래 메모리 자동 제시?
  - [ ] l0_reactivation_inactive_customers.md
  - [ ] l1_lens_complete.md
  - [ ] l2_lens_5step_mediation_questions.md
  - [ ] contact_auto_classification.md

#### 6. 대시보드KPI 관련 Merge
- [ ] 대시보드/분석 파일 변경 감지 시 아래 메모리 자동 제시?
  - [ ] phase3_track_d_ab_test_complete.md
  - [ ] psychology_theories_master.md
  - [ ] menu_40_psychology_implementation.md

#### 7. 새로운 렌즈/기법 감지
- [ ] 커밋 메시지에서 새로운 심리학 기법 감지?
  - [ ] "새로운 L[X] 렌즈" 또는 "신규 심리학 기법" 포함 시 경고
  - [ ] 새로운 기법 추가 시 CLAUDE_RAG_INDEX.md 업데이트 권고

#### 8. 메모리 파일 링크 검증
- [ ] 제시된 메모리 파일 실제 존재 확인?
  - [ ] 파일 없으면 "⚠ 파일 미발견" 표시
  - [ ] 파일 있으면 "✓ 파일 존재" 표시

#### 9. Merge 커밋 메시지 템플릿
- [ ] 자동 커밋 메시지 제시?
  - [ ] 형식: `Merge branch 'feature/menu-X' into main (#XXXX)`
  - [ ] 본문: 관련 RAG 메모리 파일 목록

#### 10. Merge 후 자동 작업
- [ ] Merge 완료 후 자동 알림 제시?
  - [ ] 새 릴리스 노트 생성?
  - [ ] 팀 Slack 알림?
  - [ ] 메모리 인덱스 업데이트 필요 여부?

### 예상 Hook 3 출력

```
🔍 변경된 파일 유형 감지:
   "마케팅자동화" - SMS 템플릿 포함

📚 관련 메모리 파일 자동 제시:
   
   ★ 1순위: pasona_framework_complete.md
      → PASONA 6단계 템플릿 및 심리학 원리
   
   ★ 2순위: grant_cardone_closing.md
      → L6 손실회피 + 긴박감 기법 (Day 3)
   
   ★ 3순위: l6_timing_loss_aversion.md
      → "지금 vs 내일" 메시지 템플릿
      → 기대 전환율: 52% → 71%

✓ Merge 완료 (Commit: a184c49)
```

---

## Hook 4: marketing-optimization-check (Build 전)

### 검증 목표
프로덕션 배포 전 마케팅 자동화 4개 영역 완성도 검증

### 작동 원리
- Trigger: `npm run build` (프로덕션 빌드만)
- Condition: `build type == production` 또는 `environment == vercel`
- Action: 4개 검증 영역 각각 점수 계산 후 최종 배포 준비도 산출

### 검증 항목 10개 (영역별)

#### 영역 1: SMS/이메일 Day 0-3 자동화 검증

**1-1. Day 0 초기 메시지 (2시간 내)**
- [ ] 파일 존재: `src/lib/sms/templates/day0.ts` 또는 유사?
- [ ] P (Problem) 단계 포함?
  - [ ] 예: "저수익", "시간부족", "불안감"
- [ ] A (Agitate) 단계 포함?
  - [ ] 예: "경쟁사는 30% 더", "마감 임박"
- [ ] 발송 트리거: 신청 후 2시간 이내?

**1-2. Day 1 Follow-up (다음날 오전)**
- [ ] 파일 존재: `src/lib/sms/templates/day1.ts` 또는 유사?
- [ ] S (Solution) 단계 포함?
  - [ ] 예: "우리 상품 선택", "5분 신청"
- [ ] 이의대응 첫 번째 (가격/시간/불안)?
- [ ] 발송 시간: 오전 9-11시?

**1-3. Day 2 가치 강조 (다음다음날)**
- [ ] 파일 존재: `src/lib/sms/templates/day2.ts` 또는 유사?
- [ ] O (Offer) 단계 포함?
  - [ ] 예: "보너스 ₩300K", "즉시 정산"
- [ ] 사례 스토리 포함?
  - [ ] 예: "실제 파트너 월 ₩2M"
- [ ] 발송 시간: 오후 2-4시?

**1-4. Day 3 긴박감 (3일차 오후)**
- [ ] 파일 존재: `src/lib/sms/templates/day3.ts` 또는 유사?
- [ ] A (Action) 단계 포함?
  - [ ] 명확한 CTA: "지금 신청", "오늘 결정"
- [ ] N (Narrow) 단계 포함?
  - [ ] 타겟팅: "오늘만", "한정수량"
- [ ] 발송 시간: 오후 6-8시?

**1-5. Day 7 재접근 (선택, 1주일 후)**
- [ ] 파일 존재: `src/lib/sms/templates/day7.ts` 또는 유사?
- [ ] 재접근 메시지: "마지막 기회", "제한 해제"?
- [ ] Grant Cardone Follow-up: 5-12회 추적?

**1-6. 템플릿 발송 자동화 설정**
- [ ] 발송 예약 (cron) 설정?
  - [ ] Day 0: 신청 후 2시간 자동
  - [ ] Day 1: 자정 기준 다음날 오전 9시
  - [ ] Day 2: 자정 기준 다다음날 오후 2시
  - [ ] Day 3: 자정 기준 3일차 오후 6시
- [ ] 에러 처리: 발송 실패 시 재시도?
- [ ] 로깅: 발송 이력 DB 저장?

**검증 결과: X/6 완성 (XX%)**

#### 영역 2: 광고 캠페인 ROAS/CPA 자동 추적

**2-1. Facebook 광고 추적**
- [ ] 파일 존재: `src/app/api/campaigns/facebook.ts`?
- [ ] CPC (클릭당 비용) 추적 설정?
  - [ ] Facebook Pixel 설치?
  - [ ] 전환 이벤트 로깅?
- [ ] 전환율 로깅: 광고→클릭→신청 퍼널 추적?
- [ ] 목표: CPC 20-30% 감소?

**2-2. Google 광고 추적**
- [ ] 파일 존재: `src/app/api/campaigns/google.ts`?
- [ ] GA4 연동: 각 광고 클릭 추적?
- [ ] Performance Max 설정?
- [ ] ROAS 목표: 3.0배 이상?

**2-3. Naver 광고 추적**
- [ ] 파일 존재: `src/app/api/campaigns/naver.ts`?
- [ ] DA (동적 광고) 입찰 자동화?
- [ ] CPA 자동 최적화?
- [ ] 월 예산 배분: 현재 대비 효율성?

**2-4. ROI 계산 자동화**
- [ ] 공식 구현: (매출 - 광고비) / 광고비 * 100?
- [ ] 일일 계산?
- [ ] 채널별 계산?

**2-5. KPI 대시보드 수집**
- [ ] 파일 존재: `src/app/(dashboard)/analytics/kpi.ts`?
- [ ] 메트릭 수집:
  - [ ] 도달 (Reach): 일일 집계?
  - [ ] 노출 (Impression): 일일 집계?
  - [ ] 클릭 (Click): 일일 집계?
  - [ ] 전환 (Conversion): 일일 집계?

**2-6. 주간 성과 리포팅 자동화**
- [ ] 리포트 생성: 매주 월요일 9시?
- [ ] 포함 항목:
  - [ ] 채널별 도달/노출/클릭/전환
  - [ ] CPC/CPA/ROAS 추이
  - [ ] 주간 vs 월간 비교
  - [ ] 권장 최적화 항목

**검증 결과: X/6 완성 (XX%)**

#### 영역 3: Contact 자동분류 렌즈 라벨 매핑

**3-1. L0: 부재중고객 필드**
- [ ] 필드 존재: `contacts.inactivityDays`?
- [ ] 자동 계산: 마지막 접촉 → 경과일수?
- [ ] 분류 규칙:
  - [ ] 3-6개월: 경고
  - [ ] 6-12개월: 위험
  - [ ] 1년+: 극위험

**3-2. L1: 가격민감도 필드**
- [ ] 필드 존재: `contacts.priceSegment`?
- [ ] 자동 분류:
  - [ ] 가격이의 언급 수 >= 3회
  - [ ] 평균 가격대 vs 시장 평균 비교
  - [ ] 이의대응 시간 측정

**3-3. L2: 준비도 필드**
- [ ] 필드 존재: `contacts.readinessScore` (0-100)?
- [ ] 자동 계산 요소:
  - [ ] 준비 질문 응답 수 (가중치 20%)
  - [ ] 여행경험 (가중치 30%)
  - [ ] 타임라인 명확도 (가중치 50%)

**3-4. L3: 차별성이해도 필드**
- [ ] 필드 존재: `contacts.differentiationScore`?
- [ ] 자동 감지:
  - [ ] 경쟁사 언급 감지
  - [ ] 비교 질문 감지
  - [ ] 특징 이해도 점수

**3-5. L5-L10: 세그먼트별 필드**
- [ ] 필드 존재: `contacts.lens` (L5-L10)?
- [ ] 자동 분류 규칙:
  - [ ] L5: 자기투영 신호 (암, 배멀미, 당뇨, 초보)
  - [ ] L6: 타이밍 신호 (나이, 가격 상승, 시즌)
  - [ ] L7: 동반자 신호 (배우자 언급, 아이 언급)
  - [ ] L8: 재구매 신호 (이전 구매 이력, 강조)
  - [ ] L9: 의료신뢰 신호 (건강 질문, 안전 우려)
  - [ ] L10: 클로징 신호 (결정 임박, 긍정 신호)

**3-6. 자동분류 엔진 및 스케줄**
- [ ] 분류 로직 파일: `src/lib/utils/classify.ts`?
- [ ] 일일 업데이트 예약: cron `0 0 * * *` (자정)?
- [ ] 실시간 업데이트: 상담 후 즉시?
- [ ] 에러 처리: 분류 실패 시 로깅?

**검증 결과: X/7 완성 (XX%)**

#### 영역 4: 대시보드 KPI 자동 계산

**4-1. 콜 전환율 자동 계산**
- [ ] 필드 존재: `dashboard.callConversionRate`?
- [ ] 공식: (성약 건수) / (콜 수) * 100?
- [ ] 일일 계산?
- [ ] 팀별 계산?

**4-2. SMS 개봉율 자동 계산**
- [ ] 연동: 알리고 API 또는 유사 SMS 서비스?
- [ ] 메트릭: (개봉 SMS 수) / (발송 수) * 100?
- [ ] Day별 추적: Day 0/1/2/3 개봉율 분리?

**4-3. Follow-up 효율성 자동 계산**
- [ ] 정의: (5-12회 후 성약) / (5-12회 콜 시도) * 100?
- [ ] Grant Cardone 기준: 80% 이상 목표?
- [ ] Contact별 추적?

**4-4. CPA/LTV 자동 계산**
- [ ] CPA (고객획득비용): (광고비 + 콜센터비) / (신규 고객) = ₩XXX?
- [ ] LTV (생명주기가치): (평균 수익) * (재구매율) * (기간) = ₩XXXX?
- [ ] ROI: (LTV - CPA) / CPA * 100?

**4-5. 일일 업데이트 스케줄**
- [ ] 매시간 업데이트: cron `0 * * * *`?
- [ ] 데이터 출처 확인:
  - [ ] 콜 데이터: CRM DB
  - [ ] SMS 데이터: SMS 서비스 API
  - [ ] 광고 데이터: Facebook/Google/Naver API

**4-6. 팀 대시보드 공유**
- [ ] Role별 권한: Admin/Team Lead/Partner/Employee?
- [ ] 표시 항목:
  - [ ] Role=Partner: 개인 통계만
  - [ ] Role=Team Lead: 팀 통계
  - [ ] Role=Admin: 전체 통계

**4-7. Alert 규칙 설정**
- [ ] KPI 낙폭 시 자동 알림?
  - [ ] 콜 전환율 -5% 이상: 즉시 알림
  - [ ] SMS 개봉율 -10% 이상: 즉시 알림
  - [ ] CPA 상승 +20% 이상: 즉시 알림
- [ ] 알림 채널:
  - [ ] 이메일?
  - [ ] Slack?
  - [ ] SMS?

**검증 결과: X/7 완성 (XX%)**

### 최종 배포 준비도 계산

```
영역 1 (SMS Day 0-3): A/6 = A%
영역 2 (광고 추적): B/6 = B%
영역 3 (Contact 분류): C/7 = C%
영역 4 (KPI 대시보드): D/7 = D%

최종 점수 = (A+B+C+D) / (6+6+7+7) * 100
         = X / 26 * 100
         = XX%
```

**배포 기준**:
- 90% 이상: ✅ 배포 승인
- 80-89%: ⚠ 경고 (P1 작업 후 배포)
- 70-79%: 🔴 배포 연기 (P0+P1 완성 필요)
- 69% 이하: 🚫 배포 중단

### 예상 Hook 4 최종 리포트

```
📊 최종 배포 준비도: 92% (31/34 완성)

✓ 영역 1 (SMS Day 0-3): 100% (6/6)
✓ 영역 2 (광고 추적): 83% (5/6)
✓ 영역 3 (Contact 분류): 100% (7/7)
✓ 영역 4 (KPI 대시보드): 86% (6/7)

✅ 배포 승인 (92% 완성도)

⚠ P0 작업:
  □ Naver DA 입찰 자동화

P1 작업:
  □ Alert 규칙 구현
```

---

## 통합 검증 점수 산출

### 전체 Hook 통합도 계산

```
Hook 1 (Commit)    완성도: XX% (10개 항목 중 Y개)
Hook 2 (PR)        완성도: XX% (10개 항목 중 Y개)
Hook 3 (Merge)     완성도: XX% (10개 항목 중 Y개)
Hook 4 (Build)     완성도: XX% (26개 항목 중 Y개)

통합 점수 = (H1 + H2 + H3 + H4) / 4 = XX%

목표: 80% 이상 (현재: TBD)
```

---

## 빠른 참조 (Quick Reference)

### Hook 1 (Commit)
```
파일패턴: objection, rebuttal, response, sms, message, campaign, marketing
최소 렌즈: 3개 (L0-L10)
예상: 1-2분 검증
```

### Hook 2 (PR)
```
자동 추가: 심리학 체크리스트 (40줄)
필수 완성: 심리학 3개 렌즈, Day 0-3 자동화, 성과 메트릭
예상: 수동으로 체크리스트 완성 필요 (10분)
```

### Hook 3 (Merge)
```
자동 참고: RAG 메모리 4개 추천
작동: 자동 (수동 검토만 필요, 5분)
파일 확인: CLAUDE_RAG_INDEX.md
```

### Hook 4 (Build)
```
검증 항목: 26개 (4개 영역)
예상 완성도: 80-95%
리포트 생성: reports/pre-build-validation.json
진행 차단: 없음 (경고만)
```

---

**최종 목표**: Hook 통합도 80% 이상 달성
**현재 상태**: TBD (실제 테스트 필요)
**다음 단계**: Menu #41-43 개발 완료 후 실제 작동 검증
