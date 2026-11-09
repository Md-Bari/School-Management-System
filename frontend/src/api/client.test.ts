import { api } from './client';
import { serverNow } from './clock';
import { ApiError, NETWORK_ERROR, userMessage } from './errors';

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

describe('api client', () => {
  it('sends X-Student-Id and parses the created hold', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(201, { holdId: 'h_1', classId: 'c_1', studentId: '20152691234567890', status: 'HELD', expiresAt: '2026-11-01T04:10:00Z' }),
    );

    const hold = await api.createHold('c_1', '20152691234567890');

    expect(hold.holdId).toBe('h_1');
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('http://localhost:8080/classes/c_1/holds');
    expect(init?.method).toBe('POST');
    expect((init?.headers as Record<string, string>)['X-Student-Id']).toBe('20152691234567890');
  });

  it('turns an error body into ApiError with the backend code', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(409, { error: 'NO_SEATS', message: 'No seats' }));

    const error = await api.createHold('c_1', '20152691234567890').catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(409);
    expect(error.code).toBe('NO_SEATS');
    expect(userMessage(error)).toMatch('খালি seat নেই');
  });

  it('reports an unreachable server as a network error with a readable message', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));

    const error = await api.listClasses().catch((e) => e);

    expect(error.code).toBe(NETWORK_ERROR);
    expect(userMessage(error)).toMatch('সার্ভারের সাথে সংযোগ');
  });

  it('handles 204 on cancel and non-JSON error pages', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response('<html>Bad gateway</html>', { status: 502 }));

    await expect(api.cancelHold('h_1', '20152691234567890')).resolves.toBeUndefined();
    const error = await api.listClasses().catch((e) => e);
    expect(error.status).toBe(502);
    expect(userMessage(error)).toMatch('সার্ভারে');
  });

  it('learns the server clock offset from X-Server-Time', async () => {
    const serverTime = new Date(Date.now() + 120_000).toISOString();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(200, [], { 'X-Server-Time': serverTime }));

    await api.listClasses();

    expect(serverNow() - Date.now()).toBeGreaterThan(110_000);
  });
});
