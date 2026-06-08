# Vercel + Aligo SMS 환경변수 설정 가이드

**작성일**: 2026-06-08  
**버전**: 1.0  
**대상**: 마비즈 CRM 배포 관리자

---

## 📋 개요

이 문서는 마비즈 CRM을 Vercel에 배포할 때 Aligo SMS API를 포함한 환경변수를 설정하는 완전한 가이드입니다.

### 핵심 목표
1. **보안**: API 키를 안전하게 관리 (로컬 개발과 프로덕션 분리)
2. **자동화**: Vercel 대시보드에서 직관적으로 설정
3. **검증**: 배포 후 SMS 발송 기능 확인

---

## 🎯 설정 요약 (5분 완료 가능)

필수 환경변수 4개:
- `ALIGO_USER_ID` — Aligo 계정 ID (공용)
- `ALIGO_API_KEY` — Aligo API 키 (공용, 비밀)
- `ALIGO_SENDER_PHONE` — 발신번호 (공용, 예: 0215114560)
- `CRON_SECRET` — Cron Job 인증 토큰 (프로덕션만)

---

## 1️⃣ 사전 준비 (5분)

### 1.1 Aligo 계정 확인

#### 1.1.1 Aligo 대시보드 접속
1. [Aligo 공식 사이트](https://aligo.in) 방문
2. 좌측 메뉴 → **[설정]** 클릭
3. **[API]** 탭 선택

#### 1.1.2 필요한 정보 복사
```
┌─ Aligo 대시보드 ─────────────────────┐
│                                      │
│  설정 → API                          │
│  ├─ User ID (또는 API Key)          │ ← 복사 (예: user123abc)
│  ├─ API Key (또는 Secret Key)       │ ← 복사 (예: abcd1234efgh5678)
│  └─ 발신자 번호 관리                │
│      └─ 승인된 발신번호 확인        │ ← 확인 (예: 0215114560)
│                                      │
└──────────────────────────────────────┘
```

**⚠️ 주의**: 
- API Key는 절대 공개 저장소에 커밋하면 안 됨
- Aligo에서 Key 변경 시 Vercel도 즉시 업데이트 필요

### 1.2 발신번호 검증

발신번호가 Aligo에서 **승인됨** 상태인지 확인:
```
Aligo 대시보드 → 발신자 번호 관리
├─ 상태: ✅ 승인됨 (원래대로 진행)
├─ 상태: ⏳ 승인 대기 중 (2-4시간 대기 후 설정)
└─ 상태: ❌ 거부됨 (관리자에게 문의)
```

**발신번호 변경 방법** (필요한 경우):
1. Aligo 대시보드 → [발신자 번호 관리]
2. [+번호 추가] 클릭
3. 새 번호 입력 및 검증 완료 대기 (1-2시간)

---

## 2️⃣ Vercel 대시보드 설정 (10분)

### 2.1 프로젝트 선택

1. [Vercel 대시보드](https://vercel.com/dashboard) 접속
2. 좌측 메뉴에서 프로젝트 선택 (예: `mabizcruisedot`)

```
┌─ Vercel Dashboard ───────────────────┐
│                                      │
│  [< Deployments]                     │
│  Pro • mabizcruisedot               │ ← 프로젝트명
│                                      │
└──────────────────────────────────────┘
```

### 2.2 Settings 메뉴 열기

```
프로젝트 페이지 상단 탭:
┌─────────────┬──────────┬──────────┬──────────┐
│ Deployments │ Settings │ Analytics│ Monitors │
│             │   ← 클릭  │          │          │
└─────────────┴──────────┴──────────┴──────────┘
```

### 2.3 Environment Variables 섹션

Settings 페이지 좌측 메뉴:
```
Project Settings
├─ General
├─ Domains
├─ Environment Variables    ← 클릭
├─ Build & Development Settings
└─ ...
```

**클릭 후 화면:**
```
┌─ Environment Variables ──────────────────────────┐
│                                                  │
│  Environment                                    │
│  ☑ Production (checked)                        │
│  ☐ Preview                                     │
│  ☐ Development                                 │
│                                                  │
│  [+ Add New]  [Import .env]  [Download]        │
│                                                  │
│  현재 등록된 변수 목록:                         │
│  NAME                  VALUE                    │
│  ─────────────────────────────────────────     │
│  DATABASE_URL          postgresql://...        │
│  NODE_ENV              production              │
│  ...                                            │
│                                                  │
└──────────────────────────────────────────────────┘
```

---

## 3️⃣ 환경변수 추가 (4개 필수)

### 3.1 ALIGO_USER_ID

**[+ Add New]** 클릭 → 다음 정보 입력:

```
┌─ Add New Environment Variable ──────────────────┐
│                                                │
│ NAME:  ALIGO_USER_ID                          │
│                                                │
│ VALUE: user123abc                             │
│        (Aligo 대시보드에서 복사한 User ID)    │
│                                                │
│ ENVIRONMENTS: ☑ Production                    │
│              ☑ Preview  (선택사항)            │
│              ☑ Development (선택사항)         │
│                                                │
│ [Cancel]  [Save]                              │
│           ← 클릭                               │
└────────────────────────────────────────────────┘
```

**입력 값 예시:**
```
NAME:  ALIGO_USER_ID
VALUE: user123abc
```

**✅ 저장 후 확인:**
```
ALIGO_USER_ID  user***abc  [Edit] [Delete]
                (마스킹된 상태)
```

---

### 3.2 ALIGO_API_KEY

**[+ Add New]** 클릭 → 다음 정보 입력:

```
┌─ Add New Environment Variable ──────────────────┐
│                                                │
│ NAME:  ALIGO_API_KEY                          │
│                                                │
│ VALUE: abcd1234efgh5678ijkl9012mnop3456       │
│        (Aligo 대시보드에서 복사한 API Key)    │
│                                                │
│ ENVIRONMENTS: ☑ Production  (필수)            │
│              ☐ Preview                       │
│              ☐ Development                   │
│                                                │
│ 💡 Tip: Preview/Dev 환경에서 다른 키 사용    │
│         (테스트용 Aligo 서브 계정 권장)      │
│                                                │
│ [Cancel]  [Save]                              │
│           ← 클릭                               │
└────────────────────────────────────────────────┘
```

**입력 값 예시:**
```
NAME:  ALIGO_API_KEY
VALUE: abcd1234efgh5678ijkl9012mnop3456
```

**⚠️ 보안 주의:**
- 이 키는 외부에 노출되면 안 됨
- 정기적으로 Aligo에서 갱신 권장 (분기별)
- Preview 환경에는 테스트용 키 별도 사용 권장

---

### 3.3 ALIGO_SENDER_PHONE

**[+ Add New]** 클릭 → 다음 정보 입력:

```
┌─ Add New Environment Variable ──────────────────┐
│                                                │
│ NAME:  ALIGO_SENDER_PHONE                     │
│                                                │
│ VALUE: 0215114560                             │
│        또는                                    │
│        01012345678                            │
│        (Aligo 대시보드에서 승인된 발신번호)  │
│                                                │
│ ENVIRONMENTS: ☑ Production                    │
│              ☑ Preview                       │
│              ☑ Development                   │
│                                                │
│ [Cancel]  [Save]                              │
│           ← 클릭                               │
└────────────────────────────────────────────────┘
```

**입력 값 예시:**
```
NAME:  ALIGO_SENDER_PHONE
VALUE: 0215114560
```

**번호 형식:**
- 휴대폰: `01012345678` (11자리)
- 고정전화: `0215114560` (10자리)
- 고정전화: `02-1511-4560` (하이픈 포함 가능)

---

### 3.4 CRON_SECRET

**[+ Add New]** 클릭 → 다음 정보 입력:

```
┌─ Add New Environment Variable ──────────────────┐
│                                                │
│ NAME:  CRON_SECRET                            │
│                                                │
│ VALUE: vVExpRAGkmQFZO9MrPkiinI898LIs/...     │
│        (암호화된 토큰, 아래 생성 가이드 참고) │
│                                                │
│ ENVIRONMENTS: ☑ Production  (필수)            │
│              ☐ Preview                       │
│              ☐ Development                   │
│                                                │
│ [Cancel]  [Save]                              │
│           ← 클릭                               │
└────────────────────────────────────────────────┘
```

**CRON_SECRET 생성 방법** (로컬 터미널에서):

```powershell
# PowerShell (Windows)
$bytes = [System.Text.Encoding]::UTF8.GetBytes("$(New-Guid)")
$hash = [System.Security.Cryptography.SHA256]::Create().ComputeHash($bytes)
$secret = [Convert]::ToBase64String($hash)
Write-Host $secret
```

또는 온라인 도구 사용:
- [Random.org](https://www.random.org/strings/)에서 128자 랜덤 문자열 생성
- 또는 `.env.production`의 기존 값 복사

**예시:**
```
NAME:  CRON_SECRET
VALUE: vVExpRAGkmQFZO9MrPkiinI898LIs/mXBCoigYqBSAo=
```

---

## 4️⃣ 확인 & 배포 (5분)

### 4.1 설정 확인

Environment Variables 페이지에서 모두 등록되었는지 확인:

```
┌─ Environment Variables (Production) ──────────┐
│                                              │
│ NAME                      VALUE       ACTIONS│
│ ─────────────────────────────────────────── │
│ ALIGO_USER_ID             user***abc   ✏ ✕ │
│ ALIGO_API_KEY             abcd***3456  ✏ ✕ │
│ ALIGO_SENDER_PHONE        021511***0   ✏ ✕ │
│ CRON_SECRET               vVExp***SAo= ✏ ✕ │
│ DATABASE_URL              postgre***   ✏ ✕ │
│ NODE_ENV                  production   ✏ ✕ │
│ ...                                         │
│                                              │
│ [+ Add New]                                 │
└──────────────────────────────────────────────┘
```

**✅ 확인 사항:**
- [ ] 4개 모두 "Production" 환경에 표시되어 있나?
- [ ] 값이 마스킹된 상태로 표시되나? (보안)
- [ ] 오타가 없나?

### 4.2 Redeploy (재배포)

배포를 다시 실행하여 환경변수 적용:

**방법 1: Vercel 대시보드에서**
```
프로젝트 페이지 → [Deployments] 탭
↓
가장 최근 배포 항목 우측의 [···] 메뉴
↓
[Redeploy] 클릭
↓
"Redeploy?" 팝업 → [Redeploy] 확인
```

**방법 2: Git 푸시 (자동 배포)**
```powershell
# 로컬에서 변경사항 커밋
git add .
git commit -m "chore: update vercel env vars"
git push origin main
# → Vercel이 자동으로 배포 시작
```

**배포 진행 확인:**
```
┌─ Deployments ────────────────────────┐
│                                     │
│ 🔵 Building...                      │ ← 진행 중
│ mabizcruisedot • main               │
│ 2 minutes ago                       │
│ ┌─ Building           75%           │
│ └─ Deployment running...            │
│                                     │
│ ✅ Deployment (1h ago)             │
│ mabizcruisedot • main               │
│ Success (2m 34s)                   │
│                                     │
└─────────────────────────────────────┘
```

**배포 완료 확인:**
```
✅ 초록색 체크마크 표시
Deployment (just now)
Success (2m 15s)
```

---

## 5️⃣ SMS 발송 테스트 (5분)

배포 완료 후 SMS 기능이 정상 작동하는지 확인합니다.

### 5.1 테스트 SMS 발송 (관리자 권한)

#### URL
```
https://mabizcruisedot.com/api/admin/sms/test-send
```

#### 요청 방법 (cURL 사용)
```bash
curl -X POST https://mabizcruisedot.com/api/admin/sms/test-send \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <YOUR_SESSION_TOKEN>" \
  -d '{
    "phoneNumber": "01012345678",
    "message": "마비즈 CRM 테스트 메시지입니다."
  }'
```

#### 요청 방법 (Postman 사용)
```
1. Postman 열기
2. [+] 탭 클릭 → [New Request]
3. 메서드: POST
4. URL: https://mabizcruisedot.com/api/admin/sms/test-send
5. 헤더 추가:
   - Content-Type: application/json
   - Authorization: Bearer <YOUR_SESSION_TOKEN>
6. Body (JSON):
   {
     "phoneNumber": "01012345678",
     "message": "테스트 메시지"
   }
7. [Send] 클릭
```

#### 성공 응답
```json
{
  "success": true,
  "message": "테스트 SMS가 발송되었습니다",
  "msgId": "msg_abc123def456",
  "receiver": "0101****5678",
  "expectedArrival": "약 1-10초 내"
}
```

#### 오류 응답 (API 키 잘못된 경우)
```json
{
  "success": false,
  "error": "Aligo API 인증 실패: API Key 불일치",
  "code": "ALIGO_AUTH_FAILED"
}
```

**오류 해결:**
1. Aligo 대시보드에서 API Key 재확인
2. Vercel 대시보드 → Environment Variables → ALIGO_API_KEY 수정
3. Redeploy 실행
4. 5분 후 다시 테스트

### 5.2 SMS 통계 조회 (선택사항)

실제 발송된 SMS 통계 조회:
```
GET https://mabizcruisedot.com/api/admin/sms/stats?period=daily
Authorization: Bearer <YOUR_SESSION_TOKEN>
```

**응답 예시:**
```json
{
  "period": "daily",
  "summary": {
    "total": 128,
    "sent": 120,
    "delivered": 115,
    "failed": 5
  },
  "rates": {
    "successRate": 93.8,
    "deliveryRate": 95.8
  }
}
```

### 5.3 실제 사용자에게 발송

테스트 완료 후 실제 CRM 기능 사용:

**경로:**
```
대시보드 → 메시지 → SMS 발송
또는
고객 관리 → 개별 SMS 발송
또는
자동화 → 캠페인 → SMS 예약 발송
```

---

## ⚙️ 환경변수 완전 리스트

`.env.production`에서 필요한 모든 변수 (참고용):

| 이름 | 설명 | Vercel 설정 필수? | 예시값 |
|------|------|------------------|--------|
| **ALIGO_USER_ID** | Aligo 계정 ID | ✅ 필수 | `user123abc` |
| **ALIGO_API_KEY** | Aligo API 키 | ✅ 필수 | `abcd1234efgh5678` |
| **ALIGO_SENDER_PHONE** | SMS 발신번호 | ✅ 필수 | `0215114560` |
| **CRON_SECRET** | Cron Job 토큰 | ✅ 필수 | `vVExp...SAo=` |
| DATABASE_URL | 데이터베이스 연결 | ✅ 필수 | `postgresql://...` |
| NODE_ENV | 환경 구분 | ✅ 필수 | `production` |
| NEXT_PUBLIC_APP_URL | 앱 공개 URL | ✅ 필수 | `https://mabizcruisedot.com` |
| NODEMAILER_HOST | 이메일 SMTP 호스트 | ✅ 필수 | `smtp.gmail.com` |
| NODEMAILER_USER | SMTP 사용자 | ✅ 필수 | `support@mabiz.co.kr` |
| NODEMAILER_PASS | SMTP 비밀번호 | ✅ 필수 | `앱 비밀번호` |
| EMAIL_ENCRYPT_KEY | 이메일 암호화 키 | ✅ 필수 | `32자 이상의 랜덤 문자열` |
| PAYAPP_USERID | PayApp 사용자 ID | ✅ 필수 | `mabiz_001` |
| PAYAPP_LINKKEY | PayApp 링크 키 | ✅ 필수 | (암호화된 키) |
| PAYAPP_LINKVAL | PayApp 링크값 | ✅ 필수 | (검증 토큰) |

---

## 🔐 보안 체크리스트

배포 전 반드시 확인:

- [ ] **API 키 노출 확인**
  ```powershell
  git log --all --oneline --graph
  # ALIGO_API_KEY 같은 키가 커밋에 포함되어 있나?
  ```
  
- [ ] **.env.production 파일 gitignore 확인**
  ```bash
  cat .gitignore | grep ".env"
  # 반드시 .env.production이 포함되어야 함
  ```

- [ ] **Preview 환경 별도 키 설정** (선택사항)
  - Preview 배포에는 테스트용 API 키 사용 권장
  - Vercel 대시보드 → Environment Variables → "Preview" 환경별로 설정

- [ ] **정기 갱신 계획**
  - API 키는 분기별(3개월) 갱신 권장
  - 갱신 후 Vercel 즉시 업데이트

---

## ❌ 일반적인 오류 & 해결책

### 오류 1: "ALIGO_API_KEY 값이 비어있음"

**증상:**
```json
{
  "error": "Aligo API 호출 실패: API Key 없음"
}
```

**해결:**
1. Vercel 대시보드 → Settings → Environment Variables 확인
2. ALIGO_API_KEY 값이 비어있거나 `[YOUR_API_KEY]` 상태인지 확인
3. 실제 값으로 업데이트 후 [Save]
4. Redeploy 실행
5. 5분 후 다시 테스트

### 오류 2: "발신자 번호가 등록되지 않음" (오류 코드 -97)

**증상:**
```json
{
  "error": "Aligo SMS 발송 실패: 발신자 번호 미등록 (오류: -97)"
}
```

**해결:**
1. Aligo 대시보드 → [발신자 번호 관리]
2. Vercel의 ALIGO_SENDER_PHONE과 정확히 일치하는 번호가 있는지 확인
3. 없으면 [+번호 추가]로 등록 및 검증 완료 대기 (1-2시간)
4. 검증 완료 후 Vercel에서 다시 테스트

### 오류 3: "충전금 부족" (오류 코드 -96)

**증상:**
```json
{
  "error": "Aligo SMS 발송 실패: 충전금 부족 (오류: -96)"
}
```

**해결:**
1. Aligo 대시보드 → [충전]
2. 50,000원 이상 충전
3. 충전 완료 후 다시 테스트

### 오류 4: "야간 발송 차단" (오류 코드 -98)

**증상:**
```json
{
  "status": "NIGHT_BLOCKED",
  "message": "21:00 ~ 08:00 시간대는 SMS 발송 불가"
}
```

**설명:**
- 한국 통신위원회 규정에 따라 밤 21:00 ~ 아침 08:00 발송 차단
- 자동으로 다음날 08:00 이후에 재발송됨 (정상 동작)

**대응:**
- SMS 발송을 낮 시간대에 예약하는 것을 권장
- 또는 자동화 시퀀스를 아침 09:00 이후로 설정

---

## 📞 지원 & 문제 해결

### Aligo 고객지원
- 이메일: support@aligo.in
- 전화: [Aligo 웹사이트 참고](https://aligo.in)
- 공식 API 문서: https://aligo.in/api/send/

### Vercel 고객지원
- 대시보드: https://vercel.com/dashboard
- 문서: https://vercel.com/docs
- 커뮤니티: https://forums.vercel.com

### 마비즈 CRM 내부 문제
- SMS 발송 로그: 대시보드 → 관리자 → SMS 통계
- 에러 추적: 대시보드 → 관리자 → 에러 로그
- 연락: [내부 담당자에게 문의]

---

## 📝 체크리스트: 배포 전 최종 확인

```
[ ] 1. Aligo 계정에서 API Key 확인 완료
[ ] 2. 발신자 번호가 Aligo에서 승인됨 상태 확인
[ ] 3. Aligo 충전금 50,000원 이상 확인
[ ] 4. Vercel 대시보드 Settings → Environment Variables 접속
[ ] 5. ALIGO_USER_ID 설정 완료
[ ] 6. ALIGO_API_KEY 설정 완료
[ ] 7. ALIGO_SENDER_PHONE 설정 완료
[ ] 8. CRON_SECRET 설정 완료
[ ] 9. Redeploy 실행 및 완료 대기 (3-5분)
[ ] 10. 테스트 SMS 발송 성공 확인
[ ] 11. SMS 통계 조회로 발송 기록 확인
[ ] 12. 팀에 배포 완료 공지
```

---

## 🎓 추가 학습

### 관련 문서
- [ALIGO_SETUP.md](./ALIGO_SETUP.md) — Aligo 설치 및 구성 상세 가이드
- [ALIGO_IMPLEMENTATION.md](./ALIGO_IMPLEMENTATION.md) — 기술 구현 상세 문서
- [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) — 배포 전체 가이드

### SMS 자동화 기능
- Day 0-3 자동 SMS 시퀀스
- 캠프레인별 SMS 발송
- 고객 세그먼트별 커스텀 메시지
- SMS 배송 상태 추적 및 재시도

---

## 📞 최종 정리

**이 문서를 완료했다면:**
1. ✅ Vercel 대시보드에 4개 환경변수 설정 완료
2. ✅ SMS 테스트 발송 성공 확인
3. ✅ 프로덕션 배포 준비 완료
4. ✅ 팀 배포 공지 가능

**다음 단계:**
- SMS 자동화 시퀀스 설정 (별도 문서 참고)
- SMS 통계 대시보드 모니터링 시작
- 정기적인 API 키 갱신 스케줄링

---

**작성**: Claude Code Agent  
**최종 수정**: 2026-06-08  
**버전**: 1.0 (Production Ready)
