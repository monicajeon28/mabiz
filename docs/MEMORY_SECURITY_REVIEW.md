# 🔐 보안 & 규정준수 검토 기억 저장소

**작성일**: 2026-06-02 (security review)  
**담당**: 보안 & 데이터 보호 전문가팀

---

## 🎯 검토 결과 (2026-06-02)

### 현황 점수
- **GDPR**: 60/100 (암호화, 삭제권 ✅ | 접근권, DPIA, DPA ⚠️)
- **CCPA**: 75/100 (삭제권, 옵트아웃 ✅ | 판매금지 ⚠️)
- **한국법**: 80/100 (암호화, RBAC, 감사 ✅ | 수탁자, 통지 ⚠️)
- **Overall**: 72/100 → **Target: 95/100** (by 2026-07-31)

---

## ✅ 잘 구현된 항목들

### 보안 (Good)
- [x] **AUTH-001**: 모든 API에서 `getMabizSession()` 사용 ✅
- [x] **AUTH-002**: RBAC (Role-Based Access Control) 구현 ✅
- [x] **AUTH-003**: Bearer Token 검증 (Webhook) ✅
- [x] **AUTH-004**: HMAC-SHA256 서명 검증 ✅
- [x] **DATA-002**: HTTPS (in transit) ✅
- [x] **API-001**: SQL Injection 방지 (Prisma ORM) ✅
- [x] **API-004**: 멱등성 구현 (eventId 기반) ✅
- [x] **OPS-001**: 환경 변수 관리 (암호화) ✅
- [x] **OPS-002**: 로깅 구현 (logger) ✅

### 감시 & 규정준수 (Good)
- [x] **감사 로그 API**: `src/app/api/admin/compliance/audit-logs/route.ts` 존재
- [x] **데이터 삭제 요청**: `src/app/api/admin/compliance/deletion-requests/route.ts` 존재
- [x] **컴플라이언스 체커**: `src/lib/compliance/compliance-checker.ts` (20+ 검사 항목)
- [x] **암호화 구현**: `src/lib/crypto.ts` (AES-256-CBC) ✅
- [x] **이메일/SMS 자격증명 암호화**: `UserSmsConfig.aligoKeyEncrypted`, `OrgEmailConfig.smtpPassEncrypted` ✅

---

## ⚠️ 개선 필요한 항목들 (20개)

### 1️⃣ Contact 동의 관리 (P0)
**현황**: 미구현  
**필요 필드**:
```typescript
Contact {
  smsOptIn: Boolean @default(false)
  smsOptInAt: DateTime?
  smsOptOutAt: DateTime?
  emailOptIn: Boolean @default(false)
  callOptIn: Boolean @default(true)
  dataShareOptOut: Boolean @default(false)  // CCPA
}
```
**마감**: 2026-06-08  
**담당**: Agent-CRM

---

### 2️⃣ Contact.phone/email 암호화 (P0)
**현황**: 미구현 (다른 필드는 암호화됨)  
**이유**: GDPR 개인정보 보호 → 벌금 €20M  
**마감**: 2026-06-15  
**담당**: Agent-CRM

---

### 3️⃣ API 감사 로깅 자동화 (P1)
**현황**: 감사 로그 API는 있으나 자동 기록 부분 구현  
**필요**: 모든 POST/PUT/DELETE에 auditLogger.log() 추가  
**파일**: 
- messages/route.ts ✅ (일부)
- contacts/route.ts ⚠️ (미구현)
- campaigns/route.ts ⚠️ (미구현)
- webhooks/*/route.ts ⚠️ (미구현)
- admin/*/route.ts ⚠️ (미구현)

**마감**: 2026-06-22  
**담당**: Agent-ADM

---

### 4️⃣ 로그 마스킹 (PII) (P1)
**현황**: 미구현  
**목표**: 로그에서 phone, email, creditCard 숨기기  
**예시**:
```
Before: phone: "010-1234-5678"
After:  phone: "010-****-5678"

Before: email: "user@example.com"
After:  email: "us****@example.com"
```

**마감**: 2026-06-22  
**담당**: Agent-ADM

---

