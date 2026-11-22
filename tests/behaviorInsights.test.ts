import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { analyzeAvoidancePatterns, analyzePersonalInsights, buildActivityCalendar } from '../src/lib/behaviorInsights';

const noon = (date: string) => new Date(`${date}T12:00:00`);

test('calendário retorna 30 dias e usa o tempo registrado para definir a intensidade', () => {
  const sessions = [
    {
      id: 's1', user_id: 'u1', project_id: 'p1', habit_id: null, activity_name: 'Estudo', description: null,
      duration_minutes: 60, started_at: '2026-11-21T10:00:00.000Z', completed_at: '2026-11-21T11:00:00.000Z',
      completed: true, created_at: '2026-11-21T11:00:00.000Z', all_tasks_completed: true, actual_duration_minutes: 60, activity_id: 'a1'
    },
    {
      id: 's2', user_id: 'u1', project_id: 'p1', habit_id: null, activity_name: 'Estudo', description: null,
      duration_minutes: 120, started_at: '2026-11-22T10:00:00.000Z', completed_at: '2026-11-22T12:00:00.000Z',
      completed: true, created_at: '2026-11-22T12:00:00.000Z', all_tasks_completed: true, actual_duration_minutes: 120, activity_id: 'a1'
    },
    {
      id: 's3', user_id: 'u1', project_id: 'p1', habit_id: null, activity_name: 'Não concluída', description: null,
      duration_minutes: 180, started_at: '2026-11-22T13:00:00.000Z', completed_at: null,
      completed: false, created_at: '2026-11-22T13:00:00.000Z', all_tasks_completed: false, actual_duration_minutes: null, activity_id: 'a1'
    }
  ];

  const calendar = buildActivityCalendar(sessions, 30, noon('2026-11-22'));
  const day21 = calendar.find(day => day.dateKey === '2026-11-21');
  const day22 = calendar.find(day => day.dateKey === '2026-11-22');

  assert.equal(calendar.length, 30);
  assert.equal(day21?.minutes, 60);
  assert.equal(day21?.sessionCount, 1);
  assert.equal(day22?.minutes, 120);
  assert.equal(day22?.sessionCount, 1);
  assert.ok((day22?.intensity || 0) > (day21?.intensity || 0));
});

test('resistência e recaída de comportamentos diferentes não se anulam no mesmo dia', () => {
  const checkins = [
    { id: 'c1', user_id: 'u1', habit_id: 'h1', checkin_date: '2026-11-22', checkin_period: 'day', status: 'success', created_at: '2026-11-22T11:00:00.000Z' },
    { id: 'c2', user_id: 'u1', habit_id: 'h2', checkin_date: '2026-11-22', checkin_period: 'day', status: 'relapse', occurred_at: '2026-11-22T13:30:00.000Z', created_at: '2026-11-22T13:30:00.000Z' }
  ];

  const summary = analyzeAvoidancePatterns({
    checkins,
    selectedHabitId: 'all',
    days: 30,
    habits: [{ id: 'h1', name: 'Redes sociais' }, { id: 'h2', name: 'Doces' }] as any,
    now: noon('2026-11-22')
  });
  assert.equal(summary.resistanceDays, 1);
  assert.equal(summary.relapseDays, 1);
  assert.equal(summary.relapseByHabitDistribution[0]?.label, 'Doces');
});

test('análise relaciona uma recaída à sessão registrada nas quatro horas anteriores', () => {
  const checkins = [
    { id: 'c1', user_id: 'u1', habit_id: 'h1', checkin_date: '2026-11-22', checkin_period: 'day', status: 'relapse', occurred_at: '2026-11-22T13:30:00.000Z', created_at: '2026-11-22T13:30:00.000Z' }
  ];
  const sessions = [
    {
      id: 's1', user_id: 'u1', project_id: 'p1', habit_id: null, activity_name: 'Estudo', description: null,
      duration_minutes: 60, started_at: '2026-11-22T10:00:00.000Z', completed_at: '2026-11-22T11:00:00.000Z',
      completed: true, created_at: '2026-11-22T11:00:00.000Z', all_tasks_completed: true, actual_duration_minutes: 60, activity_id: 'a1'
    }
  ];

  const summary = analyzeAvoidancePatterns({
    checkins,
    selectedHabitId: 'all',
    days: 30,
    sessions,
    projects: [{ id: 'p1', user_id: 'u1', name: 'Projeto DUDE', created_at: '2026-01-01T00:00:00.000Z' }],
    activities: [{ id: 'a1', user_id: 'u1', project_id: 'p1', name: 'Estudo', completed: true, created_at: '2026-01-01T00:00:00.000Z' }],
    now: noon('2026-11-22')
  });

  assert.equal(summary.recordedSessionContextSample, 1);
  assert.equal(summary.recordedActivityBeforeRelapseDistribution[0]?.label, 'Estudo');
  assert.equal(summary.recordedProjectBeforeRelapseDistribution[0]?.label, 'Projeto DUDE');
});


test('análise pessoal compara tempo planejado e tempo registrado por projeto', () => {
  const summary = analyzePersonalInsights({
    sessions: [{
      id: 's1', user_id: 'u1', project_id: 'p1', habit_id: null, activity_name: 'Página de vendas', description: null,
      duration_minutes: 60, started_at: '2026-11-22T10:00:00.000Z', completed_at: '2026-11-22T11:00:00.000Z',
      completed: true, created_at: '2026-11-22T11:00:00.000Z', all_tasks_completed: true, actual_duration_minutes: 60
    }],
    projects: [{ id: 'p1', user_id: 'u1', name: 'Projeto DUDE', created_at: '2026-01-01T00:00:00.000Z' }],
    activities: [],
    habits: [],
    habitCompletions: [],
    dailyTasks: [],
    scheduledActivities: [{
      id: 'a1', user_id: 'u1', title: 'Implementação', project_id: 'p1', activity_id: null, atividade_avulsa: null,
      habit_id: null, scheduled_date: '2026-11-22', scheduled_time: '09:00', duration_minutes: 120,
      status: 'agendada', tasks: [], notes: null, created_at: '2026-11-20T00:00:00.000Z'
    }],
    days: 30,
    now: noon('2026-11-22')
  });

  assert.equal(summary.projectTimeComparison[0]?.name, 'Projeto DUDE');
  assert.equal(summary.projectTimeComparison[0]?.plannedMinutes, 120);
  assert.equal(summary.projectTimeComparison[0]?.recordedMinutes, 60);
  assert.equal(summary.projectTimeComparison[0]?.differenceMinutes, -60);
});
