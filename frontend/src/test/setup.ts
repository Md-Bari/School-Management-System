import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { resetServerOffset } from '../api/clock';
import { setLang } from '../i18n';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  resetServerOffset();
  setLang('bn');
  window.localStorage.clear();
  window.location.hash = '';
});
