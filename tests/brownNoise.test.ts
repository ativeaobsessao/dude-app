import test from 'node:test';
import assert from 'node:assert/strict';
import { createBrownNoiseSamples } from '../src/lib/brownNoise';

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

test('gera ruído marrom finito e com duração previsível', () => {
  const sampleRate = 8000;
  const samples = createBrownNoiseSamples(sampleRate, 8, seededRandom(7));
  assert.equal(samples.length, (sampleRate * 8) - Math.floor(sampleRate * 1.25));
  assert.ok(samples.length > 0);
  assert.ok(Array.from(samples).every(Number.isFinite));
});

test('mantém headroom e não produz clipping', () => {
  const samples = createBrownNoiseSamples(8000, 8, seededRandom(19));
  const peak = Math.max(...Array.from(samples, value => Math.abs(value)));
  assert.ok(peak <= 0.720001);
  assert.ok(peak > 0.1);
});

test('reduz a descontinuidade no ponto de repetição', () => {
  const samples = createBrownNoiseSamples(8000, 8, seededRandom(31));
  const boundaryDelta = Math.abs(samples[0] - samples[samples.length - 1]);
  assert.ok(boundaryDelta < 0.12, `Descontinuidade no loop: ${boundaryDelta}`);
});

test('rejeita parâmetros inválidos', () => {
  assert.throws(() => createBrownNoiseSamples(1000, 8), /Taxa de amostragem inválida/);
  assert.throws(() => createBrownNoiseSamples(44100, 2), /pelo menos 4 segundos/);
});
