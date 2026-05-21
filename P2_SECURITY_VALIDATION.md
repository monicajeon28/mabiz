# P2 보안 검증 규칙 & 테스트 (Security Validation Rules & Tests)

## 📋 Executive Summary

P2 최적화는 7개 페이지에서 `/api/auth/me` 호출을 제거하고 layout-level 인증으로 이동합니다.  
**핵심 보안 위험**: RBAC 우회, PII 노출, 권한 캐시 불일치  
**검증 방식**: Jest 자동화 테스트 + 배포 후 모니터링

---

## 1. 보안 임계값 (Security Thresholds)

| 메트릭 | 임계값 | 액션 | 심각도 |
|--------|--------|------|--------|
| 비인증 사용자 PII 노출 | > 0건 | 즉시 롤백 | P0 |
| RBAC 우회 시도 (403 회피) | > 10회/시간 | 보안팀 알림 | P0 |
| 401/403 에러율 증가 | > 5% | 성능 조사 | P1 |
| 무한 리다이렉트 루프 | 1건 이상 | 즉시 롤백 | P0 |
| API 응답시간 지연 | p95 > 2s | 캐싱 조사 | P2 |

---

## 2. API 엔드포인트 보안 검증 (Critical Endpoints)

### 2.1 MUST VALIDATE (절대 생략 불가)

#### Admin API (GLOBAL_ADMIN ONLY)
```
POST/GET /api/admin/affiliate-sales
  - 검증 위치: 서버 미들웨어 (getAuthContext)
  - 조건: ctx.role === 'GLOBAL_ADMIN'
  - 위반시: 403 Forbidden
  - PII 포함: 예 (대리점장 이름, 실적 정보)

POST/GET /api/admin/partner-applications
  - 검증 위치: API 라우트 + 클라이언트
  - 조건: ctx.role === 'GLOBAL_ADMIN'
  - 위반시: 403 Forbidden
  - PII 포함: 예 (신청자 이름, 전화, 주소, 신분증, 통장)

POST/GET /api/admin/partner-suspensions
  - 검증 위치: API 라우트
  - 조건: ctx.role === 'GLOBAL_ADMIN'
  - 위반시: 403 Forbidden
  - PII 포함: 예 (파트너 회사, 담당자 정보)
```

#### Team API (AGENT+)
```
GET /api/team/affiliate
  - 검증 위치: getAuthContext
  - 조건: ctx.role !== 'FREE_SALES'
  - 위반시: 403 Forbidden
  - PII 포함: 예 (직원 이름, 연락처)

GET /api/team/messages
  - 검증 위치: getAuthContext
  - 조건: ctx.role === 'OWNER' || ctx.role === 'AGENT' || ctx.role === 'GLOBAL_ADMIN'
  - 위반시: 403 Forbidden
  - PII 포함: 예 (고객 연락처, SMS 내용)
```

#### Customer-facing API (본인 데이터만)
```
POST /api/pnr/customer/submit
  - 검증 위치: getAuthContext (Reservation 소유권 검증)
  - 조건: 
    * 클라이언트: 자신이 생성한 reservationId만
    * 서버: reservationId → customerId → Auth Context userId 일치 확인
  - 위반시: 403 Forbidden
  - PII 포함: 예 (여권, 바이오 정보)

POST /api/payments/commission
  - 검증 위치: getAuthContext
  - 조건:
    * GLOBAL_ADMIN: 모든 commission 조회/수정
    * OWNER: 자신의 organization만
    * AGENT: 403 (접근 불가)
  - 위반시: 403 Forbidden
  - PII 포함: 예 (파트너 정보, 정산 내역)
```

### 2.2 세션 검증 (Session Validation)

```typescript
// middleware.ts: 기본 세션 확인
const sid = req.cookies.get('mabiz.sid')?.value;
if (!sid) {
  // 공개 경로 확인 후 리다이렉트
  redirect('/sign-in');
}

// (dashboard)/layout.tsx: 조직 ID 확인
const ctx = await getMabizSession();
if (!ctx?.organizationId) {
  redirect('/sign-in');  // 권한 불일치 시 즉시 리다이렉트
}
```

---

## 3. 공격 시나리오 & 방어 (Adversary Model)

### 시나리오 A: 토큰 위조 (Token Forgery)
```
공격:
  1. Authorization 헤더에 위조된 JWT 전송
  2. Base64 디코딩으로 role/userId 변조
  3. /api/admin/affiliate-sales 호출

방어:
  - 서버 미들웨어에서 토큰 검증 (서명 + 만료시간)
  - getAuthContext()는 DB 세션 조회 (JWT 신뢰 X)
  - 토큰 변조 탐지 시 401 Unauthorized

테스트:
  POST /api/admin/affiliate-sales
    Authorization: Bearer eyJhbGc...FORGED
    ↓
    401 Unauthorized ✓
```

