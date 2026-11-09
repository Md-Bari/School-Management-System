import { useCallback } from 'react';
import { api } from '../api/client';
import { errorCode, userMessage } from '../api/errors';
import { HoldActions } from '../components/HoldActions';
import { Notice } from '../components/Notice';
import { RefreshStatus } from '../components/RefreshStatus';
import { usePolling } from '../hooks/usePolling';
import { formatDateTime } from '../lib/holdStatus';

export const HOLD_POLL_MS = 5000;

/** Screen "আবেদন": one application's status, remaining time, pay and cancel buttons. */
export function HoldPage({ holdId, studentId }: { holdId: string; studentId: string }) {
  const fetchHold = useCallback(() => api.getHold(holdId), [holdId]);
  const { data: hold, error, loading, lastUpdated, refresh } = usePolling(fetchHold, HOLD_POLL_MS, `hold:${holdId}`);
  const onChanged = useCallback(() => void refresh(), [refresh]);

  if (loading && !hold) return <p>লোড হচ্ছে…</p>;

  if (!hold) {
    return (
      <section>
        <h2>আবেদন</h2>
        <Notice kind="error">
          {userMessage(error)}{' '}
          {errorCode(error) === 'HOLD_NOT_FOUND' ? (
            <a href="#/">Class তালিকায় ফিরে যান</a>
          ) : (
            <button type="button" className="btn btn-small" onClick={() => void refresh()}>
              আবার চেষ্টা করুন
            </button>
          )}
        </Notice>
      </section>
    );
  }

  return (
    <section>
      <h2>আবেদন</h2>
      <div className="card">
        <h3>{hold.className ?? hold.classId}</h3>
        <dl className="details">
          <dt>আবেদন নম্বর</dt>
          <dd>{hold.holdId}</dd>
          {hold.studentId && (
            <>
              <dt>জন্ম নিবন্ধন নম্বর</dt>
              <dd>{hold.studentId}</dd>
            </>
          )}
          <dt>মেয়াদ শেষ হবে</dt>
          <dd>{formatDateTime(hold.expiresAt)}</dd>
          {hold.confirmedAt && (
            <>
              <dt>ভর্তি নিশ্চিত হয়েছে</dt>
              <dd>{formatDateTime(hold.confirmedAt)}</dd>
            </>
          )}
        </dl>

        <HoldActions
          holdId={hold.holdId}
          status={hold.status}
          expiresAt={hold.expiresAt}
          ownerStudentId={hold.studentId}
          studentId={studentId}
          onChanged={onChanged}
        />
        <p className="muted small">“ভর্তি ফি দিন” চাপলে ধরে নেওয়া হবে payment সফল হয়েছে (ডেমো)।</p>
      </div>

      <RefreshStatus lastUpdated={lastUpdated} error={error} hasData />
      <p>
        <a href="#/my">← আমার সব আবেদন</a>
      </p>
    </section>
  );
}
