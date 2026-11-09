import { parseHash, routeHref } from './useHashRoute';

describe('hash routes', () => {
  it('parses every page', () => {
    expect(parseHash('')).toEqual({ name: 'classes' });
    expect(parseHash('#/')).toEqual({ name: 'classes' });
    expect(parseHash('#/my')).toEqual({ name: 'my' });
    expect(parseHash('#/admin')).toEqual({ name: 'admin' });
    expect(parseHash('#/holds/h_789')).toEqual({ name: 'hold', holdId: 'h_789' });
    expect(parseHash('#/unknown')).toEqual({ name: 'classes' });
  });

  it('round-trips hold routes', () => {
    const route = { name: 'hold' as const, holdId: 'h_a b' };
    expect(parseHash(routeHref(route))).toEqual(route);
  });
});
