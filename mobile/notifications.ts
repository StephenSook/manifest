// mobile/notifications.ts
// Task 2.13: Capacitor adapter for deadline alerts.
//
// No push server on either platform: @capacitor/local-notifications fires
// everything on-device. The pure scheduling logic lives in mobile/schedule.ts
// and is unit-tested; this file only talks to the plugin.
//
// iOS keeps the soonest 64 pending requests, so every sync cancels all
// pending alerts and reschedules the nearest 64. The caller runs this on
// every app open and resume, which slides the 64-alert window forward.

import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import type { MissionInput } from '../engine/types';
import { buildDeadlineAlerts, capToPendingLimit } from './schedule';

export interface SyncResult {
  permission: 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale';
  scheduled: number;
}

async function cancelAllPending(): Promise<void> {
  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length > 0) {
    await LocalNotifications.cancel({
      notifications: pending.notifications.map((n) => ({ id: n.id })),
    });
  }
}

/**
 * Recompute and reschedule every deadline alert for the saved mission.
 * Safe to call on web (returns immediately) and with no mission saved
 * (clears stale alerts, never prompts for permission).
 *
 * Permission is requested here, on the first sync that has a mission to
 * alert about: the sensible moment, not app install.
 */
export async function syncDeadlineNotifications(
  mission: MissionInput | null,
  now: Date,
): Promise<SyncResult> {
  if (!Capacitor.isNativePlatform()) {
    return { permission: 'denied', scheduled: 0 };
  }

  if (!mission) {
    // No mission: any pending alerts are stale. Clear without prompting.
    const status = await LocalNotifications.checkPermissions();
    if (status.display === 'granted') {
      await cancelAllPending();
    }
    return { permission: status.display, scheduled: 0 };
  }

  let status = await LocalNotifications.checkPermissions();
  if (
    status.display === 'prompt' ||
    status.display === 'prompt-with-rationale'
  ) {
    status = await LocalNotifications.requestPermissions();
  }
  if (status.display !== 'granted') {
    return { permission: status.display, scheduled: 0 };
  }

  // Android 12+: exact alarms are a separate user-controllable setting.
  // Inexact delivery still fires, so the result is advisory only.
  // Not implemented on iOS, hence the try/catch.
  try {
    await LocalNotifications.checkExactNotificationSetting();
  } catch {
    // iOS: method unavailable. Nothing to do.
  }

  await cancelAllPending();

  const alerts = capToPendingLimit(buildDeadlineAlerts(mission, now));
  if (alerts.length > 0) {
    await LocalNotifications.schedule({
      notifications: alerts.map((a) => ({
        id: a.id,
        title: a.title,
        body: a.body,
        schedule: { at: new Date(a.at), allowWhileIdle: true },
      })),
    });
  }

  return { permission: 'granted', scheduled: alerts.length };
}
