# Aligo 통합 - 현재 코드 진단 보고서

**작성일**: 2026-06-08  
**대상**: 마비즈 CRM 개발팀  
**범위**: `src/lib/aligo*` 및 SMS 발송 관련 코드

---

## 🔴 발견된 문제점

### P0: IP 인증 오류 (즉시 해결)

#### 문제 설명
```
API 응답: {"result_code": -107, "message": "발송 IP가 인증되지 않은 발송 IP입니다"}
```

#### 근본 원인
- **Aligo 관리페이지에서 IP 화이트리스트 미등록**
- 마비즈 서버 (Vercel 또는 EC2)의 공개 IP가 Aligo에서 차단됨
- Vercel은 IP를 동적으로 사용하므로 모든 IP를 사전 등록하기 어려움

#### 해결책 (3가지)

**옵션 A: 현재 IP 자동 감지 (추천)**
```typescript
// src/lib/get-server-ip.ts (신규)
import { redis } from "@/lib/redis";

export async function getServerPublicIP(): Promise<string> {
  const cacheKey = "server_public_ip";
  const cached = await redis.get(cacheKey);
  
  if (cached) return cached as string;
  
  try {
    const response = await fetch("https://api.ipify.org?format=json", {
      signal: AbortSignal.timeout(5000),
    });
    const data = (await response.json()) as { ip: string };
    
    // 1시간 캐시
    await redis.setex(cacheKey, 3600, data.ip);
    logger.log("[getServerPublicIP]", { ip: data.ip });
    
    return data.ip;
  } catch (err) {
    logger.error("[getServerPublicIP] 실패", { err });
    return "UNKNOWN";
  }
}
```

**옵션 B: 헬스 체크 API 추가 (배포 후 확인)**
```typescript
// src/app/api/health/route.ts (신규)
import { getServerPublicIP } from "@/lib/get-server-ip";

export async function GET() {
  const ip = await getServerPublicIP();
  
  return Response.json({
    status: "ok",
    serverPublicIP: ip,
    instructions: `
    1. https://smartsms.aligo.in/admin/ 로그인
    2. [관리] → [발송 설정] → [IP 관리]
    3. [IP 추가] 클릭
    4. 이 IP 입력: ${ip}
    5. 저장
    `,
  });
}
```

**배포 후 실행**:
```bash
# Vercel 배포 완료 후
curl https://mabizcruisedot.com/api/health
# 응답: {"status":"ok","serverPublicIP":"52.1.2.3","instructions":"..."}
```

**옵션 C: Aligo 고객지원 연락**
- 마비즈 담당자: hyeseon28 (hyeseon28@gmail.com)
- 요청: "Vercel 배포 환경이므로 IP 화이트리스트 해제 또는 동적 IP 지원 요청"

---

### P1: 에러 처리 불명확

#### 현재 상태
```typescript
// src/lib/aligo.ts 라인 131
logger.log("[Aligo] 발송 결과", {
  code: data.result_code,
  phone: receiver.substring(0, 4) + "***",
});

if (organizationId) {
  recordSmsLog({
    status: Number(data.result_code) === 1 ? "SENT" : "FAILED",
    resultCode: String(data.result_code),  // ← 단순 숫자 저장
    // 어떤 오류인지 사용자가 알 수 없음
  });
}
```

#### 문제
- 에러 코드만 저장되고 **사용자 친화적인 메시지 없음**
- `-107` (IP 인증) vs `-99` (API 키) vs `-108` (발신번호) 구별 불가
- 관리자가 원인을 파악하기 어려움

