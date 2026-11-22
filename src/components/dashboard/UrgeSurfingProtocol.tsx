import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { Volume2, VolumeX, X, ShieldCheck, Send, Sparkles, Maximize, Minimize, CheckCircle2 } from 'lucide-react';
import { useDataStore } from '../../store/useDataStore';
import {
  GUIDED_SESSION_SECONDS,
  getBallTravelConfig,
  getGuidedBreathingState,
  getGuidedPhase,
  getInfiniteAct
} from '../../lib/guidedSession';

interface UrgeSurfingProtocolProps {
  key?: string | number;
  habitId?: string;
  onClose: () => void;
}

// Geração opcional de som ambiente. O áudio só é iniciado após uma ação explícita do usuário.
class AudioSynthesizer {
  private ctx: AudioContext | null = null;
  private oscLeft: OscillatorNode | null = null;
  private oscRight: OscillatorNode | null = null;
  private gainNode: GainNode | null = null;
  private compressorNode: DynamicsCompressorNode | null = null;
  private pannerLeft: StereoPannerNode | null = null;
  private pannerRight: StereoPannerNode | null = null;
  private currentFreq = 0;
  private currentOffset = 0;

  async start(frequency: number, binauralOffset = 0, volumeMultiplier = 1): Promise<boolean> {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return false;

      if (this.ctx && this.ctx.state === 'closed') this.stop();

      if (!this.ctx) {
        this.ctx = new AudioContextClass();
        const ctx = this.ctx;
        this.gainNode = ctx.createGain();
        this.compressorNode = ctx.createDynamicsCompressor();

        this.compressorNode.threshold.setValueAtTime(-18, ctx.currentTime);
        this.compressorNode.knee.setValueAtTime(24, ctx.currentTime);
        this.compressorNode.ratio.setValueAtTime(8, ctx.currentTime);
        this.compressorNode.attack.setValueAtTime(0.01, ctx.currentTime);
        this.compressorNode.release.setValueAtTime(0.3, ctx.currentTime);
        this.gainNode.gain.setValueAtTime(0, ctx.currentTime);
        this.gainNode.connect(this.compressorNode);
        this.compressorNode.connect(ctx.destination);

        this.oscLeft = ctx.createOscillator();
        this.oscRight = ctx.createOscillator();
        this.oscLeft.type = 'sine';
        this.oscRight.type = 'sine';
        this.oscLeft.frequency.setValueAtTime(frequency, ctx.currentTime);
        this.oscRight.frequency.setValueAtTime(frequency + binauralOffset, ctx.currentTime);

        if (ctx.createStereoPanner) {
          this.pannerLeft = ctx.createStereoPanner();
          this.pannerRight = ctx.createStereoPanner();
          this.pannerLeft.pan.setValueAtTime(0, ctx.currentTime);
          this.pannerRight.pan.setValueAtTime(0, ctx.currentTime);
          this.oscLeft.connect(this.pannerLeft).connect(this.gainNode);
          this.oscRight.connect(this.pannerRight).connect(this.gainNode);
        } else {
          this.oscLeft.connect(this.gainNode);
          this.oscRight.connect(this.gainNode);
        }

        this.oscLeft.start();
        this.oscRight.start();
      }

      if (this.ctx.state === 'suspended') {
        await this.ctx.resume();
      }
      if (this.ctx.state !== 'running' || !this.gainNode || !this.oscLeft) return false;

      const currentTime = this.ctx.currentTime;
      const safeVolume = Math.min(0.08, Math.max(0, 0.035 * volumeMultiplier));
      if (this.currentFreq !== frequency || this.currentOffset !== binauralOffset) {
        this.oscLeft.frequency.setTargetAtTime(frequency, currentTime, 0.12);
        this.oscRight?.frequency.setTargetAtTime(frequency + binauralOffset, currentTime, 0.12);
      }
      if (this.pannerLeft && this.pannerRight) {
        this.pannerLeft.pan.setTargetAtTime(binauralOffset !== 0 ? -1 : 0, currentTime, 0.15);
        this.pannerRight.pan.setTargetAtTime(binauralOffset !== 0 ? 1 : 0, currentTime, 0.15);
      }
      this.gainNode.gain.setTargetAtTime(safeVolume, currentTime, 0.2);
      this.currentFreq = frequency;
      this.currentOffset = binauralOffset;
      return true;
    } catch (error) {
      console.warn('Não foi possível iniciar o som ambiente.', error);
      return false;
    }
  }

  isRunning(): boolean {
    return this.ctx?.state === 'running';
  }

  stop() {
    const ctx = this.ctx;
    const oscLeft = this.oscLeft;
    const oscRight = this.oscRight;
    const gainNode = this.gainNode;
    const compressorNode = this.compressorNode;
    const pannerLeft = this.pannerLeft;
    const pannerRight = this.pannerRight;

    this.currentFreq = 0;
    this.currentOffset = 0;
    this.ctx = null;
    this.oscLeft = null;
    this.oscRight = null;
    this.gainNode = null;
    this.compressorNode = null;
    this.pannerLeft = null;
    this.pannerRight = null;

    if (!ctx) return;

    try {
      if (gainNode && ctx.state !== 'closed') {
        gainNode.gain.setTargetAtTime(0, ctx.currentTime, 0.08);
      }
    } catch {
      // O navegador pode já ter encerrado o contexto.
    }

    window.setTimeout(() => {
      try {
        if (oscLeft) { try { oscLeft.stop(); } catch {} oscLeft.disconnect(); }
        if (oscRight) { try { oscRight.stop(); } catch {} oscRight.disconnect(); }
        gainNode?.disconnect();
        compressorNode?.disconnect();
        pannerLeft?.disconnect();
        pannerRight?.disconnect();
        if (ctx.state !== 'closed') void ctx.close().catch(() => {});
      } catch {
        // Limpeza segura mesmo se o navegador já tiver descartado os nós.
      }
    }, 120);
  }

}

