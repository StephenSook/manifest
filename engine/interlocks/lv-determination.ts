// engine/interlocks/lv-determination.ts
// Interlock 1: 47 CFR 97.207(g) dual clock.
//
// The pre-space notification is due:
//   Clock A: within 30 days AFTER launch-vehicle determination date
//   Clock B: no later than 90 days BEFORE integration date
//
// Both clocks must be satisfied. The binding deadline is whichever fires earlier.
// Entering an LV determination date opens the window and sets both deadlines.
//
// Authority: 47 CFR 97.207(g), VERIFY paragraph path against eCFR snapshot (task 1.1)

export interface LvDeterminationDeadlines {
  /** 30 days after LV determination (Clock A). Null if lvDeterminationDate is null. */
  clockA_30DaysAfterLvDetermination: string | null;
  /** 90 days before integration (Clock B). Null if integrationDate is null. */
  clockB_90DaysBeforeIntegration: string | null;
  /**
   * The binding (earlier) deadline. Null if either clock cannot be computed.
   * This is the date by which the FCC must RECEIVE the pre-space notification.
   */
  bindingDeadline: string | null;
  /** True if today is after the binding deadline (notification is overdue). */
  isViolated: boolean;
  /** Days until (positive) or past (negative) the binding deadline from today. */
  daysUntilDeadline: number | null;
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0];
}

function diffDays(isoFrom: string, isoTo: string): number {
  const a = new Date(isoFrom + 'T00:00:00Z').getTime();
  const b = new Date(isoTo + 'T00:00:00Z').getTime();
  return Math.round((b - a) / 86_400_000);
}

function earlier(a: string, b: string): string {
  return diffDays(a, b) >= 0 ? a : b;
}

// ---------------------------------------------------------------------------
// Main computation
// ---------------------------------------------------------------------------

export function computeLvDeterminationDeadlines(
  lvDeterminationDate: string | null,
  integrationDate: string | null,
  today: string = new Date().toISOString().split('T')[0],
): LvDeterminationDeadlines {
  const clockA = lvDeterminationDate
    ? addDays(lvDeterminationDate, 30)
    : null;

  const clockB = integrationDate
    ? addDays(integrationDate, -90)
    : null;

  // Binding deadline: earliest of the two clocks
  // If either is null, the binding deadline cannot be fully determined
  const bindingDeadline =
    clockA !== null && clockB !== null
      ? earlier(clockA, clockB)
      : null;

  const isViolated =
    bindingDeadline !== null
      ? diffDays(today, bindingDeadline) < 0
      : false;

  const daysUntilDeadline =
    bindingDeadline !== null ? diffDays(today, bindingDeadline) : null;

  return {
    clockA_30DaysAfterLvDetermination: clockA,
    clockB_90DaysBeforeIntegration: clockB,
    bindingDeadline,
    isViolated,
    daysUntilDeadline,
  };
}
