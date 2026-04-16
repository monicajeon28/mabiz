# WO-MABIZ-02 — 마케팅 대시보드 + 랜딩 매출관리

생성: 2026-04-17 | 상태: 완료

## 배경
크루즈닷몰 관리자 패널의 "랜딩페이지 매출관리"와 "마케팅 대시보드"를 mabiz CRM으로 이식.
방문 추적(CrmLandingView)은 이미 구현됨. 대시보드 UI 2개 신규 생성.

## 구현 항목
- GET /api/marketing/dashboard — 전체 방문/등록/전환율/7일트렌드/상위5랜딩
- GET /api/marketing/sales — 매출집계/월별/랜딩별/최근결제내역
- /marketing 페이지 — 마케팅 대시보드
- /marketing/sales 페이지 — 랜딩 매출관리
- SidebarNav + BottomTabBar 메뉴 추가

## 완료 기준
- [ ] TS 0건
- [ ] 사이드바 메뉴 노출
- [ ] 대시보드 KPI 카드 표시
- [ ] 매출 집계 테이블 표시
