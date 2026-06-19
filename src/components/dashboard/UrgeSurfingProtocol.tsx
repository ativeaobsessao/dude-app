import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Brain, Heart, ShieldCheck, PenTool, Volume2, VolumeX, X } from 'lucide-react';
import { useDataStore } from '../../store/useDataStore';
import { getLocalDateString } from '../../lib/utils';

interface UrgeSurfingProtocolProps {
  habitId?: string;
  onClose: () => void;
}

// Browser Tone Generator - Real Therapeutic Binaural Beat and Solfeggio frequencies
class AudioSynthesizer {
  private ctx: AudioContext | null = null;
  private oscLeft: OscillatorNode | null = null;
  private oscRight: OscillatorNode | null = null;
  private gainNode: GainNode | null = null;

  start(frequency: number, binauralOffset: number = 0) {
    try {
      this.stop();
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      
      this.ctx = new AudioContextClass();
      this.gainNode = this.ctx.createGain();
      
      // Clinical volume adjustment: Encorpaded at 16% volume for deep acoustic immersion
      this.gainNode.gain.setValueAtTime(0.16, this.ctx.currentTime);

      if (binauralOffset === 0) {
        // Pure single mono frequency (Solfeggio)
        this.oscLeft = this.ctx.createOscillator();
        this.oscLeft.type = 'sine';
        this.oscLeft.frequency.setValueAtTime(frequency, this.ctx.currentTime);
        this.oscLeft.connect(this.gainNode);
      } else {
        // Binaural beat setup (Left ear = carrier, Right ear = carrier + offset)
        const pannerLeft = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
        const pannerRight = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;

        this.oscLeft = this.ctx.createOscillator();
        this.oscLeft.type = 'sine';
        this.oscLeft.frequency.setValueAtTime(frequency, this.ctx.currentTime);

        this.oscRight = this.ctx.createOscillator();
        this.oscRight.type = 'sine';
        this.oscRight.frequency.setValueAtTime(frequency + binauralOffset, this.ctx.currentTime);

        if (pannerLeft && pannerRight) {
          pannerLeft.pan.setValueAtTime(-1, this.ctx.currentTime); // Hard left
          pannerRight.pan.setValueAtTime(1, this.ctx.currentTime); // Hard right
          
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
      console.warn("Real-time AudioContext blocked or not supported by browser security policy.", e);
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

  // 15-minute countdown initial state (15 * 60 = 900 seconds)
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState<boolean>(true);
  const [ghostQuoteContent, setGhostQuoteContent] = useState<string>('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [reflectionSaved, setReflectionSaved] = useState<boolean>(false);
  const [showHeadphonesAlert, setShowHeadphonesAlert] = useState<boolean>(true);

  // Floating green traveler sphere coordinates
  const [targetPos, setTargetPos] = useState({ x: 50, y: 50 });

  // Sound generator reference
  const synthRef = useRef<AudioSynthesizer | null>(null);

  // Retorno Silencioso (localStorage): No mount, salve a data final (agora + 15 min).
  // Se fechar e reabrir antes, retoma de onde parou.
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

  // Handle countdown loop
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

  // Headphone guidelines alert auto-dismiss (3 seconds)
  useEffect(() => {
    const alertTimer = setTimeout(() => {
      setShowHeadphonesAlert(false);
    }, 3800);
    return () => clearTimeout(alertTimer);
  }, []);

  // Update drifting position for "Viajante" every 3.5 seconds
  useEffect(() => {
    const currentPhase = timeLeft === null ? 0 : timeLeft > 885 ? 0 : timeLeft > 780 ? 1 : timeLeft > 300 ? 2 : timeLeft > 0 ? 3 : 4;
    if (currentPhase !== 1) return;

    // Drifting coordinates kept within 15% - 85% to stay clear of screen borders
    const interval = setInterval(() => {
      setTargetPos({
        x: 18 + Math.random() * 64,
        y: 22 + Math.random() * 56,
      });
    }, 3200);

    return () => clearInterval(interval);
  }, [timeLeft]);

  // Get current neurobiological phase
  // Phase 0: Minute 15:00 to 14:45 (Seconds 900 -> 886)
  // Phase 1: Minute 14:45 to 13:00 (Seconds 885 -> 781)
  // Phase 2: Minute 13:00 to 05:00 (Seconds 780 -> 301)
  // Phase 3: Minute 05:00 to 00:00 (Seconds 300 -> 1)
  // Phase 4: Completed (Seconds 0)
  const currentPhase = useMemo(() => {
    if (timeLeft === null) return 0;
    if (timeLeft > 885) return 0;
    if (timeLeft > 780) return 1;
    if (timeLeft > 300) return 2;
    if (timeLeft > 0) return 3;
    return 4;
  }, [timeLeft]);

  // Web Audio state controller 
  useEffect(() => {
    if (!synthRef.current) {
      synthRef.current = new AudioSynthesizer();
    }

    const synth = synthRef.current;

    if (isAudioEnabled) {
      if (currentPhase === 1 || currentPhase === 2) {
        // Solfeggio 528Hz frequency
        synth.start(528, 0);
      } else if (currentPhase === 3) {
        // Binaural carrier 150Hz with 7.5Hz Theta wave offset
        synth.start(150, 7.5);
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

  // Sincronização matemática da respiração para a Fase 2 (Pulso)
  // Cycle duration is 11 seconds
  const breathingState = useMemo(() => {
    if (timeLeft === null) return { phase: 'inhale', text: 'Respire no ritmo', scale: 1.0 };
    
    const cycle = timeLeft % 11;
    // 0 to 4 (4s): scale expands to 1.5
    if (cycle >= 7) {
      return {
        phase: 'inhale',
        text: 'Inspire profundamente...',
        scale: 1.45
      };
    }
    // 4 to 5.5 (1.5s): micro inhale hold, scale increases to 1.55
    else if (cycle >= 5.5) {
      return {
        phase: 'inhale-hold',
        text: 'Puxe mais um pouco...',
        scale: 1.55
      };
    }
    // 5.5 to 11 (5.5s): exhale, scale collapses to 0.95
    else {
      return {
        phase: 'exhale',
        text: 'Exale devagar...',
        scale: 0.95
      };
    }
  }, [timeLeft]);

  // Safe reflection storing and database connection via dataStore
  const saveReflection = async () => {
    if (!profile?.id) {
      dataStore.showNotification('Faça login para salvar o registro.', 'error');
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

      await dataStore.addAvoidanceCheckin(checkinData);
      await dataStore.fetchAvoidanceCheckins(profile.id);

      setSaveStatus('saved');
      setReflectionSaved(true);
      dataStore.showNotification('Reflexão salva com segurança ✓', 'success');
    } catch (e) {
      console.error(e);
      setSaveStatus('error');
    }
  };

  // Silently register victory status when timer reaches zero successfully 
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
            trigger_note: 'Resisti com o Protocolo Clínico S.O.S. de 15 minutos.',
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

  // Manual fast forward tools for grading and fast design diagnostics
  const skipToPhase = (phase: number) => {
    if (phase === 0) setTimeLeft(14 * 60 + 58);
    else if (phase === 1) setTimeLeft(14 * 60 + 35);
    else if (phase === 2) setTimeLeft(12 * 60 + 58);
    else if (phase === 3) setTimeLeft(4 * 60 + 58);
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
      
      {/* Absolute discretely visible helper exit button on top-right */}
      <button 
        onClick={handleCancel}
        className="absolute top-6 right-6 text-white/20 hover:text-white/70 transition-all p-2 rounded-full hover:bg-white/5 z-[210] cursor-pointer"
        aria-label="Sair"
      >
        <X size={20} />
      </button>

      {/* Top minimalistic metadata space */}
      <div className="flex items-center justify-between w-full shrink-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#10b981]/70 font-mono">
            GUIA DUDE
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Debug speed skip tool for development evaluation */}
          <div className="flex items-center gap-1 bg-white/[0.03] px-2 py-0.5 rounded-lg border border-white/5 opacity-0 hover:opacity-100 transition-opacity">
            <span className="text-[8px] font-mono text-white/20 uppercase tracking-widest">Pulos:</span>
            {[0, 1, 2, 3, 4].map(p => (
              <button 
                key={p} 
                onClick={() => skipToPhase(p)}
                className={`w-4 h-4 text-[9px] font-mono rounded flex items-center justify-center hover:bg-white/10 ${currentPhase === p ? 'bg-emerald-500/20 text-emerald-300' : 'text-white/30'}`}
              >
                {p}
              </button>
            ))}
          </div>

          <button
            onClick={() => setIsAudioEnabled(!isAudioEnabled)}
            className={`p-1.5 rounded-xl transition-all text-xs flex items-center gap-1.5 ${
              isAudioEnabled 
                ? 'text-emerald-400' 
                : 'text-white/25'
            }`}
          >
            {isAudioEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
            <span className="text-[9px] uppercase tracking-widest font-mono select-none">
              {isAudioEnabled ? 'Frequência ON' : 'Mutado'}
            </span>
          </button>
        </div>
      </div>

      {/* Recommendation implicit toast for headphones */}
      <AnimatePresence>
        {showHeadphonesAlert && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-16 left-1/2 -translate-x-1/2 bg-white/5 backdrop-blur-md border border-white/10 px-4 py-2 rounded-full text-center z-50 shadow-2xl pointer-events-none"
          >
            <span className="text-[10px] text-white/60 tracking-wider font-light">
              🎧 Para uma eficácia profunda, recomenda-se o uso de fones de ouvido.
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Immersive Central Stage */}
      <div className="flex-1 w-full flex flex-col justify-center items-center relative py-8 max-w-3xl mx-auto">
        <AnimatePresence mode="wait">
          
          {/* PHASE 0: ABERTURA & ACOLHIMENTO */}
          {currentPhase === 0 && (
            <motion.div 
              key="phase-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.0 }}
              className="flex flex-col items-center justify-center space-y-6 text-center max-w-lg"
            >
              <h2 className="text-xl md:text-2xl lg:text-3xl font-light text-white tracking-wide leading-relaxed px-4">
                "Você não está sozinho. A DUDE assumiu o controle. Apenas siga o guia."
              </h2>
              <p className="text-xs text-white/40 tracking-[0.1em] font-light max-w-xs leading-relaxed uppercase">
                A DUDE está no controle pelos próximos 15 minutos. Apenas confie no processo.
              </p>
            </motion.div>
          )}

          {/* PHASE 1: A "VIAJANTE" (Eye-scanning cognitive deviation) */}
          {currentPhase === 1 && (
            <motion.div 
              key="phase-1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8 }}
              className="w-full h-full flex flex-col justify-between items-center relative py-12"
            >
              {/* Drift Area bounding box */}
              <div className="w-full h-72 md:h-96 relative overflow-hidden rounded-3xl bg-transparent flex items-center justify-center">
                {/* Floating organic traveler orb */}
                <motion.div
                  animate={{ 
                    left: `${targetPos.x}%`, 
                    top: `${targetPos.y}%` 
                  }}
                  transition={{ 
                    duration: 3.2, 
                    ease: "easeInOut" 
                  }}
                  className="absolute w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-400 to-[#10b981] shadow-[0_0_25px_rgba(16,185,129,0.75)]"
                />
              </div>

              {/* Centered Guide message below drifting orb */}
              <div className="text-center space-y-2 select-none z-50 mt-4">
                <span className="text-sm font-medium tracking-wide text-white/90">
                  Acompanhe a luz com o olhar.
                </span>
                <p className="text-[10px] text-white/30 tracking-widest font-mono uppercase">
                  Saturando a memória de trabalho para dissolver impulsos
                </p>
              </div>
            </motion.div>
          )}

          {/* PHASE 2: O "PULSO" (Breathing synchronization and journaling) */}
          {currentPhase === 2 && (
            <motion.div 
              key="phase-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8 }}
              className="w-full flex flex-col items-center justify-center space-y-8"
            >
              {/* Centered Pulsing core breath visualizer */}
              <div className="relative w-36 h-36 flex items-center justify-center">
                <motion.div
                  animate={{
                    scale: breathingState.scale,
                    opacity: breathingState.phase === 'exhale' ? 0.3 : 0.8
                  }}
                  transition={{
                    duration: 1.2,
                    ease: 'easeInOut'
                  }}
                  className="absolute inset-0 rounded-full bg-emerald-500/10 border border-emerald-500/20 blur-sm"
                />
                <motion.div
                  animate={{
                    scale: breathingState.scale * 0.85,
                  }}
                  transition={{
                    duration: 1.2,
                    ease: 'easeInOut'
                  }}
                  className="absolute w-24 h-24 rounded-full bg-gradient-to-tr from-emerald-500/20 to-emerald-400/5 border border-emerald-500/40 flex flex-col items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.15)]"
                >
                  <Heart className="text-emerald-400" size={24} />
                </motion.div>
              </div>

              {/* Sincronização do texto da respiração */}
              <div className="text-center space-y-1 h-12">
                <span className="text-sm font-semibold tracking-wide text-white block">
                  {breathingState.text}
                </span>
                <span className="text-[10px] text-white/30 tracking-widest uppercase font-mono">
                  Guia Clínico de Respiração
                </span>
              </div>

              {/* Frameless Text Area write buffer */}
              <div className="w-full max-w-md space-y-3 pt-4">
                {!reflectionSaved ? (
                  <div className="space-y-3">
                    <textarea
                      value={ghostQuoteContent}
                      onChange={(e) => setGhostQuoteContent(e.target.value)}
                      placeholder="Esvazie sua mente... Sinta-se à vontade para descrever o gatilho que despertou essa vontade ou simplesmente escreva o que está passando pela sua mente agora para relaxar..."
                      className="w-full min-h-[90px] bg-white/[0.02] border border-white/10 hover:border-white/20 focus:border-[#10b981]/50 focus:bg-white/[0.03] transition-all rounded-2xl p-4 text-xs font-light text-white focus:outline-none placeholder-white/20 resize-none leading-relaxed"
                    />
                    <button
                      onClick={saveReflection}
                      disabled={saveStatus === 'saving'}
                      className="w-full py-3.5 px-6 rounded-2xl bg-[#10b981] hover:bg-[#059669] text-black font-bold text-xs uppercase tracking-widest transition-all cursor-pointer shadow-[0_0_20px_rgba(16,185,129,0.2)]"
                    >
                      {saveStatus === 'saving' ? 'Salvando...' : 'GUARDAR REFLEXÃO'}
                    </button>
                  </div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-emerald-500/5 border border-emerald-500/15 rounded-2xl text-center"
                  >
                    <span className="text-xs text-emerald-400 font-bold block">
                      ✓ Registro salvo em segurança.
                    </span>
                    <span className="text-[10px] text-white/30 block mt-1">
                      A reflexão foi adicionada ao seu banco das Sala de Guerra.
                    </span>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}

          {/* PHASE 3: ATERRAMENTO (Vazio) */}
          {currentPhase === 3 && (
            <motion.div 
              key="phase-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8 }}
              className="flex flex-col items-center justify-center space-y-6 text-center max-w-md"
            >
              {/* Minimalist central star glow representing rest and completion */}
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_15px_#10b981,0_0_30px_#10b981] animate-pulse" />

              <div className="space-y-2 px-4 pt-4">
                <h3 className="text-lg font-light tracking-wide text-white">
                  "O pior já passou. Deixe o som levar o resto."
                </h3>
                <p className="text-[10px] text-white/30 tracking-widest font-mono uppercase block">
                  Calibragem Nervosa e Repouso Final
                </p>
              </div>

              {reflectionSaved && (
                <div className="inline-flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-1 rounded-full">
                  <div className="w-1 h-1 rounded-full bg-emerald-400" />
                  <span className="text-[9px] font-mono text-emerald-300 uppercase tracking-widest font-bold">
                    Registro de reflexão persistido
                  </span>
                </div>
              )}
            </motion.div>
          )}

          {/* PHASE 4: THE DESFECHO (Congratulations & Landing base redirect) */}
          {currentPhase === 4 && (
            <motion.div 
              key="phase-4"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.0 }}
              className="flex flex-col items-center justify-center space-y-8 text-center max-w-sm"
            >
              <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-[0_0_25px_rgba(16,185,129,0.1)]">
                <ShieldCheck size={28} />
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-bold tracking-normal uppercase text-white">
                  Excelente. O impulso passou.
                </h3>
                <p className="text-xs text-white/55 font-light leading-relaxed">
                  Você guardou seus compromissos e manteve sua retidão contra vício de <span className="text-emerald-400 font-extrabold">{habitName}</span>.
                </p>
              </div>

              <div className="pt-2 w-full">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="w-full flex items-center justify-center gap-2 py-4 px-6 bg-gradient-to-r from-emerald-400 to-emerald-500 hover:brightness-110 active:scale-[0.99] transition-all text-black font-extrabold text-xs uppercase tracking-widest rounded-2xl cursor-pointer shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                >
                  <ShieldCheck size={16} />
                  VOLTAR PARA A BASE
                </button>
                <p className="text-white/30 text-[10px] tracking-wider mt-3 font-mono uppercase">
                  Excelente. Vá beber um copo d'água.
                </p>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* Bottom timer indicator bar */}
      <div className="w-full shrink-0 flex flex-col justify-end items-center z-50">
        {currentPhase < 4 && (
          <div className="flex flex-col items-center justify-center space-y-1">
            <span className="text-[26px] font-mono font-black text-white select-none tracking-tight">
              {formatMinSec(timeLeft)}
            </span>
            <span className="text-[9px] font-bold text-white/20 uppercase tracking-[0.2em] font-mono">
              Fase {currentPhase} integrada · Tempo Restante
            </span>
          </div>
        )}
      </div>

    </div>
  );
};
