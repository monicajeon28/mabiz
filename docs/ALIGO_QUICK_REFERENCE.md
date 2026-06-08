# Aligo API 빠른 참조 (Quick Reference)

**용도**: 개발 중 빠르게 참조할 수 있는 치트시트  
**형식**: 코드 + 테이블 + 플로우

---

## 🚀 5분 요약

### Aligo란?
- **SMS/LMS** 대량 발송 플랫폼
- **한국** 최대 규모
- **API 기반** 개발 환경 제공

### 마비즈 현황
| 항목 | 값 |
|-----|-----|
| 계정 | hyeseon28 |
| API Key | `ykfcblofawtxt5b3gf7iyey30iufinqr` |
| 발신번호 | `01032893800` (승인됨) |
| 현재 오류 | -107 (IP 미인증) |
| 해결책 | Vercel IP를 Aligo 화이트리스트에 등록 |

---

## 📡 API 엔드포인트

### 1. 발송 API
```bash
POST https://apis.aligo.in/send/

# 파라미터:
user_id=hyeseon28
key=ykfcblofawtxt5b3gf7iyey30iufinqr
sender=01032893800
receiver=01012345678
msg=메시지내용
msg_type=SMS  # SMS|LMS
title=제목    # LMS일 때만 필수

# 응답:
{
  "result_code": 1,           # 1=성공, 음수=실패
  "message": "Success",
  "msg_id": "202606081234567"
}
```

### 2. 상태 조회 API
```bash
POST https://apis.aligo.in/info/

# 파라미터:
user_id=hyeseon28
key=ykfcblofawtxt5b3gf7iyey30iufinqr
msg_id=202606081234567

# 응답:
{
  "result_code": 1,
  "status": "2",           # 1=발송, 2=전달, 3=실패, 4=반송, 5=대기
  "statustext": "전달됨"
}
```

### 3. 발신번호 검증 API
```bash
POST https://apis.aligo.in/sender/

# 파라미터:
user_id=hyeseon28
key=ykfcblofawtxt5b3gf7iyey30iufinqr

# 응답:
{
  "result_code": 1,
  "list": [
    { "telnum": "01032893800", "flag": "1" }
  ]
}
```

---

## 📊 응답 코드 (Result Code)

### 성공
```
1  → 발송 성공 ✅
0  → 카카오 알림톡 성공 ✅
```

### 인증 오류
```
-99   → API 키/아이디 오류 (env 확인)
-106  → API 키 만료 (재발급 필요)
-107  → IP 화이트리스트 미등록 ⚠️ (현재 마비즈 문제)
-108  → 발신번호 미등록 (검증 필요)
```

### 한도 오류
```
-15  → 발송 예산 부족 (충전)
-16  → 일일 한도 초과 (내일 재시도)
-17  → 시간당 한도 초과 (5분 후 재시도)
```

### 포맷 오류
```
-20  → 메시지 빈 상태
-21  → 메시지 길이 초과 (SMS 90자, LMS 2000바이트)
-22  → 수신번호 형식 오류
-23  → 발신번호 형식 오류
```

### 네트워크 오류
```
-1   → 일반 오류 (재시도)
-9   → 타임아웃 (재시도)
10   → API 타임아웃 (재시도)
11   → 서버 오류 (재시도)
12   → 과부하 (재시도)
```

---

## 💻 현재 코드 위치

### 발송 함수
```typescript
// src/lib/aligo.ts (v1 - 기본)
sendSms(params: SendSmsParams): Promise<AligoResponse>

// src/lib/aligo/client.ts (v2 - 배치+재시도)
new AligoClient(config).sendSms(request): Promise<AligoSendResponse>
new AligoClient(config).sendSmsBatch(requests): Promise<AligoSendResponse>
```

### 설정 함수
```typescript
// src/lib/aligo.ts
resolveUserSmsConfig(orgId, userId?): Promise<AligoConfig | null>
// 흐름: 개인 설정 → 조직 설정 → 환경변수
```

### SMS 발송 경로
```
src/app/api/contacts/[id]/sms/route.ts
  ↓
resolveUserSmsConfig(orgId, userId)
  ↓
sendSms({ config, receiver, msg, ... })
  ↓
fetch("https://apis.aligo.in/send/")
  ↓
recordSmsLog() [Redis 큐]
```

---

## 🔧 문제 해결

### -107 오류 (IP 미인증)

**증상**:
```json
{"result_code": -107, "message": "발송 IP가 인증되지 않은 발송 IP입니다"}
```

**진단**:
```bash
# 1. 현재 IP 확인
curl https://api.ipify.org
# 출력: 52.1.2.3

# 2. Aligo 대시보드 확인
https://smartsms.aligo.in/admin/
→ [관리] → [발송 설정] → [IP 관리]
→ 52.1.2.3이 등록되어 있나?

# 없으면 [IP 추가] 클릭 → 52.1.2.3 입력 → 저장
```

