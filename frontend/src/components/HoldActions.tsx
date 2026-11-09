import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import { userMessage } from '../api/errors';
import type { HoldStatus } from '../api/types';
import { useNow } from '../hooks/useNow';
import { t, type MessageKey } from '../i18n';
import { effectiveStatus, holdLengthMs, remainingMs } from '../lib/holdStatus';
import { Countdown } from './Countdown';
import { Notice } from './Notice';
import { StatusBadge } from './StatusBadge';

interface Props {
  holdId: string;
  status: HoldStatus;
  expiresAt: string;
  /** When the hold was created; enables the countdown's progress bar. */
  createdAt?: string;
  /** Owner of the hold, if known. Buttons are disabled for anyone else. */
  ownerStudentId?: string;
  /** The student currently entered in the top bar. */
  studentId: string;
  /** Called after any change so the parent can re-fetch. */
  onChanged: () => void;
  /** Smaller timer, for lists. */
  compact?: boolean;
}

// Stored as a key or an error (not as text) so the message follows the selected language.
type Message = { kind: 'success'; key: MessageKey } | { kind: 'error'; error: unknown };

/**
 * Status + live countdown + "ভর্তি ফি দিন" / "বাতিল" buttons for one application.
 * When the countdown reaches zero the hold is shown as EXPIRED and the pay button is disabled
 * straight away, without waiting for the server or a page reload.
 */
export function HoldActions({
  holdId,
  status,
  expiresAt,
  createdAt,
  ownerStudentId,
  studentId,
  onChanged,
  compact = false,
}: Props) {
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
      setMessage({ kind: 'success', key: 'hold.paid' });
    } catch (e) {
      setMessage({ kind: 'error', error: e });
    } finally {
      setBusy(null);
      onChanged();
    }
  };

  const cancel = async () => {
    if (!window.confirm(t('hold.cancelConfirm'))) return;
    setBusy('cancel');
    setMessage(null);
    try {
      await api.cancelHold(holdId, studentId);
      setMessage({ kind: 'success', key: 'hold.cancelled' });
    } catch (e) {
      setMessage({ kind: 'error', error: e });
    } finally {
      setBusy(null);
      onChanged();
    }
  };

  return (
    <div className="hold-actions">
      <div className="hold-status-line">
        <StatusBadge status={shown} />
        {shown === 'EXPIRED' && <span className="muted">{t('hold.expiredNote')}</span>}
      </div>

      {shown === 'HELD' && (
        <Countdown
          remainingMs={remainingMs(expiresAt, now)}
          totalMs={holdLengthMs(createdAt, expiresAt)}
          compact={compact}
        />
      )}

      <div className="button-row">
        <button type="button" className="btn btn-primary btn-large" disabled={!canAct} onClick={confirm}>
          {busy === 'confirm' ? t('hold.paying') : t('hold.pay')}
        </button>
        <button type="button" className="btn btn-danger" disabled={!canAct} onClick={cancel}>
          {busy === 'cancel' ? t('hold.cancelling') : t('hold.cancel')}
        </button>
      </div>

      {shown === 'HELD' && !studentId && <p className="muted">{t('hold.needId')}</p>}
      {shown === 'HELD' && studentId && !isOwner && <p className="muted">{t('hold.notOwner')}</p>}

      {message && (
        <Notice kind={message.kind} onClose={() => setMessage(null)}>
          {message.kind === 'success' ? t(message.key) : userMessage(message.error)}
        </Notice>
      )}
    </div>
  );
}
