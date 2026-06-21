import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Volume2, VolumeX, X, ShieldCheck, Heart, Send, Sparkles, AlertCircle } from 'lucide-react';
import { useDataStore } from '../../store/useDataStore';
import { getLocalDateString } from '../../lib/utils';

interface UrgeSurfingProtocolProps {
  habitId?: string;
  onClose: () => void;
}

// Clinically equalized real-time Tone Generator supporting Solfeggio & Perceptually-boosted Binaural Beats
class AudioSynthesizer {
  private ctx: AudioContext | null = null;
  private oscLeft: OscillatorNode | null = null;
  private oscRight: OscillatorNode | null = null;
  private gainNode: GainNode | null = null;
  private compressorNode: DynamicsCompressorNode | null = null;
  private currentFreq: number = 0;
  private currentOffset: number = 0;

  start(frequency: number, binauralOffset: number = 0, volumeMultiplier: number = 1.0) {
    const baseGain = 0.08;
    const targetVolume = baseGain * volumeMultiplier;

    // BLINDAGEM 1: Impede o React de recriar a rampa a cada 1 segundo se a frequência for a mesma
    if (this.ctx && this.currentFreq === frequency && this.currentOffset === binauralOffset) {
      return; 
    }

    if (this.ctx && this.oscLeft && this.gainNode) {
      // Transição suave (Anti-estalo)
      this.currentFreq = frequency;
      this.currentOffset = binauralOffset;
      const currentTime = this.ctx.currentTime;
      this.oscLeft.frequency.setTargetAtTime(frequency, currentTime, 0.05);
      if (this.oscRight) {
        this.oscRight.frequency.setTargetAtTime(frequency + binauralOffset, currentTime, 0.05);
      }
      this.gainNode.gain.setTargetAtTime(targetVolume, currentTime, 0.05);
      return;
    }

    this.currentFreq = frequency;
    this.currentOffset = binauralOffset;
    
    try {
      this.stop();
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      
      this.ctx = new AudioContextClass();
      this.gainNode = this.ctx.createGain();
      this.compressorNode = this.ctx.createDynamicsCompressor();
      
      // Limitador de estúdio
      this.compressorNode.threshold.setValueAtTime(-12, this.ctx.currentTime);
      this.compressorNode.knee.setValueAtTime(30, this.ctx.currentTime);
      this.compressorNode.ratio.setValueAtTime(12, this.ctx.currentTime);
      this.compressorNode.attack.setValueAtTime(0.003, this.ctx.currentTime);
      this.compressorNode.release.setValueAtTime(0.25, this.ctx.currentTime);

      this.gainNode.gain.setValueAtTime(0, this.ctx.currentTime);
      
      this.gainNode.connect(this.compressorNode);
      this.compressorNode.connect(this.ctx.destination);

      if (binauralOffset === 0) {
        this.oscLeft = this.ctx.createOscillator();
        this.oscLeft.type = 'sine';
        this.oscLeft.frequency.setValueAtTime(frequency, this.ctx.currentTime);
        this.oscLeft.connect(this.gainNode);
      } else {
        const pannerLeft = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
        const pannerRight = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;

        this.oscLeft = this.ctx.createOscillator();
        this.oscLeft.type = 'sine';
        this.oscLeft.frequency.setValueAtTime(frequency, this.ctx.currentTime);

        this.oscRight = this.ctx.createOscillator();
        this.oscRight.type = 'sine';
        this.oscRight.frequency.setValueAtTime(frequency + binauralOffset, this.ctx.currentTime);

        if (pannerLeft && pannerRight) {
          pannerLeft.pan.setValueAtTime(-1, this.ctx.currentTime);
          pannerRight.pan.setValueAtTime(1, this.ctx.currentTime);
          
          this.oscLeft.connect(pannerLeft).connect(this.gainNode);
          this.oscRight.connect(pannerRight).connect(this.gainNode);
        } else {
          this.oscLeft.connect(this.gainNode);
          this.oscRight.connect(this.gainNode);
        }
      }

      this.oscLeft.start();
      if (this.oscRight) this.oscRight.start();

      this.gainNode.gain.setTargetAtTime(targetVolume, this.ctx.currentTime, 0.05);
    } catch (e) {
      console.warn("AudioContext blocked or failed initialization.", e);
    }
  }

  stop() {
    if (this.ctx && this.gainNode) {
      // BLINDAGEM 2: Fade-out suave de encerramento antes de matar os nós
      this.gainNode.gain.setTargetAtTime(0, this.ctx.currentTime, 0.03);
      setTimeout(() => {
        this.killNodes();
      }, 100);
      return;
    }
    this.killNodes();
  }

  private killNodes() {
    this.currentFreq = 0;
    this.currentOffset = 0;
    try {
      if (this.oscLeft) { this.oscLeft.stop(); this.oscLeft.disconnect(); }
      if (this.oscRight) { this.oscRight.stop(); this.oscRight.disconnect(); }
      if (this.gainNode) this.gainNode.disconnect();
      if (this.compressorNode) this.compressorNode.disconnect();
      if (this.ctx && this.ctx.state !== 'closed') this.ctx.close();
    } catch (e) {}
    this.oscLeft = null;
    this.oscRight = null;
    this.gainNode = null;
    this.compressorNode = null;
    this.ctx = null;
  }
}

