import { useCallback } from 'react';
import { api } from '../api/client';
import { userMessage } from '../api/errors';
import type { MyHold } from '../api/types';
import { HoldActions } from '../components/HoldActions';
import { Notice } from '../components/Notice';
import { RefreshStatus } from '../components/RefreshStatus';
import { routeHref } from '../hooks/useHashRoute';
import { usePolling } from '../hooks/usePolling';
import { formatDateTime } from '../lib/holdStatus';

export const MY_HOLDS_POLL_MS = 5000;

/** Screen "আমার আবেদন": every application of the current student, with live status. */
export function MyHoldsPage({ studentId }: { studentId: string }) {
  if (!studentId) {
    return (
      <section>
        <h2>আমার আবেদন</h2>
        <Notice kind="info">নিজের আবেদন দেখতে উপরের ঘরে শিক্ষার্থীর ১৭ অঙ্কের জন্ম নিবন্ধন নম্বর লিখুন।</Notice>
      </section>
    );
  }
  return <MyHoldsList studentId={studentId} />;
}

function MyHoldsList({ studentId }: { studentId: string }) {
  const fetchMine = useCallback(() => api.myHolds(studentId), [studentId]);
  const { data: holds, error, loading, lastUpdated, refresh } = usePolling(fetchMine, MY_HOLDS_POLL_MS, `me:${studentId}`);
  const onChanged = useCallback(() => void refresh(), [refresh]);

  return (
    <section>
      <h2>আমার আবেদন</h2>
      <p className="muted">জন্ম নিবন্ধন নম্বর: {studentId}</p>

      {loading && !holds && <p>লোড হচ্ছে…</p>}

      {!holds && error ? (
        <Notice kind="error">
          {userMessage(error)}{' '}
          <button type="button" className="btn btn-small" onClick={() => void refresh()}>
            আবার চেষ্টা করুন
          </button>
        </Notice>
      ) : null}

      {holds && holds.length === 0 && (
        <Notice kind="info">
          এই শিক্ষার্থীর এখনও কোনো আবেদন নেই। <a href="#/">Class তালিকা থেকে আবেদন করুন →</a>
        </Notice>
      )}

      {holds && holds.length > 0 && (
        <ul className="hold-list">
          {holds.map((h) => (
            <HoldItem key={h.holdId} hold={h} studentId={studentId} onChanged={onChanged} />
          ))}
        </ul>
      )}

      <RefreshStatus lastUpdated={lastUpdated} error={error} hasData={Boolean(holds)} />
    </section>
  );
}

function HoldItem({ hold, studentId, onChanged }: { hold: MyHold; studentId: string; onChanged: () => void }) {
  return (
    <li className="card hold-item">
      <div className="hold-item-head">
        <h3>{hold.className}</h3>
        <a href={routeHref({ name: 'hold', holdId: hold.holdId })}>বিস্তারিত →</a>
      </div>
      {hold.createdAt && <p className="muted small">আবেদন: {formatDateTime(hold.createdAt)}</p>}
      <HoldActions
        holdId={hold.holdId}
        status={hold.status}
        expiresAt={hold.expiresAt}
        ownerStudentId={studentId}
        studentId={studentId}
        onChanged={onChanged}
      />
    </li>
  );
}
