<div align="center">

# Page Pulse

**Paste a URL. Get the health of the page behind it in one shot.**

HTTP status · response time · title · meta description · H1 count · images missing alt text · word count

[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Express](https://img.shields.io/badge/Express-4.19-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![Jest](https://img.shields.io/badge/Jest-72%20tests%20passing-C21325?logo=jest&logoColor=white)](https://jestjs.io/)
[![Coverage](https://img.shields.io/badge/coverage-95%25%20statements-brightgreen)](#testing)

**[Live demo](https://page-pulse-internship-task.onrender.com/)** · **[Repo](https://github.com/Adamkoda2306/Page-Pulse-Internship-Task)**

</div>

---

## What this is

A small web tool that audits any public URL. You type a URL, it fetches the page, parses the HTML, and hands back a report you can read at a glance.

It is deliberately not a full SEO suite. It does a handful of checks properly, refuses politely when it can't, and never returns a half-truth dressed up as a result. Most of the work in here went into the "what if the page is broken" paths, because that's where a tool like this usually falls over.

**Stack:** TypeScript, Express and Cheerio on the backend. Plain HTML, CSS and JavaScript on the frontend — no build step, no framework. The frontend is roughly 200 lines and a framework would have cost more than it returned.

---

## Quick start

Node 18.17 or newer is required — the fetcher uses the built-in `fetch` and `AbortController`.

```bash
git clone https://github.com/Adamkoda2306/Page-Pulse-Internship-Task.git
cd Page-Pulse-Internship-Task/backend

npm install
npm run dev               # http://localhost:3000
```

Express serves the `frontend/` folder, so opening `http://localhost:3000` gives you the UI and the API on the same origin. No separate frontend server, no CORS dance in development.

**Production:**

```bash
npm run build
npm start
```

### Environment

Every variable has a working default, so an empty `.env` still boots. These are the knobs worth knowing:

| Variable | Default | What it controls |
| --- | --- | --- |
| `PORT` | `3000` | Server port |
| `FETCH_TIMEOUT_MS` | `8000` | Total budget for one audit, redirects included |
| `MAX_BYTES` | `2000000` | Stop reading the response body past this size (2 MB) |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Rate limit window |
| `RATE_LIMIT_MAX` | `20` | Audits allowed per IP per window |
| `ALLOW_PRIVATE_HOSTS` | `false` | Set `true` only to point the tool at your own localhost |
| `USER_AGENT` | `PagePulseBot/1.0` | Sent with every outbound request, so site owners can identify us |

> **Note:** the test suite overrides `FETCH_TIMEOUT_MS` and `MAX_BYTES` with much smaller values so the timeout and truncation paths run in milliseconds. Don't copy those numbers into your real `.env` — a 2 KB cap will truncate every page on the internet.

---

## Project structure

```
.
├── backend
│   ├── app.ts                          # express app: middleware, routes, static frontend
│   ├── server.ts                       # listen() only, so tests can import the app
│   ├── config
│   │   └── env.config.ts               # env parsing with defaults, read once
│   ├── controllers
│   │   └── audit.controller.ts         # request in, report out
│   ├── services
│   │   ├── fetcher.service.ts          # network: redirects, SSRF checks, size cap
│   │   └── parser.service.ts           # HTML in, ContentReport out. No I/O.
│   ├── middleware
│   │   ├── error.middleware.ts         # single place that turns errors into JSON
│   │   └── rateLimit.middleware.ts
│   ├── routes
│   │   └── audit.routes.ts
│   ├── types
│   │   └── index.ts                    # the API response shape, in one file
│   ├── utils
│   │   ├── appError.utils.ts           # errors we can explain to the caller
│   │   ├── net.utils.ts                # private IP range checks
│   │   └── url.utils.ts                # normalize and validate user input
│   ├── tests
│   │   ├── helpers
│   │   │   └── responses.ts            # fake upstream responses
│   │   ├── unit
│   │   │   ├── parser.service.test.ts
│   │   │   ├── url.test.ts
│   │   │   ├── net.test.ts
│   │   │   └── rateLimit.middleware.test.ts
│   │   └── integration
│   │       ├── audit.route.test.ts
│   │       └── app.test.ts
│   ├── jest.config.js
│   ├── tsconfig.json
│   └── package.json
├── frontend
│   ├── index.html
│   ├── styles.css
│   └── script.js
├── LICENSE
└── README.md
```

The split that matters is `fetcher` versus `parser`. The parser is a pure function — HTML string in, report object out, no network, no clock, no config. That's why it's the easiest part of the codebase to test properly, and it's where the brief asked for tests.

---

## API contract

Base URL in development: `http://localhost:3000`

### `POST /api/audit`

Audits a single URL.

**Request**

```json
{ "url": "example.com" }
```

`url` is required and must be a string. A missing scheme is assumed to be `https`, so `example.com`, `https://example.com` and `  example.com/docs ` are all accepted. Fragments are stripped — they never reach the server anyway.

**Success — `200 OK`**

```json
{
  "ok": true,
  "data": {
    "requestedUrl": "https://example.com/",
    "finalUrl": "https://example.com/",
    "redirected": false,
    "http": {
      "status": 200,
      "statusText": "OK",
      "contentType": "text/html; charset=UTF-8"
    },
    "timing": { "responseTimeMs": 412 },
    "content": {
      "title": "Example Domain",
      "metaDescription": null,
      "h1Count": 1,
      "images": { "total": 0, "missingAlt": 0 },
      "wordCount": 28
    },
    "truncated": false,
    "fetchedAt": "2026-07-24T12:00:00.000Z"
  }
}
```

A few things worth reading off that shape:

- `title` and `metaDescription` are `null` when absent — never `""`. A missing tag and an empty tag are the same problem to a person reading the report, so they look the same in the response.
- `redirected` and `finalUrl` are separate fields so the UI can say "you asked for X, you got Y" without diffing strings.
- `truncated` is `true` when the page blew past `MAX_BYTES`. The word count is then an undercount, and the response says so rather than pretending otherwise.

**Failure — same envelope, every time**

```json
{
  "ok": false,
  "error": {
    "code": "TIMEOUT",
    "message": "The page did not respond within 8000ms."
  }
}
```

`code` is stable and meant for machines. `message` is written for a human and is safe to render straight into the UI.

| Status | Code | When it happens |
| --- | --- | --- |
| `400` | `MISSING_URL` | No `url` field, or it isn't a string |
| `400` | `INVALID_URL` | Not parseable as a URL |
| `400` | `UNSUPPORTED_PROTOCOL` | Anything that isn't `http` or `https` |
| `400` | `INVALID_JSON` | Malformed request body |
| `403` | `BLOCKED_HOST` | Resolves to a private, loopback or link-local address |
| `413` | `PAYLOAD_TOO_LARGE` | Request body over 10 KB |
| `415` | `UNSUPPORTED_CONTENT_TYPE` | The server returned a PDF, image, JSON, etc. |
| `429` | `RATE_LIMITED` | More than 20 audits a minute from one IP |
| `502` | `FETCH_FAILED` | Could not reach the host |
| `502` | `DNS_LOOKUP_FAILED` | Hostname does not resolve |
| `502` | `TOO_MANY_REDIRECTS` | More than 5 hops |
| `502` | `BAD_REDIRECT` | Redirect target was invalid or non-http |
| `504` | `TIMEOUT` | Exceeded the fetch budget |
| `500` | `INTERNAL_ERROR` | A bug on our side. If you see this, it's mine. |

### `GET /api/health`

```json
{ "ok": true, "uptime": 42 }
```

Useful for uptime pings and for confirming a deploy actually came up.

---

## Design decisions

Three calls I made deliberately, and why.

### 1. A broken page is still audited. A non-HTML response is not.

The obvious implementation treats any non-2xx status as a failure and returns an error. I don't think that's right. A 404 page is real HTML, and "my error page has no title and no H1" is exactly the kind of thing a page auditor should tell you about. So the status code and the report come back side by side, and it's the caller's job to decide whether a 404 matters.

A PDF or a JSON endpoint is a different story. There is no title, no H1 and no meaningful word count to report, and returning a page of zeroes would look identical to a real result for a genuinely empty page. That's the worst possible outcome — a confident wrong answer. So non-HTML content types get a `415` with a message naming what came back instead.

The rule underneath both: **report what you actually found, refuse when you can't, never guess.**

### 2. Redirects are followed by hand, and every hop is DNS-checked.

This endpoint fetches whatever URL a stranger types into a public text box. That is a textbook SSRF surface, and the naive version is genuinely dangerous.

With `fetch(url, { redirect: 'follow' })`, a perfectly innocent-looking public domain can `302` the server to `169.254.169.254` — the cloud metadata endpoint — or to something on the deploy host's private network. The redirect happens inside `fetch`, my code never sees it, and the response comes back looking like a normal page. Checking only the URL the user typed protects nothing.

So the fetcher uses `redirect: 'manual'` and walks the chain itself. Before every single hop, including the first, the hostname is resolved and checked against loopback, RFC1918, link-local and carrier-grade NAT ranges. If any resolved address is private, the request is refused with a `403` and the connection is never opened. The chain is capped at 5 hops.

The same defensive instinct caps the response body at 2 MB. One enormous page shouldn't be able to exhaust memory on a free-tier instance, and when the cap is hit the report says `truncated: true` instead of quietly returning a wrong word count.

This cost about thirty lines. It's the part of the codebase I'd defend hardest.

### 3. No database.

I didn't use it.

Every field in the report is derived from a live fetch. Storing results would mean either serving stale data or building cache invalidation — for a tool whose entire value is that the numbers are current. Mongo would have added a connection to manage, credentials to configure, a new failure mode on boot, and a slower deploy, in exchange for nothing this feature needs.

The point where that changes is clear enough: a "recent audits" list, shareable report links, or tracking a URL's scores over time. Any of those makes persistence earn its cost. None of them are in this brief. Adding the database now would have been building for a feature nobody asked for, which is the more expensive mistake.

### Smaller calls worth naming

- **One error envelope everywhere.** `{ ok, error: { code, message } }` for every failure, including 404s and malformed JSON. The frontend has exactly one error branch as a result.
- **A per-IP rate limit.** An unauthenticated endpoint that makes outbound HTTP requests on demand is a free proxy if you leave it open. 20/minute is generous for real use and useless for abuse.
- **Everything from the page is escaped before rendering.** Titles and meta descriptions are attacker-controlled input, not trusted content. They get escaped on the way into the DOM.
- **Env is parsed once, in one file.** No `process.env` reads scattered through the codebase, and bad values fall back to defaults instead of producing `NaN` timeouts.

---

## Testing

```bash
npm test               # 72 tests across 6 suites
npm run test:unit
npm run test:integration
npm run test:coverage  # ~95% statements, ~87% branches
npm run typecheck
```

Jest with ts-jest, plus Supertest for the HTTP layer.

**Unit tests** cover the parser (happy path, malformed HTML with unclosed tags, non-HTML input, empty documents, whitespace-only titles, multiple H1s, and script/style content correctly excluded from the word count), URL normalization and rejection, the private-IP range boundaries, and the rate limiter.

**Integration tests** drive the real Express app through Supertest. Only `fetch` and `dns.lookup` are mocked — routing, the fetcher, the parser and the error middleware all run for real. That's the point: a service can throw exactly the right error and still be useless if the handler maps it to the wrong status, and only an end-to-end test catches that.

The test I'd point at first mocks a redirect from a public host to `169.254.169.254` and asserts both that the response is a `403` **and** that `fetch` was called exactly once — proving the internal address was never contacted, not merely that the error looked right.

Writing these found a real bug. `express.json({ limit: '10kb' })` throws a body-parser error carrying its own `status: 413`, which my original error handler didn't recognise — so an oversized request came back as a `500`, reading like a crash on my side rather than a client mistake. The handler now maps body-parser statuses properly, and there's a test pinning it.

---

## CI/CD Pipeline

This project uses **GitHub Actions** to automate continuous integration and deployment, ensuring that every code change is validated before being released. The workflow is triggered whenever changes are pushed or a pull request is created for the `main` branch, provided the modifications affect either the `backend` or `frontend` directories.

The pipeline performs the following automated steps:

1. **Install Dependencies**
   - Checks out the repository.
   - Sets up the Node.js environment.
   - Installs project dependencies using `npm ci`.

2. **Run Unit Tests**
   - Executes all Jest unit tests to verify the correctness of individual modules and utility functions.

3. **Run Integration Tests**
   - Runs integration tests to validate the complete request–response flow of the API and ensure that different components work together correctly.

4. **Generate Code Coverage**
   - Generates a coverage report using Jest.
   - Uploads the coverage report as a GitHub Actions artifact for future reference.

5. **Automated Deployment**
   - If all previous jobs complete successfully and the commit is pushed to the `main` branch, the workflow automatically triggers a deployment on **Render** using a secure Deploy Hook stored as a GitHub Secret.
   - This ensures that only tested and validated code is deployed to production.

### Pipeline Workflow

```text
Developer Push / Pull Request
            │
            ▼
      GitHub Actions Trigger
            │
            ▼
   Install Dependencies (npm ci)
            │
            ▼
      Run Unit Tests (Jest)
            │
            ▼
   Run Integration Tests (Jest)
            │
            ▼
     Generate Coverage Report
            │
            ▼
     Upload Coverage Artifact
            │
            ▼
      All Jobs Successful?
            │
            ▼
      ┌───────────────────────┐
      │ Yes                   │ No
      ▼                       ▼
 Trigger Render Deploy        Don't Trigger Render Deploy                   
      │
      ▼               
 Production Deployment
```

### Key Features

- Automated CI/CD using **GitHub Actions**.
- Executes workflows only when changes are made to the `backend` or `frontend` directories.
- Runs automated unit and integration tests.
- Generates and uploads code coverage reports.
- Uses dependency caching (`npm`) to improve workflow performance.
- Cancels outdated workflow runs using concurrency control.
- Automatically deploys to **Render** after all quality checks pass.
- Stores deployment credentials securely using **GitHub Secrets**.
- Ensures that only tested and validated code reaches production.

---

## Known limits

Things this tool does not do, listed here so nobody has to discover them the hard way:

- **JavaScript-rendered pages** are reported as their server-side HTML. A React app that renders its content client-side will look emptier than it is. Fixing this means a headless browser, which is a different order of complexity and cost.
- **The word count is an estimate.** Script, style, noscript and SVG nodes are stripped, but nav and footer boilerplate still counts as words.
- **The rate limiter is in-process.** It resets on deploy and wouldn't hold across multiple instances. Fine for one free-tier box; needs Redis the moment there are two.
- **`robots.txt` is not consulted.** A polite production version would check it before fetching.
- **The SSRF check has a TOCTOU gap.** The hostname is resolved for validation, then `fetch` resolves it again to connect. A DNS record with a very short TTL could answer public on the check and private on the connection — classic DNS rebinding. The proper fix is to resolve once and pin the connection to the validated IP via a custom agent. I know the shape of that fix; I chose not to ship an agent configuration I hadn't tested properly, so the current code stops the common case and this line documents what it doesn't cover.

---

## AI usage

Being straight about this, since it was asked for.

I used AI in three places. First, to break down the brief itself — I pasted the task in and worked through what was actually being asked, which requirements were load-bearing, and where the edge cases were likely to hide. Second, to generate a skeleton of the project so I had a structure to push against rather than a blank editor; I then reworked it into the shape you see here, renamed and reorganised the modules, and rewrote the parts I disagreed with. Third, for the test code, where I started by describing the main cases I wanted to cover and then asked for additional suggestions on missing scenarios, edge cases, and improvements to ensure the test suite was as comprehensive as possible before refining the implementations.

What I did not delegate: the decisions. The choice to audit non-2xx pages but reject non-HTML ones, the manual redirect handling and the SSRF checks behind it, the error taxonomy and response envelope, and the call to skip database entirely are mine, and the reasoning in this README is my reasoning. I read every line I kept, and where I couldn't defend something, it isn't in the repo.

---

## License

[MIT](./LICENSE)

---

<div align="center">

<a href="https://digitalheroesco.com">Built for Digital Heroes Training Task</a>

</div>