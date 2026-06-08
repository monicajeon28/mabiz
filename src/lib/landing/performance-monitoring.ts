/**
 * Web Vitals Performance Monitoring Module
 *
 * Tracks Core Web Vitals metrics:
 * - CLS (Cumulative Layout Shift)
 * - INP (Interaction to Next Paint)
 * - FCP (First Contentful Paint)
 * - LCP (Largest Contentful Paint)
 * - TTFB (Time to First Byte)
 *
 * Usage:
 * ```tsx
 * import { usePerformanceMonitoring } from '@/lib/landing/performance-monitoring';
 *
 * export function MyComponent() {
 *   usePerformanceMonitoring({
 *     logToConsole: true,
 *     sendToAnalytics: true
 *   });
 *   // ...
 * }
 * ```
 *
 * @version 1.0
 * @created 2026-06-09
 */

import { useEffect } from 'react';

/**
 * Web Vitals metrics interface
 */
export interface WebVitalsMetrics {
  cls?: number;
  inp?: number;
  fcp?: number;
  lcp?: number;
  ttfb?: number;
  timestamp?: number;
}

/**
 * Performance monitoring options
 */
export interface PerformanceMonitoringOptions {
  /** Log metrics to browser console */
  logToConsole?: boolean;

  /** Send metrics to analytics endpoint (required for production) */
  sendToAnalytics?: boolean;

  /** Custom analytics endpoint URL */
  analyticsEndpoint?: string;

  /** Enable debug mode for detailed logging */
  debug?: boolean;

  /** Custom callback function to handle metrics */
  onMetrics?: (metrics: WebVitalsMetrics) => void;
}

/**
 * Collects CLS (Cumulative Layout Shift) metric
 * Measures visual stability - ideally < 0.1
 */
function collectCLS(): number {
  let clsValue = 0;

  if (!('LayoutShift' in window)) {
    return 0;
  }

  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const perfEntry = entry as any;
        if (!perfEntry.hadRecentInput) {
          clsValue += perfEntry.value;
        }
      }
    });

    observer.observe({ type: 'layout-shift', buffered: true });

    // Return current CLS after a small delay to let observer collect
    setTimeout(() => {
      observer.disconnect();
    }, 0);

    return clsValue;
  } catch {
    return 0;
  }
}

/**
 * Collects INP (Interaction to Next Paint) metric
 * Measures responsiveness to user interactions - ideally < 100ms
 */
function collectINP(): number {
  let inpValue = 0;

  if (!('PerformanceEventTiming' in window)) {
    return 0;
  }

  try {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();

      for (const entry of entries) {
        const perfEntry = entry as any;
        if (perfEntry.processingDuration && perfEntry.interactionId) {
          const duration = perfEntry.processingDuration;
          if (duration > inpValue) {
            inpValue = duration;
          }
        }
      }
    });

    observer.observe({
      type: 'first-input',
      buffered: true
    } as PerformanceObserverInit);

    // Note: INP is typically measured after some interactions occur
    // This returns the worst observed so far
    setTimeout(() => {
      observer.disconnect();
    }, 0);

    return inpValue;
  } catch {
    return 0;
  }
}

/**
 * Collects FCP (First Contentful Paint) metric
 * Measures when the first visual element appears - ideally < 1.8s
 */
function collectFCP(): number {
  if (!('PerformanceEntryList' in window)) {
    return 0;
  }

  try {
    const entries = performance.getEntriesByName('first-contentful-paint');

    if (entries.length > 0) {
      return entries[0].startTime;
    }

    return 0;
  } catch {
    return 0;
  }
}

/**
 * Collects LCP (Largest Contentful Paint) metric
 * Measures when the largest element is painted - ideally < 2.5s
 */
function collectLCP(): number {
  if (!('PerformanceObserver' in window)) {
    return 0;
  }

  let lcpValue = 0;

  try {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();

      if (entries.length > 0) {
        const lastEntry = entries[entries.length - 1];
        lcpValue = lastEntry.startTime;
      }
    });

    observer.observe({ type: 'largest-contentful-paint', buffered: true });

    setTimeout(() => {
      observer.disconnect();
    }, 0);

    return lcpValue;
  } catch {
    return 0;
  }
}

