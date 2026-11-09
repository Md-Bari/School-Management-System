import { useSyncExternalStore } from 'react';
import { bn, en, type MessageKey } from './messages';

export type Lang = 'bn' | 'en';
export type { MessageKey };

const STORAGE_KEY = 'admission.lang';
const DICTIONARIES: Record<Lang, Record<MessageKey, string>> = { bn, en };
const BANGLA_DIGITS = '০১২৩৪৫৬৭৮৯';

function readStored(): Lang {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'bn';
  } catch {
    return 'bn';
  }
}

let current: Lang = typeof window === 'undefined' ? 'bn' : readStored();
const listeners = new Set<() => void>();

export function getLang(): Lang {
  return current;
}

/** Switches the UI language, remembers it, and re-renders every subscribed component. */
export function setLang(lang: Lang): void {
  current = lang;
  try {
    window.localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // storage disabled: the choice still applies until the page is closed
  }
  document.documentElement.lang = lang;
  listeners.forEach((notify) => notify());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Translated text for `key` in the current language, with `{placeholders}` filled in. */
export function t(key: MessageKey, params?: Record<string, string | number>): string {
  const text = DICTIONARIES[current][key] ?? bn[key];
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (_, name: string) => (name in params ? String(params[name]) : `{${name}}`));
}

export function hasMessage(key: string): key is MessageKey {
  return key in bn;
}

/** Numbers are shown with Bangla digits in Bangla, ASCII digits in English. */
export function digits(value: string | number): string {
  const text = String(value);
  return current === 'bn' ? text.replace(/\d/g, (d) => BANGLA_DIGITS[Number(d)]) : text;
}

/** Re-renders the calling component when the language changes. */
export function useLang(): { lang: Lang; setLang: (lang: Lang) => void } {
  const lang = useSyncExternalStore(subscribe, getLang, getLang);
  return { lang, setLang };
}