export const UrgeSurfingProtocol = ({ habitId, onClose }: UrgeSurfingProtocolProps) => {
  const profileId = useDataStore(state => state.profile?.id);
  const habits = useDataStore(state => state.habits);
  const addInboxCapture = useDataStore(state => state.addInboxCapture);
  const showNotification = useDataStore(state => state.showNotification);
  const prefersReducedMotion = useReducedMotion();

  const currentHabit = habits.find(h => h.id === habitId);
  const habitName = currentHabit?.name || 'este comportamento';
  const sessionStorageKey = `dude_guided_pause_end_time_${habitId || 'general'}`;
  const legacyStorageKey = `urge_surfing_5min_end_time_${habitId || 'general'}`;

  // A duração total permanece em 3min33s; as etapas internas foram alinhadas
  // para terminar cada transição somente depois de uma expiração completa.
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [endAt, setEndAt] = useState<number | null>(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [audioUnavailable, setAudioUnavailable] = useState(false);
  const [ghostQuoteContent, setGhostQuoteContent] = useState<string>('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [reflectionSaved, setReflectionSaved] = useState<boolean>(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState<boolean>(false);
  const [showCloseConfirmation, setShowCloseConfirmation] = useState(false);

  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1024
  );

  // Fullscreen Native Engine (Desktop)
  const [isFullscreen, setIsFullscreen] = useState(false);
  const toggleFullscreen = async () => {
    const element = document.getElementById('urge_surfing_portal_screen');
    if (!element) return;
    try {
      if (!document.fullscreenElement) {
        await element.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      showNotification('Não foi possível alterar a visualização em tela cheia.', 'error');
    }
  };

  // Tempo adicional após a primeira sessão.
  const [isInfiniteMode, setIsInfiniteMode] = useState(false);
  const [infiniteSeconds, setInfiniteSeconds] = useState(0);
  const [infiniteStartedAt, setInfiniteStartedAt] = useState<number | null>(null);
  const [isEncruzilhada, setIsEncruzilhada] = useState(false);
  const [infiniteNote, setInfiniteNote] = useState('');

  // Sound generator reference
  const synthRef = useRef<AudioSynthesizer | null>(null);
  // Screen Wake Lock API reference
  const wakeLockRef = useRef<any>(null);

  // Mantém a tela ativa durante a pausa quando o navegador oferece suporte.
  useEffect(() => {
    let disposed = false;
    const requestWakeLock = async () => {
      try {
        if (document.visibilityState !== 'visible' || !('wakeLock' in navigator)) return;
        if (wakeLockRef.current && !wakeLockRef.current.released) return;
        const sentinel = await (navigator as any).wakeLock.request('screen');
        if (disposed) {
          await sentinel.release();
          return;
        }
        wakeLockRef.current = sentinel;
        sentinel.addEventListener('release', () => {
          if (wakeLockRef.current === sentinel) wakeLockRef.current = null;
        });
      } catch (error) {
        console.warn('Não foi possível manter a tela ativa:', error);
      }
    };

    void requestWakeLock();
    document.addEventListener('visibilitychange', requestWakeLock);
    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', requestWakeLock);
      if (wakeLockRef.current) {
        void wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
    };
  }, []);

  // Mantém o estado do botão de tela cheia sincronizado com o navegador.
  useEffect(() => {
    const syncFullscreenState = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', syncFullscreenState);
    return () => document.removeEventListener('fullscreenchange', syncFullscreenState);
  }, []);

  // Recalcula a largura disponível para manter a mesma velocidade da luz em telas diferentes.
  useEffect(() => {
    const updateViewportWidth = () => setViewportWidth(window.innerWidth);
    updateViewportWidth();
    window.addEventListener('resize', updateViewportWidth, { passive: true });
    return () => window.removeEventListener('resize', updateViewportWidth);
  }, []);

  // Recupera uma sessão em andamento usando um horário final absoluto.
  // Isso evita que o contador perca segundos quando o navegador suspende a aba.
  useEffect(() => {
    const now = Date.now();
    const storedValue = localStorage.getItem(sessionStorageKey) || localStorage.getItem(legacyStorageKey);
    const storedEndAt = storedValue ? Number.parseInt(storedValue, 10) : Number.NaN;
    const isValidStoredSession = Number.isFinite(storedEndAt)
      && storedEndAt > now
      && storedEndAt <= now + GUIDED_SESSION_SECONDS * 1000;
    const nextEndAt = isValidStoredSession ? storedEndAt : now + GUIDED_SESSION_SECONDS * 1000;

    localStorage.setItem(sessionStorageKey, String(nextEndAt));
    localStorage.removeItem(legacyStorageKey);
    setEndAt(nextEndAt);
    setTimeLeft(Math.max(0, Math.ceil((nextEndAt - now) / 1000)));
  }, [sessionStorageKey, legacyStorageKey]);

  // Relógio baseado no tempo real, atualizado em intervalos curtos e sem acumular atraso.
  useEffect(() => {
    if (endAt === null || isInfiniteMode || isEncruzilhada) return;

    const updateRemainingTime = () => {
      const remaining = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
      const hasUnsentReflection = ghostQuoteContent.trim().length > 0 && !reflectionSaved;
      if (remaining <= 1 && hasUnsentReflection) {
        setTimeLeft(previous => previous === 1 ? previous : 1);
        return;
      }

      setTimeLeft(previous => previous === remaining ? previous : remaining);
      if (remaining === 0) {
        localStorage.removeItem(sessionStorageKey);
        setIsEncruzilhada(true);
      }
    };

    updateRemainingTime();
    const timer = window.setInterval(updateRemainingTime, 250);
    return () => window.clearInterval(timer);
  }, [endAt, isInfiniteMode, isEncruzilhada, ghostQuoteContent, reflectionSaved, sessionStorageKey]);

  // O tempo adicional também usa um horário de início absoluto.
  useEffect(() => {
    if (!isInfiniteMode || infiniteStartedAt === null) return;
    const updateElapsedTime = () => {
      const elapsed = Math.max(0, Math.floor((Date.now() - infiniteStartedAt) / 1000));
      setInfiniteSeconds(previous => previous === elapsed ? previous : elapsed);
    };
    updateElapsedTime();
    const timer = window.setInterval(updateElapsedTime, 250);
    return () => window.clearInterval(timer);
  }, [isInfiniteMode, infiniteStartedAt]);

  // Atualiza a disponibilidade do áudio caso o navegador suspenda o contexto em segundo plano.
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && isAudioEnabled && synthRef.current && !synthRef.current.isRunning()) {
        setIsAudioEnabled(false);
        setAudioUnavailable(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [isAudioEnabled]);

  // As etapas são calculadas por uma única regra compartilhada e testável.
  const currentPhase = useMemo(
    () => getGuidedPhase(timeLeft, isInfiniteMode, isEncruzilhada),
    [timeLeft, isInfiniteMode, isEncruzilhada]
  );

  const infiniteAct = useMemo(() => getInfiniteAct(infiniteSeconds), [infiniteSeconds]);

  const breathingState = useMemo(
    () => getGuidedBreathingState(currentPhase, timeLeft, infiniteSeconds),
    [currentPhase, timeLeft, infiniteSeconds]
  );

  const breathingScale = useMemo(() => {
    if (prefersReducedMotion) {
      return { outer: 1, middle: 1, inner: 1, core: 1 };
    }
    if (breathingState.phase === 'inhale') {
      return { outer: 2.8, middle: 2.2, inner: 1.6, core: 1.2 };
    }
    if (breathingState.phase === 'hold') {
      return { outer: 2.9, middle: 2.3, inner: 1.7, core: 1.25 };
    }
    return { outer: 1, middle: 1, inner: 1, core: 1 };
  }, [breathingState.phase, prefersReducedMotion]);

  const ballTravel = useMemo(() => getBallTravelConfig(viewportWidth), [viewportWidth]);

  // O som é opcional e só toca depois que o usuário o ativa.
  useEffect(() => {
    if (!synthRef.current) synthRef.current = new AudioSynthesizer();
    const synth = synthRef.current;

    if (!isAudioEnabled) {
      synth.stop();
      return;
    }

    if (currentPhase === 0 || currentPhase === 1) {
      void synth.start(432, 0, 1);
    } else if (currentPhase === 2) {
      void synth.start(220, 0, 1);
    } else if (currentPhase === 3) {
      void synth.start(150, 7.5, 1);
    } else if (currentPhase === 5) {
      const cycleTime = infiniteSeconds % 840;
      if (cycleTime < 180) void synth.start(432, 0, 1);
      else if (cycleTime < 360) void synth.start(174, 0, 1);
      else if (cycleTime < 540) void synth.start(220, 0, 1);
      else void synth.start(220, 7.5, 1);
    } else {
      void synth.start(432, 0, 0.7);
    }
  }, [currentPhase, isAudioEnabled, infiniteSeconds]);

  const toggleAudio = async () => {
    if (isAudioEnabled) {
      synthRef.current?.stop();
      setIsAudioEnabled(false);
      setAudioUnavailable(false);
      return;
    }

    if (!synthRef.current) synthRef.current = new AudioSynthesizer();
    const synth = synthRef.current;
    let frequency = 432;
    let offset = 0;
    if (currentPhase === 2) frequency = 220;
    if (currentPhase === 3) { frequency = 150; offset = 7.5; }
    if (currentPhase === 5) {
      const cycleTime = infiniteSeconds % 840;
      if (cycleTime >= 540) offset = 7.5;
      if (cycleTime >= 360) frequency = 220;
      else if (cycleTime >= 180) frequency = 174;
    }

    const started = await synth.start(frequency, offset, 1);
    if (started) {
      setAudioUnavailable(false);
      setIsAudioEnabled(true);
    } else {
      setAudioUnavailable(true);
      setIsAudioEnabled(false);
      showNotification('O navegador não permitiu iniciar o som. Você pode continuar sem áudio.', 'error');
    }
  };

  useEffect(() => {
    return () => {
      synthRef.current?.stop();
      synthRef.current = null;
    };
  }, []);

  // SVG progressive ring stroke coefficients
  const timerCircleProps = useMemo(() => {
    const radius = 64;
    const strokeWidth = 5;
    const circumference = 2 * Math.PI * radius; // Approx 402.12
    const totalDuration = 213; // 213s
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

  // A pausa guiada salva apenas uma anotação opcional. Ela nunca cria
  // nem altera um registro de resistência ou recaída.
  const saveReflection = async () => {
    if (!profileId) {
      showNotification('Entre na sua conta para salvar esta anotação.', 'error');
      return;
    }

    const currentText = isInfiniteMode ? infiniteNote.trim() : ghostQuoteContent.trim();
    if (!currentText) {
      setSaveStatus('saved');
      if (isInfiniteMode) {
        showNotification('Tudo bem continuar sem anotar.', 'success');
      } else {
        setReflectionSaved(true);
        showNotification('Você pode seguir sem escrever nada.', 'success');
      }
      return;
    }

    setSaveStatus('saving');
    try {
      const contextLabel = habitId ? ` — ${habitName}` : '';
      const capture = await addInboxCapture(
        profileId,
        `[Pausa guiada${contextLabel}]\n${currentText}`
      );

      if (!capture) {
        setSaveStatus('error');
        showNotification('Não foi possível salvar sua anotação. Tente novamente.', 'error');
        return;
      }

      showNotification('Anotação salva.', 'success');
      setSaveStatus('saved');
      if (isInfiniteMode) {
        setInfiniteNote('');
        setShowSaveSuccess(true);
        window.setTimeout(() => {
          setShowSaveSuccess(false);
          setSaveStatus('idle');
        }, 2500);
      } else {
        setReflectionSaved(true);
      }
    } catch (error) {
      console.error('Erro ao salvar anotação da pausa guiada:', error);
      setSaveStatus('error');
      showNotification('Não foi possível salvar sua anotação. Tente novamente.', 'error');
    }
  };

  const handleCancel = () => {
    localStorage.removeItem(sessionStorageKey);
    localStorage.removeItem(legacyStorageKey);
    setTimeLeft(null);
    setEndAt(null);
    setIsAudioEnabled(false);
    setShowCloseConfirmation(false);
    synthRef.current?.stop();
    synthRef.current = null;
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
    }
    onClose();
  };

  const requestClose = () => setShowCloseConfirmation(true);

  const formatMinSec = (secs: number) => {
    const mm = Math.floor(secs / 60);
    const ss = secs % 60;
    return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  };


  // Construct UI payload using safe standard portal injection
  return createPortal(
    <div 
      id="urge_surfing_portal_screen"
      style={{ isolation: 'isolate' }}
      className="fixed inset-0 w-full h-full bg-[#030303] text-white z-[9999] flex flex-col justify-between p-6 md:p-12 overflow-hidden select-none outline-none font-sans"
    >
      {/* Controle de fechamento */}
      <button 
        id="sos_esc_button"
        onClick={requestClose}
        className="absolute top-6 right-6 text-white/20 hover:text-white/80 hover:scale-105 active:scale-95 transition-all p-3 rounded-full hover:bg-white/5 z-[10000] cursor-pointer"
        aria-label="Fechar pausa"
      >
        <X size={22} />
      </button>

      {/* Symmetrical audio mute button placed elegantly in top-left to replace clutter */}
      <div className="absolute top-6 left-6 z-[10000]">
        <button
          onClick={toggleAudio}
          aria-pressed={isAudioEnabled}
          aria-label={isAudioEnabled ? 'Desativar som' : 'Ativar som'}
          className={`p-3 rounded-xl transition-all text-xs flex items-center gap-2 hover:bg-white/5 ${
            isAudioEnabled
              ? 'text-emerald-300 hover:text-emerald-200'
              : 'text-white/45 hover:text-white/75'
          }`}
        >
          {isAudioEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
          <span className="text-[9px] tracking-[0.08em] font-medium select-none hidden sm:inline">
            {isAudioEnabled ? 'Som ligado' : audioUnavailable ? 'Som indisponível' : 'Ativar som'}
          </span>
        </button>
      </div>

      {/* Main active stage content area */}
      <div className="flex-1 w-full flex flex-col items-center justify-center relative py-6 max-w-2xl mx-auto space-y-6">
        
        {/* Indicador circular de tempo */}
        {currentPhase >= 0 && currentPhase <= 3 && (
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
                PAUSA
              </span>
            </div>
          </div>
        )}

        {/* INFINITE MODE COUNTER: Minimalist upward ring */}
        {currentPhase === 5 && (
          <div className="relative w-36 h-36 flex items-center justify-center shrink-0">
            <div className={`absolute inset-0 rounded-full bg-emerald-500/5 border border-emerald-500/10 blur-sm ${prefersReducedMotion ? '' : 'animate-pulse'}`} />
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-3xl font-mono font-black text-emerald-400 tracking-tighter">
                {formatMinSec(infiniteSeconds)}
              </span>
              <span className="text-[7.5px] font-black text-emerald-500/55 uppercase tracking-[0.2em] font-mono mt-1">
                TEMPO ADICIONAL
              </span>
            </div>
          </div>
        )}

        {/* MUTUALLY EXCLUSIVE SCENE RENDER CHANNELS */}
        <div className="w-full flex-1 flex flex-col justify-center items-center relative min-h-[340px]">
          <AnimatePresence mode="wait">
            
            {/* ABERTURA (8 segundos) */}
            {currentPhase === 0 && (
              <motion.div 
                key="phase-0"
                initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 15 }}
                animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -15 }}
                transition={{ duration: prefersReducedMotion ? 0.15 : 1.0, ease: "easeOut" }}
                className="flex flex-col items-center justify-center space-y-8 text-center max-w-xl px-6"
              >
                <h2 className="text-2xl md:text-3xl font-light text-white/95 leading-relaxed tracking-wide">
                  Você não precisa resolver tudo agora. Vamos criar um pouco de espaço para respirar.
                </h2>
                <div className="h-[1px] w-12 bg-white/10" />
                <span className="text-xs text-white/40">Um momento de cada vez.</span>
              </motion.div>
            )}

            {/* Fase 1: respiração guiada */}
            {currentPhase === 1 && (
              <motion.div 
                key="phase-1"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.0 }}
                className="w-full h-full absolute inset-0 flex flex-col justify-center items-center overflow-visible"
              >
                <AnimatePresence mode="wait">
                  {/* Primeira sequência de respiração */}
                  {timeLeft !== null && timeLeft > 148 && (
                    <motion.div
                      key="phase-1a-lotus"
                      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
                      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
                      exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
                      transition={{ duration: prefersReducedMotion ? 0.15 : 0.8 }}
                      className="flex flex-col items-center justify-center space-y-12"
                    >
                      {/* 4x Layered concentric expanding lotus circles */}
                      <div className="relative w-40 h-40 flex items-center justify-center">
                        <motion.div
                          animate={{
                            scale: breathingScale.outer,
                          }}
                          transition={{
                            duration: breathingState.duration,
                            ease: "easeInOut"
                          }}
                          className="absolute w-40 h-40 rounded-full bg-emerald-500/10"
                        />
                        <motion.div
                          animate={{
                            scale: breathingScale.middle,
                          }}
                          transition={{
                            duration: breathingState.duration,
                            ease: "easeInOut"
                          }}
                          className="absolute w-40 h-40 rounded-full bg-emerald-500/20"
                        />
                        <motion.div
                          animate={{
                            scale: breathingScale.inner,
                          }}
                          transition={{
                            duration: breathingState.duration,
                            ease: "easeInOut"
                          }}
                          className="absolute w-40 h-40 rounded-full bg-emerald-500/30"
                        />
                        <motion.div
                          animate={{
                            scale: breathingScale.core,
                          }}
                          transition={{
                            duration: breathingState.duration,
                            ease: "easeInOut"
                          }}
                          className="absolute w-40 h-40 rounded-full bg-emerald-400 shadow-[0_0_30px_rgba(52,211,153,0.4)]"
                        />
                      </div>

                      {/* Breathing status instructions */}
                      <div className="text-center space-y-3">
                        <span aria-live="polite" className="text-xl font-light tracking-wide text-white block">
                          {breathingState.text}
                        </span>
                        <span aria-hidden="true" className="text-4xl font-mono font-extrabold text-white/40 block leading-none tracking-tighter">
                          {breathingState.countText}
                        </span>
                        <span className="block text-[11px] text-white/35">Se alguma etapa não for confortável, volte à respiração natural.</span>
                      </div>
                    </motion.div>
                  )}

                  {/* Transição breve após a expiração completa */}
                  {timeLeft !== null && timeLeft <= 148 && timeLeft > 143 && (
                    <motion.div
                      key="phase-1-text"
                      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
                      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
                      exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
                      transition={{ duration: prefersReducedMotion ? 0.15 : 0.8 }}
                      className="flex flex-col items-center justify-center space-y-8 text-center max-w-xl px-6"
                    >
                      <h2 className="text-2xl md:text-3xl font-light text-white/95 leading-relaxed tracking-wide">
                        Você já completou alguns ciclos. Agora, vamos continuar com suavidade.
                      </h2>
                      <div className="h-[1px] w-12 bg-white/10" />
                      <span className="text-[10px] text-white/35 tracking-[0.3em] font-mono uppercase">
                        Vamos seguir em outro ritmo.
                      </span>
                    </motion.div>
                  )}

                  {/* Segunda sequência de respiração */}
                  {timeLeft !== null && timeLeft <= 143 && (
                    <motion.div
                      key="phase-1b-lotus"
                      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
                      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
                      exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
                      transition={{ duration: prefersReducedMotion ? 0.15 : 0.8 }}
                      className="flex flex-col items-center justify-center space-y-12"
                    >
                      {/* 4x Layered concentric expanding lotus circles */}
                      <div className="relative w-40 h-40 flex items-center justify-center">
                        <motion.div
                          animate={{
                            scale: breathingScale.outer,
                          }}
                          transition={{
                            duration: breathingState.duration,
                            ease: "easeInOut"
                          }}
                          className="absolute w-40 h-40 rounded-full bg-emerald-500/10"
                        />
                        <motion.div
                          animate={{
                            scale: breathingScale.middle,
                          }}
                          transition={{
                            duration: breathingState.duration,
                            ease: "easeInOut"
                          }}
                          className="absolute w-40 h-40 rounded-full bg-emerald-500/20"
                        />
                        <motion.div
                          animate={{
                            scale: breathingScale.inner,
                          }}
                          transition={{
                            duration: breathingState.duration,
                            ease: "easeInOut"
                          }}
                          className="absolute w-40 h-40 rounded-full bg-emerald-500/30"
                        />
                        <motion.div
                          animate={{
                            scale: breathingScale.core,
                          }}
                          transition={{
                            duration: breathingState.duration,
                            ease: "easeInOut"
                          }}
                          className="absolute w-40 h-40 rounded-full bg-emerald-400 shadow-[0_0_30px_rgba(52,211,153,0.4)]"
                        />
                      </div>

                      {/* Breathing status instructions */}
                      <div className="text-center space-y-3">
                        <span aria-live="polite" className="text-xl font-light tracking-wide text-white block">
                          {breathingState.text}
                        </span>
                        <span aria-hidden="true" className="text-4xl font-mono font-extrabold text-white/40 block leading-none tracking-tighter">
                          {breathingState.countText}
                        </span>
                        <span className="block text-[11px] text-white/35">Se alguma etapa não for confortável, volte à respiração natural.</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            {/* Etapa de acompanhamento visual */}
            {currentPhase === 2 && (
              <motion.div 
                key="phase-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.0 }}
                className="w-full h-full absolute inset-0 pointer-events-none flex items-center justify-center overflow-visible"
              >
                {/* Orientação breve */}
                <motion.div
                  initial={prefersReducedMotion ? { opacity: 0 } : { y: "-5vh", opacity: 0 }}
                  animate={prefersReducedMotion ? { opacity: 1 } : {
                    y: ["-5vh", "-5vh", "25vh"],
                    opacity: [0, 1, 1, 1]
                  }}
                  transition={prefersReducedMotion ? { duration: 0.15 } : {
                    duration: 7.5,
                    times: [0, 0.1, 0.8, 1],
                    ease: "easeInOut"
                  }}
                  className="absolute text-center space-y-1.5 z-40 px-4 w-full"
                >
                  <span className="text-lg font-light tracking-wide text-white/95 leading-none block drop-shadow-lg">
                    Acompanhe a luz com o olhar, se isso for confortável.
                  </span>
                  <p className="text-[10px] text-white/20 tracking-[0.2em] font-mono uppercase">
                    Se preferir, apenas descanse os olhos.
                  </p>
                </motion.div>
              </motion.div>
            )}

            {/* Etapa de anotação opcional */}
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
                  <div className={`absolute w-8 h-8 rounded-full bg-emerald-500/10 ${prefersReducedMotion ? '' : 'animate-ping'}`} />
                  <div className={`w-3.5 h-3.5 rounded-full bg-emerald-400 shadow-[0_0_20px_10px_#10b981,0_0_50px_20px_#10b981] ${prefersReducedMotion ? '' : 'animate-pulse'}`} />
                </div>

                {/* Cognitive Discharge Panel */}
                <div className="w-full flex flex-col space-y-4">
                  <span className="text-xs text-white/70 font-light leading-relaxed text-center block max-w-md mx-auto">
                    Se quiser, anote o que está ocupando sua mente. Não precisa organizar as ideias. Você também pode apenas respirar.
                  </span>

                  <div className="relative w-full">
                     {!reflectionSaved ? (
                      <div className="space-y-4">
                        <textarea
                          id="sos_reflection_textarea"
                          aria-label="Anotação opcional"
                          value={ghostQuoteContent}
                          onChange={(e) => setGhostQuoteContent(e.target.value)}
                          placeholder="Escreva o que vier à mente. Você não precisa organizar as ideias."
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
                              <span>Salvando...</span>
                            </>
                          ) : (
                            <>
                              <Send size={14} />
                              <span>{(isInfiniteMode ? infiniteNote.trim() : ghostQuoteContent.trim()) ? 'Salvar anotação' : 'Continuar sem anotar'}</span>
                            </>
                          )}
                        </button>
                      </div>
                    ) : (
                      <motion.div
                        id="sos_save_confirmation"
                        initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
                        animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
                        transition={{ duration: prefersReducedMotion ? 0.15 : 0.5 }}
                        className="py-6 px-8 bg-emerald-500/5 border border-emerald-500/15 rounded-3xl text-center space-y-2 max-w-sm mx-auto shadow-xl"
                      >
                        <span className="text-xs text-emerald-400 font-bold flex items-center justify-center gap-1.5 uppercase tracking-widest leading-none">
                          <ShieldCheck size={16} /> {ghostQuoteContent.trim() ? 'Anotação salva' : 'Pausa concluída'}
                        </span>
                        <p className="text-[11px] text-white/40 leading-relaxed">
                          Você pode continuar ou encerrar a pausa quando estiver pronto.
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
                initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
                animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
                exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
                transition={{ duration: prefersReducedMotion ? 0.15 : 1.0 }}
                className="flex flex-col items-center justify-center space-y-10 text-center max-w-sm px-6"
              >
                <div className="space-y-3">
                  <h3 className="text-2xl font-light tracking-wide text-white leading-relaxed">
                    Como você está se sentindo agora?
                  </h3>
                  <div className="h-[1px] w-12 bg-white/10 mx-auto" />
                  <span className="text-[10px] text-white/35 tracking-[0.25em] font-mono uppercase block">
                    Você decide o próximo passo.
                  </span>
                </div>

                <div className="w-full space-y-4">
                  {/* Concluir a pausa */}
                  <button
                    id="sos_peace_button"
                    onClick={handleCancel}
                    className="w-full py-4 px-6 rounded-2xl bg-white/[0.04] backdrop-blur-md border border-white/10 hover:bg-white/[0.08] text-white font-extrabold text-xs uppercase tracking-[0.2em] transition-all cursor-pointer shadow-xl flex items-center justify-center gap-2"
                  >
                    <ShieldCheck size={15} className="text-emerald-400" />
                    <span>Estou pronto para voltar</span>
                  </button>

                  {/* Continuar por mais um pouco */}
                  <button
                    id="sos_infinite_button"
                    onClick={() => {
                      setIsEncruzilhada(false);
                      setIsInfiniteMode(true);
                      setInfiniteSeconds(0);
                      setInfiniteStartedAt(Date.now());
                    }}
                    className="w-full py-4 px-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 hover:bg-emerald-500/15 text-emerald-300 font-extrabold text-xs uppercase tracking-[0.2em] transition-all cursor-pointer shadow-[0_0_20px_rgba(16,185,129,0.15)] flex items-center justify-center gap-2"
                  >
                    <Sparkles size={15} />
                    <span>Continuar por mais um pouco</span>
                  </button>
                </div>
              </motion.div>
            )}

            {/* FASE 5: TEMPO ADICIONAL (Extensão da sessão) */}
            {currentPhase === 5 && (
              <motion.div 
                key="phase-5"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.0 }}
                className="w-full h-full absolute inset-0 flex flex-col justify-center items-center overflow-visible"
              >
                {/* ABERTURA (8 segundos) */}
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
                      Está tudo bem continuar mais um pouco. Acompanhe a respiração sem pressa e respeite o seu ritmo.
                    </p>
                  </motion.div>
                )}

                {/* RESPIRAÇÃO (60 segundos) */}
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
                          scale: breathingScale.outer,
                        }}
                        transition={{
                          duration: breathingState.duration,
                          ease: "easeInOut"
                        }}
                        className="absolute w-40 h-40 rounded-full bg-purple-500/10"
                      />
                      {/* Camada 2: bg-purple-500/20 */}
                      <motion.div
                        animate={{
                          scale: breathingScale.middle,
                        }}
                        transition={{
                          duration: breathingState.duration,
                          ease: "easeInOut"
                        }}
                        className="absolute w-40 h-40 rounded-full bg-purple-500/20"
                      />
                      {/* Camada 3: bg-indigo-500/30 */}
                      <motion.div
                        animate={{
                          scale: breathingScale.inner,
                        }}
                        transition={{
                          duration: breathingState.duration,
                          ease: "easeInOut"
                        }}
                        className="absolute w-40 h-40 rounded-full bg-indigo-500/30"
                      />
                      {/* Camada 4: bg-gradient-to-tr from-purple-500 to-indigo-500 with slight glow */}
                      <motion.div
                        animate={{
                          scale: breathingScale.core,
                        }}
                        transition={{
                          duration: breathingState.duration,
                          ease: "easeInOut"
                        }}
                        className="absolute w-40 h-40 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-500 shadow-[0_0_30px_rgba(168,85,247,0.5)]"
                      />
                    </div>

                    {/* Loop breathing guidance details */}
                    <div className="text-center space-y-3 px-4 max-w-lg mt-6">
                      <span className="text-xs uppercase tracking-[0.25em] font-mono text-white/50 block">
                        Tempo adicional
                      </span>
                      
                      <span aria-live="polite" className="text-sm font-light tracking-wide text-white block leading-relaxed">
                        {breathingState.text}
                      </span>
                      
                      <span aria-hidden="true" className="text-3xl font-mono font-extrabold text-white/30 block leading-none tracking-tighter">
                        {breathingState.countText}
                      </span>
                      <span className="block text-[11px] text-white/35">Se alguma etapa não for confortável, volte à respiração natural.</span>

                    </div>
                  </motion.div>
                )}

                {/* TRANSIÇÃO (5 segundos) */}
                {infiniteAct === 3 && (
                  <motion.div 
                    key="infinite-act-3"
                    initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
                    animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: prefersReducedMotion ? 0.15 : 0.8 }}
                    className="text-center space-y-4 px-6 max-w-md"
                  >
                    <p className="text-xl md:text-2xl font-light tracking-wide text-white leading-relaxed">
                      Se quiser, acompanhe a luz por alguns instantes.
                    </p>
                    <div className="h-[1px] w-12 bg-white/10 mx-auto" />
                    <span className="text-[10px] text-white/35 tracking-[0.2em] font-mono uppercase block">
                      Sem pressa. Você pode apenas observar.
                    </span>
                  </motion.div>
                )}

                {/* Etapa final */}
                {infiniteAct === 4 && (
                  <motion.div 
                    key="infinite-act-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="w-full flex flex-col items-center justify-center space-y-8 px-4"
                  >
                    {/* Elegant translucent text input workspace */}
                    <div className="relative w-full max-w-md z-40 space-y-4">
                      <textarea
                        id="sos_infinite_reflection_textarea"
                        aria-label="Anotação opcional"
                        value={infiniteNote}
                        onChange={(e) => setInfiniteNote(e.target.value)}
                        placeholder="Anote algo, se isso ajudar. Você pode deixar em branco."
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
                              <span>Salvando...</span>
                            </>
                          ) : (
                            <>
                              <Send size={13} />
                              <span>{(isInfiniteMode ? infiniteNote.trim() : ghostQuoteContent.trim()) ? 'Salvar anotação' : 'Continuar sem anotar'}</span>
                            </>
                          )}
                        </button>

                        <button
                          id="sos_infinite_finish_btn"
                          onClick={requestClose}
                          className="w-full py-4 px-6 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] text-white/80 font-extrabold text-[11px] uppercase tracking-[0.2em] border border-white/10 transition-all cursor-pointer flex items-center justify-center gap-2"
                        >
                          <ShieldCheck size={14} className="text-emerald-400" />
                          <span>Concluir pausa</span>
                        </button>
                      </div>

                      {/* TEXTO EMPÁTICO (Fluxo Natural - Evita Sobreposição) */}
                      <div className="pt-3 px-2 text-center pointer-events-none">
                        <p className="text-[11px] font-light tracking-wide text-white/50 leading-relaxed">
                          Você pode encerrar quando quiser. Se algo vier à mente, anote sem pressa.
                        </p>
                        <span className="text-[8px] text-[#10b981]/40 tracking-[0.2em] font-mono uppercase block mt-1">
                          Um momento para você.
                        </span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}

          </AnimatePresence>
        </div>

      </div>

      <div className="w-full shrink-0 flex items-center justify-center z-[40] pb-1">
        <span className="text-[11px] text-white/25">Um momento de cada vez.</span>
      </div>

      {/* BOTÃO DE TELA CHEIA (Exclusivo Desktop) */}
      <div className="absolute bottom-6 right-6 z-[10000] hidden md:flex">
        <button
          onClick={toggleFullscreen}
          className="bg-white/[0.03] border border-white/10 hover:bg-white/10 p-3 rounded-xl text-white/40 hover:text-white transition-all flex items-center gap-2 text-[10px] uppercase tracking-widest font-mono font-bold cursor-pointer"
        >
          {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
          <span>{isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}</span>
        </button>
      </div>

      {/* Luz de acompanhamento: movimento lento, horizontal e com velocidade constante. */}
      <AnimatePresence>
        {(currentPhase === 2 || (currentPhase === 5 && infiniteAct === 4)) && (
          prefersReducedMotion ? (
            <div
              aria-hidden="true"
              className="fixed w-6 h-6 rounded-full bg-[#10b981] shadow-[0_0_22px_7px_rgba(16,185,129,0.42)] z-[20] pointer-events-none"
              style={{ top: 'calc(50% - 12px)', left: 'calc(50% - 12px)' }}
            />
          ) : (
            <motion.div
              key="guided-session-light"
              aria-hidden="true"
              style={{ top: 'calc(50% - 12px)', left: 0 }}
              initial={{ x: ballTravel.startX }}
              animate={{ x: [ballTravel.startX, ballTravel.endX] }}
              exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.5 } }}
              transition={{
                x: {
                  duration: Math.max(1, ballTravel.durationSeconds),
                  ease: 'linear',
                  repeat: Infinity,
                  repeatType: 'mirror'
                },
                opacity: { duration: 0.4 }
              }}
              className="fixed w-6 h-6 rounded-full bg-[#10b981] shadow-[0_0_22px_7px_rgba(16,185,129,0.42)] z-[20] pointer-events-none"
            />
          )
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCloseConfirmation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1000001] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
            role="presentation"
          >
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="guided-close-title"
              className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#111713] p-6 text-center shadow-2xl"
            >
              <h3 id="guided-close-title" className="text-lg font-semibold text-white">Encerrar a pausa?</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/60">
                {(isInfiniteMode ? infiniteNote.trim().length > 0 : ghostQuoteContent.trim().length > 0 && !reflectionSaved)
                  ? 'O texto que ainda não foi salvo será perdido. As anotações já salvas continuam disponíveis.'
                  : 'O tempo será interrompido. As anotações que você já salvou continuam disponíveis.'}
              </p>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setShowCloseConfirmation(false)}
                  className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-white/80 transition-colors hover:bg-white/[0.08]"
                >
                  Continuar
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="rounded-xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-[#06130d] transition-colors hover:bg-emerald-300"
                >
                  Encerrar pausa
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* POP-UP DE SUCESSO (Modo Infinito) */}
      <AnimatePresence>
        {showSaveSuccess && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1000000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={prefersReducedMotion ? { opacity: 0 } : { scale: 0.95, opacity: 0 }}
              animate={prefersReducedMotion ? { opacity: 1 } : { scale: 1, opacity: 1 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { scale: 0.95, opacity: 0 }}
              transition={{ duration: prefersReducedMotion ? 0.15 : 0.2 }}
              className="bg-gray-900 rounded-2xl border border-emerald-500/30 p-8 max-w-sm w-full shadow-2xl flex flex-col items-center justify-center text-center space-y-4"
            >
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mb-2">
                <CheckCircle2 size={32} className="text-emerald-500" />
              </div>
              <h3 className="text-white text-lg font-semibold">Anotação salva</h3>
              <p className="text-gray-400 text-sm leading-relaxed mb-4">
                Sua anotação está na caixa de entrada. Você pode continuar ou encerrar a pausa quando quiser.
              </p>
              <button
                onClick={() => setShowSaveSuccess(false)}
                className="mt-4 px-8 py-2.5 bg-white/5 hover:bg-white/10 text-white text-sm font-medium rounded-full transition-colors border border-white/10"
              >
                Continuar
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>,
    document.body
  );
};
