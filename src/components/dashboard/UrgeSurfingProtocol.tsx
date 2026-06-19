import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Brain, Heart, ShieldCheck, Volume2, VolumeX, X, Sparkles } from 'lucide-react';
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

  start(frequency: number, binauralOffset: number = 0, volumeMultiplier: number = 1.0) {
    try {
      this.stop();
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      
      this.ctx = new AudioContextClass();
      this.gainNode = this.ctx.createGain();
      
      // Clinical acoustic balance: Fletcher-Munson Equal Loudness Equalization.
      // Humans perceive low-frequency carrier tones (150Hz) as significantly softer than mid-tones (528Hz).
      // Applying a designated volume multiplier adjusts the amplitude dynamically to sustain equal auditory body.
      const baseGain = 0.12; 
      this.gainNode.gain.setValueAtTime(baseGain * volumeMultiplier, this.ctx.currentTime);

      if (binauralOffset === 0) {
        // Solfeggio / Pure Mono wave
        this.oscLeft = this.ctx.createOscillator();
        this.oscLeft.type = 'sine';
        this.oscLeft.frequency.setValueAtTime(frequency, this.ctx.currentTime);
        this.oscLeft.connect(this.gainNode);
      } else {
        // Binaural Stimulation (Left Ear = Carrier, Right Ear = Carrier + Theta Delta Gap)
        const pannerLeft = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
        const pannerRight = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;

        this.oscLeft = this.ctx.createOscillator();
        this.oscLeft.type = 'sine';
        this.oscLeft.frequency.setValueAtTime(frequency, this.ctx.currentTime);

        this.oscRight = this.ctx.createOscillator();
        this.oscRight.type = 'sine';
        this.oscRight.frequency.setValueAtTime(frequency + binauralOffset, this.ctx.currentTime);

        if (pannerLeft && pannerRight) {
          pannerLeft.pan.setValueAtTime(-1, this.ctx.currentTime); // Hard left audio routing
          pannerRight.pan.setValueAtTime(1, this.ctx.currentTime); // Hard right audio routing
          
          this.oscLeft.connect(pannerLeft).connect(this.gainNode);
          this.oscRight.connect(pannerRight).connect(this.gainNode);
        } else {
          this.oscLeft.connect(this.gainNode);
          this.oscRight.connect(this.gainNode);
        }
      }

      this.gainNode.connect(this.ctx.destination);
      this.oscLeft.start();
      if (this.oscRight) this.oscRight.start();
    } catch (e) {
      console.warn("AudioContext initialization bypassed or blocked by browser gesture policies.", e);
    }
  }

  stop() {
    try {
      if (this.oscLeft) {
        this.oscLeft.stop();
        this.oscLeft.disconnect();
      }
      if (this.oscRight) {
        this.oscRight.stop();
        this.oscRight.disconnect();
      }
      if (this.gainNode) {
        this.gainNode.disconnect();
      }
      if (this.ctx && this.ctx.state !== 'closed') {
        this.ctx.close();
      }
    } catch (e) {}
    this.oscLeft = null;
    this.oscRight = null;
    this.gainNode = null;
    this.ctx = null;
  }
}

