# Aligo IP 화이트리스트 빠른 참조 카드

**인쇄 또는 책상에 붙이세요!**

---

## 🚨 발송 실패 (발송 IP 미인증)

```
❌ 오류: "result_code: -107"
    "발송 IP가 인증되지 않은 발송 IP입니다"
```

### 해결 (3분)

```
Step 1: IP 확인 (관리자 PC에서)
PowerShell: Invoke-WebRequest https://api.ipify.org
또는 https://www.myip.com/

Step 2: Aligo 대시보드 로그인
https://smartsms.aligo.in/admin/

Step 3: IP 등록
[관리] → [발송 설정] → [IP 화이트리스트]
[IP 추가] → IP 입력 → [저장]

Step 4: SMS 재테스트
Settings (설정) → SMS → [테스트 발송]
```

---

## 환경별 IP 종류

| 환경 | IP 변경 | 우선순위 | 조치 |
|------|--------|---------|------|
| **로컬** | 자주 변경 | 낮음 | 자동 |
| **Vercel** | **자주 변경** | 높음 ⚠️ | 자동 감지 필요 |
| **EC2** | 변경 없음 | 최고 ✅ | 한번만 등록 |

---

## 빠른 진단 표

### 로컬 (localhost:3000)

```
✅ 성공: IP 등록됨
❌ 실패: IP 미등록

→ 현재 IP 확인 후 등록
```

### Vercel 배포

```
✅ 성공: Vercel IP 등록됨
❌ 실패: Vercel IP 미등록

→ https://mabizcruisedot.com/api/health 호출
→ serverPublicIP 확인
→ Aligo에 등록
```

---

## 자주하는 실수 Top 3

### 1️⃣ 사용자 IP 등록 (틀림!)

```
❌ 틀림: 사용자 PC IP 등록
✅ 맞음: 마비즈 CRM 서버 IP 등록
```

### 2️⃣ IP만 등록하고 재테스트 안 함

```
❌ 틀림: 등록 후 바로 다른 작업
✅ 맞음: 등록 후 5분 기다림 → 재테스트
```

### 3️⃣ API Key + IP 동시에 실패했는데 IP만 확인

```
❌ 틀림: IP만 수정
✅ 맞음: API Key 확인 + IP 확인 동시 진행
```

---

## 긴급 연락처

| 문제 | 연락처 | 시간 |
|------|--------|------|
| **Aligo 기술** | support@aligo.in | 09:00~18:00 |
| **Aligo 전화** | 1644-0001 | 평일 09:00~18:00 |
| **마비즈 CRM** | hyeseon28@gmail.com | 24시간 |

---

## Aligo 대시보드 경로

### IP 관리 위치

```
smartsms.aligo.in/admin/
  → [관리] 또는 [설정]
    → [발송 설정] 또는 [보안]
      → [IP 화이트리스트] 또는 [IP 관리]
```

### API Key 조회

```
smartsms.aligo.in/admin/
  → [계정 설정]
    → [API 키]
      → [신규 생성] 또는 [기존 조회]
```

---

## 이 문서 더 읽기

👉 **전체 가이드**: `docs/ALIGO_IP_WHITELIST_GUIDE.md`

- 원리 이해하기
- 로컬/Vercel/EC2 설정 방법
- 개인 알리고 설정
- 8가지 FAQ
- 개발자 코드 예시

---

**마지막 업데이트**: 2026-06-08
