import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { resetServerOffset } from '../api/clock';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  resetServerOffset();
  window.localStorage.clear();
  window.location.hash = '';
});
