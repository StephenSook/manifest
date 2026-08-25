// lib/store.ts
// IndexedDB persistence for a single MissionInput.
// Uses the `idb` package (typed wrapper over the native IDB API).
//
// Single-record pattern: one store, one fixed key ('current').
// Nothing is transmitted server-side. All data stays in the browser.
//
// Callers:
//   saveMission(mission)  -- upsert
//   loadMission()         -- returns MissionInput | null, never throws
//   clearMission()        -- delete the record

import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';
import type { MissionInput } from '@/engine/types';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const DB_NAME = 'manifest';
const DB_VERSION = 1;
const STORE = 'mission' as const;
const CURRENT_KEY = 'current' as const;

interface ManifestDB extends DBSchema {
  mission: {
    key: string;
    value: MissionInput;
  };
}

// ---------------------------------------------------------------------------
// DB singleton: open once, reuse the connection
// ---------------------------------------------------------------------------

let dbPromise: Promise<IDBPDatabase<ManifestDB>> | null = null;

function getDB(): Promise<IDBPDatabase<ManifestDB>> {
  if (!dbPromise) {
    dbPromise = openDB<ManifestDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE);
        }
      },
    });
  }
  return dbPromise;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

// Fired after every successful mission write so listeners (the mobile
// shell's notification resync, task 2.13) never hold stale deadline alerts.
function emitMissionChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('manifest:mission-changed'));
  }
}

/** Persist a MissionInput. Overwrites any previously saved mission. */
export async function saveMission(mission: MissionInput): Promise<void> {
  const db = await getDB();
  await db.put(STORE, mission, CURRENT_KEY);
  emitMissionChanged();
}

/**
 * Load the saved MissionInput.
 * Returns null when no mission has been saved yet. Never throws.
 */
export async function loadMission(): Promise<MissionInput | null> {
  try {
    const db = await getDB();
    const record = await db.get(STORE, CURRENT_KEY);
    return record ?? null;
  } catch {
    // IndexedDB unavailable (private browsing with strict settings, etc.)
    return null;
  }
}

/** Delete the saved mission. */
export async function clearMission(): Promise<void> {
  const db = await getDB();
  await db.delete(STORE, CURRENT_KEY);
  emitMissionChanged();
}
