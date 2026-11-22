import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  GUIDED_SESSION_SECONDS,
  getBallTravelConfig,
  getGuidedBreathingState,
  getGuidedPhase,
  getInfiniteAct
} from '../src/lib/guidedSession';

test('a sessão mantém 213 segundos e as etapas seguem limites definidos', () => {
  assert.equal(GUIDED_SESSION_SECONDS, 213);
  assert.equal(getGuidedPhase(213, false, false), 0);
  assert.equal(getGuidedPhase(205, false, false), 1);
  assert.equal(getGuidedPhase(115, false, false), 2);
  assert.equal(getGuidedPhase(85, false, false), 3);
  assert.equal(getGuidedPhase(0, false, false), 4);
});

test('a primeira sequência completa três ciclos de inspiração, pausa e expiração', () => {
  const start = getGuidedBreathingState(1, 205, 0);
  const pause = getGuidedBreathingState(1, 201, 0);
  const exhale = getGuidedBreathingState(1, 194, 0);
  const lastSecondOfExhale = getGuidedBreathingState(1, 149, 0);

  assert.deepEqual([start.phase, start.countText, start.duration], ['inhale', '4', 4]);
  assert.deepEqual([pause.phase, pause.countText, pause.duration], ['hold', '7', 7]);
  assert.deepEqual([exhale.phase, exhale.countText, exhale.duration], ['exhale', '8', 8]);
  assert.deepEqual([lastSecondOfExhale.phase, lastSecondOfExhale.countText], ['exhale', '1']);
});

test('a transição entre os padrões só começa depois da expiração completa', () => {
  const transition = getGuidedBreathingState(1, 148, 0);
  const nextPattern = getGuidedBreathingState(1, 143, 0);

  assert.equal(transition.phase, 'idle');
  assert.deepEqual([nextPattern.phase, nextPattern.countText], ['inhale', '4']);
});

test('o último ciclo regular termina na expiração, sem a pausa após soltar o ar', () => {
  const finalCycleStart = getGuidedBreathingState(1, 127, 0);
  const finalExhale = getGuidedBreathingState(1, 116, 0);
  const nextPhase = getGuidedPhase(115, false, false);

  assert.deepEqual([finalCycleStart.phase, finalCycleStart.countText], ['inhale', '4']);
  assert.deepEqual([finalExhale.phase, finalExhale.countText], ['exhale', '1']);
  assert.equal(nextPhase, 2);
});

test('o tempo adicional também encerra o ciclo na expiração antes de mudar de etapa', () => {
  assert.equal(getInfiniteAct(7), 1);
  assert.equal(getInfiniteAct(8), 2);
  assert.equal(getInfiniteAct(67), 2);
  assert.equal(getInfiniteAct(68), 3);
  assert.equal(getInfiniteAct(72), 3);
  assert.equal(getInfiniteAct(73), 4);

  const finalExhale = getGuidedBreathingState(5, 0, 67);
  const transition = getGuidedBreathingState(5, 0, 68);
  assert.deepEqual([finalExhale.phase, finalExhale.countText], ['exhale', '1']);
  assert.equal(transition.phase, 'idle');
});

test('a luz atravessa toda a tela em 16 segundos no celular e no computador', () => {
  const mobile = getBallTravelConfig(390);
  const desktop = getBallTravelConfig(1440);
  assert.equal(mobile.durationSeconds, 16);
  assert.equal(desktop.durationSeconds, 16);
  assert.equal(mobile.startX, 24);
  assert.equal(mobile.endX, 342);
  assert.equal(desktop.startX, 24);
  assert.equal(desktop.endX, 1392);
});
