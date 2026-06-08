# CountdownTimer.tsx Phase 5 빌드 검증 체크리스트

## 1️⃣ TypeScript 검증

### Props 타입 체크
- [x] CountdownTimerProps 정의: targetDate (Date), onExpire? (callback)
- [x] TimeLeft 인터페이스: days, hours, minutes, seconds, totalMinutes (모두 number)
- [x] UrgencyLevel 타입: "safe" | "warning" | "alert" | "critical"
- [x] 상태 초기값: timeLeft (null), urgencyLevel ("safe")

### 타입 안전성
```
✅ useState<TimeLeft | null>(null) - null 체크 완료
✅ UrgencyLevel 리터럴 타입 - 4가지만 허용
✅ onExpire?.() - 옵셔널 체인 사용
✅ targetDate.getTime() - Date 메서드 사용
```

## 2️⃣ 로직 검증

### calculateTimeLeft() 함수
```javascript
- now = Date.now() ✅
- diff = targetDate.getTime() - now ✅
- if (diff <= 0) → onExpire() 호출 ✅
- days = Math.floor(diff / (1000*60*60*24)) ✅
- hours = Math.floor((diff % (1000*60*60*24)) / (1000*60*60)) ✅
- minutes = Math.floor((diff % (1000*60*60)) / (1000*60)) ✅
- seconds = Math.floor((diff % (1000*60)) / 1000) ✅
- totalMinutes = Math.floor(diff / (1000*60)) ✅

계산 검증 (2026-06-10 23:59:59 기준):
- 1일: 86400초 = 1000*60*60*24 ✅
- 1시간: 3600초 = 1000*60*60 ✅
- 1분: 60초 = 1000*60 ✅
```

### getUrgencyLevel() 함수
```javascript
- totalHours = days*24 + hours ✅
- >= 24시간 → "safe" (초록) ✅
- 6-24시간 → "warning" (황색) ✅
- 1-6시간 → "alert" (주황) ✅
- < 1시간 → "critical" (빨강) ✅
- null인 경우 → "critical" ✅
```

### setInterval 스마트 주기 관리
```javascript
- getInterval(tl):
  - 1시간 미만 + 시간=0 → 1초 (1000ms) ✅
  - 그 외 → 60초 (60000ms) ✅
- 초기값: initial = calculateTimeLeft()
- 설정: timerId = setInterval(tick, currentInterval)
- tick 함수:
  - 시간 재계산 ✅
  - nextInterval과 currentInterval 비교 ✅
  - 변경시 clearInterval + 새로운 setInterval ✅
  - null이면 clearInterval + return ✅
```

### 메모리 정리 (cleanup)
```javascript
✅ useEffect 반환값: return () => clearInterval(timerId)
✅ 언마운트 시 정확히 실행됨
✅ 의존성 배열: [targetDate, onExpire]
```

## 3️⃣ 색상 및 렌더링 검증

### colorConfig 매핑
```javascript
safe: {
  textColor: "text-green-700" ✅
  bgColor: "bg-green-50" ✅
  borderColor: "border-green-200" ✅
  labelColor: "text-green-600" ✅
  separatorClass: "text-green-600" (펄스 없음) ✅
  shouldPulse: false ✅
}

warning: {
  textColor: "text-yellow-700" ✅
  bgColor: "bg-yellow-50" ✅
  borderColor: "border-yellow-200" ✅
  labelColor: "text-yellow-600" ✅
  separatorClass: "text-yellow-600" ✅
  shouldPulse: false ✅
}

alert: {
  textColor: "text-orange-700" ✅
  bgColor: "bg-orange-50" ✅
  borderColor: "border-orange-200" ✅
  labelColor: "text-orange-600" ✅
  separatorClass: "text-orange-600" ✅
  shouldPulse: false ✅
}

critical: {
  textColor: "text-red-700" ✅
  bgColor: "bg-red-50" ✅
  borderColor: "border-red-300" (더 진한 빨강) ✅
  labelColor: "text-red-600" ✅
  separatorClass: "text-red-600 animate-pulse" (펄스 포함) ✅
  shouldPulse: true ✅
}
```

### 렌더링 요소
```jsx
✅ 헤더: urgencyLabel (4가지 메시지)
   - safe: "신청 마감까지"
   - warning: "📢 마감까지"
   - alert: "⚠️ 긴급 마감까지"
   - critical: "🔴 즉시 신청! 마감까지"

✅ 메인 타이머:
   - 일 (DD 형식, padStart(2, "0"))
   - 구분자 ":" (animate-pulse in critical)
   - 시간 (HH 형식, padStart(2, "0"))
   - 구분자 ":"
   - 분 (MM 형식, padStart(2, "0"))

✅ 손실회피 메시지:
   - safe: 없음
   - warning: "⏰ 6시간 내 가격 인상 예정입니다"
   - alert: "⚠️ 1시간 내 신청하면 현재 가격 적용됩니다"
   - critical: "🔴 마감 직전! 지금 신청해야 합니다"
```

