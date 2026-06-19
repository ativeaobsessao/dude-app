import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Brain, Heart, ShieldCheck, PenTool, Volume2, VolumeX, X } from 'lucide-react';
import { useDataStore } from '../../store/useDataStore';
import { getLocalDateString } from '../../lib/utils';

interface UrgeSurfingProtocolProps {
  habitId?: string;
  onClose: () => void;
}

// Browser Tone Generator for real therapeutic Binaural Beat and Solfeggio frequencies
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
      
      // Kept at a soothing, very low background volume (3%)
      this.gainNode.gain.setValueAtTime(0.03, this.ctx.currentTime);

      if (binauralOffset === 0) {
        // Pure single mono frequency (Solfeggio)
        this.oscLeft = this.ctx.createOscillator();
        this.oscLeft.type = 'sine';
        this.oscLeft.frequency.setValueAtTime(frequency, this.ctx.currentTime);
        this.oscLeft.connect(this.gainNode);
      } else {
        // Binaural beat setup (Left ear = target, Right ear = target + offset)
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
      console.warn("Real-time AudioContext creation blocked or un-supported.", e);
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

  // Solfeggio sound effects reference
  const synthRef = useRef<AudioSynthesizer | null>(null);
  
  // Audio Refs
  const audio528Ref = useRef<HTMLAudioElement | null>(null);
  const audio75Ref = useRef<HTMLAudioElement | null>(null);

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

  // Web Audio state controller & Fallback standard audio elements
  useEffect(() => {
    if (!synthRef.current) {
      synthRef.current = new AudioSynthesizer();
    }

    const synth = synthRef.current;
    const audio528 = audio528Ref.current;
    const audio75 = audio75Ref.current;

    if (isAudioEnabled) {
      if (currentPhase === 2) {
        // Local synthesis fallback
        synth.start(528, 0);
        // HTML Audio play loop
        audio75?.pause();
        if (audio528 && audio528.paused) {
          audio528.play().catch(() => {});
        }
      } else if (currentPhase === 3) {
        // Local synthesis fallback
        synth.start(150, 7.5);
        // HTML Audio play loop
        audio528?.pause();
        if (audio75 && audio75.paused) {
          audio75.play().catch(() => {});
        }
      } else {
        synth.stop();
        audio528?.pause();
        audio75?.pause();
      }
    } else {
      synth.stop();
      audio528?.pause();
      audio75?.pause();
    }

    return () => {
      synth.stop();
      audio528?.pause();
      audio75?.pause();
    };
  }, [currentPhase, isAudioEnabled]);

  // Sincronização matemática da respiração para evitar estados dessincronizados na Fase 1
  const breathingState = useMemo(() => {
    if (timeLeft === null) return { phase: 'inhale', text: 'Prepare seu corpo...', scale: 1.0 };
    
    // Cycle duration is 11s
    const cycle = timeLeft % 11;
    // 0 to 4 (4s): scale expands to 1.5
    if (cycle >= 7) {
      return {
        phase: 'inhale',
        text: 'Inspire profundamente...',
        scale: 1.5
      };
    }
    // 4 to 5.5 (1.5s): micro inhale on top, scale increases to 1.6
    else if (cycle >= 5.5) {
      return {
        phase: 'inhale-hold',
        text: 'Puxe mais um pouco...',
        scale: 1.6
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

  // Safe reflection storage and Supabase registration
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

      const result = await dataStore.addAvoidanceCheckin(checkinData);
      await dataStore.fetchAvoidanceCheckins(profile.id);

      setSaveStatus('saved');
      setReflectionSaved(true);
      dataStore.showNotification('Reflexão salva com segurança ✓', 'success');
    } catch (e) {
      console.error(e);
      setSaveStatus('error');
    }
  };

  // Persists standard check-in silently on complete (if not saved already)
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
          setSaveStatus('error');
        }
      };
      persistCheckin();
    }
  }, [timeLeft, saveStatus, profile, habitId]);

  // Manual fast-track for testing or skipped states
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
      <div className="w-full h-[500px] flex items-center justify-center font-mono text-xs text-white/40">
        Iniciando Protocolo S.O.S. ...
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col justify-between text-left font-sans select-none relative min-h-[500px] bg-[#0d0d0d] text-white">
      {/* Hidden standard compliance audio assets */}
      <audio ref={audio528Ref} loop src="/assets/audio/528hz-solfeggio.mp3" style={{ display: 'none' }} />
      <audio ref={audio75Ref} loop src="/assets/audio/7-5hz-theta.mp3" style={{ display: 'none' }} />

      {/* Discrete Top Left Custom Absolute Close Button */}
      <button 
        onClick={handleCancel}
        className="absolute top-0 -right-2 text-white/35 hover:text-white/80 transition-colors p-1.5 rounded-full hover:bg-white/5 z-50 cursor-pointer"
        aria-label="Sair"
      >
        <X size={16} />
      </button>

      {/* Top Protocol Status Bar */}
      <div className="flex items-center justify-between border-b border-white/[0.06] pb-4 shrink-0 pr-6">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
          <span className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-red-400">
            PROTOCOLO S.O.S. ATIVO
          </span>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Debug speed skip tool for development evaluation */}
          <div className="flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded-lg border border-white/5 opacity-40 hover:opacity-100 transition-opacity">
            <span className="text-[9px] font-mono text-white/40">Fases:</span>
            {[0, 1, 2, 3, 4].map(p => (
              <button 
                key={p} 
                onClick={() => skipToPhase(p)}
                className={`w-4 h-4 text-[9px] font-mono rounded flex items-center justify-center hover:bg-white/10 ${currentPhase === p ? 'bg-red-500/20 text-red-300 border border-red-500/30' : 'text-white/60'}`}
              >
                {p}
              </button>
            ))}
          </div>

          <button
            onClick={() => setIsAudioEnabled(!isAudioEnabled)}
            className={`p-1.5 rounded-xl border transition-all text-xs flex items-center gap-1.5 font-bold ${
              isAudioEnabled 
                ? 'bg-red-500/10 border-red-500/20 text-red-400' 
                : 'bg-white/5 border-white/10 text-white/40'
            }`}
            title="Sintetizador Binaural de Ondas"
          >
            {isAudioEnabled ? <Volume2 size={12} /> : <VolumeX size={12} />}
            <span className="text-[9px] uppercase tracking-wider font-mono">
              {isAudioEnabled ? 'Frequência ON' : 'Mutado'}
            </span>
          </button>
        </div>
      </div>

      {/* Deep Immersive Space Wrapper */}
      <div className="flex-1 flex flex-col justify-center py-6 min-h-[320px]">
        
        {/* PHASE 0: O ACOLHIMENTO */}
        {currentPhase === 0 && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center space-y-6 text-center max-w-sm mx-auto"
          >
            <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mx-auto mb-1 animate-pulse">
              <Brain size={28} />
            </div>
            <h4 className="text-xs font-black uppercase tracking-[0.25em] text-red-400 font-mono">
              Acolhimento Imediato
            </h4>
            <p className="text-xs md:text-sm text-text-secondary/80 leading-relaxed font-light font-sans text-center">
              Sabemos que você está passando por uma crise de ansiedade ou na iminência de ceder a um impulso. Você não precisa lutar sozinho agora. A DUDE assumiu o controle pelos próximos 15 minutos. Apenas confie no processo.
            </p>
            <div className="w-6 h-0.5 bg-red-500/20 rounded-full animate-pulse" />
          </motion.div>
        )}

        {/* PHASE 1: RESPIRAÇÃO AUTONÔMICA (Freio Físico) */}
        {currentPhase === 1 && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center space-y-8 text-center"
          >
            <div className="space-y-2">
              <h4 className="text-xs font-black uppercase tracking-[0.2em] text-red-400">
                Passo 1: Vamos acalmar seu corpo.
              </h4>
              <p className="text-[11px] text-text-secondary/60 max-w-sm mx-auto">
                Desative os impulsos simpáticos e reduza a taquicardia instilando dióxido de carbono via nervo vago.
              </p>
            </div>

            {/* Expansible Core Breath visual circle indicator */}
            <div className="relative w-36 h-36 flex items-center justify-center">
              <motion.div
                animate={{
                  scale: breathingState.scale,
                  opacity: breathingState.phase === 'exhale' ? 0.35 : 0.8
                }}
                transition={{
                  duration: 1.2,
                  ease: 'easeInOut'
                }}
                className="absolute inset-0 rounded-full bg-red-500/10 border border-red-500/30 blur-sm"
              />
              <motion.div
                animate={{
                  scale: breathingState.scale * 0.85,
                }}
                transition={{
                  duration: 1.2,
                  ease: 'easeInOut'
                }}
                className="absolute w-28 h-28 rounded-full bg-gradient-to-tr from-rose-500/30 to-red-500/10 border border-red-500/50 flex flex-col items-center justify-center shadow-[0_0_30px_rgba(239,68,68,0.15)]"
              >
                <Heart className={`text-red-400 ${breathingState.phase !== 'exhale' ? 'animate-pulse' : ''}`} size={28} />
              </motion.div>
            </div>

            {/* Guided Instruction labels */}
            <div className="h-10 px-4">
              <p className="text-sm font-bold text-text-primary tracking-wide leading-relaxed animate-pulse">
                {breathingState.text}
              </p>
            </div>
          </motion.div>
        )}

        {/* PHASE 2: OCUPAÇÃO COGNITIVA E ESCRITA (EMDR & Journaling) */}
        {currentPhase === 2 && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col space-y-6"
          >
            {/* Header banner */}
            <div className="text-center space-y-1">
              <h4 className="text-xs font-black uppercase tracking-[0.2em] text-[#6ee7a8]">
                Passo 2: Acompanhe a luz com os olhos.
              </h4>
              <p className="text-[11px] text-text-secondary/60 max-w-xs mx-auto">
                Mantenha os olhos girando horizontalmente para saturar os recursos da memória de trabalho.
              </p>
            </div>

            {/* Horizontally sliding light node */}
            <div className="w-full h-8 bg-white/[0.02] border border-white/[0.04] rounded-2xl relative overflow-hidden flex items-center">
              <div className="absolute left-4 right-4 text-[9px] font-mono text-white/10 flex justify-between pointer-events-none select-none uppercase tracking-widest font-bold">
                <span>OLHOS ESQUERDA</span>
                <span>DESVIO GATILHO</span>
                <span>OLHOS DIREITA</span>
              </div>
              <motion.div
                animate={{
                  x: ['4%', '92%', '4%']
                }}
                transition={{
                  duration: 2.5,
                  repeat: Infinity,
                  ease: 'easeInOut'
                }}
                className="w-4 h-4 rounded-full bg-[#6ee7a8] filter blur-[2px] shadow-[0_0_15px_rgba(110,231,168,0.7)] absolute"
              />
            </div>

            {/* Embedded journaling input buffer */}
            {!reflectionSaved ? (
              <div className="space-y-2 mt-2 text-left">
                <div className="flex items-center gap-1.5 border-b border-white/5 pb-2">
                  <PenTool size={12} className="text-[#6ee7a8]/60" />
                  <span className="text-[10px] font-bold text-[#6ee7a8]/80 uppercase tracking-[0.15em]">
                    Esvazie sua mente
                  </span>
                </div>
                <textarea
                  value={ghostQuoteContent}
                  onChange={(e) => setGhostQuoteContent(e.target.value)}
                  placeholder="Quer realizar algum registro pertinente? Sinta-se à vontade para descrever o gatilho que despertou essa vontade ou simplesmente escreva o que está passando pela sua mente agora para relaxar..."
                  className="w-full min-h-[90px] bg-white/[0.03] border border-white/10 focus:border-[#6ee7a8]/40 rounded-2xl p-4 text-xs text-text-primary focus:outline-none transition-all resize-none placeholder-text-secondary/30"
                />
                <button
                  onClick={saveReflection}
                  disabled={saveStatus === 'saving'}
                  className="w-full text-center py-3 bg-gradient-to-r from-emerald-400 to-green-500 hover:brightness-110 disabled:opacity-50 text-[#032d18] font-black text-xs uppercase tracking-wider rounded-xl cursor-pointer"
                >
                  {saveStatus === 'saving' ? 'Gravando...' : 'GUARDAR REFLEXÃO'}
                </button>
              </div>
            ) : (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-5 bg-emerald-500/5 border border-emerald-500/25 rounded-2xl text-center space-y-1"
              >
                <p className="text-xs text-emerald-400 font-bold">✓ Registro salvo em segurança.</p>
                <p className="text-[10px] text-emerald-400/50 font-mono">A fissura gradativamente perde sua força.</p>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* PHASE 3: ATERRAMENTO (Theta frequency calming) */}
        {currentPhase === 3 && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center space-y-6 text-center"
          >
            <div className="space-y-1">
              <h4 className="text-xs font-black uppercase tracking-[0.2em] text-cyan-400">
                Passo 3: O pior já passou.
              </h4>
              <p className="text-[11px] text-text-secondary/60">
                O pico do craving se dissolveu. Permaneça em estado de repouso neural.
              </p>
            </div>

            {/* Visual affirmation card */}
            <div className="py-6 px-4 bg-white/[0.02] border border-white/5 rounded-2xl max-w-sm w-full mx-auto min-h-[90px] flex items-center justify-center">
              <p className="text-sm font-light text-text-primary italic leading-relaxed tracking-wide">
                "Apenas deixe a frequência levar o resto do impulso embora."
              </p>
            </div>

            <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-1.5 rounded-full select-none">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-[10px] font-mono text-emerald-300 font-bold block uppercase tracking-wider">
                ✓ Registro salvo em segurança
              </span>
            </div>
          </motion.div>
        )}

        {/* PHASE 4: COMPLETED (Successfully completed the 15-minute rescue trip) */}
        {currentPhase === 4 && (
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center space-y-6 text-center py-4"
          >
            <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
              <ShieldCheck size={36} className="animate-bounce" />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg md:text-xl font-black text-text-primary uppercase tracking-wider">
                Excelente. O impulso passou.
              </h3>
              <p className="text-xs text-text-secondary/80 max-w-xs mx-auto">
                Você concluiu com maestria o ciclo de blindagem neurofisiológica contra <span className="text-emerald-400 font-extrabold">{habitName}</span>.
              </p>
            </div>

            <div className="pt-2 w-full max-w-xs">
              <button
                type="button"
                onClick={handleCancel}
                className="w-full flex items-center justify-center gap-2 py-4 px-6 bg-gradient-to-r from-emerald-400 to-green-500 hover:brightness-110 active:scale-[0.99] transition-all text-[#032d18] font-black text-xs md:text-sm uppercase tracking-widest rounded-3xl cursor-pointer shadow-[0_0_20px_rgba(16,185,129,0.25)]"
              >
                <ShieldCheck size={18} />
                VOLTAR PARA A BASE
              </button>
              <p className="text-[11px] text-text-secondary/50 mt-3 font-medium">
                Agora levante, beba um copo d'água ou faça um alongamento breve.
              </p>
            </div>
          </motion.div>
        )}

      </div>

      {/* Footer countdown & quick-action buttons */}
      <div className="border-t border-white/[0.06] pt-4 shrink-0 flex flex-col gap-4">
        
        {/* Countdown indicator */}
        {currentPhase < 4 && (
          <div className="flex items-center justify-between pr-6">
            <span className="text-[10px] font-bold text-text-secondary/40 uppercase tracking-widest font-mono select-none">
              Blindagem Temporal
            </span>
            <span className="text-2xl font-mono font-black text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-white drop-shadow-[0_0_10px_rgba(239,68,68,0.15)] leading-none select-none">
              {formatMinSec(timeLeft)}
            </span>
          </div>
        )}

        {/* Dynamic CTA buttons */}
        {currentPhase < 4 && (
          <div className="flex gap-3">
            <button
              onClick={handleCancel}
              className="flex-1 text-center py-3 px-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/[0.08] text-white/50 text-[10px] font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer"
            >
              Cancelar Protocolo
            </button>

            <button
              onClick={() => skipToPhase(4)}
              className="flex-1 text-center py-3 px-4 rounded-xl bg-red-500/10 border border-red-500/35 hover:bg-red-500/15 text-red-300 text-[10px] font-black uppercase tracking-wider transition-all duration-200 cursor-pointer"
            >
              Já me sinto melhor ✓
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
