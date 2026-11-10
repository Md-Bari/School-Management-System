export type HoldStatus = 'HELD' | 'CONFIRMED' | 'EXPIRED' | 'CANCELLED';

export interface ClassSummary {
  id: string;
  name: string;
  totalSeats: number;
  heldSeats: number;
  confirmedSeats: number;
  availableSeats: number;
}

export interface CreatedClass {
  id: string;
  name: string;
  totalSeats: number;
}

export interface HoldCreated {
  holdId: string;
  classId: string;
  studentId: string;
  status: HoldStatus;
  expiresAt: string;
  className?: string;
  createdAt?: string;
}

export interface HoldDetail {
  holdId: string;
  classId: string;
  status: HoldStatus;
  expiresAt: string;
  className?: string;
  studentId?: string;
  confirmedAt?: string | null;
  createdAt?: string;
}

export interface HoldConfirmed {
  holdId: string;
  status: HoldStatus;
}

export interface MyHold {
  holdId: string;
  classId: string;
  className: string;
  status: HoldStatus;
  expiresAt: string;
  createdAt?: string;
  confirmedAt?: string | null;
}

/** GET /settings: how the backend is configured. */
export interface ServerSettings {
  holdDurationSeconds: number;
  oneAdmissionPerStudent: boolean;
}
