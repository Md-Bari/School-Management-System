import { userMessage } from '../api/errors';
import { t } from '../i18n';

interface Props {
  error: unknown;
  hasData: boolean;
}

/**
 * Shown only when an automatic refresh fails: the last data stays on screen with an amber
 * warning, so a server outage is never silent (rule 12). Normal refreshes are not announced.
 */
export function RefreshStatus({ error, hasData }: Props) {
  if (!error || !hasData) return null;
  return (
    <p className="live live-stale" role="status">
      <span className="live-dot" aria-hidden="true" />
      {t('refresh.stale')} {userMessage(error)}
    </p>
  );
}
