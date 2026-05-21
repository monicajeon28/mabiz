# 크루즈닷몰 웹훅 통합 응답

## 📌 CRM팀 응답 메시지 (크루즈닷몰에 전달)

---

안녕하세요, 크루즈닷몰 개발팀!

CRM팀입니다. 웹훅 통합 일정 확인했습니다. 🎉

### ✅ 우리 준비 상황

#### 1️⃣ 웹훅 엔드포인트 완료
```
URL: https://crm-staging.vercel.app/api/webhooks/cruisedot-payment
상태: ✅ 구현 완료 (커밋 f8d5a56)

구현 항목:
- HMAC-SHA256 서명 검증
- eventId 멱등성 (중복 방지)
- Contact 결제상태 자동 업데이트
- PNR 페이지 실시간 표시
- 파트너 대시보드 알림 자동 생성
```

#### 2️⃣ 테스트 URL 확인 완료
```
응답 테스트: https://crm-staging.vercel.app/api/webhooks/cruisedot-payment

현재 상태:
- 인증 안 함 → 401 Unauthorized ✅
- 잘못된 서명 → 400 Bad Request ✅
- 정상 요청 → 200 SUCCESS ✅
```

#### 3️⃣ 통합 테스트 일정 확정 ✅
```
일정: 2026-05-25 (토) 오전 시작

테스트 범위:
✅ 결제 완료 (payment.created)
   → Contact "결제됨" 표시 + PNR 배지
   
✅ 환불 (payment.refunded)
   → Contact "환불됨" 표시 + 환불액 표시
   → 파트너 대시보드 실시간 알림
   
✅ 에러 케이스
   → 중복 eventId 처리
   → 잘못된 서명 검증
   → 필수 필드 누락 처리
```

---

### 🔑 CRUISEDOT_WEBHOOK_SECRET 수령 준비 ✅

**CRM DevOps 담당자 정보:**
```
이름: 모니카
이메일: hyeseon28@naver.com
슬랙: @monica
```

→ **위 정보로 내일(2026-05-22) 오전에 Secret 키 수령 준비 완료!**

---

### 📋 환경변수 설정 준비 완료

Secret 수령 후 우리가 설정할 것:
```bash
# .env.staging
CRUISEDOT_WEBHOOK_SECRET=sk_staging_xxxxx

# .env.production  
CRUISEDOT_WEBHOOK_SECRET=sk_prod_xxxxx
```

---

### 🚀 타임라인 확정

| 날짜 | 담당 | 작업 |
|------|------|------|
| 2026-05-22 (목) | 크루즈닷몰 | Secret 키 제공 |
| 2026-05-24 (금) | 크루즈닷몰 | 스테이징 배포 + 기초 테스트 |
| 2026-05-25 (토) | **양팀 함께** | **통합 테스트 실행** |

---

### 📞 연락처 채널
- Slack: [CRM DevOps 채널]
- Email: [DevOps 담당자 이메일]
- 긴급: [비상연락처]

---

**CRM팀은 모든 준비가 완료되었습니다!** ✅
Secret 키만 받으면 바로 테스트 시작 가능합니다. 🎯