/**
 * Collects TTFB (Time to First Byte) metric
 * Measures server response time - ideally < 0.6s
 */
function collectTTFB(): number {
  try {
    const navigationTiming = performance.getEntriesByType('navigation')[0] as any;

    if (navigationTiming && navigationTiming.responseStart && navigationTiming.fetchStart) {
      return navigationTiming.responseStart - navigationTiming.fetchStart;
    }

    return 0;
  } catch {
    return 0;
  }
}

/**
 * Collects all Web Vitals metrics
 */
export function collectWebVitals(): WebVitalsMetrics {
  return {
    cls: collectCLS(),
    inp: collectINP(),
    fcp: collectFCP(),
    lcp: collectLCP(),
    ttfb: collectTTFB(),
    timestamp: Date.now(),
  };
}

/**
 * Logs metrics to browser console with formatting
 */
function logMetrics(metrics: WebVitalsMetrics, debug: boolean = false) {
  const style = 'color: #0066ff; font-weight: bold; font-size: 12px;';
  const metricsStyle = 'color: #00aa00; font-weight: normal;';

  console.log('%c📊 Web Vitals Metrics', style);

  if (metrics.cls !== undefined && metrics.cls > 0) {
    const status = metrics.cls < 0.1 ? '✅' : metrics.cls < 0.25 ? '⚠️' : '❌';
    console.log(`%c  CLS (Layout Shift): ${metrics.cls.toFixed(4)} ${status}`, metricsStyle);
  }

  if (metrics.inp !== undefined && metrics.inp > 0) {
    const status = metrics.inp < 100 ? '✅' : metrics.inp < 500 ? '⚠️' : '❌';
    console.log(`%c  INP (Responsiveness): ${metrics.inp.toFixed(0)}ms ${status}`, metricsStyle);
  }

  if (metrics.fcp !== undefined && metrics.fcp > 0) {
    const status = metrics.fcp < 1800 ? '✅' : metrics.fcp < 3000 ? '⚠️' : '❌';
    console.log(`%c  FCP (First Paint): ${metrics.fcp.toFixed(0)}ms ${status}`, metricsStyle);
  }

  if (metrics.lcp !== undefined && metrics.lcp > 0) {
    const status = metrics.lcp < 2500 ? '✅' : metrics.lcp < 4000 ? '⚠️' : '❌';
    console.log(`%c  LCP (Largest Paint): ${metrics.lcp.toFixed(0)}ms ${status}`, metricsStyle);
  }

  if (metrics.ttfb !== undefined && metrics.ttfb > 0) {
    const status = metrics.ttfb < 600 ? '✅' : metrics.ttfb < 1200 ? '⚠️' : '❌';
    console.log(`%c  TTFB (Server Response): ${metrics.ttfb.toFixed(0)}ms ${status}`, metricsStyle);
  }

  if (debug) {
    console.log('%c  Raw Data:', style, metrics);
  }
}

/**
 * Sends metrics to analytics endpoint
 */
async function sendToAnalytics(
  metrics: WebVitalsMetrics,
  endpoint: string = '/api/analytics/vitals'
) {
  try {
    // Only send non-zero metrics
    const dataToSend = Object.fromEntries(
      Object.entries(metrics).filter(([, value]) => value !== undefined && value > 0)
    );

    await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...dataToSend,
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
      }),
      // Use sendBeacon if available for better reliability
      keepalive: true,
    });
  } catch (error) {
    console.warn('Failed to send Web Vitals metrics:', error);
  }
}

/**
 * React hook for performance monitoring
 *
 * Automatically collects and tracks Web Vitals metrics
 *
 * @param options Monitoring options
 */
