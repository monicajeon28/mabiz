# settings.json Hook 실제 작동 시뮬레이션 (2026-05-24)

## 시나리오 1: Menu #40 수익계산기 개발 (Hook 1 + 2 + 3 + 4 전체)

### 상황
- 파일 변경: `src/app/api/products/commission-calculator.ts` (새로 생성)
- 목표: 렌탈 수익 계산기에 Grant Cardone L6렌즈(손실회피) + PASONA 마케팅 통합

### Step 1: Commit 전 코드 작성
```typescript
// src/app/api/products/commission-calculator.ts
export function calculateCommission(product: Product, basePrice: number) {
  // L6 렌즈: 손실회피 (현재 수익 vs 미래 손실)
  const lossAversion = {
    currentEarning: basePrice * 0.15,
    potentialLoss: basePrice * 0.30, // 경쟁사 가격
    message: "지금 신청하면 월 ₩500K 손실 방지" // Day 3 FOMO
  }
  
  // PASONA 6단계: Problem(저수익) + Agitate(경쟁사 우위) + Solution(우리상품)
  const smsSequence = {
    day0: "지금 신청하면 월 추가 수익 확인 가능! 5분만 확인해보세요.",
    day1: "경쟁사보다 30% 높은 수익? 진짜일까? 자세히 알아보기 →",
    day2: "실제 파트너님들이 월 ₩2M 수익 창출 중입니다. 사례 보기 →",
    day3: "마감 임박! 오늘 결정하면 초대 보너스 ₩300K + 즉시 정산"
  }
  
  return { lossAversion, smsSequence }
}
```

### Step 2: Commit 시도 (Hook 1 자동 실행)

```bash
$ git add src/app/api/products/commission-calculator.ts
$ git commit -m "feat(menu40): L6렌즈 수익계산기 - 손실회피+PASONA"

═══════════════════════════════════════════════════════════════
[psychology-validation Hook] 실행 중...
═══════════════════════════════════════════════════════════════

✓ SPIN 검증: 파일 패턴 'objection*' 미일치 (스킵)

✓ PASONA 검증:
  ✓ P (Problem): "저수익" 명확화
  ✓ A (Agitate): "경쟁사 30% 우위" 감정자극
  ✓ S (Solution): "우리 상품 수익성" 제시
  ✓ O (Offer): "초대 보너스 ₩300K + 즉시 정산" 구체화
  ✓ N (Narrow): 파트너 세그먼트 타겟팅
  ✓ A (Action): "오늘 결정" CTA 명확
  PASONA 점수: 6/6 완성 ✓

⚠ 심리학 렌즈 검증:
  발견된 렌즈: L6(손실회피)
  필요한 최소 렌즈: 3개
  부족한 렌즈: 2개
  
  💡 추천: 다음 렌즈 추가
  - L10 (즉시구매클로징): "오늘 결정" CTA와 조합
  - L3 (차별성미인지): 경쟁사 비교 강화

계속 진행? (Y/n): Y

✓ Commit 완료: 080d583
  경고: 심리학 렌즈 L6만 감지, 최소 3개 필요 권장
```

### Step 3: PR 생성 (Hook 2 자동 실행)

```bash
$ git push origin feature/menu-40-commission
$ gh pr create

═══════════════════════════════════════════════════════════════
[psychology-checklist Hook] PR 본문 자동 생성
═══════════════════════════════════════════════════════════════

## 심리학 기반 코드 리뷰

### 심리학 적용
- [ ] 심리학 10렌즈 중 몇 개 적용? (최소 3개)
  - ☑ L6: 타이밍결정손실회피
  - ☐ L3: 차별성미인지 (경쟁사 비교 강화 필요)
  - ☐ L10: 즉시구매클로징 (Day 3 CTA 강화 필요)
  
실제 적용: 1/3개 ⚠

### 자동화 시퀀스
- ☑ SMS/Email 자동화 Day 0-3 포함?
  - Day 0: "5분만 확인" (초기액션) ✓
  - Day 1: "경쟁사 비교" (이의대응) ✓
  - Day 2: "실제 사례 ₩2M" (가치강조) ✓
  - Day 3: "마감임박 보너스" (긴박감) ✓

### 판매 기법
- ☑ Grant Cardone 또는 Russell Brunson 기법 적용?
  - Grant Cardone L6 손실회피 ✓
  - PASONA 6단계 완성 ✓
  - SPIN 기법 미적용 (권장: 경쟁사 비교 시 "Problem" 질문 추가)

### 성과 메트릭
- [ ] 성과 메트릭 정의 (현재 vs 목표)?
  - 파트너 신청율: 현재 12% → 목표 18% (+50%)
  - 월 수익: 현재 ₩1.2M → 목표 ₩1.8M (손실회피 적용)
  - Day 3 최종전환율: 목표 45% (개선 중)

### 마케팅 최적화
- ☑ 마케팅 채널 최적화 포함?
  - Facebook: CPC 최적화 예정
  - SMS: Day 0-3 시퀀스 ✓
  - 대시보드: KPI 추적 필요 (월 수익 계산)

---

PR URL: https://github.com/mabiz/crm/pull/1245
```

