import { fireEvent, render, screen } from '@testing-library/react';
import { StudentIdBar } from './StudentIdBar';

describe('StudentIdBar', () => {
  it('rejects a number that is not 17 digits', () => {
    const onChange = vi.fn();
    render(<StudentIdBar studentId="" onChange={onChange} />);

    fireEvent.change(screen.getByLabelText(/জন্ম নিবন্ধন নম্বর/), { target: { value: '12345' } });
    fireEvent.click(screen.getByRole('button', { name: 'ব্যবহার করুন' }));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('১৭ অঙ্কের');
  });

  it('accepts Bangla digits and saves the normalised number', () => {
    const onChange = vi.fn();
    render(<StudentIdBar studentId="" onChange={onChange} />);

    fireEvent.change(screen.getByLabelText(/জন্ম নিবন্ধন নম্বর/), { target: { value: '২০১৫২৬৯১২৩৪৫৬৭৮৯০' } });
    fireEvent.click(screen.getByRole('button', { name: 'ব্যবহার করুন' }));

    expect(onChange).toHaveBeenCalledWith('20152691234567890');
  });
});
