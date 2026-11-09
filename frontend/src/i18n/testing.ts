import { bn, en } from './messages';

/** All texts of one language (test helper). */
export function messagesFor(lang: 'bn' | 'en'): string[] {
  return Object.values(lang === 'bn' ? bn : en);
}
