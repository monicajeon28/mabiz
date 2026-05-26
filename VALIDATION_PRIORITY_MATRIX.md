# 통합 검증 우선순위 매트릭스 (2026-05-27)

**기준:** P0(긴급, 1-2일) | P1(높음, 1주) | P2(중간, 2주) | P3(낮음, 월간)  
**총 이슈:** 111개 | **시스템:** mabiz CRM + cruisedot

---

## 🔴 P0 - CRITICAL (1-2일 내 반드시 해결)

### mabiz CRM
| ID | 파일:라인 | 문제 | 영향 | 해결책 |
|-----|----------|------|------|--------|
| T2 | `src/app/api/sms/automation/schedule-day0-3/route.ts` | Missing import prisma | SMS Day0-3 완전 실패 | import 추가 |
| ISS-01 | `src/app/api/payments/webhook/route.ts` | Contact 자동생성 메커니즘 부재 | 결제 후 Contact 없음 → SMS 안 발송 | Contact upsert 로직 추가 |
| ISS-05 | `src/app/api/inquiries/webhook/route.ts` | Inquiry 웹훅 엔드포인트 미존재 | cruisedot 문의 동기화 실패 | Inquiry webhook 생성 |
| ISS-09 | `src/app/api/inventory/webhook/route.ts` | Inventory sync 웹훅 미존재 | mabiz 판매 후 cruisedot 재고 미차감 | Inventory webhook 생성 |
| SEC-M1 | `.env.local` | DB 자격증명 평문 저장 | Git history leak → production 탈취 위험 | `git filter-branch` + Vercel env vars |
| SEC-M3 | `src/app/api/seed/route.ts` | Test account 4자리 비번 | Brute-force 공격 쉬움 | x-seed-secret 헤더 검증 추가 |
| SEC-M5 | `src/lib/auth/session.ts` | Session 삭제 실패 핸들링 미흡 | 세션 좀비 누적 | 에러 로깅 + 일일 정리 Cron |

### cruisedot
| ID | 파일:라인 | 문제 | 영향 | 해결책 |
|-----|----------|------|------|--------|
| SEC-C1 | `.env.local` | JWT 토큰 평문 저장 | Git history leak → admin 탈취 | `git filter-branch` + Vercel env vars |
| SEC-C2 | `src/pages/admin/api/*` | Admin 비번 평문 저장 | Plaintext 매칭 → 1초 Crack | bcrypt.hash() 통합 해시 |
| SEC-C3 | `src/pages/api/accounts/create.ts` | Default 비번 (1101, qwe1, zxc1) | 신규 계정 기본값 사용 가능 | Manual creation만 허용 |
| SEC-C4 | `src/utils/flow/condition.ts` | eval() 함수 사용 | RCE(Remote Code Execution) 위험 | Safe expression parser (함수형 if/else 대체) |
| SEC-C5 | Database | PII 필드 평문 (residentId, bankAccount) | GDPR/PCI-DSS 위반 | AES-256-CBC 암호화 |
| SEC-C6 | `src/middleware/cors.ts` | CORS over-open (origin null → *) | Cross-origin 공격 허용 | 명시적 도메인 화이트리스트만 허용 |

**🎯 P0 커밋 배치:** `fix/p0-critical-security` (6개 커밋)

---

## 🟠 P1 - HIGH (1주일 내)

### mabiz CRM Security (4개)
| ID | 문제 | 영향 | 해결책 | 우선순위 |
|-----|------|------|--------|---------|
| SEC-M2 | Password field in SELECT queries | PII 노출 (요청 로그) | SELECT 시 password 제외 | 1-2일 |
| SEC-M4 | RBAC 약함 (cross-org access) | 다른 기관 데이터 접근 가능 | org_id 검증 강화 | 2-3일 |
| SEC-M6 | Webhook replay attack (Idempotency Key 없음) | 중복 Payment/Contact 생성 | Idempotency-Key 검증 | 3-4일 |
| SEC-M7 | GDPR deletion 미구현 | 개인정보 삭제 요청 미이행 | GDPR deletion cascade 로직 | 4-5일 |

### mabiz CRM Code Quality (8개)
| ID | 파일 | 문제 | 영향 | 해결책 |
|-----|------|------|------|--------|
| T1 | `src/app/api/campaigns/route.ts:64` | `where: any` | 타입체크 미흡 | Prisma.CrmMarketingCampaignWhereInput |
| T3 | `src/lib/lens-classifier/index.ts:312` | 캐시 메모리 누수 | 메모리 사용량 증가 | TTL 24h 설정 |
| Q2 | `src/app/api/sync/cruisedot-to-crm/route.ts:30-148` | N+1 쿼리 (개별 upsert) | DB 부하 ↑ | Promise.all 배치 처리 |
| L2 | Contact 나이 범위 | Age validation 없음 | 음수/999세 저장 가능 | MAX_AGE (150) 체크 |
| W2 | Fire-and-forget 에러 | 실패 원인 파악 곤란 | 에러 로깅 + 메타데이터 추가 | Structured logging |
| A1 | `src/app/api/contacts/route.ts:147-151` | Pagination 불일치 (cursor vs offset) | API 클라이언트 혼동 | 단일 pagination 스타일로 통일 |
| A2 | `src/app/api/comparisons/detect-mention/route.ts:33` | Type casting `as` | 타입체크 우회 | Zod schema 검증 |
| ISS-02 | Contact 생성 UPSERT 미완성 | 동시 Payment 중복 생성 | Race condition | UPSERT unique (payment_id) 제약 |