#### 해결책
```typescript
// src/lib/aligo-error-formatter.ts (신규)
const ALIGO_ERROR_MAP = {
  1: { msg: "발송 성공", retryable: false },
  
  // 인증 오류
  "-99": { msg: "API 인증 실패 (키/아이디 확인)", retryable: false },
  "-106": { msg: "API 키 만료 (대시보드 재발급)", retryable: false },
  "-107": { msg: "서버 IP 미인증 (Aligo IP 화이트리스트 확인)", retryable: false },
  "-108": { msg: "발신번호 미등록 (설정 → 문자 → 검증)", retryable: false },
  
  // 한도 오류
  "-15": { msg: "발송 예산 부족 (Aligo 충전)", retryable: false },
  "-16": { msg: "일일 한도 초과 (내일 재시도)", retryable: false },
  "-17": { msg: "시간당 한도 초과 (5분 후 재시도)", retryable: true },
  
  // 메시지 포맷
  "-20": { msg: "메시지 내용 빈 상태", retryable: false },
  "-21": { msg: "메시지 길이 초과 (SMS 90자, LMS 2000바이트)", retryable: false },
  "-22": { msg: "수신번호 형식 오류", retryable: false },
  "-23": { msg: "발신번호 형식 오류", retryable: false },
  
  // 네트워크
  "-1": { msg: "네트워크 오류 (재시도 중)", retryable: true },
  "-9": { msg: "발송 타임아웃 (재시도 중)", retryable: true },
};

export function formatAligoError(
  code: number
): { userMsg: string; retryable: boolean; logMsg: string } {
  const entry = ALIGO_ERROR_MAP[String(code)] || ALIGO_ERROR_MAP["1"];
  
  return {
    userMsg: entry.msg,
    retryable: entry.retryable,
    logMsg: `[Aligo] ${entry.msg} (코드: ${code})`,
  };
}
```

**사용처**:
```typescript
// src/lib/aligo.ts 라인 146 수정
const { userMsg, retryable, logMsg } = formatAligoError(Number(data.result_code));

logger.log(logMsg);

if (organizationId) {
  recordSmsLog({
    status: Number(data.result_code) === 1 ? "SENT" : "FAILED",
    resultCode: String(data.result_code),
    blockReason: userMsg,  // ← 사용자 메시지 저장
    msgId: data.msg_id,
    channel,
  });
}

return {
  result_code: data.result_code,
  message: userMsg,  // ← 사용자 메시지 반환
};
```

---

### P2: 배치 발송 미지원

#### 현재 상태
```typescript
// src/lib/aligo.ts - sendSms만 제공
export async function sendSms(params: SendSmsParams): Promise<AligoResponse> {
  // 단일 발송만 가능
}

// 대량 발송? 호출자가 직접 루프
const phones = ["01012345678", "01087654321", ...];
for (const phone of phones) {
  await sendSms({ config, receiver: phone, msg });  // ← N번 호출
}
```

#### 문제
- **N개 메시지 = N번 API 호출** (비효율)
- Aligo 대량 발송 API 미사용 (최대 1000건/요청)
- 비용 증가, 속도 저하

#### 해결책
```typescript
// src/lib/aligo/client.ts 라인 104 (이미 구현됨)
async sendSmsBatch(requests: AligoSendRequest[]): Promise<AligoSendResponse> {
  // SMS/LMS 자동 분리
  // 1000건씩 청크로 발송
  // 재시도 로직 포함
}

// 사용 예시
const client = new AligoClient(config);
const response = await client.sendSmsBatch([
  { receiver: "01012345678", message: "메시지1" },
  { receiver: "01087654321", message: "메시지2" },
  // ... 최대 1000개
]);
```

**마이그레이션 계획**:
1. `src/lib/aligo.ts` → `src/lib/aligo/client.ts` 통합
2. `src/app/api/contacts/tag-blast/route.ts` (대량 발송)에서 `sendSmsBatch` 사용
3. Cron jobs에서 배치 발송으로 최적화

---

### P3: 재시도 로직 부재

#### 현재 상태
```typescript
// src/lib/aligo.ts 라인 115-152
try {
  const res = await fetch("https://apis.aligo.in/send/", {
    method: "POST",
    // 타임아웃 8초
    signal: controller.signal,
  });
  const data = (await res.json()) as AligoResponse;
  
  // 일회성 호출, 재시도 없음
  return data;  // ← 실패하면 그냥 반환
} catch (err) {
  logger.error("[Aligo] 발송 실패", { err });
  return { result_code: -1, message: "발송 오류" };  // ← 재시도 없음
}
```

#### 문제
- 네트워크 타임아웃 시 **그냥 실패**
- 일시적 오류 (-1, -9 등)는 재시도 가능하지만 미시도
- 발송 성공률 저하

#### 해결책 (이미 src/lib/aligo/client.ts에 구현됨)
```typescript
// src/lib/aligo/client.ts 라인 336-393
private async sendWithRetry(request: AligoSendRequest): Promise<AligoSendResponse> {
  const maxRetries = 3;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await this.sendInternal(request);
      
      // 성공
      if (response.resultCode === 1) return response;
      
      // 재시도 가능?
      if (!RETRYABLE_CODES.has(response.resultCode)) {
        return response;  // 재시도 불가능한 오류
      }
      
      // 지수 백오프: 1초 → 2초 → 4초
      const delayMs = Math.pow(2, attempt - 1) * 1000;
      await delay(delayMs);
    } catch (error) {
      // 마지막 시도인가?
      if (attempt === maxRetries) throw error;
    }
  }
}
```

