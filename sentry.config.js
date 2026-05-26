/**
 * Sentry Configuration for mabiz-crm
 * Captures & tracks errors in production
 *
 * Error Categories:
 * - 🔴 CRITICAL (500/503): Fatal errors requiring immediate action
 * - 🟠 HIGH (400/FK violation): Business logic errors
 * - 🟡 MEDIUM (warnings): Performance issues >300ms
 * - 🟢 LOW (info): Non-critical events
 */

const Sentry = require('@sentry/node');
const { ProfilingIntegration } = require('@sentry/profiling-node');

const ENVIRONMENT = process.env.NODE_ENV || 'development';
const DSN = process.env.SENTRY_DSN || '';

/**
 * Error severity mapping
 */
const SEVERITY_MAP = {
  FATAL: 'fatal',      // 🔴 Critical - immediate response needed
  ERROR: 'error',      // 🟠 High - business logic error
  WARNING: 'warning',  // 🟡 Medium - performance warning
  INFO: 'info'         // 🟢 Low - informational
};

/**
 * Critical error patterns to catch immediately
 */
const CRITICAL_PATTERNS = {
  // API Errors
  API_500: /^5\d{2}/,
  API_503: /503/,
  DB_FK_VIOLATION: /foreign key/i,
  DB_UNIQUE_VIOLATION: /unique constraint/i,
  DB_TIMEOUT: /timeout|deadlock/i,

  // Auth Errors
  AUTH_INVALID_TOKEN: /invalid token|jwt|unauthorized/i,
  AUTH_SESSION_EXPIRED: /session expired|401/i,

  // Payment Errors
  PAYMENT_DECLINED: /card declined|payment failed/i,
  PAYMENT_TIMEOUT: /payment timeout/i,

  // Contact/Data Errors
  CONTACT_FK_ORPHAN: /contact.*foreign key|orphan contact/i,
  DUPLICATE_CONTACT: /duplicate.*contact|unique constraint.*contact/i,
  DATA_CORRUPTION: /data corruption|integrity check|constraint violation/i
};

/**
 * Initialize Sentry
 */
function initializeSentry() {
  Sentry.init({
    dsn: DSN,
    environment: ENVIRONMENT,
    tracesSampleRate: ENVIRONMENT === 'production' ? 0.1 : 1.0,
    profilesSampleRate: ENVIRONMENT === 'production' ? 0.1 : 1.0,
    integrations: [
      new ProfilingIntegration(),
      new Sentry.Integrations.Http({ tracing: true }),
      new Sentry.Integrations.OnUncaughtException(),
      new Sentry.Integrations.OnUnhandledRejection()
    ],

    // Performance monitoring
    maxBreadcrumbs: 50,
    maxValueLength: 1000,
    attachStacktrace: true,

    // Custom before send hook for error filtering
    beforeSend(event, hint) {
      // Filter out expected errors
      if (isExpectedError(event, hint)) {
        return null;
      }

      // Enhance error with context
      enrichErrorContext(event);

      // Determine severity
      event.level = determineSeverity(event);

      return event;
    },

    // Ignore certain errors
    ignoreErrors: [
      'ResizeObserver loop limit exceeded',
      'Non-Error promise rejection captured',
      'NetworkError',
      'TimeoutError'
    ],

    // Release tracking
    release: process.env.GITHUB_SHA ? process.env.GITHUB_SHA.substring(0, 7) : 'unknown'
  });
}

/**
 * Check if error is expected (should be ignored)
 */
function isExpectedError(event, hint) {
  const message = (event.message || '').toLowerCase();
  const errorType = hint?.originalException?.constructor?.name;

  // Known non-critical errors
  const expected = [
    /cancelled|aborted|timeout/i,
    /network|offline/i,
    /user closed/i
  ];

  return expected.some(pattern => pattern.test(message));
}

/**
 * Enrich error with additional context
 */
function enrichErrorContext(event) {
  if (!event.contexts) {
    event.contexts = {};
  }

  // Add request context if available
  if (typeof window !== 'undefined') {
    event.contexts.browser = {
      url: window.location.href,
      userAgent: navigator.userAgent
    };
  }

  // Add environment info
  event.contexts.runtime = {
    environment: ENVIRONMENT,
    nodeVersion: process.version,
    timestamp: new Date().toISOString()
  };

  // Add custom tags
  event.tags = {
    ...event.tags,
    service: 'mabiz-crm',
    environment: ENVIRONMENT,
    type: categorizeError(event)
  };
}

/**
 * Categorize error by type
 */
function categorizeError(event) {
  const message = (event.message || '').toLowerCase();

  if (message.includes('api') || message.includes('fetch')) return 'api';
  if (message.includes('database') || message.includes('db')) return 'database';
  if (message.includes('auth') || message.includes('login')) return 'authentication';
  if (message.includes('payment') || message.includes('stripe')) return 'payment';
  if (message.includes('contact') || message.includes('crm')) return 'crm';
  if (message.includes('campaign') || message.includes('sms')) return 'campaign';
  if (message.includes('affiliate') || message.includes('sales')) return 'affiliate';

  return 'other';
}

/**
 * Determine error severity
 */