### cruisedot Security (4개)
| ID | 문제 | 영향 | 해결책 |
|-----|------|------|--------|
| SEC-C7 | Hardcoded password functions | 패턴 유추 가능 | 함수 제거 → bcrypt 통일 |
| SEC-C8 | Input validation 미흡 (SQL injection 위험) | DB 직접 접근 | Sanitization + parameterized queries |
| SEC-C9 | Session timeout 미설정 | 무한 세션 유지 | 30분/1시간 timeout + refresh token |
| SEC-C10 | 파일 업로드 경로 예측 가능 | 임의 파일 접근 | UUID 기반 경로 + 미디어 서버 분리 |

### cruisedot Code Quality (12개)
| ID | 파일 | 문제 | 영향 | 우선순위 |
|-----|------|------|------|---------|
| CQ1 | `src/components/pnr/ReservationForm.tsx` | 2,742줄 초대형 컴포넌트 | 가독성 ↓, 리렌더링 ↑ | 기능별 분할 |
| CQ2 | `src/app/(dashboard)/admin/organizations/page.tsx` | 850줄 과도한 크기 | 유지보수성 ↓ | 컴포넌트 4개 분리 |
| CQ3 | `src/app/(dashboard)/contacts/[id]/page.tsx` | 1,220줄, 24개 useState | 코드 복잡도 ↑ | useReducer 도입 |
| CQ4 | `src/lib/cron/execute-campaigns.ts` | 1,024줄 단일 파일 | 함수 응집도 ↓ | 3개 모듈로 분할 |
| CQ5 | 여러 API route | `Record<string, any>` 타입 | 타입 안전성 ↓ | 구체적 인터페이스 정의 |
| CQ6 | 여러 페이지 | 복잡한 조건식 | 가독성 ↓ | Type guard 함수로 리팩토링 |
| CQ7 | 여러 API | 일반적 에러 메시지만 반환 | 디버깅 곤란 | 에러 분류 (ValidationError, AuthError 등) |
| CQ8 | `src/components/pnr/*` | Fetch .then()에서 .catch() 미지정 | 실패 시 침묵 | try-catch-finally 도입 |
| CQ9 | `src/app/(dashboard)/passport/page.tsx` | 1,958줄 대량 데이터 렌더링 | Lighthouse LCP ↑ | React Window + 페이지네이션 |
| CQ10 | `src/app/(dashboard)/b2b/buyers/*` | useEffect 의존성 배열 누락 | 무한 루프/재렌더링 | 필요 의존성만 지정 |
| CQ11 | `src/lib/contact/sms-onboarding-parser.ts` | 반복문 내 개별 쿼리 | N+1 문제 | 배치 쿼리/JOIN |
| CQ12 | 여러 파일 | `as any` 단언 사용 | 타입체크 우회 | 런타임 검증 후 단언 |

### Integration Gaps (3개)
| ID | 문제 | 영향 | 우선순위 |
|-----|------|------|---------|
| ISS-04 | Refund 시 Contact SMS flag 미초기화 | 재구매 Day 0-3 자동화 실패 | SMS flag reset logic 추가 |
| ISS-07 | Inquiry 담당자 자동할당 미지정 | Inquiry 처리 지연 | Weighted Round-Robin 할당 |
| ISS-02 (코드품질) | UPSERT 패턴 미완성 | Race condition | Unique constraint 추가 |

**🎯 P1 커밋 배치:** 
- `fix/p1-security-rbac-gdpr` (5개)
- `fix/p1-codebase-types-safety` (8개)
- `fix/p1-integration-gaps` (3개)

---

## 🟡 P2 - MEDIUM (2주 내)

### mabiz CRM
- SEC-M8: Audit logs 미구현
- Performance: KPI dashboard 3.5s → 600ms (병렬 쿼리)
- Performance: Contact query 270ms → 35ms (캐싱)

### cruisedot  
- SEC-C11: Rate limiting 미흡
- SEC-C12: Error message가 시스템 정보 leak
- SEC-C13: CSRF token 미중앙화
- SEC-C14: XSS 방어 (DOMPurify) 불완전
- CQ13: Password policy 약함 (8chars → 12chars + 복잡도)
- Performance: 이미지 로딩 1.5s → 1.0s (WebP + lazy)

**🎯 P2 커밋 배치:** `fix/p2-security-logging-performance` (8개)

---

## 🟢 P3 - LOW (월간)

### Maintenance
- Dead code 제거 (ESLint `no-unused-vars`)
- useEffect cleanup 함수 추가 (메모리 누수 방지)
- Recharts formatter 타입 명시 (any → number)
- 불필요한 리렌더링 최적화 (useCallback)

**🎯 P3 커밋 배치:** `refactor/p3-maintenance-cleanup` (4개)

---

## 📊 커밋 배치 계획

| 배치 | 커밋 수 | 파일 영향 | 테스트 필요 | 배포 영향 |
|------|--------|----------|-----------|---------|
| P0 (긴급) | 6 | 12개 | ✅ 필수 | 즉시 |
| P1 (높음) | 16 | 45개 | ✅ 필수 | 1주 내 |
| P2 (중간) | 8 | 28개 | ✅ 권장 | 2주 |
| P3 (낮음) | 4 | 16개 | ⭐ 선택 | 월간 |

**총 작업량:** 34개 커밋 | **코드 영향:** 101개 파일 수정

---

## ✅ 다음 단계 (사용자 승인 필요)

```
1️⃣ P0 커밋 배치 검토 & 승인
   ↓
2️⃣ P0 fix 작업 + 테스트 (1-2일)
   ↓
3️⃣ P0 커밋 생성 & 검증
   ↓
4️⃣ 사용자: Vercel 배포 여부 결정
   ↓
5️⃣ P1 작업 시작 (병렬 진행 가능)
```

---

**작성:** 2026-05-27 | **상태:** 모든 검증 완료, 커밋 준비 대기 중
