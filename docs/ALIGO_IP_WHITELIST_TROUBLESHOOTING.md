# Aligo IP 화이트리스트 문제 해결 가이드

**작성일**: 2026-06-08  
**오류**: -107 (발송 IP 미인증)  
**상태**: 현재 마비즈 CRM Vercel 배포 환경에서 발생 중

---

## 🔴 문제 증상

### 발생 메시지
```json
{
  "result_code": -107,
  "message": "발송 IP가 인증되지 않은 발송 IP입니다"
}
```

### 환경
- **로컬 (localhost:3000)**: 정상 작동 (로컬 ISP IP)
- **Vercel 배포**: -107 오류 발생 (Vercel IP가 미등록)

---

## 📚 IP 인증의 의미

### 1. 발송 IP란?

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  HTTP Client                                           │
│  (웹 브라우저, 모바일 앱)                                │
│                                                         │
│  Source IP: 203.253.xxx.xxx (사용자 ISP)              │
│                                                         │
└────────────┬──────────────────────────────────────────┘
             │
             │ HTTPS Request
             │
┌────────────▼──────────────────────────────────────────┐
│                                                        │
│  Mabiz CRM Server                                     │
│  (Vercel / EC2)                                       │
│                                                        │
│  Public IP: 52.1.2.3                                  │
│  ← **이 IP가 "발송 IP"**                               │
│                                                        │
│  /api/contacts/[id]/sms                              │
│  ↓                                                     │
│  sendSms({ config, receiver, msg })                  │
│                                                        │
└────────────┬──────────────────────────────────────────┘
             │
             │ HTTPS Request
             │ Source IP: 52.1.2.3 ← Aligo에서 확인
             │
┌────────────▼──────────────────────────────────────────┐
│                                                        │
│  Aligo API (apis.aligo.in)                           │
│                                                        │
│  IP 화이트리스트 확인:                                 │
│  - 등록된 IP: [203.253.1.1, 52.1.2.3, ...]           │
│  - 요청 IP: 52.1.2.3                                  │
│  - 결과: ✅ 일치 → 발송 성공                           │
│  또는                                                  │
│  - 결과: ❌ 미일치 → -107 오류                        │
│                                                        │
└─────────────────────────────────────────────────────────┘
```

**중요**: 사용자 IP가 아닌 **서버 IP**이 인증됨

### 2. 마비즈 인프라별 발송 IP

| 환경 | 서버 | IP 형태 | 변경 여부 | 등록 방법 |
|------|------|--------|---------|----------|
| **로컬** | localhost | `192.168.x.x` 또는 ISP IP | 불안정 | 개발 단계에서 불필요 |
| **Vercel** | CDN | 동적 (여러 개) | **매번 변경** | 문제 원인 |
| **EC2** | AWS | Elastic IP (고정) | **변경 없음** | IP 등록 후 안정 |
| **클라우드 런** | GCP | 동적 | **매번 변경** | 문제 원인 |

---

## 🔍 문제 진단

### Step 1: 현재 발송 IP 확인

#### 방법 A: 로컬 테스트
```bash
# 로컬에서 현재 ISP IP 확인
curl https://api.ipify.org
# 출력: 203.253.1.1
```

#### 방법 B: Vercel 배포 후 확인
```bash
# Vercel 배포 후 아래 API 호출
curl https://mabizcruisedot.com/api/health

# 응답 (구현 필요):
# {
#   "status": "ok",
#   "serverPublicIP": "52.1.2.3"
# }
```

#### 방법 C: 에러 로그 분석
```typescript
// src/lib/aligo.ts 라인 131
logger.log("[Aligo] 발송 결과", {
  code: data.result_code,  // -107이면 IP 미인증
  phone: receiver.substring(0, 4) + "***",
});

// 로그: {"code":-107,"phone":"0101***"}
// → IP 화이트리스트 확인 필요
```

### Step 2: Aligo 대시보드 확인

```
1. https://smartsms.aligo.in/admin/ 로그인
   └─ 계정: hyeseon28 / 비밀번호: [별도]

2. [관리] 메뉴 → [발송 설정] 또는 [보안 설정]
   └─ IP 관리 섹션 찾기

3. 현재 등록된 IP 목록 확인
   예시:
   ├─ 203.253.1.1 (로컬 ISP, 2024-01-15)
   ├─ 203.253.2.2 (로컬 ISP, 구형)
   └─ 52.1.2.3 (Vercel, 2026-06-08) ← 이것이 필요함