function determineSeverity(event) {
  const message = (event.message || '').toLowerCase();
  const statusCode = event.tags?.httpStatus;

  // Critical errors
  if (statusCode >= 500 || statusCode === 503) {
    return SEVERITY_MAP.FATAL;
  }

  if (Object.values(CRITICAL_PATTERNS).some(pattern => {
    return pattern instanceof RegExp ? pattern.test(message) : message.includes(pattern);
  })) {
    return SEVERITY_MAP.ERROR;
  }

  // High priority errors
  if (statusCode >= 400 && statusCode < 500) {
    return SEVERITY_MAP.ERROR;
  }

  // Performance warnings
  if (event.tags?.duration > 3000) {
    return SEVERITY_MAP.WARNING;
  }

  return SEVERITY_MAP.INFO;
}

/**
 * Capture exception with context
 */
function captureException(error, context = {}) {
  Sentry.withScope(scope => {
    // Add custom context
    Object.entries(context).forEach(([key, value]) => {
      scope.setContext(key, value);
    });

    // Capture the error
    Sentry.captureException(error);
  });
}

/**
 * Capture message
 */
function captureMessage(message, level = 'info', context = {}) {
  Sentry.withScope(scope => {
    Object.entries(context).forEach(([key, value]) => {
      scope.setContext(key, value);
    });

    Sentry.captureMessage(message, level);
  });
}

/**
 * Start transaction for performance monitoring
 */
function startTransaction(name, op = 'http.request') {
  return Sentry.startTransaction({
    name,
    op,
    tracesSampleRate: 1.0
  });
}

/**
 * Error handler for Express/Next.js
 */
function errorHandler(error, request, response, next) {
  Sentry.captureException(error, {
    request,
    contexts: {
      express: {
        method: request.method,
        url: request.url,
        query: request.query,
        body: request.body ? JSON.stringify(request.body).substring(0, 500) : null
      }
    }
  });

  // Respond with error
  response.status(500).json({
    error: 'Internal Server Error',
    errorId: Sentry.lastEventId(),
    timestamp: new Date().toISOString()
  });
}

/**
 * API endpoint error tracking
 */
function trackApiError(endpoint, statusCode, error, duration) {
  const severity = statusCode >= 500 ? 'fatal' : statusCode >= 400 ? 'error' : 'warning';

  Sentry.captureMessage(`API Error: ${endpoint}`, severity, {
    contexts: {
      api: {
        endpoint,
        statusCode,
        duration,
        errorMessage: error?.message,
        errorCode: error?.code
      }
    },
    tags: {
      httpStatus: statusCode,
      endpoint: endpoint.split('?')[0],
      type: 'api'
    }
  });
}

/**
 * Database error tracking
 */
function trackDatabaseError(operation, table, error) {
  const message = error?.message || '';
  let severity = 'error';
  let errorType = 'unknown';

  if (message.includes('foreign key')) {
    errorType = 'fk_violation';
    severity = 'fatal';
  } else if (message.includes('unique constraint')) {
    errorType = 'duplicate_record';
    severity = 'error';
  } else if (message.includes('timeout') || message.includes('deadlock')) {
    errorType = 'timeout';
    severity = 'warning';
  }

  Sentry.captureMessage(
    `Database Error: ${operation} on ${table}`,
    severity,
    {
      contexts: {
        database: {
          operation,
          table,
          errorType,
          errorMessage: message
        }
      },
      tags: {
        type: 'database',
        operation,
        table,
        errorType
      }
    }
  );
}

/**
 * Contact/CRM error tracking
 */
function trackCrmError(action, contactId, error) {
  Sentry.captureMessage(
    `CRM Error: ${action} on Contact ${contactId}`,
    'error',
    {
      contexts: {
        crm: {
          action,
          contactId,
          errorMessage: error?.message
        }
      },
      tags: {
        type: 'crm',
        action,
        contactId
      }
    }
  );
}

/**
 * Campaign/SMS error tracking
 */
function trackCampaignError(campaignId, action, error) {
  Sentry.captureMessage(
    `Campaign Error: ${action} on Campaign ${campaignId}`,
    'error',
    {
      contexts: {
        campaign: {
          campaignId,
          action,
          errorMessage: error?.message
        }
      },
      tags: {
        type: 'campaign',
        action,
        campaignId
      }
    }
  );
}

/**
 * Performance metric tracking
 */
function trackPerformance(name, duration, metadata = {}) {
  if (duration > 3000) {
    Sentry.captureMessage(
      `Performance Warning: ${name} took ${duration}ms`,
      'warning',
      {
        contexts: {
          performance: {
            name,
            duration,
            ...metadata
          }
        },
        tags: {
          type: 'performance',
          name
        }
      }
    );
  }
}

/**
 * Health check status
 */
function reportHealthStatus(checks) {
  const failedChecks = Object.entries(checks)
    .filter(([_, status]) => !status)
    .map(([name]) => name);

  if (failedChecks.length > 0) {
    Sentry.captureMessage(
      `Health Check Failed: ${failedChecks.join(', ')}`,
      'error',
      {
        contexts: {
          health: checks
        },
        tags: {
          type: 'health_check'
        }
      }
    );
  }
}

module.exports = {
  // Initialize
  initializeSentry,

  // Core methods
  captureException,
  captureMessage,
  startTransaction,

  // Specific tracking
  trackApiError,
  trackDatabaseError,
  trackCrmError,
  trackCampaignError,
  trackPerformance,
  reportHealthStatus,

  // Middleware
  errorHandler,

  // Sentry instance
  Sentry
};
