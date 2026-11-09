import { useCallback, useState } from 'react';
import { isValidStudentId } from '../lib/studentId';

const STORAGE_KEY = 'admission.studentId';

function readStored(): string {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY) ?? '';
    return isValidStudentId(value) ? value : '';
  } catch {
    return '';
  }
}

/**
 * The active student's birth registration number, persisted in localStorage so a refresh or
 * closing the browser keeps the parent "signed in" to their applications.
 */
export function useStudentId(): [string, (value: string) => void] {
  const [studentId, setStudentIdState] = useState(readStored);

  const setStudentId = useCallback((value: string) => {
    setStudentIdState(value);
    try {
      if (value) window.localStorage.setItem(STORAGE_KEY, value);
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Storage may be disabled (private mode); the ID still works for this session.
    }
  }, []);

  return [studentId, setStudentId];
}
