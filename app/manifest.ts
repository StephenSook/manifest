// app/manifest.ts
// PWA web app manifest for Manifest (task 2.10).
// theme_color and background_color approximate the --color-bg token from
// app/globals.css (oklch(0.16 0.008 265) -> #212230) and the --color-accent
// token (oklch(0.62 0.16 295) -> #7b5ea7).
// Icons reference public/icon-512.png and public/apple-touch-icon.png.
// No regulatory text in this file.

import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Manifest',
    short_name: 'Manifest',
    description:
      'Regulatory critical-path planner for US university CubeSat missions.',
    start_url: '/mission',
    display: 'standalone',
    // Approximate hex values for the --color-bg and --color-accent tokens.
    // oklch values cannot be used directly in the manifest JSON; browsers
    // expect sRGB hex or rgb().
    theme_color: '#7b5ea7',
    background_color: '#212230',
    icons: [
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  };
}
