import 'dotenv/config';

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

export const env = {
  port: positiveInt(process.env.PORT, 3000),
  fetchTimeoutMs: positiveInt(process.env.FETCH_TIMEOUT_MS, 8000),
  maxBytes: positiveInt(process.env.MAX_BYTES, 2_000_000),
  rateLimitWindowMs: positiveInt(process.env.RATE_LIMIT_WINDOW_MS, 60_000),
  rateLimitMax: positiveInt(process.env.RATE_LIMIT_MAX, 20),
  allowPrivateHosts: process.env.ALLOW_PRIVATE_HOSTS === 'true',
  userAgent:
    process.env.USER_AGENT ??
    'PagePulseBot/1.0 (+https://github.com/Adamkoda2306/Page-Pulse-Internship-Task)',
} as const;