# WO-MABIZ-05 — tag-blast UI + funnels enroll UI 연결
생성: 2026-04-17 | 상태: 실행 중

## 배경
API는 완전 구현됨. UI 연결만 필요.

## Agent A: contacts/page.tsx
- 태그 칩 필터 (selectedTags 상태, 동적 태그 수집)
- "태그 SMS" 조건부 버튼 (selectedTags > 0)
- TagBlastModal: 템플릿/직접입력 탭 → dryRun 확인 → 발송

## Agent B: funnels/[id]/page.tsx
- 헤더 "고객 등록" 버튼
- EnrollModal: 고객 검색(디바운스) + startDate + sendNow
- enroll API 중복 방지 가드 추가

## Agent C: contacts/[id]/page.tsx
- group 탭에 "퍼널 직접 등록" 섹션
- 퍼널 드롭다운 + 이미 등록된 퍼널 회색 처리
- 등록 후 contact 재조회

## 보안/품질
- confirm() 금지 → ConfirmDialog
- console.log 금지 → logger (API만)
- csrfFetch 사용 (POST 전부)
