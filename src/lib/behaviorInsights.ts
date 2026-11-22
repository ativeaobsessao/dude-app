import type {
  Activity,
  AvoidanceCheckin,
  DailyTask,
  FocusSession,
  Habit,
  HabitCompletion,
  Project,
  ScheduledActivity
} from '../types';
import { getLocalDateString } from './utils';
import { normalizeAvoidanceStatus } from './avoidanceMetrics';

export type InsightPeriod = 7 | 30 | 90;

export interface DateRange {
  startKey: string;
  endKey: string;
  days: number;
}

export interface DistributionItem {
  name: string;
  minutes: number;
  share: number;
  count: number;
}

export interface HabitAdherenceItem {
  id: string;
  name: string;
  expected: number;
  completed: number;
  rate: number;
  remaining: number;
}

export interface PersonalInsightsResult {
  range: DateRange;
  totalMinutes: number;
  completedSessions: number;
  activeDays: number;
  projectCount: number;
  projectDistribution: DistributionItem[];
  activityDistribution: DistributionItem[];
  habitAdherence: HabitAdherenceItem[];
  habitsTracked: number;
  habitCompletionRate: number | null;
  tasksTotal: number;
  tasksCompleted: number;
  taskCompletionRate: number | null;
  scheduledTotal: number;
  scheduledCompleted: number;
  scheduledCompletionRate: number | null;
  strongestWeekday: string | null;
  strongestPeriod: string | null;
  patternSampleSessions: number;
  patternSampleDays: number;
  mostUnderperformedHabit: HabitAdherenceItem | null;
}

export interface AvoidancePatternItem {
  label: string;
  count: number;
  share: number;
}

export interface AvoidanceInsightsResult {
  range: DateRange;
  totalEvents: number;
  conclusiveEvents: number;
  resistanceEvents: number;
  relapseEvents: number;
  pendingEvents: number;
  resistanceRate: number | null;
  relapseRate: number | null;
  resistanceDays: number;
  relapseDays: number;
  noteCount: number;
  averageUrgeIntensity: number | null;
  topRelapseTrigger: AvoidancePatternItem | null;
  triggerDistribution: AvoidancePatternItem[];
  emotionDistribution: AvoidancePatternItem[];
  environmentDistribution: AvoidancePatternItem[];
  precedingActivityDistribution: AvoidancePatternItem[];
  strongestRelapsePeriod: string | null;
  strongestRelapseWeekday: string | null;
  patternSample: number;
  hasEnoughPatternData: boolean;
  recentEvents: AvoidanceCheckin[];
  previousRelapseRate: number | null;
  relapseRateChange: number | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAY_LABELS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const PERIOD_LABELS = ['Madrugada', 'Manhã', 'Tarde', 'Noite'];

export function createDateRange(days: InsightPeriod, now = new Date()): DateRange {
  const end = new Date(now);
  end.setHours(12, 0, 0, 0);
  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));
  return {
    startKey: getLocalDateString(start),
    endKey: getLocalDateString(end),
    days
  };
}

function dateKeyFromValue(value?: string | null): string {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : getLocalDateString(parsed);
}

function inRange(dateKey: string, range: DateRange): boolean {
  return !!dateKey && dateKey >= range.startKey && dateKey <= range.endKey;
}

