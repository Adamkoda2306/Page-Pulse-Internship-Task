/**
 * Any failure we can explain to the caller. Anything not thrown as an AppError
 * is treated as a bug and becomes a generic 500.
 */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}