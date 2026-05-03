// API client with refresh-token logic
import { loadTokensFromStorage, saveTokens, clearAuth } from './stores';
import { parseLoginResponse, parseIMDGList, type LoginResponse } from './validators';

const BASE = '/api';
const DEFAULT_TIMEOUT = 12_000; // ms

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function asToken(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function pickToken(...values: unknown[]): string | null {
  for (const value of values) {
    const token = asToken(value);
    if (token) return token;
  }
  return null;
}

function getAccessToken(data: LoginResponse): string | null {
  const root = asRecord(data);
  const access = asRecord(root?.access);
  const tokens = asRecord(root?.tokens);
  const tokensAccess = asRecord(tokens?.access);

  return pickToken(
    access?.token,
    root?.access_token,
    root?.accessToken,
    root?.AccessToken,
    root?.token,
    root?.Token,
    tokens?.access_token,
    tokens?.accessToken,
    tokens?.token,
    tokensAccess?.token
  );
}

function getRefreshToken(data: LoginResponse): string | null {
  const root = asRecord(data);
  const refresh = asRecord(root?.refresh);
  const tokens = asRecord(root?.tokens);
  const tokensRefresh = asRecord(tokens?.refresh);

  return pickToken(
    refresh?.token,
    root?.refresh_token,
    root?.refreshToken,
    root?.RefreshToken,
    tokens?.refresh_token,
    tokens?.refreshToken,
    tokensRefresh?.token
  );
}

function shouldClearAuthAfterRefreshError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  if (msg.includes('no-refresh-token')) return true;
  if (msg.includes('refresh-failed: 400')) return true;
  if (msg.includes('refresh-failed: 401')) return true;
  if (msg.includes('refresh-failed: 403')) return true;
  return false;
}

let isRefreshing = false;
let refreshPromise: Promise<void> | null = null;

async function doRefresh(refreshToken: string): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);
  try {
    const res = await fetch('/proxy/authentication/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const details = await res.text().catch(() => '');
      throw new Error(`refresh-failed: ${res.status} ${details}`);
    }

    const dataRaw = await res.json().catch(() => null as unknown);
    if (!dataRaw || typeof dataRaw !== 'object') {
      throw new Error('refresh-failed-empty-body');
    }

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
    const auth = btoa(`${email}:${password}`);
    const res = await fetch(`${BASE}/authentication`, {
      method: 'GET',
      headers: { Authorization: `Basic ${auth}` },
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
      // Clear auth only when refresh token is absent/invalid.
      // For transient network/server errors keep session and let user retry.
      if (shouldClearAuthAfterRefreshError(e)) clearAuth();
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

function toBase64Url(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let base64: string;
  if (typeof btoa === 'function') {
    let binary = '';
    for (const b of bytes) binary += String.fromCharCode(b);
    base64 = btoa(binary);
  } else {
    base64 = Buffer.from(bytes).toString('base64');
  }
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function buildImdgFilter(filters?: Record<string, string>): string | null {
  if (!filters) return null;
  const clauses: unknown[] = [];
  const numericFields = new Set(['id']);
  const prefixDigitsByField: Record<string, number> = {
    id: 4,
  };

  for (const [field, value] of Object.entries(filters)) {
    const trimmed = value.trim();
    if (!trimmed) continue;

    if (numericFields.has(field) && /^-?\d+$/.test(trimmed)) {
      const parsed = Number(trimmed);
      const prefixDigits = prefixDigitsByField[field];

      if (prefixDigits && trimmed.length < prefixDigits && parsed >= 0) {
        const scale = 10 ** (prefixDigits - trimmed.length);
        const lower = parsed * scale;
        const upper = lower + scale - 1;
        clauses.push(['between', field, lower, upper]);
      } else {
        clauses.push(['eq', field, parsed]);
      }
      continue;
    }

    clauses.push(['like', field, `%${trimmed}%`]);
  }
  if (clauses.length === 0) return null;
  if (clauses.length === 1) return JSON.stringify(clauses[0]);
  return JSON.stringify(['and', ...clauses]);
}

export async function getIMDGList(
  params: { page?: number; pageSize?: number; filters?: Record<string, string> } = {}
) {
  const p = new URLSearchParams();
  if (typeof params.page === 'number') p.set('page', String(params.page));
  if (typeof params.pageSize === 'number') p.set('perPage', String(params.pageSize));
  const filterExpr = buildImdgFilter(params.filters);
  if (filterExpr) {
    p.set('filter', toBase64Url(filterExpr));
  }

  const url = `${BASE}/imdg${p.toString() ? `?${p.toString()}` : ''}`;
  const res = await fetchWithAuth(url);
  if (!res.ok) {
    const details = await res.text().catch(() => '');
    throw new Error(`imdg list failed: ${res.status} ${details}`);
  }

  // Try to parse JSON, but handle non-json gracefully
  // Parse and validate IMDG list
  const listRaw = await res.json().catch(() => [] as unknown);
  const list = parseIMDGList(listRaw) as IMDGItem[];

  let total = Array.isArray(list) ? list.length : 0;
  try {
    const countUrl = `${BASE}/imdg/count${p.toString() ? `?${p.toString()}` : ''}`;
    const countRes = await fetchWithAuth(countUrl);
    if (countRes.ok) {
      const countText = await countRes.text();
      const parsed = Number(countText);
      total = Number.isNaN(parsed) ? 0 : parsed;
    }
  } catch (_e) {
    // ignore count failures; fallback total is current list length
  }

  return { items: Array.isArray(list) ? list : [], total };
}

export { BASE };
