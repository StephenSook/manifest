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
});
