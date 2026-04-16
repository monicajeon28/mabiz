# WO-MABIZ-01 — CRM·퍼널 전면 업그레이드
생성: 2026-04-17 | 상태: 실행 중

## Phase1 (백엔드 버그/보안)
- A1 cron/scheduled-sms: CRON_SECRET 인증 역전 수정
- A2 cron/vip-care: N+1 캐시 추가
- A3 webhooks/news-sync: try-catch 추가
- A4 scheduled-sms/[id]/DELETE: 예약SMS 취소 API 신규
- A5 contacts/import: 파일 크기 제한+배치upsert

## Phase2 (퍼널 자동화)
- B1 webhooks/payapp: 결제→그룹퍼널 자동 트리거
- B2 webhooks/cruise-purchase: 크루즈닷몰 구매→mabiz 연동
- B3 landing-pages/register: 신규리드→알림DB 저장

## Phase3 (UI)
- C1 SidebarNav: 4섹션 그룹핑+overflow-y-auto
- C2 BottomTabBar: 더보기 탭+슬라이드 드로어
- C3 NotificationBell: 벨 아이콘 컴포넌트
- C4 layout.tsx: 벨 아이콘 헤더 통합
