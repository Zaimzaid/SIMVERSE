/**
 * Centralized, minimal logging abstraction.
 *
 * All application logging should go through this module rather than raw
 * console calls, so that future SIMVERSE phases can route logs to a real sink
 * (simulations, exports, AI operations, payments, workers, API calls, errors)
 * without touching call sites.
 */
type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

type LogMeta = Record<string, unknown>;

const minLevel: LogLevel = process.env.NODE_ENV === "production" ? "info" : "debug";

function write(level: LogLevel, message: string, meta?: LogMeta): void {
  if (LEVEL_WEIGHT[level] < LEVEL_WEIGHT[minLevel]) return;

  const entry = {
    level,
    message,
    time: new Date().toISOString(),
    ...meta,
  };
  const line = JSON.stringify(entry);

  // Single controlled sink. Swap this for a transport in later phases.
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export interface Logger {
  debug(message: string, meta?: LogMeta): void;
  info(message: string, meta?: LogMeta): void;
  warn(message: string, meta?: LogMeta): void;
  error(message: string, meta?: LogMeta): void;
  child(scope: string): Logger;
}

function createLogger(scope?: string): Logger {
  const withScope = (meta?: LogMeta): LogMeta =>
    scope ? { scope, ...meta } : { ...meta };

  return {
    debug: (message, meta) => write("debug", message, withScope(meta)),
    info: (message, meta) => write("info", message, withScope(meta)),
    warn: (message, meta) => write("warn", message, withScope(meta)),
    error: (message, meta) => write("error", message, withScope(meta)),
    child: (childScope) =>
      createLogger(scope ? `${scope}:${childScope}` : childScope),
  };
}

export const logger = createLogger();
