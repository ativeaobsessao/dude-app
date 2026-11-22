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

export interface ProjectTimeComparisonItem {
  id: string;
  name: string;
  plannedMinutes: number;
  recordedMinutes: number;
  differenceMinutes: number;
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
  projectTimeComparison: ProjectTimeComparisonItem[];
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
  relapseByHabitDistribution: AvoidancePatternItem[];
  triggerDistribution: AvoidancePatternItem[];
  emotionDistribution: AvoidancePatternItem[];
  environmentDistribution: AvoidancePatternItem[];
  precedingActivityDistribution: AvoidancePatternItem[];
  recordedActivityBeforeRelapseDistribution: AvoidancePatternItem[];
  recordedProjectBeforeRelapseDistribution: AvoidancePatternItem[];
  recordedSessionContextSample: number;
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
const PRE_RELAPSE_SESSION_WINDOW_MS = 4 * 60 * 60 * 1000;

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

export function getRecordedSessionMinutes(session: FocusSession): number {
  if (!session.completed) return 0;
  const value = Number(session.actual_duration_minutes ?? session.duration_minutes ?? 0);
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

export interface ActivityCalendarDay {
  dateKey: string;
  minutes: number;
  sessionCount: number;
  intensity: 0 | 1 | 2 | 3 | 4;
}

/** Returns one local-date bucket per day, including days with no recorded work. */
export function buildActivityCalendar(
  sessions: FocusSession[],
  days: InsightPeriod = 30,
  now = new Date()
): ActivityCalendarDay[] {
  const range = createDateRange(days, now);
  const totals = new Map<string, { minutes: number; sessionCount: number }>();

  sessions.forEach(session => {
    const dateKey = dateKeyFromValue(session.started_at);
    const minutes = getRecordedSessionMinutes(session);
    if (!dateKey || !inRange(dateKey, range) || minutes <= 0) return;
    const current = totals.get(dateKey) || { minutes: 0, sessionCount: 0 };
    current.minutes += minutes;
    current.sessionCount += 1;
    totals.set(dateKey, current);
  });

  const dates: Array<{ dateKey: string; minutes: number; sessionCount: number }> = [];
  const cursor = new Date(`${range.startKey}T12:00:00`);
  const end = new Date(`${range.endKey}T12:00:00`);
  while (cursor <= end) {
    const dateKey = getLocalDateString(cursor);
    const total = totals.get(dateKey) || { minutes: 0, sessionCount: 0 };
    dates.push({ dateKey, ...total });
    cursor.setDate(cursor.getDate() + 1);
  }

  const maxMinutes = Math.max(0, ...dates.map(day => day.minutes));
  return dates.map(day => {
    if (day.minutes <= 0 || maxMinutes <= 0) return { ...day, intensity: 0 as const };
    const ratio = day.minutes / maxMinutes;
    const intensity: 1 | 2 | 3 | 4 = ratio <= 0.25 ? 1 : ratio <= 0.5 ? 2 : ratio <= 0.75 ? 3 : 4;
    return { ...day, intensity };
  });
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
    session.completed && inRange(dateKeyFromValue(session.started_at), range) && getRecordedSessionMinutes(session) > 0
  );

  const projectById = new Map(input.projects.map(project => [project.id, project]));
  const activityById = new Map(input.activities.map(activity => [activity.id, activity]));
  const minutesByProject = new Map<string, { minutes: number; count: number }>();
  const recordedMinutesByProjectId = new Map<string, number>();
  const minutesByActivity = new Map<string, { minutes: number; count: number }>();
  const minutesByWeekday = new Map<number, number>();
  const minutesByPeriod = new Map<string, number>();
  const activeDateSet = new Set<string>();
  let totalMinutes = 0;

  sessions.forEach(session => {
    const minutes = getRecordedSessionMinutes(session);
    const dateKey = dateKeyFromValue(session.started_at);
    const startedAt = new Date(session.started_at);
    totalMinutes += minutes;
    activeDateSet.add(dateKey);

    const linkedActivity = session.activity_id ? activityById.get(session.activity_id) : undefined;
    const projectId = session.project_id || linkedActivity?.project_id;
    const project = projectId ? projectById.get(projectId) : undefined;
    const projectName = projectId ? (project?.name || 'Projeto não encontrado') : 'Sem projeto vinculado';
    const projectEntry = minutesByProject.get(projectName) || { minutes: 0, count: 0 };
    projectEntry.minutes += minutes;
    projectEntry.count += 1;
    minutesByProject.set(projectName, projectEntry);
    if (projectId) {
      recordedMinutesByProjectId.set(projectId, (recordedMinutesByProjectId.get(projectId) || 0) + minutes);
    }

    const savedActivityName = session.activity_name?.trim();
    const isPlaceholderName = !savedActivityName || ['Sessão Sem Título', 'Sem Título', 'Untitled'].includes(savedActivityName);
    const activityName = isPlaceholderName ? linkedActivity?.name || 'Atividade sem nome' : savedActivityName;
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
  const plannedMinutesByProjectId = new Map<string, number>();
  scheduled.forEach(activity => {
    if (!activity.project_id) return;
    const plannedMinutes = Math.max(0, Number(activity.duration_minutes) || 0);
    plannedMinutesByProjectId.set(activity.project_id, (plannedMinutesByProjectId.get(activity.project_id) || 0) + plannedMinutes);
  });
  const projectTimeComparison = [...plannedMinutesByProjectId.entries()]
    .map(([projectId, plannedMinutes]) => ({
      id: projectId,
      name: projectById.get(projectId)?.name || 'Projeto não encontrado',
      plannedMinutes,
      recordedMinutes: recordedMinutesByProjectId.get(projectId) || 0,
      differenceMinutes: (recordedMinutesByProjectId.get(projectId) || 0) - plannedMinutes
    }))
    .sort((a, b) => b.plannedMinutes - a.plannedMinutes)
    .slice(0, 6);

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
    projectTimeComparison,
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

function getSessionEndTime(session: FocusSession): number | null {
  const completedAt = session.completed_at ? new Date(session.completed_at).getTime() : Number.NaN;
  if (Number.isFinite(completedAt)) return completedAt;
  const startedAt = new Date(session.started_at).getTime();
  const minutes = getRecordedSessionMinutes(session);
  if (!Number.isFinite(startedAt) || minutes <= 0) return null;
  return startedAt + minutes * 60_000;
}

function getRecordedSessionContext(input: {
  relapseEvents: AvoidanceCheckin[];
  sessions: FocusSession[];
  projects: Project[];
  activities: Activity[];
}): { activities: AvoidancePatternItem[]; projects: AvoidancePatternItem[]; sample: number } {
  const projectById = new Map(input.projects.map(project => [project.id, project]));
  const activityById = new Map(input.activities.map(activity => [activity.id, activity]));
  const activityNames: string[] = [];
  const projectNames: string[] = [];
  const usableSessions = input.sessions
    .filter(session => session.completed && getRecordedSessionMinutes(session) > 0)
    .map(session => ({ session, start: new Date(session.started_at).getTime(), end: getSessionEndTime(session) }))
    .filter(item => Number.isFinite(item.start) && item.end !== null);
  let sample = 0;

  input.relapseEvents.forEach(event => {
    const eventTimestamp = new Date(event.occurred_at || event.created_at || `${dateKeyFromValue(event.checkin_date)}T23:59:59`).getTime();
    if (!Number.isFinite(eventTimestamp)) return;

    const related = usableSessions
      .filter(item => {
        if (item.end === null || item.start > eventTimestamp) return false;
        const sessionWasInProgress = item.end >= eventTimestamp;
        const sessionEndedRecently = item.end < eventTimestamp && eventTimestamp - item.end <= PRE_RELAPSE_SESSION_WINDOW_MS;
        return sessionWasInProgress || sessionEndedRecently;
      })
      .sort((a, b) => (b.end || 0) - (a.end || 0))[0];
    if (!related) return;

    sample += 1;
    const session = related.session;
    const linkedActivity = session.activity_id ? activityById.get(session.activity_id) : undefined;
    const savedActivityName = session.activity_name?.trim();
    const isPlaceholderName = !savedActivityName || ['Sessão Sem Título', 'Sem Título', 'Untitled'].includes(savedActivityName);
    const activityName = isPlaceholderName ? linkedActivity?.name || '' : savedActivityName;
    const projectId = session.project_id || linkedActivity?.project_id;
    const projectName = projectId ? projectById.get(projectId)?.name || '' : '';
    if (activityName) activityNames.push(activityName);
    if (projectName) projectNames.push(projectName);
  });

  return {
    activities: patternDistribution(activityNames),
    projects: patternDistribution(projectNames),
    sample
  };
}

export function analyzeAvoidancePatterns(input: {
  checkins: AvoidanceCheckin[];
  selectedHabitId: string;
  days: InsightPeriod;
  sessions?: FocusSession[];
  projects?: Project[];
  activities?: Activity[];
  habits?: Habit[];
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
  // Count one outcome per behavior per local date. Different controls can have
  // different outcomes on the same calendar day without overwriting each other.
  const outcomeByHabitDay = new Map<string, 'success' | 'relapse'>();
  const relapseCalendarDates = new Set<string>();
  recentEvents.forEach(checkin => {
    const status = normalizeAvoidanceStatus(checkin.status);
    const dateKey = dateKeyFromValue(checkin.occurred_at) || dateKeyFromValue(checkin.checkin_date) || dateKeyFromValue(checkin.created_at);
    if (!dateKey || (status !== 'success' && status !== 'relapse')) return;
    const habitDayKey = `${checkin.habit_id || 'sem-controle'}:${dateKey}`;
    if (status === 'relapse' || !outcomeByHabitDay.has(habitDayKey)) outcomeByHabitDay.set(habitDayKey, status);
    if (status === 'relapse') relapseCalendarDates.add(dateKey);
  });
  const relapseDays = [...outcomeByHabitDay.values()].filter(status => status === 'relapse').length;
  const resistanceDays = [...outcomeByHabitDay.values()].filter(status => status === 'success').length;

  const enoughPatternData = relapseEvents.length >= 3 && relapseCalendarDates.size >= 2;
  const habitNameById = new Map((input.habits || []).map(habit => [habit.id, habit.name]));
  const relapseByHabitDistribution = patternDistribution(relapseEvents.map(event => event.habit_id ? habitNameById.get(event.habit_id) || 'Acompanhamento removido' : 'Sem acompanhamento'));
  const triggerDistribution = patternDistribution(relapseEvents.map(event => event.trigger_tag));
  const emotionDistribution = patternDistribution(relapseEvents.map(event => event.emotion_tag));
  const environmentDistribution = patternDistribution(relapseEvents.map(event => event.environment_tag));
  const precedingActivityDistribution = patternDistribution(relapseEvents.map(event => event.preceding_activity));
  const recordedSessionContext = getRecordedSessionContext({
    relapseEvents,
    sessions: input.sessions || [],
    projects: input.projects || [],
    activities: input.activities || []
  });

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
    relapseByHabitDistribution,
    triggerDistribution: enoughPatternData ? triggerDistribution : [],
    emotionDistribution: enoughPatternData ? emotionDistribution : [],
    environmentDistribution: enoughPatternData ? environmentDistribution : [],
    precedingActivityDistribution: enoughPatternData ? precedingActivityDistribution : [],
    recordedActivityBeforeRelapseDistribution: recordedSessionContext.activities,
    recordedProjectBeforeRelapseDistribution: recordedSessionContext.projects,
    recordedSessionContextSample: recordedSessionContext.sample,
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
