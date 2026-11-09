import { act, fireEvent, render, screen } from '@testing-library/react';
import { api } from './api/client';
import { App } from './App';

const STUDENT = '20152691234567890';

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe('App', () => {
  beforeEach(() => {
    vi.spyOn(api, 'listClasses').mockResolvedValue([]);
    vi.spyOn(api, 'myHolds').mockResolvedValue([]);
  });

  it('remembers the student ID across a reload (rule 11)', async () => {
    const { unmount } = render(<App />);
    fireEvent.change(screen.getByLabelText(/জন্ম নিবন্ধন নম্বর/), { target: { value: STUDENT } });
    fireEvent.click(screen.getByRole('button', { name: 'ব্যবহার করুন' }));
    await flush();
    unmount();

    // A fresh mount simulates refreshing the page / reopening the browser.
    render(<App />);
    await flush();

    expect(screen.getByLabelText(/জন্ম নিবন্ধন নম্বর/)).toHaveValue(STUDENT);
    expect(screen.getByText(/বর্তমান শিক্ষার্থী/)).toHaveTextContent(STUDENT);
  });

  it('switches pages through the tabs', async () => {
    render(<App />);
    await flush();
    expect(screen.getByRole('heading', { level: 2, name: 'Class তালিকা' })).toBeInTheDocument();

    await act(async () => {
      window.location.hash = '#/admin';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });

    expect(screen.getByRole('heading', { level: 2, name: /নতুন Class তৈরি/ })).toBeInTheDocument();
    expect(document.title).toContain('Class তৈরি');
  });

  it('switches the whole UI to English and back, and remembers the choice', async () => {
    render(<App />);
    await flush();

    fireEvent.click(screen.getByRole('button', { name: 'Switch to English' }));

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('School Admission — Online Application');
    expect(screen.getByRole('heading', { level: 2, name: 'Class list' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'My applications' })).toBeInTheDocument();
    expect(screen.getByLabelText(/birth registration number/)).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('en');
    expect(window.localStorage.getItem('admission.lang')).toBe('en');

    fireEvent.click(screen.getByRole('button', { name: 'বাংলায় দেখুন' }));
    expect(screen.getByRole('heading', { level: 2, name: 'Class তালিকা' })).toBeInTheDocument();
  });
});
