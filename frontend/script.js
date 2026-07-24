const form = document.getElementById('audit-form');
const input = document.getElementById('url');
const button = form.querySelector('button');
const statusEl = document.getElementById('status');
const resultEl = document.getElementById('result');

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const url = input.value.trim();
  if (!url) {
    showError('Enter a URL first.');
    return;
  }

  setLoading(true);
  resultEl.hidden = true;

  try {
    const response = await fetch('/api/audit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url }),
    });

    const payload = await response.json();

    if (!response.ok || !payload.ok) {
      showError(payload?.error?.message ?? 'The audit failed. Try again.');
      return;
    }

    statusEl.textContent = '';
    statusEl.classList.remove('error');
    render(payload.data);
  } catch {
    // Only fires if the request never completed (offline, server down).
    showError('Could not reach the server. Check your connection.');
  } finally {
    setLoading(false);
  }
});

function setLoading(isLoading) {
  button.disabled = isLoading;
  button.textContent = isLoading ? 'Auditing…' : 'Audit';
  if (isLoading) {
    statusEl.classList.remove('error');
    statusEl.textContent = 'Fetching the page…';
  }
}

function showError(message) {
  statusEl.textContent = message;
  statusEl.classList.add('error');
  resultEl.hidden = true;
}

function render(data) {
  const { content, http, timing } = data;
  const statusTone = http.status < 300 ? 'ok' : http.status < 400 ? 'warn' : 'bad';

  const notes = [`Fetched ${escapeHtml(data.finalUrl)}`];
  if (data.redirected) notes.push('redirected from the URL you entered');
  if (data.truncated) notes.push('page was large, so only the first 2 MB was parsed');

  resultEl.innerHTML = `
    <p class="meta">${notes.join(' · ')}</p>
    <div class="grid">
      ${card('HTTP status', `${http.status} ${escapeHtml(http.statusText)}`, statusTone)}
      ${card('Response time', `${timing.responseTimeMs} ms`, timing.responseTimeMs > 2000 ? 'warn' : 'ok')}
      ${card('H1 tags', content.h1Count, content.h1Count === 1 ? 'ok' : 'warn')}
      ${card('Word count', content.wordCount.toLocaleString())}
      ${card(
        'Images missing alt',
        `${content.images.missingAlt} of ${content.images.total}`,
        content.images.missingAlt === 0 ? 'ok' : 'bad',
      )}
      ${card('Content type', shorten(http.contentType) ?? 'unknown')}
      ${wideCard('Title', content.title, `${content.title?.length ?? 0} chars`)}
      ${wideCard('Meta description', content.metaDescription, `${content.metaDescription?.length ?? 0} chars`)}
    </div>
  `;
  resultEl.hidden = false;
}

function card(label, value, tone = '') {
  return `
    <div class="card">
      <div class="label">${label}</div>
      <div class="value ${tone}">${escapeHtml(String(value))}</div>
    </div>`;
}

function wideCard(label, value, suffix) {
  const body = value
    ? `${escapeHtml(value)} <span class="label">(${suffix})</span>`
    : '<span class="bad">missing</span>';
  return `
    <div class="card wide">
      <div class="label">${label}</div>
      <div class="value small">${body}</div>
    </div>`;
}

function shorten(contentType) {
  return contentType ? contentType.split(';')[0] : null;
}

// Page titles and descriptions come from arbitrary sites, so never trust them as HTML.
function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}