type LogLevel = "log" | "warn" | "error";

function formatMessage(level: LogLevel, message: string, data?: object): string {
  const ts = new Date().toISOString();
  const dataStr = data ? " " + JSON.stringify(data) : "";
  return `[${ts}] [${level.toUpperCase()}] ${message}${dataStr}`;
}

export const logger = {
  log: (message: string, data?: object) => {
    if (process.env.NODE_ENV !== "production") {
      process.stdout.write(formatMessage("log", message, data) + "\n");
    }
  },
  warn: (message: string, data?: object) => {
    process.stderr.write(formatMessage("warn", message, data) + "\n");
  },
  error: (message: string, data?: object) => {
    process.stderr.write(formatMessage("error", message, data) + "\n");
  },
};