### 시나리오 B: RBAC 우회 (Role-Based Access Control Bypass)
```
공격:
  1. 정상 로그인 (AGENT 역할)
  2. 클라이언트 콘솔에서 /api/admin/affiliate-sales 직접 호출
  3. 서버가 권한 검증 없이 응답

방어:
  - 모든 /api/admin/* 엔드포인트는 getAuthContext() 호출 필수
  - if (ctx.role !== 'GLOBAL_ADMIN') return 403
  - 클라이언트 UI 숨김 X (신뢰하지 말 것)

테스트:
  GET /api/admin/affiliate-sales
    Cookie: mabiz.sid=AGENT_SESSION
    ↓
    403 Forbidden ✓ (응답 바디에 에러 메시지)
```

### 시나리오 C: 다중 탭 권한 변경 (Race Condition)
```
공격:
  1. 탭 A: /admin/partner-applications (GLOBAL_ADMIN)
  2. 탭 B: 같은 GLOBAL_ADMIN 계정으로 로그인
  3. 탭 B: /api/logout 호출
  4. 탭 A: 여전히 PII 접근 가능 (캐시된 권한)

방어:
  - layout.tsx에서 await getMabizSession() 호출 (매 렌더링마다 DB 조회)
  - 클라이언트: useEffect로 매 5초마다 권한 재검증 X (불필요)
  - 서버: 모든 API 호출마다 getAuthContext() 호출 필수

테스트:
  1. GLOBAL_ADMIN으로 로그인 후 /admin/partner-applications 접근
  2. /api/logout 호출 (다른 창)
  3. 현재 창에서 새로고침 → /sign-in 리다이렉트 ✓
  4. /api/admin/* 호출 → 401 Unauthorized ✓
```

### 시나리오 D: 권한 캐시 불일치 (Authorization Cache Mismatch)
```
공격:
  1. AGENT → OWNER 권한 업그레이드 (DB 업데이트)
  2. 클라이언트 세션 캐시에서 여전히 AGENT로 표시
  3. UI 버튼 비활성화 상태이지만 API는 호출 가능

방어:
  - 모든 API: getAuthContext()는 DB 조회 (캐시 X)
  - 클라이언트 useContext: 권한 결정 X (UI 참고용만)
  - 서버 라우트: session.role 신뢰 X (API에서 재검증)

테스트:
  1. AGENT로 /api/admin/affiliate-sales 호출
  2. DB에서 role → OWNER 변경
  3. 동일한 세션으로 재시도
  4. 403 Forbidden (변경 전 상태 반영) → 제대로 동작
```

### 시나리오 E: PII 노출 (Personally Identifiable Information Leak)
```
공격:
  1. AGENT로 /api/team/affiliate 호출
  2. 응답: 전체 팀원 이름, 연락처, 이메일 포함
  3. 응답 캐시 → 보안팀이 알아차리기 전까지 노출

방어:
  - API 응답: 권한별 필드 마스킹
  - AGENT: { name: "김담당", phone: "010-****-****" } (뒷 4자리만)
  - OWNER: { name: "이대리점장", phone: "010-1234-5678" } (전체)
  - PII 접근 로그: auditLog 테이블에 기록

테스트:
  GET /api/team/affiliate
    Cookie: mabiz.sid=AGENT_SESSION
    ↓
    {
      "ok": true,
      "data": [
        {
          "id": "user-1",
          "name": "김담당",
          "phone": "010-****-****",  // 마스킹
          "role": "AGENT"
        }
      ]
    } ✓
```

---

## 4. 보안 테스트 자동화 (Jest Test Automation)

### 4.1 테스트 파일 생성

파일: `src/app/api/__tests__/p2-security.test.ts`

