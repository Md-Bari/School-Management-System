import { useState, type FormEvent } from 'react';
import { api } from '../api/client';
import { userMessage } from '../api/errors';
import type { CreatedClass } from '../api/types';
import { Notice } from '../components/Notice';

export const MAX_SEATS = 10_000;
export const MAX_NAME_LENGTH = 100;

interface FieldErrors {
  name?: string;
  totalSeats?: string;
}

export function validateClassForm(name: string, seatsText: string): FieldErrors {
  const errors: FieldErrors = {};
  const trimmed = name.trim();
  if (!trimmed) errors.name = 'Class-এর নাম লিখুন।';
  else if (trimmed.length > MAX_NAME_LENGTH) errors.name = `নাম সর্বোচ্চ ${MAX_NAME_LENGTH} অক্ষরের হতে পারে।`;

  const seatsTrimmed = seatsText.trim();
  if (!seatsTrimmed) errors.totalSeats = 'Seat সংখ্যা লিখুন।';
  else if (!/^\d+$/.test(seatsTrimmed)) errors.totalSeats = 'Seat সংখ্যা একটি পূর্ণ সংখ্যা হতে হবে।';
  else {
    const n = Number(seatsTrimmed);
    if (n < 1 || n > MAX_SEATS) errors.totalSeats = `Seat সংখ্যা ১ থেকে ${MAX_SEATS} এর মধ্যে হতে হবে।`;
  }
  return errors;
}

/** Screen "Class তৈরি (school admin)". Each shift is created as its own class. */
export function CreateClassPage() {
  const [name, setName] = useState('');
  const [seats, setSeats] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
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
      setServerError(userMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section>
      <h2>নতুন Class তৈরি (School admin)</h2>
      <p className="muted">
        প্রতিটি shift আলাদা class হিসেবে তৈরি করুন, যেমন “Class 6 - Morning Shift” আর “Class 6 - Day Shift”।
      </p>

      <form className="card form" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="class-name">Class-এর নাম</label>
          <input
            id="class-name"
            value={name}
            maxLength={MAX_NAME_LENGTH + 20}
            placeholder="Class 6 - Morning Shift"
            onChange={(e) => setName(e.target.value)}
            aria-invalid={errors.name ? true : undefined}
          />
          {errors.name && <span className="field-error">{errors.name}</span>}
        </div>

        <div className="field">
          <label htmlFor="class-seats">মোট seat সংখ্যা</label>
          <input
            id="class-seats"
            inputMode="numeric"
            value={seats}
            placeholder="120"
            onChange={(e) => setSeats(e.target.value)}
            aria-invalid={errors.totalSeats ? true : undefined}
          />
          {errors.totalSeats && <span className="field-error">{errors.totalSeats}</span>}
        </div>

        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? 'তৈরি হচ্ছে…' : 'Class তৈরি করুন'}
        </button>
      </form>

      {serverError && (
        <Notice kind="error" onClose={() => setServerError(null)}>
          {serverError}
        </Notice>
      )}
      {created && (
        <Notice kind="success" onClose={() => setCreated(null)}>
          “{created.name}” ({created.totalSeats} seat) তৈরি হয়েছে। <a href="#/">Class তালিকা দেখুন →</a>
        </Notice>
      )}
    </section>
  );
}
