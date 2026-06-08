# Vercel 배포 빠른 시작 (Quick Start)

**작성일**: 2026-06-08  
**목표**: Vercel 배포 + SMS 기능 완전 활성화 (30분 이내)  
**대상**: 처음 배포하는 관리자

---

## 🚀 3단계 빠른 배포

### 1️⃣ 환경변수 설정 (10분)

**Vercel 대시보드 접속:**
```
https://vercel.com/dashboard
→ 프로젝트 선택 (마비즈 CRM)
→ Settings 탭
→ Environment Variables
```

**4개 변수 추가:**
| 이름 | 값 | 설명 |
|------|-----|------|
| ALIGO_USER_ID | `user123abc` | Aligo 계정 ID |
| ALIGO_API_KEY | `abcd1234efgh5678` | Aligo API 키 |
| ALIGO_SENDER_PHONE | `0215114560` | 발신번호 |
| CRON_SECRET | `vVExp...SAo=` | Cron 토큰 |

**Production 환경에서만 설정** (Preview/Dev는 선택사항)

### 2️⃣ 배포 (5분)

**Vercel 대시보드에서:**
```
Deployments 탭
→ 최근 배포의 [···] 메뉴
→ [Redeploy] 클릭
→ "Redeploy?" 확인
→ 5분 대기
```

또는 Git 푸시:
```bash
git push origin main
# Vercel이 자동으로 배포
```

### 3️⃣ SMS 테스트 (3분)

**배포 완료 후:**
```bash
curl -X POST https://mabizcruisedot.com/api/admin/sms/test-send \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <SESSION_TOKEN>" \
  -d '{"phoneNumber":"01012345678","message":"테스트"}'
```

**성공 응답:**
```json
{
  "success": true,
  "msgId": "msg_abc123",
  "expectedArrival": "약 1-10초 내"
}
```

---

## 📚 상세 문서

### 초보자 (5분)
→ **[VERCEL_SETUP_CHECKLIST.md](./VERCEL_SETUP_CHECKLIST.md)**
- 체크리스트 형식
- 스크린샷과 예시
- 각 단계별 확인 사항

### 중급자 (20분)
→ **[VERCEL_ALIGO_SETUP.md](./VERCEL_ALIGO_SETUP.md)**
- 상세한 설명
- 스크린샷 포함
- 문제 해결 가이드

### 기술자 (30분)
→ **[ALIGO_IMPLEMENTATION.md](./ALIGO_IMPLEMENTATION.md)**
- 기술 구현 상세
- API 명세
- 데이터베이스 스키마

---

## ✅ 배포 전 필수 확인

```
사전 준비:
☐ Aligo 계정 생성
☐ API Key 확보
☐ 발신자 번호 승인됨 상태 확인
☐ Aligo 충전금 50,000원 이상

Vercel 설정:
☐ 4개 환경변수 설정 완료
☐ Production 환경 선택됨
☐ Redeploy 실행 완료

배포 후:
☐ SMS 테스트 발송 성공
☐ 통계 페이지에 기록 확인
```

---

## 🎯 배포 후 체크리스트

### 배포 직후 (필수)
```
☐ https://mabizcruisedot.com 접속 가능?
☐ 대시보드 로그인 가능?
☐ SMS 테스트 발송 성공?
```

### 운영 중 (권장)
```
☐ 일일 SMS 통계 확인: /api/admin/sms/stats
☐ 실패율 모니터링: 5% 이상 → 알림
☐ API 키 갱신 일정: 분기별 (3개월)
```

---

## 📋 자주 묻는 질문 (FAQ)

### Q1: Preview 환경도 설정해야 하나?
**A:** 선택사항입니다.
- Production만 하면 최소 요구사항
- Preview 환경도 하려면 테스트용 Aligo 키 별도 사용 권장

### Q2: 환경변수 변경 후 언제 적용되나?
**A:** Redeploy 후 5분 이내
1. 환경변수 수정
2. Redeploy 실행
3. 배포 완료 대기 (3-5분)
4. 테스트

