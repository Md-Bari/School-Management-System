import { act, fireEvent, render, screen } from '@testing-library/react';
import { api } from '../api/client';
import { ApiError, NETWORK_ERROR } from '../api/errors';
import { CLASS_POLL_MS, ClassListPage } from './ClassListPage';

const STUDENT = '20152691234567890';
const CLASS = { id: 'c_1', name: 'Class 6 - Morning Shift', totalSeats: 120, heldSeats: 15, confirmedSeats: 80, availableSeats: 25 };

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe('ClassListPage', () => {
  beforeEach(() => {
    vi.spyOn(api, 'myHolds').mockResolvedValue([]);
    vi.spyOn(api, 'settings').mockResolvedValue({ holdDurationSeconds: 600, oneAdmissionPerStudent: false });
  });

  it('by default (as in the brief) an admitted student can still apply to other classes', async () => {
    const other = { ...CLASS, id: 'c_2', name: 'Class 6 - Day Shift' };
    vi.spyOn(api, 'listClasses').mockResolvedValue([CLASS, other]);
    vi.spyOn(api, 'myHolds').mockResolvedValue([
      { holdId: 'h_5', classId: 'c_1', className: CLASS.name, status: 'CONFIRMED', expiresAt: '2020-01-01T00:00:00Z' },
    ]);

    render(<ClassListPage studentId={STUDENT} />);
    await flush();

    expect(screen.getByRole('button', { name: 'আবেদন করুন' })).toBeEnabled();
    expect(screen.queryByText(/অন্য class-এ আর আবেদন করা যাবে না/)).not.toBeInTheDocument();
  });

  it('links to the existing application instead of offering to apply again', async () => {
    vi.spyOn(api, 'listClasses').mockResolvedValue([CLASS]);
    vi.spyOn(api, 'myHolds').mockResolvedValue([
      { holdId: 'h_5', classId: 'c_1', className: CLASS.name, status: 'CONFIRMED', expiresAt: '2020-01-01T00:00:00Z' },
    ]);

    render(<ClassListPage studentId={STUDENT} />);
    await flush();

    expect(screen.queryByRole('button', { name: 'আবেদন করুন' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ভর্তি নিশ্চিত/ })).toHaveAttribute('href', '#/holds/h_5');
  });

  it('with ONE_ADMISSION_PER_STUDENT on, blocks applying to other classes once admitted somewhere', async () => {
    vi.spyOn(api, 'settings').mockResolvedValue({ holdDurationSeconds: 600, oneAdmissionPerStudent: true });
    const other = { ...CLASS, id: 'c_2', name: 'Class 6 - Day Shift' };
    vi.spyOn(api, 'listClasses').mockResolvedValue([CLASS, other]);
    vi.spyOn(api, 'myHolds').mockResolvedValue([
      { holdId: 'h_5', classId: 'c_1', className: CLASS.name, status: 'CONFIRMED', expiresAt: '2020-01-01T00:00:00Z' },
    ]);

    render(<ClassListPage studentId={STUDENT} />);
    await flush();

    expect(screen.getByRole('button', { name: 'অন্য class-এ ভর্তি হয়েছে' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Class 6 - Morning Shift');
  });

  it('offers to apply again once the old hold has expired', async () => {
    vi.spyOn(api, 'listClasses').mockResolvedValue([CLASS]);
    vi.spyOn(api, 'myHolds').mockResolvedValue([
      { holdId: 'h_6', classId: 'c_1', className: CLASS.name, status: 'HELD', expiresAt: '2020-01-01T00:00:00Z' },
    ]);

    render(<ClassListPage studentId={STUDENT} />);
    await flush();

    expect(screen.getByRole('button', { name: 'আবেদন করুন' })).toBeEnabled();
  });

  it('shows seat counts and refreshes them on a timer without reloading', async () => {
    vi.useFakeTimers();
    const list = vi
      .spyOn(api, 'listClasses')
      .mockResolvedValueOnce([CLASS])
      .mockResolvedValue([{ ...CLASS, heldSeats: 16, availableSeats: 24 }]);

    render(<ClassListPage studentId={STUDENT} />);
    await flush();
    expect(screen.getByText('Class 6 - Morning Shift')).toBeInTheDocument();
    expect(screen.getByText('২৫')).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(CLASS_POLL_MS);
    });
    await flush();

    expect(list).toHaveBeenCalledTimes(2);
    expect(screen.getByText('২৪')).toBeInTheDocument();
  });

  it('explains a full class in plain language', async () => {
    vi.spyOn(api, 'listClasses').mockResolvedValue([CLASS]);
    vi.spyOn(api, 'createHold').mockRejectedValue(new ApiError(409, 'NO_SEATS', 'No seats'));

    render(<ClassListPage studentId={STUDENT} />);
    await flush();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'আবেদন করুন' }));
    });

    expect(screen.getByRole('alert')).toHaveTextContent('খালি seat নেই');
  });

  it('asks for the student ID before applying', async () => {
    vi.spyOn(api, 'listClasses').mockResolvedValue([CLASS]);
    const create = vi.spyOn(api, 'createHold');

    render(<ClassListPage studentId="" />);
    await flush();
    fireEvent.click(screen.getByRole('button', { name: 'আবেদন করুন' }));

    expect(create).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('জন্ম নিবন্ধন নম্বর');
  });

  it('shows a readable message when the server is down', async () => {
    vi.spyOn(api, 'listClasses').mockRejectedValue(new ApiError(0, NETWORK_ERROR, 'down'));

    render(<ClassListPage studentId={STUDENT} />);
    await flush();

    expect(screen.getByRole('alert')).toHaveTextContent('সার্ভারের সাথে সংযোগ করা যাচ্ছে না');
    expect(screen.getByRole('button', { name: 'আবার চেষ্টা করুন' })).toBeInTheDocument();
  });

  it('navigates to the application page after a successful hold', async () => {
    vi.spyOn(api, 'listClasses').mockResolvedValue([CLASS]);
    vi.spyOn(api, 'createHold').mockResolvedValue({
      holdId: 'h_9',
      classId: 'c_1',
      studentId: STUDENT,
      status: 'HELD',
      expiresAt: '2026-11-01T04:10:00Z',
    });

    render(<ClassListPage studentId={STUDENT} />);
    await flush();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'আবেদন করুন' }));
    });

    expect(window.location.hash).toBe('#/holds/h_9');
  });
});
