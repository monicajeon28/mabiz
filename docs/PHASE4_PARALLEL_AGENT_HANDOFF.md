# Phase 4: 병렬 에이전트 업무 인수 (Handoff)

## 📌 현재 상태 (Agent-CTR-CRON 완료)

### ✅ 완료된 항목
- Cron Job 구현 (contract-reminders/route.ts)
- Prisma 스키마 업데이트 (3개 필드 추가)
- 마이그레이션 생성 (20260615120000_*)
- 문서화 (스펙 + 테스트 계획)

### ⏳ 대기 중인 항목
- TSC 타입 검증 (background task 진행 중)
- Phase B 통합 테스트 (3팀 병렬 작업 후)

---

## 🎯 Agent-CTR-DUP 업무 (복제 기능)

### 도메인: 복제 API + UI
**파일 소유권**:
- `src/app/api/contract-instances/[id]/duplicate/route.ts` (신규)
- `src/app/(dashboard)/contracts/[id]/DuplicateModal.tsx` (신규)

### 구현 요구사항

#### 1. API: POST /api/contract-instances/[id]/duplicate
```typescript
// 요청 바디
{
  newSignerName: string (필수)
  newSignerEmail: string (필수, 유효성검사)
  newSignerPhone: string (선택)
}

// 응답
{
  newContractInstanceId: string
  newSignerEmail: string
  status: "success" | "error"
  message: string
}
```

**로직**:
1. 기존 ContractInstance 조회 (COMPLETED 상태만)
2. boundData, documentId 복사
3. 신규 ContractInstance 생성 (DRAFT 상태)
4. Contact 자동 생성 또는 기존 선택
5. SMS + 이메일 발송 (신규 서명자)

**심리학 적용**: Jeff Bezos 고객집착
- "다시 작성하지 마세요. 복제하세요"
- 확인 메시지: "이전 계약서 정보를 유지합니다"
- 1클릭 완성 (반복 작업 제거)

#### 2. UI: DuplicateModal.tsx
```typescript
// 상태 제약
- COMPLETED 상태에서만 "복제" 버튼 표시
- 미서명 고객: 버튼 비활성화 (회색 표시)

// 모달 입력항목
- 새 서명자 이름 (필수, 유효성: 2-50자)
- 새 서명자 이메일 (필수, 정규식 검증)
- 새 서명자 전화 (선택, 형식: 01012345678)

// 액션 버튼
- [복제 생성] (푸른색, 활성화 시에만)
- [취소] (회색)

// 결과 메시지
- 성공: "계약서 복제 완료. 서명자에게 SMS/이메일 발송했습니다"
- 실패: "복제 실패: [에러 메시지]"
```

#### 3. 에러 처리
```typescript
// 이메일 중복 감지
if (existingContact) {
  // 옵션: 기존 Contact 사용 또는 신규 생성
}

// Contact 생성 실패
if (!newContact) {
  // Fallback: Contact 없이 진행 (boundData에만 저장)
}

// SMS 발송 실패
if (smsError) {
  // Fallback: 이메일만 발송
}
```

#### 4. SMS/이메일 템플릿
```
SMS: "김철수님 신규 계약서가 발송되었습니다. [링크]로 서명해주세요."
Email: "[새로운 서명자 정보로 계약서 HTML 발송]"
```

---

## 🎯 Agent-CTR-STATE 업무 (상태 머신 & 액션 버튼)

### 도메인: 상태 머신 + 액션 로직
**파일 소유권**:
- `src/app/(dashboard)/contracts/[id]/ContractDetailPanel.tsx` (기존 수정)
- `src/app/(dashboard)/contracts/ContractActions.ts` (신규)

### 구현 요구사항

#### 1. 상태 전이 다이어그램
```
DRAFT → SENT → SIGNED → COMPLETED
  ↓      ↓                  ↓
ARCHIVE ↓                ARCHIVE
   ↑────→[재전송]←──────────↑
        (Day 7+)      (선택)

ARCHIVED ⇄ SENT (복구)
```

#### 2. 상태별 액션 버튼 매트릭스

| 상태 | 버튼 1 | 버튼 2 | 버튼 3 | 버튼 4 |
|------|--------|--------|--------|--------|
| **DRAFT** | [서명요청] | [삭제] | - | - |
| **SENT** | [링크복사] | [재전송]🆕 | [요청취소]🆕 | - |
| **SIGNED** | [PDF다운로드] | [재전송] | [취소] | - |
| **COMPLETED** | [PDF다운로드] | [이메일전달] | [복제]🆕 | - |
| **ARCHIVED** | [복구]🆕 | [영구삭제] | - | - |

