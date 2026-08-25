// next.config.ts
// Web build config. MOBILE_BUILD=1 selects the Capacitor static-export
// variant from next.config.mobile.ts (task 2.12); see scripts/build-mobile.sh.

import type { NextConfig } from 'next';
import withSerwistInit from '@serwist/next';
import mobileConfig from './next.config.mobile';

// PWA service worker (task 2.10). Disabled in development so hot reload is
// not intercepted by the service worker.
const withSerwist = withSerwistInit({
  swSrc: 'sw.ts',
  swDest: 'public/sw.js',
  disable: process.env.NODE_ENV === 'development',
});

const webConfig: NextConfig = {
  reactStrictMode: true,
  // sql.js ships a UMD wrapper that breaks when webpack bundles it into the
  // server build ("Cannot set properties of undefined"). Load it from
  // node_modules at runtime instead. Required by app/api/ask (task 1.6).
  serverExternalPackages: ['sql.js'],
  // NFT does not follow process.cwd() joins, so the frozen corpus must be
  // named here or /api/ask 503s on Vercel (sqlite never packed). Cross-lane
  // touch on next.config.ts; coordinating with Khadim.
  outputFileTracingIncludes: {
    '/api/ask': [
      './corpus/manifest.sqlite',
      './corpus/vectors.f32',
      './corpus/schema.json',
      './node_modules/sql.js/dist/sql-wasm.wasm',
    ],
  },
};

// The mobile static-export path is deliberately not wrapped: Capacitor ships
// its own offline behavior and a service worker in a store build is a
// different lifecycle.
export default process.env.MOBILE_BUILD === '1'
  ? mobileConfig
  : withSerwist(webConfig);