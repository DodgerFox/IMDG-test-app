import { writable, derived } from 'svelte/store';

export type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  user?: { email?: string } | null;
};

const initial: AuthState = {
  accessToken: null,
  refreshToken: null,
  user: null,
};

export const auth = writable<AuthState>(initial);

/**
 * Persist tokens to localStorage and update `auth` store.
 * Safe with try/catch to avoid errors in SSR or locked storage.
 */
export const saveTokens = (accessToken: string | null, refreshToken: string | null) => {
  try {
    if (accessToken) localStorage.setItem('access_token', accessToken);
    else localStorage.removeItem('access_token');

    if (refreshToken) localStorage.setItem('refresh_token', refreshToken);
    else localStorage.removeItem('refresh_token');
  } catch {
    // ignore storage errors
  }

  auth.update((s) => ({ ...s, accessToken, refreshToken }));
};

export const loadTokensFromStorage = () => {
  try {
    const accessToken = localStorage.getItem('access_token');
    const refreshToken = localStorage.getItem('refresh_token');
    auth.set({ accessToken, refreshToken, user: accessToken ? { email: undefined } : null });
  } catch {
    // ignore localStorage issues (e.g. SSR)
    auth.set(initial);
  }
};

export const clearAuth = () => {
  try {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  } catch {
    // ignore
  }
  auth.set(initial);
};

export const initAuth = () => {
  loadTokensFromStorage();
};

export const isAuthenticated = derived(auth, ($auth) => !!$auth.accessToken);
