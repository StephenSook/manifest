'use client';

// mobile/MobileShell.tsx
// Tasks 2.13 + 2.14: the native shell, mounted once in app/layout.tsx.
//
// Renders NOTHING on the web and during prerender: every surface here exists
// only when Capacitor reports a native platform, so the web app and the
// static export are byte-identical with or without this component mounted.
//
// Native surfaces (the documented Guideline 4.2 mitigations):
//   1. Bottom tab bar: native navigation surface with safe-area padding.
//   2. Offline strip: the mission plan, engine, and graph all run on-device,
//      so offline is a designed state, not an error.
//   3. Deadline alerts: local notifications resynced on every launch and
//      resume (mobile/notifications.ts), no push server.
//   4. Android hardware back: history back when possible, else minimize.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Network } from '@capacitor/network';
import type { PluginListenerHandle } from '@capacitor/core';
import { loadMission } from '../lib/store';
import { syncDeadlineNotifications } from './notifications';

const TAB_BAR_HEIGHT = '52px';

export function MobileShell() {
  const [native, setNative] = useState(false);
  const [offline, setOffline] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    setNative(true);

    const handles: PluginListenerHandle[] = [];

    // Device-local instant: this adapter layer runs only at runtime on the
    // device, never during SSR or tests (schedule.ts takes now as input).
    const sync = async () => {
      const mission = await loadMission();
      await syncDeadlineNotifications(mission, new Date());
    };
    void sync();

    // Resync when the mission is saved or cleared anywhere in the app, so
    // stale deadline alerts never outlive a plan change (lib/store.ts
    // dispatches this event after every successful write).
    const onMissionChange = () => void sync();
    window.addEventListener('manifest:mission-changed', onMissionChange);

    void App.addListener('resume', () => void sync()).then((h) =>
      handles.push(h),
    );

    // Android hardware back button. iOS ignores this listener.
    void App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
      } else {
        void App.minimizeApp();
      }
    }).then((h) => handles.push(h));

    void Network.getStatus().then((s) => setOffline(!s.connected));
    void Network.addListener('networkStatusChange', (s) =>
      setOffline(!s.connected),
    ).then((h) => handles.push(h));

    return () => {
      window.removeEventListener('manifest:mission-changed', onMissionChange);
      for (const h of handles) void h.remove();
    };
  }, []);

  if (!native) return null;

  const tabs = [
    { href: '/mission', label: 'Mission' },
    { href: '/judge', label: 'Judge view' },
  ];

  return (
    <>
      {offline && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            bottom: `calc(${TAB_BAR_HEIGHT} + env(safe-area-inset-bottom))`,
            left: 0,
            right: 0,
            zIndex: 40,
            padding: '0.4rem 1.25rem',
            fontSize: '12px',
            color: 'var(--color-muted)',
            backgroundColor: 'var(--color-surface)',
            borderTop: '1px solid var(--color-border)',
          }}
        >
          Offline. Mission data and the engine run on this device.
        </div>
      )}

      {/* Spacer so page content is never hidden behind the fixed tab bar */}
      <div
        aria-hidden="true"
        style={{
          height: `calc(${TAB_BAR_HEIGHT} + env(safe-area-inset-bottom))`,
        }}
      />

      <nav
        aria-label="App navigation"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          display: 'flex',
          height: `calc(${TAB_BAR_HEIGHT} + env(safe-area-inset-bottom))`,
          paddingBottom: 'env(safe-area-inset-bottom)',
          backgroundColor: 'var(--color-surface)',
          borderTop: '1px solid var(--color-border)',
        }}
      >
        {tabs.map((tab) => {
          const active = pathname?.startsWith(tab.href) ?? false;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? 'page' : undefined}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: active ? 600 : 400,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                textDecoration: 'none',
                color: active ? 'var(--color-fg)' : 'var(--color-muted)',
                borderTop: active
                  ? '2px solid var(--color-accent)'
                  : '2px solid transparent',
              }}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
