// The native-variant fetch bug, frame-verified on device 2026-08-29: the
// judge view rendered "FETCH FAILED: The string did not match the expected
// pattern" because fetch('/api/status') resolved against capacitor://localhost.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiBase } from '../../lib/api-base';

function withProtocol(protocol: string) {
  vi.stubGlobal('window', { location: { protocol } } as unknown as Window);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('apiBase', () => {
  it('stays relative on the web', () => {
    withProtocol('https:');
    expect(apiBase()).toBe('');
    withProtocol('http:');
    expect(apiBase()).toBe('');
  });

  it('targets the hosted API from the Capacitor WebView', () => {
    withProtocol('capacitor:');
    expect(apiBase()).toBe('https://manifest-web-roan.vercel.app');
  });

  it('targets the hosted API from any other non-http scheme', () => {
    withProtocol('file:');
    expect(apiBase()).toBe('https://manifest-web-roan.vercel.app');
  });

  it('is empty during SSR where window is absent', () => {
    expect(apiBase()).toBe('');
  });

  // Regression: the protocol-only guard shipped a broken Android build.
  // Capacitor's Android default scheme is https (CapConfig.java), so the WebView
  // origin is https://localhost and the old check treated it as the open web.
  it('targets the hosted API on ANDROID, whose Capacitor scheme is https', () => {
    vi.stubGlobal('window', {
      location: { protocol: 'https:', hostname: 'localhost' },
      Capacitor: { isNativePlatform: () => true, platform: 'android' },
    } as unknown as Window);
    expect(apiBase()).toBe('https://manifest-web-roan.vercel.app');
  });

  it('still targets the hosted API on iOS, whose scheme is capacitor:', () => {
    vi.stubGlobal('window', {
      location: { protocol: 'capacitor:', hostname: 'localhost' },
      Capacitor: { isNativePlatform: () => true, platform: 'ios' },
    } as unknown as Window);
    expect(apiBase()).toBe('https://manifest-web-roan.vercel.app');
  });

  it('stays relative on a real https site even though the scheme matches Android', () => {
    vi.stubGlobal('window', {
      location: { protocol: 'https:', hostname: 'manifest-web-roan.vercel.app' },
    } as unknown as Window);
    expect(apiBase()).toBe('');
  });
});
