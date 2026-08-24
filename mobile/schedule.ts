// mobile/schedule.ts
// Task 2.13: pure deadline-alert scheduling logic.
//
// Pure on purpose: no Capacitor imports, so vitest covers it like the engine
// interlocks. The Capacitor adapter (mobile/notifications.ts) consumes the
// output. Mirrors the DeadlineBanner engine call exactly (buildGraph, then
// computeCriticalPath with projectStart = today, the mission page convention).
//
// iOS keeps only the soonest 64 pending notification requests (system limit,
// CLAUDE.md section 3), so alerts are sorted ascending and capped at 64. The
// caller reschedules on every app open, so the window slides forward.

import { buildGraph } from '../engine/graph';
import { computeCriticalPath } from '../engine/critical-path';
import type { MissionInput } from '../engine/types';

export interface DeadlineAlert {
  /** Sequential integer id, unique per sync (Android requires a Java int) */
  id: number;
  title: string;
  body: string;
  /** ISO date-time the alert fires, local 09:00 on the target day */
  at: string;
}

/** iOS keeps only the soonest 64 pending requests. */
export const IOS_PENDING_LIMIT = 64;

/** Days before each deadline that an alert fires (plus the day itself). */
const ALERT_OFFSETS_DAYS = [7, 1, 0];

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0];
}

function atNineLocal(isoDate: string): string {
  return isoDate + 'T09:00:00';
}

function offsetLabel(offset: number): string {
  if (offset === 0) return 'today';
  if (offset === 1) return 'tomorrow';
  return `in ${offset} days`;
}

/**
 * Compute every future deadline alert for a mission, sorted soonest first.
 * Ids are assigned after sorting, starting at 1. Alerts on or before `today`
 * are dropped: a reminder for a passed instant is noise.
 */
export function buildDeadlineAlerts(
  mission: MissionInput,
  today: string,
): DeadlineAlert[] {
  const { nodes, edges } = buildGraph(mission);
  const result = computeCriticalPath(
    nodes,
    edges,
    mission.deliveryDate,
    today,
    today,
  );

  const raw: Omit<DeadlineAlert, 'id'>[] = [];

  for (const node of result.nodes.values()) {
    if (!node.latestStart) continue;
    for (const offset of ALERT_OFFSETS_DAYS) {
      const fireDay = addDays(node.latestStart, -offset);
      if (fireDay <= today) continue;
      raw.push({
        title: node.label,
        body: `Latest start ${offsetLabel(offset)} (${node.latestStart}) to hold the delivery date.`,
        at: atNineLocal(fireDay),
      });
    }
  }

  for (const offset of ALERT_OFFSETS_DAYS) {
    const fireDay = addDays(mission.deliveryDate, -offset);
    if (fireDay <= today) continue;
    raw.push({
      title: 'Delivery deadline',
      body: `Delivery to the launch provider is ${offsetLabel(offset)} (${mission.deliveryDate}). All licensing milestones must be complete.`,
      at: atNineLocal(fireDay),
    });
  }

  raw.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  return raw.map((a, i) => ({ ...a, id: i + 1 }));
}

/** Keep the soonest IOS_PENDING_LIMIT alerts (input must already be sorted). */
export function capToPendingLimit(alerts: DeadlineAlert[]): DeadlineAlert[] {
  return alerts.slice(0, IOS_PENDING_LIMIT);
}
