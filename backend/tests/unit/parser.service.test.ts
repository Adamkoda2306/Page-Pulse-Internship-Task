import { parseHtml } from '../../services/parser.service';

const fullPage = `
<!doctype html>
<html lang="en">
  <head>
    <title>   Acme    Widgets  </title>
    <meta name="description" content="  We make widgets.  " />
    <script>const noise = "one two three four";</script>
    <style>body { color: red; }</style>
  </head>
  <body>
    <h1>Acme Widgets</h1>
    <p>We have been making widgets since 1994.</p>
    <img src="a.png" alt="A widget" />
    <img src="b.png" />
    <img src="c.png" alt="   " />
    <noscript>Please enable JavaScript.</noscript>
  </body>
</html>`;

describe('parseHtml - happy path', () => {
  const report = parseHtml(fullPage);

  it('collapses whitespace in the title', () => {
    expect(report.title).toBe('Acme Widgets');
  });

  it('reads and trims the meta description', () => {
    expect(report.metaDescription).toBe('We make widgets.');
  });

  it('counts h1 tags', () => {
    expect(report.h1Count).toBe(1);
  });

  it('counts images and the ones without usable alt text', () => {
    expect(report.images).toEqual({ total: 3, missingAlt: 2 });
  });

  it('counts only visible words', () => {
    // "Acme Widgets" + "We have been making widgets since 1994." = 9.
    // Script, style and noscript contents are excluded.
    expect(report.wordCount).toBe(9);
  });
});

describe('parseHtml - failure and edge cases', () => {
  it('returns null instead of empty strings when title and description are absent', () => {
    const report = parseHtml('<html><body><p>Just some text.</p></body></html>');

    expect(report.title).toBeNull();
    expect(report.metaDescription).toBeNull();
    expect(report.h1Count).toBe(0);
    expect(report.images).toEqual({ total: 0, missingAlt: 0 });
    expect(report.wordCount).toBe(3);
  });

  it('does not throw on malformed HTML with unclosed tags', () => {
    const broken = '<html><body><h1>Unclosed heading<div><p>Stray paragraph<img src="x.png">';
    const report = parseHtml(broken);

    expect(report.h1Count).toBe(1);
    expect(report.images).toEqual({ total: 1, missingAlt: 1 });
    expect(report.wordCount).toBeGreaterThan(0);
  });

  it('does not throw when the body is not HTML at all', () => {
    const report = parseHtml('{"error":"not a webpage"}');

    expect(report.title).toBeNull();
    expect(report.h1Count).toBe(0);
    expect(report.images.total).toBe(0);
  });

  it('handles an empty document', () => {
    expect(parseHtml('')).toEqual({
      title: null,
      metaDescription: null,
      h1Count: 0,
      images: { total: 0, missingAlt: 0 },
      wordCount: 0,
    });
  });

  it('treats a whitespace-only title as missing', () => {
    expect(parseHtml('<html><head><title>   </title></head><body></body></html>').title).toBeNull();
  });

  it('treats an empty meta description as missing', () => {
    const html = '<html><head><meta name="description" content=""></head><body></body></html>';
    expect(parseHtml(html).metaDescription).toBeNull();
  });

  it('matches the description meta tag regardless of attribute casing', () => {
    const html = '<html><head><meta name="Description" content="Cased."></head><body></body></html>';
    expect(parseHtml(html).metaDescription).toBe('Cased.');
  });

  it('reports every h1 when a page has more than one', () => {
    const html = '<body><h1>One</h1><h2>Skip</h2><h1>Two</h1><h1>Three</h1></body>';
    expect(parseHtml(html).h1Count).toBe(3);
  });

  it('ignores an svg <title> so only the document title is reported', () => {
    const html = '<html><head><title>Real title</title></head><body><svg><title>Icon</title></svg></body></html>';
    expect(parseHtml(html).title).toBe('Real title');
  });

  it('keeps script and style contents out of the word count', () => {
    const html = '<body><script>alpha beta gamma delta</script><p>three real words</p></body>';
    expect(parseHtml(html).wordCount).toBe(3);
  });

  // Deliberate: an audit cannot tell a decorative image from a forgotten alt,
  // so alt="" is flagged rather than silently passed.
  it('flags alt="" as missing alt text', () => {
    expect(parseHtml('<body><img src="a.png" alt=""></body>').images).toEqual({
      total: 1,
      missingAlt: 1,
    });
  });
});