export const UrgeSurfingProtocol = ({ habitId, onClose }: UrgeSurfingProtocolProps) => {
  const dataStore = useDataStore();
  const { profile, habits } = dataStore;

  const currentHabit = habits.find(h => h.id === habitId);
  const habitName = currentHabit ? currentHabit.name : 'Crise Geral';

  // 5-minute primary timer countdown (300 seconds)
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState<boolean>(true);
  const [ghostQuoteContent, setGhostQuoteContent] = useState<string>('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [reflectionSaved, setReflectionSaved] = useState<boolean>(false);
  const [showHeadphonesAlert, setShowHeadphonesAlert] = useState<boolean>(true);

  // Infinite Extension Mode properties
  const [isInfiniteMode, setIsInfiniteMode] = useState<boolean>(false);
  const [infiniteSeconds, setInfiniteSeconds] = useState<number>(0);
  const [isEncruzilhada, setIsEncruzilhada] = useState<boolean>(false);
  const [infiniteNote, setInfiniteNote] = useState<string>('');
  const [phase3Seconds, setPhase3Seconds] = useState<number>(0);
  const [isAccelerated, setIsAccelerated] = useState<boolean>(false);

  // Refs for tracking check-in updates and text concatenation under Directive 1
  const lastSavedCheckinIdRef = useRef<string | null>(null);
  const lastSavedTextRef = useRef<string>('');

  // Sound generator reference
  const synthRef = useRef<AudioSynthesizer | null>(null);
  // Screen Wake Lock API reference
  const wakeLockRef = useRef<any>(null);

  // Screen Wake Lock initialization/disposal
  useEffect(() => {
    async function requestWakeLock() {
      try {
        if ('wakeLock' in navigator) {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        }
      } catch (err) {
        console.warn("Screen Wake Lock could not be obtained:", err);
      }
    }
    requestWakeLock();
    return () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release().then(() => {
          wakeLockRef.current = null;
        }).catch(() => {});
      }
    };
  }, []);

  // Retrieve or initialize the session progress from localStorage (Tab-close protection)
  useEffect(() => {
    const key = `urge_surfing_5min_end_time_${habitId || 'general'}`;
    const savedEndTime = localStorage.getItem(key);
    const now = Date.now();
    let initialSeconds = 5 * 60; // 300 seconds

    if (savedEndTime) {
      const remaining = Math.round((parseInt(savedEndTime, 10) - now) / 1000);
      if (remaining > 0 && remaining <= 5 * 60) {
        initialSeconds = remaining;
      } else {
        const newEndTime = now + 5 * 60 * 1000;
        localStorage.setItem(key, newEndTime.toString());
      }
    } else {
      const newEndTime = now + 5 * 60 * 1000;
      localStorage.setItem(key, newEndTime.toString());
    }

    setTimeLeft(initialSeconds);
  }, [habitId]);

  // Main countdown scheduler
  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0 || isInfiniteMode || isEncruzilhada) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev === null) return null;
        if (prev === 1) {
          // Congelamento Empático: se está no último segundo da Fase 3 e o usuário começou a digitar mas não salvou, congele o tempo.
          if (ghostQuoteContent.trim().length > 0 && !reflectionSaved) {
            return 1;
          }
        }
        if (prev <= 1) {
          clearInterval(timer);
          const key = `urge_surfing_5min_end_time_${habitId || 'general'}`;
          localStorage.removeItem(key);
          setIsEncruzilhada(true); // Enters decision checkpoint
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, isInfiniteMode, isEncruzilhada, habitId, ghostQuoteContent, reflectionSaved]);

  // Infinite mode counting sequence logic (Count up elapsed seconds)
  useEffect(() => {
    if (!isInfiniteMode) return;

    const timer = setInterval(() => {
      setInfiniteSeconds(prev => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [isInfiniteMode]);

  // EMDR Random Acceleration logic
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    let finishTimeoutId: NodeJS.Timeout;
    
    const scheduleNextAcceleration = () => {
      // O gatilho aleatório dispara entre 15s e 25s (15000ms and 25000ms)
      const randomDelay = Math.floor(Math.random() * 10001) + 15000;
      
      timeoutId = setTimeout(() => {
        setIsAccelerated(true);
        // O Pico Abrupto dura exatos 3.5 segundos (3500ms) antes de frear
        finishTimeoutId = setTimeout(() => {
          setIsAccelerated(false);
          scheduleNextAcceleration();
        }, 3500);
      }, randomDelay);
    };

    scheduleNextAcceleration();

    return () => {
      clearTimeout(timeoutId);
      clearTimeout(finishTimeoutId);
    };
  }, []);

  // Headphones notification banner fading control (Fades out after 10s)
  useEffect(() => {
    const alertTimer = setTimeout(() => {
      setShowHeadphonesAlert(false);
    }, 10000);
    return () => clearTimeout(alertTimer);
  }, []);

  // Compute chronologically secure steps (State Machine render blocks)
  // Phase 0: Opening / Absorção Inicial (First millisecond checks)
  // Phase 1: Freio Vagal (05:00 down to 03:30; 300 to 210 seconds remaining)
  // Phase 2: A Viajante / EMDR (03:30 to 01:30; 210 to 90 seconds remaining)
  // Phase 3: Aterramento e Descarga (01:30 to 00:00; 90 to 1 seconds remaining)
  // Phase 4: A Encruzilhada (Decision Checkpoint, reached 00:00)
  // Phase 5: Modo Infinito (Loop do Leão countdown extension)
  const currentPhase = useMemo(() => {
    if (isInfiniteMode) return 5;
    if (isEncruzilhada) return 4;
    if (timeLeft === null) return -1; 
    if (timeLeft > 290) return 0;     // NOVO: 300s a 290s (Abertura Empática - 10 segundos)
    if (timeLeft > 210) return 1;     // 290s a 210s (Respiração Lótus)
    if (timeLeft > 90) return 2;      // 210s a 90s (EMDR)
    if (timeLeft > 0) return 3;       // 90s a 0s (Theta/Escrita)
    return 4;
  }, [timeLeft, isInfiniteMode, isEncruzilhada]);

  const infiniteAct = useMemo(() => {
    if (infiniteSeconds <= 7) return 1;
    if (infiniteSeconds <= 89) return 2;
    if (infiniteSeconds <= 95) return 3;
    return 4;
  }, [infiniteSeconds]);

  // Invisible counter for Phase 3 Nudge (300 seconds)
  useEffect(() => {
    if (currentPhase !== 3 || reflectionSaved) {
      setPhase3Seconds(0);
      return;
    }

    const timer = setInterval(() => {
      setPhase3Seconds(prev => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [currentPhase, reflectionSaved]);

  // Audio stream setup based on clinical phases and audio settings
  useEffect(() => {
    if (!synthRef.current) {
      synthRef.current = new AudioSynthesizer();
    }

    const synth = synthRef.current;

    if (isAudioEnabled) {
      if (currentPhase === 2) {
        // Solfeggio 528Hz (Cellular cellular resonance & neural stress relief)
        synth.start(528, 0, 1.0);
      } else if (currentPhase === 3) {
        // Deep Theta 7.5Hz Binaural (150Hz left carrier, 7.5Hz separation)
        // GainNode boosted with a highly robust 4.5x multiplier to keep infra-wave present
        synth.start(150, 7.5, 4.5);
      } else if (currentPhase === 5) {
        // Loop Total: 840 Segundos (14 minutos)
        const cycleTime = infiniteSeconds % 840;
        
        if (cycleTime < 180) {
          // 0 a 3 min: 432 Hz - Aterramento Emocional
          synth.start(432, 0, 1.0);
        } else if (cycleTime < 360) {
          // 3 a 6 min: 174 Hz - Alívio Físico
          synth.start(174, 0, 1.2);
        } else if (cycleTime < 540) {
          // 6 a 9 min: 40 Hz - Foco Gamma
          synth.start(40, 0, 9.5);
        } else {
          // 9 a 14 min (Duração estendida de 5 min): 888 Hz Binaural - Abundância & Flow
          synth.start(888, 8, 1.5);
        }
      } else {
        synth.stop();
      }
    } else {
      synth.stop();
    }

    return () => {
      synth.stop();
    };
  }, [currentPhase, isAudioEnabled, infiniteSeconds]);

  // Inhalation/Exhalation breathing guidance sequence (11s cycle duration)
  const breathingState = useMemo(() => {
    // Determine target remaining seconds based on countdown or accumulation values
    const sourceSecs = isInfiniteMode ? infiniteSeconds : (timeLeft || 0);
    const cycle = sourceSecs % 11;

    if (cycle >= 7) {
      // Inhale deeply (4s)
      const count = Math.ceil(cycle - 7);
      return { 
        phase: 'inhale', 
        text: 'Inspire profundamente...', 
        countText: `${count}` 
      };
    } else if (cycle >= 5.5) {
      // Hold suspension (1.5s)
      return { 
        phase: 'hold', 
        text: 'Segure o ar...', 
        countText: 'Retenha' 
      };
    } else {
      // Exhale slowly (5.5s)
      const count = Math.ceil(cycle);
      return { 
        phase: 'exhale', 
        text: 'Exale devagar...', 
        countText: `${count}` 
      };
    }
  }, [timeLeft, isInfiniteMode, infiniteSeconds]);

  // SVG progressive ring stroke coefficients
  const timerCircleProps = useMemo(() => {
    const radius = 64;
    const strokeWidth = 5;
    const circumference = 2 * Math.PI * radius; // Approx 402.12
    const totalDuration = 5 * 60; // 300s
    const elapsed = totalDuration - (timeLeft || 0);
    const progressRatio = elapsed / totalDuration;
    const strokeDashoffset = circumference * (1 - progressRatio);

    return {
      radius,
      strokeWidth,
      circumference,
      strokeDashoffset,
    };
  }, [timeLeft]);

  // Triggers immediate database persistence insert & reactive state synchronization
  const saveReflection = async () => {
    if (!profile?.id) {
      dataStore.showNotification('Conecte-se para salvar os registros.', 'error');
      return;
    }

    setSaveStatus('saving');
    try {
      const timestamp = new Date().toISOString();
      const totalSecondsActive = isInfiniteMode ? (300 + infiniteSeconds) : (300 - (timeLeft || 0));
      
      const currentText = isInfiniteMode ? infiniteNote.trim() : ghostQuoteContent.trim();
      const defaultPlaceholder = 'Resisti com a Sessão Profunda Guiada.';
      const rawText = currentText || defaultPlaceholder;

      // Concatenate content if we have already saved during this session
      let mergedText = rawText;
      if (lastSavedCheckinIdRef.current && lastSavedTextRef.current) {
        if (rawText && rawText !== lastSavedTextRef.current && rawText !== defaultPlaceholder) {
          mergedText = `${lastSavedTextRef.current} | ${rawText}`;
        } else {
          mergedText = lastSavedTextRef.current;
        }
      }

      if (lastSavedCheckinIdRef.current) {
        // If already saved, perform an atomic UPDATE on the same record
        const updateData = {
          status: 'resisti',
          intensity: 5,
          trigger_note: `[SESSÃO PROFUNDA GUIADA] ${mergedText}`,
          time_spent: totalSecondsActive
        };
        const success = await dataStore.updateAvoidanceCheckin(lastSavedCheckinIdRef.current, updateData);
        if (success) {
          lastSavedTextRef.current = mergedText;
          await dataStore.fetchAvoidanceCheckins(profile.id);
          setSaveStatus('saved');
          setReflectionSaved(true);
          dataStore.showNotification('Reflexão atualizada com sucesso ✓', 'success');
        } else {
          setSaveStatus('error');
          dataStore.showNotification('Erro ao atualizar registro no banco.', 'error');
        }
      } else {
        // First-time save (Insert payload cleanly)
        const checkinData: any = {
          user_id: profile.id,
          habit_id: habitId || 'Crise Geral',
          checkin_date: getLocalDateString(),
          checkin_period: 'window',
          status: 'resisti',
          intensity: 5,
          trigger_tag: 'SESSÃO PROFUNDA GUIADA',
          trigger_note: `[SESSÃO PROFUNDA GUIADA] ${mergedText}`,
          created_at: timestamp,
          time_spent: totalSecondsActive
        };

        const created = await dataStore.addAvoidanceCheckin(checkinData);

        if (created) {
          lastSavedCheckinIdRef.current = created.id;
          lastSavedTextRef.current = mergedText;
          await dataStore.fetchAvoidanceCheckins(profile.id);
          setSaveStatus('saved');
          setReflectionSaved(true);
          dataStore.showNotification('Reflexão armazenada com sucesso ✓', 'success');

          // Descongelar Fase 3: Se o usuário estiver congelado no último segundo da Fase 3, avança automaticamente
          if (timeLeft === 1) {
            setTimeLeft(0);
            setIsEncruzilhada(true);
          }
        } else {
          setSaveStatus('error');
          dataStore.showNotification('Erro ao salvar no banco de dados.', 'error');
        }
      }
    } catch (e) {
      console.error("Supabase transaction error:", e);
      setSaveStatus('error');
      dataStore.showNotification('Erro de rede ao salvar reflexão.', 'error');
    }
  };

  const handleCancel = () => {
    const key = `urge_surfing_5min_end_time_${habitId || 'general'}`;
    localStorage.removeItem(key);
    onClose();
  };

  const formatMinSec = (secs: number) => {
    const mm = Math.floor(secs / 60);
    const ss = secs % 60;
    return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  };

  // Skip phases helper for grading validation
  const skipToPhase = (phase: number) => {
    setIsInfiniteMode(false);
    setIsEncruzilhada(false);

    if (phase === 0) setTimeLeft(5 * 60);
    else if (phase === 1) setTimeLeft(4 * 60 + 50); // 290s
    else if (phase === 2) setTimeLeft(3 * 60 + 10); // 190s
    else if (phase === 3) setTimeLeft(1 * 60 + 20); // 80s
    else if (phase === 4) {
      setTimeLeft(0);
      setIsEncruzilhada(true);
    } else if (phase === 5) {
      setIsInfiniteMode(true);
      setInfiniteSeconds(1);
    }
  };

  // Dynamic mapped frequency for the Apple Glassmorphic Card
  const currentInfiniteFrequencyCardText = useMemo(() => {
    if (!isInfiniteMode) return '';
    const cycleTime = infiniteSeconds % 840;
    if (cycleTime < 180) {
      return '📻 432 hertz - Frequência do Aterramento';
    } else if (cycleTime < 360) {
      return '📻 174 hertz - Frequência do Alívio';
    } else if (cycleTime < 540) {
      return '📻 40 hertz - Frequência do Foco';
    } else {
      return '📻 888 hertz - Frequência da Prosperidade';
    }
  }, [isInfiniteMode, infiniteSeconds]);

  // Audio frequency tag name under infinite mode looping
  const currentInfiniteFrequencyTag = useMemo(() => {
    if (!isInfiniteMode) return '';
    const cycleTime = infiniteSeconds % 840;
    if (cycleTime < 180) {
      return '432 Hz · Aterramento Cósmico';
    } else if (cycleTime < 360) {
      return '174 Hz · Alívio Biológico';
    } else if (cycleTime < 540) {
      return '40 Hz · Ondas Foco Gamma (Pense e Foque)';
    } else {
      return '888 Hz · Abundância & Flow (Binaural Theta)';
    }
  }, [isInfiniteMode, infiniteSeconds]);

  // Construct UI payload using safe standard portal injection
  return createPortal(
    <div 
      id="urge_surfing_portal_screen"
      style={{ isolation: 'isolate' }}
      className="fixed inset-0 w-full h-full bg-[#030303] text-white z-[9999] flex flex-col justify-between p-6 md:p-12 overflow-hidden select-none outline-none font-sans"
    >
      {/* Absolute discretely elegant close escaper (Apple Mindfulness visual cues) */}
      <button 
        id="sos_esc_button"
        onClick={handleCancel}
        className="absolute top-6 right-6 text-white/20 hover:text-white/80 hover:scale-105 active:scale-95 transition-all p-3 rounded-full hover:bg-white/5 z-[10000] cursor-pointer"
        aria-label="Encerrar Resgate"
      >
        <X size={22} />
      </button>

      {/* Symmetrical audio mute button placed elegantly in top-left to replace clutter */}
      <div className="absolute top-6 left-6 z-[10000]">
        <button
          onClick={() => setIsAudioEnabled(!isAudioEnabled)}
          className={`p-3 rounded-xl transition-all text-xs flex items-center gap-2 hover:bg-white/5 ${
            isAudioEnabled 
              ? 'text-purple-400 hover:text-purple-300' 
              : 'text-white/30 hover:text-white/50'
          }`}
        >
          {isAudioEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
          <span className="text-[9px] uppercase tracking-[0.18em] font-mono font-bold select-none hidden sm:inline">
            {isAudioEnabled ? 'SONS ATIVOS' : 'MUTADO'}
          </span>
        </button>
      </div>

      {/* Hidden tester phase skips - Hover revealed at bottom-left corner to keep top pristine */}
      <div className="absolute bottom-6 left-6 z-[10000] flex items-center gap-1 bg-white/[0.01] hover:bg-white/[0.04] px-2 py-1 rounded-xl opacity-0 hover:opacity-100 transition-opacity duration-300">
        {[0, 1, 2, 3, 4, 5].map(p => (
          <button 
            key={p} 
            onClick={() => skipToPhase(p)}
            className="w-5 h-5 text-[9px] font-mono rounded-lg flex items-center justify-center transition-all cursor-pointer text-white/30 hover:bg-white/20 hover:text-white"
          >
            {p}
          </button>
        ))}
      </div>

      {/* Main active stage content area */}
      <div className="flex-1 w-full flex flex-col items-center justify-center relative py-6 max-w-2xl mx-auto space-y-6">
        
        {/* TIMER APPLE-RING: Circular countdown indicator at center-top */}
        {currentPhase <= 3 && (
          <div className="relative w-36 h-36 flex items-center justify-center shrink-0">
            <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 144 144">
              <circle
                cx="72"
                cy="72"
                r={timerCircleProps.radius}
                className="text-purple-500/10"
                strokeWidth={timerCircleProps.strokeWidth}
                stroke="currentColor"
                fill="transparent"
              />
              <circle
                cx="72"
                cy="72"
                r={timerCircleProps.radius}
                className="text-purple-500"
                strokeWidth={timerCircleProps.strokeWidth}
                strokeDasharray={timerCircleProps.circumference}
                strokeDashoffset={timerCircleProps.strokeDashoffset}
                strokeLinecap="round"
                stroke="#A855F7"
                fill="transparent"
                style={{ transition: 'stroke-dashoffset 1s linear' }}
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-2xl font-mono font-extrabold text-white tracking-tighter">
                {formatMinSec(timeLeft || 0)}
              </span>
              <span className="text-[8px] font-black text-white/30 uppercase tracking-[0.2em] font-mono mt-0.5">
                TIMER S.O.S.
              </span>
            </div>
          </div>
        )}

        {/* INFINITE MODE COUNTER: Minimalist upward ring */}
        {currentPhase === 5 && (
          <div className="relative w-36 h-36 flex items-center justify-center shrink-0">
            <div className="absolute inset-0 rounded-full bg-emerald-500/5 border border-emerald-500/10 animate-pulse blur-sm" />
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-3xl font-mono font-black text-emerald-400 tracking-tighter">
                {formatMinSec(infiniteSeconds)}
              </span>
              <span className="text-[7.5px] font-black text-emerald-500/55 uppercase tracking-[0.2em] font-mono mt-1">
                MODO INFINITO
              </span>
            </div>
          </div>
        )}

        {/* MUTUALLY EXCLUSIVE SCENE RENDER CHANNELS */}
        <div className="w-full flex-1 flex flex-col justify-center items-center relative min-h-[340px]">
          <AnimatePresence mode="wait">
            
            {/* FASE 0: ABERTURA EMPÁTICA (5 Segundos) */}
            {currentPhase === 0 && (
              <motion.div 
                key="phase-0"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 1.0, ease: "easeOut" }}
                className="flex flex-col items-center justify-center space-y-8 text-center max-w-xl px-6"
              >
                <h2 className="text-2xl md:text-3xl font-light text-white/95 leading-relaxed tracking-wide">
                  "Você não está sozinho. A DUDE assumiu o controle. Apenas siga o guia."
                </h2>
                <div className="h-[1px] w-12 bg-white/10" />
                <span className="text-[10px] text-white/35 tracking-[0.3em] font-mono uppercase">
                  Fase 0 · Absorção Inicial
                </span>
              </motion.div>
            )}

            {/* FASE 1: FREIO VAGAL (Breath control loops with Apple Lotus Waves) */}
            {currentPhase === 1 && (
              <motion.div 
                key="phase-1"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.0 }}
                className="flex flex-col items-center justify-center space-y-12"
              >
                {/* 4x Layered concentric expanding lotus circles */}
                <div className="relative w-40 h-40 flex items-center justify-center">
                  {/* Camada 1 (Externa): bg-emerald-500/10 */}
                  <motion.div
                    animate={{
                      scale: breathingState.phase === 'inhale' ? 2.8 : breathingState.phase === 'hold' ? 2.9 : 1.0,
                    }}
                    transition={{
                      duration: breathingState.phase === 'inhale' ? 4.0 : breathingState.phase === 'hold' ? 1.5 : 5.5,
                      ease: "easeInOut"
                    }}
                    className="absolute w-40 h-40 rounded-full bg-emerald-500/10"
                  />
                  {/* Camada 2: bg-emerald-500/20 */}
                  <motion.div
                    animate={{
                      scale: breathingState.phase === 'inhale' ? 2.2 : breathingState.phase === 'hold' ? 2.3 : 1.0,
                    }}
                    transition={{
                      duration: breathingState.phase === 'inhale' ? 4.0 : breathingState.phase === 'hold' ? 1.5 : 5.5,
                      ease: "easeInOut"
                    }}
                    className="absolute w-40 h-40 rounded-full bg-emerald-500/20"
                  />
                  {/* Camada 3: bg-emerald-500/30 */}
                  <motion.div
                    animate={{
                      scale: breathingState.phase === 'inhale' ? 1.6 : breathingState.phase === 'hold' ? 1.7 : 1.0,
                    }}
                    transition={{
                      duration: breathingState.phase === 'inhale' ? 4.0 : breathingState.phase === 'hold' ? 1.5 : 5.5,
                      ease: "easeInOut"
                    }}
                    className="absolute w-40 h-40 rounded-full bg-emerald-500/30"
                  />
                  {/* Camada 4 (Núcleo): bg-emerald-400 com leve glow */}
                  <motion.div
                    animate={{
                      scale: breathingState.phase === 'inhale' ? 1.2 : breathingState.phase === 'hold' ? 1.25 : 1.0,
                    }}
                    transition={{
                      duration: breathingState.phase === 'inhale' ? 4.0 : breathingState.phase === 'hold' ? 1.5 : 5.5,
                      ease: "easeInOut"
                    }}
                    className="absolute w-40 h-40 rounded-full bg-emerald-400 shadow-[0_0_30px_rgba(52,211,153,0.4)]"
                  />
                </div>

                {/* Breathing status instructions */}
                <div className="text-center space-y-3">
                  <span className="text-xl font-light tracking-wide text-white block">
                    {breathingState.text}
                  </span>
                  
                  {/* Monospace ghost counter helping guide user lungs flow */}
                  <span className="text-4xl font-mono font-extrabold text-white/40 block leading-none tracking-tighter">
                    {breathingState.countText}
                  </span>
                </div>
              </motion.div>
            )}

            {/* FASE 2: A VIAJANTE (EMDR - Cinematic Choreography) */}
            {currentPhase === 2 && (
              <motion.div 
                key="phase-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.0 }}
                className="w-full h-full absolute inset-0 pointer-events-none flex items-center justify-center overflow-visible"
              >
                {/* Texto Empático: Fica no centro por 6s, depois desce */}
                <motion.div
                  initial={{ y: "-5vh", opacity: 0 }}
                  animate={{ 
                    y: ["-5vh", "-5vh", "25vh"], 
                    opacity: [0, 1, 1, 1] 
                  }}
                  transition={{ 
                    duration: 7.5, 
                    times: [0, 0.1, 0.8, 1], // Aparece rápido (10%), fica parado até 80% (6s), desce no final
                    ease: "easeInOut" 
                  }}
                  className="absolute text-center space-y-1.5 z-40 px-4 w-full"
                >
                  <span className="text-lg font-light tracking-wide text-white/95 leading-none block drop-shadow-lg">
                    Acompanhe a luz com o olhar.
                  </span>
                  <p className="text-[10px] text-white/20 tracking-[0.2em] font-mono uppercase">
                    Deslocando a atenção cognitiva para dissolver a fissura
                  </p>
                </motion.div>

                {/* A Bolinha Livre: Nasce no centro aos 6.5s e depois viaja em Lissajous Mirror */}
                <motion.div
                  initial={{ opacity: 0, scale: 0, x: '0vw', y: '0vh' }}
                  animate={{ 
                    opacity: 1,
                    scale: 1,
                    x: ['-42vw', '42vw'], 
                    y: ['-35vh', '35vh'] 
                  }}
                  transition={{ 
                    opacity: { delay: 6.5, duration: 1 },
                    scale: { delay: 6.5, duration: 1, ease: "easeOut" },
                    x: { delay: 7.5, duration: 17, ease: "easeInOut", repeat: Infinity, repeatType: "mirror" },
                    y: { delay: 7.5, duration: 23, ease: "easeInOut", repeat: Infinity, repeatType: "mirror" }
                  }}
                  className="absolute w-6 h-6 rounded-full bg-[#10b981] shadow-[0_0_30px_12px_rgba(16,185,129,0.95),0_0_70px_25px_rgba(16,185,129,0.65),0_0_120px_45px_rgba(16,185,129,0.4)] z-[99999] pointer-events-none"
                />
              </motion.div>
            )}

            {/* FASE 3: ATERRAMENTO & DESCARGA COGNITIVA */}
            {currentPhase === 3 && (
              <motion.div 
                key="phase-3"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.0 }}
                className="w-full max-w-lg flex flex-col items-center space-y-6 px-4"
              >
                {/* Centralized grounding guide representation */}
                <div className="relative w-16 h-16 flex items-center justify-center">
                  <div className="absolute w-8 h-8 rounded-full bg-emerald-500/10 animate-ping" />
                  <div className="w-3.5 h-3.5 rounded-full bg-emerald-400 shadow-[0_0_20px_10px_#10b981,0_0_50px_20px_#10b981] animate-pulse" />
                </div>

                {/* Cognitive Discharge Panel */}
                <div className="w-full flex flex-col space-y-4">
                  <span className="text-xs text-white/70 font-light leading-relaxed text-center block max-w-md mx-auto">
                    Esvazie sua mente, descreva o que sente agora. (Anotar é opcional, apenas respire e sinta a frequência)
                  </span>

                  <div className="relative w-full">
                     {!reflectionSaved ? (
                      <div className="space-y-4">
                        <textarea
                          id="sos_reflection_textarea"
                          value={ghostQuoteContent}
                          onChange={(e) => setGhostQuoteContent(e.target.value)}
                          placeholder="Digite sem filtros, o bloco de escrita cresce elasticamente conforme sua escrita flui..."
                          className="w-full min-h-[140px] bg-white/[0.03] border-none text-white/95 text-sm font-light rounded-2xl p-5 focus:outline-none placeholder-white/20 leading-relaxed shadow-inner focus:bg-white/[0.05] transition-all resize-none overflow-hidden"
                          style={{ height: 'auto' }}
                          onInput={(e) => {
                            const target = e.target as HTMLTextAreaElement;
                            target.style.height = 'auto';
                            target.style.height = `${target.scrollHeight}px`;
                          }}
                        />
                        <button
                          id="sos_submit_reflection_btn"
                          onClick={saveReflection}
                          disabled={saveStatus === 'saving'}
                          className="w-full py-4 px-6 rounded-2xl bg-emerald-400 hover:bg-emerald-500 text-black font-extrabold text-xs uppercase tracking-[0.2em] transition-all cursor-pointer shadow-[0_0_30px_rgba(16,185,129,0.25)] flex items-center justify-center gap-2"
                        >
                          {saveStatus === 'saving' ? (
                            <>
                              <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                              <span>Sincronizando Banco de Dados...</span>
                            </>
                          ) : (
                            <>
                              <Send size={14} />
                              <span>GUARDAR REFLEXÃO</span>
                            </>
                          )}
                        </button>
                      </div>
                    ) : (
                      <motion.div
                        id="sos_save_confirmation"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5 }}
                        className="py-6 px-8 bg-emerald-500/5 border border-emerald-500/15 rounded-3xl text-center space-y-2 max-w-sm mx-auto shadow-xl"
                      >
                        <span className="text-xs text-emerald-400 font-bold flex items-center justify-center gap-1.5 uppercase tracking-widest leading-none">
                          <ShieldCheck size={16} /> Registro de campo salvo ✓
                        </span>
                        <p className="text-[11px] text-white/40 leading-relaxed">
                          Sua reflexão foi gravada com segurança no banco de dados e sincronizada reativamente de forma imediata.
                        </p>
                      </motion.div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* FASE 4: A ENCRUZILHADA DECISION CHECKPOINT */}
            {currentPhase === 4 && (
              <motion.div 
                key="phase-4"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 1.0 }}
                className="flex flex-col items-center justify-center space-y-10 text-center max-w-sm px-6"
              >
                <div className="space-y-3">
                  <h3 className="text-2xl font-light tracking-wide text-white leading-relaxed">
                    "O tempo passou. Como está a sua mente agora?"
                  </h3>
                  <div className="h-[1px] w-12 bg-white/10 mx-auto" />
                  <span className="text-[10px] text-white/35 tracking-[0.25em] font-mono uppercase block">
                    Decisão Consciente
                  </span>
                </div>

                <div className="w-full space-y-4">
                  {/* Estou em paz (Close and complete successfully) */}
                  <button
                    id="sos_peace_button"
                    onClick={handleCancel}
                    className="w-full py-4 px-6 rounded-2xl bg-white/[0.04] backdrop-blur-md border border-white/10 hover:bg-white/[0.08] text-white font-extrabold text-xs uppercase tracking-[0.2em] transition-all cursor-pointer shadow-xl flex items-center justify-center gap-2"
                  >
                    <ShieldCheck size={15} className="text-emerald-400" />
                    <span>Estou em paz.</span>
                  </button>

                  {/* Preciso de mais tempo (Turns on Infinite Mode Loop do Leão) */}
                  <button
                    id="sos_infinite_button"
                    onClick={() => {
                      setIsEncruzilhada(false);
                      setIsInfiniteMode(true);
                      setInfiniteSeconds(1);
                    }}
                    className="w-full py-4 px-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 hover:bg-emerald-500/15 text-emerald-300 font-extrabold text-xs uppercase tracking-[0.2em] transition-all cursor-pointer shadow-[0_0_20px_rgba(16,185,129,0.15)] flex items-center justify-center gap-2"
                  >
                    <Sparkles size={15} />
                    <span>Preciso de mais tempo.</span>
                  </button>
                </div>
              </motion.div>
            )}

            {/* FASE 5: MODO INFINITO (Loop do Leão countdown extension with three acts) */}
            {currentPhase === 5 && (
              <motion.div 
                key="phase-5"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.0 }}
                className="w-full h-full absolute inset-0 flex flex-col justify-center items-center overflow-visible"
              >
                {/* ATO 1: Totalmente minimalista (De 0 a 7 segundos) */}
                {infiniteAct === 1 && (
                  <motion.div 
                    key="infinite-act-1"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1.0 }}
                    className="text-center px-6 max-w-lg mx-auto"
                  >
                    <p className="text-lg md:text-xl font-light tracking-wide text-white/95 leading-relaxed">
                      "Está tudo bem, se acalme, se quiser faça mais alguns ciclos de respiração guiada. O que verdadeiramente importa agora é: escute o som das frequências."
                    </p>
                  </motion.div>
                )}

                {/* ATO 2: Respirador Lótus (De 8 a 89 segundos) */}
                {infiniteAct === 2 && (
                  <motion.div 
                    key="infinite-act-2"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1.0 }}
                    className="flex flex-col items-center justify-center space-y-12"
                  >
                    {/* 4x layers of pulsing Lótus representation in Purple/Indigo */}
                    <div className="relative w-40 h-40 flex items-center justify-center">
                      {/* Camada 1: bg-purple-500/10 */}
                      <motion.div
                        animate={{
                          scale: breathingState.phase === 'inhale' ? 2.8 : breathingState.phase === 'hold' ? 2.9 : 1.0,
                        }}
                        transition={{
                          duration: breathingState.phase === 'inhale' ? 4.0 : breathingState.phase === 'hold' ? 1.5 : 5.5,
                          ease: "easeInOut"
                        }}
                        className="absolute w-40 h-40 rounded-full bg-purple-500/10"
                      />
                      {/* Camada 2: bg-purple-500/20 */}
                      <motion.div
                        animate={{
                          scale: breathingState.phase === 'inhale' ? 2.2 : breathingState.phase === 'hold' ? 2.3 : 1.0,
                        }}
                        transition={{
                          duration: breathingState.phase === 'inhale' ? 4.0 : breathingState.phase === 'hold' ? 1.5 : 5.5,
                          ease: "easeInOut"
                        }}
                        className="absolute w-40 h-40 rounded-full bg-purple-500/20"
                      />
                      {/* Camada 3: bg-indigo-500/30 */}
                      <motion.div
                        animate={{
                          scale: breathingState.phase === 'inhale' ? 1.6 : breathingState.phase === 'hold' ? 1.7 : 1.0,
                        }}
                        transition={{
                          duration: breathingState.phase === 'inhale' ? 4.0 : breathingState.phase === 'hold' ? 1.5 : 5.5,
                          ease: "easeInOut"
                        }}
                        className="absolute w-40 h-40 rounded-full bg-indigo-500/30"
                      />
                      {/* Camada 4: bg-gradient-to-tr from-purple-500 to-indigo-500 with slight glow */}
                      <motion.div
                        animate={{
                          scale: breathingState.phase === 'inhale' ? 1.2 : breathingState.phase === 'hold' ? 1.25 : 1.0,
                        }}
                        transition={{
                          duration: breathingState.phase === 'inhale' ? 4.0 : breathingState.phase === 'hold' ? 1.5 : 5.5,
                          ease: "easeInOut"
                        }}
                        className="absolute w-40 h-40 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-500 shadow-[0_0_30px_rgba(168,85,247,0.5)]"
                      />
                    </div>

                    {/* Loop breathing guidance details */}
                    <div className="text-center space-y-3 px-4 max-w-lg mt-6">
                      <span className="text-xs uppercase tracking-[0.25em] font-mono text-white/50 block">
                        Modo Extensão Loop do Leão
                      </span>
                      
                      <span className="text-sm font-light tracking-wide text-white block leading-relaxed">
                        "Está tudo bem, se acalme, se quiser faça mais alguns ciclos de respiração guiada. O que verdadeiramente importa agora é: escute o som das frequências."
                      </span>
                      
                      <span className="text-3xl font-mono font-extrabold text-white/30 block leading-none tracking-tighter">
                        {breathingState.countText}
                      </span>

                      {/* Active Loop details */}
                      <div className="inline-flex items-center gap-2 bg-white/[0.03] border border-white/10 px-4 py-2 rounded-full mt-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                        <span className="text-[9px] font-mono font-bold tracking-widest text-[#a855f7] uppercase">
                          {currentInfiniteFrequencyTag}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* ATO 3: Mensagem Transicional Central (De 90 a 95 segundos) */}
                {infiniteAct === 3 && (
                  <motion.div 
                    key="infinite-act-3"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.8 }}
                    className="text-center space-y-4 px-6 max-w-md"
                  >
                    <p className="text-xl md:text-2xl font-light tracking-wide text-white leading-relaxed">
                      "Agora, acompanhe a bolinha até a mente se acalmar. Se quiser registrar algo agora, escreva."
                    </p>
                    <div className="h-[1px] w-12 bg-white/10 mx-auto" />
                    <span className="text-[10px] text-white/35 tracking-[0.2em] font-mono uppercase block">
                      Preparando campo perceptual...
                    </span>
                  </motion.div>
                )}

                {/* ATO 4: Modo Foco Ativo (A partir de 96 segundos) */}
                {infiniteAct === 4 && (
                  <motion.div 
                    key="infinite-act-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="w-full flex flex-col items-center justify-center space-y-8 px-4"
                  >
                    {/* Texto Empático: Fixado no rodapé absoluto da tela, blindado contra esmagamento */}
                    <div className="absolute bottom-8 left-0 right-0 px-6 text-center z-40 pointer-events-none">
                      <p className="text-xs font-light tracking-wide text-white/60 leading-relaxed">
                        "Agora, acompanhe a bolinha até a mente se acalmar. Se quiser registrar algo agora, escreva."
                      </p>
                      <span className="text-[8px] text-[#10b981]/50 tracking-[0.2em] font-mono uppercase block mt-0.5">
                        Espaço de Resgate Perceptual Ativo
                      </span>
                    </div>
 
                    {/* Elegant translucent text input workspace */}
                    <div className="relative w-full max-w-md z-40 space-y-4">
                      <textarea
                        id="sos_infinite_reflection_textarea"
                        value={infiniteNote}
                        onChange={(e) => setInfiniteNote(e.target.value)}
                        placeholder="Digite sem pressa, solte o fluxo de consciência..."
                        className="w-full min-h-[140px] bg-white/[0.03] border border-white/5 hover:border-white/10 focus:border-[#10b981]/30 focus:outline-none text-white/95 text-sm font-light rounded-2xl p-5 leading-relaxed shadow-inner focus:bg-white/[0.05] transition-all resize-none overflow-hidden"
                        style={{ height: 'auto' }}
                        onInput={(e) => {
                          const target = e.target as HTMLTextAreaElement;
                          target.style.height = 'auto';
                          target.style.height = `${target.scrollHeight}px`;
                        }}
                      />

                      <div className="flex flex-col gap-3">
                        <button
                          id="sos_infinite_submit_reflection_btn"
                          onClick={saveReflection}
                          disabled={saveStatus === 'saving'}
                          className="w-full py-4 px-6 rounded-2xl bg-emerald-400 hover:bg-emerald-500 text-black font-extrabold text-[11px] uppercase tracking-[0.2em] transition-all cursor-pointer shadow-[0_0_30px_rgba(16,185,129,0.25)] flex items-center justify-center gap-2"
                        >
                          {saveStatus === 'saving' ? (
                            <>
                              <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                              <span>Sincronizando...</span>
                            </>
                          ) : (
                            <>
                              <Send size={13} />
                              <span>GUARDAR REFLEXÃO</span>
                            </>
                          )}
                        </button>

                        {/* CARD DE FREQUÊNCIA PREMIUM (Glassmorphism Apple-style) */}
                        <div className="mt-1 px-5 py-2.5 bg-white/5 backdrop-blur-md border border-white/10 rounded-full flex items-center justify-center text-xs tracking-wide text-white/90 select-none shadow-md">
                          <span className="font-mono font-medium">{currentInfiniteFrequencyCardText}</span>
                        </div>

                        <button
                          id="sos_infinite_finish_btn"
                          onClick={handleCancel}
                          className="w-full py-4 px-6 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] text-white/80 font-extrabold text-[11px] uppercase tracking-[0.2em] border border-white/10 transition-all cursor-pointer flex items-center justify-center gap-2"
                        >
                          <ShieldCheck size={14} className="text-emerald-400" />
                          <span>CONCLUIR SESSÃO</span>
                        </button>
                      </div>
                    </div>
 
                    {/* A Bolinha Soberana (em EMDR Loop) flutuando z-[99999] com aceleração estocástica contínua */}
                    <motion.div
                      animate={{ x: ['-42vw', '42vw'], y: ['-35vh', '35vh'] }}
                      transition={{ 
                        // Velocidade Base: 7s (X) e 9s (Y) | Velocidade do Pico: 1.2s (X) e 1.5s (Y)
                        x: { duration: isAccelerated ? 1.2 : 7, ease: "easeInOut", repeat: Infinity, repeatType: "mirror" },
                        y: { duration: isAccelerated ? 1.5 : 9, ease: "easeInOut", repeat: Infinity, repeatType: "mirror" }
                      }}
                      className="absolute w-6 h-6 rounded-full bg-[#10b981] shadow-[0_0_30px_12px_rgba(16,185,129,0.95),0_0_70px_25px_rgba(16,185,129,0.65),0_0_120px_45px_rgba(16,185,129,0.4)] z-[99999] pointer-events-none"
                    />
                  </motion.div>
                )}
              </motion.div>
            )}

          </AnimatePresence>
        </div>

      </div>

      {/* Dynamic island recommended headphones (Placed at top-[24vh] in high negative space) */}
      <AnimatePresence>
        {showHeadphonesAlert && (
          <motion.div 
            initial={{ opacity: 0, y: -15, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -15, scale: 0.95 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="absolute top-[24vh] left-1/2 -translate-x-1/2 bg-white/10 backdrop-blur-xl border border-white/20 px-6 py-3 rounded-full text-center z-[10010] shadow-2xl pointer-events-none w-[90%] max-w-sm"
          >
            <span className="text-xs text-white/90 tracking-wide font-medium block">
              🎧 Recomendamos fones de ouvido para imersão profunda
            </span>
          </motion.div>
        )}
      </AnimatePresence>
 
      {/* Nudge Fase 3 - Glassmorphism notification overspread */}
      <AnimatePresence>
        {currentPhase === 3 && phase3Seconds >= 300 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-md z-[10020] p-6"
          >
            <div className="bg-white/10 backdrop-blur-md border border-white/20 p-8 rounded-[32px] max-w-md text-center space-y-6 shadow-2xl relative">
              <p className="text-white text-base font-light leading-relaxed">
                "Você já externalizou bastante coisa. Salve este registro para libertar sua mente e darmos o próximo passo."
              </p>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => saveReflection()}
                  disabled={saveStatus === 'saving'}
                  className="w-full py-4 px-6 rounded-2xl bg-emerald-400 hover:bg-emerald-500 text-black font-extrabold text-xs uppercase tracking-[0.2em] transition-all cursor-pointer shadow-[0_0_30px_rgba(16,185,129,0.25)]"
                >
                  {saveStatus === 'saving' ? 'Salvando...' : 'GUARDAR REGISTRO'}
                </button>
                <button
                  onClick={() => setPhase3Seconds(0)}
                  className="text-white/40 hover:text-white/60 text-[10px] uppercase tracking-widest font-mono py-2"
                >
                  Continuar Escrevendo
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Nudge Fase 5 - Translucent card top-center on every multiple of 300 seconds for 15s */}
      <AnimatePresence>
        {currentPhase === 5 && isInfiniteMode && infiniteSeconds > 0 && (infiniteSeconds % 300 >= 0 && infiniteSeconds % 300 < 15) && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.5 }}
            className="absolute top-6 left-1/2 -translate-x-1/2 bg-white/10 backdrop-blur-lg border border-white/20 p-6 rounded-[24px] text-center z-[10015] shadow-2xl w-[90%] max-w-md"
          >
            <p className="text-white text-xs font-light leading-relaxed">
              "A crise foi contida e a mente está limpa. Salve seu registro, feche a sessão e volte a dominar suas tarefas. O mundo real te espera."
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom informational branding layout */}
      <div className="w-full shrink-0 flex flex-col items-center justify-end z-[9999]">
        {currentPhase <= 3 ? (
          <div className="flex flex-col items-center justify-center space-y-1">
            <span className="text-[9px] font-mono font-bold text-white/20 uppercase tracking-[0.3em]">
              Fase {currentPhase} integrada · DUDE Mindfulness
            </span>
          </div>
        ) : (
          <div className="h-4" />
        )}
      </div>

    </div>,
    document.body
  );
};
