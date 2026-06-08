# Vercel + Aligo 환경변수 설정 체크리스트

**버전**: 1.0  
**대상**: 5분 안에 완료 가능한 빠른 가이드  
**상태**: 읽으면서 각 단계를 체크하세요

---

## 📋 사전 준비 (5분)

### Aligo 계정 확인

```
☐ Aligo 대시보드 로그인: https://aligo.in
☐ 왼쪽 메뉴 → [설정] → [API] 클릭
☐ User ID 복사 (예: user123abc)
☐ API Key 복사 (예: abcd1234efgh5678)
☐ 발신자 번호 관리에서 승인된 번호 확인 (예: 0215114560)
```

**확인사항:**
```
☐ API Key가 "초록색 승인" 상태?
☐ 발신자 번호가 "✅ 승인됨"?
☐ 충전금이 50,000원 이상?
```

---

## 🔐 Vercel 대시보드 설정 (10분)

### Step 1: 프로젝트 페이지 열기

```
☐ https://vercel.com/dashboard 접속
☐ 프로젝트 선택 (마비즈 CRM)
☐ 상단 [Settings] 탭 클릭
☐ 왼쪽 메뉴 → [Environment Variables] 클릭
```

**화면 확인:**
```
┌─ Environment Variables ──────────────────┐
│ Environment: ☑ Production                │
│              ☐ Preview                   │
│              ☐ Development               │
│                                         │
│ [+ Add New]                             │
└─────────────────────────────────────────┘
```

### Step 2: ALIGO_USER_ID 추가

```
☐ [+ Add New] 클릭
☐ NAME 입력: ALIGO_USER_ID
☐ VALUE 입력: user123abc (Aligo에서 복사한 값)
☐ ENVIRONMENTS: Production 체크
☐ [Save] 클릭
☐ ✅ 목록에서 확인됨
```

**예시 입력:**
```
NAME:  ALIGO_USER_ID
VALUE: user123abc
ENV:   ☑ Production
```

### Step 3: ALIGO_API_KEY 추가

```
☐ [+ Add New] 클릭
☐ NAME 입력: ALIGO_API_KEY
☐ VALUE 입력: abcd1234efgh5678 (Aligo에서 복사한 값)
☐ ENVIRONMENTS: Production만 체크 (보안)
☐ [Save] 클릭
☐ ✅ 목록에서 확인됨 (마스킹됨)
```

**예시 입력:**
```
NAME:  ALIGO_API_KEY
VALUE: abcd1234efgh5678
ENV:   ☑ Production (☐ Preview, ☐ Development 체크 안 함)
```

### Step 4: ALIGO_SENDER_PHONE 추가

```
☐ [+ Add New] 클릭
☐ NAME 입력: ALIGO_SENDER_PHONE
☐ VALUE 입력: 0215114560 (Aligo에서 승인된 번호)
☐ ENVIRONMENTS: Production, Preview, Development 모두 체크
☐ [Save] 클릭
☐ ✅ 목록에서 확인됨
```

**예시 입력:**
```
NAME:  ALIGO_SENDER_PHONE
VALUE: 0215114560
ENV:   ☑ Production ☑ Preview ☑ Development
```

### Step 5: CRON_SECRET 추가

```
☐ [+ Add New] 클릭
☐ NAME 입력: CRON_SECRET
☐ VALUE 입력: (아래 방법으로 생성한 토큰)
☐ ENVIRONMENTS: Production만 체크
☐ [Save] 클릭
☐ ✅ 목록에서 확인됨
```

**CRON_SECRET 생성 (PowerShell):**
```powershell
$bytes = [System.Text.Encoding]::UTF8.GetBytes("$(New-Guid)")
$hash = [System.Security.Cryptography.SHA256]::Create().ComputeHash($bytes)
$secret = [Convert]::ToBase64String($hash)
Write-Host $secret
# 결과 복사: vVExpRAGkmQFZO9MrPkiinI898LIs/mXBCoigYqBSAo=
```

**예시 입력:**
```
NAME:  CRON_SECRET
VALUE: vVExpRAGkmQFZO9MrPkiinI898LIs/mXBCoigYqBSAo=
ENV:   ☑ Production (보안상 Production만)
```

---

## ✅ 설정 확인 (2분)

### 최종 확인

```
☐ 4개 변수 모두 표시되어 있나?
☐ 각 변수 옆에 [Edit] [Delete] 버튼이 있나?
☐ 값이 마스킹되어 표시되나? (보안)
☐ ALIGO_API_KEY와 CRON_SECRET은 Production만 체크?
```