export const UrgeSurfingProtocol = ({ habitId, onClose }: UrgeSurfingProtocolProps) => {
  const dataStore = useDataStore();
  const { profile, habits } = dataStore;

  const currentHabit = habits.find(h => h.id === habitId);
  const habitName = currentHabit ? currentHabit.name : 'Crise Geral';

  // 15-minute S.O.S countdown (900 seconds)
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState<boolean>(true);
  const [ghostQuoteContent, setGhostQuoteContent] = useState<string>('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [reflectionSaved, setReflectionSaved] = useState<boolean>(false);
  const [showHeadphonesAlert, setShowHeadphonesAlert] = useState<boolean>(true);

  // Smooth floating travelers position (Simulates heavy fluid inertia movement)
  const [targetPos, setTargetPos] = useState({ x: 50, y: 50 });

  // Sound generator reference
  const synthRef = useRef<AudioSynthesizer | null>(null);

  // Retorno Silencioso (localStorage tracking): Resume countdown on tab-close / reload
  useEffect(() => {
    const key = `urge_surfing_end_time_${habitId || 'general'}`;
    const savedEndTime = localStorage.getItem(key);
    const now = Date.now();
    let initialSeconds = 15 * 60; // 900 seconds

    if (savedEndTime) {
      const remaining = Math.round((parseInt(savedEndTime, 10) - now) / 1000);
      if (remaining > 0 && remaining <= 15 * 60) {
        initialSeconds = remaining;
      } else {
        const newEndTime = now + 15 * 60 * 1000;
        localStorage.setItem(key, newEndTime.toString());
      }
    } else {
      const newEndTime = now + 15 * 60 * 1000;
      localStorage.setItem(key, newEndTime.toString());
    }

    setTimeLeft(initialSeconds);
  }, [habitId]);

  // Main countdown scheduler
  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          clearInterval(timer);
          const key = `urge_surfing_end_time_${habitId || 'general'}`;
          localStorage.removeItem(key);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, habitId]);

  // Headphones advice auto-fade (dismisses after 3 seconds)
  useEffect(() => {
    const alertTimer = setTimeout(() => {
      setShowHeadphonesAlert(false);
    }, 3200);
    return () => clearTimeout(alertTimer);
  }, []);

  // Update target coordinates for "A Viajante" (Brownian physics/Inertial motion)
  // Generates positions dynamically every 2.4 seconds to mimic natural drifts.
  useEffect(() => {
    const currentPhase = timeLeft === null ? 0 : timeLeft > 885 ? 0 : timeLeft > 780 ? 1 : timeLeft > 300 ? 2 : timeLeft > 0 ? 3 : 4;
    if (currentPhase !== 1) return;

    const interval = setInterval(() => {
      setTargetPos({
        // Safety border offset: keep between 20% and 80% to avoid sudden screen clip edges
        x: 20 + Math.random() * 60,
        y: 25 + Math.random() * 50,
      });
    }, 2400);

    return () => clearInterval(interval);
  }, [timeLeft]);

  // Neurobiological phases:
  // Phase 0: Abertura (Minute 15:00 to 14:45) -> 900 to 886 sec
  // Phase 1: Viajante (Minute 14:45 to 13:00) -> 885 to 781 sec
  // Phase 2: Pulso (Minute 13:00 to 05:00) -> 780 to 301 sec
  // Phase 3: Vazio (Minute 05:00 to 00:00) -> 300 to 1 sec
  // Phase 4: Completed -> 0 sec
  const currentPhase = useMemo(() => {
    if (timeLeft === null) return 0;
    if (timeLeft > 885) return 0;
    if (timeLeft > 780) return 1;
    if (timeLeft > 300) return 2;
    if (timeLeft > 0) return 3;
    return 4;
  }, [timeLeft]);

  // Handle active audio frequency streams based on currently selected phase
  useEffect(() => {
    if (!synthRef.current) {
      synthRef.current = new AudioSynthesizer();
    }

    const synth = synthRef.current;

    if (isAudioEnabled) {
      if (currentPhase === 1 || currentPhase === 2) {
        // Solfeggio 528Hz frequency (Pure Tone for cellular resonance & stress decline)
        synth.start(528, 0, 1.0);
      } else if (currentPhase === 3) {
        // Deep Theta 7.5Hz Binaural (150Hz carrier with 7.5Hz gap).
        // Custom volume boost (3.5x multiplier) equalizes physical depth against high-mid tones.
        synth.start(150, 7.5, 3.5);
      } else {
        synth.stop();
      }
    } else {
      synth.stop();
    }

    return () => {
      synth.stop();
    };
  }, [currentPhase, isAudioEnabled]);

  // Clinical inhalation/exhalation pacing calculations (11 second period cycle)
  const breathingState = useMemo(() => {
    if (timeLeft === null) return { phase: 'inhale', text: 'Respire no ritmo', scale: 1.0 };
    
    // Cycle duration is 11s.
    const cycle = timeLeft % 11;
    
    // Inhale deeply (4 seconds) -> scale goes up to 1.5
    if (cycle >= 7) {
      return {
        phase: 'inhale',
        text: 'Inspire profundamente...',
        scale: 1.5
      };
    }
    // Inhale-hold suspension (1.5 seconds) -> keeps scale at 1.55 peak glow
    else if (cycle >= 5.5) {
      return {
        phase: 'inhale-hold',
        text: 'Segure o ar...',
        scale: 1.55
      };
    }
    // Exhale slowly (5.5 seconds) -> scale shrinks back to 0.95
    else {
      return {
        phase: 'exhale',
        text: 'Exale devagar...',
        scale: 0.95
      };
    }
  }, [timeLeft]);

  // Immutable field reflection save mutation (Saves directly to database & triggers reactive update)
  const saveReflection = async () => {
    if (!profile?.id) {
      dataStore.showNotification('Conecte-se para salvar o registro.', 'error');
      return;
    }

    setSaveStatus('saving');
    try {
      const timestamp = new Date().toISOString();
      const checkinData = {
        user_id: profile.id,
        habit_id: habitId || 'Crise Geral',
        checkin_date: getLocalDateString(),
        checkin_period: 'window' as const,
        status: 'resisti' as const,
        trigger_tag: 'S.O.S. Protocolo',
        trigger_note: ghostQuoteContent.trim() || 'Resisti com o Protocolo Clínico S.O.S. de 15 minutos.',
        created_at: timestamp
      };

      // 1. Mutate directly to the avoidance logging table
      const created = await dataStore.addAvoidanceCheckin(checkinData);

      if (created) {
        // 2. Invalidate cache and refetch checkins immediately to update charts & War Room Logs (Reactive synchronization)
        await dataStore.fetchAvoidanceCheckins(profile.id);

        // 3. UI states updates confirming full-system sync
        setSaveStatus('saved');
        setReflectionSaved(true);
        dataStore.showNotification('Reflexão armazenada com sucesso ✓', 'success');
      } else {
        setSaveStatus('error');
        dataStore.showNotification('Falha ao registrar check-in.', 'error');
      }
    } catch (e) {
      console.error("Supabase check-in error:", e);
      setSaveStatus('error');
      dataStore.showNotification('Erro de rede ao salvar reflexão.', 'error');
    }
  };

  // Silently record full-completion victory checkpoint on timer success (reached 0)
  useEffect(() => {
    if (timeLeft === 0 && saveStatus === 'idle') {
      const persistCheckin = async () => {
        if (!profile?.id) return;
        setSaveStatus('saving');
        try {
          const timestamp = new Date().toISOString();
          const checkinData = {
            user_id: profile.id,
            habit_id: habitId || 'Crise Geral',
            checkin_date: getLocalDateString(),
            checkin_period: 'window' as const,
            status: 'resisti' as const,
            trigger_tag: 'S.O.S. Protocolo',
            trigger_note: 'Protocolo S.O.S. de 15 minutos concluído com sucesso absoluta.',
            created_at: timestamp
          };

          await dataStore.addAvoidanceCheckin(checkinData);
          await dataStore.fetchAvoidanceCheckins(profile.id);
          setSaveStatus('saved');
        } catch (e) {
          console.error(e);
        }
      };
      persistCheckin();
    }
  }, [timeLeft, saveStatus, profile, habitId]);

  // Faster phase jumping tool for debug validation during reviews
  const skipToPhase = (phase: number) => {
    if (phase === 0) setTimeLeft(15 * 60);
    else if (phase === 1) setTimeLeft(14 * 60 + 30);
    else if (phase === 2) setTimeLeft(12 * 60);
    else if (phase === 3) setTimeLeft(4 * 60 + 50);
    else if (phase === 4) setTimeLeft(0);
  };

  const handleCancel = () => {
    const key = `urge_surfing_end_time_${habitId || 'general'}`;
    localStorage.removeItem(key);
    onClose();
  };

  const formatMinSec = (secs: number) => {
    const mm = Math.floor(secs / 60);
    const ss = secs % 60;
    return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  };

  if (timeLeft === null) {
    return (
      <div className="fixed inset-0 w-full h-full bg-black z-[200] flex items-center justify-center font-mono text-xs text-white/30 tracking-widest">
        SISTEMA DE INTERVENÇÃO DUDE...
      </div>
    );
  }

  return (
    <div className="fixed inset-0 w-full h-full bg-[#030303] text-white z-[150] flex flex-col justify-between p-6 md:p-12 overflow-hidden select-none outline-none font-sans">
      
      {/* Absolute discretely elegant close helper (Matches physical Apple devices touch escape cues) */}
      <button 
        onClick={handleCancel}
        className="absolute top-6 right-6 text-white/20 hover:text-white/80 hover:scale-105 active:scale-95 transition-all p-3 rounded-full hover:bg-white/5 z-[210] cursor-pointer"
        aria-label="Sair"
      >
        <X size={22} />
      </button>

      {/* Top minimal header metadata container */}
      <div className="flex items-center justify-between w-full shrink-0 z-50">
        <div className="flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]" />
          <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-emerald-400/90 font-mono">
            GUIA CLINICO DUDE
          </span>
        </div>

        <div className="flex items-center gap-4">
          {/* Debug speed skips */}
          <div className="flex items-center gap-1.5 bg-white/[0.02] border border-white/5 px-2.5 py-1 rounded-xl opacity-0 hover:opacity-100 transition-opacity duration-300">
            <span className="text-[9px] font-mono text-white/30 tracking-wider">Fases:</span>
            {[0, 1, 2, 3, 4].map(p => (
              <button 
                key={p} 
                onClick={() => skipToPhase(p)}
                className={`w-5 h-5 text-[10px] font-mono rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                  currentPhase === p 
                    ? 'bg-emerald-500/20 text-emerald-300 font-extrabold border border-emerald-500/30' 
                    : 'text-white/30 hover:bg-white/10'
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          <button
            onClick={() => setIsAudioEnabled(!isAudioEnabled)}
            className={`p-2 rounded-xl transition-all text-xs flex items-center gap-2 ${
              isAudioEnabled 
                ? 'text-emerald-400 hover:text-emerald-300' 
                : 'text-white/25 hover:text-white/45'
            }`}
          >
            {isAudioEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
            <span className="text-[9px] uppercase tracking-[0.18em] font-mono font-bold select-none">
              {isAudioEnabled ? 'SONS ACTIVOS' : 'MUTADO'}
            </span>
          </button>
        </div>
      </div>

      {/* Headphones alert popups */}
      <AnimatePresence>
        {showHeadphonesAlert && (
          <motion.div 
            initial={{ opacity: 0, y: -15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="absolute top-16 left-1/2 -translate-x-1/2 bg-white/[0.04] backdrop-blur-xl border border-white/10 px-5 py-2.5 rounded-full text-center z-50 shadow-2xl pointer-events-none"
          >
            <span className="text-[10px] sm:text-xs text-white/80 tracking-wider font-light">
              🎧 Recomendamos fones de ouvido para eficácia profunda.
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main stage with generous spacious margins */}
      <div className="flex-1 w-full flex flex-col justify-center items-center relative py-6 max-w-2xl mx-auto">
        <AnimatePresence mode="wait">
          
          {/* PHASE 0: ABERTURA & ACOLHIMENTO (0-15s) */}
          {currentPhase === 0 && (
            <motion.div 
              key="phase-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.2, ease: "easeInOut" }}
              className="flex flex-col items-center justify-center space-y-8 text-center max-w-xl"
            >
              <h2 className="text-2xl md:text-3xl lg:text-4xl font-light text-white leading-relaxed tracking-wide px-4">
                "Você não está sozinho. A DUDE assumiu o controle. Apenas siga o guia."
              </h2>
              <div className="flex flex-col items-center space-y-1.5">
                <span className="text-[10px] text-white/40 tracking-[0.25em] font-mono uppercase">
                  Fase 0 · Absorção Inicial
                </span>
                <p className="text-xs text-white/30 tracking-wider font-light uppercase">
                  Apenas relaxe os ombros e confie nos sinais.
                </p>
              </div>
            </motion.div>
          )}

          {/* PHASE 1: A VIAJANTE (Eye scanning cognitive load drift) */}
          {currentPhase === 1 && (
            <motion.div 
              key="phase-1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.2, ease: "easeInOut" }}
              className="w-full h-full flex flex-col justify-between items-center relative py-8"
            >
              {/* Field boundary frame representing orbital tracking space */}
              <div className="w-full h-64 md:h-[400px] relative overflow-hidden bg-transparent rounded-[32px] flex items-center justify-center">
                {/* Inertial Green Traveler Orb */}
                <motion.div
                  animate={{ 
                    left: `${targetPos.x}%`, 
                    top: `${targetPos.y}%` 
                  }}
                  transition={{ 
                    type: "spring",
                    stiffness: 7,
                    damping: 15,
                    mass: 2.2,
                    restDelta: 0.01
                  }}
                  className="absolute w-12 h-12 -ml-6 -mt-6 rounded-full bg-gradient-to-tr from-emerald-400 to-emerald-500 shadow-[0_0_60px_rgba(16,185,129,0.9),inset_0_2px_4px_rgba(255,255,255,0.4)]"
                />
              </div>

              {/* Cognitive guides */}
              <div className="text-center space-y-2 select-none z-50">
                <span className="text-base sm:text-lg font-light tracking-wide text-white/95">
                  Acompanhe a luz com o olhar.
                </span>
                <p className="text-[10px] text-white/30 tracking-[0.2em] font-mono uppercase">
                  Saturando a memória de trabalho para dissolver impulsos biológicos.
                </p>
              </div>
            </motion.div>
          )}

          {/* PHASE 2: O PULSO (Symmetric paced heart loops & journaling) */}
          {currentPhase === 2 && (
            <motion.div 
              key="phase-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.2, ease: "easeInOut" }}
              className="w-full flex flex-col items-center justify-center space-y-10"
            >
              {/* Organic core pulse loop */}
              <div className="relative w-40 h-40 flex items-center justify-center">
                <motion.div
                  animate={{
                    scale: breathingState.scale,
                    opacity: breathingState.phase === 'exhale' ? 0.35 : 0.8
                  }}
                  transition={{
                    duration: 1.6,
                    ease: 'easeInOut'
                  }}
                  className="absolute inset-0 rounded-full bg-emerald-500/10 border border-emerald-500/20 blur-md"
                />
                <motion.div
                  animate={{
                    scale: breathingState.scale * 0.82,
                  }}
                  transition={{
                    duration: 1.6,
                    ease: 'easeInOut'
                  }}
                  className="absolute w-28 h-28 rounded-full bg-gradient-to-tr from-emerald-500/25 to-emerald-400/5 border border-emerald-500/35 flex flex-col items-center justify-center shadow-[0_0_40px_rgba(16,185,129,0.2)]"
                >
                  <Heart className="text-emerald-400 animate-pulse" size={26} />
                </motion.div>
              </div>

              {/* Rhythmic Breathing states */}
              <div className="text-center space-y-1.5 h-14">
                <span className="text-base sm:text-lg font-medium tracking-wide text-white block">
                  {breathingState.text}
                </span>
                <span className="text-[10px] text-white/35 tracking-[0.25em] uppercase font-mono">
                  Sincronização Neuromuscular
                </span>
              </div>

              {/* Single write panel seamless fade transitions */}
              <div className="w-full max-w-md space-y-4 pt-2">
                {!reflectionSaved ? (
                  <div className="space-y-4">
                    <textarea
                      value={ghostQuoteContent}
                      onChange={(e) => setGhostQuoteContent(e.target.value)}
                      placeholder="Esvazie sua mente... Descreva aqui os sentimentos, pensamentos ou o gatilho que despertou essa vontade. Colocar em palavras reduz a urgência biológica e reorganiza sua mente..."
                      className="w-full min-h-[120px] bg-white/[0.02] border border-white/10 hover:border-white/20 focus:border-emerald-500/50 focus:bg-white/[0.04] transition-all rounded-3xl p-5 text-sm font-light text-white/90 focus:outline-none placeholder-white/25 resize-none leading-relaxed shadow-inner"
                    />
                    <button
                      onClick={saveReflection}
                      disabled={saveStatus === 'saving'}
                      className="w-full py-4 px-6 rounded-2xl bg-emerald-400 hover:bg-emerald-500 text-black font-extrabold text-xs uppercase tracking-[0.2em] transition-all cursor-pointer shadow-[0_0_30px_rgba(16,185,129,0.25)] flex items-center justify-center"
                    >
                      {saveStatus === 'saving' ? (
                        <div className="flex items-center gap-2">
                          <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                          <span>GRAVANDO NA NUVEM...</span>
                        </div>
                      ) : (
                        'GUARDAR REFLEXÃO'
                      )}
                    </button>
                  </div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.98, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    className="p-5 bg-emerald-500/5 border border-emerald-500/15 rounded-3xl text-center space-y-2 max-w-sm mx-auto shadow-xl"
                  >
                    <span className="text-sm text-emerald-400 font-bold flex items-center justify-center gap-1.5 uppercase tracking-wider">
                      <ShieldCheck size={16} /> Registro salvo em segurança ✓
                    </span>
                    <span className="text-[11px] text-white/40 block leading-relaxed">
                      Seu registro foi inserido em campo de batalha na aba de "Centro" e "Trends" sem perdas de persistência.
                    </span>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}

          {/* PHASE 3: ATERRAMENTO (Vazio/Grounding deep audio immersion) */}
          {currentPhase === 3 && (
            <motion.div 
              key="phase-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.2, ease: "easeInOut" }}
              className="flex flex-col items-center justify-center space-y-8 text-center max-w-md"
            >
              {/* Very minimal bright star with expanding atmospheric blur rings */}
              <div className="relative w-16 h-16 flex items-center justify-center">
                <div className="absolute w-8 h-8 rounded-full bg-emerald-500/10 animate-ping" />
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_20px_#10b981,0_0_40px_#10b981] animate-pulse" />
              </div>

              <div className="space-y-3 px-6">
                <h3 className="text-xl md:text-2xl font-light tracking-wide text-white/95 leading-relaxed">
                  "O pior já passou. Deixe o som levar o resto."
                </h3>
                <p className="text-[10px] text-white/35 tracking-[0.25em] font-mono uppercase block">
                  Calibragem Nervosa & Relaxamento Cerebral
                </p>
              </div>

              {reflectionSaved && (
                <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/15 px-4 py-1.5 rounded-full mt-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[9px] font-mono text-emerald-300 uppercase tracking-widest font-bold">
                    Registro de reflexão persistido
                  </span>
                </div>
              )}
            </motion.div>
          )}

          {/* PHASE 4: CONCLUSÃO (Victory screen) */}
          {currentPhase === 4 && (
            <motion.div 
              key="phase-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.2, ease: "easeOut" }}
              className="flex flex-col items-center justify-center space-y-8 text-center max-w-sm px-6"
            >
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400 shadow-[0_0_40px_rgba(16,185,129,0.2)]">
                <ShieldCheck size={32} />
              </div>

              <div className="space-y-2.5">
                <h3 className="text-2xl font-bold tracking-tight uppercase text-white font-mono">
                  Você Venceu o Impulso
                </h3>
                <p className="text-xs text-white/60 font-light leading-relaxed">
                  Seu compromisso de retidão contra o vício de <span className="text-emerald-400 font-bold">{habitName}</span> foi honrado com excelência.
                </p>
              </div>

              <div className="pt-4 w-full space-y-3">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="w-full flex items-center justify-center gap-2 py-4 px-6 bg-gradient-to-r from-emerald-400 to-emerald-500 hover:brightness-110 active:scale-[0.98] transition-all text-black font-extrabold text-xs uppercase tracking-[0.2em] rounded-2xl cursor-pointer shadow-[0_0_30px_rgba(16,185,129,0.35)]"
                >
                  <ShieldCheck size={16} />
                  VOLTAR PARA A BASE
                </button>
                <span className="text-white/35 text-[10px] tracking-[0.16em] uppercase font-mono block">
                  Excelente. Vá beber um copo d'água.
                </span>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* Bottom timer indicator */}
      <div className="w-full shrink-0 flex flex-col justify-end items-center z-50">
        {currentPhase < 4 && (
          <div className="flex flex-col items-center justify-center space-y-1">
            <span className="text-3xl font-mono font-black text-white select-none tracking-tight">
              {formatMinSec(timeLeft)}
            </span>
            <span className="text-[9px] font-bold text-white/20 uppercase tracking-[0.25em] font-mono">
              Fase {currentPhase} integrada · Tempo Restante
            </span>
          </div>
        )}
      </div>

    </div>
  );
};
