// next.config.mobile.ts
// Task 2.12: the Capacitor build variant. Selected by next.config.ts when
// MOBILE_BUILD=1. Static export only: there is no server at runtime inside
// the Capacitor WebView (no route handlers, no middleware, no request-time
// server components).
//
// app/api is moved aside by scripts/build-mobile.sh during this build,
// because dynamic route handlers throw under output: 'export'. Dynamic data
// becomes client fetches against the hosted API (task 1.17) in later builds.
//
// trailingSlash: true exports each route as <route>/index.html, which the
// Capacitor WebView's local server resolves without a Next server.
// Never add a server.url here: a store build must ship its own assets.
import type { NextConfig } from 'next';

const mobileConfig: NextConfig = {
  reactStrictMode: true,
  output: 'export',
  images: { unoptimized: true },
  trailingSlash: true,
};

export default mobileConfig;
