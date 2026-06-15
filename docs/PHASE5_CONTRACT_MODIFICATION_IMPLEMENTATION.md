# Phase 5: Russell Brunson 심리학 기반 계약 수정요청 시스템

## 📋 개요

계약서 상태가 SIGNED(서명완료)인 경우, 고객/파트너가 특정 필드만 수정 요청 가능하도록 하는 시스템입니다. Russell Brunson의 거래 재협상 심리학과 Grant Cardone의 10가지 렌즈(특히 L2, L6, L7, L10) 적용으로 계약 유지율을 15-30% 개선하는 것을 목표합니다.

**목표 KPI**:
- 수정요청 승인율: 80%
- 거절율: 15%
- 대안제시율: 5%
- CVR 개선: +15-30%

---

## 🏗️ 아키텍처 설계

### Phase A: 데이터 모델 (완료)

#### 1. Prisma Schema 확장

**ContractModificationRequest 테이블** (15개 필드):
```prisma
model ContractModificationRequest {
  // 기본 정보
  id: String (PK)
  contractId: String (FK → ContractInstance)
  requestedByUserId: String?
  requestedByType: "AGENT"|"CONTACT"|"PARTNER"
  
  // 수정 내용
  fieldModifications: Json[] // [{fieldName, oldValue, newValue, reason}]
  additionalNotes: String?
  
  // 상태
  status: "REQUESTED"|"APPROVED"|"REJECTED"|"ALTERNATIVE_PROPOSED"|"COMPLETED"|"EXPIRED"
  
  // 관리자 응답
  approvedByUserId: String?
  responseMessage: String?
  alternativeProposal: Json[]
  respondedAt: DateTime?
  
  // L2 5단계 중재
  complexityScore: Int (0-100)
  mediation5Steps: Json[]
  
  // L6 손실회피
  dealRiskFlag: Boolean
  dealRiskReason: String?
  
  // L7 가족설득
  familyMentionDetected: Boolean
  familySuggestion: String?
  
  // L10 긴박감
  expiresAt: DateTime (생성일 + 7일)
  alternativeExpiresAt: DateTime? (대안제시 시 +3일)
  urgencyMessageGenerated: String?
  
  // 심리학 렌즈
  lensApplied: String[] = ["L2", "L6", "L7", "L10"]
  lensDetectionDetails: Json
  
  // 자동화
  smsDay0ResendTriggered: Boolean
  contactLensUpdated: Boolean
  riskScoreUpdated: Boolean
}
```

#### 2. ContractAuditLog 확장

**새로운 action 타입 추가**:
```typescript
"modification_requested"      // 수정요청 생성
"modification_approved"       // 수정요청 승인
"modification_rejected"       // 수정요청 거절
"modification_alternative_proposed" // 대안제시
```

---

### Phase B: 백엔드 API (구현 예정)

#### 엔드포인트 설계

**1. POST /api/contract-instances/[id]/modification-requests**
- 목적: 수정요청 생성
- 권한: Contract 관련 사용자 (요청자)
- 요청 본문:
  ```typescript
  {
    fieldModifications: [{
      fieldName: "tripDate",
      oldValue: "2026-07-15",
      newValue: "2026-07-22",
      reason: "가족 일정이 변경되었습니다"
    }],
    additionalNotes?: "가능한 빨리 처리 부탁드립니다"
  }
  ```
- 응답:
  ```typescript
  {
    ok: true,
    data: {
      id: "mod_xxx",
      status: "REQUESTED",
      expiresAt: "2026-06-22T00:00:00Z",
      appliedLenses: ["L2", "L6", "L7", "L10"],
      complexityScore: 35,
      dealRiskFlag: false
    }
  }
  ```
- 동작:
  1. fieldModifications 검증 (필드 whitelist)
  2. 모든 렌즈 자동감지 (L2-L10)
  3. expiresAt 자동 설정 (7일 후)
  4. ContractModificationRequest 생성
  5. ContractAuditLog: "modification_requested" 기록
  6. 이메일 발송: "수정요청이 제출되었습니다"

**2. GET /api/contract-instances/[id]/modification-requests**
- 목적: 수정요청 목록 조회
- 쿼리 파라미터: status, sortBy, limit
- 응답: 수정요청 배열

**3. PATCH /api/contract-instances/[id]/modification-requests/[requestId]/approve**
- 목적: 수정요청 승인
- 요청 본문:
  ```typescript
  {
    responseMessage?: "변경사항을 적용했습니다. 함께 성공했습니다!"
  }
  ```
