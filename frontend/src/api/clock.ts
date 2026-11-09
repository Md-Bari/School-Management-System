/**
 * Keeps an estimate of (server clock − device clock) from the X-Server-Time response header,
 * so countdowns stay right even if the user's computer clock is wrong.
 */
let offsetMs = 0;

export function updateServerOffset(serverTimeHeader: string | null | undefined): void {
  if (!serverTimeHeader) return;
  const serverMs = Date.parse(serverTimeHeader);
  if (!Number.isNaN(serverMs)) {
    offsetMs = serverMs - Date.now();
  }
}

export function serverNow(): number {
  return Date.now() + offsetMs;
}

export function resetServerOffset(): void {
  offsetMs = 0;
}