**화면 예시:**
```
NAME                      VALUE            ENV
─────────────────────────────────────────────
ALIGO_USER_ID             user***abc       Prod,Prev,Dev
ALIGO_API_KEY             abcd***3456      Prod
ALIGO_SENDER_PHONE        021511***0       Prod,Prev,Dev
CRON_SECRET               vVExp***SAo=     Prod
DATABASE_URL              postgre***       Prod,Prev,Dev
NODE_ENV                  production       Prod,Prev,Dev
```

---

## 🚀 배포 (5분)

### Redeploy 실행

**방법 1: Vercel 대시보드에서**
```
☐ 프로젝트 페이지 → [Deployments] 탭
☐ 가장 최근 배포 우측 [···] 클릭
☐ [Redeploy] 선택
☐ "Redeploy?" → [Redeploy] 확인
```

**방법 2: Git 푸시 (자동)**
```
☐ 로컬에서 변경사항 커밋: git add . && git commit -m "..."
☐ git push origin main
☐ Vercel이 자동으로 배포 시작
```

**배포 상태 확인:**
```
☐ [Deployments] 탭에서 🔵 "Building..." 보이나?
☐ 5분 후 ✅ "Success" 초록색 체크 표시?
☐ 배포 시간: 약 3-5분
```

---

## 🧪 SMS 테스트 (3분)

### 테스트 SMS 발송

**URL:**
```
POST https://mabizcruisedot.com/api/admin/sms/test-send
```

**요청 (cURL):**
```bash
curl -X POST https://mabizcruisedot.com/api/admin/sms/test-send \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <YOUR_SESSION_TOKEN>" \
  -d '{"phoneNumber":"01012345678","message":"테스트"}'
```

**성공 응답 확인:**
```
☐ { "success": true }?
☐ msgId가 반환되었나?
☐ "expectedArrival": "약 1-10초 내"?
```

**오류 응답 확인:**
```
☐ 오류가 나왔다면?
  1. Aligo 대시보드에서 API Key 재확인
  2. Vercel 환경변수 다시 확인
  3. Redeploy 실행
  4. 5분 후 다시 테스트
```

---

## 📊 통계 확인 (선택사항)

```
☐ GET https://mabizcruisedot.com/api/admin/sms/stats
☐ 실제 발송된 SMS 기록이 표시되나?
☐ "delivered": 배송 완료 건수가 증가하나?
```

---

## 🎯 최종 정리

### 모두 완료했다면:

```
☐ Aligo 정보 4개 Vercel에 설정
☐ Redeploy 실행 완료
☐ SMS 테스트 발송 성공
☐ 팀에 배포 완료 공지
☐ docs/VERCEL_ALIGO_SETUP.md 북마크 (향후 참고용)
```

### 다음 단계:

```
1. CRM에서 SMS 기능 활성화
2. SMS 자동화 시퀀스 설정 (별도 문서)
3. SMS 통계 대시보드 모니터링 시작
4. 정기적인 API 키 갱신 계획 (분기별)
```

---

## ❌ 문제 해결 (빠른 참고)

| 오류 | 원인 | 해결책 |
|------|------|--------|
| **ALIGO_API_KEY 값이 비어있음** | Vercel에 값 미입력 | 실제 값 입력 → Save → Redeploy |
| **발신자 번호 미등록 (-97)** | Aligo에 번호 미등록 | Aligo에서 번호 추가 및 검증 대기 |
| **충전금 부족 (-96)** | Aligo 충전금 없음 | Aligo에서 50,000원 이상 충전 |
| **야간 발송 차단 (-98)** | 21:00~08:00 발송 | 낮 시간대에 발송 (정상 동작) |
| **배포 실패** | 문법 오류 | npm run build로 로컬 테스트 |

**자세한 해결책**: docs/VERCEL_ALIGO_SETUP.md 참고

---

## 📞 도움 받기

```
문제 발생 시:
1. docs/VERCEL_ALIGO_SETUP.md 전체 읽기
2. Aligo 고객지원: support@aligo.in
3. 내부 담당자에게 문의
```

---

## ⏱️ 예상 소요 시간

| 단계 | 소요 시간 |
|------|----------|
| 사전 준비 | 5분 |
| Vercel 설정 | 10분 |
| 확인 | 2분 |
| 배포 | 5분 |
| 테스트 | 3분 |
| **총합** | **25분** |

---

**핵심**: 4개 환경변수만 설정하면 SMS 기능이 자동으로 작동합니다.

**완료 후**: docs/VERCEL_ALIGO_SETUP.md로 상세 내용 참고

---

**버전**: 1.0  
**작성**: Claude Code Agent  
**수정일**: 2026-06-08
