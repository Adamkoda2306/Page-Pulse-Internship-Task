import { Router } from 'express';
import { auditUrl } from '../controllers/audit.controller';
import { rateLimit } from '../middleware/rateLimit.middleware';
import { env } from '../config/env.config';

const router = Router();

router.post(
  '/',
  rateLimit({ windowMs: env.rateLimitWindowMs, max: env.rateLimitMax }),
  auditUrl,
);

export default router;