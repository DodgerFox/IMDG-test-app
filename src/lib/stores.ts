import { writable } from 'svelte/store';

export type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  user?: { email?: string } | null;
};

const initial: AuthState = {
  accessToken: null,
  refreshToken: null,
  user: null
};

export const auth = writable<AuthState>(initial);

export const saveTokens = (accessToken: string | null, refreshToken: string | null) => {
  if (accessToken) localStorage.setItem('access_token', accessToken);
  else localStorage.removeItem('access_token');

  if (refreshToken) localStorage.setItem('refresh_token', refreshToken);
  else localStorage.removeItem('refresh_token');

  auth.update((s) => ({ ...s, accessToken, refreshToken }));
};

export const loadTokensFromStorage = () => {
  const accessToken = localStorage.getItem('access_token');
  const refreshToken = localStorage.getItem('refresh_token');
  auth.set({ accessToken, refreshToken, user: accessToken ? { email: undefined } : null });
};

export const clearAuth = () => {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  auth.set(initial);
};
