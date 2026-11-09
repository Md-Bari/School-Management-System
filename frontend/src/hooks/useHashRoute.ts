import { useEffect, useState } from 'react';

export type Route =
  | { name: 'classes' }
  | { name: 'my' }
  | { name: 'admin' }
  | { name: 'hold'; holdId: string };

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#/, '') || '/';
  const holdMatch = path.match(/^\/holds\/([^/]+)\/?$/);
  if (holdMatch) return { name: 'hold', holdId: decodeURIComponent(holdMatch[1]) };
  if (path === '/my') return { name: 'my' };
  if (path === '/admin') return { name: 'admin' };
  return { name: 'classes' };
}

export function routeHref(route: Route): string {
  switch (route.name) {
    case 'my':
      return '#/my';
    case 'admin':
      return '#/admin';
    case 'hold':
      return `#/holds/${encodeURIComponent(route.holdId)}`;
    default:
      return '#/';
  }
}

export function navigate(route: Route): void {
  window.location.hash = routeHref(route);
}

/** Tiny hash router: the URL survives a page refresh, no server routing needed. */
export function useHashRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
