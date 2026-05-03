import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const UPSTREAM = 'https://book.sequoialab.ru/api/authentication/refresh';
const TIMEOUT_MS = 12_000;

export const POST: RequestHandler = async ({ request, fetch }) => {
  const body = (await request.json().catch(() => null)) as { refreshToken?: string } | null;
  const refreshToken = body?.refreshToken?.trim();

  if (!refreshToken) {
    return json({ message: 'refreshToken is required' }, { status: 400 });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const upstream = await fetch(UPSTREAM, {
      method: 'GET',
      headers: {
        Token: refreshToken,
        'User-Agent': 'api',
      },
      signal: controller.signal,
      cache: 'no-store',
    });

    const contentType = upstream.headers.get('content-type') ?? 'application/json; charset=utf-8';
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: {
        'content-type': contentType,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Refresh proxy error';
    return json({ message }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
};
