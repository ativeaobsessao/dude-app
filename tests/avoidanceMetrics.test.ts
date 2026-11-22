import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import type { AvoidanceCheckin, Habit } from '../src/types';
import { calculateAvoidanceMetrics } from '../src/lib/avoidanceMetrics';

const habit = (overrides: Partial<Habit> = {}): Habit => ({
  id: 'habit-1',
  user_id: 'user-1',
  name: 'Redes sociais',
  total_minutes: 0,
  deep_sessions_count: 0,
  weekly_streak: 0,
  sessions_per_week: 7,
  minutes_per_session: 0,
  preferred_time: 'morning',
  sessions_this_week: 0,
  week_start_date: '2026-11-16',
  created_at: '2026-01-01T12:00:00.000Z',
  monitor_type: 'dia_todo',
  monitor_weekdays: 'all',
  ...overrides
});

const checkin = (date: string, status: 'success' | 'relapse' | 'pending', id = `${date}-${status}`): AvoidanceCheckin => ({
  id,
  user_id: 'user-1',
  habit_id: 'habit-1',
  checkin_date: date,
  checkin_period: 'day',
  status,
  created_at: `${date}T18:00:00.000Z`
});

const localNoon = (date: string) => new Date(`${date}T12:00:00`);

function dateRange(start: string, count: number): string[] {
  const cursor = localNoon(start);
  const dates: string[] = [];
  for (let index = 0; index < count; index += 1) {
    dates.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`);
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

test('recorde e sequência atual contam dias consecutivos confirmados', () => {
  const dates = dateRange('2026-10-23', 31);
  const metrics = calculateAvoidanceMetrics(habit(), dates.map(date => checkin(date, 'success')), localNoon('2026-11-22'));
  assert.equal(metrics.bestStreak, 31);
  assert.equal(metrics.currentStreak, 31);
});

test('recaída encerra a sequência atual, mas preserva o recorde anterior', () => {
  const dates = dateRange('2026-10-19', 34);
  const checkins = dates.map(date => checkin(date, 'success'));
  checkins.push(checkin('2026-11-22', 'relapse'));
  checkins.push(checkin('2026-11-23', 'success'));
  const metrics = calculateAvoidanceMetrics(habit(), checkins, localNoon('2026-11-23'));
  assert.equal(metrics.bestStreak, 34);
  assert.equal(metrics.currentStreak, 1);
  assert.equal(metrics.lastRelapseDate, '2026-11-22');
});

test('dia sem registro interrompe a sequência e não é contado como resistência', () => {
  const checkins = [
    checkin('2026-11-19', 'success'),
    checkin('2026-11-20', 'success'),
    checkin('2026-11-22', 'success')
  ];
  const metrics = calculateAvoidanceMetrics(habit(), checkins, localNoon('2026-11-22'));
  assert.equal(metrics.bestStreak, 2);
  assert.equal(metrics.currentStreak, 1);
  assert.equal(metrics.confirmedDaysTotal, 3);
});

test('recaída prevalece sobre resistência registrada no mesmo dia', () => {
  const checkins = [
    checkin('2026-11-21', 'success', 'success-1'),
    checkin('2026-11-21', 'relapse', 'relapse-1')
  ];
  const metrics = calculateAvoidanceMetrics(habit(), checkins, localNoon('2026-11-21'));
  assert.equal(metrics.bestStreak, 0);
  assert.equal(metrics.currentStreak, 0);
  assert.equal(metrics.relapseDaysTotal, 1);
  assert.equal(metrics.confirmedDaysTotal, 0);
});

test('dias não programados não interrompem a sequência de um acompanhamento semanal', () => {
  const weeklyHabit = habit({ monitor_weekdays: '1,3,5' });
  const checkins = [
    checkin('2026-11-16', 'success'), // segunda
    checkin('2026-11-18', 'success'), // quarta
    checkin('2026-11-20', 'success')  // sexta
  ];
  const metrics = calculateAvoidanceMetrics(weeklyHabit, checkins, localNoon('2026-11-20'));
  assert.equal(metrics.bestStreak, 3);
  assert.equal(metrics.currentStreak, 3);
});

test('acompanhamento por horário usa períodos, não dias, na apresentação', () => {
  const windowHabit = habit({ monitor_type: 'janela' });
  const metrics = calculateAvoidanceMetrics(windowHabit, [
    checkin('2026-11-21', 'success'),
    checkin('2026-11-22', 'success')
  ], localNoon('2026-11-22'));
  assert.equal(metrics.bestStreak, 2);
  assert.equal(metrics.unitPlural, 'períodos');
});

test('registros futuros não aumentam recorde ou sequência', () => {
  const metrics = calculateAvoidanceMetrics(habit(), [
    checkin('2026-11-21', 'success'),
    checkin('2026-11-22', 'success'),
    checkin('2026-11-23', 'success')
  ], localNoon('2026-11-22'));
  assert.equal(metrics.bestStreak, 2);
  assert.equal(metrics.currentStreak, 2);
});
