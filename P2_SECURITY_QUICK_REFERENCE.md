# P2 보안 Quick Reference (한눈에 보기)

## 🎯 3줄 요약

1. **P2 변경**: `/api/auth/me` 제거 → layout 인증으로 이동
2. **핵심 리스크**: 클라이언트 권한 검증 제거 → 반드시 서버에서 재검증
3. **해결책**: 모든 API에 `getAuthContext()` + 역할 검증 강제화

---

## ✅ 즉시 확인 사항

### API 엔드포인트 보안 검증

```bash
# 1. GLOBAL_ADMIN only 엔드포인트 확인
grep -r "GLOBAL_ADMIN" src/app/api/admin --include="*.ts" | wc -l

# 2. 모든 API에서 getAuthContext() 호출 확인
grep -r "getAuthContext" src/app/api --include="*.ts" | wc -l

# 3. 미검증 엔드포인트 찾기
grep -L "getAuthContext\|requirePartnerContext" src/app/api/**/*.ts

# 4. PII 마스킹 함수 적용 확인
grep -r "maskPhone\|maskEmail\|maskPassport" src/app/api --include="*.ts"
```

### layout.ts 검증

```bash
# (dashboard)/layout.tsx에서 getMabizSession() 호출 확인
grep -A3 "getMabizSession" src/app/\(dashboard\)/layout.tsx
```

---

## 🚨 배포 직전 체크리스트 (5분)

