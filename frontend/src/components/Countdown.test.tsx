import { render, screen } from '@testing-library/react';
import { setLang } from '../i18n';
import { Countdown } from './Countdown';

describe('Countdown', () => {
  it('shows a big timer with a progress bar of the remaining time', () => {
    const { container } = render(<Countdown remainingMs={300_000} totalMs={600_000} />);

    expect(screen.getByTestId('countdown')).toHaveTextContent('০৫:০০');
    expect(screen.getByRole('timer')).toHaveClass('timer-ok');
    expect(container.querySelector('.timer-bar-fill')).toHaveStyle({ width: '50%' });
  });

  it('turns amber under half and red in the last minute', () => {
    const { rerender } = render(<Countdown remainingMs={200_000} totalMs={600_000} />);
    expect(screen.getByRole('timer')).toHaveClass('timer-warn');

    rerender(<Countdown remainingMs={45_000} totalMs={600_000} />);
    expect(screen.getByRole('timer')).toHaveClass('timer-urgent');
    expect(screen.getByText('শেষ মিনিট! এখনই ফি দিন।')).toBeInTheDocument();
  });

  it('uses English text and digits when English is selected', () => {
    setLang('en');
    render(<Countdown remainingMs={65_000} />);

    expect(screen.getByText('Time left to pay the admission fee')).toBeInTheDocument();
    expect(screen.getByTestId('countdown')).toHaveTextContent('01:05');
  });
});
