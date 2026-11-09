import { useEffect, useState, type FormEvent } from 'react';
import { t } from '../i18n';
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
  // Only whether to show the error is stored; the text is computed on render so it follows
  // the selected language.
  const [showError, setShowError] = useState(false);

  useEffect(() => setDraft(studentId), [studentId]);

  const error = showError ? studentIdError(normalizeStudentId(draft)) : null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const value = normalizeStudentId(draft);
    if (studentIdError(value)) {
      setShowError(true);
      return;
    }
    setShowError(false);
    setDraft(value);
    onChange(value);
  };

  const clear = () => {
    setDraft('');
    setShowError(false);
    onChange('');
  };

  return (
    <form className="student-bar" onSubmit={submit} noValidate>
      <label htmlFor="student-id">{t('studentId.label')}</label>
      <div className="student-bar-row">
        <input
          id="student-id"
          inputMode="numeric"
          autoComplete="off"
          placeholder={t('studentId.placeholder')}
          value={draft}
          maxLength={25}
          onChange={(e) => {
            setDraft(e.target.value);
            setShowError(false);
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby="student-id-help"
        />
        <button type="submit" className="btn btn-primary">
          {t('studentId.use')}
        </button>
        {studentId && (
          <button type="button" className="btn" onClick={clear}>
            {t('studentId.clear')}
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
            {t('studentId.current')} <strong>{studentId}</strong>
          </span>
        ) : (
          <span>{t('studentId.hint')}</span>
        )}
      </div>
    </form>
  );
}
