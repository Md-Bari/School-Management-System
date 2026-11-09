import { act, renderHook } from '@testing-library/react';
import { usePolling } from './usePolling';

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe('usePolling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('fetches immediately and then on every interval', async () => {
    const fetcher = vi.fn().mockResolvedValue('a');
    renderHook(() => usePolling(fetcher, 1000, 'k'));
    await flush();
    expect(fetcher).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    expect(fetcher).toHaveBeenCalledTimes(4);
  });

  it('keeps the last good data when a refresh fails', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce('good').mockRejectedValue(new Error('down'));
    const { result } = renderHook(() => usePolling(fetcher, 1000, 'k'));
    await flush();
    expect(result.current.data).toBe('good');

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    await flush();

    expect(result.current.data).toBe('good');
    expect(result.current.error).toBeInstanceOf(Error);
  });

  it('refreshes immediately when the network comes back', async () => {
    const fetcher = vi.fn().mockResolvedValue('x');
    renderHook(() => usePolling(fetcher, 60_000, 'k'));
    await flush();

    await act(async () => {
      window.dispatchEvent(new Event('online'));
    });

    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('starts over when the key changes and ignores late responses for the old key', async () => {
    let resolveOld: (v: string) => void = () => {};
    const fetcher = vi
      .fn()
      .mockImplementationOnce(() => new Promise<string>((r) => (resolveOld = r)))
      .mockResolvedValue('new');
    const { result, rerender } = renderHook(({ k }) => usePolling(fetcher, 60_000, k), { initialProps: { k: 'a' } });

    rerender({ k: 'b' });
    await flush();
    await act(async () => resolveOld('old'));

    expect(result.current.data).toBe('new');
  });
});
