import { render, screen } from '@testing-library/react';
import { setLang } from '../i18n';
import { formatHoldLimit } from '../lib/holdStatus';
import { HoldLimitBadge } from './HoldLimitBadge';
import { RefreshStatus } from './RefreshStatus';
import { ApiError, NETWORK_ERROR } from '../api/errors';

describe('application time limit', () => {
  it('formats the hold duration in minutes and seconds', () => {
    expect(formatHoldLimit(600)).toBe('১০ মিনিট');
    expect(formatHoldLimit(90)).toBe('১ মিনিট ৩০ সেকেন্ড');
    expect(formatHoldLimit(45)).toBe('৪৫ সেকেন্ড');
    setLang('en');
    expect(formatHoldLimit(600)).toBe('10 min');
  });

  it('shows the limit instead of refresh timing', () => {
    render(<HoldLimitBadge seconds={600} />);
    expect(screen.getByText('আবেদনের পর ভর্তি ফি দেওয়ার সময়:')).toBeInTheDocument();
    expect(screen.getByTestId('hold-limit')).toHaveTextContent('১০ মিনিট');
  });
});

describe('RefreshStatus', () => {
  it('shows nothing while refreshing works', () => {
    const { container } = render(<RefreshStatus error={undefined} hasData />);
    expect(container).toBeEmptyDOMElement();
  });

  it('warns when refreshing fails but old data is shown', () => {
    render(<RefreshStatus error={new ApiError(0, NETWORK_ERROR, 'down')} hasData />);
    expect(screen.getByRole('status')).toHaveTextContent('হালনাগাদ করা যাচ্ছে না');
  });
});
