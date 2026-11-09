import { formatDuration } from '../lib/holdStatus';
import { toBanglaDigits } from '../lib/studentId';

/** "মেয়াদ শেষ হতে বাকি: 09:41" — turns red in the last minute. */
export function Countdown({ remainingMs }: { remainingMs: number }) {
  const urgent = remainingMs <= 60_000;
  return (
    <span className={`countdown${urgent ? ' countdown-urgent' : ''}`} aria-live="off">
      মেয়াদ শেষ হতে বাকি: <strong data-testid="countdown">{toBanglaDigits(formatDuration(remainingMs))}</strong>
    </span>
  );
}
