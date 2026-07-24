import type { NextFunction, Request, Response } from 'express';
import { fetchPage } from '../services/fetcher.service';
import { parseHtml } from '../services/parser.service';
import type { AuditReport } from '../types';
import { AppError } from '../utils/appError.utils';
import { normalizeUrl } from '../utils/url.utils';

export async function auditUrl(req: Request, res: Response, next: NextFunction) {
  try {
    const { url } = req.body ?? {};

    if (typeof url !== 'string') {
      throw new AppError(400, 'MISSING_URL', 'Request body must include a "url" string.');
    }

    const target = normalizeUrl(url);
    const page = await fetchPage(target);

    // A 404 or 500 page is still HTML worth reporting on, so we parse regardless
    // of status and let the caller see the status code.
    const report: AuditReport = {
      requestedUrl: target.toString(),
      finalUrl: page.finalUrl,
      redirected: page.finalUrl !== target.toString(),
      http: {
        status: page.status,
        statusText: page.statusText,
        contentType: page.contentType,
      },
      timing: { responseTimeMs: page.responseTimeMs },
      content: parseHtml(page.html),
      truncated: page.truncated,
      fetchedAt: new Date().toISOString(),
    };

    res.json({ ok: true, data: report });
  } catch (error) {
    next(error);
  }
}