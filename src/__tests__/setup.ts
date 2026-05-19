import { server } from '@/mocks/server';

/**
 * Jest 테스트 전역 셋업
 *
 * MSW (Mock Service Worker) 서버 라이프사이클 관리:
 * - beforeAll: 테스트 시작 전 MSW 서버 시작
 * - afterEach: 각 테스트 후 핸들러 리셋
 * - afterAll: 모든 테스트 종료 후 서버 종료
 */

// 모든 테스트 시작 전 MSW 서버 활성화
beforeAll(() => {
  server.listen({
    onUnhandledRequest: 'error',
  });
});

// 각 테스트 후 모든 핸들러를 기본값으로 리셋
// (이전 테스트의 모의 응답이 다음 테스트에 영향을 주지 않도록)
afterEach(() => {
  server.resetHandlers();
});

// 모든 테스트 완료 후 MSW 서버 종료
afterAll(() => {
  server.close();
});

// 테스트 환경에서 fetch polyfill 확인 (필요시)
if (typeof global !== 'undefined' && !global.fetch) {
  global.fetch = fetch;
}
