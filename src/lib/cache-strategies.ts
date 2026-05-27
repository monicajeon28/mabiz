/**
 * Cache Strategy Definitions
 * Optimizes response times across all dashboard APIs
 */

export interface CacheConfig {
  key: string;
  ttl: number; // seconds
  dependencies: string[]; // Invalidation triggers
  description: string;
}

export const CACHE_STRATEGIES: Record<string, CacheConfig> = {
  // Hero KPIs: Recompute every 5 minutes
  HERO_KPIS: {
    key: "kpi:hero:{orgId}",
    ttl: 300,
    dependencies: ["contact:created", "sale:confirmed"],
    description:
      "Hero metrics (revenue, new contacts, conversion, AOV) - 5min TTL for near real-time",
  },

  // Metrics Pyramid: 10-minute cache
  METRICS_PYRAMID: {
    key: "analytics:pyramid:{orgId}",
    ttl: 600,
    dependencies: [
      "contact:created",
      "sale:confirmed",
      "risk:updated",
      "partner:updated",
    ],
    description: "5-layer pyramid data - 10min TTL for dashboard consistency",
  },

  // Contact churn predictions: 1-hour cache (slower computation)
  CHURN_PREDICTIONS: {
    key: "predict:churn:{orgId}",
    ttl: 3600,
    dependencies: [
      "contact:updated",
      "calllog:created",
      "memo:created",
      "sale:status_changed",
    ],
    description: "Churn predictions for all contacts - 1hr TTL (compute-heavy)",
  },

  // Partner churn risks: 1-hour cache
  PARTNER_CHURN_RISKS: {
    key: "partner:churn:{orgId}",
    ttl: 3600,
    dependencies: ["partner:updated", "sale:confirmed", "settlement:updated"],
    description: "Partner at-risk analysis - 1hr TTL",
  },

  // Upsell opportunities: 2-hour cache
  UPSELL_OPPORTUNITIES: {
    key: "predict:upsell:{orgId}",
    ttl: 7200,
    dependencies: ["contact:updated", "calllog:created"],
    description: "Upsell predictions - 2hr TTL (less volatile)",
  },

  // Settlement analytics: 5-minute cache
  SETTLEMENT_ANALYTICS: {
    key: "settlement:analytics:{orgId}",
    ttl: 300,
    dependencies: ["settlement:updated", "settlement_event:created"],
    description: "Settlement data with materialized view - 5min TTL",
  },

  // Compliance status: 1-day cache (compliance checks are slow)
  COMPLIANCE_STATUS: {
    key: "compliance:status:{orgId}",
    ttl: 86400,
    dependencies: ["contact:deleted", "audit_log:created"],
    description: "GDPR compliance score - 1day TTL",
  },

  // Unified dashboard: 2-minute cache (combines fast + slow data)
  UNIFIED_DASHBOARD: {
    key: "dashboard:unified:{orgId}",
    ttl: 120,
    dependencies: [
      "kpi:updated",
      "churn:updated",
      "partner:updated",
      "activity:created",
    ],
    description:
      "All dashboard data combined - 2min TTL for balanced freshness",
  },

  // System health: 30-second cache (should be fresh)
  SYSTEM_HEALTH: {
    key: "system:health:{orgId}",
    ttl: 30,
    dependencies: ["log:created", "config:updated"],
    description: "System status checks - 30sec TTL for real-time health",
  },
};

/**
 * Cache invalidation patterns
 * When an event occurs, which caches should be cleared?
 */
export const INVALIDATION_TRIGGERS: Record<string, string[]> = {
  "contact:created": [
    "HERO_KPIS",
    "METRICS_PYRAMID",
    "CHURN_PREDICTIONS",
    "UPSELL_OPPORTUNITIES",
    "UNIFIED_DASHBOARD",
  ],
  "sale:confirmed": [
    "HERO_KPIS",
    "METRICS_PYRAMID",
    "PARTNER_CHURN_RISKS",
    "CHURN_PREDICTIONS",
    "UNIFIED_DASHBOARD",
  ],
  "calllog:created": [
    "CHURN_PREDICTIONS",
    "UPSELL_OPPORTUNITIES",
    "METRICS_PYRAMID",
  ],
  "memo:created": ["CHURN_PREDICTIONS", "UPSELL_OPPORTUNITIES"],
  "partner:updated": ["PARTNER_CHURN_RISKS", "METRICS_PYRAMID"],
  "settlement:updated": [
    "SETTLEMENT_ANALYTICS",
    "PARTNER_CHURN_RISKS",
    "METRICS_PYRAMID",
  ],
  "contact:deleted": ["COMPLIANCE_STATUS", "HERO_KPIS", "METRICS_PYRAMID"],
};

/**
 * Redis key structure for distributed caching
 */
export function getCacheKey(strategy: string, orgId: string): string {
  const config = CACHE_STRATEGIES[strategy];
  if (!config) {
    throw new Error(`Unknown cache strategy: ${strategy}`);
  }
  return config.key.replace("{orgId}", orgId);
}

/**
 * Calculate cache hit ratio for optimization
 */
export interface CacheMetrics {
  strategy: string;
  hits: number;
  misses: number;
  hitRatio: number;
  avgResponseTime: number; // ms with cache
  estimatedCostSavings: number; // % reduction in DB queries
}

export const calculateMetrics = (
  strategy: string,
  hits: number,
  misses: number,
  responseTime: number
): CacheMetrics => {
  const total = hits + misses;
  const hitRatio = total > 0 ? hits / total : 0;
  const costSavings = hitRatio * 95; // Cache saves ~95% of DB time

  return {
    strategy,
    hits,
    misses,
    hitRatio,
    avgResponseTime: responseTime,
    estimatedCostSavings,
  };
};
