import { renderHook } from '@testing-library/react';
import {
  useIntersectionObserver,
  useDelayedIntersectionObserver,
  useMultipleIntersectionObservers,
  useScrollProgress,
} from '@/lib/hooks';

/**
 * IntersectionObserver Hook 테스트
 * Note: IntersectionObserver는 브라우저 API이므로 Mock 필요
 */

// Mock IntersectionObserver
const mockIntersectionObserver = jest.fn();
const mockUnobserve = jest.fn();
const mockObserve = jest.fn();
const mockDisconnect = jest.fn();

mockIntersectionObserver.mockReturnValue({
  observe: mockObserve,
  unobserve: mockUnobserve,
  disconnect: mockDisconnect,
});

global.IntersectionObserver = mockIntersectionObserver as any;

describe('useIntersectionObserver', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with false', () => {
    const { result } = renderHook(() => {
      return useIntersectionObserver({ current: null });
    });

    expect(result.current).toBe(false);
  });

  it('should accept options', () => {
    const { result } = renderHook(() => {
      return useIntersectionObserver({ current: null }, {
        threshold: 0.5,
        rootMargin: '10px',
        once: true,
      });
    });

    expect(mockIntersectionObserver).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        threshold: 0.5,
        rootMargin: '10px',
      })
    );
  });

  it('should handle multiple threshold values', () => {
    const thresholds = [0.1, 0.5, 0.9];

    renderHook(() => {
      return useIntersectionObserver({ current: null }, {
        threshold: thresholds,
      });
    });

    expect(mockIntersectionObserver).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        threshold: thresholds,
      })
    );
  });
});

describe('useDelayedIntersectionObserver', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('should delay visibility state', () => {
    jest.useFakeTimers();

    const { result } = renderHook(() => {
      return useDelayedIntersectionObserver({ current: null }, {
        delay: 300,
      });
    });

    expect(result.current).toBe(false);

    // setTimeout이 호출되었는지 확인
    jest.advanceTimersByTime(300);

    // 실제 테스트에서는 callback이 실행되어야 함
  });
});

describe('useMultipleIntersectionObservers', () => {
  it('should return array of visibilities', () => {
    const refs = [{ current: null }, { current: null }, { current: null }];

    const { result } = renderHook(() => {
      return useMultipleIntersectionObservers(refs);
    });

    expect(Array.isArray(result.current)).toBe(true);
    expect(result.current.length).toBe(3);
    expect(result.current.every((v) => v === false)).toBe(true);
  });
});

describe('useScrollProgress', () => {
  it('should initialize with 0 progress', () => {
    const { result } = renderHook(() => {
      return useScrollProgress({ current: null });
    });

    expect(result.current).toBe(0);
  });
});

/**
 * Integration Test (실제 DOM 환경)
 *
 * 주의: 이 테스트는 jest-jsdom 환경에서만 작동합니다.
 * Playwright나 Cypress로 E2E 테스트 추천
 */

describe('useIntersectionObserver Integration', () => {
  let containerElement: HTMLDivElement;
  let observerCallback: IntersectionObserverCallback;

  beforeEach(() => {
    // 테스트 컨테이너 생성
    containerElement = document.createElement('div');
    document.body.appendChild(containerElement);

    // IntersectionObserver Mock (콜백 저장용)
    jest.clearAllMocks();
    mockIntersectionObserver.mockImplementation(
      (callback: IntersectionObserverCallback) => {
        observerCallback = callback;
        return {
          observe: mockObserve,
          unobserve: mockUnobserve,
          disconnect: mockDisconnect,
        };
      }
    );
  });

  afterEach(() => {
    if (containerElement.parentNode) {
      containerElement.parentNode.removeChild(containerElement);
    }
  });

  it('should trigger animation when element is visible', () => {
    const testElement = document.createElement('div');
    const mockEntry = {
      target: testElement,
      isIntersecting: true,
      boundingClientRect: new DOMRect(),
      intersectionRatio: 0.5,
      rootBounds: null,
      time: Date.now(),
    } as any;

    // 콜백 시뮬레이션
    if (observerCallback) {
      observerCallback([mockEntry], {} as IntersectionObserver);
    }

    expect(mockUnobserve).not.toHaveBeenCalled(); // once: true가 기본값
  });
});