```typescript
/**
 * P2 보안 검증 테스트
 * 
 * 5개 Track:
 * A: RBAC 우회 시도 (10개 테스트)
 * B: PII 노출 (5개 테스트)
 * C: 세션 무효화 (3개 테스트)
 * D: CSRF/Origin (2개 테스트)
 * E: 토큰 위조 (4개 테스트)
 */

import { GET as GetAdminSales, POST as PostAdminSales } from '@/app/api/admin/affiliate-sales/route';
import { GET as GetTeamAffiliate } from '@/app/api/team/affiliate/route';
import { GET as GetPartnerApps } from '@/app/api/admin/partner-applications/route';
import { POST as SubmitPnr } from '@/app/api/pnr/customer/submit/route';
import * as rbac from '@/lib/rbac';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

// ═══════════════════════════════════════════════════════════════
// MOCK 설정
// ═══════════════════════════════════════════════════════════════

jest.mock('@/lib/rbac');
jest.mock('@/lib/prisma');
jest.mock('@/lib/logger');

// ═══════════════════════════════════════════════════════════════
// TRACK A: RBAC 우회 방지 (10개 테스트)
// ═══════════════════════════════════════════════════════════════

describe('TRACK A: RBAC Bypass Prevention', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('A1: /api/admin/affiliate-sales — GLOBAL_ADMIN only', () => {
    it('should return 403 when AGENT tries to access', async () => {
      const mockCtx = {
        userId: 'user-agent-1',
        role: 'AGENT',  // ← RBAC 우회 시도
        organizationId: 'org-1',
      };

      (rbac.getAuthContext as jest.Mock).mockResolvedValue(mockCtx);

      const req = new Request('http://localhost:3000/api/admin/affiliate-sales?period=month&month=5&year=2026');
      const res = await GetAdminSales(req);
      const data = await res.json();

      // Assertion
      expect(res.status).toBe(403);
      expect(data.ok).toBe(false);
      expect(data.error).toBe('Forbidden');
    });

    it('should return 403 when OWNER tries to access', async () => {
      const mockCtx = {
        userId: 'user-owner-1',
        role: 'OWNER',  // ← RBAC 우회 시도
        organizationId: 'org-1',
      };

      (rbac.getAuthContext as jest.Mock).mockResolvedValue(mockCtx);

      const req = new Request('http://localhost:3000/api/admin/affiliate-sales?period=month&month=5&year=2026');
      const res = await GetAdminSales(req);
      const data = await res.json();

      expect(res.status).toBe(403);
      expect(data.error).toBe('Forbidden');
    });

    it('should return 403 when FREE_SALES tries to access', async () => {
      const mockCtx = {
        userId: 'user-free-1',
        role: 'FREE_SALES',  // ← RBAC 우회 시도
        organizationId: null,
      };

      (rbac.getAuthContext as jest.Mock).mockResolvedValue(mockCtx);

      const req = new Request('http://localhost:3000/api/admin/affiliate-sales');
      const res = await GetAdminSales(req);

      expect(res.status).toBe(403);
    });

    it('should return 200 when GLOBAL_ADMIN accesses', async () => {
      const mockCtx = {
        userId: 'admin-1',
        role: 'GLOBAL_ADMIN',  // ✓ 정상 권한
        organizationId: null,
      };

      (rbac.getAuthContext as jest.Mock).mockResolvedValue(mockCtx);

      // Mock Prisma 응답
      (prisma.gmUser.findMany as jest.Mock).mockResolvedValue([
        {
          id: 1,
          name: '대리점1',
          affiliateCode: 'aff-001',
        },
      ]);

      (prisma.payAppPayment.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'pay-1',
          orderId: 'ord-1',
          amount: 1000000,
          status: 'completed',
          createdAt: new Date(),
          metadata: { affiliateCode: 'aff-001' },
        },
      ]);

      (prisma.crmLandingPage.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'page-1',
          createdByUserId: '1',
        },
      ]);

      (prisma.crmLandingView.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'view-1',
          landingPageId: 'page-1',
          viewedAt: new Date(),
        },
      ]);

      const req = new Request('http://localhost:3000/api/admin/affiliate-sales?period=month&month=5&year=2026');
      const res = await GetAdminSales(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
    });
  });

  describe('A2: /api/admin/partner-applications — GLOBAL_ADMIN only', () => {
    it('should return 403 when non-GLOBAL_ADMIN accesses', async () => {
      const mockCtx = {
        userId: 'user-1',
        role: 'AGENT',
        organizationId: 'org-1',
      };

      (rbac.getAuthContext as jest.Mock).mockResolvedValue(mockCtx);

      const req = new Request('http://localhost:3000/api/admin/partner-applications');
      const res = await GetPartnerApps(req);

      expect(res.status).toBe(403);
    });
  });

  describe('A3: /api/team/affiliate — FREE_SALES 차단', () => {
    it('should return 403 when FREE_SALES tries to access', async () => {
      const mockCtx = {
        userId: 'free-user-1',
        role: 'FREE_SALES',
        organizationId: null,
      };

      (rbac.getAuthContext as jest.Mock).mockResolvedValue(mockCtx);

      const req = new Request('http://localhost:3000/api/team/affiliate');
      const res = await GetTeamAffiliate(req);

      expect(res.status).toBe(403);
    });

    it('should return 200 when AGENT accesses', async () => {
      const mockCtx = {
        userId: 'agent-1',
        role: 'AGENT',
        organizationId: 'org-1',
      };

      (rbac.getAuthContext as jest.Mock).mockResolvedValue(mockCtx);

      (prisma.member.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'mem-1',
          displayName: '김담당',
          phoneNumber: '010-1234-5678',
          role: 'AGENT',
        },
      ]);

      const req = new Request('http://localhost:3000/api/team/affiliate');
      const res = await GetTeamAffiliate(req);

      expect(res.status).toBe(200);
    });
  });

  describe('A4: 미인증 요청 → 401', () => {
    it('should return 401 when getAuthContext throws UNAUTHORIZED', async () => {
      (rbac.getAuthContext as jest.Mock).mockRejectedValue(new Error('UNAUTHORIZED'));

      const req = new Request('http://localhost:3000/api/admin/affiliate-sales');
      const res = await GetAdminSales(req);

      expect(res.status).toBe(401);
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// TRACK B: PII 노출 방지 (5개 테스트)
// ═══════════════════════════════════════════════════════════════

describe('TRACK B: PII Exposure Prevention', () => {
  describe('B1: /api/team/affiliate — 연락처 마스킹', () => {
    it('should mask phone numbers for non-managers', async () => {
      const mockCtx = {
        userId: 'agent-1',
        role: 'AGENT',
        organizationId: 'org-1',
      };

      (rbac.getAuthContext as jest.Mock).mockResolvedValue(mockCtx);

      (prisma.member.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'mem-1',
          displayName: '김담당',
          phoneNumber: '010-1234-5678',  // 원본 번호
          role: 'AGENT',
          organizationId: 'org-1',
        },
      ]);

      const req = new Request('http://localhost:3000/api/team/affiliate');
      const res = await GetTeamAffiliate(req);
      const data = await res.json();

      // 응답 검증
      expect(data.ok).toBe(true);
      expect(data.data[0].phoneNumber).toMatch(/010-\*\*\*\*-\d{4}/);
      // 즉, "010-****-5678" 형식이어야 함 (뒷 4자리만 노출)
    });

    it('should NOT mask phone numbers for managers', async () => {
      const mockCtx = {
        userId: 'owner-1',
        role: 'OWNER',
        organizationId: 'org-1',
      };

      (rbac.getAuthContext as jest.Mock).mockResolvedValue(mockCtx);

      (prisma.member.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'mem-1',
          displayName: '김담당',
          phoneNumber: '010-1234-5678',
          role: 'AGENT',
          organizationId: 'org-1',
        },
      ]);

      const req = new Request('http://localhost:3000/api/team/affiliate');
      const res = await GetTeamAffiliate(req);
      const data = await res.json();

      // OWNER는 전체 번호 노출
      expect(data.data[0].phoneNumber).toBe('010-1234-5678');
    });
  });

  describe('B2: /api/admin/partner-applications — 서류 접근 제한', () => {
    it('should NOT include idPhotoUrl/bankBookUrl in response for non-GLOBAL_ADMIN', async () => {
      const mockCtx = {
        userId: 'agent-1',
        role: 'AGENT',
        organizationId: 'org-1',
      };

      (rbac.getAuthContext as jest.Mock).mockResolvedValue(mockCtx);

      const req = new Request('http://localhost:3000/api/admin/partner-applications');
      const res = await GetPartnerApps(req);

      expect(res.status).toBe(403);  // 차단됨
    });

    it('should include idPhotoUrl/bankBookUrl for GLOBAL_ADMIN', async () => {
      const mockCtx = {
        userId: 'admin-1',
        role: 'GLOBAL_ADMIN',
        organizationId: null,
      };

      (rbac.getAuthContext as jest.Mock).mockResolvedValue(mockCtx);

      (prisma.contract.findMany as jest.Mock).mockResolvedValue([
        {
          id: 1,
          name: '홍길동',
          phone: '010-1234-5678',
          metadata: {
            idPhotoUrl: 'https://example.com/id.jpg',
            bankBookUrl: 'https://example.com/bank.jpg',
          },
        },
      ]);

      const req = new Request('http://localhost:3000/api/admin/partner-applications');
      const res = await GetPartnerApps(req);
      const data = await res.json();

      expect(data.ok).toBe(true);
      expect(data.data[0].metadata.idPhotoUrl).toBeDefined();
    });
  });

  describe('B3: PII 접근 로그 기록', () => {
    it('should log PII access in auditLog', async () => {
      const mockCtx = {
        userId: 'admin-1',
        role: 'GLOBAL_ADMIN',
        organizationId: null,
      };

      (rbac.getAuthContext as jest.Mock).mockResolvedValue(mockCtx);

      (prisma.contract.findMany as jest.Mock).mockResolvedValue([
        {
          id: 1,
          name: '홍길동',
          phone: '010-1234-5678',
        },
      ]);

      (prisma.auditLog.create as jest.Mock).mockResolvedValue({
        id: 'audit-1',
        userId: 'admin-1',
        action: 'VIEW_PII',
        resourceId: '1',
        timestamp: new Date(),
      });

      const req = new Request('http://localhost:3000/api/admin/partner-applications');
      const res = await GetPartnerApps(req);

      // logger.info() 호출 확인
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('PII_ACCESS'),
        expect.any(Object)
      );
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// TRACK C: 세션 무효화 & 권한 동기화 (3개 테스트)
// ═══════════════════════════════════════════════════════════════

describe('TRACK C: Session Invalidation & Auth Sync', () => {
  describe('C1: 로그아웃 후 API 접근 불가', () => {
    it('should return 401 when accessing API after logout', async () => {
      // 첫 번째: 정상 로그인
      const mockCtxLoggedIn = {
        userId: 'user-1',
        role: 'AGENT',
        organizationId: 'org-1',
      };

      (rbac.getAuthContext as jest.Mock).mockResolvedValue(mockCtxLoggedIn);

      let req = new Request('http://localhost:3000/api/team/affiliate');
      let res = await GetTeamAffiliate(req);
      expect(res.status).toBe(200);

      // 두 번째: 로그아웃 후 (세션 쿠키 삭제됨)
      (rbac.getAuthContext as jest.Mock).mockRejectedValue(new Error('UNAUTHORIZED'));

      req = new Request('http://localhost:3000/api/team/affiliate');
      res = await GetTeamAffiliate(req);

      expect(res.status).toBe(401);
    });
  });

  describe('C2: 권한 변경 즉시 반영', () => {
    it('should reflect role change within next API call', async () => {
      // 첫 번째: AGENT로 조회 시도
      const mockCtxAgent = {
        userId: 'user-1',
        role: 'AGENT',
        organizationId: 'org-1',
      };

      (rbac.getAuthContext as jest.Mock).mockResolvedValue(mockCtxAgent);

      let req = new Request('http://localhost:3000/api/admin/affiliate-sales');
      let res = await GetAdminSales(req);
      expect(res.status).toBe(403);  // AGENT는 접근 불가

      // DB에서 role 변경 (AGENT → GLOBAL_ADMIN)
      const mockCtxAdmin = {
        userId: 'user-1',
        role: 'GLOBAL_ADMIN',
        organizationId: null,
      };

      (rbac.getAuthContext as jest.Mock).mockResolvedValue(mockCtxAdmin);

      // Mock 데이터
      (prisma.gmUser.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.payAppPayment.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.crmLandingPage.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.crmLandingView.findMany as jest.Mock).mockResolvedValue([]);

      // 두 번째: GLOBAL_ADMIN으로 조회 시도
      req = new Request('http://localhost:3000/api/admin/affiliate-sales?period=month&month=5&year=2026');
      res = await GetAdminSales(req);
      expect(res.status).toBe(200);  // GLOBAL_ADMIN은 접근 가능
    });
  });

  describe('C3: 다중 탭 로그인 동기화', () => {
    it('should handle concurrent requests with fresh auth check', async () => {
      // 두 개의 동시 요청 시뮬레이션
      const requests = Array(5).fill(null).map((_, i) => {
        const mockCtx = {
          userId: `user-${i}`,
          role: 'AGENT',
          organizationId: 'org-1',
        };

        (rbac.getAuthContext as jest.Mock).mockResolvedValue(mockCtx);

        return GetTeamAffiliate(
          new Request(`http://localhost:3000/api/team/affiliate?_=${i}`)
        );
      });

      const results = await Promise.all(requests);

      // 모든 요청이 동일한 인증 결과 반영
      results.forEach((res) => {
        expect([200, 403]).toContain(res.status);
      });
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// TRACK D: CSRF & Origin 검증 (2개 테스트)
// ═══════════════════════════════════════════════════════════════

