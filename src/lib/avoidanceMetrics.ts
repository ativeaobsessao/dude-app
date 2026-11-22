import type { AvoidanceCheckin, Habit } from '../types';
import { getLocalDateString } from './utils';

export type NormalizedAvoidanceStatus = 'success' | 'relapse' | 'pending';

export function normalizeAvoidanceStatus(status: string): NormalizedAvoidanceStatus | null {
  if (status === 'success' || status === 'resisti') return 'success';
  if (status === 'relapse' || status === 'recai') return 'relapse';
  if (status === 'pending' || status === 'depois') return 'pending';
  return null;
}

export function isTimeWindowAvoidance(habit: Habit): boolean {
  if (habit.monitor_type) return habit.monitor_type === 'janela';
  return habit.avoidance_scope === 'time_window';
}

export function getAvoidanceActiveWeekdays(habit: Habit): number[] {
  const configured = habit.monitor_weekdays;
  if (configured === 'all') return [0, 1, 2, 3, 4, 5, 6];
  if (configured) {
    const parsed = configured
      .split(',')
      .map(value => Number(value.trim()))
      .filter(value => Number.isInteger(value) && value >= 0 && value <= 6);
    return parsed.length > 0 ? Array.from(new Set(parsed)) : [0, 1, 2, 3, 4, 5, 6];
  }

  if (habit.recurrence_days && habit.recurrence_days.length > 0) {
    const parsed = habit.recurrence_days
      .map(value => value === '7' ? 0 : Number(value))
      .filter(value => Number.isInteger(value) && value >= 0 && value <= 6);
    return parsed.length > 0 ? Array.from(new Set(parsed)) : [0, 1, 2, 3, 4, 5, 6];
  }

  return [0, 1, 2, 3, 4, 5, 6];
}

function validDateKey(value?: string | null): string | null {
  if (!value) return null;
  const candidate = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(candidate) ? candidate : null;
}

function dateKeyFromCheckin(checkin: AvoidanceCheckin): string | null {
  const storedDate = validDateKey(checkin.checkin_date);
  if (storedDate) return storedDate;

  const occurredAt = checkin.occurred_at ? new Date(checkin.occurred_at) : null;
  if (occurredAt && !Number.isNaN(occurredAt.getTime())) return getLocalDateString(occurredAt);

  if (!checkin.created_at) return null;
  const createdAt = new Date(checkin.created_at);
  return Number.isNaN(createdAt.getTime()) ? null : getLocalDateString(createdAt);
}

function previousActiveDate(dateKey: string, activeWeekdays: number[]): string | null {
  const cursor = new Date(`${dateKey}T12:00:00`);
  for (let offset = 0; offset < 7; offset += 1) {
    cursor.setDate(cursor.getDate() - 1);
    if (activeWeekdays.includes(cursor.getDay())) return getLocalDateString(cursor);
  }
  return null;
}

function latestActiveDateOnOrBefore(dateKey: string, activeWeekdays: number[]): string | null {
  const cursor = new Date(`${dateKey}T12:00:00`);
  for (let offset = 0; offset < 7; offset += 1) {
    if (activeWeekdays.includes(cursor.getDay())) return getLocalDateString(cursor);
    cursor.setDate(cursor.getDate() - 1);
  }
  return null;
}

export interface AvoidanceMetrics {
  isWindow: boolean;
  unitLabel: 'dia' | 'período';
  unitPlural: 'dias' | 'períodos';
  totalLabel: 'dias com resistência' | 'períodos com resistência';
  /** Current uninterrupted sequence of confirmed resistance on scheduled days. */
  currentStreak: number;
  /** Best historical uninterrupted sequence of confirmed resistance on scheduled days. */
  bestStreak: number;
  confirmedDaysTotal: number;
  relapseDaysTotal: number;
  successCheckinsCount: number;
  relapseCheckinsCount: number;
  pendingCheckinsCount: number;
  lastCheckinDate: string | null;
  lastRelapseDate: string | null;
  hasAnyData: boolean;
  // Compatibility aliases used by older components while the screens are migrated.
  diasLimpoSeguidos: number;
  diasLimposTotal: number;
  maxStreak: number;
}

/**
 * Calculates streaks from confirmed check-ins only.
 * A scheduled day without a confirmed resistance record breaks a streak;
 * it is never silently treated as a successful day.
 * A relapse on a date takes precedence over any resistance record on that date.
 */
