const UPSTREAM_BASE = 'https://book.sequoialab.ru/api';
const UPSTREAM_USER_AGENT = 'api';
const UPSTREAM_TIMEOUT_MS = 12000;
const UPSTREAM_RETRIES = 1;

export function basicAuth(username: string, password: string): string {
  return `Basic ${Buffer.from(`${username}:${password}`, 'utf8').toString('base64')}`;
}

export function upstreamUrl(pathWithLeadingSlash: string): string {
  return `${UPSTREAM_BASE}${pathWithLeadingSlash}`;
}

export function upstreamHeaders(extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  headers.set('User-Agent', UPSTREAM_USER_AGENT);
  return headers;
}

export async function fetchUpstream(pathWithLeadingSlash: string, init?: RequestInit): Promise<Response> {
  const url = upstreamUrl(pathWithLeadingSlash);
  let lastError: unknown;

  for (let attempt = 0; attempt <= UPSTREAM_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
        cache: 'no-store'
      });
      clearTimeout(timer);
      return response;
    } catch (error) {
      clearTimeout(timer);
      lastError = error;

      if (attempt < UPSTREAM_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        continue;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Upstream request failed');
}

export function upstreamFailureResponse(error: unknown): Response {
  const message = error instanceof Error ? error.message : 'Upstream request failed';
  return new Response(
    JSON.stringify({
      message: 'Upstream service is temporarily unavailable',
      details: message
    }),
    {
      status: 502,
      headers: {
        'content-type': 'application/json; charset=utf-8'
      }
    }
  );
}

export function passthroughResponse(upstream: Response): Response {
  const contentType = upstream.headers.get('content-type') ?? 'application/json; charset=utf-8';
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: {
      'content-type': contentType
    }
  });
}
