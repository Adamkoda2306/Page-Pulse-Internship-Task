import { AppError } from './appError.utils';

/* Turns user input into a URL we are willing to fetch. Bare domains like "example.com" are assumed to be https. */
export function normalizeUrl(raw: string): URL {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new AppError(400, 'INVALID_URL', 'Please provide a URL.');
  }

  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed);
  let url: URL;

  try {
    url = new URL(hasScheme ? trimmed : `https://${trimmed}`);
  } catch {
    throw new AppError(400, 'INVALID_URL', `"${trimmed}" is not a valid URL.`);
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new AppError(
      400,
      'UNSUPPORTED_PROTOCOL',
      'Only http and https URLs can be audited.',
    );
  }

  if (!url.hostname.includes('.') && url.hostname !== 'localhost') {
    throw new AppError(400, 'INVALID_URL', `"${url.hostname}" is not a valid hostname.`);
  }

  url.hash = ''; // fragments never reach the server
  return url;
}