### 5️⃣ SMS/Email 발송 전 동의 확인 (P1)
**현황**: 미구현  
**필요**: `if (!contact.smsOptIn) return 400` 체크  
**위치**: `src/app/api/messages/route.ts` (85-140줄)  
**마감**: 2026-06-15  
**담당**: Agent-SMS

---

### 6️⃣ Rate Limiting (P2)
**현황**: 미구현  
**필요**:
- SMS 발송: 100회/일
- API 호출: 1000회/시간
- 로그인: 5회/5분

**라이브러리**: `@upstash/ratelimit`  
**마감**: 2026-06-22  
**담당**: Agent-SMS

---

### 7️⃣ 자동 데이터 폐기 Cron (P2)
**현황**: Cron 미구현 (deletion-requests API만 있음)  
**필요**:
- Contact: 365일 후 삭제 (유예 30일)
- SMS/Email 로그: 90일 후 즉시 삭제
- Webhook 이벤트: 180일 후 즉시 삭제

**위치**: `src/app/api/cron/data-retention-cleanup.ts` (신규)  
**마감**: 2026-06-22  
**담당**: Agent-ADM

---

### 8️⃣ GDPR 개인정보 접근권 (P2)
**현황**: 미구현  
**필요**: GET /api/admin/compliance/data-access?contactId=xxx  
**기능**: 고객이 자신의 모든 데이터를 ZIP 파일로 다운로드  
**마감**: 2026-06-22  
**담당**: Agent-ADM

---

### 9️⃣ 세션 만료 & 재인증 (P1)
**현황**: ⚠️ 부분 구현  
**필요**:
- 세션 타임아웃: 30분 (설정 확인)
- 민감한 작업 재인증: 데이터 삭제, 대량 발송, 환경 변수 변경

**마감**: 2026-06-30  
**담당**: Agent-SET

---

### 🔟 XSS/CSRF 방어 (P3)
**현황**: 미구현  
**필요**:
- Content-Security-Policy 헤더
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff

**위치**: `next.config.js`  
**마감**: 2026-06-30  
**담당**: Agent-SET

---

### 1️⃣1️⃣ IP Whitelist (Admin API) (P3)
**현황**: 미구현  
**필요**: Admin API는 특정 IP만 접근 가능  
**마감**: 2026-07-15  
**담당**: Agent-SET

---

### 1️⃣2️⃣ API 버전 관리 (P3)
**현황**: 미구현  
**필요**: v1, v2 분리 (하위호환성 유지)  
**예**:
```
/api/v1/messages → 현재 구현
/api/v2/messages → 새로운 기능 (향후)
```

**마감**: 2026-07-15  
**담당**: Agent-LIB

---

### 1️⃣3️⃣ 월간 보안 감사 프로세스 (P3)
**현황**: 미구현  
**필요**:
- npm audit 자동 실행 (CI/CD)
- 심각한 취약점: 24시간 내 패치
- 일반 취약점: 주간 패치

**마감**: 2026-07-15  
**담당**: Agent-SET

---

### 1️⃣4️⃣ 보안 인사사건 대응 계획 (P4)
**현황**: 미구현 (문서만)  
**필요**:
- 데이터 유출 시 대응 (72시간 내 신고)
- 시스템 다운 시 복구 (RTO < 1시간)

**마감**: 2026-07-31  
**담당**: 법무팀 + 보안팀

---

### 1️⃣5️⃣ 데이터 백업 & 복구 전략 (P4)
**현황**: ⚠️ DevOps 담당 (검증 필요)  
**필요**:
- 자동 백업 빈도 (일일)
- 백업 암호화
- 재해 복구 계획 (RTO < 4시간, RPO < 1시간)

**마감**: 2026-07-31  
**담당**: DevOps팀

---

### 1️⃣6️⃣ 보안 모니터링 대시보드 (P3)
**현황**: 미구현  
**필요**:
- 실패한 로그인 (1시간 내 5회+)
- 비정상적인 데이터 접근 (1시간 내 1000+)
- API 오류율 (> 1%)
- 컴플라이언스 점수

