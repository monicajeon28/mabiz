type LogLevel = "log" | "warn" | "error" | "debug";

/**
 * T-032: Prisma 에러 raw 쿼리/파라미터/컬럼명 로그 노출 방지
 * err/error 키에서 안전한 필드(name, message, code, meta)만 추출
 */
function sanitizeError(data?: object | unknown): object | undefined {
  if (!data || typeof data !== 'object') return data as object | undefined;
  const d = data as Record<string, unknown>;

  const safeErr = (e: unknown): unknown => {
    if (!e || typeof e !== 'object') return String(e);
    const err = e as Record<string, unknown>;
    return {
      name: err.name,
      message: err.message,
      // Prisma ClientKnownRequestError: code와 meta만 포함 (쿼리 원문 제외)
      ...(err.code ? { code: err.code } : {}),
      ...(err.meta && typeof err.meta === 'object' ? { meta: err.meta } : {}),
    };
  };

  return {
    ...d,
    ...(d.err !== undefined ? { err: safeErr(d.err) } : {}),
    ...(d.error !== undefined && typeof d.error === 'object' ? { error: safeErr(d.error) } : {}),
  };
}

function formatMessage(level: LogLevel, message: string, data?: object): string {
  const ts = new Date().toISOString();
  const safe = sanitizeError(data);
  const dataStr = safe ? " " + JSON.stringify(safe) : "";
  return `[${ts}] [${level.toUpperCase()}] ${message}${dataStr}`;
}

const isServer = typeof process !== "undefined" && process.stdout != null;

export const logger = {
  info: (message: string, data?: object) => {
    if (isServer) {
      process.stdout.write(formatMessage("log", message, data) + "\n");
    } else {
      console.log(formatMessage("log", message, data));
    }
  },
  log: (message: string, data?: object) => {
    if (isServer && process.env.NODE_ENV !== "production") {
      process.stdout.write(formatMessage("log", message, data) + "\n");
    } else if (!isServer) {
      console.log(formatMessage("log", message, data));
    }
  },
  debug: (message: string, data?: object) => {
    if (process.env.NODE_ENV !== "production") {
      if (isServer) {
        process.stdout.write(formatMessage("debug", message, data) + "\n");
      } else {
        console.debug(formatMessage("debug", message, data));
      }
    }
  },
  warn: (message: string, data?: object) => {
    if (isServer) {
      process.stderr.write(formatMessage("warn", message, data) + "\n");
    } else {
      console.warn(formatMessage("warn", message, data));
    }
  },
  error: (message: string, data?: object | unknown) => {
    if (isServer) {
      process.stderr.write(formatMessage("error", message, data as object | undefined) + "\n");
    } else {
      console.error(formatMessage("error", message, data as object | undefined));
    }
  },
};

export default logger;
