import { useState, type FormEvent } from 'react';
import { api } from '../api/client';
import { userMessage } from '../api/errors';
import type { CreatedClass } from '../api/types';
import { Notice } from '../components/Notice';
import { digits, t, type MessageKey } from '../i18n';

export const MAX_SEATS = 10_000;
export const MAX_NAME_LENGTH = 100;

/** Field → dictionary key of the problem (translated when shown, so it follows the language). */
interface FieldErrors {
  name?: MessageKey;
  totalSeats?: MessageKey;
}

export function validateClassForm(name: string, seatsText: string): FieldErrors {
  const errors: FieldErrors = {};
  const trimmed = name.trim();
  if (!trimmed) errors.name = 'create.err.nameRequired';
  else if (trimmed.length > MAX_NAME_LENGTH) errors.name = 'create.err.nameLong';

  const seatsTrimmed = seatsText.trim();
  if (!seatsTrimmed) errors.totalSeats = 'create.err.seatsRequired';
  else if (!/^\d+$/.test(seatsTrimmed)) errors.totalSeats = 'create.err.seatsWhole';
  else {
    const n = Number(seatsTrimmed);
    if (n < 1 || n > MAX_SEATS) errors.totalSeats = 'create.err.seatsRange';
  }
  return errors;
}

/** Screen "Class তৈরি (school admin)". Each shift is created as its own class. */
export function CreateClassPage() {
  const [name, setName] = useState('');
  const [seats, setSeats] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<unknown>(null);
  const [created, setCreated] = useState<CreatedClass | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setServerError(null);
    setCreated(null);
    const found = validateClassForm(name, seats);
    setErrors(found);
    if (found.name || found.totalSeats) return;

    setSubmitting(true);
    try {
      const result = await api.createClass(name.trim(), Number(seats.trim()));
      setCreated(result);
      setName('');
      setSeats('');
    } catch (err) {
      setServerError(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section>
      <h2>{t('create.title')}</h2>
      <p className="muted">{t('create.intro')}</p>

      <form className="card form" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="class-name">{t('create.name')}</label>
          <input
            id="class-name"
            value={name}
            maxLength={MAX_NAME_LENGTH + 20}
            placeholder="Class 6 - Morning Shift"
            onChange={(e) => setName(e.target.value)}
            aria-invalid={errors.name ? true : undefined}
          />
          {errors.name && <span className="field-error">{t(errors.name, { max: digits(MAX_NAME_LENGTH) })}</span>}
        </div>

        <div className="field">
          <label htmlFor="class-seats">{t('create.seats')}</label>
          <input
            id="class-seats"
            inputMode="numeric"
            value={seats}
            placeholder="120"
            onChange={(e) => setSeats(e.target.value)}
            aria-invalid={errors.totalSeats ? true : undefined}
          />
          {errors.totalSeats && (
            <span className="field-error">{t(errors.totalSeats, { max: digits(MAX_SEATS) })}</span>
          )}
        </div>

        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? t('create.submitting') : t('create.submit')}
        </button>
      </form>

      {serverError !== null && (
        <Notice kind="error" onClose={() => setServerError(null)}>
          {userMessage(serverError)}
        </Notice>
      )}
      {created && (
        <Notice kind="success" onClose={() => setCreated(null)}>
          {t('create.done', { name: created.name, seats: digits(created.totalSeats) })}{' '}
          <a href="#/">{t('create.viewList')}</a>
        </Notice>
      )}
    </section>
  );
}
