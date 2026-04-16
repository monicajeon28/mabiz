# WO-MABIZ-04 — settings/members + settings/organization (404 해결)
생성: 2026-04-17 | 상태: 실행 중

## 배경
사이드바 메뉴 클릭 시 404. API는 구현됨, 페이지만 없음.

## 사용자 결정
- 초대 권한: OWNER + GLOBAL_ADMIN
- 초대 역할: OWNER / AGENT / FREE_SALES
- 팀원 조작: 링크취소 + 비활성화 + 완전삭제 모두 가능

## Agent A — API 수정+신규 (invite + members)
- 파일1: src/app/api/org/invite/route.ts (GLOBAL_ADMIN 허용, role 파라미터 추가)
- 파일2: src/app/api/org/members/route.ts (신규 — 전체 팀원 목록)

## Agent B — API 신규 (members/[userId])
- 파일: src/app/api/org/members/[userId]/route.ts
- PATCH: 비활성화/재활성화
- DELETE: 완전삭제 (마지막OWNER 방어 + 소유권 검증)

## Agent C — UI 2페이지
- 파일1: src/app/(dashboard)/settings/members/page.tsx
- 파일2: src/app/(dashboard)/settings/organization/page.tsx

## 보안 필수
- IDOR: organizationId 소유권 검증
- 마지막 OWNER 삭제 방어
- ConfirmDialog 사용 (confirm() 금지)
- csrfFetch 사용

## 완료 기준
- [ ] TS 에러 0건
- [ ] /settings/members 접속 시 404 없음
- [ ] /settings/organization 접속 시 404 없음
