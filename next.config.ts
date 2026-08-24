// next.config.ts
// Web build config. MOBILE_BUILD=1 selects the Capacitor static-export
// variant from next.config.mobile.ts (task 2.12); see scripts/build-mobile.sh.
import type { NextConfig } from 'next';
import mobileConfig from './next.config.mobile';

const webConfig: NextConfig = {
  reactStrictMode: true,
};

export default process.env.MOBILE_BUILD === '1' ? mobileConfig : webConfig;
