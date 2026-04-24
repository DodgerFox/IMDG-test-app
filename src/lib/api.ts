// API client with refresh-token logic
import { loadTokensFromStorage, saveTokens, clearAuth } from './stores';
import { parseLoginResponse, parseIMDGList, type LoginResponse } from './validators';

const BASE = '/api';
const DEFAULT_TIMEOUT = 12_000; // ms

function getAccessToken(data: LoginResponse): string | null {
  return data.access?.token ?? data.access_token ?? data.token ?? null;
}

function getRefreshToken(data: LoginResponse): string | null {
  return data.refresh?.token ?? data.refresh_token ?? null;
}

let isRefreshing = false;
let refreshPromise: Promise<void> | null = null;

async function doRefresh(refreshToken: string): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);
  try {
    const res = await fetch(`${BASE}/authentication/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      signal: controller.signal,
    });

    if (!res.ok) throw new Error('refresh-failed');
    const dataRaw = await res.json().catch(() => ({} as unknown));
    const data = parseLoginResponse(dataRaw);

    const access = getAccessToken(data);
    if (!access) throw new Error('refresh-failed-no-access-token');

    const nextRefresh = getRefreshToken(data) ?? refreshToken;
    saveTokens(access, nextRefresh);
  } finally {
    clearTimeout(timer);
  }
}

export async function login(email: string, password: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);
  try {
    const res = await fetch(`${BASE}/authentication/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`login failed: ${res.status} ${text}`);
    }

    const dataRaw = await res.json().catch(() => ({} as unknown));
    const data = parseLoginResponse(dataRaw);
    const access = getAccessToken(data);
    if (!access) throw new Error('login failed: access token missing');

    saveTokens(access, getRefreshToken(data));
  } finally {
    clearTimeout(timer);
  }
}

async function tryRefreshOnce(): Promise<void> {
  if (isRefreshing && refreshPromise) return refreshPromise;
  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const refreshToken = localStorage.getItem('refresh_token');
      if (!refreshToken) throw new Error('no-refresh-token');
      await doRefresh(refreshToken);
    } catch (e) {
      // clear auth on refresh failure
      clearAuth();
      throw e;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

/**
 * fetch wrapper that automatically attaches access token and tries one refresh on 401.
 * Respects an optional timeout via DEFAULT_TIMEOUT.
 */
export async function fetchWithAuth(
  input: RequestInfo,
  init: RequestInit = {},
  retry = true,
  timeout = DEFAULT_TIMEOUT
): Promise<Response> {
  loadTokensFromStorage();

  const headers = new Headers(init.headers ?? {});
  const accessToken = localStorage.getItem('access_token');
  if (accessToken) headers.set('Token', accessToken);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(typeof input === 'string' ? input : input, {
      ...init,
      headers,
      signal: controller.signal,
    });

    if (res.status === 401 && retry) {
      await tryRefreshOnce();
      const newAccess = localStorage.getItem('access_token');
      const h2 = new Headers(init.headers ?? {});
      if (newAccess) h2.set('Token', newAccess);
      return await fetch(typeof input === 'string' ? input : input, { ...init, headers: h2 });
    }

    return res;
  } finally {
    clearTimeout(timer);
  }
}

export type IMDGItem = Record<string, unknown>;

export async function getIMDGList(
  params: { page?: number; pageSize?: number; filters?: Record<string, string> } = {}
) {
  const p = new URLSearchParams();
  if (typeof params.page === 'number') p.set('page', String(params.page));
  if (typeof params.pageSize === 'number') p.set('perPage', String(params.pageSize));
  if (params.filters) {
    for (const [k, v] of Object.entries(params.filters)) {
      if (v) p.set(k, v);
    }
  }

  const url = `${BASE}/imdg${p.toString() ? `?${p.toString()}` : ''}`;
  const res = await fetchWithAuth(url);
  if (!res.ok) throw new Error(`imdg list failed: ${res.status}`);

  // Try to parse JSON, but handle non-json gracefully
  // Parse and validate IMDG list
  const listRaw = await res.json().catch(() => [] as unknown);
  const list = parseIMDGList(listRaw) as IMDGItem[];

  let total = 0;
  try {
    const countRes = await fetchWithAuth(`${BASE}/imdg/count`);
    if (countRes.ok) {
      const countText = await countRes.text();
      const parsed = Number(countText);
      total = Number.isNaN(parsed) ? 0 : parsed;
    }
  } catch (e) {
    // ignore count failures, keep total = 0
  }

  return { items: Array.isArray(list) ? list : [], total };
}

export { BASE };
