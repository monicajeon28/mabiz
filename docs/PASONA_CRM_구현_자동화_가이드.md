# PASONA CRM 구현 & 자동화 가이드
## 멀티콜 시퀀스 자동화 + 실시간 상담사 코칭 + AI 분석 시스템

**작성일:** 2026-05-19  
**대상:** CRM 개발팀 / 마케팅팀 / 운영진  
**기대 효과:** 상담사 학습 곡선 60% 단축 + 자동화로 재콜율 90% 달성

---

# 1. CRM 데이터 모델 설계

## 1.1 고객 PASONA 프로파일 테이블

```sql
-- customers_pasona_profile
CREATE TABLE customers_pasona_profile (
  id UUID PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES customers(id),
  
  -- 기본 정보
  segment ENUM('A', 'B', 'C', 'D', 'E'),  -- 30대커플, 40대가족, 중년부부, 50-60대, 60대+
  advisor_id UUID REFERENCES advisors(id),
  first_call_at TIMESTAMP,
  
  -- 세그먼트별 욕구 매핑
  primary_desire VARCHAR(50),  -- A: 낭만, B: 시간, C: 신뢰, D: 또래, E: 가족
  secondary_desire VARCHAR(50),
  
  -- PASONA 단계별 효과도 (0-100)
  problem_score INTEGER,       -- Day 0 시점 Problem 단계 효과도
  affinity_score INTEGER,      -- Day 0-2 시점 Affinity 효과도
  solution_score INTEGER,      -- Day 2 시점 Solution 효과도
  offer_score INTEGER,         -- Day 3 시점 Offer 효과도
  
  -- 세부 스코어 (디버깅용)
  problem_techniques JSON,     -- { "technique_2": 92, "technique_3": 88, ... }
  affinity_techniques JSON,
  solution_techniques JSON,
  offer_techniques JSON,
  
  -- 저항 유형 분류
  objection_type ENUM(
    'price_concern',           -- "너무 비싼데"
    'time_pressure',           -- "바쁜데 생각 좀 해봐야"
    'health_anxiety',          -- "건강이 불안한데"
    'family_schedule',         -- "가족 일정을 봐야"
    'none'                     -- 거절 없음
  ),
  
  -- 멀티콜 시퀀스 상태
  multicall_sequence JSON,     -- { "day_0": { status: "completed", score: 92, ... }, "day_1": {...} }
  
  -- 예상 전환율
  predicted_conversion_rate INTEGER,  -- PASONA 모델 기반 계산 (50-95%)
  predicted_final_rate INTEGER,       -- 최종 예상 (고객 행동 기반)
  
  -- 최종 결과
  converted BOOLEAN DEFAULT FALSE,
  converted_at TIMESTAMP,
  converted_amount DECIMAL(10, 2),
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## 1.2 멀티콜 시퀀스 상태 추적

```sql
-- multicall_sequences
CREATE TABLE multicall_sequences (
  id UUID PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES customers(id),
  profile_id UUID NOT NULL REFERENCES customers_pasona_profile(id),
  
  sequence_day INTEGER,  -- 0, 1, 2, 3-7
  
  -- 계획된 vs 실제 실행
  planned_at TIMESTAMP,
  executed_at TIMESTAMP,
  
  -- 접점 유형
  contact_type ENUM('call', 'text', 'email', 'kakao'),
  
  -- 실행 결과
  status ENUM(
    'scheduled',        -- 예약됨
    'in_progress',      -- 진행 중
    'completed',        -- 완료
    'failed',           -- 실패 (못함)
    'no_response'       -- 응답 없음
  ),
  
  -- PASONA 단계별 점수 업데이트
  problem_score_delta INTEGER,    -- 이 접점에서의 변화
  affinity_score_delta INTEGER,
  solution_score_delta INTEGER,
  offer_score_delta INTEGER,
  
  -- 고객 반응 기록
  customer_response VARCHAR(255),  -- "관심있어", "생각해봐야", "가격이...", etc
  advisor_notes TEXT,              -- 상담사 메모
  
  -- 실시간 코칭 기록
  ai_coaching_given JSON,  -- AI가 제시한 추천 기법
  ai_coaching_followed BOOLEAN,  -- 상담사가 따랐는가?
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 인덱스 (성능 최적화)
CREATE INDEX idx_customer_id ON multicall_sequences(customer_id);
CREATE INDEX idx_sequence_day ON multicall_sequences(sequence_day);
CREATE INDEX idx_planned_at ON multicall_sequences(planned_at);
```

## 1.3 PASONA 기법별 효과도 추적

```sql
-- pasona_technique_tracking
CREATE TABLE pasona_technique_tracking (
  id UUID PRIMARY KEY,
  multicall_id UUID NOT NULL REFERENCES multicall_sequences(id),
  
  -- 기법 분류
  section ENUM('problem', 'affinity', 'solution', 'offer'),
  technique_number INTEGER,  -- Problem 1-8, Affinity 1-6, Solution 1-7, Offer 1-11
  technique_name VARCHAR(100),
  
  -- 효과 측정
  used BOOLEAN,              -- 이 기법을 썼는가?
  effectiveness_score INTEGER (0-100),  -- 이 기법의 효과도
  customer_reaction VARCHAR(50),  -- "긍정", "중립", "부정"
  
  -- 상담사 레벨별 효과도 차이
  advisor_experience_level ENUM('신입', '경력', '전문가'),
  effectiveness_by_level INTEGER,  -- 그 레벨에서의 예상 효과도
  
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

# 2. 자동화 워크플로우 설계

## 2.1 Day 0 (초기 콜) 완료 후 자동 프로세스

```
[Day 0 콜 완료]
│
├─ 1. AI 분석 (실시간)
│  ├─ 녹음 파일 STT 변환
│  ├─ 고객 반응 자동 분류
│  │  └─ Problem 점수 계산 (PASONA 효과도)
│  │  └─ Affinity 점수 계산
│  │  └─ Objection 유형 분류
│  └─ 세그먼트 확인 (A/B/C/D/E 중 가장 가능성 높음)
│
├─ 2. 예상 전환율 계산
│  ├─ 기본 세그먼트 전환율 테이블 참조
│  ├─ 실제 PASONA 점수 반영
│  ├─ 저항 유형별 조정치 적용
│  │  └─ 가격 거절: -15%
│  │  └─ 시간 거절: -10%
│  │  └─ 건강 거절: -20%
│  └─ 예상 전환율 도출 (Day 0 기준: 15-35%)
│
├─ 3. 재콜 필요 판정
│  ├─ IF 단콜 클로징 → 예약 완료 처리 (끝)
│  └─ IF 거절 또는 "생각해봐야" → Day 1 자동 문자 예약
│
└─ 4. 대시보드 업데이트
   ├─ 상담사: "예상 전환율 45% → 최종 68% 목표"
   └─ 운영진: "오늘의 콜 분석 리포트"

CRM 자동 실행 시간: 2초
```

## 2.2 Day 1 (자동 문자) 실행

```
[Day 0 저녁 20:00]
├─ 문자 발송 (고객 세그먼트별 맞춤)

[세그먼트 A (30대 커플)]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
안녕하세요, [이름]님!
저는 크루즈닷 최윤희입니다.

어제 말씀드린 '7월 신혼 특별 패키지',
지금 인기가 정말 높아서
남은 게 2개 객실뿐입니다.

혹시 오늘 중에 예약 가능할까요?
💬 답장해 주세요!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[세그먼트 B (40대 가족)]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
안녕하세요, [이름]님!
자녀분 방학 일정은 확인되셨나요?

요즘 40대 가족분들이 가장 많이 선택하는
'7월 2주차'는 남은 가족실이 2개입니다.

모레 아침에 다시 연락드릴게요!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[세그먼트 C (중년부부)]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
안녕하세요, [이름]님!
저는 크루즈닷 최윤희입니다.

어제 말씀드린 '5월 건강 크루즈',
의료진 정보를 더 자세히 보내드려고 합니다.

💌 아래 링크에서 확인해 주세요.
(배의 의료시설 사진 + 의료진 경력)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[CRM 자동 기록]
├─ 발송 시간: 2026-05-20 20:00
├─ 응답 추적: "읽음" 시점부터 기록
├─ 응답 있음 → 캡슐 콜 스케줄링
└─ 응답 없음 → Day 2 콜 예약 진행
```

## 2.3 Day 2 (캡슐 콜 또는 재콜)

```
[Day 2 오전 10:00]
│
├─ 자동 콜 스케줄 생성
│  └─ 상담사 배정: 선호도 + 세그먼트 경험 기반
│
├─ 상담사 준비 자료 자동 생성
│  ├─ "[이름]님 콜 브리핑"
│  │  ├─ Day 0 문제 인식 수준: 92% (높음)
│  │  ├─ 저항 유형: "가격 거절"
│  │  ├─ 추천 기법: Affinity (공감) → Loss Aversion 역전
│  │  ├─ 예상 통화 시간: 12-15분
│  │  └─ 목표: 클로징 또는 Day 3 약속
│  │
│  └─ "추천 멘트 (복사 가능)"
│     ├─ Affinity 스토리 (Case 2 참고)
│     ├─ Loss Aversion 역전 멘트
│     └─ 클로징 멘트
│
└─ [실시간 코칭 준비]
   ├─ AI 음성인식 대기
   ├─ PASONA 단계별 신호 감지 준비
   └─ 상담사가 기법 벗어나면 즉시 팝업 알림
```

---

# 3. 실시간 상담사 코칭 시스템

## 3.1 AI 실시간 분석 & 코칭 팝업

```
UI / UX 설계:

┌─────────────────────────────────────────────┐
│ 📞 통화 중: 김태희 님 (30대 커플)            │ [07:45 경과]
├─────────────────────────────────────────────┤
│                                             │
│ 📊 현재 진행 상황                           │
│ ─────────────────────────────────────────  │
│ 현재 단계: Affinity (스토리 중)             │
│                                             │
│ PASONA 점수:                               │
│   Problem:   ▓▓▓▓▓▓▓░░░ 75% ✓            │
│   Affinity:  ▓▓▓▓▓░░░░░ 55% (↑ 중)      │
│   Solution:  ░░░░░░░░░░  0%              │
│   Offer:     ░░░░░░░░░░  0%              │
│                                             │
│ ─────────────────────────────────────────  │
│ 💡 실시간 팁                                │
│ ─────────────────────────────────────────  │
│ ✓ [좋음] "절박감"을 명확히 전달했어요    │
│ ✓ [좋음] 3가지 손실을 구체적으로 제시    │
│                                             │
│ ⚠️  [개선] Affinity에서 스토리가 약간 길어 │
│        → 이제 "공감" 더 강조해 보세요      │
│        예: "맞아요, 신혼분들이 자주 그런   │
│            고민을 하세요..."              │
│                                             │
│ 💬 다음 멘트 추천:                        │
│    (클릭하면 복사 가능)                   │
│    "근데 신기한 게, 많은 분들이 생각하는 │
│     것보다 크루즈는 정말 간단해요"       │
│    [Solution 3번 기법 사용]               │
│                                             │
│ ─────────────────────────────────────────  │
│ 🎯 목표: 이 통화로 "생각해봐야" → "해야겠" │
│          로 변화 예상 (예상 성공율: 68%)  │
│                                             │
└─────────────────────────────────────────────┘

기술 구조:
• STT (음성인식): Google Cloud Speech-to-Text
  실시간 지연: 0.5-1초 (거의 실시간)
  
• PASONA 신호 감지 (정규식 기반):
  Problem 2번: "성수기|가격 올라|지금 아니면"
  Affinity 1번: "스토리|사례|배치했는데"
  Solution 3번: "간단|선택|3가지"
  
• 점수 계산: 가중 평균 (실시간 업데이트)
  = (감지된_기법_수 / 필요한_기법_수) × 100
  + (고객_긍정반응도) × 보정치
```

## 3.2 통화 후 AI 분석 리포트

```
[통화 완료 후 자동 생성]

┌─────────────────────────────────────────────────────┐
│ 📋 콜 분석 리포트                                    │
│ 김태희 님 (30대 커플) | 2026-05-21 10:15 | 15분 22초 │
├─────────────────────────────────────────────────────┤
│                                                     │
│ 📊 PASONA 점수 분석                                 │
│ ─────────────────────────────────────────────────  │
│ Problem:     Day0: 75% → Day2: 82% (↑ +7%)      │
│ Affinity:    Day0: 70% → Day2: 88% (↑ +18%)     │
│ Solution:    Day0: 0%  → Day2: 85% (↑ +85%)     │
│ Offer:       Day0: 0%  → Day2: 42% (↑ +42%)     │
│                                                     │
│ 평가: "Offer 단계에 진입하기 전에                  │
│        고객이 '생각해봐야'로 미루었으므로          │
│        Day 3 추격 필요"                           │
│                                                     │
│ ─────────────────────────────────────────────────  │
│ 🎯 상담사 성과 평가                                 │
│ ─────────────────────────────────────────────────  │
│ 기법 실행 정확도:  87/100 (우수)                  │
│   • Problem 기법:  92% (우수) ✓✓✓               │
│   • Affinity 기법: 85% (좋음) ✓✓                │
│   • Solution 기법: 88% (우수) ✓✓✓              │
│   • Offer 기법:    64% (개선) ✓                 │
│                                                     │
│ 고객 참여도:       82/100 (매우높음)              │
│   • 고객 말하기:   58% (목표 57% 달성)           │
│   • 긍정적 신호:   5개 (문제없음)                │
│   • 거절 신호:     1개 (가격)                     │
│                                                     │
│ ─────────────────────────────────────────────────  │
│ 💡 코칭 피드백 (다음 콜 개선사항)                 │
│ ─────────────────────────────────────────────────  │
│ ✓ [매우좋음]                                       │
│   Affinity 스토리를 정말 잘 전달했어요.           │
│   고객이 "아... 로맨틱하네" 반응으로             │
│   감정 이입이 명확했습니다.                        │
│                                                     │
│ ⚠️  [개선필요]                                     │
│   Offer 단계에서 클로징이 약했어요.               │
│   "이 혜택은 금요일까지"라고 했는데,              │
│   고객이 "생각해봐야"로 미루었습니다.             │
│                                                     │
│   다음 번에는:                                     │
│   "지금 예약하면 + 희소성" 에 더해             │
│   "환불 보장"을 강조하면 어떨까요?            │
│   (Loss Aversion 최소화)                         │
│                                                     │
│ ─────────────────────────────────────────────────  │
│ 📌 다음 액션                                       │
│ ─────────────────────────────────────────────────  │
│ □ Day 3 (오후 14:00) 자동 문자 발송 예정       │
│   (내용: "가격 인상" 알림)                       │
│                                                     │
│ □ Day 5 (오전 09:00) 재콜 예약                  │
│   (목표: 최종 클로징)                            │
│                                                     │
│ □ 상담사 학습: Offer 기법 강화 필요             │
│   (매주 15분 코칭 세션 추천)                     │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

# 4. 자동 멀티콜 시퀀스 스케줄링

## 4.1 Day 0-7 자동 일정 생성

```python
# CRM 자동화 로직 (의사코드)

def create_multicall_sequence(customer_profile):
    """
    고객 세그먼트와 PASONA 점수 기반으로
    최적의 멀티콜 시퀀스 자동 생성
    """
    
    # 1. 세그먼트별 기본 시퀀스 선택
    segment_sequences = {
        'A': [  # 30대 커플 (빠른 결정)
            {'day': 0, 'type': 'call', 'time': 'immediate'},
            {'day': 1, 'type': 'text', 'time': '14:00', 'content': 'urgency_message'},
            {'day': 2, 'type': 'capsule_call', 'time': '10:00'},
            {'day': 3, 'type': 'text', 'time': '16:00', 'content': 'final_push'},
        ],
        'B': [  # 40대 가족 (신중한 결정)
            {'day': 0, 'type': 'call', 'time': 'immediate'},
            {'day': 1, 'type': 'text', 'time': '14:00', 'content': 'family_focus'},
            {'day': 2, 'type': 'call', 'time': '10:00'},  # 재콜 (더 중요)
            {'day': 3, 'type': 'text', 'time': '16:00'},
            {'day': 5, 'type': 'call', 'time': '14:00'},  # 추가 재콜
            {'day': 7, 'type': 'text', 'time': '18:00', 'content': 'refund_guarantee'},
        ],
        'C': [  # 중년부부 (매우 신중, 신뢰 중심)
            {'day': 0, 'type': 'call', 'time': 'immediate'},
            {'day': 2, 'type': 'call', 'time': '10:00'},  # 의료 정보 제시
            {'day': 5, 'type': 'call', 'time': '14:00'},  # 또래 후기
            {'day': 7, 'type': 'text', 'time': '09:00', 'content': 'social_proof'},
        ],
        # ... D, E도 유사
    }
    
    # 2. PASONA 점수에 따라 조정
    base_sequence = segment_sequences[customer_profile.segment]
    
    if customer_profile.problem_score < 70:
        # Problem 약함 → 콜 추가
        base_sequence.insert(1, 
            {'day': 1, 'type': 'call', 'time': '10:00', 'focus': 'problem'})
    
    if customer_profile.affinity_score < 75:
        # Affinity 약함 → 신뢰 관련 콜 추가
        base_sequence.insert(2,
            {'day': 3, 'type': 'call', 'time': '14:00', 'focus': 'affinity'})
    
    if customer_profile.offer_score < 60:
        # Offer 약함 → 혜택 강조 콜
        base_sequence.append(
            {'day': 6, 'type': 'call', 'time': '10:00', 'focus': 'offer'})
    
    # 3. 저항 유형에 따라 조정
    if customer_profile.objection_type == 'price_concern':
        # 가격 거절 → Offer 기법 강화
        for seq in base_sequence:
            if seq['day'] >= 2:
                seq['focus'] = 'loss_aversion_reversal'
    
    # 4. DB에 저장
    for seq in base_sequence:
        schedule_sequence(customer_id, seq)
    
    return base_sequence


# 사용 예시:
customer = get_customer(id='kim-tae-hee')
profile = customer.pasona_profile
multicall_sequence = create_multicall_sequence(profile)

# 결과:
# [
#   {'day': 0, 'type': 'call', 'time': 'immediate'},
#   {'day': 1, 'type': 'text', 'time': '14:00'},
#   {'day': 2, 'type': 'capsule_call', 'time': '10:00'},
#   {'day': 3, 'type': 'text', 'time': '16:00', 'focus': 'loss_aversion_reversal'},
# ]
```

## 4.2 Day별 자동 실행 (Cron Job)

```yaml
# CRM 자동 실행 스케줄 (cron 기반)

# Day 0 - 초기 콜 후 (실시간)
- trigger: call_completed
  action: analyze_and_schedule_day1
  delay: 0 seconds
  
# Day 1 - 오후 2시 (자동 문자)
- cron: "0 14 * * *"
  action: send_day1_message
  filter: multicall_status == 'day_0_completed'
  
# Day 1 - 오후 6시 (응답 추적)
- cron: "0 18 * * *"
  action: track_message_response
  
# Day 2 - 오전 10시 (재콜 또는 캡슐 콜)
- cron: "0 10 * * *"
  action: initiate_day2_call
  filter: day1_response_received == True OR day1_no_response == True
  
# Day 3 - 오후 4시 (추격 메시지)
- cron: "0 16 * * *"
  action: send_day3_message
  filter: day2_not_closed == True
  
# Day 5 - 오전 2시 (재콜)
- cron: "0 14 * * *"
  action: schedule_day5_call
  
# Day 7 - 오전 9시 (최종 추격)
- cron: "0 09 * * *"
  action: send_day7_final_push
  filter: still_not_converted == True
```

---

# 5. CRM 대시보드 설계

## 5.1 관리자 대시보드 (일일 리포트)

```
┌─────────────────────────────────────────────────────────┐
│ 📊 오늘의 PASONA 성과                   [2026-05-21]     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ 📞 콜 통계                                              │
│ ─────────────────────────────────────────────────────  │
│ 오늘 콜: 24건                                          │
│ 단콜 클로징: 6건 (25%) 👍                            │
│ 재콜 약속: 18건 (75%) ✓                             │
│ 진행 중/미응답: 0건 (0%) — 우수                      │
│                                                         │
│ 평균 효과도: 83% (목표 75%) 👍👍                     │
│ ─────────────────────────────────────────────────────  │
│                                                         │
│ 세그먼트별 성과                                        │
│ ─────────────────────────────────────────────────────  │
│                                                         │
│ A (30대 커플): 5건 | 효과도 92% | 예상전환 68%       │
│   ▓▓▓▓▓▓▓▓░░ 우수                                    │
│                                                         │
│ B (40대 가족): 8건 | 효과도 88% | 예상전환 72%       │
│   ▓▓▓▓▓▓▓░░░ 우수                                   │
│                                                         │
│ C (중년부부): 4건 | 효과도 76% | 예상전환 52%        │
│   ▓▓▓▓▓░░░░░ 보통                                   │
│                                                         │
│ D (50-60대): 5건 | 효과도 85% | 예상전환 68%        │
│   ▓▓▓▓▓▓▓░░░ 좋음                                   │
│                                                         │
│ E (60대+): 2건 | 효과도 71% | 예상전환 42%          │
│   ▓▓▓▓░░░░░░ 개선필요                               │
│                                                         │
│ ─────────────────────────────────────────────────────  │
│                                                         │
│ 상담사별 성과                                          │
│ ─────────────────────────────────────────────────────  │
│ Top 1: 최윤희 (경력 5년)                             │
│        콜 6건 | 효과도 91% | 클로징 3건             │
│ Top 2: 김민준 (경력 2년)                             │
│        콜 5건 | 효과도 87% | 클로징 1건             │
│ ...                                                     │
│ 신입: 이준호                                           │
│        콜 2건 | 효과도 62% | 클로징 0건             │
│        💡 Offer 기법 강화 교육 필요                 │
│                                                         │
│ ─────────────────────────────────────────────────────  │
│                                                         │
│ 내일의 멀티콜 일정 (자동 스케줄됨)                   │
│ ─────────────────────────────────────────────────────  │
│ [Day 1 자동 문자] 18건 (오후 14:00)                 │
│ [Day 2 재콜] 12건 (오전 10:00)                      │
│ [Day 3 추격] 15건 (오후 16:00)                      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## 5.2 상담사 개인 대시보드 (실시간)

```
┌─────────────────────────────────────────┐
│ 🎧 내 오늘의 콜                          │
├─────────────────────────────────────────┤
│                                         │
│ 📅 예약된 콜 (오늘)                     │
│ ─────────────────────────────────────  │
│ 10:00 - 김태희 (재콜)      [브리핑]    │
│         세그먼트 A | 예상 68% 전환      │
│         저항: 없음 | 추천: Offer 강화  │
│                                         │
│ 11:30 - 박진수 (초기 콜)   [준비]      │
│         세그먼트 B | 의사결정 신중      │
│         추천: Affinity 스토리 강조      │
│                                         │
│ 14:00 - 이영숙 (캡슐 콜)   [예약]      │
│         세그먼트 C | 건강 불안 있음     │
│         추천: 의료진 정보 상세화        │
│                                         │
│ ─────────────────────────────────────  │
│                                         │
│ 📊 내 성과 (이 주간)                    │
│ ─────────────────────────────────────  │
│ 콜 완료: 12건                          │
│ 평균 효과도: 87% (전사 평균 83%)      │
│ 클로징율: 38% (목표 30% 초과)          │
│ 평가: ⭐⭐⭐⭐⭐ (우수 상담사)       │
│                                         │
│ ─────────────────────────────────────  │
│                                         │
│ 💡 이 주 개선사항                       │
│ ─────────────────────────────────────  │
│ ✓ Affinity 스토리 → 큰 폭 개선 (↑15%)  │
│ ⚠️  Offer 클로징 → 아직 약함 (↓8%)    │
│                                         │
│ 💬 피드백: "다음 주에 Offer 기법을     │
│   집중적으로 연습하면 90%+로 갈 수     │
│   있어요. 화이팅!"                     │
│                                         │
└─────────────────────────────────────────┘
```

---

# 6. CRM 구현 로드맵

## 6.1 Phase 1 (2주 - MVP)

```
Day 1-3: 데이터 모델 설계
- customers_pasona_profile 테이블 생성
- multicall_sequences 테이블 생성
- 마이그레이션 SQL 작성

Day 4-7: 기본 자동화
- Day 0 콜 완료 후 AI 분석 구현
- Day 1-7 자동 문자 스케줄링
- 재콜 약속 추적

Day 8-14: MVP 대시보드
- 관리자 기본 대시보드
- 상담사 개인 대시보드
- 콜 분석 리포트

결과물:
- 기본 멀티콜 자동화 작동
- 수동 재콜 필요 (자동화 아직 안 함)
```

## 6.2 Phase 2 (2주 - AI 코칭)

```
Day 1-7: 실시간 STT + PASONA 신호 감지
- Google Cloud Speech-to-Text API 연동
- PASONA 기법별 정규식 작성
- 신호 감지 정확도 테스트

Day 8-14: 실시간 코칭 팝업
- 실시간 점수 계산
- AI 추천 멘트 생성
- 상담사 피드백 수집 및 개선

결과물:
- 실시간 상담사 코칭 작동
- 상담사 효과도 15~20% 향상 기대
```

## 6.3 Phase 3 (1주 - 완전 자동화)

```
Day 1-3: 재콜 자동 실행
- 상담사 자동 배정 (경험도 기반)
- 콜 자동 스케줄링 (Twilio API)
- 자동 재콜 성공률 모니터링

Day 4-7: 예측 모델 고도화
- 세그먼트별 PASONA 최적 경로 학습
- 개인별 전환율 예측 고도화
- A/B 테스트 자동 실행

결과물:
- 완전 자동화된 멀티콜 시퀀스
- 상담사는 "콜"에만 집중 → 생산성 150% 향상 기대
```

---

# 7. 예상 효과 분석

## 7.1 구현 전/후 비교

```
지표                    현재        6개월 후      향상도
──────────────────────────────────────────────────
평균 전환율             32%         50%          +56%
멀티콜 시퀀스 성공률    40%         90%          +125%
평균 상담사 효과도      70%         85%          +21%
상담사 학습 기간        2개월       25일         -63%
재콜 실행율             60%         99%          +65%
고객 만족도             3.8/5       4.6/5        +21%

매출 임팩트:
──────────────────────────────────────────────────
월간 상담 건수:         300건
기본 매출 (32%):        3.2억원

6개월 후 (50% 전환):    5억원
추가 매출:              1.8억원/월
연간 추가 매출:         21.6억원

구현 비용:              8,000만원
ROI:                    270% (1년 기준)
```

---

**최종 요약:**

PASONA CRM 구현은 단순한 도구가 아닌, 
상담사와 고객의 심리 경로를 시스템화하는 것.

✓ Phase 1 (2주): 기본 멀티콜 자동화
✓ Phase 2 (2주): 실시간 상담사 코칭
✓ Phase 3 (1주): 완전 자동화

총 5주 후, 전환율 50%, 상담사 효과도 85% 달성 가능.

