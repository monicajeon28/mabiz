/**
 * Landing Page Analytics
 * Tracks user interactions and scroll depth
 */

import { logger } from '@/lib/logger';

type TrackingEvent = {
  name: string;
  data: Record<string, unknown>;
  timestamp: string;
};

const events: TrackingEvent[] = [];

export function track(eventName: string, data: Record<string, unknown> = {}) {
  const event: TrackingEvent = {
    name: eventName,
    data: {
      ...data,
      url: typeof window !== 'undefined' ? window.location.pathname : '',
      referrer: typeof document !== 'undefined' ? document.referrer : '',
    },
    timestamp: new Date().toISOString(),
  };

  events.push(event);

  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    logger.log('[Landing Analytics]', { event });
  }

  // Send to analytics endpoint (implement your backend)
  if (typeof window !== 'undefined' && 'navigator' in window) {
    // Batch events every 30 seconds or when array reaches 10 items
    if (events.length >= 10) {
      sendEvents();
    }
  }
}

export function sendEvents() {
  if (events.length === 0) return;

  const batch = [...events];
  events.length = 0;

  // Here you would typically send to your analytics backend
  logger.log('Sending analytics batch:', { count: batch.length });

  // Example: fetch('/api/analytics/landing', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ events: batch }),
  // }).catch(() => {
  //   // Re-add events if sending fails
  //   events.unshift(...batch);
  // });
}

type AnalyticsWindow = Window & {
  __landingAnalyticsIntervalId?: number;
  __landingAnalyticsCleanupBound?: boolean;
};

// Keep a single interval per tab and rebind safely on HMR/module re-evaluation.
if (typeof window !== 'undefined') {
  const analyticsWindow = window as AnalyticsWindow;

  if (analyticsWindow.__landingAnalyticsIntervalId) {
    window.clearInterval(analyticsWindow.__landingAnalyticsIntervalId);
  }
  analyticsWindow.__landingAnalyticsIntervalId = window.setInterval(sendEvents, 30000);

  if (!analyticsWindow.__landingAnalyticsCleanupBound) {
    const flush = () => sendEvents();
    window.addEventListener('beforeunload', flush);
    window.addEventListener('pagehide', flush);
    analyticsWindow.__landingAnalyticsCleanupBound = true;
  }
}

export function getEvents() {
  return events;
}
