// API client with refresh-token logic
import type { AuthState } from './stores';
import { loadTokensFromStorage, saveTokens, clearAuth } from './stores';

const BASE = '/api';

type AuthToken = {
  token: string;
  lifeTime?: number;
};

type LoginResponse = {
  access?: AuthToken;
  refresh?: AuthToken;
  access_token?: string;
  refresh_token?: string;
  token?: string;
};

function getAccessToken(data: LoginResponse): string | null {
  return data.access?.token ?? data.access_token ?? data.token ?? null;
}

function getRefreshToken(data: LoginResponse): string | null {
  return data.refresh?.token ?? data.refresh_token ?? null;
}

let isRefreshing = false;
let refreshPromise: Promise<void> | null = null;

async function doRefresh(refreshToken: string) {
  const res = await fetch(`${BASE}/authentication/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken })
  });

  if (!res.ok) throw new Error('refresh-failed');
  const data: LoginResponse = await res.json();

  const access = getAccessToken(data);
  if (!access) throw new Error('refresh-failed-no-access-token');

  const nextRefresh = getRefreshToken(data) ?? refreshToken;
  saveTokens(access, nextRefresh);
}

export async function login(email: string, password: string) {
  const res = await fetch(`${BASE}/authentication/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`login failed: ${res.status} ${text}`);
  }
  const data: LoginResponse = await res.json();

  const access = getAccessToken(data);
  if (!access) throw new Error('login failed: access token missing');

  saveTokens(access, getRefreshToken(data));
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
      clearAuth();
      throw e;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

export async function fetchWithAuth(input: RequestInfo, init: RequestInit = {}, retry = true): Promise<Response> {
  loadTokensFromStorage();
  const accessToken = localStorage.getItem('access_token');
  const headers = new Headers(init.headers ?? {});
  if (accessToken) headers.set('Token', accessToken);

  const res = await fetch(typeof input === 'string' ? input : input, { ...init, headers });

  if (res.status === 401 && retry) {
    try {
      await tryRefreshOnce();
      const newAccess = localStorage.getItem('access_token');
      const h2 = new Headers(init.headers ?? {});
      if (newAccess) h2.set('Token', newAccess);
      return fetch(typeof input === 'string' ? input : input, { ...init, headers: h2 });
    } catch (e) {
      throw e;
    }
  }
  return res;
}

export type IMDGItem = Record<string, any>;

export async function getIMDGList(params: { page?: number; pageSize?: number; filters?: Record<string, string> }) {
  const p = new URLSearchParams();
  if (params.page) p.set('page', String(params.page));
  if (params.pageSize) p.set('perPage', String(params.pageSize));
  if (params.filters) {
    for (const k of Object.keys(params.filters)) {
      if (params.filters[k]) p.set(k, params.filters[k]);
    }
  }

  const url = `${BASE}/imdg?${p.toString()}`;
  const res = await fetchWithAuth(url);
  if (!res.ok) throw new Error(`imdg list failed: ${res.status}`);
  const list = (await res.json()) as IMDGItem[];

  const countRes = await fetchWithAuth(`${BASE}/imdg/count`);
  const countText = await countRes.text();
  const total = Number(countText);

  return { items: Array.isArray(list) ? list : [], total: Number.isNaN(total) ? 0 : total };
}

export { BASE };
