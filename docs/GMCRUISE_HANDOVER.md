# GMcruise → mabiz CRM 연동 인수인계서

> **작성일**: 2026-05-07  
> **수신**: 크루즈닷몰(GMcruise) 개발팀  
> **발신**: mabiz CRM 팀 (jmonica@cruisedot.co.kr)  
> **목적**: 파트너 계약서 서명 완료 시 CRM 자동 연동

---

## 개요

파트너가 GMcruise에서 **계약서 서명을 완료**하면, GMcruise 서버가 CRM 웹훅 엔드포인트를 호출합니다.  
CRM은 수신 즉시 대리점(Organization)을 자동 생성하고 담당자(jmonica@cruisedot.co.kr)에게 이메일 알림을 보냅니다.

```
GMcruise 계약서 서명 완료
        ↓
POST /api/webhooks/gmcruise/contract-signed
        ↓
대리점 자동 생성 + CRM 알림 이메일
        ↓
대리점장 초대 링크 발급 (CRM에서 수동)
```

---

## 1. 웹훅 엔드포인트

```
POST https://mabizcruisedot.com/api/webhooks/gmcruise/contract-signed
Content-Type: application/json
X-Signature: sha256=<HMAC-SHA256-hex>
X-Timestamp: <Unix 밀리초>
```

---

## 2. 인증 방식 (HMAC-SHA256)

**공유 시크릿:**
```
PARTNER_CONTRACT_WEBHOOK_SECRET=5b40541338e4cc25f871613dad8704ac81be6f40587e44c120a4bd897ac6eaf4
```

> ⚠️ 이 값은 GMcruise 서버 환경변수에만 저장하세요. 클라이언트 코드에 절대 노출 금지.

**서명 생성 방법 (Node.js):**

```typescript
import { createHmac } from 'crypto';

function signWebhook(body: string, secret: string): Record<string, string> {
  const timestamp = Date.now().toString();
  const signature = 'sha256=' + createHmac('sha256', secret)
    .update(Buffer.from(body))
    .digest('hex');

  return {
    'Content-Type': 'application/json',
    'X-Signature':  signature,
    'X-Timestamp':  timestamp,
  };
}

// 사용 예시
const secret  = process.env.PARTNER_CONTRACT_WEBHOOK_SECRET!;
const payload = JSON.stringify({ contractRef, ownerName, ... });
const headers = signWebhook(payload, secret);

await fetch('https://mabizcruisedot.com/api/webhooks/gmcruise/contract-signed', {
  method:  'POST',
  headers,
  body:    payload,
});
```

**검증 규칙:**
- `X-Timestamp` 기준 ±5분 초과 요청은 자동 거부 (재전송 공격 방어)
- 서명 불일치 시 HTTP 401 반환

---

## 3. 요청 페이로드

```jsonc
{
  "contractRef":  "contract_2026_001",   // GMcruise 내부 계약 고유 ID (필수, 중복 방지 키)
  "ownerName":    "홍길동",               // 대리점장 이름 (필수)
  "ownerPhone":   "01012345678",          // 대리점장 전화번호 (필수)
  "ownerEmail":   "hong@example.com",    // 대리점장 이메일 (선택, 있으면 초대 이메일 발송)
  "orgName":      "서울중앙대리점",        // 대리점명 (필수)
  "signedAt":     "2026-05-07T09:00:00Z" // 계약서 서명 완료 시각 ISO8601 (필수)
}
```

**필드 설명:**

| 필드 | 필수 | 설명 |
|------|------|------|
| `contractRef` | ✅ | GMcruise 계약 ID. **중복 호출 안전** — 같은 값으로 두 번 호출해도 대리점이 두 개 생기지 않음 |
| `ownerName` | ✅ | 대리점장 실명 |
| `ownerPhone` | ✅ | 숫자만 또는 하이픈 포함 모두 허용 (`01012345678` / `010-1234-5678`) |
| `ownerEmail` | - | 있으면 초대 이메일 발송에 활용 |
| `orgName` | ✅ | CRM에 표시될 대리점명 |
| `signedAt` | ✅ | 알림 이메일의 서명 완료 시각 표시에 사용 |