### Q3: SMS가 안 보내진다면?
**A:** 순서대로 확인
1. API Key가 올바른가? (Aligo 대시보드에서 재확인)
2. 발신자 번호가 승인됨 상태인가?
3. Aligo 충전금이 있는가?
4. 밤 21:00~08:00 시간인가? (야간 차단)

### Q4: CRON_SECRET는 뭔가?
**A:** SMS 자동 발송 스케줄 보안 토큰
- 정기적으로 SMS를 자동 발송하는 기능을 보호
- 임의의 32자 이상 문자열 사용 가능
- 외부에 노출되면 안 됨

### Q5: 여러 발신번호를 사용할 수 있나?
**A:** 현재는 1개만 지원
- 다중 발신번호 필요 시 역할별 Aligo 계정 분리
- 문의: 내부 개발팀

---

## 🔐 보안 주의사항

### 절대 하면 안 되는 것
```
❌ API Key를 Git에 커밋
❌ API Key를 Slack/이메일로 공유
❌ 로그에 API Key 출력
❌ Preview 환경에 Production 키 설정
```

### 해야 할 것
```
✅ 환경변수는 Vercel 대시보드에만 저장
✅ 로컬 개발은 .env.local 사용
✅ .env 파일은 .gitignore에 추가
✅ 분기별 API Key 갱신
```

---

## 📞 문제 해결

### 배포 실패
```
❌ Error: Command failed
해결: npm run build를 로컬에서 먼저 테스트
```

### SMS 발송 안 됨
```
❌ Error: Aligo API 인증 실패
해결: Vercel의 ALIGO_API_KEY 값 재확인
```

### 야간에 안 보내짐
```
❌ NIGHT_BLOCKED 상태
정상 동작: 21:00~08:00은 정부 규정상 차단
다음날 08:00 이후 자동으로 발송됨
```

**더 자세한 해결책**: [VERCEL_ALIGO_SETUP.md](./VERCEL_ALIGO_SETUP.md#-일반적인-오류--해결책) 참고

---

## 🗺️ 다음 단계

### 배포 후 (필수)
1. ✅ SMS 테스트 발송으로 기능 확인
2. SMS 자동화 시퀀스 설정 (별도 문서)
3. 팀에 배포 완료 공지

### 운영 중 (권장)
1. 일일 SMS 통계 모니터링
2. API 키 분기별 갱신
3. 오류 로그 정기 확인

### 고급 (선택)
1. Preview 환경 테스트용 설정
2. Development 환경 로컬 테스트 설정
3. SMS A/B 테스트 자동화

---

## 📞 지원 연락처

| 분류 | 연락처 |
|------|--------|
| Aligo 기술 지원 | support@aligo.in |
| Vercel 문제 | https://vercel.com/docs |
| 마비즈 CRM 내부 | [담당자 이름] |

---

## 📊 예상 소요 시간

| 작업 | 소요 시간 |
|------|----------|
| 사전 준비 (Aligo 확인) | 5분 |
| Vercel 환경변수 설정 | 10분 |
| Redeploy 실행 및 대기 | 5분 |
| SMS 테스트 및 확인 | 5분 |
| **총합** | **25분** |

---

## ✅ 완료 기준

배포가 성공적으로 완료되면:

```
☑ https://mabizcruisedot.com 접속 가능
☑ 관리자 로그인 가능
☑ SMS 테스트 발송 성공 (1-10초 내 수신)
☑ 대시보드 SMS 통계에 기록 표시
```

이 모든 조건을 만족하면 **배포 완료** 👍

---

## 📖 관련 문서

- [VERCEL_SETUP_CHECKLIST.md](./VERCEL_SETUP_CHECKLIST.md) — 5분 체크리스트
- [VERCEL_ALIGO_SETUP.md](./VERCEL_ALIGO_SETUP.md) — 상세 설정 가이드
- [ALIGO_SETUP.md](./ALIGO_SETUP.md) — Aligo 계정 설정
- [ALIGO_IMPLEMENTATION.md](./ALIGO_IMPLEMENTATION.md) — 기술 구현
- [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) — 전체 배포 가이드

---

**버전**: 1.0  
**작성**: Claude Code Agent  
**수정일**: 2026-06-08  
**상태**: Production Ready
