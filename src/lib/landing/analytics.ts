/**
 * Landing Page Analytics
 * Tracks user interactions and scroll depth
 */

type TrackingEvent = {
  name: string;
  data: Record<string, any>;
  timestamp: string;
};

const events: TrackingEvent[] = [];

export function track(eventName: string, data: Record<string, any> = {}) {
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
    console.log('[Landing Analytics]', event);
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
  console.log('Sending analytics batch:', batch);

  // Example: fetch('/api/analytics/landing', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ events: batch }),
  // }).catch(() => {
  //   // Re-add events if sending fails
  //   events.unshift(...batch);
  // });
}

// Send events on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', sendEvents);
}

// Auto-send events every 30 seconds
if (typeof window !== 'undefined') {
  setInterval(sendEvents, 30000);
}

export function getEvents() {
  return events;
}