- 동작:
  1. ContractInstance.boundData 업데이트 (수정된 필드)
  2. ContractInstance.inputFields 업데이트
  3. status → "COMPLETED"
  4. 이메일 발송: L7 톤 ("함께 해결했습니다")
  5. SMS Day 0 재발송 (새 boundData로)
  6. Contact.appliedLenses 업데이트
  7. Risk Score 업데이트 (-3점: 승인율 높음)

**4. PATCH /api/contract-instances/[id]/modification-requests/[requestId]/reject**
- 목적: 수정요청 거절
- 요청 본문:
  ```typescript
  {
    responseMessage: "객실 타입은 부킹이 확정되어 변경 불가합니다.",
    dealRiskReason?: "거래손실 위험 높음"
  }
  ```
- 동작:
  1. status → "REJECTED"
  2. 이메일 발송: L6 톤 ("대안을 제시합니다")
  3. Contact.lensSequence 업데이트 (L6 거절 이의대응)
  4. Risk Score 업데이트 (+5점: 요청 거절)

**5. PATCH /api/contract-instances/[id]/modification-requests/[requestId]/propose-alternative**
- 목적: 대안 제시
- 요청 본문:
  ```typescript
  {
    alternativeProposal: [{
      fieldName: "roomType",
      proposedValue: "deluxe",
      reason: "프리미엄 객실로 업그레이드 제안 (추가비용 없음)"
    }],
    expiresInDays: 3
  }
  ```
- 동작:
  1. status → "ALTERNATIVE_PROPOSED"
  2. alternativeExpiresAt 설정 (+3일)
  3. L10 긴박감 메시지 자동생성: "2026-06-18 23:59까지만 유효"
  4. 이메일 발송: "대안을 제시했습니다"

#### Cron Job

**GET /api/cron/contract-modifications/auto-expire**
- 목적: 만료된 수정요청 자동 처리
- 실행: 매 6시간
- 동작:
  1. expiresAt < now() AND status = "REQUESTED"인 항목 찾기
  2. status → "EXPIRED"
  3. Contact.appliedLenses에 "auto_expired_request" 추가
  4. 알림 이메일 발송

---

### Phase C: 프론트엔드 UI (구현 예정)

#### 1. 계약 상세 페이지 탭 추가

**수정요청 섹션**:
```
[계약 정보] [서명] [수정요청] ← 새 탭

현재 상태:
- ⏳ 수정요청 1건 (2026-06-22 만료)
- ✅ 승인된 수정 3건
- ❌ 거절된 수정 1건

[수정 요청하기] 버튼
```

#### 2. 수정요청 생성 모달

**Step 1: 필드 선택**
```
[ ] 여행 일정     (tripDate)
[ ] 객실 타입     (roomType)
[ ] 가격         (price)
[ ] 탑승자명      (passengerName)
[ ] 특별요청      (specialRequest)
```

**Step 2: 변경 사유 입력** (SPIN 질문 기반)
```
현재값: 2026-07-15
새로운값: [입력 필드]

변경 사유: [텍스트 영역]
- "왜 이 필드를 수정하고 싶으신가요?" (Situation)
- "현재 값에서 어떤 문제가 있나요?" (Problem)
- "변경되면 어떤 이점이 있을까요?" (Implication)

추가 노트 (선택):
[선택 사항 텍스트]

심리학 메시지:
"계약을 더 나은 방향으로 조정하는 것을 도와드립니다.
3일 이내 답변드리겠습니다."

[제출] [취소] 버튼
```

#### 3. 관리자 응답 화면

**PENDING 목록**:
```
요청자: Monica Jeon
필드: 여행일정, 객실타입
사유요약: "가족 일정 변경됨"
요청시간: 3시간 전
상태: ⏳ PENDING (3일 2시간 59분 남음)

[승인] [거절] [대안제시] 버튼
```

**승인 화면**:
```
Before:  여행일정 2026-07-15 → After: 2026-07-22
Before:  객실타입 Standard → After: Deluxe

응답 메시지 (자동 추천):
"함께 이 문제를 해결했습니다. 당신의 신뢰에 감사합니다!"

[커스텀 메시지로 변경]

[승인 확인] 버튼
```

**거절 화면**:
```
거절 사유 (필수):
[텍스트 영역]

예시:
- "객실 타입은 부킹이 확정되어 변경 불가합니다."
- "가격은 더 이상 협상 불가능합니다."

L6 톤 자동 제시:
"~~는 불가하지만, ~~는 가능합니다."

[거절 확인] 버튼
```

**대안제시 화면**:
```
원 요청: 객실타입 → Standard에서 Deluxe로

우리의 대안:
필드: 객실타입
제안값: Deluxe (프리미엄)
이유: "프리미엄 객실로 무료 업그레이드" (+50% 이점)

설명:
[텍스트 영역]

유효 기간: 3일 (2026-06-18 23:59)
"이 제안은 2026-06-18 23:59까지만 유효합니다."

[제안 발송] 버튼
```