**결과**:
```bash
# 등록 후 테스트
curl -X POST "https://apis.aligo.in/send/" \
  -d "user_id=hyeseon28" \
  -d "key=ykfcblofawtxt5b3gf7iyey30iufinqr" \
  -d "sender=01032893800" \
  -d "receiver=01012345678" \
  -d "msg=테스트" \
  -d "msg_type=SMS"

# 응답 1: 성공
{"result_code":1,"message":"Success","msg_id":"..."}

# 응답 2: 여전히 실패
{"result_code":-107,...} → IP가 여전히 미등록 또는 캐시 문제
```

### -99 오류 (인증 실패)

**진단**:
```bash
# 1. 환경변수 확인
grep ALIGO .env.local

# 예상:
ALIGO_API_KEY=ykfcblofawtxt5b3gf7iyey30iufinqr
ALIGO_USER_ID=hyeseon28
ALIGO_SENDER_PHONE=01032893800

# 2. Aligo 대시보드에서 확인
https://smartsms.aligo.in/admin/
→ [설정] → [API 키 관리]
→ 현재 활성 키 확인

# 다르면 새 키로 업데이트
```

### -21 오류 (메시지 길이 초과)

**수정**:
```typescript
// 자동 조정
const msg = "긴 메시지...";
const bytes = Buffer.byteLength(msg, "utf-8");

const msgType = bytes <= 90 ? "SMS" : "LMS";
// SMS: 90바이트 (한글 45자)
// LMS: 2000바이트 (한글 1000자)
```

---

## 🧪 테스트 방법

### 관리자 UI 테스트
```
CRM → Settings (설정) → SMS → [테스트 발송]
├─ 수신번호: 010-1234-5678
├─ 메시지: "테스트 메시지"
└─ [발송] 버튼
```

### API 직접 호출
```bash
# 로컬
curl http://localhost:3000/api/contacts/CONTACT_ID/sms \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"message":"테스트"}'

# Vercel
curl https://mabizcruisedot.com/api/contacts/CONTACT_ID/sms \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"message":"테스트"}'
```

### 발송 로그 확인
```
CRM → Messages (메시지) → 발송 내역
├─ 상태: SENT / FAILED / BLOCKED
├─ 결과 코드: 1 / -107 / ...
└─ 메시지: "발송 성공" / "발송 IP 미인증" / ...
```

---

## 📈 성능 팁

### 1. 배치 발송 사용
```typescript
// ❌ 느림 (개별 호출)
for (const phone of phones) {
  await sendSms({ config, receiver: phone, msg });
}

// ✅ 빠름 (배치)
const client = new AligoClient(config);
await client.sendSmsBatch(
  phones.map(phone => ({ receiver: phone, message: msg }))
);
// API 호출 1회 vs N회
```

### 2. 재시도 로직
```typescript
// ✅ AligoClient 사용 (자동 재시도)
const client = new AligoClient(config);
const result = await client.sendSms(request);  // 최대 3회 재시도

// ❌ sendSms 직접 (재시도 없음)
const result = await sendSms(params);  // 실패 시 그냥 실패
```

### 3. 메시지 캐싱
```typescript
// Redis 캐시로 중복 발송 방지
const cacheKey = `sms:${contactId}:${msgId}`;
const cached = await redis.get(cacheKey);
if (cached) return cached;

const result = await sendSms(...);
await redis.setex(cacheKey, 3600, JSON.stringify(result));
return result;
```

---

## 🛡️ 보안 체크리스트

- [ ] API 키를 `.env.local`에 저장 (코드에 포함 금지)
- [ ] 암호화: `UserSmsConfig.aligoKeyEncrypted` (복호화 필수)
- [ ] 발신번호 검증: `senderVerified=true` (미검증 차단)
- [ ] 수신거부 확인: `isOptedOut()` 체크
- [ ] IP 화이트리스트: Aligo 대시보드에서 서버 IP 등록
- [ ] Rate limit: 시간당 발송량 제한 (운영팀과 협의)

---

## 📞 연락처

| 문제 | 연락처 |
|------|--------|
| Aligo API 오류 | support@aligo.in |
| Vercel 배포 | vercel.com/support |
| 마비즈 CRM | hyeseon28@gmail.com |

---

## 📚 상세 문서

- **ALIGO_API_INTEGRATION_GUIDE.md** - API 완전 스펙
- **ALIGO_CURRENT_ISSUES_ANALYSIS.md** - 현재 코드 문제
- **ALIGO_IP_WHITELIST_TROUBLESHOOTING.md** - IP 인증 문제

---

**마지막 업데이트**: 2026-06-08
