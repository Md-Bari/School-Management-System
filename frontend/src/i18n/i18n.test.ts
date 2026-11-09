import { messagesFor } from './testing';
import { digits, getLang, setLang, t } from '.';
import { bn, en } from './messages';

describe('i18n', () => {
  it('has an English text for every Bangla key and no empty texts', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(bn).sort());
    expect(messagesFor('en').filter((m) => !m.trim())).toEqual([]);
  });

  it('defaults to Bangla and switches to English', () => {
    expect(getLang()).toBe('bn');
    expect(t('hold.pay')).toBe('ভর্তি ফি দিন');
    setLang('en');
    expect(t('hold.pay')).toBe('Pay admission fee');
  });

  it('fills placeholders', () => {
    setLang('en');
    expect(t('create.done', { name: 'Class 6', seats: 120 })).toBe('“Class 6” (120 seats) created.');
  });

  it('remembers the choice', () => {
    setLang('en');
    expect(window.localStorage.getItem('admission.lang')).toBe('en');
  });

  it('shows Bangla digits only in Bangla', () => {
    expect(digits('09:41')).toBe('০৯:৪১');
    setLang('en');
    expect(digits('09:41')).toBe('09:41');
  });
});
