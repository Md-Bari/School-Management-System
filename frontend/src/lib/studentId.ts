import { digits, t } from '../i18n';

export const STUDENT_ID_LENGTH = 17;

const BANGLA_DIGITS = '০১২৩৪৫৬৭৮৯';

/**
 * Normalises what a parent types: Bangla digits become ASCII digits, and spaces/dashes
 * (often used when copying from a birth certificate) are removed.
 */
export function normalizeStudentId(input: string): string {
  return Array.from(input)
    .map((ch) => {
      const idx = BANGLA_DIGITS.indexOf(ch);
      return idx >= 0 ? String(idx) : ch;
    })
    .join('')
    .replace(/[\s-]/g, '');
}

export function isValidStudentId(value: string): boolean {
  return /^\d{17}$/.test(value);
}

/** Returns a validation message in the current language, or null if the (normalised) value is valid. */
export function studentIdError(value: string): string | null {
  if (value.length === 0) return t('studentId.errEmpty');
  if (/\D/.test(value)) return t('studentId.errDigits');
  if (value.length !== STUDENT_ID_LENGTH) return t('studentId.errLength', { count: digits(value.length) });
  return null;
}
