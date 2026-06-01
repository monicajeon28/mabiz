'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useSession } from '@/hooks/useSession';
import { logger } from '@/lib/logger';

export type KpiEvent =
  | { type: 'sales-created'; amount: number; productId: string; partnerId?: string; time: string }
  | { type: 'sms-opened'; sequenceId: string; contactId: string; time: string }
  | { type: 'sms-clicked'; sequenceId: string; contactId: string; time: string }
  | { type: 'sequence-completed'; sequenceId: string; conversionRate: number; time: string }
  | { type: 'partner-sales'; partnerId: string; amount: number; time: string }
  | { type: 'contact-created'; contactId: string; lensType?: string; time: string }
  | { type: 'status-update'; cron: string; health: 'healthy' | 'degraded' | 'error'; lastRun: string }
  | { type: 'metrics-update'; metrics: Record<string, any> };

export interface RealtimeMetrics {
  todayRevenue: number;
  yesterdayRevenue: number;
  lastHourConversion: number;
  activeDaySequences: number;
  topLenses: Array<{ lens: string; count: number }>;
  channelMetrics: {
    sms: { sent: number; opened: number; clicked: number };
    kakao: { sent: number; opened: number; clicked: number };
    email: { sent: number; opened: number; clicked: number };
  };
  partnerLeaderboard: Array<{ partnerId: string; name: string; amount: number }>;
  cronHealth: Record<string, { status: 'healthy' | 'degraded' | 'error'; lastRun: string }>;
  databaseHealth: { queryLatency: number; connectionCount: number };
}

const SOCKET_URL = typeof window !== 'undefined' ? `${window.location.protocol.replace('http', 'ws')}//${window.location.host}` : '';
const FALLBACK_POLLING_INTERVAL = 60000; // 1 minute
const WEBSOCKET_RECONNECT_INTERVAL = 3000; // 3 seconds
const MAX_RECONNECT_ATTEMPTS = 10;

export function useKpiSocket() {
  const session = useSession();
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const pollingTimeoutRef = useRef<NodeJS.Timeout>();
  const [isConnected, setIsConnected] = useState(false);
  const [metrics, setMetrics] = useState<RealtimeMetrics | null>(null);
  const [lastEvent, setLastEvent] = useState<KpiEvent | null>(null);

  const initializeSocket = useCallback(() => {
    const orgId = session?.user?.organizationId || (session as any)?.organizationId;
    if (!orgId) return;
    if (socketRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const wsUrl = `${SOCKET_URL}/api/realtime/kpi?org=${orgId}`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        logger.info('KPI WebSocket connected');
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;

        // Clear polling if WebSocket connected
        if (pollingTimeoutRef.current) {
          clearTimeout(pollingTimeoutRef.current);
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'metrics-update') {
            setMetrics(data.metrics);
          } else {
            setLastEvent(data);
          }
        } catch (error: unknown) {
          logger.error('Failed to parse WebSocket message', error as object);
        }
      };

      ws.onerror = (error) => {
        logger.error('KPI WebSocket error', error);
        setIsConnected(false);
      };

      ws.onclose = () => {
        logger.warn('KPI WebSocket disconnected');
        setIsConnected(false);
        socketRef.current = null;

        // Attempt to reconnect
        if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttemptsRef.current += 1;
          reconnectTimeoutRef.current = setTimeout(initializeSocket, WEBSOCKET_RECONNECT_INTERVAL);
        } else {
          // Switch to polling fallback
          logger.warn('Max WebSocket reconnect attempts reached, switching to polling');
          startPollingFallback();
        }
      };

      socketRef.current = ws;
    } catch (error: unknown) {
      logger.error('Failed to initialize WebSocket', error as object);
      startPollingFallback();
    }
  }, [session?.organizationId]);

  const startPollingFallback = useCallback(() => {
    if (!session?.organizationId) return;

    const pollMetrics = async () => {
      try {
        const response = await fetch(
          `/api/realtime/kpi/metrics?org=${session.organizationId}`
        );

        if (response.ok) {
          const data = await response.json();
          setMetrics(data);
          setIsConnected(true);
        }
      } catch (error: unknown) {
        logger.error('Polling fallback failed', error as object);
        setIsConnected(false);
      }

      // Schedule next poll
      pollingTimeoutRef.current = setTimeout(pollMetrics, FALLBACK_POLLING_INTERVAL);
    };

    // Initial poll
    pollMetrics();
  }, [session?.organizationId]);

  useEffect(() => {
    if (!session?.organizationId) return;

    initializeSocket();

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current);
      }
    };
  }, [session?.user?.organizationId, initializeSocket]);

  const sendEvent = useCallback((event: KpiEvent) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(event));
    } else {
      logger.warn('WebSocket not connected, event not sent', event);
    }
  }, []);

  return {
    isConnected,
    metrics,
    lastEvent,
    sendEvent,
  };
}

export function useKpiMetrics() {
  const { data: session } = useSession();
  const [metrics, setMetrics] = useState<RealtimeMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!session?.organizationId) return;

    const fetchMetrics = async () => {
      try {
        setLoading(true);
        const response = await fetch(
          `/api/realtime/kpi/metrics?org=${session.user.organizationId}`
        );

        if (!response.ok) throw new Error('Failed to fetch metrics');

        const data = await response.json();
        setMetrics(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();

    // Poll every 5 minutes as fallback
    const interval = setInterval(fetchMetrics, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [session?.organizationId]);

  return { metrics, loading, error };
}
