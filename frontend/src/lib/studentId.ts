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

/** Returns a Bangla validation message, or null if the (normalised) value is valid. */
export function studentIdError(value: string): string | null {
  if (value.length === 0) return 'জন্ম নিবন্ধন নম্বর লিখুন।';
  if (/\D/.test(value)) return 'শুধু সংখ্যা (০-৯) লিখুন।';
  if (value.length !== STUDENT_ID_LENGTH) {
    return `জন্ম নিবন্ধন নম্বর ১৭ অঙ্কের হতে হবে (এখন ${toBanglaDigits(value.length)} অঙ্ক)।`;
  }
  return null;
}

export function toBanglaDigits(n: number | string): string {
  return String(n).replace(/\d/g, (d) => BANGLA_DIGITS[Number(d)]);
}