---

## 🧠 심리학 렌즈 적용 세부사항

### L2: 5단계 중재 검증

**자동실행 규칙**:
- 복잡도 > 70점 → 5단계 필수
- 복잡도 40-70점 → 3-4단계 권장
- 복잡도 < 40점 → 빠른 승인 가능

**SPIN 질문 라이브러리**:
1. Situation: "현재 어떤 상황인가요?"
2. Problem: "이 부분에서 어떤 어려움이 있나요?"
3. Implication: "만약 이대로 진행되면?"
4. Need: "이를 해결하려면?"
5. Payoff: "이게 해결되면 어떤 이점이?"

**복잡도 계산식**:
```
score = 10 (기본)
+ 필드당 15점
+ 설명단어당 0.5점
+ 키워드 보너스 (price:20, schedule:15, room:10, family:25)
+ 높은복잡도 플래그: +30점
```

---

### L6: 손실회피 + 대안제시

**거래손실 신호**:
- 가격 관련 변경 (+25점)
- "협상", "할인" 키워드 감지
- 여러 필드 동시 변경 (>3개)
- Risk Score ≥ 50점 → dealRiskFlag = true

**대응 전략**:
```
거절 + 즉시 대안 제시
"~~는 불가하지만, ~~는 가능합니다."
```

---

### L7: 동반자 설득 (가족언급 감지)

**감지 키워드**:
- 배우자, spouse, wife, husband
- 가족, family, children, 자녀

**자동 메시지**:
"배우자분도 이 변경사항이 도움이 될 거라고 확신합니다."

---

### L10: 긴박감 + 투명성

**타임라인**:
- 요청 생성 → expiresAt = 7일 후 (기본)
- 대안제시 → alternativeExpiresAt = +3일 추가

**메시지**:
"이 제안은 2026-06-22 23:59까지만 유효합니다.
그 후에는 원래 조건으로 돌아갑니다."

---

## 🔄 자동화 연계

### 1. SMS Day 0 재발송

**트리거**: 수정요청 승인
**동작**:
1. ContractInstance.boundData 업데이트 (수정된 필드)
2. SMS Day 0 템플릿 선택
3. 새로운 boundData로 변수 치환
4. 자동 발송
5. smsDay0ResendTriggered = true

### 2. Contact Lens Sequence 업데이트

**렌즈별 업데이트**:
- L2 높은복잡도: Contact.appliedLenses += "L2_high_complexity"
- L6 거절: Contact.lensSequence = L6_rejection_handling
- L7 가족언급: Contact.appliedLenses += "L7_family_persuasion"

### 3. Risk Score 변화 추적

**승인 시**: -3점 (좋은 신호)
**거절 시**: +5점 (불만족 신호)
**만료 시**: +2점 (응답없음 신호)

---

## 📊 감사 로그 확장

**ContractAuditLog.action 확장**:
```typescript
"modification_requested"            // 수정요청 생성
"modification_approved"             // 승인
"modification_rejected"             // 거절
"modification_alternative_proposed" // 대안제시
```

**기록 정보**:
- timestamp
- action
- userId (요청자/응답자)
- details (필드명, 사유 등)
- ipAddress
- userAgent

---

## ✅ 검증 기준 (Phase D 테스트)

- [ ] 필드 수정가능 여부 검증 (보안)
- [ ] 만료기한 자동 검사
- [ ] 심리학 메시지 4가지 (L2/L6/L7/L10)
- [ ] 감사 로그 4개 액션
- [ ] 이메일 자동발송
- [ ] SMS Day 0 재발송
- [ ] Contact 렌즈 업데이트
- [ ] Risk Score 변화 추적
- [ ] Cron 자동만료
- [ ] npx tsc --noEmit 0 에러

---

## 🚀 구현 로드맵

| Phase | 작업 | 예상일정 |
|-------|-----|---------|
| **A** | Prisma + 타입 정의 | 2026-06-15 ✅ |
| **B** | API 5개 엔드포인트 | 2026-06-16 |
| **C** | 프론트엔드 3개 모달 | 2026-06-17 |
| **D** | 테스트 + 검증 | 2026-06-18 |

---

## 📞 참고자료

- Russell Brunson 거래 재협상: Hook → Story → Offer → Close
- Grant Cardone 10렌즈: L2(중재), L6(손실회피), L7(동반자), L10(긴박감)
- SPIN 질문: Situation, Problem, Implication, Need-Payoff
- PASONA 프레임워크: Problem, Agitate, Solution, Offer, Narrow, Action

---

**작성일**: 2026-06-15  
**버전**: 1.0  
**상태**: Phase A 완료, Phase B 시작 예정
