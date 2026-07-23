export class AppError extends Error {
  readonly code: string;
  override readonly cause?: unknown;

  constructor(
    message: string,
    code = 'APP_ERROR',
    cause?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.cause = cause;
  }
}

export function toAppError(error: unknown, fallback: string, code = 'UNEXPECTED_ERROR'): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof Error && error.message) return new AppError(error.message, code, error);
  return new AppError(fallback, code, error);
}

export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
