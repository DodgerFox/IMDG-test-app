import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import ru from '$lib/i18n/messages/ru';
import en from '$lib/i18n/messages/en';

export type Locale = 'ru' | 'en';

const STORAGE_KEY = 'lang';

export const language = writable<Locale>('ru');

const messages = { ru, en };
export type TranslationKey = keyof typeof ru;

export function initLanguage() {
  if (!browser) return;

  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === 'ru' || saved === 'en') {
    language.set(saved);
    return;
  }

  const browserLang = navigator.language.toLowerCase();
  language.set(browserLang.startsWith('ru') ? 'ru' : 'en');
}

export function setLanguage(next: Locale) {
  language.set(next);
  if (browser) {
    localStorage.setItem(STORAGE_KEY, next);
  }
}

export function t(key: TranslationKey, locale: Locale): string {
  return messages[locale][key] ?? messages.ru[key] ?? key;
}