export function usePerformanceMonitoring(options: PerformanceMonitoringOptions = {}) {
  const {
    logToConsole = false,
    sendToAnalytics: enableAnalytics = false,
    analyticsEndpoint = '/api/analytics/vitals',
    debug = false,
    onMetrics,
  } = options;

  useEffect(() => {
    // Collect metrics after page load
    const timer = setTimeout(() => {
      const metrics = collectWebVitals();

      // Log to console if enabled
      if (logToConsole) {
        logMetrics(metrics, debug);
      }

      // Send to analytics if enabled
      if (enableAnalytics) {
        sendToAnalytics(metrics, analyticsEndpoint);
      }

      // Call custom callback if provided
      if (onMetrics) {
        onMetrics(metrics);
      }
    }, 1000); // Wait 1 second for metrics to stabilize

    return () => clearTimeout(timer);
  }, [logToConsole, enableAnalytics, analyticsEndpoint, debug, onMetrics]);
}

/**
 * Standalone function to collect metrics without React
 * Useful for non-React parts of the application
 */
export function initPerformanceMonitoring(options: PerformanceMonitoringOptions = {}) {
  const {
    logToConsole = false,
    sendToAnalytics: enableAnalytics = false,
    analyticsEndpoint = '/api/analytics/vitals',
    debug = false,
    onMetrics,
  } = options;

  // Collect metrics after page load
  setTimeout(() => {
    const metrics = collectWebVitals();

    if (logToConsole) {
      logMetrics(metrics, debug);
    }

    if (enableAnalytics) {
      sendToAnalytics(metrics, analyticsEndpoint);
    }

    if (onMetrics) {
      onMetrics(metrics);
    }
  }, 1000);
}

/**
 * Real-time INP monitoring with detailed interaction tracking
 * Shows the worst interaction to next paint during the session
 */
export function monitorINPInRealtime() {
  if (!('PerformanceEventTiming' in window)) {
    console.warn('PerformanceEventTiming not supported in this browser');
    return;
  }

  let worstINP = 0;
  const interactions: Map<number, number> = new Map();

  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      const perfEntry = entry as any;

      if (perfEntry.interactionId && perfEntry.processingDuration) {
        const currentINP = perfEntry.processingDuration;

        if (currentINP > worstINP) {
          worstINP = currentINP;
          console.log(`🎯 INP Updated: ${worstINP.toFixed(0)}ms`, perfEntry);
        }

        interactions.set(perfEntry.interactionId, currentINP);
      }
    }
  });

  try {
    observer.observe({
      type: 'first-input',
      buffered: true
    } as PerformanceObserverInit);
  } catch {
    console.warn('Could not observe interaction timing');
  }

  // Return function to stop monitoring and get final value
  return () => {
    observer.disconnect();
    return worstINP;
  };
}

/**
 * Utility: Check if metrics meet targets
 */
export function checkWebVitalsStatus(metrics: WebVitalsMetrics): Record<string, boolean> {
  return {
    cls_good: !metrics.cls || metrics.cls < 0.1,
    inp_good: !metrics.inp || metrics.inp < 100,
    fcp_good: !metrics.fcp || metrics.fcp < 1800,
    lcp_good: !metrics.lcp || metrics.lcp < 2500,
    ttfb_good: !metrics.ttfb || metrics.ttfb < 600,
  };
}

/**
 * Calculate overall performance score
 */
export function calculatePerformanceScore(metrics: WebVitalsMetrics): number {
  let score = 100;

  // CLS: 0.1 is good, penalize for worse
  if (metrics.cls) {
    if (metrics.cls > 0.25) score -= 20;
    else if (metrics.cls > 0.1) score -= 10;
  }

  // INP: 100ms is good, penalize for worse
  if (metrics.inp) {
    if (metrics.inp > 500) score -= 20;
    else if (metrics.inp > 100) score -= 10;
  }

  // LCP: 2.5s is good, penalize for worse
  if (metrics.lcp) {
    if (metrics.lcp > 4000) score -= 20;
    else if (metrics.lcp > 2500) score -= 10;
  }

  // FCP: 1.8s is good, penalize for worse
  if (metrics.fcp) {
    if (metrics.fcp > 3000) score -= 20;
    else if (metrics.fcp > 1800) score -= 10;
  }

  return Math.max(0, Math.min(100, score));
}

export default {
  usePerformanceMonitoring,
  initPerformanceMonitoring,
  collectWebVitals,
  monitorINPInRealtime,
  checkWebVitalsStatus,
  calculatePerformanceScore,
};