- [ ] Jest 테스트 PASS: `npm test -- p2-security.test.ts`
- [ ] 커버리지 >= 95%: `npm test -- p2-security.test.ts --coverage`
- [ ] 빌드 성공: `npm run build`
- [ ] CloudWatch 대시보드 활성화
- [ ] Slack 채널 준비 (#p2-security)

---

## 📊 배포 후 모니터링 (1시간 목표)

| 시간 | 확인 항목 | 정상 범위 | 넘으면 액션 |
|------|---------|---------|----------|
| 0-15min | 로그 에러율 | < 1% | 배포 중단 |
| 0-15min | RBAC 우회 시도 | 0건 | 즉시 조사 |
| 15-30min | PII 노출 | 0건 | 즉시 롤백 |
| 30-60min | API 응답시간 | p95 < 1s | 모니터링 |

---

## 🔐 권한별 API 접근 매트릭스

```
Endpoint                              GLOBAL_ADMIN  OWNER  AGENT  FREE_SALES
/api/admin/affiliate-sales                ✓         ✗      ✗       ✗
/api/admin/partner-applications           ✓         ✗      ✗       ✗
/api/admin/partner-suspensions            ✓         ✗      ✗       ✗
/api/team/affiliate                       ✓         ✓      ✓       ✗
/api/team/messages                        ✓         ✓      ✓       ✗
/api/pnr/customer/submit                  ✓         ✓      ✓       ✗
/api/payments/commission                  ✓         ✓      ✗       ✗
```

---

## 🧪 테스트 빠른 실행

```bash
# 전체 테스트
npm test -- p2-security.test.ts

# 특정 TRACK만 실행
npm test -- p2-security.test.ts --testNamePattern="TRACK A"
npm test -- p2-security.test.ts --testNamePattern="TRACK B"

# 커버리지 리포트
npm test -- p2-security.test.ts --coverage --coverageReporters=text-summary
```

---

## 🚀 배포 명령어

```bash
# 1. 코드 커밋
git add P2_SECURITY*.md src/app/api/__tests__/p2-security.test.ts
git commit -m "security(p2): Complete security validation & monitoring"
git push origin main

# 2. Vercel 자동 배포 (GitHub 연동)
# → CloudWatch 자동 활성화
# → Slack 알림 자동 전송

# 3. 긴급 롤백 (필요시)
curl -X POST https://crm.mabiz.co.kr/api/admin/rollback/p2 \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason": "PII_EXPOSURE", "triggerAlert": true}'
```

---

## 🔴 위험 신호 (Immediate Action Required)

```
이 중 하나라도 발생하면 즉시 롤백:

1. PII 노출 감지 (전화번호, 주민번호 노출)
   → POST /api/admin/rollback/p2?reason=PII_EXPOSURE

2. RBAC 우회 성공 (AGENT가 admin API 접근)
   → POST /api/admin/rollback/p2?reason=RBAC_BYPASS

3. 무한 리다이렉트 루프
   → POST /api/admin/rollback/p2?reason=REDIRECT_LOOP

4. 로그아웃 후 API 접근 가능
   → POST /api/admin/rollback/p2?reason=SESSION_BYPASS
```

---

## 📈 모니터링 대시보드 URL

```
CloudWatch Dashboard: https://console.aws.amazon.com/cloudwatch/
  → Dashboards → P2 Security

Slack Channels:
  #p2-security (모든 P0/P1)
  #p2-daily-report (일일 통계)
  #security-incidents (보안팀)

Custom Dashboard: https://dashboard.internal/p2-security
```

---

## 🆘 긴급 연락처

| 담당 | 이름 | 연락처 |
|------|------|--------|
| 보안팀 | - | #security-incidents |
| DevOps | - | #devops |
| 개발팀 | - | #development |
| 긴급 | - | PagerDuty |

---

## 📝 주요 코드 패턴

### ✅ CORRECT: API 권한 검증

```typescript
export async function GET(req: NextRequest) {
  try {
    const ctx = await getAuthContext();  // ← 필수
    
    if (ctx.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json(
        { ok: false, error: 'Forbidden' },
        { status: 403 }
      );
    }
    
    // ... 비즈니스 로직
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHORIZED') {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
    throw err;
  }
}
```

### ✅ CORRECT: Layout 인증

```typescript
export default async function DashboardLayout({ children }) {
  const ctx = await getMabizSession();  // ← 필수 (DB 조회)
  
  if (!ctx?.organizationId) {
    redirect('/sign-in');  // ← 권한 불일치 시 리다이렉트
  }
  
  return <div>...</div>;
}
```

### ✅ CORRECT: PII 마스킹

```typescript
export function maskPhone(phone: string): string {
  // 010-1234-5678 → 010-****-5678
  return phone.replace(/(\d{3})-?(\d{4})-?(\d{4})/, '$1-****-$3');
}

// 사용
const response = data.map(user => ({
  ...user,
  phone: ctx.role === 'OWNER' ? user.phone : maskPhone(user.phone),
}));
```

### ❌ WRONG: 클라이언트 권한 검증

```typescript
// 이건 작동하지 않음! 서버에서 권한 모를 수 있음
'use client';
function Page() {
  const { role } = useContext(AuthContext);
  if (role !== 'GLOBAL_ADMIN') return <div>Access Denied</div>;
  return <AdminPanel />;
}
```

---

## 📞 도움 필요할 때

```bash
# 테스트 커버리지 확인
npm test -- p2-security.test.ts --coverage

# 특정 API 권한 검증 확인
grep -n "ctx.role" src/app/api/admin/affiliate-sales/route.ts

# 마스킹 함수 확인
grep -r "maskPhone\|maskEmail" src/lib --include="*.ts"

# 배포 로그 확인
aws logs tail /aws/lambda/mabiz-crm --follow

# Slack으로 빠르게 물어보기
@security-bot "AGENT가 /api/admin/* 접근 가능한가?"
```

---

## 🎓 학습 자료

**필독문서**:
1. P2_SECURITY_VALIDATION.md (전체 검증 규칙)
2. P2_SECURITY_MONITORING.md (모니터링 설정)
3. P2_SECURITY_IMPLEMENTATION_SUMMARY.md (통합 가이드)

**참고코드**:
- src/app/api/admin/affiliate-sales/route.ts (✓ 권한 검증 패턴)
- src/app/(dashboard)/layout.tsx (✓ layout 인증 패턴)
- src/lib/rbac.ts (✓ 역할 정의)

---

## 🏁 최종 체크 (배포 5분 전)

```bash
# 1. 테스트 통과 확인
npm test -- p2-security.test.ts 2>&1 | tail -20

# 2. 빌드 성공 확인
npm run build 2>&1 | tail -5

# 3. CloudWatch 대시보드 확인
curl -s https://console.aws.amazon.com/cloudwatch/ | grep P2

# 4. Slack 채널 준비 확인
# → #p2-security 채널 존재하는가?
# → 알림 봇 추가되어 있는가?

# 5. 롤백 경로 확인
curl -X GET https://crm.mabiz.co.kr/api/admin/rollback/status \
  -H "Authorization: Bearer ADMIN_TOKEN"

# 모두 OK → 배포 진행
echo "✓ P2 배포 준비 완료"
```

---

**Last Updated**: 2026-05-20  
**Author**: Agent δ (Security)  
**Status**: ✅ Production Ready
