import { describe, expect, it } from 'vitest';
import config from '../../capacitor.config';

describe('Capacitor native viewport', () => {
  it('asks iOS to keep web content inside the system safe area', () => {
    expect(config.ios?.contentInset).toBe('always');
    expect(config.ios?.backgroundColor).toBe('#111318');
    expect(config.plugins?.SystemBars?.style).toBe('DARK');
  });
});