#### 3. 재전송 액션 (SENT → SENT, SMS 발송)
```typescript
// ContractActions.ts
async function resendContractReminder(contractId: string) {
  const contract = await prisma.contractInstance.findUnique({
    where: { id: contractId },
    include: { organization: true }
  });
  
  // SMS 즉시 발송 (Cron과 동일 로직)
  const message = "계약서를 아직 서명하지 않으셨네요. 지금 클릭해서 완료하세요: [링크]";
  await sendByChannel({ /* ... */ });
  
  // 메타데이터 업데이트
  await prisma.contractInstance.update({
    where: { id: contractId },
    data: {
      lastReminderSentAt: new Date(),
      reminderCount: contract.reminderCount + 1,
    }
  });
  
  return { success: true, message: "서명자에게 재전송했습니다" };
}
```

#### 4. 요청취소 액션 (SENT → ARCHIVED)
```typescript
async function cancelContractRequest(contractId: string) {
  // SENT → ARCHIVED로 변경
  const contract = await prisma.contractInstance.update({
    where: { id: contractId },
    data: {
      status: "ARCHIVED",
      updatedAt: new Date(),
    }
  });
  
  // 서명자에게 취소 알림 SMS 발송
  const cancelMessage = "서명 요청이 취소되었습니다.";
  await sendByChannel({ /* ... */ });
  
  // 이력 기록 (Contract Audit Log)
  // await logContractAction(contractId, "CANCEL", "User initiated");
  
  return { success: true, message: "서명 요청이 취소되었습니다" };
}
```

#### 5. 복구 액션 (ARCHIVED → SENT)
```typescript
async function restoreContractRequest(contractId: string) {
  // ARCHIVED → SENT로 변경
  const contract = await prisma.contractInstance.update({
    where: { id: contractId },
    data: {
      status: "SENT",
      updatedAt: new Date(),
    }
  });
  
  // 서명자에게 복구 알림 + 재발송 SMS
  const message = "서명 요청이 복구되었습니다. 클릭해서 서명해주세요: [링크]";
  await sendByChannel({ /* ... */ });
  
  return { success: true, message: "서명 요청이 복구되었습니다" };
}
```

#### 6. UI 색상 & 배지 (심리학)

| 상태 | 색상 | 배지 | 의도 |
|------|------|------|------|
| DRAFT | 회색 | - | 작성 중 (무관심) |
| SENT | 주황색 | "⏰ 7일 남았습니다" | 긴박감 (L6) |
| SIGNED | 파란색 | "✅ 서명 완료" | 진행 중 (중립) |
| COMPLETED | 초록색 | "✨ 완료" | 성공 (긍정) |
| ARCHIVED | 회색 | "🚫 취소됨" | 비활성 (부정) |

#### 7. 테스트 케이스 (5가지)

```typescript
// TC1: 정상 재전송 (SENT 상태)
await resendContractReminder('contract-id-1');
// 예상: reminderCount 증가, SMS 발송, lastReminderSentAt 업데이트

// TC2: 요청취소 (SENT → ARCHIVED)
await cancelContractRequest('contract-id-2');
// 예상: status ARCHIVED, 취소 SMS 발송

// TC3: 복구 (ARCHIVED → SENT)
await restoreContractRequest('contract-id-3');
// 예상: status SENT, 복구 SMS 발송

// TC4: 재전송 불가 (reminderCount=3)
// 예상: 버튼 비활성화, "더 이상 재전송할 수 없습니다" 메시지

// TC5: 상태 검증 (UI 렌더링)
// 예상: 각 상태별 버튼 표시/비표시 정확성
```

---

## 🔄 병렬 작업 조정 사항

### 파일 독립성 확인
- ✅ Agent-CTR-CRON: `src/app/api/cron/contract-reminders/`
- ✅ Agent-CTR-DUP: `src/app/api/contract-instances/[id]/duplicate/` + 모달
- ✅ Agent-CTR-STATE: `src/app/(dashboard)/contracts/ContractDetailPanel.tsx` + `ContractActions.ts`

**공유 파일**: 없음 (전체 파일 수준 격리 완료)

### Prisma 스키마 공유
```
ContractInstance 모델: 전체 팀이 읽음 (쓰기 없음)
- Agent-CTR-CRON: reminderCount, lastReminderSentAt 읽기/쓰기
- Agent-CTR-DUP: boundData 읽기, 신규 Instance 생성
- Agent-CTR-STATE: status, contactId 읽기/쓰기
```

