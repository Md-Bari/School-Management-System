import { useEffect, useState, type FormEvent } from 'react';
import { normalizeStudentId, studentIdError } from '../lib/studentId';

interface Props {
  studentId: string;
  onChange: (studentId: string) => void;
}

/**
 * The box at the top of every page where the parent enters the student's 17-digit birth
 * registration number. There is no login; this number is the student's identity.
 */
export function StudentIdBar({ studentId, onChange }: Props) {
  const [draft, setDraft] = useState(studentId);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setDraft(studentId), [studentId]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const value = normalizeStudentId(draft);
    const problem = studentIdError(value);
    setError(problem);
    if (!problem) {
      setDraft(value);
      onChange(value);
    }
  };

  const clear = () => {
    setDraft('');
    setError(null);
    onChange('');
  };

  return (
    <form className="student-bar" onSubmit={submit} noValidate>
      <label htmlFor="student-id">শিক্ষার্থীর জন্ম নিবন্ধন নম্বর (১৭ অঙ্ক)</label>
      <div className="student-bar-row">
        <input
          id="student-id"
          inputMode="numeric"
          autoComplete="off"
          placeholder="যেমন: 20152691234567890"
          value={draft}
          maxLength={25}
          onChange={(e) => {
            setDraft(e.target.value);
            setError(null);
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby="student-id-help"
        />
        <button type="submit" className="btn btn-primary">
          ব্যবহার করুন
        </button>
        {studentId && (
          <button type="button" className="btn" onClick={clear}>
            মুছুন
          </button>
        )}
      </div>
      <div id="student-id-help" className="student-bar-help">
        {error ? (
          <span className="field-error" role="alert">
            {error}
          </span>
        ) : studentId ? (
          <span>
            বর্তমান শিক্ষার্থী: <strong>{studentId}</strong>
          </span>
        ) : (
          <span>আবেদন করতে বা নিজের আবেদন দেখতে আগে নম্বরটি লিখুন।</span>
        )}
      </div>
    </form>
  );
}
