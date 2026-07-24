import request from 'supertest';
import { lookup } from 'node:dns/promises';
import { app } from '../../app';
import { htmlResponse, redirectResponse, SAMPLE_PAGE } from '../helpers/responses';

jest.mock('node:dns/promises', () => ({ lookup: jest.fn() }));

const mockLookup = lookup as unknown as jest.Mock;
const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

// Every hop is DNS-checked, so resolve to a public address unless a test says otherwise.
beforeEach(() => {
  mockLookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
});

const audit = (url: unknown) => request(app).post('/api/audit').send({ url });

describe('POST /api/audit - success', () => {
  it('returns a full report for a healthy page', async () => {
    mockFetch.mockResolvedValue(htmlResponse(SAMPLE_PAGE));

    const response = await audit('https://example.com').expect(200);

    expect(response.body.ok).toBe(true);
    expect(response.body.data).toMatchObject({
      requestedUrl: 'https://example.com/',
      finalUrl: 'https://example.com/',
      redirected: false,
      truncated: false,
      http: { status: 200, statusText: 'OK' },
      content: {
        title: 'Acme Widgets',
        metaDescription: 'We make widgets.',
        h1Count: 1,
        images: { total: 2, missingAlt: 1 },
      },
    });
    expect(response.body.data.timing.responseTimeMs).toBeGreaterThanOrEqual(0);
    expect(Date.parse(response.body.data.fetchedAt)).not.toBeNaN();
  });

  it('accepts a bare domain and fills in https', async () => {
    mockFetch.mockResolvedValue(htmlResponse(SAMPLE_PAGE));

    const response = await audit('example.com').expect(200);

    expect(response.body.data.requestedUrl).toBe('https://example.com/');
    expect(mockFetch.mock.calls[0][0].toString()).toBe('https://example.com/');
  });

  it('follows redirects and reports where it landed', async () => {
    mockFetch
      .mockResolvedValueOnce(redirectResponse('/home', 301))
      .mockResolvedValueOnce(htmlResponse(SAMPLE_PAGE));

    const response = await audit('https://example.com').expect(200);

    expect(response.body.data).toMatchObject({
      finalUrl: 'https://example.com/home',
      redirected: true,
    });
  });

  it('still audits a page that returns 404, since the HTML is real', async () => {
    mockFetch.mockResolvedValue(
      htmlResponse('<html><head><title>Not found</title></head><body><h1>404</h1></body></html>', {
        status: 404,
        statusText: 'Not Found',
      }),
    );

    const response = await audit('https://example.com/missing').expect(200);

    expect(response.body.data.http).toMatchObject({ status: 404, statusText: 'Not Found' });
    expect(response.body.data.content.title).toBe('Not found');
  });

  it('flags a page that exceeds the byte cap instead of reporting a wrong count', async () => {
    const huge = `<html><body><p>${'word '.repeat(600)}</p></body></html>`; // > MAX_BYTES (2000 in tests)
    mockFetch.mockResolvedValue(htmlResponse(huge));

    const response = await audit('https://example.com/huge').expect(200);

    expect(response.body.data.truncated).toBe(true);
  });
});

describe('POST /api/audit - client errors', () => {
  it('rejects a body with no url', async () => {
    const response = await request(app).post('/api/audit').send({}).expect(400);
    expect(response.body.error.code).toBe('MISSING_URL');
  });

  it('rejects a url that is not a string', async () => {
    const response = await audit(42).expect(400);
    expect(response.body.error.code).toBe('MISSING_URL');
  });

  it('rejects an unparseable url', async () => {
    const response = await audit('not a url').expect(400);
    expect(response.body.error.code).toBe('INVALID_URL');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('rejects a non-http scheme', async () => {
    const response = await audit('file:///etc/passwd').expect(400);
    expect(response.body.error.code).toBe('UNSUPPORTED_PROTOCOL');
  });
});

describe('POST /api/audit - upstream failures', () => {
  it('returns 415 for a non-HTML response', async () => {
    mockFetch.mockResolvedValue(
      htmlResponse('%PDF-1.4', { contentType: 'application/pdf' }),
    );

    const response = await audit('https://example.com/report.pdf').expect(415);

    expect(response.body.error.code).toBe('UNSUPPORTED_CONTENT_TYPE');
    expect(response.body.error.message).toContain('application/pdf');
  });

  it('returns 504 when the page never responds', async () => {
    mockFetch.mockImplementation(
      (_url: URL, init: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () =>
            reject(new DOMException('The operation was aborted.', 'AbortError')),
          );
        }),
    );

    const response = await audit('https://slow.example.com').expect(504);
    expect(response.body.error.code).toBe('TIMEOUT');
  });

  it('returns 502 when the host cannot be reached', async () => {
    mockFetch.mockRejectedValue(new TypeError('fetch failed'));

    const response = await audit('https://does-not-exist.example.com').expect(502);
    expect(response.body.error.code).toBe('FETCH_FAILED');
  });

  it('returns 502 when DNS cannot resolve the host', async () => {
    mockLookup.mockRejectedValue(new Error('ENOTFOUND'));

    const response = await audit('https://nope.example.com').expect(502);
    expect(response.body.error.code).toBe('DNS_LOOKUP_FAILED');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('refuses a host that resolves to a private address', async () => {
    mockLookup.mockResolvedValue([{ address: '10.0.0.5', family: 4 }]);

    const response = await audit('https://internal.example.com').expect(403);
    expect(response.body.error.code).toBe('BLOCKED_HOST');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('refuses a redirect that lands on a private address', async () => {
    mockLookup
      .mockResolvedValueOnce([{ address: '93.184.216.34', family: 4 }])
      .mockResolvedValueOnce([{ address: '169.254.169.254', family: 4 }]);
    mockFetch.mockResolvedValue(redirectResponse('http://metadata.example.com/latest', 302));

    const response = await audit('https://example.com').expect(403);

    expect(response.body.error.code).toBe('BLOCKED_HOST');
    expect(mockFetch).toHaveBeenCalledTimes(1); // never fetched the internal host
  });

  it('gives up on a redirect loop', async () => {
    mockFetch.mockResolvedValue(redirectResponse('https://example.com/next', 302));

    const response = await audit('https://example.com').expect(502);
    expect(response.body.error.code).toBe('TOO_MANY_REDIRECTS');
  });
});