**주의**: prisma/schema.prisma 수정 금지 (이미 완료)

### Git 충돌 회피
1. 각 팀은 자신의 경로에서만 작업
2. ContractInstance 관련 쿼리는 조직별로 격리
3. 병합 순서: CTR-CRON (기본) → CTR-DUP → CTR-STATE (순차)

---

## 📋 Phase B 통합 체크리스트 (Day 3)

### Before Merge
- [ ] 각 팀 TSC --noEmit 검증 완료
- [ ] 각 팀 단위 테스트 통과
- [ ] 코드 리뷰 (PR 코멘트)

### Merge Order
```
1. Agent-CTR-CRON (기본 - 마이그레이션 포함)
2. Agent-CTR-DUP (복제 API + UI)
3. Agent-CTR-STATE (상태 머신 + 액션)
```

### After Merge
- [ ] 전체 tsc --noEmit 검증
- [ ] 통합 테스트 실행 (3가지 경로)
- [ ] Vercel 배포
- [ ] 프로덕션 모니터링

### 통합 테스트 경로 (3가지)

```
경로 1: Day 0 Workflow
  - 계약서 생성 (DRAFT)
  - 서명 요청 (→SENT)
  - SMS 발송 검증 (Day 0)

경로 2: Day 7 Reminder + Resend
  - Cron 실행 (Day 7, reminderCount=0→1)
  - 사용자 [재전송] 클릭
  - SMS 재발송 검증

경로 3: Duplicate + State Transitions
  - 계약서 완료 (→COMPLETED)
  - [복제] 클릭
  - 신규 계약서 생성 (→SENT)
  - [요청취소] → ARCHIVED
  - [복구] → SENT
```

---

## 📞 상호 참고사항

### Agent-CTR-CRON의 구현을 참고할 점

**1. SMS 발송 유틸**: `sendByChannel` 사용
```typescript
import { sendByChannel, resolveUserSmsConfig } from '@/lib/aligo';

const result = await sendByChannel({
  channel: 'SMS',
  smsConfig: { key, userId, sender },
  receiver: phone,
  msg: message,
  organizationId: orgId,
  contactId: contactId || undefined,
});
```

**2. 에러 핸들링 패턴**
```typescript
try {
  // SMS 발송
} catch (err) {
  logger.error('[Action]', { contractId, error: err });
  // 부분 실패 계속 진행 (다른 계약서)
}
```

**3. 로깅 레벨**
```typescript
logger.info('[분류/액션] 설명', { key: value });
logger.warn('[분류/액션] 경고', { key: value });
logger.error('[분류/액션] 에러', { error: err });
```

### Prisma 업데이트 패턴
```typescript
// 원자적 업데이트 (중복 처리 방지)
const updated = await prisma.contractInstance.updateMany({
  where: { id: contractId, status: 'SENT' },
  data: { status: 'ARCHIVED' }
});

if (updated.count === 0) {
  // 다른 프로세스가 이미 처리함
  return { success: false, message: '이미 처리됨' };
}
```

---

## 🎯 최종 목표

### Phase B 완료 시 전체 Phase 4 기능

```
계약서 생명주기:
DRAFT (작성)
  ↓
SENT (서명 요청) ← [Cron Day 7: 재전송 자동화]
  ├─ [사용자 재전송 버튼]
  ├─ [요청취소 버튼] → ARCHIVED
  └─ [복구 버튼] (ARCHIVED에서)
  ↓
SIGNED (서명 완료)
  ↓
COMPLETED (완료)
  ├─ [복제 버튼] → 신규 계약서 생성
  └─ [이메일 전달]
```

### 심리학 통합
- **L6 손실회피**: "7일 남았습니다" 배지
- **L10 긴박감**: [지금 서명하세요] CTA
- **Jeff Bezos 고객집착**: [복제하기] 1클릭

---

## 📅 일정

| 단계 | 담당팀 | 예상 시간 | 마감 |
|------|--------|----------|------|
| Phase A (CRON) | Agent-CTR-CRON | 4-5시간 | 2026-06-15 12:00 |
| Phase B 병렬 | 3팀 동시 | 4-6시간 | 2026-06-15 18:00 |
| 통합 & 테스트 | 3팀 공동 | 2-3시간 | 2026-06-16 09:00 |
| 프로덕션 배포 | DevOps | 1시간 | 2026-06-16 10:00 |

---

**문서 작성**: Agent-CTR-CRON  
**업데이트**: 2026-06-15 10:30 UTC  
**상태**: Phase A 완료 → Phase B 시작 대기
