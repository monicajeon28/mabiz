type LogLevel = "log" | "warn" | "error";

function formatMessage(level: LogLevel, message: string, data?: object): string {
  const ts = new Date().toISOString();
  const dataStr = data ? " " + JSON.stringify(data) : "";
  return `[${ts}] [${level.toUpperCase()}] ${message}${dataStr}`;
}

const isServer = typeof process !== "undefined" && process.stdout != null;

export const logger = {
  log: (message: string, data?: object) => {
    if (process.env.NODE_ENV !== "production") {
      if (isServer) {
        process.stdout.write(formatMessage("log", message, data) + "\n");
      } else {
        console.log(formatMessage("log", message, data));
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
  error: (message: string, data?: object) => {
    if (isServer) {
      process.stderr.write(formatMessage("error", message, data) + "\n");
    } else {
      console.error(formatMessage("error", message, data));
    }
  },
};