### Step 4: Main으로 Merge (Hook 3 자동 실행)

```bash
$ git checkout main
$ git merge feature/menu-40-commission --no-ff

═══════════════════════════════════════════════════════════════
[rag-memory-reference Hook] RAG 메모리 자동 참고
═══════════════════════════════════════════════════════════════

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
   
   ★ 4순위: menu_38_phase1_complete.md
      → 렌탈 SMS Day 0-3 시퀀스 (참고용)

🎯 새로운 렌즈/기법 감지:
   - L6 손실회피: 이미 메모리에 존재 ✓
   - PASONA: 이미 템플릿화 완료 ✓
   → 새로운 추가 기법 없음

✓ Merge 완료 (Commit: a184c49)
   Merge commit message: Merge branch 'feature/menu-40-commission' into main
```

### Step 5: Vercel 프로덕션 빌드 (Hook 4 자동 실행)

```bash
$ npm run build

═══════════════════════════════════════════════════════════════
[marketing-optimization-check Hook] 프로덕션 배포 전 검증
═══════════════════════════════════════════════════════════════

📋 검증 영역 1: SMS/이메일 템플릿 Day 0-3

  검색 경로: src/lib/sms, src/lib/email, src/app/api/**/sms
  
  ✓ Day 0: "지금 신청하면 월 추가 수익 확인 가능!" (2시간 내)
  ✓ Day 1: "경쟁사보다 30% 높은 수익? 진짜일까?" (다음날 오전)
  ✓ Day 2: "실제 파트너님들이 월 ₩2M 수익" (다음다음날)
  ✓ Day 3: "마감 임박! 초대 보너스 ₩300K" (3일차 오후)
  ⚠ Day 7: "재접근 옵션" 미구현 (선택사항)
  
  결과: 4/5 완성 (80%)

📋 검증 영역 2: 광고 캠페인 ROAS/CPA 자동 추적

  ⚠ Facebook: CPC 추적 설정 미완료
    → src/app/api/campaigns/facebook.ts 검토 필요
  
  ✓ Google: GA4 연동 완료 (ROAS 목표: 3.0배)
  ⚠ Naver: DA 입찰 자동화 미완료
  ⚠ ROI 계산: 공식 미존재
    → 필요: (매출 - 광고비) / 광고비 자동 계산
  
  ✓ 일일 KPI 대시보드: 구현 완료
  ⚠ 주간 성과 리포팅: 자동화 미완료
  
  결과: 3/6 완성 (50%) ⚠

📋 검증 영역 3: Contact 자동분류 렌즈 라벨 매핑

  검색 경로: src/lib/utils/classify
  
  ✓ L0: 부재중고객 필드 (contacts.inactivityDays)
  ✓ L1: 가격민감도 필드 (contacts.priceSegment)
  ✓ L2: 준비도 필드 (contacts.readinessScore)
  ⚠ L3: 차별성이해도 필드 미존재
  ⚠ L4: 기항지선택불안 필드 미존재
  ✓ L5-L10: 세그먼트별 필드 (contacts.lens)
  
  ✓ 자동분류 규칙: 활성화 ✓
  ✓ 일일 업데이트 예약: 자정 (cron: 0 0 * * *)
  
  결과: 5/7 완성 (71%)

📋 검증 영역 4: 대시보드 KPI 자동 계산

  검색 경로: src/app/(dashboard)/dashboard
  
  ✓ 콜 전환율 자동 계산 (성약/콜 수)
  ⚠ SMS 개봉율 자동 계산: 알리고 API 미연동
  ✓ Follow-up 효율성 (5-12회 전환율)
  ✓ CPA/LTV 자동 계산
  ✓ 일일 업데이트: 매시간 (cron: 0 * * * *)
  ✓ 팀 대시보드 공유: Role=Partner 표시
  ⚠ Alert 규칙: KPI 낙폭 알림 미구현
  
  결과: 5/7 완성 (71%)

═══════════════════════════════════════════════════════════════

📊 최종 배포 준비도: 62% (21/34 완성)

⚠ 배포 전 권장 작업:
  P0 (높음):
    □ Facebook CPC 추적 설정 (검증 영역 2)
    □ L3 차별성이해도 필드 추가 (검증 영역 3)
  
  P1 (중간):
    □ SMS 개봉율 알리고 API 연동
    □ Alert 규칙 구현 (KPI 낙폭 시)
  
  P2 (낮음):
    □ Day 7 재접근 SMS 추가 (선택)
    □ Naver DA 자동 입찰 (선택)

📄 상세 리포트 생성:
   → reports/pre-build-validation.json
   
✓ 빌드 진행 (경고만 표시, 진행 차단 없음)
```

---

## 시나리오 2: Menu #42 파트너 자동 정지 (Hook 1 SPIN 특화)

### 상황
- 파일 변경: `src/app/api/partners/suspension-logic.ts`
- 목표: 파트너 정지 규칙에 SPIN 질문 구조 추가 (이의대응)