---

## 4. 응답 형식

**성공 (신규 대리점 생성):**
```json
HTTP 200
{
  "ok":      true,
  "orgId":   "org_1234567890_abc123",
  "orgName": "서울중앙대리점",
  "created": true
}
```

**성공 (기존 대리점 반환, 중복 호출):**
```json
HTTP 200
{
  "ok":      true,
  "orgId":   "org_1234567890_abc123",
  "orgName": "서울중앙대리점",
  "created": false
}
```

**실패:**
```json
HTTP 401  { "ok": false, "reason": "서명 불일치" }
HTTP 400  { "ok": false, "message": "contractRef, ownerName, ownerPhone, orgName 필수" }
HTTP 500  { "ok": false }
```

---

## 5. 호출 시점

**계약서 서명 완료 즉시** 호출해주세요.

GMcruise 코드에서 계약 완료 처리 함수 내부에 아래를 추가:

```typescript
// 계약서 서명 완료 처리 함수 내부
await notifyMabizCRM({
  contractRef: contract.id.toString(),
  ownerName:   affiliate.name,
  ownerPhone:  affiliate.phone,
  ownerEmail:  affiliate.email ?? undefined,
  orgName:     affiliate.agencyName ?? `${affiliate.name} 대리점`,
  signedAt:    new Date().toISOString(),
});
```

---

## 6. 재시도 권장 설정

네트워크 오류나 CRM 일시 장애에 대비해 재시도 로직을 추가해주세요:

```typescript
async function notifyMabizCRM(payload: ContractPayload, retries = 3): Promise<void> {
  const secret  = process.env.PARTNER_CONTRACT_WEBHOOK_SECRET!;
  const body    = JSON.stringify(payload);
  const headers = signWebhook(body, secret);

  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(
        'https://mabizcruisedot.com/api/webhooks/gmcruise/contract-signed',
        { method: 'POST', headers, body }
      );
      if (res.ok) return;
      console.error(`[MabizWebhook] HTTP ${res.status}`);
    } catch (err) {
      console.error(`[MabizWebhook] 시도 ${i + 1} 실패:`, err);
    }
    await new Promise(r => setTimeout(r, 1000 * (i + 1))); // 1s, 2s, 3s
  }
  // 실패해도 계약 처리는 계속 진행 (비차단)
}
```

> 웹훅 실패가 계약 처리 자체를 막으면 안 됩니다. `try-catch`로 감싸서 비차단으로 실행해주세요.

---

## 7. 테스트 방법

**로컬 테스트 (curl):**

```bash
# 서명 생성
SECRET="5b40541338e4cc25f871613dad8704ac81be6f40587e44c120a4bd897ac6eaf4"
BODY='{"contractRef":"test_001","ownerName":"테스트대리점장","ownerPhone":"01099999999","orgName":"테스트대리점","signedAt":"2026-05-07T00:00:00Z"}'
TS=$(node -e "console.log(Date.now())")
SIG="sha256=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print $2}')"

curl -X POST https://mabizcruisedot.com/api/webhooks/gmcruise/contract-signed \
  -H "Content-Type: application/json" \
  -H "X-Signature: $SIG" \
  -H "X-Timestamp: $TS" \
  -d "$BODY"
```

**예상 응답:**
```json
{"ok":true,"orgId":"org_...","orgName":"테스트대리점","created":true}
```

성공 시 jmonica@cruisedot.co.kr로 신규 대리점 알림 이메일이 발송됩니다.

---

## 8. 연동 완료 체크리스트

```
[ ] PARTNER_CONTRACT_WEBHOOK_SECRET 환경변수 GMcruise 서버에 추가
[ ] 계약서 서명 완료 시점에 notifyMabizCRM() 함수 호출 코드 추가
[ ] 재시도 로직 추가 (비차단 처리)
[ ] 테스트 계약 1건 생성 → CRM 반영 확인
[ ] jmonica@cruisedot.co.kr 알림 이메일 수신 확인
```

---

## 문의

- CRM 팀: jmonica@cruisedot.co.kr  
- 웹훅 오류 발생 시: HTTP 응답 코드 + body 전달해주시면 바로 확인합니다
