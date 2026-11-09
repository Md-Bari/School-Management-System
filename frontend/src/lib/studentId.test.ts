import { isValidStudentId, normalizeStudentId, studentIdError, toBanglaDigits } from './studentId';

describe('studentId', () => {
  it('accepts exactly 17 ASCII digits', () => {
    expect(isValidStudentId('20152691234567890')).toBe(true);
    expect(isValidStudentId('2015269123456789')).toBe(false);
    expect(isValidStudentId('201526912345678901')).toBe(false);
    expect(isValidStudentId('2015269123456789A')).toBe(false);
  });

  it('converts Bangla digits and strips spaces and dashes', () => {
    expect(normalizeStudentId('২০১৫ ২৬৯১-২৩৪৫৬৭৮৯০')).toBe('20152691234567890');
  });

  it('explains what is wrong in Bangla', () => {
    expect(studentIdError('')).toMatch('লিখুন');
    expect(studentIdError('12ab')).toMatch('শুধু সংখ্যা');
    expect(studentIdError('12345')).toMatch('১৭ অঙ্কের');
    expect(studentIdError('20152691234567890')).toBeNull();
  });

  it('renders numbers with Bangla digits', () => {
    expect(toBanglaDigits('09:41')).toBe('০৯:৪১');
  });
});
