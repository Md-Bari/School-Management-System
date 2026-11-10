import { useCallback } from 'react';
import { api } from '../api/client';
import { errorCode, userMessage } from '../api/errors';
import { HoldActions } from '../components/HoldActions';
import { Notice } from '../components/Notice';
import { RefreshStatus } from '../components/RefreshStatus';
import { usePolling } from '../hooks/usePolling';
import { t } from '../i18n';
import { formatDateTime } from '../lib/holdStatus';

export const HOLD_POLL_MS = 5000;

/** Screen "আবেদন": one application's status, remaining time, pay and cancel buttons. */
export function HoldPage({ holdId, studentId }: { holdId: string; studentId: string }) {
  const fetchHold = useCallback(() => api.getHold(holdId), [holdId]);
  const { data: hold, error, loading, refresh } = usePolling(fetchHold, HOLD_POLL_MS, `hold:${holdId}`);
  const onChanged = useCallback(() => void refresh(), [refresh]);

  if (loading && !hold) return <p>{t('common.loading')}</p>;

  if (!hold) {
    return (
      <section>
        <h2>{t('holdPage.title')}</h2>
        <Notice kind="error">
          {userMessage(error)}{' '}
          {errorCode(error) === 'HOLD_NOT_FOUND' ? (
            <a href="#/">{t('holdPage.backToList')}</a>
          ) : (
            <button type="button" className="btn btn-small" onClick={() => void refresh()}>
              {t('common.retry')}
            </button>
          )}
        </Notice>
      </section>
    );
  }

  return (
    <section>
      <h2>{t('holdPage.title')}</h2>
      <div className="card">
        <h3>{hold.className ?? hold.classId}</h3>
        <dl className="details">
          <dt>{t('holdPage.id')}</dt>
          <dd>{hold.holdId}</dd>
          {hold.studentId && (
            <>
              <dt>{t('holdPage.student')}</dt>
              <dd>{hold.studentId}</dd>
            </>
          )}
          <dt>{t('holdPage.expiresAt')}</dt>
          <dd>{formatDateTime(hold.expiresAt)}</dd>
          {hold.confirmedAt && (
            <>
              <dt>{t('holdPage.confirmedAt')}</dt>
              <dd>{formatDateTime(hold.confirmedAt)}</dd>
            </>
          )}
        </dl>

        <HoldActions
          holdId={hold.holdId}
          status={hold.status}
          expiresAt={hold.expiresAt}
          createdAt={hold.createdAt}
          ownerStudentId={hold.studentId}
          studentId={studentId}
          onChanged={onChanged}
        />
        <p className="muted small">{t('holdPage.demoNote')}</p>
      </div>

      <RefreshStatus error={error} hasData />
      <p>
        <a href="#/my">{t('holdPage.allMine')}</a>
      </p>
    </section>
  );
}
