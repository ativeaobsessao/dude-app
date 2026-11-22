/**
 * Generates a loopable brown-noise buffer for the decompression experience.
 * The edge crossfade avoids a hard discontinuity when the Web Audio buffer loops.
 * Output is normalized with headroom; playback volume is controlled separately.
 */
export function createBrownNoiseSamples(
  sampleRate: number,
  durationSeconds = 30,
  random: () => number = Math.random
): Float32Array {
  if (!Number.isFinite(sampleRate) || sampleRate < 8000) {
    throw new Error('Taxa de amostragem inválida para gerar o áudio.');
  }
  if (!Number.isFinite(durationSeconds) || durationSeconds < 4) {
    throw new Error('A duração do áudio precisa ser de pelo menos 4 segundos.');
  }

  const totalSamples = Math.max(1, Math.floor(sampleRate * durationSeconds));
  const raw = new Float32Array(totalSamples);
  let lastOut = 0;

  // Brown noise (integrated white noise with a gentle leak to avoid DC drift).
  for (let i = 0; i < totalSamples; i += 1) {
    const white = (random() * 2) - 1;
    lastOut = (lastOut + (0.02 * white)) / 1.02;
    raw[i] = lastOut;
  }

  const crossfadeSamples = Math.min(
    Math.floor(sampleRate * 1.25),
    Math.floor(totalSamples / 4)
  );
  const output = new Float32Array(totalSamples - crossfadeSamples);

  // Blend the end into the beginning, then continue with the middle section.
  // This preserves adjacent samples at the loop boundary and greatly reduces clicks.
  for (let i = 0; i < crossfadeSamples; i += 1) {
    const progress = crossfadeSamples <= 1 ? 1 : i / (crossfadeSamples - 1);
    const tail = raw[totalSamples - crossfadeSamples + i];
    const head = raw[i];
    output[i] = (tail * (1 - progress)) + (head * progress);
  }

  output.set(
    raw.subarray(crossfadeSamples, totalSamples - crossfadeSamples),
    crossfadeSamples
  );

  // Remove DC offset and normalize to a conservative peak with headroom.
  let mean = 0;
  for (let i = 0; i < output.length; i += 1) mean += output[i];
  mean /= output.length;

  let peak = 0;
  for (let i = 0; i < output.length; i += 1) {
    const centered = output[i] - mean;
    output[i] = centered;
    peak = Math.max(peak, Math.abs(centered));
  }

  if (peak > 0) {
    const normalization = 0.72 / peak;
    for (let i = 0; i < output.length; i += 1) {
      output[i] = Math.max(-0.72, Math.min(0.72, output[i] * normalization));
    }
  }

  return output;
}