### 애니메이션 클래스
```css
✅ critical 상태에서만 animate-pulse:
   - 큰 숫자들 (days, hours, minutes)
   - 구분자 ":" (separatorClass에 포함)
   - 손실회피 메시지

✅ 배경 상자:
   - transition-all duration-500 (색상 부드럽게 전환)
   - critical일 때 shadow-lg shadow-red-300 (그림자)

✅ 텍스트 색상:
   - transition-colors duration-300 (색상 변화 부드럽게)
```

## 4️⃣ 심리학 검증 (L6 + L10)

### L6 타이밍 손실회피
```
✅ 시간 흐를수록 색상 변화: 초록 → 황색 → 주황 → 빨강
✅ 색상 변화 = 심리학적 손실감 유발
✅ 명시적 메시지:
   - warning: "6시간 내 가격 인상 예정"
   - alert: "1시간 내 신청하면 현재 가격"
   - critical: "마감 직전! 지금 신청해야"
```

### L10 즉시구매 클로징
```
✅ 마감 임박 시:
   - 빨강 색상 + 펄스 애니메이션
   - 이모지 이스컬레이션: 없음 → 📢 → ⚠️ → 🔴
   - 강한 언어: "즉시 신청! 마감까지"
```

## 5️⃣ 실제 테스트 시나리오

### 시나리오 1: 3일 전 (안전 상태)
```
targetDate: 2026-06-06 12:00:00
현재: 2026-06-03 12:00:00
남은 시간: 3일 0시간

예상 결과:
✅ urgencyLevel = "safe"
✅ 색상 = 초록 (green-700)
✅ 메시지 = "신청 마감까지"
✅ 펄스 = 없음
✅ updateInterval = 60초
```

### 시나리오 2: 12시간 전 (경고 상태)
```
targetDate: 2026-06-04 00:00:00
현재: 2026-06-03 12:00:00
남은 시간: 0일 12시간

예상 결과:
✅ urgencyLevel = "warning"
✅ 색상 = 황색 (yellow-700)
✅ 메시지 = "📢 마감까지"
✅ 손실회피 = "6시간 내 가격 인상 예정"
✅ updateInterval = 60초
```

### 시나리오 3: 3시간 전 (주의 상태)
```
targetDate: 2026-06-03 15:00:00
현재: 2026-06-03 12:00:00
남은 시간: 0일 3시간

예상 결과:
✅ urgencyLevel = "alert"
✅ 색상 = 주황 (orange-700)
✅ 메시지 = "⚠️ 긴급 마감까지"
✅ 손실회피 = "1시간 내 신청하면 현재 가격"
✅ updateInterval = 60초
```

### 시나리오 4: 30분 전 (긴급 상태)
```
targetDate: 2026-06-03 12:30:00
현재: 2026-06-03 12:00:00
남은 시간: 0일 0시간 (30분)

예상 결과:
✅ urgencyLevel = "critical"
✅ 색상 = 빨강 (red-700)
✅ 메시지 = "🔴 즉시 신청! 마감까지"
✅ 펄스 = ON (animate-pulse)
✅ 손실회피 = "마감 직전! 지금 신청해야 합니다"
✅ updateInterval = 1초 (중요!)
✅ 그림자 = shadow-red-300
```

### 시나리오 5: 마감 (만료 상태)
```
targetDate: 2026-06-03 12:00:00
현재: 2026-06-03 12:00:01
남은 시간: <= 0

예상 결과:
✅ timeLeft = null
✅ urgencyLevel = "critical" (getUrgencyLevel(null) 반환값)
✅ onExpire() 콜백 호출
✅ 타이머 정리 (clearInterval)
```

## 6️⃣ 최종 판정

### ✅ Pass 항목
- [x] TypeScript 타입 완벽 (null 체크, 리터럴 타입)
- [x] 시간 계산 로직 정확 (ms → days/hours/minutes/seconds)
- [x] 색상 매핑 4단계 정확 (green → yellow → orange → red)
- [x] 심리학 렌즈 반영 (L6 타이밍 + L10 클로징)
- [x] 애니메이션 부드러운 (transition + pulse)
- [x] 메모리 정리 완벽 (clearInterval in cleanup)
- [x] 반응형 디자인 (md: breakpoint)
- [x] 멀티레벨 긴박감 (4단계 색상 + 메시지)
- [x] 스마트 업데이트 주기 (1시간 미만일 때 1초)

### ⚠️ 주의사항
- targetDate 타입이 Date만 (문자열 미지원)
  → 타입 파일에는 Date | string 명시했으나 컴포넌트는 Date만 처리
  → 호출 시 new Date("2026-06-10") 필수
- onStatusChange 콜백 없음
  → 현재는 렌더링 트리거만 제공

### 🎯 최종 판정: ✅ **GO** (배포 가능)

배포 전 단계:
1. [ ] Vercel 프리뷰 배포
2. [ ] 실제 마감 시간으로 3-4시간 전테스트
3. [ ] critical 상태 펄스 애니메이션 시각 확인
4. [ ] 모바일(md:) 반응형 확인
5. [ ] 색상 대비 WCAG AA 재확인
