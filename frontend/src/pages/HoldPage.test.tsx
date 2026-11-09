import { act, render, screen } from '@testing-library/react';
import { api } from '../api/client';
import { ApiError } from '../api/errors';
import { HoldPage } from './HoldPage';

const STUDENT = '20152691234567890';

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe('HoldPage', () => {
  it('shows the application with class name and owner', async () => {
    vi.spyOn(api, 'getHold').mockResolvedValue({
      holdId: 'h_1',
      classId: 'c_1',
      className: 'Class 6 - Morning Shift',
      studentId: STUDENT,
      status: 'HELD',
      expiresAt: new Date(Date.now() + 300_000).toISOString(),
    });

    render(<HoldPage holdId="h_1" studentId={STUDENT} />);
    await flush();

    expect(screen.getByRole('heading', { name: 'Class 6 - Morning Shift' })).toBeInTheDocument();
    expect(screen.getByText('h_1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ভর্তি ফি দিন' })).toBeEnabled();
  });

  it('explains an unknown application id', async () => {
    vi.spyOn(api, 'getHold').mockRejectedValue(new ApiError(404, 'HOLD_NOT_FOUND', 'not found'));

    render(<HoldPage holdId="h_nope" studentId={STUDENT} />);
    await flush();

    expect(screen.getByRole('alert')).toHaveTextContent('আবেদনটি খুঁজে পাওয়া যায়নি');
    expect(screen.getByRole('link', { name: /Class তালিকায় ফিরে যান/ })).toBeInTheDocument();
  });
});
