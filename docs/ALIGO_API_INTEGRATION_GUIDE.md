# Aligo SMS API 통합 가이드

**작성일**: 2026-06-08  
**버전**: 1.0  
**대상**: 마비즈 CRM 개발팀  
**목표**: Aligo API 완벽 이해 + IP 인증 오류 해결 + 현재 코드 진단

---

## 📋 목차

1. [API 개요](#api-개요)
2. [Aligo API 스펙](#aligo-api-스펙)
3. [응답 코드 가이드](#응답-코드-가이드)
4. [IP 인증 오류 진단](#ip-인증-오류-진단)
5. [현재 구현 분석](#현재-구현-분석)
6. [권장 개선사항](#권장-개선사항)
7. [통합 테스트 가이드](#통합-테스트-가이드)

---

## API 개요

### 서비스 개요
- **플랫폼**: Aligo (알리고)
- **기능**: 텍스트 메시지(SMS) / 롱메시지(LMS) 발송, 카카오 알림톡
- **관리페이지**: https://smartsms.aligo.in/admin/
- **공식 API 문서**: https://smartsms.aligo.in/admin/api/spec.html

### 현재 마비즈 구성

| 항목 | 값 |
|-----|-----|
| **계정** | hyeseon28 (회원 관리자) |
| **API Key** | `ykfcblofawtxt5b3gf7iyey30iufinqr` |
| **발신번호** | `01032893800` (승인됨) |
| **카카오 채널** | `cruisedot` |
| **카카오 Sender Key** | `13b13496a0f51e9a602706d0dd8b27598088dd5a` |

---

## Aligo API 스펙

### 1. 문자 발송 API

**엔드포인트**: `POST https://apis.aligo.in/send/`

#### 필수 파라미터

```
┌─────────────────────────┬──────────────┬────────────────────────────┐
│ 파라미터                  │ 타입         │ 설명                        │
├─────────────────────────┼──────────────┼────────────────────────────┤
│ user_id                 │ String       │ Aligo 회원 아이디           │
│ key                     │ String       │ API 인증 키                 │
│ sender                  │ String       │ 발신번호 (사전등록 필수)     │
│ receiver                │ String       │ 수신번호 (01012345678 형식) │
│ msg                     │ String       │ 메시지 내용 (최대 90자 SMS)│
│ msg_type                │ String       │ 메시지 타입: SMS | LMS      │
│ title (LMS 필수)        │ String       │ LMS 제목 (최대 40바이트)   │
│ reservation (선택)      │ String       │ 예약발송: YYYY-MM-DD HH:MM │
└─────────────────────────┴──────────────┴────────────────────────────┘
```

#### 단일 발송 요청 예시

```bash
curl -X POST "https://apis.aligo.in/send/" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "user_id=hyeseon28" \
  -d "key=ykfcblofawtxt5b3gf7iyey30iufinqr" \
  -d "sender=01032893800" \
  -d "receiver=01012345678" \
  -d "msg=안녕하세요." \
  -d "msg_type=SMS"
```

#### 대량 발송 요청 예시

```bash
# 최대 1000건까지 한 번에 전송 가능
curl -X POST "https://apis.aligo.in/send/" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "user_id=hyeseon28" \
  -d "key=ykfcblofawtxt5b3gf7iyey30iufinqr" \
  -d "sender=01032893800" \
  -d "msg_type=SMS" \
  -d "receiver_1=01012345678" \
  -d "msg_1=첫번째 메시지" \
  -d "receiver_2=01087654321" \
  -d "msg_2=두번째 메시지"
```

#### 응답 예시

```json
{
  "result_code": 1,
  "message": "Success",
  "msg_id": "202606081234567890",
  "fail_count": 0
}
```

### 2. LMS (롱메시지) 발송

**엔드포인트**: `POST https://apis.aligo.in/send/`

#### 특징
- **90자 초과 메시지만 LMS로 발송 가능**
- **제목(title) 필수**: 최대 40바이트(한글 20자)
- **메시지 최대**: 2,000바이트(한글 1,000자)
- **비용**: SMS보다 약 2-3배 비쌈

#### LMS 요청 예시

```bash
curl -X POST "https://apis.aligo.in/send/" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "user_id=hyeseon28" \
  -d "key=ykfcblofawtxt5b3gf7iyey30iufinqr" \
  -d "sender=01032893800" \
  -d "receiver=01012345678" \
  -d "msg_type=LMS" \
  -d "title=여행 안내" \
  -d "msg=안녕하세요. 크루즈 여행에 관심을 주셔서 감사합니다.\n\n본 메시지는 고객님의 구매 결정을 돕기 위한 안내입니다..."
```

### 3. 배송 상태 조회 API

**엔드포인트**: `POST https://apis.aligo.in/info/`

#### 필수 파라미터

```
┌──────────┬────────────┬──────────────────────────────────┐
│ 파라미터  │ 타입       │ 설명                              │
├──────────┼────────────┼──────────────────────────────────┤
│ user_id  │ String     │ Aligo 회원 아이디                 │
│ key      │ String     │ API 인증 키                       │
│ msg_id   │ String     │ 발송 응답의 msg_id               │
│ receiver │ String     │ 수신번호 (선택, 없으면 전체 조회) │
└──────────┴────────────┴──────────────────────────────────┘
```

#### 응답 예시

```json
{
  "result_code": 1,
  "msg_id": "202606081234567890",
  "receiver": "01012345678",
  "status": "2",
  "statustext": "전달됨",
  "sendtime": "2026-06-08 12:34:56",
  "deliverytime": "2026-06-08 12:34:58",
  "failcode": "",
  "failmsg": ""
}
```

**상태 코드**:
- `1`: 발송 완료 (이동통신사 수신)
- `2`: 전달됨 (단말기 수신)
- `3`: 실패
- `4`: 반송
- `5`: 대기 중

### 4. 발신번호 검증 API

**엔드포인트**: `POST https://apis.aligo.in/sender/`

#### 필수 파라미터

```
┌──────────┬────────────┬──────────────────────┐
│ 파라미터  │ 타입       │ 설명                  │
├──────────┼────────────┼──────────────────────┤
│ user_id  │ String     │ Aligo 회원 아이디     │
│ key      │ String     │ API 인증 키           │
└──────────┴────────────┴──────────────────────┘
```

#### 응답 예시

```json
{
  "result_code": 1,
  "message": "Success",
  "list": [
    {
      "telnum": "01032893800",
      "flag": "1",
      "company": "SKT",
      "verify_date": "2024-01-15"
    },
    {
      "telnum": "02-1234-5678",
      "flag": "1",
      "company": "KT",
      "verify_date": "2024-01-20"
    }
  ]
}
```

**flag 값**:
- `1`: 승인된 발신번호 (사용 가능)
- `0`: 미승인 또는 삭제된 번호

### 5. 카카오 알림톡 API

**엔드포인트**: `POST https://kakaoapi.aligo.in/akv10/alimtalk/send/`

#### 필수 파라미터

```
┌────────────────┬──────────────┬──────────────────────────────┐
│ 파라미터        │ 타입         │ 설명                          │
├────────────────┼──────────────┼──────────────────────────────┤
│ userid         │ String       │ Aligo 회원 아이디             │
│ apikey         │ String       │ Kakao API Key                │
│ senderkey      │ String       │ Kakao 채널 Sender Key         │
│ tpl_code       │ String       │ 등록된 템플릿 코드             │
│ receiver_1     │ String       │ 수신번호                      │
│ message_1      │ String       │ 메시지 본문                   │
│ button_1       │ JSON         │ 버튼 정보 (선택)              │
└────────────────┴──────────────┴──────────────────────────────┘
```

#### 응답 코드
- `0`: 성공
- 음수: 실패 (상세 오류 메시지 참조)

---

## 응답 코드 가이드

### 성공 코드

| 코드 | 의미 | 조치 |
|------|------|------|
| `1` | 발송 성공 | 메시지 추적 시작 |
| `0` | (카카오) 발송 성공 | - |

### 인증 오류

| 코드 | 의미 | 원인 | 해결책 |
|------|------|------|--------|
| `-99` | 인증 실패 | 잘못된 user_id/key | ✅ 환경변수 재확인 |
| `-106` | API Key 만료 | Aligo 계정 설정 변경 | ✅ 대시보드에서 신규 키 발급 |
| `-107` | 요청 IP 인증 안됨 | 미등록 IP에서 호출 | ⚠️ **다음 섹션 참조** |
| `-108` | 발신번호 미등록 | sender 파라미터 오류 | ✅ verifySenderNumber 호출 |

### 사용 한도 오류

| 코드 | 의미 | 원인 | 해결책 |
|------|------|------|--------|
| `-15` | 예산 부족 | 충전 필요 | ✅ Aligo 계정 → 충전 |
| `-16` | 일일 한도 초과 | 발송량 제한 | ✅ 다음 날 재시도 또는 한도 증액 신청 |
| `-17` | 시간당 한도 초과 | Rate limit | ✅ 발송 속도 조절 (1초 기다림) |

### 메시지 포맷 오류

| 코드 | 의미 | 원인 | 해결책 |
|------|------|------|--------|
| `-20` | 메시지 내용 빈 상태 | msg 파라미터 누락 | ✅ 메시지 내용 확인 |
| `-21` | 메시지 길이 초과 | SMS >90자, LMS >2000바이트 | ✅ 메시지 길이 조정 |
| `-22` | 수신번호 형식 오류 | receiver 포맷 무효 | ✅ `01012345678` 형식 확인 |
| `-23` | 발신번호 형식 오류 | sender 포맷 무효 | ✅ `0102-1234-5678` 또는 `02-1234-5678` |

### 네트워크 오류

| 코드 | 의미 | 원인 | 해결책 |
|------|------|------|--------|
| `-1` | 일반 네트워크 오류 | Timeout / 서버 오류 | ✅ 재시도 (exponential backoff) |
| `-9` | 타임아웃 | 응답 지연 (>8초) | ✅ 재시도 + API 로드 확인 |

---

## IP 인증 오류 진단

### 문제: "발송 IP가 인증되지 않은 발송 IP입니다" (-107 오류)

이 오류는 **Aligo가 귀사 서버의 발송 요청을 차단하는 것**을 의미합니다.

### 원인 분석

#### 1. **발송 IP란 무엇인가?**

```
┌─────────────────────────────────┐
│  Client (Web Browser)           │
│  IP: 203.123.xxx.xxx (ISP)      │
└────────────┬────────────────────┘
             │
             │ HTTPS Request
             │
┌────────────▼────────────────────┐
│  Server (Vercel / EC2)          │
│  IP: 52.1.2.3 (클라우드)         │
│  ← **이 IP가 발송 IP**           │
└────────────┬────────────────────┘
             │
             │ HTTPS Request
             │
┌────────────▼────────────────────┐
│  Aligo API (apis.aligo.in)      │
│  ← IP 화이트리스트 확인           │
│  52.1.2.3 있음? ✅/❌            │
└─────────────────────────────────┘
```

**발송 IP = 마비즈 CRM 서버가 Aligo API를 호출할 때 사용하는 공개 IP**

#### 2. **현재 마비즈 인프라에서 발송 IP는?**

| 환경 | 발송 IP | 제어권 |
|-----|--------|--------|
| **Local (localhost:3000)** | 192.168.x.x (내부) 또는 ISP IP | 개발자 ISP |
| **Vercel (prod)** | Vercel의 공개 IP (동적) | Vercel 관리 |
| **EC2** | Elastic IP (고정) | AWS 관리 |

**문제**: Vercel은 **여러 개의 IP를 동적으로 사용**하므로 모두 등록하기 어렵습니다.

#### 3. **IP 등록 위치**

```
https://smartsms.aligo.in/admin/
└─ [관리] → [발송 설정] → [IP 관리]
   ├─ 현재 등록된 IP 목록 보기
   ├─ IP 추가
   └─ IP 삭제
```

### 해결 방법

#### 옵션 A: **Aligo 대시보드에서 IP 화이트리스트 추가 (권장)**

1. https://smartsms.aligo.in/admin/ 로그인
2. [관리] → [발송 설정] → [IP 관리]
3. **[IP 추가]** 클릭
4. 현재 서버의 공개 IP 입력 및 저장

**Vercel 배포 환경의 경우:**
- Vercel은 공개 IP 문서화 안 함
- **임시 방법**: 로컬에서 `curl https://api.ipify.org` 실행해 현재 IP 확인 → 추가

#### 옵션 B: **현재 IP 자동 감지 API 구현**

```typescript
// src/lib/detect-server-ip.ts
export async function detectPublicIP(): Promise<string> {
  try {
    const res = await fetch('https://api.ipify.org?format=json', { 
      signal: AbortSignal.timeout(5000) 
    });
    const data = await res.json() as { ip: string };
    return data.ip;
  } catch {
    return 'UNKNOWN';
  }
}
```

#### 옵션 C: **Aligo "IP 제한 해제" 요청 (비권장)**

- Aligo 고객지원팀에 연락
- "모든 IP 허용" 설정으로 변경 요청
- **보안 위험**: 누구나 API 호출 가능

### 테스트: 현재 IP 확인

```bash
# 터미널에서 실행 (로컬)
curl https://api.ipify.org
# 출력: 123.123.123.123

# Vercel 배포 후 로그 확인
# → 로그에서 "발송 IP" 정보 추출

# Node.js에서 확인
node -e "require('dns').lookup(require('os').hostname(), (err, add) => console.log(add))"
```

---

## 현재 구현 분석

### 파일 구조

```
D:\mabiz-crm\
├── src/lib/
│   ├── aligo.ts                        (v1 - 기존 구현)
│   ├── aligo/
│   │   └── client.ts                   (v2 - 신규 구현, 재시도 로직 포함)
│   ├── aligo-sms-service.ts            (관리자 테스트 API)
│   └── sms-queue.ts                    (Redis 큐 기반 비동기 발송)
├── src/app/api/
│   ├── contacts/[id]/sms/route.ts      (수동 발송)
│   ├── cron/*/route.ts                 (자동 발송 Cron)
│   └── admin/sms/test-send/route.ts    (관리자 테스트)
└── src/app/(dashboard)/settings/sms/page.tsx
    └── (개인/조직 SMS 설정 UI)
```

### 1. src/lib/aligo.ts (v1 레거시)

**현황**: 기본 발송 기능만 제공

**주요 함수**:
- `sendSms()`: 단일 발송 (재시도 없음)
- `resolveUserSmsConfig()`: 개인 → 조직 → env 순 설정 해석
- `verifySenderNumber()`: 발신번호 검증
- `sendKakaoAlimtalk()`: 카카오 알림톡
- `sendByChannel()`: SMS/EMAIL/KAKAO 통합 발송

**한계**:
- 배치 발송 미지원
- 재시도 로직 없음
- 배송 상태 추적 미지원

### 2. src/lib/aligo/client.ts (v2 신규)

**현황**: 재시도 + 배치 + 상태 추적 제공

**주요 함수**:
- `sendSms()`: 단일 발송 + 재시도 (exponential backoff)
- `sendSmsBatch()`: 최대 1000건 배치 발송
- `getDeliveryStatus()`: 배송 상태 추적
- `verifySenderNumber()`: 발신번호 검증

**장점**:
```typescript
// 재시도 로직
for (attempt = 1; attempt <= 3; attempt++) {
  if (RETRYABLE_CODES.has(resultCode)) {
    await delay(2^(attempt-1) * 1000); // 1초 → 2초 → 4초
    continue;
  }
}
```

**배치 처리**:
```typescript
// SMS/LMS 자동 분리
const smsReqs = requests.filter(r => r.messageType !== 'LMS');
const lmsReqs = requests.filter(r => r.messageType === 'LMS');
// 각각 1000건씩 청크로 발송
```

### 3. src/lib/sms-queue.ts (비동기 발송)

**목적**: 동기 발송 시 UI 블로킹 방지

**메커니즘**:
```
사용자 발송 버튼
  ↓
Upstash Redis 큐에 추가
  ↓
Cron 또는 Worker에서 처리
  ↓
Aligo API 호출
  ↓
SmsLog 기록
```

**코드**:
```typescript
async function recordSmsLog(params) {
  const { addSmsLog } = await import("@/lib/sms-queue");
  await addSmsLog({
    organizationId,
    contactId,
    phone,
    msg,
    status: "SENT" | "FAILED" | "BLOCKED",
    resultCode: String(result_code),
    msgId: data.msg_id,
  });
}
```

### 4. resolveUserSmsConfig 흐름

```typescript
export async function resolveUserSmsConfig(
  organizationId: string,
  userId?: string
): Promise<AligoConfig | null> {
  // 1. 개인 SMS 설정 (UserSmsConfig)
  if (userId) {
    const userCfg = await prisma.userSmsConfig.findUnique({
      where: { userId_organizationId: { userId, organizationId } }
    });
    if (userCfg?.isActive && userCfg.senderVerified) {
      // ✅ 복호화 후 사용
      const key = decrypt(userCfg.aligoKeyEncrypted, "SMS_ENCRYPT_KEY");
      return { key, userId: userCfg.aligoUserId, sender: userCfg.senderPhone };
    }
  }

  // 2. 조직 SMS 설정 (OrgSmsConfig)
  const orgCfg = await prisma.orgSmsConfig.findUnique({
    where: { organizationId }
  });
  if (orgCfg?.isActive) {
    const orgKey = decrypt(orgCfg.aligoKey, "SMS_ENCRYPT_KEY");
    return { key: orgKey, userId: orgCfg.aligoUserId, sender: orgCfg.senderPhone };
  }

  // 3. 환경변수 Fallback
  const key = process.env.ALIGO_API_KEY;
  const userId = process.env.ALIGO_USER_ID;
  const sender = process.env.ALIGO_SENDER_PHONE;
  if (key && userId && sender) return { key, userId, sender };

  return null;
}
```

**중요**: 미검증 발신번호(senderVerified=false)는 **조직/env로 폴백**

---

## 권장 개선사항

### P0: IP 인증 오류 해결 (즉시)

```typescript
// src/lib/get-server-ip.ts (신규)
export async function getServerPublicIP(): Promise<string> {
  const cacheKey = 'server_public_ip';
  const cached = await redis.get(cacheKey);
  
  if (cached) return cached as string;
  
  try {
    const res = await fetch('https://api.ipify.org?format=json', {
      signal: AbortSignal.timeout(5000)
    });
    const data = await res.json() as { ip: string };
    
    // 1시간 캐시
    await redis.setex(cacheKey, 3600, data.ip);
    return data.ip;
  } catch {
    logger.error('[getServerPublicIP] 실패');
    return 'UNKNOWN';
  }
}
```

**사용처**:
```typescript
// src/app/api/health/route.ts (신규)
export async function GET() {
  const ip = await getServerPublicIP();
  return Response.json({
    status: 'ok',
    serverPublicIP: ip,
    message: `이 IP를 Aligo 화이트리스트에 추가하세요: ${ip}`
  });
}
```

**배포 후 실행**:
```bash
curl https://mabizcruisedot.com/api/health
# 출력: {"status":"ok","serverPublicIP":"52.1.2.3"}
# → Aligo 대시보드에서 52.1.2.3 추가
```

### P1: 에러 모니터링 강화

```typescript
// src/lib/aligo-error-handler.ts (신규)
export function formatAligoError(code: number): {
  category: string;
  userMessage: string;
  retryable: boolean;
  suggestion: string;
} {
  const mapping: Record<number, any> = {
    1: { category: 'SUCCESS', userMessage: '발송 성공', retryable: false },
    -1: { category: 'NETWORK', userMessage: '네트워크 오류', retryable: true, suggestion: '재시도 중' },
    -9: { category: 'TIMEOUT', userMessage: '발송 지연', retryable: true, suggestion: '서버 상태 확인' },
    -99: { category: 'AUTH', userMessage: '인증 실패', retryable: false, suggestion: 'API 키 확인' },
    -107: { category: 'IP_BLOCKED', userMessage: 'IP 인증 필요', retryable: false, suggestion: `현재 IP를 Aligo 화이트리스트에 추가하세요. 현재 IP 확인: ${getServerPublicIP()}` },
    -108: { category: 'SENDER_BLOCKED', userMessage: '발신번호 미등록', retryable: false, suggestion: '설정 → 문자 → 발신번호 검증 클릭' },
  };
  
  return mapping[code] || { 
    category: 'UNKNOWN', 
    userMessage: `알 수 없는 오류 (코드: ${code})`, 
    retryable: false,
    suggestion: 'Aligo 고객지원 문의'
  };
}
```

### P2: 배치 발송 마이그레이션

**현재**: `src/lib/aligo.ts` 사용 (배치 미지원)  
**목표**: `src/lib/aligo/client.ts` 로 통합

```typescript
// 마이그레이션 단계
// 1. v2 client.ts에서 AligoClient 확장
// 2. 기존 sendSms 호출 → new AligoClient().sendSms 대체
// 3. 대량 발송 → sendSmsBatch 사용
// 4. 재시도 로직 자동 처리
```

### P3: 메시지 길이 자동 최적화

```typescript
// src/lib/message-optimizer.ts (신규)
export function optimizeMessage(msg: string, maxSmsByte = 90): {
  type: 'SMS' | 'LMS';
  truncated: boolean;
  finalMsg: string;
} {
  const bytes = Buffer.byteLength(msg, 'utf-8');
  
  if (bytes <= maxSmsByte) {
    return { type: 'SMS', truncated: false, finalMsg: msg };
  }
  
  // LMS로 자동 전환
  if (bytes <= 2000) {
    return { type: 'LMS', truncated: false, finalMsg: msg };
  }
  
  // 초과 시 절단
  const truncated = msg.substring(0, Math.floor(2000 / 3)) + '...';
  return { type: 'LMS', truncated: true, finalMsg: truncated };
}
```

---

## 통합 테스트 가이드

### 1. 로컬 테스트 (환경변수 필요)

```bash
# .env.local 확인
grep "ALIGO_" .env.local

# 테스트 실행
npm run test:aligo
```

### 2. 관리자 테스트 UI

**경로**: `Settings → SMS → [테스트 발송]`

```typescript
// src/app/(dashboard)/settings/sms/page.tsx 라인 149
const test = async () => {
  if (!testPhone) return;
  setTesting(true);
  const res = await fetch("/api/admin/sms/test-send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      phone: testPhone,
      message: "테스트 메시지입니다.",
    }),
  });
  const data = await res.json();
  setMsg({ type: data.ok ? "ok" : "err", text: data.message });
  setTesting(false);
};
```

### 3. IP 인증 테스트

```bash
# 현재 서버 IP 확인
curl https://api.ipify.org

# Vercel 배포 후 테스트
curl https://mabizcruisedot.com/api/admin/sms/test-send \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"phone":"01012345678","message":"테스트"}'

# 응답:
# {"ok":true,"msg_id":"..."}         ← 성공 (IP 등록됨)
# {"ok":false,"message":"-107: ..."}  ← IP 미등록
```

### 4. 배송 상태 추적

```typescript
// src/app/api/admin/sms/status/[msgId]/route.ts (신규)
import { AligoClient } from "@/lib/aligo/client";

export async function GET(
  req: Request,
  { params }: { params: { msgId: string } }
) {
  const client = new AligoClient({
    apiKey: process.env.ALIGO_API_KEY!,
    userId: process.env.ALIGO_USER_ID!,
    senderPhone: process.env.ALIGO_SENDER_PHONE!,
  });
  
  const status = await client.getDeliveryStatus({ msgId: params.msgId });
  return Response.json(status);
}
```

---

## 체크리스트: 배포 전 필수 확인

- [ ] **IP 화이트리스트**: Aligo 대시보드에서 현재 서버 IP 등록 확인
- [ ] **발신번호 검증**: `senderVerified = true` 확인
- [ ] **API 키**: `.env.local` 및 Vercel 환경변수에서 일치 확인
- [ ] **메시지 길이**: 90자 초과 시 LMS 자동 전환 확인
- [ ] **수신거부**: `SmsOptOut` 테이블에서 거부 목록 확인
- [ ] **로깅**: `SmsLog` 기록 자동 저장 확인
- [ ] **에러 처리**: `-107` 오류 시 사용자 메시지 명확함
- [ ] **재시도**: 타임아웃/네트워크 오류 시 자동 재시도 확인

---

## 참고 링크

- [Aligo 공식 API 문서](https://smartsms.aligo.in/admin/api/spec.html)
- [Aligo 대시보드](https://smartsms.aligo.in/admin/)
- [마비즈 CRM 발송 로그](http://localhost:3000/dashboard/messages)

---

**문의**: hyeseon28@gmail.com | 마비즈 CRM 개발팀
