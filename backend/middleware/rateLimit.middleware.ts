import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/appError.utils';

interface Options {
  windowMs: number;
  max: number;
}

/**
 * Small in-memory limiter. Enough for a single free-tier instance; swap for Redis
 * if this ever runs on more than one process.
 */
export function rateLimit({ windowMs, max }: Options) {
  const hits = new Map<string, { count: number; resetAt: number }>();

  return (req: Request, _res: Response, next: NextFunction) => {
    const key = req.ip ?? 'unknown';
    const now = Date.now();
    const entry = hits.get(key);

    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (++entry.count > max) {
      const retryIn = Math.ceil((entry.resetAt - now) / 1000);
      return next(
        new AppError(429, 'RATE_LIMITED', `Too many requests. Try again in ${retryIn}s.`),
      );
    }

    next();
  };
}