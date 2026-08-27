// @vitest-environment happy-dom

import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PluginListenerHandle } from '@capacitor/core';

const mocks = vi.hoisted(() => ({
  appAddListener: vi.fn(),
  minimizeApp: vi.fn(),
  networkAddListener: vi.fn(),
  networkGetStatus: vi.fn(),
  loadMission: vi.fn(),
  syncDeadlineNotifications: vi.fn(),
}));

vi.mock('next/link', () => ({
  default: ({ children }: { children: unknown }) => children,
}));
vi.mock('next/navigation', () => ({ usePathname: () => '/mission' }));
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => true },
}));
vi.mock('@capacitor/app', () => ({
  App: {
    addListener: mocks.appAddListener,
    minimizeApp: mocks.minimizeApp,
  },
}));
vi.mock('@capacitor/network', () => ({
  Network: {
    addListener: mocks.networkAddListener,
    getStatus: mocks.networkGetStatus,
  },
}));
vi.mock('../../lib/store', () => ({ loadMission: mocks.loadMission }));
vi.mock('../notifications', () => ({
  syncDeadlineNotifications: mocks.syncDeadlineNotifications,
}));

import { MobileShell } from '../MobileShell';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

afterEach(() => {
  vi.clearAllMocks();
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  delete document.body.dataset.manifestNative;
});

describe('MobileShell lifecycle', () => {
  it('removes listener handles that resolve after unmount', async () => {
    const resume = deferred<PluginListenerHandle>();
    const back = deferred<PluginListenerHandle>();
    const network = deferred<PluginListenerHandle>();
    const status = deferred<{ connected: boolean }>();
    const removeResume = vi.fn();
    const removeBack = vi.fn();
    const removeNetwork = vi.fn();

    mocks.appAddListener
      .mockReturnValueOnce(resume.promise)
      .mockReturnValueOnce(back.promise);
    mocks.networkAddListener.mockReturnValueOnce(network.promise);
    mocks.networkGetStatus.mockReturnValueOnce(status.promise);
    mocks.loadMission.mockResolvedValue(null);
    mocks.syncDeadlineNotifications.mockResolvedValue(undefined);

    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);

    await act(async () => root.render(createElement(MobileShell)));
    await act(async () => root.unmount());

    await act(async () => {
      resume.resolve({ remove: removeResume });
      back.resolve({ remove: removeBack });
      network.resolve({ remove: removeNetwork });
      status.resolve({ connected: false });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(removeResume).toHaveBeenCalledOnce();
    expect(removeBack).toHaveBeenCalledOnce();
    expect(removeNetwork).toHaveBeenCalledOnce();
  });
});
