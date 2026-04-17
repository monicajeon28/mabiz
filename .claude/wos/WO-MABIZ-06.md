# WO-MABIZ-06 — 팀 성과 대시보드 2종
생성: 2026-04-17 | 상태: 실행 중

## 결정 사항
- GLOBAL_ADMIN 전용
- /team — CRM 팀 성과 (mabiz Contact 기반)
- /team/affiliate — 어필리에이트 수당 (크루즈몰 동일 수준, raw SQL)

## Agent A: /api/team/metrics
- 원본: cruise-guide-app /api/admin/affiliate/teams/metrics/route.ts
- 수정: getSessionUser → getAuthContext, GLOBAL_ADMIN 체크
- 수정: AffiliateProfile/AffiliateLedger → prisma.$queryRawUnsafe

## Agent B: /team/affiliate/page.tsx
- 원본: cruise-guide-app /app/admin/affiliate/team-dashboard/page.tsx (1830줄)
- 수정: react-icons → lucide-react
- 수정: fetch 경로 → /api/team/metrics
- 수정: GLOBAL_ADMIN 역할 체크 추가

## Agent C: /team/page.tsx + 사이드바
- mabiz Contact/CallLog 기반 CRM 성과
- GLOBAL_ADMIN + OWNER 접근 가능
- 사이드바 추가

## 완료 기준
- [ ] TS 0건
- [ ] GLOBAL_ADMIN만 /team/affiliate 접근
