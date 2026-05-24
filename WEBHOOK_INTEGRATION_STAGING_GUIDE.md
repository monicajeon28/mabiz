# 크루즈닷몰 웹훅 통합 스테이징 배포 가이드

**날짜**: 2026-05-24 (오늘)  
**상태**: 빌드 ✅ → 환경변수 설정 ⏳

---

## 📋 현재 진행 상황

### ✅ 완료된 작업
1. **npm run build 성공** (커밋: b358cd0)
   ```
   Compiled with warnings in 16.6s
   ```

2. **웹훅 엔드포인트 구현** 
   - 파일: `src/app/api/webhooks/cruisedot-payment/route.ts`
   - 기능:
     - Bearer Token 검증
     - HMAC-SHA256 서명 검증
     - eventId 멱등성 체크 (중복 방지)
     - Contact 상태 업데이트
     - AffiliateSale 환불 처리
     - AdminNotification 생성
     - 트랜잭션 처리

3. **로컬 환경변수 설정** ✅
   - 파일: `.env.local`
   - 변수: `CRUISEDOT_WEBHOOK_SECRET=sk_staging_...`

### ⏳ 필요한 작업 (오늘 완료 필수)

#### Step 1: Vercel 스테이징 환경에 환경변수 설정
1. **Vercel Dashboard 접근**
   - URL: https://vercel.com/dashboard
   - 프로젝트: mabiz

2. **Settings → Environment Variables**
   - 환경 변수 추가:
     ```
     이름: CRUISEDOT_WEBHOOK_SECRET
     값: sk_staging_651ffc29ea402ae3fa003f25bef3cf809660ba6f8dc9c4def22da937c011f3d9
     환경: Staging (또는 Preview)
     ```

3. **배포 확인**
   - Vercel이 자동으로 스테이징 배포 시작
   - 배포 완료 대기 (약 2-3분)

#### Step 2: 기초 테스트 수행
```bash
# 테스트 스크립트 실행
bash scripts/test-cruisedot-webhook.sh
```

**예상 응답:**
- ✅ 테스트 1 (Bearer Token 미제공): `401 Unauthorized`
- ✅ 테스트 2 (필드 누락): `400 Bad Request`
- ✅ 테스트 3 (서명 검증 실패): `403 Forbidden`

---

## 📅 다음 단계 (2026-05-25)

### 완전 통합 테스트
1. **결제 완료 이벤트 테스트**
   - Contact `lastPaymentStatus='paid'` 업데이트 확인
   - PNR "결제됨" 표시 확인

2. **환불 이벤트 테스트**
   - Contact `lastPaymentStatus='refunded'` 업데이트 확인
   - AffiliateSale 수당 취소 확인
   - AdminNotification 생성 확인

3. **에러 케이스 검증**
   - 중복 eventId (TOCTOU 방지)
   - 잘못된 HMAC 서명
   - 필수 필드 누락

---

## 🔐 보안 주의사항

⚠️ **Secret 키 노출 금지**
- `.env` 파일에만 저장
- 공개 저장소에 커밋 금지 ❌
- 슬랙/메일로 전송 금지 ❌

---

## 📞 연락처 (필요시)

- **CRM DevOps 담당자**: (기재 필요)
- **크루즈닷몰 담당자**: (기재 필요)

---

## ✅ 체크리스트

- [ ] CRUISEDOT_WEBHOOK_SECRET 수신 (2026-05-22) ✅
- [ ] 로컬 환경변수 설정 (2026-05-24) ✅
- [ ] **Vercel 스테이징 환경변수 설정 (2026-05-24) 👈 지금**
- [ ] 스테이징 URL 기초 테스트 (2026-05-24) 👈 지금
- [ ] 결제 완료 이벤트 테스트 (2026-05-25)
- [ ] 환불 이벤트 테스트 (2026-05-25)
- [ ] AdminNotification 확인 (2026-05-25)
- [ ] Production 환경변수 설정 (2026-05-26+)

