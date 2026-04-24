import { describe, it, expect, vi, beforeEach } from 'vitest';
import { auth, saveTokens, loadTokensFromStorage, clearAuth } from '$lib/stores';

describe('stores auth', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetAllMocks();
  });

  it('saveTokens writes to localStorage and updates store', async () => {
    const ready = new Promise<void>((resolve) => {
      const unsubscribe = auth.subscribe((val) => {
        if (val.accessToken === 'a' && val.refreshToken === 'r') {
          expect(localStorage.getItem('access_token')).toBe('a');
          expect(localStorage.getItem('refresh_token')).toBe('r');
          unsubscribe();
          resolve();
        }
      });
    });

    saveTokens('a', 'r');
    await ready;
  });

  it('loadTokensFromStorage reads localStorage into store', async () => {
    localStorage.setItem('access_token', 'x');
    localStorage.setItem('refresh_token', 'y');

    const ready = new Promise<void>((resolve) => {
      const unsubscribe = auth.subscribe((val) => {
        if (val.accessToken === 'x') {
          expect(val.refreshToken).toBe('y');
          unsubscribe();
          resolve();
        }
      });
    });

    loadTokensFromStorage();
    await ready;
  });

  it('clearAuth clears storage and resets store', async () => {
    localStorage.setItem('access_token', 'will');
    localStorage.setItem('refresh_token', 'be-cleared');

    const ready = new Promise<void>((resolve) => {
      const unsubscribe = auth.subscribe((val) => {
        if (val.accessToken === null && val.refreshToken === null) {
          expect(localStorage.getItem('access_token')).toBeNull();
          expect(localStorage.getItem('refresh_token')).toBeNull();
          unsubscribe();
          resolve();
        }
      });
    });

    clearAuth();
    await ready;
  });
});
