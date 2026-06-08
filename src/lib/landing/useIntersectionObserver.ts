'use client';

import { useEffect, useRef, useState } from 'react';

interface UseIntersectionObserverOptions extends IntersectionObserverInit {
  triggerOnce?: boolean;
  onEnter?: () => void;
}

export const useIntersectionObserver = (
  options: UseIntersectionObserverOptions = {}
): [React.RefObject<HTMLDivElement | null>, boolean] => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const {
    threshold = 0.1,
    triggerOnce = true,
    onEnter,
    ...observerOptions
  } = options;

  useEffect(() => {
    if (!ref.current) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsVisible(true);
        onEnter?.();
        if (triggerOnce) {
          observer.unobserve(entry.target);
        }
      } else if (!triggerOnce) {
        setIsVisible(false);
      }
    }, {
      threshold,
      ...observerOptions,
    });

    observer.observe(ref.current);

    return () => {
      observer.disconnect();
    };
  }, [threshold, triggerOnce, onEnter]);

  return [ref, isVisible];
};
