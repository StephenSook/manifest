// lib/api-base.ts
// Where a client-side fetch('/api/...') should point.
//
// The Capacitor variant is a static export: there is no server behind its own
// origin, so a relative API path must be redirected to the hosted API.
//
// PROTOCOL ALONE IS NOT ENOUGH, and assuming it was shipped a broken Android
// build. Capacitor uses a DIFFERENT scheme per platform:
//   iOS      capacitor://localhost   -> protocol is 'capacitor:'
//   Android  https://localhost       -> protocol is 'https:'
// (Capacitor 8 default, CapConfig.java: `androidScheme = CAPACITOR_HTTPS_SCHEME`,
// and this project sets no server.androidScheme override.)
//
// So the old protocol-only guard returned '' on Android, the fetch stayed
// relative, https://localhost/api/status served the exported index.html, and the
// judge view rendered: Unexpected token '<', "<!DOCTYPE "... is not valid JSON.
// Verified on an emulator against the shipped release APK on 2026-08-31.
//
// The reliable signal is the Capacitor bridge itself, which the native runtime
// injects into the WebView. Protocol stays as a fallback so a non-http scheme is
// still redirected even if the bridge has not attached yet.
const HOSTED_API = 'https://manifest-web-roan.vercel.app';

type MaybeCapacitor = {
  Capacitor?: { isNativePlatform?: () => boolean; platform?: string };
};

export function apiBase(): string {
  if (typeof window === 'undefined') return '';

  // 1. Native WebView, either platform. This is the case the protocol check missed.
  const cap = (window as unknown as MaybeCapacitor).Capacitor;
  if (cap) {
    const native =
      typeof cap.isNativePlatform === 'function'
        ? cap.isNativePlatform()
        : cap.platform === 'ios' || cap.platform === 'android';
    if (native) return HOSTED_API;
  }

  // 2. Any non-http(s) origin has no server behind it.
  const proto = window.location.protocol;
  if (proto !== 'http:' && proto !== 'https:') return HOSTED_API;

  // 3. Real web. Stay relative so preview deploys and localhost talk to themselves.
  return '';
}
