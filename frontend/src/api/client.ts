import { getApiBaseUrl } from '../config';
import { updateServerOffset } from './clock';
import { ApiError, NETWORK_ERROR } from './errors';
import type {
  ClassSummary,
  CreatedClass,
  HoldConfirmed,
  HoldCreated,
  HoldDetail,
  MyHold,
  ServerSettings,
} from './types';

interface RequestOptions {
  method?: 'GET' | 'POST' | 'DELETE';
  body?: unknown;
  studentId?: string;
}

async function request<T>(path: string, { method = 'GET', body, studentId }: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (studentId) headers['X-Student-Id'] = studentId;

  let response: Response;
  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    // fetch only rejects when the server could not be reached at all.
    throw new ApiError(0, NETWORK_ERROR, 'Could not reach the server');
  }

  updateServerOffset(response.headers.get('X-Server-Time'));

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const err = (data ?? {}) as { error?: string; message?: string };
    throw new ApiError(response.status, err.error ?? `HTTP_${response.status}`, err.message ?? response.statusText);
  }

  return data as T;
}

const enc = encodeURIComponent;

export const api = {
  listClasses: () => request<ClassSummary[]>('/classes'),
  getClass: (classId: string) => request<ClassSummary>(`/classes/${enc(classId)}`),
  createClass: (name: string, totalSeats: number) =>
    request<CreatedClass>('/classes', { method: 'POST', body: { name, totalSeats } }),
  createHold: (classId: string, studentId: string) =>
    request<HoldCreated>(`/classes/${enc(classId)}/holds`, { method: 'POST', studentId }),
  getHold: (holdId: string) => request<HoldDetail>(`/holds/${enc(holdId)}`),
  confirmHold: (holdId: string, studentId: string) =>
    request<HoldConfirmed>(`/holds/${enc(holdId)}/confirm`, { method: 'POST', studentId }),
  cancelHold: (holdId: string, studentId: string) =>
    request<void>(`/holds/${enc(holdId)}`, { method: 'DELETE', studentId }),
  myHolds: (studentId: string) => request<MyHold[]>('/me/holds', { studentId }),
  settings: () => request<ServerSettings>('/settings'),
};
