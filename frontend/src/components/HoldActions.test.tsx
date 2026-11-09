import { act, fireEvent, render, screen } from '@testing-library/react';
import { api } from '../api/client';
import { ApiError } from '../api/errors';
import { HoldActions } from './HoldActions';

const STUDENT = '20152691234567890';

describe('HoldActions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-01T04:00:00Z'));
  });

  it('shows a countdown and switches to EXPIRED with pay disabled when time runs out, without reload', () => {
    const onChanged = vi.fn();
    render(
      <HoldActions holdId="h_1" status="HELD" expiresAt="2026-11-01T04:00:03Z" studentId={STUDENT} onChanged={onChanged} />,
    );

    expect(screen.getByTestId('countdown')).toHaveTextContent('০০:০৩');
    const pay = screen.getByRole('button', { name: 'ভর্তি ফি দিন' });
    expect(pay).toBeEnabled();

    act(() => {
      vi.advanceTimersByTime(3_000);
    });

    expect(screen.getByText(/মেয়াদ শেষ/, { selector: '.badge' })).toHaveAttribute('data-status', 'EXPIRED');
    expect(screen.getByRole('button', { name: 'ভর্তি ফি দিন' })).toBeDisabled();
    expect(screen.queryByTestId('countdown')).not.toBeInTheDocument();
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it('confirms the hold and shows a success message', async () => {
    const confirm = vi.spyOn(api, 'confirmHold').mockResolvedValue({ holdId: 'h_1', status: 'CONFIRMED' });
    const onChanged = vi.fn();
    render(
      <HoldActions holdId="h_1" status="HELD" expiresAt="2026-11-01T04:10:00Z" studentId={STUDENT} onChanged={onChanged} />,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'ভর্তি ফি দিন' }));
    });

    expect(confirm).toHaveBeenCalledWith('h_1', STUDENT);
    expect(screen.getByRole('status')).toHaveTextContent('ভর্তি নিশ্চিত হয়েছে');
    expect(onChanged).toHaveBeenCalled();
  });

  it('shows a readable error when the server says the hold expired', async () => {
    vi.spyOn(api, 'confirmHold').mockRejectedValue(new ApiError(409, 'HOLD_EXPIRED', 'expired'));
    render(
      <HoldActions holdId="h_1" status="HELD" expiresAt="2026-11-01T04:10:00Z" studentId={STUDENT} onChanged={vi.fn()} />,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'ভর্তি ফি দিন' }));
    });

    expect(screen.getByRole('alert')).toHaveTextContent('মেয়াদ শেষ হয়ে গেছে');
  });

  it('disables actions for confirmed holds and for other students', () => {
    const { rerender } = render(
      <HoldActions holdId="h_1" status="CONFIRMED" expiresAt="2026-11-01T04:10:00Z" studentId={STUDENT} onChanged={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: 'ভর্তি ফি দিন' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'বাতিল' })).toBeDisabled();

    rerender(
      <HoldActions
        holdId="h_1"
        status="HELD"
        expiresAt="2026-11-01T04:10:00Z"
        ownerStudentId="11111111111111111"
        studentId={STUDENT}
        onChanged={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'ভর্তি ফি দিন' })).toBeDisabled();
    expect(screen.getByText(/অন্য জন্ম নিবন্ধন নম্বরের/)).toBeInTheDocument();
  });

  it('asks before cancelling and calls the API when confirmed', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const cancel = vi.spyOn(api, 'cancelHold').mockResolvedValue(undefined);
    render(
      <HoldActions holdId="h_1" status="HELD" expiresAt="2026-11-01T04:10:00Z" studentId={STUDENT} onChanged={vi.fn()} />,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'বাতিল' }));
    });

    expect(window.confirm).toHaveBeenCalled();
    expect(cancel).toHaveBeenCalledWith('h_1', STUDENT);
    expect(screen.getByRole('status')).toHaveTextContent('বাতিল করা হয়েছে');
  });
});
