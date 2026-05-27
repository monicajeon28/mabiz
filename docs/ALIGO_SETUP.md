# Aligo SMS API 설정 가이드

## 개요

마비즈 CRM에서 실제 SMS 발송을 위해 Aligo API v2를 통합했습니다. 이 문서는 Aligo 계정 설정부터 CRM 통합까지의 전체 과정을 설명합니다.

## 1. Aligo 계정 설정

### 1.1 Aligo 계정 생성
- [Aligo 공식 사이트](https://aligo.in) 방문
- 계정 회원가입 (개인/사업자 선택)
- 충전금 최소 50,000원 이상 권장 (테스트 포함)

### 1.2 API 인증 정보 획득
Aligo 대시보드 → [설정] → [API] 메뉴에서:
- **API Key** (user_id의 실제값, 예: `user123abc`)
- **API Secret Key** (key의 실제값, 예: `abcd1234efgh5678`)

**주의**: Secret Key는 외부 노출 금지 (암호화하여 저장)

### 1.3 발신자 번호 등록
- 사용할 휴대폰 또는 수신자 부가통신사 번호 등록
- 예: `01012345678` 또는 `02-123-4567` (고정전화)
- 등록 후 인증 완료까지 1-2시간 소요

## 2. CRM 환경 변수 설정

### 2.1 조직별 SMS 설정
DB의 `OrgSmsConfig` 테이블에 저장:

```sql
INSERT INTO "OrgSmsConfig" (
  "organizationId",
  "aligoKey",
  "aligoUserId",
  "senderPhone",
  "isActive",
  "senderVerified"
) VALUES (
  'org_123',
  'abcd1234efgh5678',
  'user123abc',
  '01012345678',
  true,
  false
);
```

또는 관리자 UI를 통해 설정:
- 경로: 관리자 → SMS 설정
- API Key, User ID, 발신자 번호 입력
- 발신자 번호 검증 버튼 클릭

### 2.2 환경 변수 (선택사항 - Fallback)
`.env.local` 파일 (보안상 권장하지 않음, 테스트 전용):

```env
# Aligo API 설정 (Fallback - 조직 설정 없을 때만 사용)
ALIGO_API_KEY=abcd1234efgh5678
ALIGO_USER_ID=user123abc
ALIGO_SENDER_PHONE=01012345678

# SMS 모드 설정
SMS_TEST_MODE=false        # true = Mock 발송 (테스트용)
SMS_RATE_LIMIT=100         # 초당 최대 발송 건수
```

## 3. SMS 발송 기능 사용

### 3.1 단일 SMS 발송
```typescript
import { createAligoClient } from '@/lib/aligo';

const client = createAligoClient({
  apiKey: config.aligoKey,
  userId: config.aligoUserId,
  senderPhone: config.senderPhone,
});

const response = await client.sendSms({
  receiver: '01012345678',
  message: '안녕하세요! 마비즈입니다.',
  messageType: 'SMS', // SMS (80자) 또는 LMS (장문)
});

console.log(response.msgId); // Aligo 메시지 ID
```

### 3.2 배치 SMS 발송 (권장 - 대량 발송)
```typescript
const batchResponse = await client.sendSmsBatch([
  {
    receiver: '01012345678',
    message: '메시지 1',
  },
  {
    receiver: '01087654321',
    message: '메시지 2',
  },
  // ... 최대 1000건
]);

console.log(batchResponse.failCount); // 실패 건수
```

### 3.3 자동 스케줄 발송
```typescript
import { sendScheduledSms } from '@/lib/sms-service';

await sendScheduledSms({
  organizationId: 'org_123',
  contactId: 'contact_456',
  phoneNumber: '01012345678',
  body: '안녕하세요 고객님!',
  sendAt: new Date(Date.now() + 60 * 60 * 1000), // 1시간 후
  campaignType: 'L3_DIFFERENTIATION',
  day: 0,
});
```

이제 스케줄된 SMS는 자동으로:
1. **매 5분** Cron Job이 확인 후 발송 (배치 처리)
2. **매 시간** 배송 상태 추적 및 재시도 (최대 3회)

## 4. SMS 상태 추적

### 4.1 배송 상태 확인
```typescript
const status = await client.getDeliveryStatus({
  msgId: 'msg_abc123def456',
  receiver: '01012345678',
});

console.log(status);
// {
//   msgId: 'msg_abc123def456',
//   receiver: '01012345678',
//   status: 'DELIVERED', // PENDING | SENT | DELIVERED | FAILED | BOUNCED
//   sentAt: Date,
//   deliveredAt: Date,
//   failureCode: undefined,
//   failureReason: undefined,
// }
```

### 4.2 ScheduledSms 상태
DB의 `scheduledSms` 테이블에서 실시간 추적:

| 상태 | 설명 |
|------|------|
| `PENDING` | 아직 발송되지 않음 |
| `SENDING` | 발송 중 (처리 중) |
| `SENT` | 발송 완료 (배송 확인 대기) |
| `DELIVERED` | 수신자에게 배송 완료 |
| `FAILED` | 배송 실패 (최대 3회 재시도 후) |
| `NIGHT_BLOCKED` | 야간 차단 (21:00~08:00 KST) |
| `BLOCKED` | 수신 거부 번호 |

### 4.3 SmsLog 상세 기록
발송 각 건마다 `SmsLog` 테이블에 기록:

```json
{
  "organizationId": "org_123",
  "contactId": "contact_456",
  "phone": "01012345678",
  "msg": "안녕하세요 고객님!",
  "status": "SENT",
  "msgId": "msg_abc123def456",
  "channel": "L3_DIFFERENTIATION",
  "createdAt": "2026-05-28T10:30:00Z"
}
```

## 5. 오류 처리 및 재시도

### 5.1 자동 재시도 로직
Aligo Client의 `sendSms()` 메서드는 자동으로 3회 재시도합니다:

```
1차 시도 실패 → 1초 대기 → 2차 시도
2차 시도 실패 → 2초 대기 → 3차 시도
3차 시도 실패 → 최종 실패 (failedCount 증가)
```

### 5.2 오류 코드
| 코드 | 설명 | 재시도 |
|------|------|--------|
| 1 | 성공 | ✗ |
| -1 | 일시적 오류 | ✅ |
| -98 | 야간 발송 차단 | ✅ (다음날 08:00) |
| -99 | 인증 실패 | ✗ |
| 10 | 타임아웃 | ✅ |
| 11 | 서버 오류 | ✅ |

### 5.3 재시도 추적
- `scheduledSms.failedCount` — 실패 횟수 (최대 3)
- `scheduledSms.failureReason` — 마지막 실패 원인
- `smsLog.blockReason` — 차단 사유 (OPT_OUT, NIGHT_BLOCK 등)

## 6. 야간 발송 차단

한국 통신위원회 규정에 따라 **21:00 ~ 08:00 (KST)**에는 SMS 발송이 차단됩니다.

### 6.1 처리 방식
1. 야간 시간대에 발송하려는 SMS → `NIGHT_BLOCKED` 상태
2. 다음날 08:00 이후 자동으로 발송 재개
3. Cron Job이 08:00에 `NIGHT_BLOCKED` SMS를 다시 처리

### 6.2 예약 발송 활용
```typescript
await sendScheduledSms({
  // ...
  sendAt: new Date('2026-05-29T08:30:00+09:00'), // 명시적으로 낮 시간 설정
  // ...
});
```

## 7. 발신자 번호 검증

### 7.1 검증 상태
- `OrgSmsConfig.senderVerified` — 검증 완료 여부
- `OrgSmsConfig.verifiedAt` — 검증 완료 시간

### 7.2 검증 재확인
```typescript
const isValid = await client.verifySenderNumber();
if (isValid) {
  console.log('발신자 번호가 검증되었습니다.');
} else {
  console.error('발신자 번호 검증 실패 - Aligo 대시보드 확인');
}
```

## 8. 비용 및 한도

### 8.1 요금
- SMS: 약 30원/건 (장문 LMS: 약 110원/건)
- 배치 발송: 할인 가능 (Aligo 영업팀 문의)

### 8.2 API 한도
- **배치**: 1회 최대 1000건
- **속도**: 약 1000건/초
- **동시 요청**: 최대 10개

### 8.3 예산 설정 (권장)
```
월간 SMS 예산: $100
예상 발송: 3,000건
충전금: 50,000원 (약 $40)
```

## 9. 모니터링 및 로깅

### 9.1 실시간 로그
- 파일: `/var/log/mabiz-crm.log`
- 검색: `[Aligo]` 키워드

### 9.2 대시보드 조회
- 경로: 관리자 → SMS 통계
- 일일 발송/배송 현황
- 채널별 성공률

### 9.3 모니터링 쿼리
```sql
-- 일일 발송 현황
SELECT 
  DATE(createdAt) as date,
  COUNT(*) as total,
  COUNT(CASE WHEN status = 'SENT' THEN 1 END) as sent,
  COUNT(CASE WHEN status = 'DELIVERED' THEN 1 END) as delivered,
  COUNT(CASE WHEN status = 'FAILED' THEN 1 END) as failed
FROM "ScheduledSms"
WHERE organizationId = 'org_123'
GROUP BY DATE(createdAt)
ORDER BY date DESC;

-- 실패율 높은 연락처
SELECT 
  contactId,
  COUNT(*) as attempts,
  COUNT(CASE WHEN status = 'FAILED' THEN 1 END) as failures,
  ROUND(100.0 * COUNT(CASE WHEN status = 'FAILED' THEN 1 END) / COUNT(*), 1) as failure_rate
FROM "ScheduledSms"
WHERE organizationId = 'org_123'
  AND createdAt > NOW() - INTERVAL '7 days'
GROUP BY contactId
HAVING COUNT(*) >= 3
ORDER BY failure_rate DESC;
```

## 10. 테스트 모드

### 10.1 Mock 발송 (개발 환경)
`.env.local`에 설정:
```env
SMS_TEST_MODE=true
```

이 경우:
- 실제 발송 없음
- Mock msgId 반환
- SmsLog에는 기록됨 (상태 추적 테스트 가능)

### 10.2 테스트 전송
```bash
curl -X POST http://localhost:3000/api/sms/test \
  -H "Content-Type: application/json" \
  -d '{
    "organizationId": "org_123",
    "phoneNumber": "01012345678",
    "message": "테스트 메시지"
  }'
```

## 11. 문제 해결

### 11.1 "API Key 오류" (오류 코드 -99)
- 원인: 잘못된 API Key 또는 User ID
- 해결: Aligo 대시보드에서 정확한 값 확인

### 11.2 "발신자 번호 미등록" (오류 코드 -97)
- 원인: 발신자 번호가 Aligo에 등록되지 않음
- 해결: Aligo 대시보드 → [발신자 번호 관리] → [등록]

### 11.3 "충전금 부족" (오류 코드 -96)
- 원인: 계정의 충전금 부족
- 해결: Aligo 대시보드 → [충전] → 금액 입력

### 11.4 "야간 차단" (오류 코드 -98)
- 원인: 21:00 ~ 08:00 시간대 발송 시도
- 해결: 자동으로 다음날 08:00 이후에 재발송

### 11.5 "수신 거부 번호" (오류 코드 -99)
- 원인: 수신자가 SMS 수신 거부 신청
- 해결: `smsOptOut` 테이블에 등록되어 발송 자동 차단

## 12. 참고 자료

- [Aligo API 공식 문서](https://aligo.in/api/send/)
- [Aligo 정보조회 API](https://aligo.in/api/info/)
- [Aligo 발신자 관리](https://aligo.in/api/sender/)
- 고객지원: support@aligo.in

---

**마지막 업데이트**: 2026-05-28
**버전**: 1.0 (Aligo v2 통합)
