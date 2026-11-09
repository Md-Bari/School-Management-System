import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import { userMessage } from '../api/errors';
import type { HoldStatus } from '../api/types';
import { useNow } from '../hooks/useNow';
import { effectiveStatus, remainingMs } from '../lib/holdStatus';
import { Countdown } from './Countdown';
import { Notice } from './Notice';
import { StatusBadge } from './StatusBadge';

interface Props {
  holdId: string;
  status: HoldStatus;
  expiresAt: string;
  /** Owner of the hold, if known. Buttons are disabled for anyone else. */
  ownerStudentId?: string;
  /** The student currently entered in the top bar. */
  studentId: string;
  /** Called after any change so the parent can re-fetch. */
  onChanged: () => void;
}

type Message = { kind: 'success' | 'error'; text: string };

/**
 * Status + live countdown + "ভর্তি ফি দিন" / "বাতিল" buttons for one application.
 * When the countdown reaches zero the hold is shown as EXPIRED and the pay button is disabled
 * straight away, without waiting for the server or a page reload.
 */
export function HoldActions({ holdId, status, expiresAt, ownerStudentId, studentId, onChanged }: Props) {
  const now = useNow(1000);
  const [busy, setBusy] = useState<'confirm' | 'cancel' | null>(null);
  const [message, setMessage] = useState<Message | null>(null);

  const shown = effectiveStatus(status, expiresAt, now);
  const isOwner = !ownerStudentId || ownerStudentId === studentId;
  const canAct = shown === 'HELD' && Boolean(studentId) && isOwner && busy === null;

  // Ask the parent to re-fetch once when the hold expires locally, to sync with the server.
  const notifiedExpiry = useRef(false);
  useEffect(() => {
    if (status === 'HELD' && shown === 'EXPIRED' && !notifiedExpiry.current) {
      notifiedExpiry.current = true;
      onChanged();
    }
    if (status !== 'HELD') notifiedExpiry.current = false;
  }, [status, shown, onChanged]);

  const confirm = async () => {
    setBusy('confirm');
    setMessage(null);
    try {
      await api.confirmHold(holdId, studentId);
      setMessage({ kind: 'success', text: 'ভর্তি ফি গ্রহণ করা হয়েছে। ভর্তি নিশ্চিত হয়েছে!' });
    } catch (e) {
      setMessage({ kind: 'error', text: userMessage(e) });
    } finally {
      setBusy(null);
      onChanged();
    }
  };

  const cancel = async () => {
    if (!window.confirm('আপনি কি নিশ্চিত যে আবেদনটি বাতিল করতে চান? seat অন্যদের জন্য খুলে যাবে।')) return;
    setBusy('cancel');
    setMessage(null);
    try {
      await api.cancelHold(holdId, studentId);
      setMessage({ kind: 'success', text: 'আবেদন বাতিল করা হয়েছে।' });
    } catch (e) {
      setMessage({ kind: 'error', text: userMessage(e) });
    } finally {
      setBusy(null);
      onChanged();
    }
  };

  return (
    <div className="hold-actions">
      <div className="hold-status-line">
        <StatusBadge status={shown} />
        {shown === 'HELD' && <Countdown remainingMs={remainingMs(expiresAt, now)} />}
        {shown === 'EXPIRED' && (
          <span className="muted">সময়ের মধ্যে ফি জমা না হওয়ায় seat ছেড়ে দেওয়া হয়েছে।</span>
        )}
      </div>

      <div className="button-row">
        <button type="button" className="btn btn-primary" disabled={!canAct} onClick={confirm}>
          {busy === 'confirm' ? 'প্রক্রিয়াধীন…' : 'ভর্তি ফি দিন'}
        </button>
        <button type="button" className="btn btn-danger" disabled={!canAct} onClick={cancel}>
          {busy === 'cancel' ? 'বাতিল হচ্ছে…' : 'বাতিল'}
        </button>
      </div>

      {shown === 'HELD' && !studentId && (
        <p className="muted">ফি দিতে বা বাতিল করতে উপরে শিক্ষার্থীর জন্ম নিবন্ধন নম্বর লিখুন।</p>
      )}
      {shown === 'HELD' && studentId && !isOwner && (
        <p className="muted">এই আবেদনটি অন্য জন্ম নিবন্ধন নম্বরের, তাই এখান থেকে ফি দেওয়া বা বাতিল করা যাবে না।</p>
      )}

      {message && (
        <Notice kind={message.kind} onClose={() => setMessage(null)}>
          {message.text}
        </Notice>
      )}
    </div>
  );
}
