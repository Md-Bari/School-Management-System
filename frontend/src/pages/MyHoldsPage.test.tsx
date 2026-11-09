import { act, render, screen } from '@testing-library/react';
import { api } from '../api/client';
import { MyHoldsPage } from './MyHoldsPage';

const STUDENT = '20152691234567890';

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe('MyHoldsPage', () => {
  it('asks for the student ID first and does not call the API', () => {
    const mine = vi.spyOn(api, 'myHolds');
    render(<MyHoldsPage studentId="" />);

    expect(screen.getByText(/জন্ম নিবন্ধন নম্বর লিখুন/)).toBeInTheDocument();
    expect(mine).not.toHaveBeenCalled();
  });

  it('lists every application with its status', async () => {
    vi.spyOn(api, 'myHolds').mockResolvedValue([
      { holdId: 'h_1', classId: 'c_1', className: 'Class 6 - Morning Shift', status: 'CONFIRMED', expiresAt: '2026-11-01T04:10:00Z' },
      { holdId: 'h_2', classId: 'c_2', className: 'Class 6 - Day Shift', status: 'CANCELLED', expiresAt: '2026-11-01T04:10:00Z' },
    ]);

    render(<MyHoldsPage studentId={STUDENT} />);
    await flush();

    expect(screen.getByText('Class 6 - Morning Shift')).toBeInTheDocument();
    expect(screen.getByText('Class 6 - Day Shift')).toBeInTheDocument();
    const badges = document.querySelectorAll('.badge');
    expect(Array.from(badges).map((b) => b.getAttribute('data-status'))).toEqual(['CONFIRMED', 'CANCELLED']);
    expect(api.myHolds).toHaveBeenCalledWith(STUDENT);
  });

  it('shows an empty state with a link to the class list', async () => {
    vi.spyOn(api, 'myHolds').mockResolvedValue([]);
    render(<MyHoldsPage studentId={STUDENT} />);
    await flush();

    expect(screen.getByRole('link', { name: /Class তালিকা থেকে আবেদন করুন/ })).toHaveAttribute('href', '#/');
  });
});
