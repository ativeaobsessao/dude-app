export const playSound = (type: 'warning' | 'complete') => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    const frequencies = type === 'warning' 
      ? [523, 523, 659]  // Dó, Dó, Mi — alerta claro
      : [523, 659, 784, 1047]; // Dó, Mi, Sol, Dó alto — vitória
    
    frequencies.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.frequency.value = freq;
      osc.type = 'sine';
      
      const startTime = ctx.currentTime + i * 0.35;
      
      // Volume alto — 0.8 em vez de 0.3
      gain.gain.setValueAtTime(0.8, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.5);
      
      osc.start(startTime);
      osc.stop(startTime + 0.5);
    });
  } catch (err) {
    console.log('Audio não suportado:', err);
  }
};

export const useSessionNotifications = () => {
  const triggerNotification = (type: 'warning' | 'complete') => {
    if ('vibrate' in navigator) {
      if (type === 'warning') {
        navigator.vibrate([400, 150, 400, 150, 400]);
      } else {
        navigator.vibrate([500, 200, 500, 200, 500, 200, 800]);
      }
    }
    playSound(type);
  };

  return { triggerNotification };
};
