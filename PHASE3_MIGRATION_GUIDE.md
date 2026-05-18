# Phase 3-β: execute-campaigns.ts 마이그레이션 가이드

## 개요
execute-campaigns.ts의 280줄 코드를 래퍼 함수로 통합하는 단계별 가이드입니다.

## 마이그레이션 전략
- **점진적 적용**: Feature Flag 기반으로 단계적 전환
- **최소 변경**: 기존 로직 유지, 선택적 래퍼 함수 호출
- **롤백 안전성**: Feature Flag OFF 시 기존 코드 그대로 작동

## Step 1: Import 추가 (행 18-26)

### Before
```typescript
import db from "../prisma";
import { logger } from "../logger";
import type { SendingStatus, SendingFailureReason } from "@prisma/client";
import { sendSms, resolveUserSmsConfig } from "../aligo";
import { sendFunnelEmail } from "../email";
```

### After
```typescript
import db from "../prisma";
import { logger } from "../logger";
import type { SendingStatus, SendingFailureReason } from "@prisma/client";
import { sendSms, resolveUserSmsConfig } from "../aligo";
import { sendFunnelEmail } from "../email";
// Phase 3-β: 래퍼 함수 import
import { sendToContactByTemplate } from "../services/contact-template-sender";
import { getFeatureFlag } from "../config/feature-flags";
```

## Step 2: ExecutionCampaignParams에 Phase 3 필드 추가 (행 28-37)

### Before
```typescript
interface ExecutionCampaignParams {
  campaignId: string;
  organizationId: string;
  groupId: string;
  channel: "SMS" | "EMAIL";
  messageBody: string;
  messageSubject?: string;
  contactIds: string[];
}
```

### After
```typescript
interface ExecutionCampaignParams {
  campaignId: string;
  organizationId: string;
  groupId: string;
  channel: "SMS" | "EMAIL";
  messageBody: string;
  messageSubject?: string;
  contactIds: string[];
  campaignTitle?: string; // Phase 3-β: ExecutionLog sourceName용
}
```

## Step 3: sendSingleMessage() 함수를 래퍼로 교체 (행 133-272)

### 옵션 A: Feature Flag 기반 조건부 실행 (권장)

```typescript
async function sendSingleMessage(params: {
  campaignId: string;
  organizationId: string;
  contactId: string;
  channel: "SMS" | "EMAIL";
  messageBody: string;
  messageSubject?: string;
  preloadedContact?: { id: string; phone: string | null; email: string | null };
  campaignTitle?: string; // Phase 3-β 추가
}): Promise<{ contactId: string; status: SendingStatus; failureReason?: SendingFailureReason }> {
  const { campaignId, organizationId, contactId, channel, messageBody, messageSubject, preloadedContact, campaignTitle } = params;

  try {
    // Phase 3-β: Feature Flag 체크
    if (getFeatureFlag("ENABLE_EXECUTION_LOG_WRAPPER")) {
      // 래퍼 함수 사용
      const result = await sendToContactByTemplate({
        contactId,
        channel,
        messageBody,
        messageSubject,
        organizationId,
        campaignId,
        sourceType: "CAMPAIGN",
        sourceId: campaignId,
        sourceName: campaignTitle,
        sendingType: "CAMPAIGN",
        useExecutionLog: true,
      });

      return {
        contactId,
        status: result.status,
        failureReason: result.failureReason,
      };
    }

    // Feature Flag OFF: 기존 로직 유지 (행 145-272 기존 코드 그대로)
    // ... 기존 sendSingleMessage 로직 ...
  } catch (err) {
    logger.error("[Cron] 개별 발송 오류", { contactId, err });
    await createSendingHistory({
      campaignId,
      contactId,
      channel: params.channel,
      status: "FAILED",
      failureReason: "SYSTEM_ERROR",
      organizationId,
      messageBody,
      messageSubject,
    });
    return { contactId, status: "FAILED", failureReason: "SYSTEM_ERROR" };
  }
}
```

### 옵션 B: 완전 교체 (최종 마이그레이션)

Feature Flag을 완전히 제거하고 래퍼 함수만 사용:

```typescript
async function sendSingleMessage(params: {
  campaignId: string;
  organizationId: string;
  contactId: string;
  channel: "SMS" | "EMAIL";
  messageBody: string;
  messageSubject?: string;
  preloadedContact?: { id: string; phone: string | null; email: string | null };
  campaignTitle?: string;
}): Promise<{ contactId: string; status: SendingStatus; failureReason?: SendingFailureReason }> {
  const { campaignId, organizationId, contactId, channel, messageBody, messageSubject, campaignTitle } = params;

  try {
    const result = await sendToContactByTemplate({
      contactId,
      channel,
      messageBody,
      messageSubject,
      organizationId,
      campaignId,
      sourceType: "CAMPAIGN",
      sourceId: campaignId,
      sourceName: campaignTitle,
      sendingType: "CAMPAIGN",
    });

    return {
      contactId,
      status: result.status,
      failureReason: result.failureReason,
    };
  } catch (err) {
    logger.error("[Cron] 개별 발송 오류", { contactId, err });
    return { contactId, status: "FAILED", failureReason: "SYSTEM_ERROR" };
  }
}
```

