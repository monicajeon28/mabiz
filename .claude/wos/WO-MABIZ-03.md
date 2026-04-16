# WO-MABIZ-03 — 보안수정 + 성능최적화 + UX개선
생성: 2026-04-17 | 상태: 실행 중

## 토론 결론
코딩고수: A+B 병렬(P0) → C(P1) 순서
UI/UX: D,A,B 즉시 / C,F,E 빠르게 / G 다음스프린트

## 에이전트 A — 보안 (cruise-purchase/route.ts)
- 이슈1: timingSafeEqual로 평문 비교 타이밍어택 차단
- 이슈2: amount 범위 검증 (0 < amount < 100_000_000)

## 에이전트 B — 데이터+UI (sales/route.ts + sales/page.tsx)
- 이슈3: customerPhone?.substring(0,4) null 가드
- 이슈5: FREE_SALES 역할 체크 추가
- 이슈6: payments 전체 로드 → Prisma groupBy
- 이슈4: buyerTel 마스킹 (렌더 레이어)
- UX A: 모바일 카드 레이아웃 (md:hidden)
- UX B: 에러 재시도 버튼
- UX C: 새로고침 버튼

## 에이전트 C — 성능+UX (dashboard/route.ts + dashboard/page.tsx + NotificationBell.tsx)
- 이슈7: registrations 전체 row → _count 쿼리
- 이슈8: visibilitychange 폴링 중단
- UX E: 전월 대비 증감 표시 (↑↓ 퍼센트)
- UX F: KPI 카드 기간 맥락 뱃지
- UX G: CSS-only 퍼널 흐름 차트
- UX C: 새로고침 버튼

## 완료 기준
- [ ] TS 에러 0건
- [ ] console.log 0건
- [ ] P0 보안 이슈 전부 수정
