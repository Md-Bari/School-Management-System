import { digits, t } from '../i18n';
import { formatDuration } from '../lib/holdStatus';

interface Props {
  remainingMs: number;
  /** Full hold length; when known a progress bar shows how much time is left. */
  totalMs?: number | null;
  /** Smaller version for lists. */
  compact?: boolean;
}

/**
 * Big, easy-to-read deadline: "ভর্তি ফি জমা দেওয়ার সময় বাকি 09:41".
 * Green while there is plenty of time, amber under half, red (and pulsing) in the last minute.
 */
export function Countdown({ remainingMs, totalMs, compact = false }: Props) {
  const fraction = totalMs ? Math.min(1, Math.max(0, remainingMs / totalMs)) : null;
  const level = remainingMs <= 60_000 ? 'urgent' : fraction !== null && fraction < 0.5 ? 'warn' : 'ok';

  return (
    <div className={`timer timer-${level}${compact ? ' timer-compact' : ''}`} role="timer">
      <div className="timer-label">{t('timer.label')}</div>
      <div className="timer-value" data-testid="countdown">
        {digits(formatDuration(remainingMs))}
      </div>
      {fraction !== null && (
        <div className="timer-bar" aria-hidden="true">
          <div className="timer-bar-fill" style={{ width: `${fraction * 100}%` }} />
        </div>
      )}
      {!compact && <div className="timer-hint">{level === 'urgent' ? t('timer.urgent') : t('timer.hint')}</div>}
    </div>
  );
}
