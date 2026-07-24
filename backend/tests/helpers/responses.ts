/** Builders for the fake upstream responses our mocked fetch returns. */

interface HtmlOptions {
  status?: number;
  statusText?: string;
  contentType?: string | null;
}

export function htmlResponse(body: string, options: HtmlOptions = {}): Response {
  const headers = new Headers();
  if (options.contentType !== null) {
    headers.set('content-type', options.contentType ?? 'text/html; charset=utf-8');
  }

  return new Response(body, {
    status: options.status ?? 200,
    statusText: options.statusText ?? 'OK',
    headers,
  });
}

export function redirectResponse(location: string, status = 302): Response {
  return new Response('', { status, statusText: 'Found', headers: { location } });
}

export const SAMPLE_PAGE = `<!doctype html>
<html lang="en">
  <head>
    <title>Acme Widgets</title>
    <meta name="description" content="We make widgets." />
  </head>
  <body>
    <h1>Acme Widgets</h1>
    <p>Widgets since 1994.</p>
    <img src="hero.png" alt="A widget" />
    <img src="logo.png" />
  </body>
</html>`;