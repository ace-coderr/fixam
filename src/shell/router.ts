import { useEffect, useState } from 'react';

/**
 * Hash routing. Fixam lives in an iframe, so the host page owns the real URL;
 * the hash is ours. The game can deep-link a module with `#/arrange`.
 */

function currentPath(): string {
  const hash = window.location.hash.replace(/^#/, '');
  return hash.startsWith('/') ? hash : `/${hash}`;
}

export function useHashPath(): string {
  const [path, setPath] = useState(currentPath);
  useEffect(() => {
    const update = () => setPath(currentPath());
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  return path;
}

export function navigate(path: string, { replace = false } = {}): void {
  const target = `#${path}`;
  if (replace) window.history.replaceState(null, '', target);
  else window.location.hash = path;
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}