### Commit 전 코드
```typescript
// src/app/api/partners/suspension-logic.ts
export function buildSuspensionRebuttal(partner: Partner) {
  // SPIN 구조 (Situation → Problem → Implication → Need/Payoff)
  
  const spin = {
    // S: Situation - 파트너의 현재 상황
    situation: `지난 3개월 환불율 ${partner.refundRate}%`,
    
    // P: Problem - 문제 명확화
    problem: "높은 환불율은 고객 불만족 신호",
    
    // I: Implication - 문제의 심각성 확대
    implication: 
      `• 매월 -₩${calculateLoss(partner)}K 손실 예상
       • 크루즈 평판 훼손 가능성
       • 차후 수익 기회 상실`,
    
    // N: Need/Payoff - 필요도와 해결책 제시
    needPayoff:
      `해결 방법: (1) 고객관리 강화 (2) 환불 기준 재검토
       기대 효과: 환불율 ${partner.refundRate}% → 5% 개선 시 월 +₩${calculateGain(partner)}K`
  }
  
  return spin
}
```

### Hook 1 실행 결과
```bash
$ git commit -m "feat(menu42): 파트너정지 SPIN 이의대응 로직"

═══════════════════════════════════════════════════════════════
[psychology-validation Hook] SPIN 검증
═══════════════════════════════════════════════════════════════

✓ 파일 패턴 매칭: '**/suspension**' ✓

✓ SPIN 질문 구조 검증:
  
  ✓ S (Situation): "지난 3개월 환불율 XX%" 명확
  ✓ P (Problem): "높은 환불율 = 고객 불만족" 문제화
  ✓ I (Implication): 
    - 월 손실 ₩100K 계산
    - 평판 훼손 위험
    - 수익 기회 상실
    → 심각성 3가지 확대 ✓
  ✓ N (Need/Payoff):
    - 2가지 해결 방법 제시
    - 정량적 목표 (환불율 5%)
    - 월 수익 회복액 계산 (+₩XXK)
  
  SPIN 점수: 4/4 완성 ✓

⚠ 심리학 렌즈:
  감지된 렌즈: L1(가격이의) + L7(동반자설득)
  필요한 최소: 3개
  부족: 1개
  
  💡 추천:
  - L9 (의료신뢰): 안정성/신뢰도 강조 추가

✓ Commit 완료
```

---

## 시나리오 3: Menu #41 마케팅 자동화 (Hook 4 전체 검증)

### 상황
- 프로덕션 빌드 전 마케팅 최적화 최종 검증
- 목표: SMS Day 0-3 + 광고 추적 + Contact 분류 + KPI 대시보드 모두 완성

### Hook 4 최종 리포트

```
═══════════════════════════════════════════════════════════════
[marketing-optimization-check Hook] 최종 배포 검증 리포트
═══════════════════════════════════════════════════════════════

📊 종합 점수: 92% (31/34 완성)

✓ 영역 1 (SMS Day 0-3): 100% (5/5)
   └─ Day 7 재접근도 추가로 구현 ✓

✓ 영역 2 (광고 추적): 83% (5/6)
   └─ P0: Naver DA 입찰 자동화 미완료 (대기)

✓ 영역 3 (Contact 분류): 100% (7/7)
   └─ L0-L10 모든 렌즈 필드 추가 ✓

✓ 영역 4 (KPI 대시보드): 86% (6/7)
   └─ Alert 규칙만 구현 (구현 예정)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ 배포 승인 (92% 완성도)

📈 기대 효과:
   • SMS 자동화: 전환율 40% → 60% (+50%)
   • Follow-up 효율: 5-12회 추적으로 80% 판매 달성
   • CPA 최적화: ₩8K → ₩5K (-38%)
   • 월 추가 수익: ₩125M 예상
```

---

## 실제 적용 체크리스트

### Hook 1 (Commit) - 매번 적용
- [ ] SPIN 파일이면: Situation-Problem-Implication-Need/Payoff 4단계 모두 포함?
- [ ] PASONA 파일이면: P-A-S-O-N-A 6단계 모두 포함?
- [ ] 심리학 렌즈 3개 이상 명시적으로 포함?

### Hook 2 (PR) - 자동 추가, 체크리스트 완성 필수
- [ ] PR 본문 심리학 체크리스트 확인
- [ ] 10렌즈 최소 3개 적용 여부 기입
- [ ] Day 0-3 자동화 시퀀스 확인
- [ ] 성과 메트릭 정의 (현재 vs 목표)

### Hook 3 (Merge) - 자동 참고, 메모리 파일 검토
- [ ] 제시된 RAG 메모리 파일 3-4개 검토
- [ ] 새로운 기법 추가 여부 확인
- [ ] 관련 메모리 파일 링크 확인

### Hook 4 (Build) - 배포 전 최종 검증
- [ ] SMS Day 0-3 완성도 확인
- [ ] 광고 채널별 추적 설정 확인
- [ ] Contact 자동분류 필드 확인
- [ ] KPI 대시보드 수집 확인
- [ ] 리포트 생성 완료 확인

