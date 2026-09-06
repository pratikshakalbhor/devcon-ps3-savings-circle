/**
 * ISO 8601 week identifier, e.g. "2026-W36". Used as the durable idempotency
 * bucket for the recurring contribution: one contribution per member per week.
 */
export function isoWeekOf(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function shiftWeeks(date: Date, weeks: number): Date {
  const shifted = new Date(date);
  shifted.setUTCDate(shifted.getUTCDate() + weeks * 7);
  return shifted;
}