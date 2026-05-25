# 🚀 에이전트 킥오프 프롬프트 (복사·붙여넣기용)

3개 Claude Code 창에 각각 아래 프롬프트를 붙여넣으세요.
**동시에 3개 창에서 병렬로 시작하세요.**

---

## 🔴 창 #1 에이전트 α — API 레이어

```
D:\mabiz-crm\KICKOFF_AGENT_ALPHA.md 파일을 읽고 그대로 따라서 작업해줘.

작업 영역: src/app/api/ 전체 API 라우트
목표: Vercel 배포 문제 없도록 머그·누수·에러·더미·코드스멜 전부 찾아서 수정

무한루프로 진행해:
1. src/app/api/auth/ 부터 10-렌즈 검토
2. P0 이슈 즉시 수정 → 커밋
3. P1 이슈 목록화 → 순차 수정 → 커밋
4. 다음 디렉토리로 반복
5. 전체 완료 시 KICKOFF_AGENT_ALPHA.md 의 완료 보고 양식으로 보고

절대 push 금지. commit까지만. 한국어 응답.
```

---

## 🟡 창 #2 에이전트 β — UI 대시보드

```
D:\mabiz-crm\KICKOFF_AGENT_BETA.md 파일을 읽고 그대로 따라서 작업해줘.

작업 영역: src/app/(dashboard)/ 전체 페이지 컴포넌트
목표: Vercel 배포 문제 없도록 메모리 누수·더미데이터·에러처리·접근성 전부 찾아서 수정

무한루프로 진행해:
1. src/app/(dashboard)/contacts/page.tsx 부터 10-렌즈 검토
2. P0 이슈 즉시 수정 → 커밋
3. P1 이슈 목록화 → 순차 수정 → 커밋
4. 다음 디렉토리로 반복
5. 전체 완료 시 KICKOFF_AGENT_BETA.md 의 완료 보고 양식으로 보고

절대 push 금지. commit까지만. 한국어 응답.
```

---

## 🔵 창 #3 에이전트 γ — 인프라·공통 라이브러리

```
D:\mabiz-crm\KICKOFF_AGENT_GAMMA.md 파일을 읽고 그대로 따라서 작업해줘.

작업 영역: src/lib/, src/middleware.ts, next.config.js, 기타 인프라
목표: Vercel 배포 문제 없도록 Edge Runtime 호환성·Redis 폴백·환경변수 검증·코드스멜 전부 찾아서 수정

무한루프로 진행해:
1. src/middleware.ts 부터 Edge Runtime 호환성 검토
2. src/lib/auth.ts → rbac.ts → prisma.ts → rate-limit.ts → csrf.ts 순서로
3. P0 이슈 즉시 수정 → 커밋
4. P1 이슈 목록화 → 순차 수정 → 커밋
5. 나머지 lib 파일들 반복
6. 전체 완료 시 KICKOFF_AGENT_GAMMA.md 의 완료 보고 양식으로 보고

절대 push 금지. commit까지만. 한국어 응답.
```

---

## 📌 병렬 작업 안전 수칙

| 항목 | 주의사항 |
|------|---------|
| **파일 겹침** | α↔β↔γ 담당 파일이 겹치지 않음. 충돌 없음 |
| **공유 파일** | `prisma/schema.prisma`는 γ만 읽기. 수정 금지 |
| **git 충돌** | 각 에이전트는 자기 영역 파일만 수정 |
| **빌드 검증** | 커밋 전 반드시 `npm run build` 성공 확인 |
| **push 금지** | 3개 에이전트 모두 push 절대 금지 |

---

## 🔄 완료 후 통합 사이클

세 에이전트 모두 완료 보고 후:
1. 메인 에이전트가 3개 보고서 취합
2. 충돌/중복 수정 확인
3. 통합 `npm run build` 최종 확인
4. 무한루프 2사이클 시작 (발견된 P2 이슈 처리)
