export const GUIDED_SESSION_SECONDS = 213;

export type GuidedPhase = 0 | 1 | 2 | 3 | 4 | 5 | -1;
export type BreathingPhase = 'inhale' | 'hold' | 'exhale' | 'empty' | 'idle';

export interface BreathingState {
  phase: BreathingPhase;
  text: string;
  countText: string;
  duration: number;
}

const IDLE_BREATHING_STATE: BreathingState = {
  phase: 'idle',
  text: '',
  countText: '',
  duration: 0
};

function countDown(duration: number, elapsed: number): string {
  return String(Math.max(1, Math.ceil(duration - elapsed)));
}

function fourSevenEightState(elapsed: number): BreathingState {
  const cyclePosition = elapsed % 19;
  if (cyclePosition < 4) {
    return {
      phase: 'inhale',
      text: 'Inspire suavemente',
      countText: countDown(4, cyclePosition),
      duration: 4
    };
  }
  if (cyclePosition < 11) {
    const phaseElapsed = cyclePosition - 4;
    return {
      phase: 'hold',
      text: 'Faça uma pausa confortável',
      countText: countDown(7, phaseElapsed),
      duration: 7
    };
  }
  const phaseElapsed = cyclePosition - 11;
  return {
    phase: 'exhale',
    text: 'Solte o ar devagar',
    countText: countDown(8, phaseElapsed),
    duration: 8
  };
}

function boxBreathingState(elapsed: number, omitFinalEmptyPause: boolean): BreathingState {
  const cycleDuration = 16;
  const completedCycles = omitFinalEmptyPause ? 3 : Number.POSITIVE_INFINITY;
  const finalCycleStart = completedCycles * cycleDuration;

  if (omitFinalEmptyPause && elapsed >= finalCycleStart) {
    const finalCyclePosition = elapsed - finalCycleStart;
    if (finalCyclePosition < 4) {
      return {
        phase: 'inhale',
        text: 'Inspire suavemente',
        countText: countDown(4, finalCyclePosition),
        duration: 4
      };
    }
    if (finalCyclePosition < 8) {
      return {
        phase: 'hold',
        text: 'Faça uma pausa confortável',
        countText: countDown(4, finalCyclePosition - 4),
        duration: 4
      };
    }
    return {
      phase: 'exhale',
      text: 'Solte o ar devagar',
      countText: countDown(4, finalCyclePosition - 8),
      duration: 4
    };
  }

  const cyclePosition = elapsed % cycleDuration;
  if (cyclePosition < 4) {
    return {
      phase: 'inhale',
      text: 'Inspire suavemente',
      countText: countDown(4, cyclePosition),
      duration: 4
    };
  }
  if (cyclePosition < 8) {
    return {
      phase: 'hold',
      text: 'Faça uma pausa confortável',
      countText: countDown(4, cyclePosition - 4),
      duration: 4
    };
  }
  if (cyclePosition < 12) {
    return {
      phase: 'exhale',
      text: 'Solte o ar devagar',
      countText: countDown(4, cyclePosition - 8),
      duration: 4
    };
  }
  return {
    phase: 'empty',
    text: 'Descanse naturalmente',
    countText: countDown(4, cyclePosition - 12),
    duration: 4
  };
}

/**
 * Main session: 8s opening, 90s breathing guidance, 30s visual tracking,
 * and 85s for optional reflection. Every phase boundary follows a completed
 * exhalation; the final box-breathing cycle omits the post-exhale pause.
 */
export function getGuidedPhase(timeLeft: number | null, isInfiniteMode: boolean, isDecisionPoint: boolean): GuidedPhase {
  if (isInfiniteMode) return 5;
  if (isDecisionPoint) return 4;
  if (timeLeft === null) return -1;
  if (timeLeft > 205) return 0;
  if (timeLeft > 115) return 1;
  if (timeLeft > 85) return 2;
  if (timeLeft > 0) return 3;
  return 4;
}

export function getInfiniteAct(seconds: number): 1 | 2 | 3 | 4 {
  if (seconds < 8) return 1;
  if (seconds < 68) return 2;
  if (seconds < 73) return 3;
  return 4;
}

export function getGuidedBreathingState(
  phase: GuidedPhase,
  timeLeft: number | null,
  infiniteSeconds: number
): BreathingState {
  if (phase === 1 && timeLeft !== null) {
    if (timeLeft > 148) {
      return fourSevenEightState(205 - timeLeft);
    }
    if (timeLeft <= 143 && timeLeft > 115) {
      return boxBreathingState(143 - timeLeft, true);
    }
  }

  if (phase === 5 && infiniteSeconds >= 8 && infiniteSeconds < 68) {
    return boxBreathingState(infiniteSeconds - 8, true);
  }

  return IDLE_BREATHING_STATE;
}

export interface BallTravelConfig {
  startX: number;
  endX: number;
  durationSeconds: number;
  speedPixelsPerSecond: number;
}

/**
 * A luz atravessa toda a largura disponível em 16 segundos em qualquer tela.
 * A duração constante mantém o mesmo ritmo visual em celulares e computadores.
 */
export function getBallTravelConfig(viewportWidth: number): BallTravelConfig {
  const width = Math.max(0, viewportWidth);
  const startX = Math.min(24, Math.max(0, width / 2));
  const endX = Math.max(startX, width - 48);
  const durationSeconds = 16;
  const distance = endX - startX;

  return {
    startX,
    endX,
    durationSeconds,
    speedPixelsPerSecond: distance / durationSeconds
  };
}
