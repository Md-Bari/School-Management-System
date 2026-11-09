import { useState } from 'react';
import { api } from '../api/client';
import { errorCode, userMessage } from '../api/errors';
import { Notice } from '../components/Notice';
import { RefreshStatus } from '../components/RefreshStatus';
import { navigate } from '../hooks/useHashRoute';
import { usePolling } from '../hooks/usePolling';

export const CLASS_POLL_MS = 3000;

/** Screen "Class তালিকা": seat counts refresh every few seconds without reloading. */
export function ClassListPage({ studentId }: { studentId: string }) {
  const { data: classes, error, loading, lastUpdated, refresh } = usePolling(api.listClasses, CLASS_POLL_MS, 'classes');
  const [applyingTo, setApplyingTo] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; showMyLink: boolean } | null>(null);

  const apply = async (classId: string) => {
    setMessage(null);
    if (!studentId) {
      setMessage({ text: 'আবেদন করতে আগে উপরের ঘরে শিক্ষার্থীর ১৭ অঙ্কের জন্ম নিবন্ধন নম্বর লিখুন।', showMyLink: false });
      document.getElementById('student-id')?.focus();
      return;
    }
    setApplyingTo(classId);
    try {
      const hold = await api.createHold(classId, studentId);
      navigate({ name: 'hold', holdId: hold.holdId });
    } catch (e) {
      const code = errorCode(e);
      setMessage({ text: userMessage(e), showMyLink: code === 'ALREADY_APPLIED' || code === 'ALREADY_CONFIRMED' });
      void refresh();
    } finally {
      setApplyingTo(null);
    }
  };

  return (
    <section>
      <h2>Class তালিকা</h2>
      <p className="muted">
        ভর্তি হয় “আগে আবেদন করলে আগে পাবে” ভিত্তিতে। আবেদন করলে seat কিছু সময়ের জন্য আপনার নামে hold থাকবে; এর মধ্যে
        ভর্তি ফি দিলে ভর্তি নিশ্চিত হবে।
      </p>

      {message && (
        <Notice kind="error" onClose={() => setMessage(null)}>
          {message.text}{' '}
          {message.showMyLink && <a href="#/my">আমার আবেদন দেখুন →</a>}
        </Notice>
      )}

      {loading && !classes && <p>লোড হচ্ছে…</p>}

      {!classes && error ? (
        <Notice kind="error">
          {userMessage(error)}{' '}
          <button type="button" className="btn btn-small" onClick={() => void refresh()}>
            আবার চেষ্টা করুন
          </button>
        </Notice>
      ) : null}

      {classes && classes.length === 0 && (
        <Notice kind="info">
          এখনও কোনো class তৈরি হয়নি। <a href="#/admin">Class তৈরি (Admin)</a> পাতা থেকে class যোগ করুন।
        </Notice>
      )}

      {classes && classes.length > 0 && (
        <div className="table-wrap">
          <table className="class-table">
            <thead>
              <tr>
                <th scope="col">Class</th>
                <th scope="col" className="num">মোট seat</th>
                <th scope="col" className="num">Hold-এ আছে</th>
                <th scope="col" className="num">নিশ্চিত</th>
                <th scope="col" className="num">খালি</th>
                <th scope="col" aria-label="আবেদন" />
              </tr>
            </thead>
            <tbody>
              {classes.map((c) => (
                <tr key={c.id}>
                  <th scope="row">{c.name}</th>
                  <td className="num" data-label="মোট seat">{c.totalSeats}</td>
                  <td className="num" data-label="Hold-এ আছে">{c.heldSeats}</td>
                  <td className="num" data-label="নিশ্চিত">{c.confirmedSeats}</td>
                  <td className={`num ${c.availableSeats === 0 ? 'seats-full' : 'seats-open'}`} data-label="খালি">
                    {c.availableSeats}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={c.availableSeats === 0 || applyingTo !== null}
                      onClick={() => void apply(c.id)}
                    >
                      {applyingTo === c.id ? 'আবেদন হচ্ছে…' : c.availableSeats === 0 ? 'seat নেই' : 'আবেদন করুন'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <RefreshStatus lastUpdated={lastUpdated} error={error} hasData={Boolean(classes)} />
    </section>
  );
}
