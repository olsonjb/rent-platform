import pino from "pino";

export type Logger = pino.Logger;

const isProduction = process.env.NODE_ENV === "production";

/**
 * Create a structured logger scoped to a service name.
 * JSON output in production, pretty-printed in development.
 */
export function createLogger(service: string): Logger {
  return pino({
    name: service,
    level: process.env.LOG_LEVEL ?? (isProduction ? "info" : "debug"),
    ...(isProduction
      ? {}
      : {
          transport: {
            target: "pino-pretty",
            options: { colorize: true },
          },
        }),
  });
}

/**
 * Return a child logger with a correlation ID bound to every log entry.
 */
export function withCorrelationId(logger: Logger, correlationId: string): Logger {
  return logger.child({ correlationId });
}
