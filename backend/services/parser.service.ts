import { load } from 'cheerio';
import type { ContentReport } from '../types';

export function parseHtml(html: string): ContentReport {
  const $ = load(html);

  const title = collapse($('head title').first().text());
  const metaDescription = collapse(
    $('meta[name="description" i]').first().attr('content') ?? '',
  );
  const h1Count = $('h1').length;

  const images = $('img');
  const imagesTotal = images.length;
  const missingAlt = images.filter((_, el) => {
    const alt = $(el).attr('alt');
    return alt === undefined || alt.trim() === '';
  }).length;

  // Word count is an estimate of visible copy, so drop nodes that never render as text.
  $('script, style, noscript, template, svg').remove();
  const text = collapse($('body').text() || $.root().text());
  const wordCount = text ? text.split(' ').length : 0;

  return {
    title,
    metaDescription,
    h1Count,
    images: { total: imagesTotal, missingAlt },
    wordCount,
  };
}

/** Squashes whitespace and turns empty strings into null, so "" and missing look the same. */
function collapse(value: string): string | null {
  const trimmed = value.replace(/\s+/g, ' ').trim();
  return trimmed.length > 0 ? trimmed : null;
}