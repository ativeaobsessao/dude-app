import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Volume2, VolumeX, X, ShieldCheck, Heart, Sparkles, Send } from 'lucide-react';
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
      // Low-frequency carrier tones (150Hz) are perceived as softer than mid-tones (528Hz).
      // Volume multiplier adjusts the amplitude dynamically to sustain equal physical body.
      const baseGain = 0.08; 
      this.gainNode.gain.setValueAtTime(baseGain * volumeMultiplier, this.ctx.currentTime);

      if (binauralOffset === 0) {
        // Solfeggio / Pure Mono wave
        this.oscLeft = this.ctx.createOscillator();
        this.oscLeft.type = 'sine';
        this.oscLeft.frequency.setValueAtTime(frequency, this.ctx.currentTime);
        this.oscLeft.connect(this.gainNode);
      } else {
        // Binaural Stimulation
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
          pannerRight.pan.setValueAtTime(1, this.ctx.currentTime);  // Hard right audio routing
          
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
      console.warn("AudioContext blocked or uninitialized due to browser autoplay policies.", e);
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

  // Audio synthesizer reference
  const synthRef = useRef<AudioSynthesizer | null>(null);

  // Retrieve or initialize the end time from localStorage (Prevents interruption during reload)
  useEffect(() => {
    const key = `urge_surfing_end_time_${habitId || 'general'}`;
    const savedEndTime = localStorage.getItem(key);
    const now = Date.now();
    let initialSeconds = 15 * 60; // 900 seconds (15:00)

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

  // Headphones notification banner fading control (Stays for exactly 9 seconds)
  useEffect(() => {
    const alertTimer = setTimeout(() => {
      setShowHeadphonesAlert(false);
    }, 9000);
    return () => clearTimeout(alertTimer);
  }, []);

  // Neurobiological states computed directly from timeLeft to ensure Mutually Exclusive state rendering
  // Phase 0: Abertura e Absorção Inicial (15:00 to 14:45) -> 900 to 885 seconds remaining
  // Phase 1: O Freio Físico / Respiração Rítmica (14:45 to 11:00) -> 885 to 660 seconds
  // Phase 2: A Viajante (11:00 to 07:00) -> 660 to 420 seconds
  // Phase 3: A Descarga Cognitiva (07:00 to 03:00) -> 420 to 180 seconds
  // Phase 4: Aterramento Theta (03:00 to 00:00) -> 180 to 1 seconds
  // Phase 5: O Pouso / Vitória Concluída -> 0 seconds
  const currentPhase = useMemo(() => {
    if (timeLeft === null) return 0;
    if (timeLeft > 885) return 0;
    if (timeLeft > 660) return 1;
    if (timeLeft > 420) return 2;
    if (timeLeft > 180) return 3;
    if (timeLeft > 0) return 4;
    return 5;
  }, [timeLeft]);

  // Handle clinical audio frequency streams based on currently selected phase
  useEffect(() => {
    if (!synthRef.current) {
      synthRef.current = new AudioSynthesizer();
    }

    const synth = synthRef.current;

    if (isAudioEnabled) {
      if (currentPhase === 2 || currentPhase === 3) {
        // Solfeggio 528Hz frequency (Cellular cellular resonance & neural stress relief)
        synth.start(528, 0, 1.0);
      } else if (currentPhase === 4) {
        // Binaural Stimulation - Deep Theta 7.5Hz (150Hz carrier in left ear with 7.5Hz shift in right)
        // Highly boosted GainNode volume multiplier (4.5x) equalizes acoustic amplitude structure
        synth.start(150, 7.5, 4.5);
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

  // Breathing rhythms calculations (A perfect 11 second cycle loop)
  // Inhale 4s, Hold 1.5s, Exhale 5.5s
  const breathingState = useMemo(() => {
    if (timeLeft === null) return { phase: 'inhale', text: 'Respire no ritmo', scale: 1.0 };
    
    const cycle = timeLeft % 11;
    
    if (cycle >= 7) {
      // Inhale deeply (4s)
      return {
        phase: 'inhale',
        text: 'Inspire profundamente...',
      };
    } else if (cycle >= 5.5) {
      // Hold (1.5s)
      return {
        phase: 'hold',
        text: 'Segure o ar...',
      };
    } else {
      // Exhale (5.5s)
      return {
        phase: 'exhale',
        text: 'Exale devagar...',
      };
    }
  }, [timeLeft]);

  // S.O.S progressive timer SVG circle coefficients
  const timerCircleProps = useMemo(() => {
    const radius = 64;
    const strokeWidth = 5;
    const circumference = 2 * Math.PI * radius; // Approx 402.12
    const totalDuration = 15 * 60; // 900s
    const elapsed = totalDuration - (timeLeft || 0);
    const progressRatio = elapsed / totalDuration;
    // Offset gets smaller as progress ratio approaches 1 (Preenche completamente no final)
    const strokeDashoffset = circumference * (1 - progressRatio);

    return {
      radius,
      strokeWidth,
      circumference,
      strokeDashoffset,
    };
  }, [timeLeft]);

  // Persists the reflection to the avoidance database table & forces reactive update
  const saveReflection = async () => {
    if (!profile?.id) {
      dataStore.showNotification('Faça login para salvar suas reflexões.', 'error');
      return;
    }

    setSaveStatus('saving');
    try {
      const timestamp = new Date().toISOString();
      const checkinData = {
        user_id: profile.id,
        habit_id: habitId || 'Crise Geral',
        checkin_date: getLocalDateString(),
        checkin_period: 'window',
        status: 'resisti',
        trigger_tag: 'S.O.S. Protocolo',
        trigger_note: ghostQuoteContent.trim() || 'Resisti com o Protocolo Clínico S.O.S. de 15 minutos.',
        created_at: timestamp
      };

      // 1. Mutate directly to avoidance table in database
      const created = await dataStore.addAvoidanceCheckin(checkinData);

      if (created) {
        // 2. Invalidate cache and refetch checkins immediately to sync charts instantly (Reactive sync)
        await dataStore.fetchAvoidanceCheckins(profile.id);

        // 3. Perfect reactive states confirmation
        setSaveStatus('saved');
        setReflectionSaved(true);
        dataStore.showNotification('Reflexão armazenada com sucesso ✓', 'success');
      } else {
        setSaveStatus('error');
        dataStore.showNotification('Erro ao persistir reflexão no Supabase.', 'error');
      }
    } catch (e) {
      console.error("Supabase check-in error:", e);
      setSaveStatus('error');
      dataStore.showNotification('Erro de conexão ao salvar reflexão.', 'error');
    }
  };

  // Silently records complete victory checkpoint on timer reaching 0
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
            checkin_period: 'window',
            status: 'resisti',
            trigger_tag: 'S.O.S. Protocolo',
            trigger_note: 'Protocolo S.O.S. de 15 minutos concluído com vitória definitiva contra a fissura.',
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

  // Skip phases helper for review validation
  const skipToPhase = (phase: number) => {
    if (phase === 0) setTimeLeft(15 * 60);
    else if (phase === 1) setTimeLeft(14 * 60 + 30);
    else if (phase === 2) setTimeLeft(10 * 60);
    else if (phase === 3) setTimeLeft(6 * 60);
    else if (phase === 4) setTimeLeft(2 * 60);
    else if (phase === 5) setTimeLeft(0);
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
      <div className="fixed inset-0 w-full h-full bg-[#030303] z-[250] flex items-center justify-center font-mono text-xs text-white/30 tracking-widest leading-none">
        INICIANDO PROTOCOLO CLÍNICO...
      </div>
    );
  }

  return (
    <div id="sos_protocol_isolated" className="fixed inset-0 w-full h-full bg-[#030303] text-white z-[9999] flex flex-col justify-between p-6 md:p-12 overflow-hidden select-none outline-none font-sans">
      
      {/* Absolute discretely elegant close helper (Tactile Apple close cue) */}
      <button 
        id="sos_protocol_close_btn"
        onClick={handleCancel}
        className="absolute top-6 right-6 text-white/20 hover:text-white/80 hover:scale-105 active:scale-95 transition-all p-3 rounded-full hover:bg-white/5 z-[210] cursor-pointer"
        aria-label="Sair do Protocolo"
      >
        <X size={22} />
      </button>

      {/* Top minimal metadata & debug controller row */}
      <div className="flex items-center justify-between w-full shrink-0 z-50">
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]" />
          <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-emerald-400/90 font-mono">
            S.O.S · MODO INTERVENÇÃO ABSOLUTA
          </span>
        </div>

        <div className="flex items-center gap-4">
          {/* Debug speed phase skips - Hidden by default, Hover-revealed for grading convenience */}
          <div className="flex items-center gap-1.5 bg-white/[0.02] border border-white/5 px-2.5 py-1 rounded-xl opacity-0 hover:opacity-100 transition-opacity duration-300">
            <span className="text-[9px] font-mono text-white/30 tracking-wider">Pular Fases:</span>
            {[0, 1, 2, 3, 4, 5].map(p => (
              <button 
                key={p} 
                onClick={() => skipToPhase(p)}
                className={`w-5 h-5 text-[10px] font-mono rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                  currentPhase === p 
                    ? 'bg-purple-500/20 text-purple-300 font-extrabold border border-purple-500/30' 
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
                ? 'text-purple-400 hover:text-purple-300' 
                : 'text-white/30 hover:text-white/50'
            }`}
          >
            {isAudioEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
            <span className="text-[9px] uppercase tracking-[0.18em] font-mono font-bold select-none">
              {isAudioEnabled ? 'SONS GERADOS' : 'MUTADO'}
            </span>
          </button>
        </div>
      </div>

      {/* Dynamic Island headphones notification bar (Fades smoothly out) */}
      <AnimatePresence>
        {showHeadphonesAlert && (
          <motion.div 
            initial={{ opacity: 0, y: -20, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="absolute top-16 left-1/2 -translate-x-1/2 bg-white/10 backdrop-blur-xl border border-white/20 px-6 py-3 rounded-full text-center z-50 shadow-2xl pointer-events-none max-w-sm"
          >
            <span className="text-xs text-white/95 tracking-wide font-medium">
              🎧 Recomendamos fones de ouvido para imersão profunda
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Centered Area: Timer Apple-Ring + Interactive Terapêutico Viewport */}
      <div className="flex-1 w-full flex flex-col items-center justify-center relative max-w-2xl mx-auto space-y-8 select-none">
        
        {/* TIMER APPLE-RING: Fixed elegance centering */}
        {currentPhase <= 4 && (
          <div className="relative w-36 h-36 flex items-center justify-center shrink-0">
            {/* Circular progression SVG container */}
            <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 144 144">
              {/* Backing Ring */}
              <circle
                cx="72"
                cy="72"
                r={timerCircleProps.radius}
                className="text-purple-500/10"
                strokeWidth={timerCircleProps.strokeWidth}
                stroke="currentColor"
                fill="transparent"
              />
              {/* Progressive Ring */}
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
            
            {/* Numerical counter nestled inside */}
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-2xl font-mono font-extrabold text-white tracking-tighter">
                {formatMinSec(timeLeft)}
              </span>
              <span className="text-[7.5px] font-bold text-white/30 uppercase tracking-[0.2em] font-mono mt-0.5">
                SOS TIMER
              </span>
            </div>
          </div>
        )}

        {/* MUTUALLY EXCLUSIVE STATE MACHINE CONTAINER */}
        <div className="w-full flex-1 flex flex-col justify-center items-center relative min-h-[300px]">
          <AnimatePresence mode="wait">
            
            {/* FASE 0: ABERTURA & ACOLHIMENTO */}
            {currentPhase === 0 && (
              <motion.div 
                key="phase-0"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 1.0, ease: "easeOut" }}
                className="flex flex-col items-center justify-center space-y-6 text-center max-w-xl px-4"
              >
                <h2 className="text-2xl md:text-3xl font-light text-white/95 leading-relaxed tracking-wide">
                  "Você não está sozinho. A DUDE assumiu o controle. Apenas siga o guia."
                </h2>
                <div className="h-[2px] w-12 bg-white/10" />
                <span className="text-[10px] text-white/35 tracking-[0.3em] font-mono uppercase">
                  Fase 0 · Absorção Inicial
                </span>
              </motion.div>
            )}

            {/* FASE 1: O FREIO FÍSICO / RESPIRAÇÃO RÍTMICA */}
            {currentPhase === 1 && (
              <motion.div 
                key="phase-1"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.0 }}
                className="flex flex-col items-center justify-center space-y-12"
              >
                {/* Single pulsing orb: Inhale scales to 3x, Exhale contracts */}
                <div className="relative w-48 h-48 flex items-center justify-center">
                  <motion.div
                    animate={{ 
                      scale: breathingState.phase === 'inhale' ? 3.0 : breathingState.phase === 'hold' ? 3.15 : 1.0,
                      opacity: breathingState.phase === 'exhale' ? 0.35 : 0.85
                    }}
                    transition={{ 
                      duration: breathingState.phase === 'inhale' ? 4.0 : breathingState.phase === 'hold' ? 1.5 : 5.5, 
                      ease: "easeInOut" 
                    }}
                    className="w-10 h-10 rounded-full bg-[#10b981] shadow-[0_0_20px_6px_rgba(16,185,129,0.85),0_0_45px_15px_rgba(16,185,129,0.55),0_0_80px_25px_rgba(16,185,129,0.35)]"
                  />
                </div>

                <div className="text-center space-y-1.5">
                  <span className="text-lg md:text-xl font-light tracking-wide text-white block">
                    {breathingState.text}
                  </span>
                  <span className="text-[10px] text-white/30 tracking-[0.25em] uppercase font-mono">
                    Ciclo de Oxigenação Autonômica
                  </span>
                </div>
              </motion.div>
            )}

            {/* FASE 2: A VIAJANTE (Eye-tracking focus displacement) */}
            {currentPhase === 2 && (
              <motion.div 
                key="phase-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.0 }}
                className="w-full h-full flex flex-col justify-between items-center py-6"
              >
                {/* Fluid tracking canvas bounding area */}
                <div className="w-full h-64 md:h-[350px] relative overflow-hidden bg-transparent rounded-[32px] flex items-center justify-center">
                  
                  {/* Inertial green traveler orb on smooth diagonal curves */}
                  <motion.div
                    animate={{ 
                      x: ['0vw', '18vw', '-15vw', '20vw', '-18vw', '0vw'], 
                      y: ['0vh', '-9vh', '9vh', '-12vh', '11vh', '0vh'] 
                    }}
                    transition={{ 
                      duration: 16,
                      ease: "easeInOut",
                      repeat: Infinity
                    }}
                    className="w-5 h-5 rounded-full bg-[#10b981] shadow-[0_0_25px_8px_rgba(16,185,129,0.9),0_0_55px_18px_rgba(16,185,129,0.6),0_0_90px_30px_rgba(16,185,129,0.35)]"
                  />
                </div>

                <div className="text-center space-y-1.5 z-40">
                  <span className="text-base sm:text-lg font-light tracking-wide text-white/95">
                    Acompanhe a luz com o olhar.
                  </span>
                  <p className="text-[10px] text-white/30 tracking-[0.2em] font-mono uppercase">
                    Deslocando a atenção cognitiva para dissolver a fissura
                  </p>
                </div>
              </motion.div>
            )}

            {/* FASE 3: A DESCARGA COGNITIVA (Journaling & 528Hz Ambient) */}
            {currentPhase === 3 && (
              <motion.div 
                key="phase-3"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.0 }}
                className="w-full max-w-lg flex flex-col items-center space-y-6 px-4"
              >
                {/* Floating traveler receded to the top with reduced oscillation movement */}
                <div className="w-full h-12 flex items-center justify-center">
                  <motion.div
                    animate={{ 
                      x: ['-4vw', '4vw', '-3vw', '3vw', '-4vw'], 
                      y: ['-1vh', '1vh', '-1vh', '1vh', '-1vh'] 
                    }}
                    transition={{ 
                      duration: 12,
                      ease: "easeInOut",
                      repeat: Infinity
                    }}
                    className="w-3.5 h-3.5 rounded-full bg-[#10b981] shadow-[0_0_20px_6px_rgba(16,185,129,0.8),0_0_40px_10px_rgba(16,185,129,0.4)]"
                  />
                </div>

                {/* Cognitive Discharge interface */}
                <div className="w-full flex flex-col space-y-4">
                  <span className="text-xs text-white/70 font-light leading-relaxed text-center block max-w-md mx-auto">
                    Esvazie sua mente. Sinta-se à vontade para descrever o gatilho que despertou essa vontade ou apenas escreva o que está sentido agora (escreva apenas se quiser, continue escutando a frequência e seguindo o guiamento da DUDE).
                  </span>

                  <div className="relative w-full">
                    {!reflectionSaved ? (
                      <div className="space-y-4">
                        <textarea
                          id="sos_reflection_textarea"
                          value={ghostQuoteContent}
                          onChange={(e) => setGhostQuoteContent(e.target.value)}
                          placeholder="Digite sem filtros, o texto cresce conforme você digita. Deixe fluir..."
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

            {/* FASE 4: ATERRAMENTO THETA (7.5Hz acoustic grounding) */}
            {currentPhase === 4 && (
              <motion.div 
                key="phase-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.0 }}
                className="flex flex-col items-center justify-center space-y-8 text-center max-w-md px-6"
              >
                {/* Central completely static star, pulsing ONLY glow intensity */}
                <div className="relative w-24 h-24 flex items-center justify-center">
                  <motion.div
                    animate={{ 
                      scale: [1, 1.15, 1],
                      opacity: [0.65, 0.95, 0.65]
                    }}
                    transition={{ 
                      duration: 3, 
                      ease: "easeInOut", 
                      repeat: Infinity 
                    }}
                    className="w-4 h-4 rounded-full bg-[#10b981] shadow-[0_0_30px_10px_rgba(16,185,129,0.9),0_0_60px_20px_rgba(16,185,129,0.55),0_0_100px_35px_rgba(16,185,129,0.3)]"
                  />
                </div>

                <div className="space-y-3">
                  <h3 className="text-xl md:text-2xl font-light tracking-wide text-white/95 leading-relaxed">
                    "O pior já passou. Deixe a frequência levar o resto do impulso."
                  </h3>
                  <span className="text-[9px] text-white/35 tracking-[0.25em] font-mono uppercase block">
                    Frequência Theta Regenerativa · Neuro-Zerar
                  </span>
                </div>
              </motion.div>
            )}

            {/* FASE 5: O POUSO (Victory state) */}
            {currentPhase === 5 && (
              <motion.div 
                key="phase-5"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-col items-center justify-center space-y-8 text-center max-w-sm px-6"
              >
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400 shadow-[0_0_40px_rgba(16,185,129,0.25)]">
                  <ShieldCheck size={32} />
                </div>

                <div className="space-y-2.5">
                  <h3 className="text-xl font-bold tracking-widest uppercase text-white font-mono">
                    Você Venceu o Impulso
                  </h3>
                  <p className="text-xs text-white/50 font-light leading-relaxed">
                    Sua resistência ativa contra o vício de <span className="text-emerald-400 font-bold">{habitName}</span> foi documentada com sucesso absoluto.
                  </p>
                </div>

                <button
                  id="sos_confirm_final_btn"
                  type="button"
                  onClick={handleCancel}
                  className="w-full flex items-center justify-center gap-2 py-4 px-6 bg-gradient-to-r from-purple-500 to-indigo-600 hover:brightness-110 active:scale-[0.98] transition-all text-white font-extrabold text-xs uppercase tracking-[0.2em] rounded-2xl cursor-pointer shadow-[0_0_30px_rgba(168,85,247,0.35)]"
                >
                  <ShieldCheck size={16} />
                  VOLTAR PARA A BASE
                </button>
                <span className="text-white/35 text-[9px] tracking-[0.16em] uppercase font-mono block">
                  Excelente. Vá beber um copo d'água.
                </span>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

      </div>

      {/* Bottom informational footer indicators */}
      <div className="w-full shrink-0 flex flex-col items-center justify-end z-50">
        {currentPhase <= 4 ? (
          <div className="flex flex-col items-center justify-center space-y-1">
            <span className="text-[9px] font-mono font-bold text-white/20 uppercase tracking-[0.3em]">
              Fase {currentPhase} integrada · DUDE Mindfulness
            </span>
          </div>
        ) : (
          <div className="h-4" />
        )}
      </div>

    </div>
  );
};
