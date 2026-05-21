# 크루즈닷몰 웹훅 배포 현황

## 📋 진행 상황

| 단계 | 상태 | 시간 |
|------|------|------|
| 1. Secret 키 수령 | ✅ 완료 | 2026-05-21 09:00 |
| 2. Vercel 환경변수 설정 | ✅ 완료 | 2026-05-21 09:15 |
| 3. npm 의존성 해결 (.npmrc) | ✅ 완료 | 2026-05-21 09:25 |
| 4. TypeScript 에러 수정 | ✅ 완료 | 2026-05-21 10:30 |
| 5. Vercel 배포 | ✅ 완료 | 2026-05-21 10:45 |

## ✅ 해결된 이슈들

### npm 버전 충돌 (해결됨)
- 원인: React 19 vs @testing-library/react 18 충돌
- 해결: `.npmrc` 파일에 `legacy-peer-deps=true` 추가

### TypeScript 빌드 에러 (7개 해결됨)
1. call-scripts feedback route - session 속성
2. campaigns cost summary - Decimal 타입 변환
3. campaigns delta route - SendingHistory 상태 필터 + logger
4. campaigns/[id]/variants/[key] - logger.error 인자 + 스코프
5. campaigns/[id]/variants - 스코프 + logger.error 인자
6. campaigns/[id]/variants/stats - logger.debug + 스코프

## 🎯 현재 상태

✅ **배포 완료**
- Production: https://mabiz-e761pdq1d-monicajeon28s-projects.vercel.app
- route.ts 파일: 존재 ✅
- export async function POST: 있음 ✅
- HMAC-SHA256 검증: 구현됨 ✅

## 📌 405 에러 원인 분석

405 Method Not Allowed = POST 메서드가 응답 안 함

**가능한 원인:**
1. CRUISEDOT_WEBHOOK_SECRET 환경변수 없음
2. Vercel 캐시 문제 (Redeploy from cache 필요)
3. 환경변수가 배포 직후에도 반영 안 됨

**다음 단계:**
1. Vercel 환경변수 다시 확인
2. "Redeploy from cache" 버튼 클릭
3. 5분 후 재테스트

---

**구현된 웹훅 엔드포인트:**
- URL: `POST /api/webhooks/cruisedot-payment`
- 인증: Bearer Token + HMAC-SHA256
- 기능: 환불 감지 → Contact 업데이트 → 알림 발송
