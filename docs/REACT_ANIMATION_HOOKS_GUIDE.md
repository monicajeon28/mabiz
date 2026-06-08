# React Animation Hooks 구현 가이드 (P2-1)

**최종 업데이트**: 2026-06-09
**타겟**: Landing Page, CRM Dashboard, Campaign Pages
**성능 목표**: LCP < 2.5s, CLS < 0.1, INP < 100ms

---

## 📋 목차

1. [Hook 종류 및 선택 기준](#hook-종류-및-선택-기준)
2. [기본 사용법](#기본-사용법)
3. [고급 패턴](#고급-패턴)
4. [타입 안정성](#타입-안정성)
5. [SSR 호환성](#ssr-호환성)
6. [성능 최적화](#성능-최적화)
7. [예제 코드](#예제-코드)

---

## Hook 종류 및 선택 기준

### 1. `useIntersectionObserver` - 기본 애니메이션

**언제 쓰나?**
- 요소가 화면에 진입할 때 1회만 애니메이션
- 스크롤 트리거 필요 시

**주요 특징**
- SSR 안전 (typeof window 체크)
- once 옵션으로 1회/반복 제어
- threshold, rootMargin 커스터마이징

**API**
```typescript
const isVisible = useIntersectionObserver(ref, {
  threshold: 0.2,      // 요소 20% 이상 보일 때 트리거
  rootMargin: '0px',   // 루트 경계 확장
  once: true,          // 1회만 실행
});
```

### 2. `useDelayedIntersectionObserver` - 지연 시작

**언제 쓰나?**
- 여러 요소가 순차적으로 애니메이션되어야 할 때
- 단계별 reveal 효과

**API**
```typescript
const isVisible = useDelayedIntersectionObserver(ref, {
  threshold: 0.2,
  delay: 300,  // 보여진 후 300ms 후 시작
  once: true,
});
```

### 3. `useMultipleIntersectionObservers` - 다중 요소

**언제 쓰나?**
- 여러 카드를 동시에 관찰
- 그룹 애니메이션

**API**
```typescript
const visibilities = useMultipleIntersectionObservers([ref1, ref2, ref3], {
  threshold: 0.1,
});
// visibilities[0] = true → ref1 보임
// visibilities[1] = false → ref2 안 보임
```

### 4. `useScrollProgress` - 진행률 추적

**언제 쓰나?**
- Parallax 효과
- Progress bar
- Scroll 기반 transform

**API**
```typescript
const progress = useScrollProgress(ref);
// 0 = 아직 보이지 않음
// 0.5 = 화면 절반 지남
// 1 = 완전히 지나감
```

---

## 기본 사용법

### 패턴 1: useIntersectionObserver + Tailwind

```tsx
'use client';

import { useRef } from 'react';
import { useIntersectionObserver } from '@/lib/hooks';

export function ProblemCard() {
  const ref = useRef<HTMLDivElement>(null);
  const isVisible = useIntersectionObserver(ref, { once: true });

  return (
    <div
      ref={ref}
      className={`
        transition-all duration-700 ease-out
        ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}
      `}
    >
      <h3>Problem Title</h3>
      <p>Description</p>
    </div>
  );
}
```

### 패턴 2: CSS Animation 클래스 토글

```tsx
'use client';

import { useRef } from 'react';
import { useIntersectionObserver } from '@/lib/hooks';

export function AnimatedSection() {
  const ref = useRef<HTMLDivElement>(null);
  const isVisible = useIntersectionObserver(ref, {
    threshold: 0.1,
    once: true,
  });

  return (
    <div
      ref={ref}
      className={isVisible ? 'animate-fadeInUp' : 'opacity-0'}
    >
      Content
    </div>
  );
}
```

**Tailwind Config (`tailwind.config.ts`):**
```typescript
export default {
  theme: {
    extend: {
      keyframes: {
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInLeft: {
          '0%': { opacity: '0', transform: 'translateX(-30px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
      animation: {
        fadeInUp: 'fadeInUp 0.6s ease-out forwards',
        slideInLeft: 'slideInLeft 0.8s ease-out forwards',
      },
    },
  },
};
```

### 패턴 3: useDelayedIntersectionObserver (순차 표시)

```tsx
'use client';

import { useRef } from 'react';
import { useDelayedIntersectionObserver } from '@/lib/hooks';

const items = [
  { id: 1, title: 'Item 1' },
  { id: 2, title: 'Item 2' },
  { id: 3, title: 'Item 3' },
];

export function StaggeredItems() {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={containerRef} className="space-y-4">
      {items.map((item, index) => (
        <StaggerItem key={item.id} delay={index * 150} item={item} />
      ))}
    </div>
  );
}

function StaggerItem({
  item,
  delay,
}: {
  item: typeof items[0];
  delay: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isVisible = useDelayedIntersectionObserver(ref, {
    threshold: 0.1,
    delay,
    once: true,
  });

  return (
    <div
      ref={ref}
      className={`
        transition-all duration-500
        ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'}
      `}
    >
      <h4>{item.title}</h4>
    </div>
  );
}
```

---

## 고급 패턴

### 패턴 4: Parallax 효과

```tsx
'use client';

import { useRef } from 'react';
import { useScrollProgress } from '@/lib/hooks';

export function ParallaxSection() {
  const ref = useRef<HTMLDivElement>(null);
  const progress = useScrollProgress(ref);

  // progress 값에 따라 변환 적용
  const offset = progress * 30; // 0-30px 이동

  return (
    <div ref={ref} className="relative overflow-hidden">
      <div
        style={{
          transform: `translateY(${offset}px)`,
          transition: 'transform 0.1s ease-out',
        }}
        className="bg-gradient-to-b from-blue-500 to-purple-600 h-96"
      />
    </div>
  );
}
```

### 패턴 5: Progress Bar 애니메이션

```tsx
'use client';

import { useRef } from 'react';
import { useScrollProgress } from '@/lib/hooks';

export function AnimatedProgressBar() {
  const ref = useRef<HTMLDivElement>(null);
  const progress = useScrollProgress(ref);

  return (
    <div ref={ref} className="py-20">
      <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
        <div
          className="bg-gradient-to-r from-blue-500 to-purple-600 h-full transition-transform duration-300"
          style={{ transform: `scaleX(${progress})`, transformOrigin: 'left' }}
        />
      </div>
      <p className="mt-4 text-center">{Math.round(progress * 100)}%</p>
    </div>
  );
}
```

### 패턴 6: 다중 요소 동시 관찰

```tsx
'use client';

import { useRef } from 'react';
import { useMultipleIntersectionObservers } from '@/lib/hooks';

export function CardGrid() {
  const refs = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)];
  const visibilities = useMultipleIntersectionObservers(refs, {
    threshold: 0.1,
    once: true,
  });

  return (
    <div className="grid grid-cols-3 gap-6">
      {refs.map((ref, index) => (
        <div
          key={index}
          ref={ref}
          className={`
            p-6 bg-white rounded-lg shadow-lg
            transition-all duration-700
            ${visibilities[index] ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}
          `}
        >
          Card {index + 1}
        </div>
      ))}
    </div>
  );
}
```

---

## 타입 안정성

### 올바른 타입 정의

```tsx
import { useRef, RefObject } from 'react';
import { useIntersectionObserver } from '@/lib/hooks';

interface AnimatedCardProps {
  title: string;
  description: string;
  onAnimationComplete?: () => void;
}

export function AnimatedCard({
  title,
  description,
  onAnimationComplete,
}: AnimatedCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isVisible = useIntersectionObserver(ref, {
    threshold: 0.2,
    once: true,
  });

  return (
    <div
      ref={ref}
      className={`
        transition-all duration-700
        ${isVisible ? 'opacity-100' : 'opacity-0'}
      `}
    >
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
```

### Hook 재사용 타입 안전 버전

```tsx
/**
 * 재사용 가능한 Intersection Observer 컴포넌트 HOC
 */
export function withIntersectionAnimation<P extends object>(
  Component: React.ComponentType<P & { isVisible: boolean }>,
  options: UseIntersectionObserverOptions = {}
) {
  return function IntersectionAnimatedComponent(props: P) {
    const ref = useRef<HTMLDivElement>(null);
    const isVisible = useIntersectionObserver(ref, options);

    return (
      <div ref={ref}>
        <Component {...props} isVisible={isVisible} />
      </div>
    );
  };
}

// 사용
const AnimatedCard = withIntersectionAnimation(Card, { once: true });
```

---

## SSR 호환성

### Next.js 14+ Server Components

```tsx
// ✅ 올바른 방법 1: 'use client' 지시어 필수
'use client';

import { useRef } from 'react';
import { useIntersectionObserver } from '@/lib/hooks';

export function ClientAnimation() {
  const ref = useRef<HTMLDivElement>(null);
  const isVisible = useIntersectionObserver(ref);

  return <div ref={ref}>{/* ... */}</div>;
}
```

```tsx
// ✅ 올바른 방법 2: Server 부분과 분리
// layout.tsx (Server)
export default function Layout({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>;
}

// components/animation.tsx (Client)
'use client';

import { useIntersectionObserver } from '@/lib/hooks';

export function Animation() {
  // ...
}
```

### 초기 렌더링 플래시 방지

```tsx
'use client';

import { useRef, useState, useEffect } from 'react';
import { useIntersectionObserver } from '@/lib/hooks';

export function SafeAnimation() {
  const ref = useRef<HTMLDivElement>(null);
  const isVisible = useIntersectionObserver(ref, { once: true });
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // 마운트 전에는 안 보이도록 설정 (플래시 방지)
  const shouldAnimate = isMounted && isVisible;

  return (
    <div
      ref={ref}
      className={`
        transition-all duration-700
        ${shouldAnimate ? 'opacity-100' : 'opacity-0'}
      `}
    >
      Content
    </div>
  );
}
```

---

## 성능 최적화

### 1. 불필요한 리렌더링 방지

```tsx
'use client';

import { useRef, useMemo } from 'react';
import { useIntersectionObserver } from '@/lib/hooks';

export function OptimizedAnimation() {
  const ref = useRef<HTMLDivElement>(null);
  const isVisible = useIntersectionObserver(ref);

  // useMemo로 className 메모이제이션
  const className = useMemo(
    () =>
      `
      transition-all duration-700
      ${isVisible ? 'opacity-100' : 'opacity-0'}
    `.trim(),
    [isVisible]
  );

  return <div ref={ref} className={className} />;
}
```

### 2. Threshold 최적화

```tsx
// ❌ 나쁜 예: threshold 배열이 크면 성능 저하
const tooManyThresholds = Array.from({ length: 100 }, (_, i) => i / 100);

// ✅ 좋은 예: 필요한 임계값만 사용
const optimalThresholds = [0.1, 0.5, 0.9];

useIntersectionObserver(ref, {
  threshold: 0.1, // 단일 값 권장
  once: true,
});
```

### 3. 대량 애니메이션 최적화

```tsx
'use client';

import { useRef } from 'react';
import { useMultipleIntersectionObservers } from '@/lib/hooks';

export function OptimizedCardList({ count = 100 }) {
  const refs = Array.from({ length: count }, () => useRef<HTMLDivElement>(null));
  const visibilities = useMultipleIntersectionObservers(refs, {
    threshold: 0.1,
    once: true,
  });

  // Virtual scrolling 고려
  return (
    <div className="space-y-4">
      {refs.map((ref, index) => (
        <Card
          key={index}
          ref={ref}
          isVisible={visibilities[index]}
          index={index}
        />
      ))}
    </div>
  );
}
```

### 4. CSS 애니메이션 vs JS 애니메이션

```tsx
// ✅ 권장: CSS Transition (60fps)
<div
  className={`
    transition-opacity duration-700
    ${isVisible ? 'opacity-100' : 'opacity-0'}
  `}
/>

// ❌ 피하기: setInterval + state 업데이트
useEffect(() => {
  const interval = setInterval(() => {
    setOpacity(prev => prev + 0.01);
  }, 16); // 60fps
  return () => clearInterval(interval);
}, []);
```

---

## 예제 코드

### 예제 1: Landing Page Section Animation

```tsx
'use client';

import { useRef } from 'react';
import { useIntersectionObserver, useDelayedIntersectionObserver } from '@/lib/hooks';

export function ProblemsSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const isSectionVisible = useIntersectionObserver(sectionRef, { once: true });

  const problems = [
    { id: 1, icon: '🧳', title: 'Baggage Loss' },
    { id: 2, icon: '🚪', title: 'Room Issues' },
    { id: 3, icon: '✈️', title: 'Flight Delay' },
  ];

  return (
    <section
      ref={sectionRef}
      className={`
        transition-all duration-700
        ${isSectionVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}
      `}
    >
      <h2 className="text-4xl font-bold mb-12">Common Problems</h2>

      <div className="grid grid-cols-3 gap-6">
        {problems.map((problem, index) => (
          <ProblemCard
            key={problem.id}
            problem={problem}
            delay={index * 150}
          />
        ))}
      </div>
    </section>
  );
}

function ProblemCard({
  problem,
  delay,
}: {
  problem: { id: number; icon: string; title: string };
  delay: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isVisible = useDelayedIntersectionObserver(ref, {
    threshold: 0.2,
    delay,
    once: true,
  });

  return (
    <div
      ref={ref}
      className={`
        p-6 bg-white rounded-lg shadow-lg
        transition-all duration-500 ease-out
        ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}
      `}
    >
      <div className="text-4xl mb-4">{problem.icon}</div>
      <h3 className="font-bold text-lg">{problem.title}</h3>
    </div>
  );
}
```

### 예제 2: Dashboard KPI Cards

```tsx
'use client';

import { useRef } from 'react';
import { useMultipleIntersectionObservers } from '@/lib/hooks';

const kpis = [
  { label: 'Total Revenue', value: '$125.5K', change: '+12.5%' },
  { label: 'Conversions', value: '2,847', change: '+8.2%' },
  { label: 'Engagement', value: '67.8%', change: '+3.1%' },
];

export function KPIGrid() {
  const refs = kpis.map(() => useRef<HTMLDivElement>(null));
  const visibilities = useMultipleIntersectionObservers(refs, {
    threshold: 0.1,
    once: true,
  });

  return (
    <div className="grid grid-cols-3 gap-6">
      {kpis.map((kpi, index) => (
        <div
          key={kpi.label}
          ref={refs[index]}
          className={`
            p-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg text-white
            transition-all duration-700
            ${visibilities[index] ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}
          `}
        >
          <p className="text-sm opacity-80">{kpi.label}</p>
          <p className="text-3xl font-bold mt-2">{kpi.value}</p>
          <p className="text-sm mt-2 text-green-300">{kpi.change}</p>
        </div>
      ))}
    </div>
  );
}
```

### 예제 3: Parallax Scroll Effect

```tsx
'use client';

import { useRef } from 'react';
import { useScrollProgress } from '@/lib/hooks';

export function ParallaxHero() {
  const ref = useRef<HTMLDivElement>(null);
  const progress = useScrollProgress(ref);

  return (
    <div ref={ref} className="relative h-96 overflow-hidden">
      {/* Background layer (slow) */}
      <div
        className="absolute inset-0 bg-gradient-to-b from-blue-600 to-blue-400"
        style={{
          transform: `translateY(${progress * 50}px)`,
        }}
      />

      {/* Middle layer (medium speed) */}
      <div
        className="absolute inset-0 bg-white opacity-20"
        style={{
          transform: `translateY(${progress * 20}px)`,
        }}
      />

      {/* Content layer (fast) */}
      <div className="relative z-10 flex items-center justify-center h-full">
        <h1 className="text-5xl font-bold text-white text-center">
          Cruise Booking Made Easy
        </h1>
      </div>
    </div>
  );
}
```

---

## 체크리스트 (배포 전)

- [ ] 모든 animate 요소에 'use client' 지시어 확인
- [ ] useRef 타입이 올바른지 확인 (`HTMLDivElement`, 등)
- [ ] SSR 환경에서 TypeError 없는지 확인
- [ ] 모바일에서 성능 테스트 (Chrome DevTools Lighthouse)
- [ ] LCP < 2.5s 달성 확인
- [ ] CLS < 0.1 달성 확인 (초기 플래시 없음)
- [ ] useEffect 정리 함수 확인 (observer.unobserve, clearTimeout)
- [ ] 불필요한 리렌더링 없는지 확인

---

## 참고

- [MDN: IntersectionObserver API](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API)
- [MDN: Web Animations API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Animations_API)
- [Next.js: Client Components](https://nextjs.org/docs/app/building-your-application/rendering/client-components)
- [Web Vitals: Core Web Vitals](https://web.dev/vitals/)