function sessionMinutes(session: FocusSession): number {
  if (!session.completed) return 0;
  const value = Number(session.actual_duration_minutes ?? session.duration_minutes ?? 0);
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function periodFromHour(hour: number): string {
  if (hour < 5) return PERIOD_LABELS[0];
  if (hour < 12) return PERIOD_LABELS[1];
  if (hour < 18) return PERIOD_LABELS[2];
  return PERIOD_LABELS[3];
}

function normalizeWeekday(value: string): number | null {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return null;
  if (parsed === 7) return 0;
  return parsed >= 0 && parsed <= 6 ? parsed : null;
}

function expectedHabitOccurrences(habit: Habit, range: DateRange): number {
  if (habit.is_recurring && habit.recurrence_days?.length) {
    const weekdays = new Set(habit.recurrence_days.map(normalizeWeekday).filter((day): day is number => day !== null));
    if (weekdays.size === 0) return 0;
    let expected = 0;
    const cursor = new Date(`${range.startKey}T12:00:00`);
    const end = new Date(`${range.endKey}T12:00:00`);
    while (cursor <= end) {
      if (weekdays.has(cursor.getDay())) expected += 1;
      cursor.setDate(cursor.getDate() + 1);
    }
    return expected;
  }

  const weeklyTarget = Math.max(0, Number(habit.sessions_per_week) || 0);
  return Math.round((weeklyTarget * range.days / 7) * 10) / 10;
}

function makeDistribution(map: Map<string, { minutes: number; count: number }>, totalMinutes: number): DistributionItem[] {
  return [...map.entries()]
    .map(([name, value]) => ({
      name,
      minutes: value.minutes,
      count: value.count,
      share: totalMinutes > 0 ? Math.round((value.minutes / totalMinutes) * 100) : 0
    }))
    .sort((a, b) => b.minutes - a.minutes);
}

export function analyzePersonalInsights(input: {
  sessions: FocusSession[];
  projects: Project[];
  activities: Activity[];
  habits: Habit[];
  habitCompletions: HabitCompletion[];
  dailyTasks: DailyTask[];
  scheduledActivities: ScheduledActivity[];
  days: InsightPeriod;
  now?: Date;
}): PersonalInsightsResult {
  const now = input.now || new Date();
  const range = createDateRange(input.days, now);
  const sessions = input.sessions.filter(session =>
    session.completed && inRange(dateKeyFromValue(session.started_at), range) && sessionMinutes(session) > 0
  );

  const projectById = new Map(input.projects.map(project => [project.id, project]));
  const activityById = new Map(input.activities.map(activity => [activity.id, activity]));
  const minutesByProject = new Map<string, { minutes: number; count: number }>();
  const minutesByActivity = new Map<string, { minutes: number; count: number }>();
  const minutesByWeekday = new Map<number, number>();
  const minutesByPeriod = new Map<string, number>();
  const activeDateSet = new Set<string>();
  let totalMinutes = 0;

  sessions.forEach(session => {
    const minutes = sessionMinutes(session);
    const dateKey = dateKeyFromValue(session.started_at);
    const startedAt = new Date(session.started_at);
    totalMinutes += minutes;
    activeDateSet.add(dateKey);

    const project = session.project_id ? projectById.get(session.project_id) : undefined;
    const projectName = session.project_id ? (project?.name || 'Projeto não encontrado') : 'Sem projeto vinculado';
    const projectEntry = minutesByProject.get(projectName) || { minutes: 0, count: 0 };
    projectEntry.minutes += minutes;
    projectEntry.count += 1;
    minutesByProject.set(projectName, projectEntry);

    const linkedActivity = session.activity_id ? activityById.get(session.activity_id) : undefined;
    const activityName = session.activity_name?.trim() || linkedActivity?.name || 'Atividade sem nome';
    const activityEntry = minutesByActivity.get(activityName) || { minutes: 0, count: 0 };
    activityEntry.minutes += minutes;
    activityEntry.count += 1;
    minutesByActivity.set(activityName, activityEntry);

    const weekday = startedAt.getDay();
    minutesByWeekday.set(weekday, (minutesByWeekday.get(weekday) || 0) + minutes);
    const period = periodFromHour(startedAt.getHours());
    minutesByPeriod.set(period, (minutesByPeriod.get(period) || 0) + minutes);
  });

  const completionsByHabit = new Map<string, number>();
  input.habitCompletions.forEach(completion => {
    if (!inRange(dateKeyFromValue(completion.completed_at), range)) return;
    completionsByHabit.set(completion.habit_id, (completionsByHabit.get(completion.habit_id) || 0) + 1);
  });

  const habitAdherence = input.habits
    .filter(habit => habit.habit_mode !== 'avoid')
    .map(habit => {
      const expected = expectedHabitOccurrences(habit, range);
      const completed = completionsByHabit.get(habit.id) || 0;
      const rate = expected > 0 ? Math.min(100, Math.round((completed / expected) * 100)) : 0;
      return {
        id: habit.id,
        name: habit.name,
        expected,
        completed,
        rate,
        remaining: Math.max(0, Math.ceil(expected - completed))
      };
    })
    .sort((a, b) => a.rate - b.rate || b.remaining - a.remaining);

  const habitsWithTargets = habitAdherence.filter(habit => habit.expected > 0);
  const expectedTotal = habitsWithTargets.reduce((sum, habit) => sum + habit.expected, 0);
  const completedTotal = habitsWithTargets.reduce((sum, habit) => sum + habit.completed, 0);

  const dailyTasks = input.dailyTasks.filter(task => inRange(dateKeyFromValue(task.task_date), range));
  const scheduled = input.scheduledActivities.filter(activity =>
    inRange(dateKeyFromValue(activity.scheduled_date), range) &&
    !['cancelled', 'cancelada', 'expirada'].includes(String(activity.status).toLowerCase())
  );
  const scheduledCompleted = scheduled.filter(activity =>
    ['completed', 'concluida'].includes(String(activity.status).toLowerCase())
  ).length;

  const strongestWeekdayEntry = [...minutesByWeekday.entries()].sort((a, b) => b[1] - a[1])[0];
  const strongestPeriodEntry = [...minutesByPeriod.entries()].sort((a, b) => b[1] - a[1])[0];
  const patternSampleSessions = sessions.length;
  const patternSampleDays = activeDateSet.size;
  const enoughPatternData = patternSampleSessions >= 5 && patternSampleDays >= 3;

  return {
    range,
    totalMinutes,
    completedSessions: sessions.length,
    activeDays: activeDateSet.size,
    projectCount: new Set(sessions.map(session => session.project_id).filter(Boolean)).size,
    projectDistribution: makeDistribution(minutesByProject, totalMinutes).slice(0, 6),
    activityDistribution: makeDistribution(minutesByActivity, totalMinutes).slice(0, 6),
    habitAdherence,
    habitsTracked: habitsWithTargets.length,
    habitCompletionRate: expectedTotal > 0 ? Math.min(100, Math.round((completedTotal / expectedTotal) * 100)) : null,
    tasksTotal: dailyTasks.length,
    tasksCompleted: dailyTasks.filter(task => task.is_completed).length,
    taskCompletionRate: dailyTasks.length > 0 ? Math.round((dailyTasks.filter(task => task.is_completed).length / dailyTasks.length) * 100) : null,
    scheduledTotal: scheduled.length,
    scheduledCompleted,
    scheduledCompletionRate: scheduled.length > 0 ? Math.round((scheduledCompleted / scheduled.length) * 100) : null,
    strongestWeekday: enoughPatternData && strongestWeekdayEntry ? WEEKDAY_LABELS[strongestWeekdayEntry[0]] : null,
    strongestPeriod: enoughPatternData && strongestPeriodEntry ? strongestPeriodEntry[0] : null,
    patternSampleSessions,
    patternSampleDays,
    mostUnderperformedHabit: habitsWithTargets.find(habit => habit.rate < 70 && habit.remaining > 0) || null
  };
}

function patternDistribution(values: Array<string | null | undefined>): AvoidancePatternItem[] {
  const counts = new Map<string, number>();
  values.forEach(value => {
    const label = value?.trim();
    if (!label || label === 'none') return;
    counts.set(label, (counts.get(label) || 0) + 1);
  });
  const total = [...counts.values()].reduce((sum, value) => sum + value, 0);
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count, share: total > 0 ? Math.round((count / total) * 100) : 0 }))
    .sort((a, b) => b.count - a.count);
}