```

### Step 3: IP가 등록되지 않은 이유

| 원인 | 해결책 |
|------|--------|
| **처음 Vercel 배포** | 배포 직후 IP 등록 필요 |
| **Vercel IP 변경** | 매번 새로운 IP 생성 가능 |
| **EC2 재시작** | Elastic IP 재할당 가능 |
| **여러 배포 환경** | 각 환경별 IP 모두 등록 |

---

## ✅ 해결 방법 (3가지)

### 옵션 A: 현재 IP 자동 감지 및 등록 (권장)

**Step 1: Health Check API 추가**
```typescript
// src/app/api/health/route.ts (신규)
import { getServerPublicIP } from "@/lib/get-server-ip";

export async function GET() {
  const ip = await getServerPublicIP();
  
  return Response.json({
    status: "ok",
    serverPublicIP: ip,
    aligoSetupInstructions: {
      step1: "https://smartsms.aligo.in/admin/ 로그인",
      step2: "[관리] → [발송 설정] → [IP 관리]",
      step3: "[IP 추가] 클릭",
      step4: `아래 IP 입력: ${ip}`,
      step5: "저장 완료",
      step6: "마비즈 CRM 다시 접속해서 테스트",
    },
  });
}
```

**Step 2: getServerPublicIP 함수 추가**
```typescript
// src/lib/get-server-ip.ts (신규)
import { redis } from "@/lib/redis";
import { logger } from "@/lib/logger";

/**
 * 마비즈 CRM 서버의 공개 IP 조회
 * - 캐시: 1시간
 * - Timeout: 5초
 */
