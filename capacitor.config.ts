// capacitor.config.ts
// Task 2.12: Capacitor 8 wrapper around the Next.js static export.
// webDir is the output of scripts/build-mobile.sh (next build with
// output: 'export' writes to out/).
//
// Rule (CLAUDE.md section 3): never ship server.url in a store build.
// This config intentionally has no server block.
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.stephensookra.manifest',
  appName: 'Manifest',
  webDir: 'out',
  ios: {
    contentInset: 'always',
    backgroundColor: '#111318',
  },
  plugins: {
    SystemBars: {
      style: 'DARK',
    },
  },
};

export default config;