export function calculateAvoidanceMetrics(
  habit: Habit,
  allCheckins: AvoidanceCheckin[],
  now: Date = new Date()
): AvoidanceMetrics {
  const isWindow = isTimeWindowAvoidance(habit);
  const activeWeekdays = getAvoidanceActiveWeekdays(habit);
  const todayKey = getLocalDateString(now);
  const grouped = new Map<string, {
    success: number;
    relapse: number;
    pending: number;
    outcome: NormalizedAvoidanceStatus | null;
  }>();

  let successCheckinsCount = 0;
  let relapseCheckinsCount = 0;
  let pendingCheckinsCount = 0;

  for (const checkin of allCheckins) {
    if (checkin.habit_id !== habit.id) continue;
    const dateKey = dateKeyFromCheckin(checkin);
    const status = normalizeAvoidanceStatus(checkin.status);
    if (!dateKey || dateKey > todayKey || !status) continue;

    const current = grouped.get(dateKey) || {
      success: 0,
      relapse: 0,
      pending: 0,
      outcome: null
    };

    current[status] += 1;
    if (status === 'success') successCheckinsCount += 1;
    if (status === 'relapse') relapseCheckinsCount += 1;
    if (status === 'pending') pendingCheckinsCount += 1;

    current.outcome = current.relapse > 0
      ? 'relapse'
      : current.success > 0
        ? 'success'
        : 'pending';

    grouped.set(dateKey, current);
  }

  const activeDates = Array.from(grouped.keys())
    .filter(dateKey => activeWeekdays.includes(new Date(`${dateKey}T12:00:00`).getDay()))
    .sort();

  const confirmedDates = activeDates.filter(dateKey => grouped.get(dateKey)?.outcome === 'success');
  const relapseDates = activeDates.filter(dateKey => grouped.get(dateKey)?.outcome === 'relapse');

  // The current day is not counted until a real check-in is recorded.
  const todayIsActive = activeWeekdays.includes(now.getDay());
  const todayOutcome = grouped.get(todayKey)?.outcome || null;
  const currentAnchor = todayIsActive && !todayOutcome
    ? previousActiveDate(todayKey, activeWeekdays)
    : latestActiveDateOnOrBefore(todayKey, activeWeekdays);

  let currentStreak = 0;
  let cursor = currentAnchor;
  while (cursor) {
    const outcome = grouped.get(cursor)?.outcome || null;
    if (outcome !== 'success') break;
    currentStreak += 1;
    cursor = previousActiveDate(cursor, activeWeekdays);
  }

  let bestStreak = 0;
  let runningStreak = 0;
  let previousRecordedActiveDate: string | null = null;

  for (const dateKey of activeDates) {
    const outcome = grouped.get(dateKey)?.outcome || null;
    if (outcome === 'success') {
      const expectedPrevious = previousActiveDate(dateKey, activeWeekdays);
      runningStreak = previousRecordedActiveDate === expectedPrevious
        ? runningStreak + 1
        : 1;
      bestStreak = Math.max(bestStreak, runningStreak);
    } else {
      runningStreak = 0;
    }
    previousRecordedActiveDate = dateKey;
  }

  const lastCheckinDate = activeDates.length > 0 ? activeDates[activeDates.length - 1] : null;
  const lastRelapseDate = relapseDates.length > 0 ? relapseDates[relapseDates.length - 1] : null;
  const unitLabel = isWindow ? 'período' : 'dia';
  const unitPlural = isWindow ? 'períodos' : 'dias';

  return {
    isWindow,
    unitLabel,
    unitPlural,
    totalLabel: isWindow ? 'períodos com resistência' : 'dias com resistência',
    currentStreak,
    bestStreak,
    confirmedDaysTotal: confirmedDates.length,
    relapseDaysTotal: relapseDates.length,
    successCheckinsCount,
    relapseCheckinsCount,
    pendingCheckinsCount,
    lastCheckinDate,
    lastRelapseDate,
    hasAnyData: successCheckinsCount + relapseCheckinsCount + pendingCheckinsCount > 0,
    diasLimpoSeguidos: currentStreak,
    diasLimposTotal: confirmedDates.length,
    maxStreak: bestStreak
  };
}