**RETRYABLE_CODES**:
- `-1`: 일반 네트워크 오류
- `-9`: 타임아웃
- `10`: API 타임아웃
- `11`: 서버 오류
- `12`: 과부하

**non-RETRYABLE_CODES**:
- `-99`: 인증 실패
- `-107`: IP 미인증
- `-108`: 발신번호 미등록

**마이그레이션**: `sendSms()` 호출을 `new AligoClient().sendSms()`로 변경

---

### P4: 발신번호 검증 미흡

#### 현재 상태
```typescript
// src/lib/aligo.ts 라인 220-244
export async function verifySenderNumber(config: AligoConfig): Promise<boolean> {
  try {
    const res = await fetch("https://apis.aligo.in/sender/", { ... });
    const data = await res.json();
    
    // 검증만 하고 반환
    return Array.isArray(data.list) &&
      data.list.some((item) => item.flag === '1' && item.telnum === config.sender);
  } catch {
    return false;  // 네트워크 오류 시 false (저장은 허용)
  }
}
```

#### 문제
- **네트워크 오류 시 검증 실패** → 개인 SMS 설정이 저장되지 않음
- 사용자가 설정 페이지에서 "인증 실패"만 보고 원인을 모름
- `senderVerified=true` 설정이 되지 않으면 개인 발송 불가

#### 해결책
```typescript
// src/lib/aligo/client.ts 라인 293-331
async verifySenderNumber(): Promise<{
  verified: boolean;
  status: "verified" | "pending" | "error";
  errorMsg?: string;
}> {
  try {
    const params = new URLSearchParams({
      key: this.config.apiKey,
      user_id: this.config.userId,
    });
    
    const response = await this.fetchWithTimeout(
      `${ALIGO_API_BASE}/sender/`,
      { method: "POST", body: params.toString() }
    );
    
    const data = (await response.json()) as any;
    
    if (data.result_code !== 1) {
      return {
        verified: false,
        status: "error",
        errorMsg: `Aligo 오류 (코드: ${data.result_code}): ${data.message}`,
      };
    }
    
    const verified = Array.isArray(data.list) &&
      data.list.some((item: any) => item.flag === '1' && item.telnum === this.config.senderPhone);
    
    if (!verified) {
      return {
        verified: false,
        status: "pending",
        errorMsg: "Aligo에 미등록된 발신번호입니다. 대시보드에서 추가하세요.",
      };
    }
    
    return { verified: true, status: "verified" };
  } catch (error) {
    return {
      verified: false,
      status: "error",
      errorMsg: `네트워크 오류: ${error instanceof Error ? error.message : 'Unknown'}`,
    };
  }
}
```

---

### P5: 야간 발송 차단 로직

#### 현재 상태 (정상)
```typescript
// src/lib/aligo.ts 라인 34-39
function isNightTime(): boolean {
  const kstHour = (new Date().getUTCHours() + 9) % 24;
  return kstHour >= 21 || kstHour < 8;
}

// 야간 (21:00~08:00) 발송 차단
if (isNightTime()) {
  recordSmsLog({ 
    status: "BLOCKED", 
    blockReason: "NIGHT_BLOCK",  // ← 추적 가능
  });
  return { result_code: -98, message: "야간 발송 차단" };
}
```

**평가**: 정상 (개선 불필요)

---

### P6: SmsLog 기록 비동기 처리

#### 현재 상태 (정상)
```typescript
// src/lib/aligo.ts 라인 41-70
async function recordSmsLog(params: { ... }) {
  const { addSmsLog } = await import("@/lib/sms-queue");
  
  try {
    await addSmsLog({  // Redis 큐에 추가
      organizationId,
      contactId,
      phone,
      msg,
      status,
      blockReason,
      resultCode,
      msgId,
      channel,
    });
  } catch (err) {
    logger.error("[Aligo] SmsLog 큐 추가 실패", { err });
  }
}
```

**장점**:
- 발송 API 완료 후 DB 기록 → 논블로킹
- Redis 큐 → 나중에 비동기 처리
- 사용자 응답 지연 없음

