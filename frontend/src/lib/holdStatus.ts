import type { HoldStatus } from '../api/types';
import { t } from '../i18n';

/**
 * The server stores HELD until it notices expiry; the UI must not wait for that.
 * A HELD hold whose expiresAt has passed is shown as EXPIRED immediately.
 */
export function effectiveStatus(status: HoldStatus, expiresAt: string, nowMs: number): HoldStatus {
  if (status === 'HELD' && Date.parse(expiresAt) <= nowMs) return 'EXPIRED';
  return status;
}

export function remainingMs(expiresAt: string, nowMs: number): number {
  return Math.max(0, Date.parse(expiresAt) - nowMs);
}

export function statusLabel(status: HoldStatus): string {
  return t(`status.${status}`);
}

/** Full length of the hold, for the countdown's progress bar (null if unknown). */
export function holdLengthMs(createdAt: string | undefined, expiresAt: string): number | null {
  if (!createdAt) return null;
  const length = Date.parse(expiresAt) - Date.parse(createdAt);
  return Number.isFinite(length) && length > 0 ? length : null;
}

/** 0 → "00:00", 65_000 → "01:05", 3_725_000 → "1:02:05" */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}
