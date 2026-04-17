import { browser } from '$app/environment';
import { writable } from 'svelte/store';

export type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'theme';

export const theme = writable<ThemeMode>('light');

function apply(themeMode: ThemeMode) {
  if (!browser) return;
  document.documentElement.setAttribute('data-theme', themeMode);
}

export function initTheme() {
  if (!browser) return;

  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === 'light' || saved === 'dark') {
    theme.set(saved);
    apply(saved);
    return;
  }

  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const initial: ThemeMode = prefersDark ? 'dark' : 'light';
  theme.set(initial);
  apply(initial);
}

export function setTheme(next: ThemeMode) {
  theme.set(next);
  if (!browser) return;

  localStorage.setItem(STORAGE_KEY, next);
  apply(next);
}

export function toggleTheme() {
  let current: ThemeMode = 'light';
  const unsub = theme.subscribe((v) => {
    current = v;
  });
  unsub();

  setTheme(current === 'light' ? 'dark' : 'light');
}
