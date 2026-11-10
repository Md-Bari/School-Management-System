import { useCallback, useState } from 'react';
import { serverNow } from '../api/clock';
import { api } from '../api/client';
import { errorCode, userMessage } from '../api/errors';
import type { MyHold } from '../api/types';
import { HoldLimitBadge } from '../components/HoldLimitBadge';
import { Notice } from '../components/Notice';
import { RefreshStatus } from '../components/RefreshStatus';
import { navigate, routeHref } from '../hooks/useHashRoute';
import { usePolling } from '../hooks/usePolling';
import { useServerSettings } from '../hooks/useServerSettings';
import { digits, t } from '../i18n';
import { effectiveStatus } from '../lib/holdStatus';

export const CLASS_POLL_MS = 3000;

/** classId → the student's live (HELD and not expired, or CONFIRMED) application, if any. */
function activeHoldsByClass(holds: MyHold[] | undefined, nowMs: number): Map<string, MyHold> {
  const map = new Map<string, MyHold>();
  for (const h of holds ?? []) {
    const status = effectiveStatus(h.status, h.expiresAt, nowMs);
    if (status === 'HELD' || status === 'CONFIRMED') map.set(h.classId, { ...h, status });
  }
  return map;
}

// Stored as data (not text) so the message follows the selected language.
type ApplyMessage = { needId: true } | { error: unknown; showMyLink: boolean };

/** Screen "Class তালিকা": seat counts refresh every few seconds without reloading. */
export function ClassListPage({ studentId }: { studentId: string }) {
  const { data: classes, error, loading, refresh } = usePolling(api.listClasses, CLASS_POLL_MS, 'classes');
  const fetchMine = useCallback(
    () => (studentId ? api.myHolds(studentId) : Promise.resolve<MyHold[]>([])),
    [studentId],
  );
  const { data: myHolds, refresh: refreshMine } = usePolling(fetchMine, CLASS_POLL_MS, `me:${studentId}`);
  // Recomputed on every render (at least every poll), so an expiring hold drops out on time.
  const active = activeHoldsByClass(myHolds, serverNow());
  // Only when the backend runs with ONE_ADMISSION_PER_STUDENT: one admission across all classes.
  const { oneAdmissionPerStudent, holdDurationSeconds } = useServerSettings();
  const admittedHold = oneAdmissionPerStudent ? myHolds?.find((h) => h.status === 'CONFIRMED') : undefined;
  const [applyingTo, setApplyingTo] = useState<string | null>(null);
  const [message, setMessage] = useState<ApplyMessage | null>(null);

  const apply = async (classId: string) => {
    setMessage(null);
    if (!studentId) {
      setMessage({ needId: true });
      document.getElementById('student-id')?.focus();
      return;
    }
    setApplyingTo(classId);
    try {
      const hold = await api.createHold(classId, studentId);
      navigate({ name: 'hold', holdId: hold.holdId });
    } catch (e) {
      const code = errorCode(e);
      setMessage({
        error: e,
        showMyLink: code === 'ALREADY_APPLIED' || code === 'ALREADY_CONFIRMED' || code === 'ALREADY_ADMITTED',
      });
      void refresh();
      void refreshMine();
    } finally {
      setApplyingTo(null);
    }
  };

  return (
    <section>
      <h2>{t('classes.title')}</h2>
      <p className="muted">
        {t('classes.intro')}
        {oneAdmissionPerStudent && <> {t('classes.oneAdmissionNote')}</>}
      </p>

      {admittedHold && <Notice kind="success">{t('classes.admitted', { name: admittedHold.className })}</Notice>}

      {message && (
        <Notice kind="error" onClose={() => setMessage(null)}>
          {'needId' in message ? t('classes.needId') : userMessage(message.error)}{' '}
          {'showMyLink' in message && message.showMyLink && <a href="#/my">{t('common.seeMy')}</a>}
        </Notice>
      )}

      <HoldLimitBadge seconds={holdDurationSeconds} />
      <RefreshStatus error={error} hasData={Boolean(classes)} />

      {loading && !classes && <p>{t('common.loading')}</p>}

      {!classes && error ? (
        <Notice kind="error">
          {userMessage(error)}{' '}
          <button type="button" className="btn btn-small" onClick={() => void refresh()}>
            {t('common.retry')}
          </button>
        </Notice>
      ) : null}

      {classes && classes.length === 0 && (
        <Notice kind="info">
          {t('classes.empty')} <a href="#/admin">{t('classes.emptyLink')}</a>
        </Notice>
      )}

      {classes && classes.length > 0 && (
        <div className="table-wrap">
          <table className="class-table">
            <thead>
              <tr>
                <th scope="col">{t('classes.col.class')}</th>
                <th scope="col" className="num">{t('classes.col.total')}</th>
                <th scope="col" className="num">{t('classes.col.held')}</th>
                <th scope="col" className="num">{t('classes.col.confirmed')}</th>
                <th scope="col" className="num">{t('classes.col.available')}</th>
                <th scope="col" aria-label={t('classes.col.action')} />
              </tr>
            </thead>
            <tbody>
              {classes.map((c) => {
                const mine = active.get(c.id);
                return (
                  <tr key={c.id}>
                    <th scope="row">{c.name}</th>
                    <td className="num" data-label={t('classes.col.total')}>{digits(c.totalSeats)}</td>
                    <td className="num" data-label={t('classes.col.held')}>{digits(c.heldSeats)}</td>
                    <td className="num" data-label={t('classes.col.confirmed')}>{digits(c.confirmedSeats)}</td>
                    <td
                      className={`num ${c.availableSeats === 0 ? 'seats-full' : 'seats-open'}`}
                      data-label={t('classes.col.available')}
                    >
                      {digits(c.availableSeats)}
                    </td>
                    <td>
                      {mine ? (
                        <a className="existing-hold" href={routeHref({ name: 'hold', holdId: mine.holdId })}>
                          {mine.status === 'CONFIRMED' ? t('classes.existingConfirmed') : t('classes.existingHeld')} —{' '}
                          {t('classes.view')}
                        </a>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-primary"
                          disabled={c.availableSeats === 0 || applyingTo !== null || Boolean(admittedHold)}
                          onClick={() => void apply(c.id)}
                        >
                          {applyingTo === c.id
                            ? t('classes.applying')
                            : admittedHold
                              ? t('classes.admittedElsewhere')
                              : c.availableSeats === 0
                                ? t('classes.full')
                                : t('classes.apply')}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
