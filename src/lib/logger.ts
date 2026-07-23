type LogContext = Record<string, unknown>;

function sanitize(context?: LogContext): LogContext | undefined {
  if (!context) return undefined;
  const blocked = /token|secret|password|pin|photo|authorization/i;
  return Object.fromEntries(
    Object.entries(context).map(([key, value]) => [key, blocked.test(key) ? '[REDACTED]' : value]),
  );
}

export const logger = {
  info(message: string, context?: LogContext) {
    console.info(message, sanitize(context));
  },
  warn(message: string, context?: LogContext) {
    console.warn(message, sanitize(context));
  },
  error(message: string, error?: unknown, context?: LogContext) {
    console.error(message, {
      ...sanitize(context),
      error: error instanceof Error ? error.message : String(error ?? ''),
    });
  },
};
