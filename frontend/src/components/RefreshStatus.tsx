import { userMessage } from '../api/errors';
import { digits, t } from '../i18n';

interface Props {
  lastUpdated: Date | null;
  error: unknown;
  hasData: boolean;
  /** How often the data refreshes, shown to the user. */
  intervalMs?: number;
}

/**
 * A "live" badge: pulsing green dot while data refreshes automatically, amber warning (with the
 * old data kept on screen) if refreshing fails.
 */
export function RefreshStatus({ lastUpdated, error, hasData, intervalMs }: Props) {
  if (error && hasData) {
    return (
      <p className="live live-stale" role="status">
        <span className="live-dot" aria-hidden="true" />
        {t('refresh.stale')} {userMessage(error)}
      </p>
    );
  }
  if (!lastUpdated) return null;
  return (
    <p className="live">
      <span className="live-dot" aria-hidden="true" />
      {intervalMs ? <span>{t('refresh.live', { seconds: digits(intervalMs / 1000) })}</span> : null}
      <span className="live-time">
        {t('refresh.last')} {digits(lastUpdated.toLocaleTimeString('en-GB'))}
      </span>
    </p>
  );
}