**위치**: `src/app/(dashboard)/admin/security-monitor/page.tsx`  
**마감**: 2026-07-15  
**담당**: Agent-ADM

---

### 1️⃣7️⃣ 외부 보안 감사 (Penetration Testing) (P4)
**현황**: 예정됨  
**필요**: 한국 보안 회사 선정  
**비용**: $5K ~ $10K  
**마감**: 2026-07-20  
**담당**: 보안팀

---

### 1️⃣8️⃣ DPIA (Data Protection Impact Assessment) (P4)
**현황**: 미구현  
**필요**: GDPR 요구 - 고위험 처리 시  
**마감**: 2026-07-31  
**담당**: 법무팀

---

### 1️⃣9️⃣ DPA (Data Processing Agreement) (P4)
**현황**: 미구현  
**필요**: 제3자 데이터 처리자와의 계약  
**마감**: 2026-07-31  
**담당**: 법무팀

---

### 2️⃣0️⃣ 프라이버시 정책 업데이트 (P2)
**현황**: ⚠️ 부분 구현  
**필요**:
- GDPR 동의 메커니즘 명시
- 데이터 보관 기간 공개
- 개인정보 사용 목적 상세 기술

**마감**: 2026-06-30  
**담당**: 법무팀

---

## 📊 데이터 보관 기간 (정리)

| 데이터 | 기간 | 폐기 방법 |
|--------|------|---------|
| Contact 정보 | 365일 | 암호화 후 삭제 |
| 콜 녹취 | 180일 | 암호화 후 물리적 파괴 |
| SMS/Email 로그 | 90일 | 암호화 후 삭제 |
| 감사 로그 | 365일+ | 읽기 전용 보관 |
| 결제 정보 | 1,825일 (5년) | 암호화 보관 |
| Webhook 이벤트 | 180일 | 암호화 후 삭제 |

---

## 🎯 주요 메모 (나중에 참고)

### 1. Webhook 3-레이어 보안 ✅
```
Layer 1: Bearer Token ✅
Layer 2: HMAC-SHA256 ✅
Layer 3: 멱등성 (eventId) ✅
```

### 2. 암호화 구현
- **현재**: SMS, Email 자격증명 암호화 ✅
- **필요**: Contact.phone, email 암호화 (향후)
- **미래**: 콜 녹취 S3 + KMS 암호화

### 3. 감사 로그
- **테이블**: AuditLog (organizationId, userId, action, resourceType, status)
- **인덱스**: (organizationId, createdAt), (userId, createdAt)
- **쿼리**: 실패한 로그인, 불가능한 이동, 대량 데이터 접근 자동 감지

### 4. 컴플라이언스 레벨
- GDPR: 유럽 (개인정보 강화)
- CCPA: 캘리포니아 (삭제권, 판매금지)
- 한국: 개인정보보호법 + 통신비밀보호법 (암호화, 동의, 감사)

### 5. 중요한 API 엔드포인트
```
✅ /api/messages               — SMS/Email 발송 (동의 확인 필요)
✅ /api/webhooks/cruisedot-*   — 결제/정산 (3-레이어 보안)
✅ /api/admin/compliance/*     — 감시/규정준수
⚠️ /api/admin/**               — RBAC + Rate Limiting 필요
```

---

## 🚀 다음 단계 (Action Items)

### 즉시 (이번 주)
1. [ ] Contact 동의 필드 추가 (Prisma 마이그레이션)
2. [ ] Phone/Email 암호화 시작
3. [ ] 환경 변수 검증 추가

### 다음 주
1. [ ] SMS 동의 확인 로직 추가
2. [ ] 감사 로그 자동 기록 (모든 API)
3. [ ] 로그 마스킹 구현

### 2주 후
1. [ ] Rate Limiting 구현
2. [ ] 자동 데이터 폐기 Cron
3. [ ] GDPR 개인정보 접근권

### 최종 (7월)
1. [ ] 외부 보안 감사
2. [ ] 컴플라이언스 점수 95+
3. [ ] 프로덕션 배포

---

**총 개선 항목**: 20개  
**완료**: 0개  
**진행 중**: 0개  
**대기**: 20개  

**예상 완료**: 2026-07-31 ✅
