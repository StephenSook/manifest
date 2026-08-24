/// <reference lib="webworker" />
// sw.ts
// Serwist service worker for Manifest (task 2.10).
//
// Precaches the Next.js app shell (injected by @serwist/next at build time
// via self.__SW_MANIFEST).
//
// Runtime caching:
//   /mission and /judge load offline after a first visit using
//   NetworkFirst so updates propagate but pages load offline.
//
//   /api/** routes are EXCLUDED. API routes require a live server
//   (engine computation, NOAA fetch, watsonx calls). Caching them would
//   serve stale status data as if it were live.
//
// The engine is pure client-side TypeScript with no network calls, so the
// graph, deadline banner and deorbit panel work fully offline once the app
// shell and page chunks are in cache.
//
// defaultCache from @serwist/next/worker covers the Next.js chunk precache
// strategy (RSC, HTML, static assets).

import { Serwist, StaleWhileRevalidate, NetworkFirst, ExpirationPlugin, type PrecacheEntry } from 'serwist';
import { defaultCache } from '@serwist/next/worker';

// __SW_MANIFEST is injected by @serwist/webpack-plugin at build time.
// It is not present in any shipped type declaration, so we declare it here.
declare global {
  interface ServiceWorkerGlobalScope {
    __SW_MANIFEST: (PrecacheEntry | string)[];
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: false,
  runtimeCaching: [
    // App pages: NetworkFirst so updates propagate, fall back to cache offline.
    // Explicitly exclude /api/ so stale API responses are never served.
    {
      matcher: ({ request, url }) =>
        request.mode === 'navigate' &&
        !url.pathname.startsWith('/api/'),
      handler: new NetworkFirst({
        cacheName: 'manifest-pages',
        plugins: [
          new ExpirationPlugin({
            maxEntries: 32,
            maxAgeSeconds: 24 * 60 * 60, // 24 hours
          }),
        ],
      }),
    },

    // Static assets: StaleWhileRevalidate for fast repeat loads.
    // Content-hashed chunks are safe to serve stale; they are bust by the
    // hash when updated.
    {
      matcher: ({ url }) =>
        url.pathname.startsWith('/_next/static/') ||
        url.pathname.startsWith('/static/'),
      handler: new StaleWhileRevalidate({
        cacheName: 'manifest-static',
        plugins: [
          new ExpirationPlugin({
            maxEntries: 128,
            maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
          }),
        ],
      }),
    },

    // Spread the Next.js-recommended default cache entries last.
    ...defaultCache,
  ],
});

serwist.addEventListeners();
