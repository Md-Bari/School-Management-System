import { act, fireEvent, render, screen } from '@testing-library/react';
import { api } from '../api/client';
import { CreateClassPage, validateClassForm } from './CreateClassPage';

describe('validateClassForm', () => {
  it('requires a name and a whole number of seats in range', () => {
    expect(validateClassForm('', '10').name).toBeDefined();
    expect(validateClassForm('Class 6', '').totalSeats).toBeDefined();
    expect(validateClassForm('Class 6', '0').totalSeats).toBeDefined();
    expect(validateClassForm('Class 6', '12.5').totalSeats).toBeDefined();
    expect(validateClassForm('Class 6', 'abc').totalSeats).toBeDefined();
    expect(validateClassForm('Class 6', '120')).toEqual({});
  });
});

describe('CreateClassPage', () => {
  it('creates a class and confirms it to the admin', async () => {
    const create = vi
      .spyOn(api, 'createClass')
      .mockResolvedValue({ id: 'c_1', name: 'Class 6 - Morning Shift', totalSeats: 120 });
    render(<CreateClassPage />);

    fireEvent.change(screen.getByLabelText('Class-এর নাম'), { target: { value: ' Class 6 - Morning Shift ' } });
    fireEvent.change(screen.getByLabelText('মোট seat সংখ্যা'), { target: { value: '120' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Class তৈরি করুন' }));
    });

    expect(create).toHaveBeenCalledWith('Class 6 - Morning Shift', 120);
    expect(screen.getByRole('status')).toHaveTextContent('তৈরি হয়েছে');
  });

  it('does not call the API when the form is invalid', () => {
    const create = vi.spyOn(api, 'createClass');
    render(<CreateClassPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Class তৈরি করুন' }));

    expect(create).not.toHaveBeenCalled();
    expect(screen.getByText('Class-এর নাম লিখুন।')).toBeInTheDocument();
  });
});
