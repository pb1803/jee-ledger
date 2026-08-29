// Pure analytics/calculation helpers. Kept free of React and Supabase so the
// math is easy to reason about and verify. All date strings are "YYYY-MM-DD".

// "Today" in the student's configured timezone (not the server/UTC clock).
export function todayInTZ(tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// Calendar-day arithmetic on "YYYY-MM-DD" using UTC so it is TZ-independent.
export function shiftDate(dateStr: string, deltaDays: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  return dt.toISOString().slice(0, 10);
}

// Inclusive list of the last `days` dates ending at `today` (oldest first).
export function dateRangeDays(today: string, days: number): string[] {
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i--) out.push(shiftDate(today, -i));
  return out;
}

export function accuracyPct(correct: number, attempted: number): number | null {
  if (!attempted || attempted <= 0) return null;
  return (correct / attempted) * 100;
}

export function formatMinutes(min: number): string {
  const m = Math.max(0, Math.round(min));
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h === 0) return `${rem}m`;
  if (rem === 0) return `${h}h`;
  return `${h}h ${rem}m`;
}

// A logged day is any calendar day with a daily_logs record (regardless of
// how many questions were attempted).
export function computeStreaks(
  logDates: string[],
  today: string,
): { current: number; longest: number } {
  if (!logDates.length) return { current: 0, longest: 0 };
  const set = new Set(logDates);

  const sorted = [...set].sort();
  let longest = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (shiftDate(sorted[i - 1], 1) === sorted[i]) {
      run++;
      longest = Math.max(longest, run);
    } else {
      run = 1;
    }
  }

  // Current streak is alive if today OR yesterday was logged.
  let current = 0;
  let cursor = set.has(today) ? today : shiftDate(today, -1);
  while (set.has(cursor)) {
    current++;
    cursor = shiftDate(cursor, -1);
  }
  return { current, longest };
}

export function daysLoggedInRange(
  logDates: string[],
  minDate: string,
  maxDate: string,
): number {
  const set = new Set(logDates);
  let count = 0;
  let d = maxDate;
  while (d >= minDate) {
    if (set.has(d)) count++;
    d = shiftDate(d, -1);
  }
  return count;
}

export interface DayStat {
  attempted: number;
  correct: number;
  incorrect: number;
  durationMin: number;
}

export interface DayPoint extends DayStat {
  date: string;
  accuracy: number | null;
}

// Build a per-day series (oldest first) for a range, filling missing days with
// zeros so charts show gaps instead of skipping days.
export function buildDailySeries(
  days: string[],
  logMap: Map<string, DayStat>,
): DayPoint[] {
  return days.map((date) => {
    const s = logMap.get(date) ?? {
      attempted: 0,
      correct: 0,
      incorrect: 0,
      durationMin: 0,
    };
    return { date, ...s, accuracy: accuracyPct(s.correct, s.attempted) };
  });
}

export function shortDayLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
}
