let sharedAudioContext: AudioContext | null = null;

export const unlockAudio = () => {
  try {
    if (!sharedAudioContext) {
      sharedAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      console.log('[SP Audio] AudioContext created during user gesture.');
    }
    if (sharedAudioContext.state === 'suspended') {
      sharedAudioContext.resume()
        .then(() => {
          console.log('[SP Audio] AudioContext resumed successfully on user gesture. State:', sharedAudioContext?.state);
        })
        .catch(err => {
          console.error('[SP Audio] Failed to resume AudioContext during user gesture:', err);
        });
    } else {
      console.log('[SP Audio] AudioContext is already running. State:', sharedAudioContext.state);
    }

    // Play a brief, silent buffer of 1 sample to fully satisfy browser policies and avoid suspension
    const buffer = sharedAudioContext.createBuffer(1, 1, 22050);
    const source = sharedAudioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(sharedAudioContext.destination);
    source.start(0);
    console.log('[SP Audio] Muted play event occurred to secure autoplay bypass.');
  } catch (err) {
    console.warn('[SP Audio] unlockAudio error:', err);
  }
};

export const playSound = async (type: 'warning' | 'complete') => {
  console.log(`[SP Audio] playSound entered with type: "${type}"`);
  try {
    if (!sharedAudioContext) {
      sharedAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      console.log('[SP Audio] AudioContext was not initialized, created one now.');
    }

    if (sharedAudioContext.state === 'suspended') {
      console.log('[SP Audio] AudioContext is suspended. Attempting to resume...');
      await sharedAudioContext.resume().catch(err => {
        console.warn('[SP Audio] Could not resume AudioContext inside playSound:', err);
      });
    }

    const ctx = sharedAudioContext;
    const frequencies = type === 'warning' 
      ? [523, 523, 659]  // Dó, Dó, Mi
      : [523, 659, 784, 1047]; // Dó, Mi, Sol, Dó alto

    console.log(`[SP Audio] Sound scheduled on AudioContext (state: ${ctx.state}, currentTime: ${ctx.currentTime})`);

    // Only configure and play nodes if context running
    frequencies.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.frequency.value = freq;
      osc.type = 'sine';
      
      const startTime = ctx.currentTime + i * 0.35;
      
      gain.gain.setValueAtTime(0.8, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.5);
      
      osc.start(startTime);
      osc.stop(startTime + 0.5);
    });
    console.log('[SP Audio] Playback execution successful.');
  } catch (err) {
    console.error('[SP Audio] playSound failed with error:', err);
  }
};

export const playScheduleSound = async (type: 'start' | 'overdue') => {
  console.log(`[SP Audio] playScheduleSound entered with type: "${type}"`);
  try {
    if (!sharedAudioContext) {
      sharedAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (sharedAudioContext.state === 'suspended') {
      await sharedAudioContext.resume().catch(() => {});
    }
    const ctx = sharedAudioContext;
    const frequencies = type === 'start'
      ? [587, 659, 880]  // bright rising
      : [220, 220, 196]; // graver alarm

    frequencies.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = type === 'start' ? 'sine' : 'triangle';
      const startTime = ctx.currentTime + i * 0.25;
      gain.gain.setValueAtTime(0.65, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.4);
      osc.start(startTime);
      osc.stop(startTime + 0.4);
    });
  } catch (err) {
    console.warn('[SP Audio] playScheduleSound error:', err);
  }
};

export const useSessionNotifications = () => {
  const triggerNotification = (type: 'warning' | 'complete') => {
    console.log(`[SP Audio] triggerNotification called with type: "${type}"`);
    if ('vibrate' in navigator) {
      try {
        if (type === 'warning') {
          navigator.vibrate([400, 150, 400, 150, 400]);
        } else {
          navigator.vibrate([500, 200, 500, 200, 500, 200, 800]);
        }
        console.log('[SP Audio] Vibrate triggered.');
      } catch (e) {
        console.warn('[SP Audio] Vibrate not allowed:', e);
      }
    }
    playSound(type);
  };

  return { triggerNotification, unlockAudio };
};