function countRelapses(checkins: AvoidanceCheckin[], range: DateRange): { relapse: number; conclusive: number } {
  const filtered = checkins.filter(checkin => {
    const status = normalizeAvoidanceStatus(checkin.status);
    return inRange(dateKeyFromValue(checkin.occurred_at) || dateKeyFromValue(checkin.checkin_date) || dateKeyFromValue(checkin.created_at), range) &&
      (status === 'success' || status === 'relapse');
  });
  const relapse = filtered.filter(checkin => normalizeAvoidanceStatus(checkin.status) === 'relapse').length;
  return { relapse, conclusive: filtered.length };
}

export function analyzeAvoidancePatterns(input: {
  checkins: AvoidanceCheckin[];
  selectedHabitId: string;
  days: InsightPeriod;
  now?: Date;
}): AvoidanceInsightsResult {
  const now = input.now || new Date();
  const range = createDateRange(input.days, now);
  const habitCheckins = input.checkins.filter(checkin =>
    input.selectedHabitId === 'all' || checkin.habit_id === input.selectedHabitId
  );
  const recentEvents = habitCheckins
    .filter(checkin => inRange(dateKeyFromValue(checkin.occurred_at) || dateKeyFromValue(checkin.checkin_date) || dateKeyFromValue(checkin.created_at), range))
    .sort((a, b) => new Date(b.occurred_at || b.created_at).getTime() - new Date(a.occurred_at || a.created_at).getTime());

  const resistanceEvents = recentEvents.filter(checkin => normalizeAvoidanceStatus(checkin.status) === 'success');
  const relapseEvents = recentEvents.filter(checkin => normalizeAvoidanceStatus(checkin.status) === 'relapse');
  const pendingEvents = recentEvents.filter(checkin => normalizeAvoidanceStatus(checkin.status) === 'pending');
  const conclusiveEvents = resistanceEvents.length + relapseEvents.length;
  const outcomeByDay = new Map<string, 'success' | 'relapse'>();
  recentEvents.forEach(checkin => {
    const status = normalizeAvoidanceStatus(checkin.status);
    const dateKey = dateKeyFromValue(checkin.occurred_at) || dateKeyFromValue(checkin.checkin_date) || dateKeyFromValue(checkin.created_at);
    if (!dateKey || (status !== 'success' && status !== 'relapse')) return;
    if (status === 'relapse' || !outcomeByDay.has(dateKey)) outcomeByDay.set(dateKey, status);
  });
  const relapseDays = [...outcomeByDay.values()].filter(status => status === 'relapse').length;
  const resistanceDays = [...outcomeByDay.values()].filter(status => status === 'success').length;

  const enoughPatternData = relapseEvents.length >= 3 && relapseDays >= 2;
  const triggerDistribution = patternDistribution(relapseEvents.map(event => event.trigger_tag));
  const emotionDistribution = patternDistribution(relapseEvents.map(event => event.emotion_tag));
  const environmentDistribution = patternDistribution(relapseEvents.map(event => event.environment_tag));
  const precedingActivityDistribution = patternDistribution(relapseEvents.map(event => event.preceding_activity));

  const periodDistribution = patternDistribution(relapseEvents.map(event => {
    const eventTimestamp = event.occurred_at || event.created_at;
    if (!eventTimestamp) return null;
    return periodFromHour(new Date(eventTimestamp).getHours());
  }));
  const weekdayDistribution = patternDistribution(relapseEvents.map(event => {
    const eventTimestamp = event.occurred_at || event.created_at;
    const date = eventTimestamp ? new Date(eventTimestamp) : new Date(`${dateKeyFromValue(event.checkin_date)}T12:00:00`);
    return Number.isNaN(date.getTime()) ? null : WEEKDAY_LABELS[date.getDay()];
  }));

  const intensityValues = recentEvents
    .map(event => Number(event.urge_intensity))
    .filter(value => Number.isFinite(value) && value >= 1 && value <= 10);
  const averageUrgeIntensity = intensityValues.length > 0
    ? Math.round((intensityValues.reduce((sum, value) => sum + value, 0) / intensityValues.length) * 10) / 10
    : null;

  const previousRange = createDateRange(input.days, new Date(now.getTime() - input.days * DAY_MS));
  const previousCounts = countRelapses(habitCheckins, previousRange);
  const previousRelapseRate = previousCounts.conclusive >= 3
    ? Math.round((previousCounts.relapse / previousCounts.conclusive) * 100)
    : null;
  const relapseRate = conclusiveEvents > 0 ? Math.round((relapseEvents.length / conclusiveEvents) * 100) : null;

  return {
    range,
    totalEvents: recentEvents.length,
    conclusiveEvents,
    resistanceEvents: resistanceEvents.length,
    relapseEvents: relapseEvents.length,
    pendingEvents: pendingEvents.length,
    resistanceRate: conclusiveEvents > 0 ? Math.round((resistanceEvents.length / conclusiveEvents) * 100) : null,
    relapseRate,
    resistanceDays,
    relapseDays,
    noteCount: recentEvents.filter(event => !!event.trigger_note?.trim()).length,
    averageUrgeIntensity,
    topRelapseTrigger: enoughPatternData ? (triggerDistribution[0] || null) : null,
    triggerDistribution: enoughPatternData ? triggerDistribution : [],
    emotionDistribution: enoughPatternData ? emotionDistribution : [],
    environmentDistribution: enoughPatternData ? environmentDistribution : [],
    precedingActivityDistribution: enoughPatternData ? precedingActivityDistribution : [],
    strongestRelapsePeriod: enoughPatternData ? (periodDistribution[0]?.label || null) : null,
    strongestRelapseWeekday: enoughPatternData ? (weekdayDistribution[0]?.label || null) : null,
    patternSample: relapseEvents.length,
    hasEnoughPatternData: enoughPatternData,
    recentEvents: recentEvents.slice(0, 30),
    previousRelapseRate,
    relapseRateChange: relapseRate !== null && previousRelapseRate !== null ? relapseRate - previousRelapseRate : null
  };
}

export function formatMinutesTotal(minutes: number): string {
  const safeMinutes = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safeMinutes / 60);
  const remaining = safeMinutes % 60;
  if (hours <= 0) return `${remaining} min`;
  return remaining > 0 ? `${hours}h ${remaining}min` : `${hours}h`;
}

export function formatDateLabel(dateKey: string): string {
  if (!dateKey) return 'Data não informada';
  const date = new Date(`${dateKey}T12:00:00`);
  if (Number.isNaN(date.getTime())) return 'Data não informada';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}
