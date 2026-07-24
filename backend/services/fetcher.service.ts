import { lookup } from 'node:dns/promises';
import { env } from '../config/env.config';
import { AppError } from '../utils/appError.utils';
import { isPrivateAddress } from '../utils/net.utils';

const MAX_REDIRECTS = 5;
const REDIRECT_CODES = new Set([301, 302, 303, 307, 308]);

export interface FetchedPage {
    finalUrl: string;
    status: number;
    statusText: string;
    contentType: string | null;
    responseTimeMs: number;
    html: string;
    truncated: boolean;
}

export async function fetchPage(target: URL): Promise<FetchedPage> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), env.fetchTimeoutMs);
    const startedAt = Date.now();

    try {
        let current = target;
        let response: Response;
        let hops = 0;

        // Redirects are followed by hand so every hop gets the private-host check.
        // fetch's built-in "follow" would hide a redirect from example.com to 127.0.0.1.
        for (; ;) {
            await assertPublicHost(current.hostname);
            response = await request(current, controller.signal);

            const location = response.headers.get('location');
            if (!REDIRECT_CODES.has(response.status) || !location) break;

            if (++hops > MAX_REDIRECTS) {
                throw new AppError(
                    502,
                    'TOO_MANY_REDIRECTS',
                    `Gave up after ${MAX_REDIRECTS} redirects.`,
                );
            }

            await response.body?.cancel();
            current = resolveRedirect(location, current);
        }

        const contentType = response.headers.get('content-type');
        if (contentType && !contentType.toLowerCase().includes('html')) {
            await response.body?.cancel();
            throw new AppError(
                415,
                'UNSUPPORTED_CONTENT_TYPE',
                `Expected an HTML page but the server returned "${contentType.split(';')[0]}".`,
            );
        }

        const { html, truncated } = await readCapped(response, controller.signal);

        return {
            finalUrl: current.toString(),
            status: response.status,
            statusText: response.statusText || '',
            contentType,
            responseTimeMs: Date.now() - startedAt,
            html,
            truncated,
        };
    } finally {
        clearTimeout(timer);
    }
}

async function request(url: URL, signal: AbortSignal): Promise<Response> {
    try {
        return await fetch(url, {
            signal,
            redirect: 'manual',
            headers: {
                'user-agent': env.userAgent,
                accept: 'text/html,application/xhtml+xml',
                'accept-language': 'en',
            },
        });
    } catch (error) {
        throw toNetworkError(error, signal);
    }
}

async function assertPublicHost(hostname: string): Promise<void> {
    if (env.allowPrivateHosts) return;

    let addresses: { address: string }[];
    try {
        addresses = await lookup(hostname, { all: true });
    } catch {
        throw new AppError(502, 'DNS_LOOKUP_FAILED', `Could not resolve "${hostname}".`);
    }

    if (addresses.some((entry) => isPrivateAddress(entry.address))) {
        throw new AppError(
            403,
            'BLOCKED_HOST',
            'Auditing private or local network addresses is not allowed.',
        );
    }
}

function resolveRedirect(location: string, from: URL): URL {
    let next: URL;
    try {
        next = new URL(location, from);
    } catch {
        throw new AppError(502, 'BAD_REDIRECT', 'The server sent an invalid redirect.');
    }

    if (next.protocol !== 'http:' && next.protocol !== 'https:') {
        throw new AppError(
            502,
            'BAD_REDIRECT',
            'The server redirected to a non-http protocol.',
        );
    }
    return next;
}

/** Reads the body but stops at MAX_BYTES so one huge page cannot exhaust memory. */
async function readCapped(
    response: Response,
    signal: AbortSignal,
): Promise<{ html: string; truncated: boolean }> {
    const reader = response.body?.getReader();
    if (!reader) {
        return {
            html: '',
            truncated: false,
        };
    }
    const chunks: Uint8Array[] = [];
    let received = 0;
    let truncated = false;
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (!value) continue;
            const remaining = env.maxBytes - received;
            if (value.length > remaining) {
                chunks.push(value.subarray(0, remaining));
                received += remaining;
                truncated = true;
                await reader.cancel();
                break;
            }
            chunks.push(value);
            received += value.length;
        }
    } catch (err) {
        throw toNetworkError(err, signal);
    }

    return {
        html: Buffer.concat(chunks).toString("utf8"),
        truncated,
    };
}

function toNetworkError(error: unknown, signal: AbortSignal): AppError {
    if (error instanceof AppError)
        return error;
    if (signal.aborted || (error instanceof DOMException && error.name === "AbortError")) {
        return new AppError(
            504,
            "TIMEOUT",
            `The page did not respond within ${env.fetchTimeoutMs}ms.`,
        );
    }
    return new AppError(
        502,
        "FETCH_FAILED",
        "Could not reach that URL. Check the domain and try again.",
    );
}