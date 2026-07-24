import { normalizeUrl } from '../../utils/url.utils';
import { AppError } from '../../utils/appError.utils';

/** Asserts the thrown error is an AppError with the expected status and code. */
function expectAppError(fn: () => unknown, status: number, code: string) {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ status, code });
    return;
  }
  throw new Error('Expected normalizeUrl to throw, but it returned.');
}

describe('normalizeUrl - accepted input', () => {
  it('assumes https for a bare domain', () => {
    expect(normalizeUrl('example.com').toString()).toBe('https://example.com/');
  });

  it('keeps an explicit http scheme', () => {
    expect(normalizeUrl('http://example.com').toString()).toBe('http://example.com/');
  });

  it('preserves path, query and port', () => {
    expect(normalizeUrl('https://example.com:8080/a/b?q=1&r=2').toString()).toBe(
      'https://example.com:8080/a/b?q=1&r=2',
    );
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeUrl('   example.com/docs  ').toString()).toBe('https://example.com/docs');
  });

  it('drops the fragment, which never reaches the server anyway', () => {
    const url = normalizeUrl('https://example.com/page#section-2');
    expect(url.hash).toBe('');
    expect(url.toString()).toBe('https://example.com/page');
  });

  it('allows localhost so the tool can be pointed at a dev server', () => {
    expect(normalizeUrl('http://localhost:3000').hostname).toBe('localhost');
  });
});

describe('normalizeUrl - rejected input', () => {
  it('rejects an empty string', () => {
    expectAppError(() => normalizeUrl('   '), 400, 'INVALID_URL');
  });

  it('rejects a hostname with no dot', () => {
    expectAppError(() => normalizeUrl('not a url'), 400, 'INVALID_URL');
  });

  it.each(['ftp://example.com', 'file:///etc/passwd', 'javascript://example.com/%0aalert(1)'])(
    'rejects the %s scheme',
    (input) => {
      expectAppError(() => normalizeUrl(input), 400, 'UNSUPPORTED_PROTOCOL');
    },
  );

  it('rejects a scheme with nothing after it', () => {
    expectAppError(() => normalizeUrl('https://'), 400, 'INVALID_URL');
  });
});