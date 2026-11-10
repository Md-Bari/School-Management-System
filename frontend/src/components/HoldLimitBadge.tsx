import { t } from '../i18n';
import { formatHoldLimit } from '../lib/holdStatus';

/** "⏱ আবেদনের পর ভর্তি ফি দেওয়ার সময়: ১০ মিনিট" — how long a held seat waits for payment. */
export function HoldLimitBadge({ seconds }: { seconds: number }) {
  return (
    <p className="limit-badge" title={t('limit.hint')}>
      <span aria-hidden="true">⏱</span>
      <span>{t('limit.label')}</span>
      <strong data-testid="hold-limit">{formatHoldLimit(seconds)}</strong>
    </p>
  );
}