**평가**: 정상 (개선 불필요)

---

## 🟡 개선 권장사항 (P2 - 중요도 낮음)

### 1. 메시지 자동 최적화

**현재**: 메시지 길이 수동 관리
```typescript
const msgType = finalMsg.length > 90 ? "LMS" : "SMS";
```

**개선**: 바이트 기준 자동 변환
```typescript
function optimizeMessage(msg: string): {
  type: "SMS" | "LMS";
  finalMsg: string;
  truncated: boolean;
} {
  const bytes = Buffer.byteLength(msg, "utf-8");
  
  if (bytes <= 90) {
    return { type: "SMS", finalMsg: msg, truncated: false };
  }
  
  if (bytes <= 2000) {
    return { type: "LMS", finalMsg: msg, truncated: false };
  }
  
  const truncated = msg.substring(0, Math.floor(2000 / 3)) + "...";
  return { type: "LMS", finalMsg: truncated, truncated: true };
}
```

### 2. API 응답 타입 명확화

**현재**: `any` 타입 사용
```typescript
const data = (await response.json()) as any;
```

**개선**: 정확한 타입 정의
```typescript
interface AligoSendResponse {
  result_code: number;
  message: string;
  msg_id?: string;
  fail_count?: number;
}

interface AligoInfoResponse {
  result_code: number;
  msg_id: string;
  receiver: string;
  status: string;  // "1" | "2" | "3" | "4" | "5"
  statustext: string;
  sendtime: string;
  deliverytime: string;
  failcode: string;
  failmsg: string;
}
```

### 3. 모니터링 대시보드

**추가 API 엔드포인트**:
```typescript
// src/app/api/admin/sms/stats/route.ts
export async function GET() {
  return {
    totalSent: 12345,
    totalFailed: 23,
    failureRate: 0.19,  // 0.19%
    avgResponseTime: 850,  // ms
    topFailureCodes: [
      { code: -107, count: 10, msg: "IP 미인증" },
      { code: -1, count: 8, msg: "네트워크 오류" },
      { code: -21, count: 5, msg: "메시지 길이 초과" },
    ],
  };
}
```

---

## 📋 우선순위별 실행 계획

### Phase 1: 긴급 (IP 오류 해결)
- [ ] `getServerPublicIP()` 함수 추가
- [ ] `/api/health` 엔드포인트 추가
- [ ] Vercel 배포 후 IP 화이트리스트 등록
- [ ] 발송 테스트로 `-107` 오류 확인

**소요 시간**: 30분  
**영향 범위**: 모든 SMS 발송 기능

### Phase 2: 중요 (에러 처리 강화)
- [ ] `ALIGO_ERROR_MAP` 정의
- [ ] `formatAligoError()` 함수 추가
- [ ] `recordSmsLog()` 호출 시 `blockReason` 저장
- [ ] 관리자 UI에서 에러 원인 표시

**소요 시간**: 1시간  
**영향 범위**: 사용자 경험, 디버깅

### Phase 3: 최적화 (배치 발송 마이그레이션)
- [ ] `AligoClient` 기반으로 통일
- [ ] `src/app/api/contacts/tag-blast/route.ts` 수정
- [ ] Cron jobs에서 배치 발송 적용
- [ ] 성능 측정 (API 호출 수 감소 확인)

**소요 시간**: 2시간  
**영향 범위**: 대량 발송 성능

---

## 체크리스트: 현재 상태

| 항목 | 상태 | 해결책 |
|------|------|--------|
| IP 인증 오류 | 🔴 미해결 | P0 실행 계획 참조 |
| 에러 메시지 불명확 | 🟡 부분 해결 | P1 실행 계획 참조 |
| 배치 발송 미지원 | 🟡 구현됨 (미사용) | P2 마이그레이션 참조 |
| 재시도 로직 | 🟡 구현됨 (미사용) | `AligoClient` 사용 권장 |
| 발신번호 검증 | 🟢 정상 | - |
| 야간 발송 차단 | 🟢 정상 | - |
| SmsLog 기록 | 🟢 정상 | - |

---

**다음 단계**: 
1. IP 인증 오류 해결 (이번 주)
2. 에러 처리 개선 (다음 주)
3. 배치 발송 마이그레이션 (그 다음 주)

문의: hyeseon28@gmail.com