export async function getServerPublicIP(): Promise<string> {
  const cacheKey = "server_public_ip";
  
  try {
    // 1. Redis 캐시 확인
    const cached = await redis.get(cacheKey);
    if (cached) {
      logger.log("[getServerPublicIP] 캐시 사용", { ip: cached });
      return cached as string;
    }
    
    // 2. API 호출
    const response = await fetch("https://api.ipify.org?format=json", {
      signal: AbortSignal.timeout(5000),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = (await response.json()) as { ip: string };
    const ip = data.ip;
    
    // 3. 캐시 저장 (1시간)
    await redis.setex(cacheKey, 3600, ip);
    logger.log("[getServerPublicIP] 신규 조회", { ip });
    
    return ip;
  } catch (error) {
    logger.error("[getServerPublicIP] 실패", {
      error: error instanceof Error ? error.message : String(error),
    });
    
    // Fallback: 환경변수 (수동 설정)
    const fallback = process.env.SERVER_PUBLIC_IP;
    if (fallback) {
      logger.warn("[getServerPublicIP] Fallback IP 사용", { ip: fallback });
      return fallback;
    }
    
    return "UNKNOWN";
  }
}
```

**Step 3: 배포 후 실행**
```bash
# Vercel 배포 완료 후
curl https://mabizcruisedot.com/api/health

# 응답:
# {
#   "status": "ok",
#   "serverPublicIP": "52.1.2.3",
#   "aligoSetupInstructions": {
#     "step1": "https://smartsms.aligo.in/admin/ 로그인",
#     ...
#     "step4": "아래 IP 입력: 52.1.2.3"
#   }
# }
```

**Step 4: Aligo 대시보드에서 IP 등록**
```
1. https://smartsms.aligo.in/admin/ 로그인
2. [관리] → [발송 설정] → [IP 관리]
3. [IP 추가] 클릭
4. "52.1.2.3" 입력
5. 저장
6. 마비즈 CRM에서 SMS 테스트 발송 → 성공 확인
```

### 옵션 B: 수동 IP 등록 (단기 해결)

**Aligo 대시보드에서 직접 추가**
```
1. https://smartsms.aligo.in/admin/
   계정: hyeseon28
   
2. [관리] 메뉴
   
3. [발송 설정] 또는 [보안]
   
4. [IP 관리] 클릭
   
5. [IP 추가] 버튼
   
6. 현재 Vercel IP 입력
   예: 52.1.2.3
   
7. [저장] 클릭
   
8. 확인 메시지:
   "IP가 등록되었습니다."
```

**IP 찾기 (모른다면)**:
```bash
# 로컬 PC에서
curl https://api.ipify.org

# 또는 웹에서
https://www.myip.com/

# 또는 Vercel 로그에서 조회
# (next-logs에서 에러 메시지의 요청 IP 추출)
```

### 옵션 C: Aligo 고객지원팀 연락 (장기 해결)

**요청 내용**:
```
제목: Vercel 환경에서 동적 IP 지원 요청

본문:
- 마비즈 CRM이 Vercel (CDN)에 배포됨
- Vercel은 매번 다른 IP로 API 호출
- 모든 Vercel IP를 사전 등록하기 불가능
- 요청: "모든 IP 허용" 또는 "Vercel IP 대역 일괄 허용"

Aligo 계정: hyeseon28
연락처: hyeseon28@gmail.com
```

**Aligo 고객지원**: 
- 이메일: support@aligo.in
- 전화: 1644-0001

---

## 🧪 테스트 및 검증

### Test 1: Health Check 엔드포인트 확인

```bash
# 로컬에서 테스트
curl http://localhost:3000/api/health
# 응답: {"status":"ok","serverPublicIP":"203.253.1.1",...}

# Vercel 배포 후 테스트
curl https://mabizcruisedot.com/api/health
# 응답: {"status":"ok","serverPublicIP":"52.1.2.3",...}
```

### Test 2: SMS 발송 테스트

**관리자 UI**:
```
Settings (설정) → SMS → [테스트 발송]
├─ 수신번호: 010-1234-5678
├─ 메시지: "테스트 메시지"
└─ [발송] 버튼 클릭
```

**예상 결과**:
- ✅ **IP 등록됨**: `{"ok":true,"msg_id":"20260608..."}`
- ❌ **IP 미등록**: `{"ok":false,"message":"-107: 발송 IP 미인증"}`

### Test 3: 로그 확인

```bash
# Vercel 로그 확인
vercel logs

# 또는 마비즈 대시보드
CRM → [메시지] → [발송 내역]
├─ 상태: SENT / FAILED
├─ 결과 코드: 1 / -107 / ...
└─ 메시지: "발송 성공" / "발송 IP 미인증" / ...
```

---

## 📋 체크리스트

### 배포 전
- [ ] 로컬에서 SMS 발송 테스트 성공
- [ ] `/api/health` 엔드포인트 구현 완료
- [ ] `getServerPublicIP()` 함수 구현 완료

### 배포 후 (1순위)
- [ ] `https://mabizcruisedot.com/api/health` 호출
- [ ] 응답에서 `serverPublicIP` 확인 (예: "52.1.2.3")
- [ ] Aligo 대시보드에서 이 IP 등록
- [ ] SMS 테스트 발송 성공 확인

### 배포 후 (2순위)
- [ ] 일일 SMS 발송 모니터링 시작
- [ ] `-107` 오류 재발 시 새 IP 확인
- [ ] Aligo 고객지원팀에 동적 IP 지원 요청

---

## 🚨 자주 묻는 질문

### Q1: 왜 로컬에서는 성공하는데 Vercel에서 실패하나요?

**A**: 로컬 ISP IP와 Vercel IP가 다르기 때문입니다.
```
로컬: 203.253.1.1 (등록됨) → 성공
Vercel: 52.1.2.3 (미등록) → -107 오류
```

### Q2: 매번 IP가 변경되지 않나요?

**A**: Vercel은 일반적으로 같은 IP 대역을 사용하지만, 변경될 수 있습니다.
- **일일 기준**: 대부분 같은 IP 사용
- **주간 기준**: 1-2회 변경 가능
- **캐싱**: `getServerPublicIP()` 1시간 캐시로 충분

### Q3: EC2나 GCP로 마이그레이션하면?

**A**: 더 나습니다.
- **EC2 + Elastic IP**: IP 고정 → IP 등록 후 영구 사용
- **Aligo 추천**: 고정 IP 사용 권장

### Q4: 보안 위험은 없나요?

**A**: IP 화이트리스트는 **기본적인 보안**입니다.
```
보안 체인:
1. IP 화이트리스트 (1차 방어)
2. API Key 인증 (2차 방어)
3. User/Org 검증 (3차 방어)
```
IP만으로 충분하지 않으므로 API 키도 안전하게 보관하세요.

---

## 📞 지원 채널

| 문제 | 연락처 |
|------|--------|
| Aligo API 오류 | support@aligo.in (Aligo 고객지원) |
| Vercel 배포 관련 | vercel.com/support (Vercel 지원) |
| 마비즈 CRM 기술 | hyeseon28@gmail.com |

---

**마지막 업데이트**: 2026-06-08  
**상태**: 현재 마비즈는 이 문제로 발송 불가 상태
