import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchWithAuth, BASE } from '$lib/api';

// Helper to build a Response-like object
function makeResponse(status = 200, body: any = null, ok = true) {
  const headers = new Headers({ 'content-type': 'application/json' });
  const blob = body === null ? null : JSON.stringify(body);
  return new Response(blob, { status, headers, statusText: String(status) });
}

describe('fetchWithAuth', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    localStorage.clear();
    vi.resetAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('attaches access token header when present', async () => {
    localStorage.setItem('access_token', 'abc-123');

    const fetchMock = vi.fn(async (_input: RequestInfo, init?: RequestInit) => {
      // assert header present
      const headers = new Headers((init?.headers ?? {}) as HeadersInit);
      expect(headers.get('Token')).toBe('abc-123');
      return makeResponse(200, { ok: true });
    });

    global.fetch = fetchMock as any;

    const res = await fetchWithAuth(`${BASE}/imdg`);
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('retries once after 401 by refreshing token', async () => {
    // sequence: first call -> 401, refresh call -> 200 with new token, retry original -> 200
    const calls: Array<() => Response | Promise<Response>> = [];

    // first: original request returns 401
    calls.push(() => makeResponse(401, { message: 'unauth' }, false));

    // second: refresh endpoint: return new access token
    calls.push(() => makeResponse(200, { access_token: 'new-token' }));

    // third: retried original request returns 200
    calls.push(() => makeResponse(200, [{ id: 1 }]));

    const fetchMock = vi.fn(async (input: RequestInfo) => {
      const call = calls.shift();
      if (!call) throw new Error('unexpected fetch');
      // for assertions: when calling refresh endpoint, expect path
      if (typeof input === 'string' && input.includes('/authentication/refresh')) {
        return call();
      }
      return call();
    });

    global.fetch = fetchMock as any;

    // set no initial token in storage, but doRefresh will put token into storage by mocking the refresh response
    localStorage.removeItem('access_token');
    localStorage.setItem('refresh_token', 'refresh-me');

    const res = await fetchWithAuth(`${BASE}/imdg`);
    expect(res.status).toBe(200);
    // at least 3 fetch calls were made
    expect(fetchMock).toHaveBeenCalledTimes(3);
    // ensure stored token updated
    expect(localStorage.getItem('access_token')).toBe('new-token');
  });
});