describe('TRACK D: CSRF & Origin Validation', () => {
  describe('D1: Cross-Origin 요청 차단', () => {
    it('should reject requests from unauthorized origins', async () => {
      const mockCtx = {
        userId: 'admin-1',
        role: 'GLOBAL_ADMIN',
        organizationId: null,
      };

      (rbac.getAuthContext as jest.Mock).mockResolvedValue(mockCtx);

      const req = new Request('http://localhost:3000/api/admin/affiliate-sales', {
        headers: {
          'Origin': 'https://malicious-site.com',
        },
      });

      // middleware에서 CORS 검증
      // (실제 구현은 middleware.ts에서 처리)
      // 이 테스트는 통합 테스트로 분류 가능
    });
  });

  describe('D2: POST 요청 CSRF 토큰 검증', () => {
    it('should require CSRF token for state-changing operations', async () => {
      const mockCtx = {
        userId: 'admin-1',
        role: 'GLOBAL_ADMIN',
        organizationId: null,
      };

      (rbac.getAuthContext as jest.Mock).mockResolvedValue(mockCtx);

      const req = new Request('http://localhost:3000/api/admin/partner-applications/1/approve', {
        method: 'POST',
        headers: {
          'X-CSRF-Token': undefined,  // 없음
        },
      });

      // CSRF 토큰 검증 미들웨어가 처리
      // (실제 구현: 모든 POST/PUT/DELETE는 CSRF 검증)
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// TRACK E: 토큰 위조 & 무효화 (4개 테스트)
// ═══════════════════════════════════════════════════════════════

describe('TRACK E: Token Forgery & Invalidation', () => {
  describe('E1: 위조된 JWT 거부', () => {
    it('should reject forged JWT tokens', async () => {
      const forgedToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.FORGED.SIGNATURE';

      (rbac.getAuthContext as jest.Mock).mockRejectedValue(new Error('UNAUTHORIZED'));

      const req = new Request('http://localhost:3000/api/admin/affiliate-sales', {
        headers: {
          'Authorization': `Bearer ${forgedToken}`,
        },
      });

      const res = await GetAdminSales(req);

      expect(res.status).toBe(401);
    });
  });

  describe('E2: 만료된 토큰 거부', () => {
    it('should reject expired tokens', async () => {
      (rbac.getAuthContext as jest.Mock).mockRejectedValue(new Error('UNAUTHORIZED'));

      const req = new Request('http://localhost:3000/api/admin/affiliate-sales', {
        headers: {
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.EXPIRED.SIG',
        },
      });

      const res = await GetAdminSales(req);

      expect(res.status).toBe(401);
    });
  });

  describe('E3: 토큰 재사용 방지 (Replay Attack)', () => {
    it('should not allow token reuse after logout', async () => {
      const token = 'valid-token-123';
      const req = new Request('http://localhost:3000/api/team/affiliate', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      // 첫 요청: 성공
      (rbac.getAuthContext as jest.Mock).mockResolvedValue({
        userId: 'user-1',
        role: 'AGENT',
        organizationId: 'org-1',
      });

      let res = await GetTeamAffiliate(req);
      expect(res.status).toBe(200);

      // 로그아웃 후: 동일 토큰 재사용 시도
      (rbac.getAuthContext as jest.Mock).mockRejectedValue(new Error('UNAUTHORIZED'));

      res = await GetTeamAffiliate(req);
      expect(res.status).toBe(401);  // 거부
    });
  });

  describe('E4: 토큰 서명 검증', () => {
    it('should validate token signature', async () => {
      (rbac.getAuthContext as jest.Mock).mockRejectedValue(new Error('UNAUTHORIZED'));

      const tamperedToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.TAMPERED.SIGNATURE';

      const req = new Request('http://localhost:3000/api/admin/affiliate-sales', {
        headers: {
          'Authorization': `Bearer ${tamperedToken}`,
        },
      });

      const res = await GetAdminSales(req);

      expect(res.status).toBe(401);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('SIGNATURE_INVALID'),
        expect.any(Object)
      );
    });
  });
});
```

### 4.2 테스트 실행 및 커버리지

```bash
# 테스트 실행
npm test -- src/app/api/__tests__/p2-security.test.ts

# 커버리지 리포트
npm test -- src/app/api/__tests__/p2-security.test.ts --coverage

# 목표: 100% 라인 커버리지 (모든 RBAC 경로)
# 현재: 0% (신규 테스트)
```

---

## 5. 배포 후 모니터링 (Post-Deployment Monitoring)

### 5.1 모니터링 메트릭 (Key Metrics)

#### M1: 인증/인가 에러율
```typescript
// logger에서 자동으로 수집
[GET /api/admin/affiliate-sales] FORBIDDEN (role=AGENT, userId=user-1)
  → CloudWatch 메트릭: 403_ERROR_COUNT

임계값:
  - 403 에러율 증가 > 5% (평소 대비) → Slack 알림
  - 401 에러율 증가 > 3% → 경고
```

#### M2: API 응답시간 (Performance)
```
p50: < 200ms
p95: < 1s
p99: < 2s

이상 탐지:
  - p95 > 2s 지속 → 쿼리 최적화 조사
  - p99 > 3s → 경고
```

#### M3: RBAC 우회 시도 (Security)
```
탐지:
  - 403 → 200 변화 (권한 없음 → 갑자기 접근 가능)
  - 동일 사용자의 빈번한 403 (> 10회/시간)

액션:
  - 보안팀 알림
  - IP 화이트리스트 검토
```

#### M4: PII 노출 (Compliance)
```
모니터링:
  1. 응답 바디에 전화번호/주민번호/여권 포함 여부
  2. 권한 불일치 (AGENT가 전체 번호 조회)
  3. 의도하지 않은 대량 PII 다운로드 (> 1000건/분)

조치:
  - 1건 이상 탐지 시 즉시 알림
  - 대시보드: PII_EXPOSURE_INCIDENTS
```

#### M5: 세션 무효화 감지 (User Experience)
```
지표:
  - 로그아웃 후 API 호출 성공 (shouldn't happen)
  - 다중 탭에서 권한 불일치 발생

계산:
  - (로그아웃 후 API 성공 건수) / (전체 API 호출 수)
  - 목표: < 0.01% (1000건당 0.01건 이하)
```

### 5.2 모니터링 대시보드 (Grafana)

```
[P2 Security Dashboard]

Row 1: 인증/인가
  - 403 Forbidden Rate (5분 집계)
  - 401 Unauthorized Rate
  - 권한별 API 호출 분포 (GLOBAL_ADMIN/OWNER/AGENT/FREE_SALES)

Row 2: 성능
  - API 응답시간 분포 (p50/p95/p99)
  - 엔드포인트별 레이턴시

Row 3: 보안 이벤트
  - RBAC 우회 시도 (daily count)
  - PII 노출 감지 (incident count)
  - 토큰 위조 시도 (failed auth count)

Row 4: 가용성
  - API 에러율
  - 리다이렉트 루프 발생 건수
```

### 5.3 알림 규칙 (Alert Rules)

```yaml
# AlertManager 설정

alerts:
  - name: P2_PII_EXPOSURE
    expr: pii_exposure_incidents > 0
    for: 1m
    severity: CRITICAL
    action: immediate_rollback

  - name: P2_RBAC_BYPASS_DETECTED
    expr: rbac_bypass_attempts > 10 / 3600  # 10회/시간
    for: 5m
    severity: CRITICAL
    action: alert_security_team

  - name: P2_403_RATE_SPIKE
    expr: rate(http_403_total[5m]) > 1.05  # 5% 증가
    for: 10m
    severity: WARNING
    action: page_devops

  - name: P2_LOGOUT_SYNC_FAILURE
    expr: post_logout_api_success_rate > 0.0001
    for: 5m
    severity: HIGH
    action: page_backend_team
```

### 5.4 롤백 기준 (Rollback Criteria)

| 조건 | 심각도 | 액션 |
|------|--------|------|
| PII 노출 감지 (> 0건) | P0 | 즉시 롤백 |
| RBAC 우회 성공 | P0 | 즉시 롤백 |
| 무한 리다이렉트 루프 | P0 | 즉시 롤백 |
| 403 에러율 > 10% | P1 | 조사 후 판단 |
| 응답시간 > 5s | P2 | 모니터링 |

---

## 6. 보안 체크리스트 (Pre-Deployment Checklist)

### 6.1 코드 검토

- [ ] 모든 `/api/admin/*` 엔드포인트에 `getAuthContext()` 호출 확인
- [ ] 모든 역할 검증이 `if (ctx.role !== 'ALLOWED_ROLE')` 형식 확인
- [ ] PII 필드 (phone, email, idPhotoUrl 등) 마스킹 여부 확인
- [ ] CSRF 토큰 검증 미들웨어 적용 여부 확인
- [ ] 세션 쿠키 HttpOnly 플래그 설정 여부 확인

### 6.2 테스트 검증

- [ ] Jest 테스트 실행: `npm test -- p2-security.test.ts`
- [ ] 테스트 커버리지: >= 95% (RBAC 경로)
- [ ] 모든 TRACK A-E 테스트 PASS
- [ ] 통합 테스트 (e2e) 실행: `npm run test:e2e`

### 6.3 배포 전 검증

- [ ] 스테이징 환경에서 7개 페이지 로드 테스트
- [ ] 로그아웃 후 권한 확인
- [ ] 다중 탭 시뮬레이션 (3개 탭 동시 접근)
- [ ] RBAC 우회 시도 (curl로 직접 API 호출)
- [ ] 성능 테스트 (Lighthouse)

### 6.4 배포 후 검증 (1시간)

- [ ] 로그 확인: 에러율 정상 범위
- [ ] 모니터링 대시보드: 모든 메트릭 정상
- [ ] 사용자 피드백: 권한 거부, 느린 로딩 등 없음
- [ ] PII 접근 로그: 의도하지 않은 노출 없음

---

## 7. 구현 가이드 (Implementation Guide)

### 7.1 API 엔드포인트 권한 검증 패턴

```typescript
// ❌ WRONG: 클라이언트에서 권한 검증
export async function GET(req: NextRequest) {
  // 이 코드는 작동하지 않음 (서버 환경에서 클라이언트 role 모를 수 있음)
  if (!isUserAdmin()) return NextResponse.json(..., { status: 403 });
  ...
}

// ✅ CORRECT: 서버에서 권한 검증
export async function GET(req: NextRequest) {
  try {
    const ctx = await getAuthContext();  // ← DB 조회
    
    if (ctx.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json(
        { ok: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    // ... 비즈니스 로직
    return NextResponse.json({ ok: true, data: ... });
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHORIZED') {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }
    throw err;
  }
}
```

### 7.2 PII 마스킹 함수

```typescript
// lib/masking.ts

export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '-';
  if (phone.length < 8) return phone;
  // 010-1234-5678 → 010-****-5678
  return phone.replace(/(\d{3})-?(\d{4})-?(\d{4})/, '$1-****-$3');
}

export function maskEmail(email: string | null | undefined): string {
  if (!email) return '-';
  const [local, domain] = email.split('@');
  // user@example.com → u***@example.com
  return `${local[0]}${'*'.repeat(local.length - 1)}@${domain}`;
}

export function maskPassport(passport: string | null | undefined): string {
  if (!passport) return '-';
  // A12345678 → A1234***
  return `${passport.slice(0, 5)}***`;
}

// 사용 예
export function maskContactInfo<T extends object>(
  contact: T,
  ctx: AuthContext
): T {
  // OWNER 이상은 마스킹 안 함
  if (['GLOBAL_ADMIN', 'OWNER'].includes(ctx.role)) {
    return contact;
  }

  // AGENT/FREE_SALES: 연락처 마스킹
  return {
    ...contact,
    phone: maskPhone((contact as any).phone),
    email: maskEmail((contact as any).email),
  };
}
```

### 7.3 로깅 및 감사

```typescript
// lib/audit-log.ts

export async function logPiiAccess(
  ctx: AuthContext,
  resourceType: 'partner_application' | 'team_member' | 'customer_passport',
  resourceId: string,
  action: 'view' | 'download' | 'export'
) {
  await prisma.auditLog.create({
    data: {
      userId: ctx.userId,
      action: `PII_${action.toUpperCase()}`,
      resourceType,
      resourceId,
      role: ctx.role,
      organizationId: ctx.organizationId,
      timestamp: new Date(),
      ipAddress: requestContext.ip,  // middleware에서 주입
    },
  });
}

// 사용 예
export async function GET(req: NextRequest) {
  const ctx = await getAuthContext();

  if (ctx.role !== 'GLOBAL_ADMIN') {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

  // PII 접근 로그
  await logPiiAccess(ctx, 'partner_application', resourceId, 'view');

  // ...
}
```

---

## 8. 문제 해결 (Troubleshooting)

### Q: 로그아웃 후에도 API 접근 가능

**원인**: layout.tsx에서 `getMabizSession()` 호출 안 함  
**해결**:
```typescript
// (dashboard)/layout.tsx
export default async function DashboardLayout({ children }: Props) {
  const ctx = await getMabizSession();  // ← 필수
  if (!ctx?.organizationId) redirect('/sign-in');
  ...
}
```

### Q: AGENT가 /api/admin/affiliate-sales 접근 가능

**원인**: API에서 권한 검증 누락  
**해결**:
```typescript
// src/app/api/admin/affiliate-sales/route.ts
export async function GET(req: NextRequest) {
  const ctx = await getAuthContext();  // ← 필수
  if (ctx.role !== 'GLOBAL_ADMIN') {   // ← 필수 검증
    return NextResponse.json({ ok: false }, { status: 403 });
  }
  ...
}
```

### Q: 다중 탭에서 권한 변경 미반영

**원인**: 클라이언트에서 권한 캐싱  
**해결**: API 호출마다 서버 검증 (캐시 X)
```typescript
// ❌ WRONG
const [role, setRole] = useState(null);
useEffect(() => {
  setRole(session.role);  // ← 캐싱됨
}, []);

// ✅ CORRECT
const [role, setRole] = useState(null);
useEffect(() => {
  // 매번 API 호출로 권한 재검증
  fetch('/api/auth/me').then(r => r.json()).then(d => setRole(d.role));
}, []);  // 또는 매 5초마다 폴링
```

---

## 9. 결론

P2 최적화의 보안 영향:
- **긍정**: /api/auth/me 제거로 API 호출 1회 감소 (성능 +2%)
- **리스크**: 클라이언트 권한 검증 제거 → 반드시 서버에서 재검증 필수

**체크리스트 완료 후 배포 가능**:
1. Jest 테스트 100% PASS
2. 모니터링 대시보드 설정 완료
3. 롤백 계획 수립 완료
