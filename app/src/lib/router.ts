// A tiny hash router: three screens don't need a routing library, and hash
// URLs work on any static host without rewrite rules.

import { useEffect, useState } from 'react';

export type Route =
  | { name: 'library' }
  | { name: 'edit'; id: string }
  | { name: 'run'; id: string };

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (parts[0] === 'plan' && parts[1]) {
    return parts[2] === 'run' ? { name: 'run', id: parts[1] } : { name: 'edit', id: parts[1] };
  }
  return { name: 'library' };
}

export function hrefFor(route: Route): string {
  switch (route.name) {
    case 'library':
      return '#/';
    case 'edit':
      return `#/plan/${route.id}`;
    case 'run':
      return `#/plan/${route.id}/run`;
  }
}

export function navigate(route: Route): void {
  window.location.hash = hrefFor(route);
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));
  useEffect(() => {
    const onChange = () => {
      setRoute(parseHash(window.location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
