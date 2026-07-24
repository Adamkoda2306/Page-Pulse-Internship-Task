export interface ContentReport {
  title: string | null;
  metaDescription: string | null;
  h1Count: number;
  images: {
    total: number;
    missingAlt: number;
  };
  wordCount: number;
}

export interface AuditReport {
  requestedUrl: string;
  finalUrl: string;
  redirected: boolean;
  http: {
    status: number;
    statusText: string;
    contentType: string | null;
  };
  timing: {
    responseTimeMs: number;
  };
  content: ContentReport;
  truncated: boolean;
  fetchedAt: string;
}