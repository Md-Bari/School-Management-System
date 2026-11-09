import { effectiveStatus, formatDuration, remainingMs } from './holdStatus';

describe('holdStatus', () => {
  const expiresAt = '2026-11-01T04:10:00Z';
  const expiry = Date.parse(expiresAt);

  it('treats a HELD hold past its expiry as EXPIRED', () => {
    expect(effectiveStatus('HELD', expiresAt, expiry - 1)).toBe('HELD');
    expect(effectiveStatus('HELD', expiresAt, expiry)).toBe('EXPIRED');
    expect(effectiveStatus('CONFIRMED', expiresAt, expiry + 60_000)).toBe('CONFIRMED');
    expect(effectiveStatus('CANCELLED', expiresAt, expiry - 1)).toBe('CANCELLED');
  });

  it('never returns negative remaining time', () => {
    expect(remainingMs(expiresAt, expiry - 5_000)).toBe(5_000);
    expect(remainingMs(expiresAt, expiry + 5_000)).toBe(0);
  });

  it('formats durations as mm:ss or h:mm:ss', () => {
    expect(formatDuration(0)).toBe('00:00');
    expect(formatDuration(65_000)).toBe('01:05');
    expect(formatDuration(600_000)).toBe('10:00');
    expect(formatDuration(3_725_000)).toBe('1:02:05');
    expect(formatDuration(1_200)).toBe('00:02');
  });
});