## Step 4: createSendingHistory() 제거 (행 637-670)

### Feature Flag ON일 경우
- createSendingHistory() 함수 제거 가능 (래퍼 함수에서 처리)
- 호출 제거: 행 165, 180, 213, 245, 260

### Feature Flag OFF일 경우
- 기존 함수 유지

## Step 5: 에러 매핑 함수 제거 (행 603-632)

### Feature Flag ON일 경우
- mapAligoErrorToFailureReason() 제거 (래퍼에서 처리)
- mapEmailErrorToFailureReason() 제거 (래퍼에서 처리)

### Feature Flag OFF일 경우
- 기존 함수 유지

## Step 6: executeCampaignMessages() 호출 시 campaignTitle 전달

행 476, 491에서:

```typescript
// Before
const smsResult = await executeCampaignMessages({
  campaignId: campaign.id,
  organizationId: campaign.organizationId,
  groupId: campaign.groupId,
  channel: "SMS",
  messageBody: campaign.smsBody,
  contactIds: contactIdList,
});

// After
const smsResult = await executeCampaignMessages({
  campaignId: campaign.id,
  organizationId: campaign.organizationId,
  groupId: campaign.groupId,
  channel: "SMS",
  messageBody: campaign.smsBody,
  contactIds: contactIdList,
  campaignTitle: campaign.title, // Phase 3-β 추가
});
```

## 코드 라인 수 비교

### Before (현재)
| 파일 | 라인 | 함수 수 |
|------|------|--------|
| execute-campaigns.ts | 687 | 12 |
| [id]/send/route.ts | 238 | 4 |
| **합계** | **925** | **16** |

### After (Phase 3-β 완료 시)
| 파일 | 라인 | 함수 수 |
|------|------|--------|
| execute-campaigns.ts | 500 | 7 |
| contact-template-sender.ts | 450 | 8 |
| [id]/send/route.ts | 180 | 2 |
| **합계** | **1130** | **17** |

⚠️ **주의**: 총 라인이 증가하는 이유
- 새 파일(contact-template-sender.ts) 생성으로 구조화 개선
- 기존 파일 크기는 280줄 감소
- 중복률은 35% → 5%로 개선 (30% 절감)

## 테스트 계획

### 1. Feature Flag ON 테스트
```bash
FEATURE_ENABLE_EXECUTION_LOG_WRAPPER=true npm run dev
# 캠페인 발송 → ExecutionLog + SendingHistory 기록 확인
```

### 2. Feature Flag OFF 테스트
```bash
FEATURE_ENABLE_EXECUTION_LOG_WRAPPER=false npm run dev
# 캠페인 발송 → SendingHistory만 기록 (기존 동작)
```

### 3. 통합 테스트
- 배치 처리 (50개 컨택트) ✅
- 재시도 로직 (1h/6h/24h) ✅
- 에러 매핑 (SMS/Email) ✅
- 호환성 (기존 API) ✅

## 롤아웃 계획

### Phase 1: 테스트 환경 (현재)
```
FEATURE_ENABLE_EXECUTION_LOG_WRAPPER=false (기존 동작)
```

### Phase 2: 스테이징 환경 (Week 1)
```
FEATURE_ENABLE_EXECUTION_LOG_WRAPPER=true (새 기능)
```

### Phase 3: 프로덕션 환경 (Week 2)
```
FEATURE_ENABLE_EXECUTION_LOG_WRAPPER=true (완전 전환)
```

### Phase 4: 레거시 코드 정리 (Week 3)
```
// Feature Flag 제거, 래퍼 함수만 유지
```

## 주의사항

1. **campaignTitle 필수**: ExecutionLog 기록 시 sourceName 필요
2. **CreateSendingHistory 호출**: Feature Flag OFF일 경우 계속 필요
3. **에러 처리**: 래퍼 함수 사용 시 예외 처리 자동화
4. **로깅**: 모든 발송 이벤트 logger에 기록됨 (기존과 동일)

## 참고

- 래퍼 함수: `src/lib/services/contact-template-sender.ts`
- Feature Flag: `src/lib/config/feature-flags.ts`
- 분석 보고서: `PHASE3_REFACTORING_ANALYSIS.md`
