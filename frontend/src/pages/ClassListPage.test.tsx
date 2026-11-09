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
  it('shows seat counts and refreshes them on a timer without reloading', async () => {
    vi.useFakeTimers();
    const list = vi
      .spyOn(api, 'listClasses')
      .mockResolvedValueOnce([CLASS])
      .mockResolvedValue([{ ...CLASS, heldSeats: 16, availableSeats: 24 }]);

    render(<ClassListPage studentId={STUDENT} />);
    await flush();
    expect(screen.getByText('Class 6 - Morning Shift')).toBeInTheDocument();
    expect(screen.getByText('25')).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(CLASS_POLL_MS);
    });
    await flush();

    expect(list).toHaveBeenCalledTimes(2);
    expect(screen.getByText('24')).toBeInTheDocument();
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
