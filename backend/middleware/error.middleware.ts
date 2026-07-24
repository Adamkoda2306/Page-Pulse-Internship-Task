import type { ErrorRequestHandler, NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/appError.utils';

export function notFound(_req: Request, _res: Response, next: NextFunction) {
  next(new AppError(404, 'NOT_FOUND', 'No such endpoint.'));
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.status).json({ ok: false, error: { code: err.code, message: err.message } });
    return;
  }

  const bodyParserStatus = (err as { status?: number })?.status;
  if (typeof bodyParserStatus === 'number' && bodyParserStatus >= 400 && bodyParserStatus < 500) {
    const [code, message] =
      err instanceof SyntaxError
        ? ['INVALID_JSON', 'Request body is not valid JSON.']
        : bodyParserStatus === 413
          ? ['PAYLOAD_TOO_LARGE', 'Request body is too large.']
          : ['BAD_REQUEST', 'Could not read the request body.'];

    res.status(bodyParserStatus).json({ ok: false, error: { code, message } });
    return;
  }

  console.error('Unhandled error:', err);
  res.status(500).json({
    ok: false,
    error: { code: 'INTERNAL_ERROR', message: 'Something went wrong on our side.' },
  });
};