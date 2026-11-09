const DEFAULT_API_BASE_URL = 'http://localhost:8080';

/**
 * Backend URL, in order of precedence:
 *  1. window.__APP_CONFIG__.apiBaseUrl — written into /config.js from API_BASE_URL when the
 *     Docker container starts (so it can change without rebuilding the image)
 *  2. VITE_API_BASE_URL — build-time variable, handy for `npm run dev`
 *  3. http://localhost:8080
 */
export function getApiBaseUrl(): string {
  const runtime = typeof window !== 'undefined' ? window.__APP_CONFIG__?.apiBaseUrl : undefined;
  const buildTime = import.meta.env.VITE_API_BASE_URL;
  return (runtime || buildTime || DEFAULT_API_BASE_URL).trim().replace(/\/+$/, '');
}
