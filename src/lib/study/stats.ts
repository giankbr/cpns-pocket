/** Pure helpers for study statistics. Dates are bucketed in Asia/Jakarta. */

const TIME_ZONE = "Asia/Jakarta";

/** Default daily question target until it becomes a per-user setting. */
export const DAILY_TARGET = 20;

export function jakartaDate(input: string | Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(new Date(input));
}

function shiftDay(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Consecutive study days ending today, or yesterday if nothing yet today. */
export function studyStreak(activityDates: Iterable<string>, today = jakartaDate(new Date())): number {
  const days = new Set(activityDates);
  let cursor = days.has(today) ? today : shiftDay(today, -1);
  let streak = 0;

  while (days.has(cursor)) {
    streak += 1;
    cursor = shiftDay(cursor, -1);
  }

  return streak;
}

/** Count per day for the last `length` days, oldest first. */
export function dailySeries(dates: string[], length: number, today = jakartaDate(new Date())) {
  const counts = new Map<string, number>();
  for (const date of dates) counts.set(date, (counts.get(date) ?? 0) + 1);

  return Array.from({ length }, (_, index) => {
    const date = shiftDay(today, index - length + 1);
    return { date, count: counts.get(date) ?? 0 };
  });
}

export function greetingFor(now = new Date()): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, hour: "numeric", hour12: false }).format(now),
  );
  if (hour < 11) return "Selamat pagi";
  if (hour < 15) return "Selamat siang";
  if (hour < 19) return "Selamat sore";
  return "Selamat malam";
}

export function formatDuration(totalSeconds: number): string {
  if (totalSeconds > 0 && totalSeconds < 60) return `${Math.round(totalSeconds)} d`;
  const minutes = Math.round(totalSeconds / 60);
  if (minutes < 60) return `${minutes} m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} j ${rest} m` : `${hours} j`;
}

export function formatDateTime(input: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: TIME_ZONE,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(input));
}

export function percent(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}
