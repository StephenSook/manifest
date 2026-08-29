// lib/api-base.ts
// The Capacitor variant serves the static export from capacitor://localhost,
// where a relative fetch('/api/...') resolves against a scheme with no server
// and WebKit rejects it ("The string did not match the expected pattern").
// On any non-http(s) origin, client fetches go to the hosted API instead.
// On the web (http/https) the path stays relative so preview deploys and
// localhost keep talking to themselves.
const HOSTED_API = 'https://manifest-web-roan.vercel.app';

export function apiBase(): string {
  if (typeof window === 'undefined') return '';
  const proto = window.location.protocol;
  if (proto === 'http:' || proto === 'https:') return '';
  return HOSTED_API;
}
