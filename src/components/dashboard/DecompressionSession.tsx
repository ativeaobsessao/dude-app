import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  Check,
  Clock3,
  Moon,
  Pause,
  Pencil,
  Play,
  Trash2,
  Volume2,
  VolumeX,
  X
} from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useDataStore } from '../../store/useDataStore';
import { InboxCapture } from '../../types';
import { createBrownNoiseSamples } from '../../lib/brownNoise';

type VisualMode = 'lotus' | 'orb';

type AudioNodes = {
  source: AudioBufferSourceNode;
  gain: GainNode;
  highPass: BiquadFilterNode;
  lowPass: BiquadFilterNode;
  compressor: DynamicsCompressorNode;
};

const TIMER_PRESETS = [15, 30, 60] as const;
const DEFAULT_VOLUME = 0.12;
const MIN_CUSTOM_MINUTES = 5;
const MAX_CUSTOM_MINUTES = 720;
const AUDIO_FADE_SECONDS = 2.8;

const formatTime = (seconds: number) => {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const secs = safeSeconds % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

const formatCaptureTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
};

export const DecompressionSession = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const user = useAuthStore(state => state.user);
  const inboxCaptures = useDataStore(state => state.inboxCaptures);
  const addInboxCapture = useDataStore(state => state.addInboxCapture);
  const updateInboxCapture = useDataStore(state => state.updateInboxCapture);
  const deleteInboxCapture = useDataStore(state => state.deleteInboxCapture);
  const showNotification = useDataStore(state => state.showNotification);
  const prefersReducedMotion = useReducedMotion();

  const [visualMode, setVisualMode] = useState<VisualMode>(() => {
    try {
      return localStorage.getItem('dude-decompression-visual') === 'orb' ? 'orb' : 'lotus';
    } catch {
      return 'lotus';
    }
  });
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [customMinutes, setCustomMinutes] = useState('45');
  const [showCustomDuration, setShowCustomDuration] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [timerEndAt, setTimerEndAt] = useState<number | null>(null);
  const timerEndAtRef = useRef<number | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(30 * 60);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(DEFAULT_VOLUME);
  const [isSaving, setIsSaving] = useState(false);
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [captureToDelete, setCaptureToDelete] = useState<InboxCapture | null>(null);
  const [saveError, setSaveError] = useState('');
  const [timerExpired, setTimerExpired] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [isVisible, setIsVisible] = useState(() => typeof document === 'undefined' || document.visibilityState === 'visible');
  const [viewportWidth, setViewportWidth] = useState(() => typeof window !== 'undefined' ? window.innerWidth : 390);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const audioNodesRef = useRef<AudioNodes | null>(null);
  const isMountedRef = useRef(false);
  const isSavingRef = useRef(false);
  const finishStartedRef = useRef(false);
  const finishSessionRef = useRef<() => Promise<void>>(async () => {});

  const remainingSeconds = useMemo(() => {
    if (timerExpired) return 0;
    if (!sessionStarted || timerEndAt === null) return durationMinutes * 60;
    return timeRemaining;
  }, [durationMinutes, sessionStarted, timeRemaining, timerEndAt, timerExpired]);

  const recentCaptures = useMemo(() => inboxCaptures.slice(0, 8), [inboxCaptures]);
  const orbTravelDistance = Math.max(120, Math.min(viewportWidth * 0.72, 420) - 18);

  useEffect(() => {
    if (!isOpen) return;
    isMountedRef.current = true;

    const themeMeta = document.querySelector('meta[name="theme-color"]');
    const previousTheme = themeMeta?.getAttribute('content') ?? null;
    const previousColorScheme = document.documentElement.style.colorScheme;
    const previousBodyBackground = document.body.style.backgroundColor;

    themeMeta?.setAttribute('content', '#100D0A');
    document.documentElement.style.colorScheme = 'dark';
    document.body.style.backgroundColor = '#100D0A';

    return () => {
      isMountedRef.current = false;
      if (previousTheme) themeMeta?.setAttribute('content', previousTheme);
      document.documentElement.style.colorScheme = previousColorScheme;
      document.body.style.backgroundColor = previousBodyBackground;
    };
  }, [isOpen]);

  useEffect(() => {
    try {
      localStorage.setItem('dude-decompression-visual', visualMode);
    } catch {
      // A preferência visual é opcional; a sessão continua funcionando sem armazenamento local.
    }
  }, [visualMode]);

  useEffect(() => {
    const updateViewport = () => setViewportWidth(window.innerWidth);
    const updateVisibility = () => {
      setIsVisible(document.visibilityState === 'visible');
      if (document.visibilityState === 'visible') {
        const endAt = timerEndAtRef.current;
        if (sessionStarted && endAt !== null && endAt <= Date.now()) {
          void finishSessionRef.current();
        } else if (isPlaying && audioContextRef.current?.state === 'suspended') {
          setIsPlaying(false);
          showNotification('O som foi pausado pelo aparelho. Toque em reproduzir para continuar.', 'info');
        }
      }
    };

    window.addEventListener('resize', updateViewport, { passive: true });
    document.addEventListener('visibilitychange', updateVisibility);
    return () => {
      window.removeEventListener('resize', updateViewport);
      document.removeEventListener('visibilitychange', updateVisibility);
    };
  }, [isPlaying, sessionStarted, showNotification]);

  const disconnectAudioNodes = useCallback((nodes: AudioNodes) => {
    try { nodes.source.disconnect(); } catch { /* já desconectado */ }
    try { nodes.highPass.disconnect(); } catch { /* já desconectado */ }
    try { nodes.lowPass.disconnect(); } catch { /* já desconectado */ }
    try { nodes.compressor.disconnect(); } catch { /* já desconectado */ }
    try { nodes.gain.disconnect(); } catch { /* já desconectado */ }
    if (audioNodesRef.current?.source === nodes.source) audioNodesRef.current = null;
  }, []);

  const stopAudio = useCallback((fadeSeconds = 1.8) => {
    const nodes = audioNodesRef.current;
    const ctx = audioContextRef.current;
    if (!nodes || !ctx || ctx.state === 'closed') {
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      let settled = false;
      let timeoutId: number | undefined;
      const finish = () => {
        if (settled) return;
        settled = true;
        if (timeoutId !== undefined) window.clearTimeout(timeoutId);
        disconnectAudioNodes(nodes);
        resolve();
      };

      const now = ctx.currentTime;
      const safeFade = Math.max(0.05, fadeSeconds);
      try {
        nodes.gain.gain.cancelScheduledValues(now);
        nodes.gain.gain.setValueAtTime(Math.max(0, nodes.gain.gain.value), now);
        nodes.gain.gain.linearRampToValueAtTime(0, now + safeFade);
        nodes.source.onended = finish;
        nodes.source.stop(now + safeFade + 0.06);
      } catch {
        finish();
      }

      timeoutId = window.setTimeout(finish, (safeFade + 0.35) * 1000);
    });
  }, [disconnectAudioNodes]);

  const closeAudioContext = useCallback(async () => {
    const ctx = audioContextRef.current;
    audioContextRef.current = null;
    audioBufferRef.current = null;
    if (ctx && ctx.state !== 'closed') {
      try {
        await ctx.close();
      } catch {
        // O navegador pode já ter encerrado o contexto.
      }
    }
  }, []);

  const createAudioContext = useCallback(() => {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) throw new Error('Este navegador não oferece suporte à reprodução de áudio.');

    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      audioContextRef.current = new AudioContextClass();
      audioBufferRef.current = null;
    }

    const ctx = audioContextRef.current;
    if (!audioBufferRef.current) {
      const samples = createBrownNoiseSamples(ctx.sampleRate, 30);
      const buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate);
      buffer.getChannelData(0).set(samples);
      audioBufferRef.current = buffer;
    }
    return ctx;
  }, []);

  const startAudio = useCallback(async (secondsRemaining: number) => {
    try {
      if (audioNodesRef.current) return true;
      const ctx = createAudioContext();
      if (ctx.state === 'suspended') await ctx.resume();
      if (ctx.state !== 'running' || !audioBufferRef.current) {
        throw new Error('O navegador não conseguiu iniciar o áudio.');
      }

      const source = ctx.createBufferSource();
      source.buffer = audioBufferRef.current;
      source.loop = true;

      const highPass = ctx.createBiquadFilter();
      highPass.type = 'highpass';
      highPass.frequency.setValueAtTime(28, ctx.currentTime);
      highPass.Q.setValueAtTime(0.707, ctx.currentTime);

      const lowPass = ctx.createBiquadFilter();
      lowPass.type = 'lowpass';
      lowPass.frequency.setValueAtTime(360, ctx.currentTime);
      lowPass.Q.setValueAtTime(0.707, ctx.currentTime);

      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-10, ctx.currentTime);
      compressor.knee.setValueAtTime(18, ctx.currentTime);
      compressor.ratio.setValueAtTime(4, ctx.currentTime);
      compressor.attack.setValueAtTime(0.008, ctx.currentTime);
      compressor.release.setValueAtTime(0.28, ctx.currentTime);

      const gain = ctx.createGain();
      const now = ctx.currentTime;
      const safeVolume = Math.min(0.24, Math.max(0.02, volume));
      const safeRemaining = Math.max(1, secondsRemaining);
      const endTime = now + safeRemaining;
      const fadeStart = Math.max(now + 0.1, endTime - Math.min(AUDIO_FADE_SECONDS, safeRemaining * 0.45));

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(safeVolume, now + Math.min(3.5, safeRemaining * 0.25));
      if (fadeStart > now + 0.1) {
        gain.gain.setValueAtTime(safeVolume, fadeStart);
        gain.gain.linearRampToValueAtTime(0, endTime);
      } else {
        gain.gain.linearRampToValueAtTime(0, endTime);
      }

      source.connect(highPass);
      highPass.connect(lowPass);
      lowPass.connect(compressor);
      compressor.connect(gain);
      gain.connect(ctx.destination);

      const nodes: AudioNodes = { source, gain, highPass, lowPass, compressor };
      audioNodesRef.current = nodes;
      source.onended = () => {
        disconnectAudioNodes(nodes);
        if (isMountedRef.current) setIsPlaying(false);
      };

      source.start(now);
      source.stop(endTime + 0.08);
      return true;
    } catch (error) {
      const partialNodes = audioNodesRef.current;
      if (partialNodes) disconnectAudioNodes(partialNodes);
      await closeAudioContext();
      console.warn('Falha ao iniciar o ruído marrom:', error);
      showNotification('Não foi possível iniciar o áudio neste aparelho. Verifique o volume e tente novamente.', 'error');
      return false;
    }
  }, [closeAudioContext, createAudioContext, disconnectAudioNodes, showNotification, volume]);

  const saveCurrentCard = useCallback(async () => {
    const cleanContent = draft.trim();
    if (!cleanContent) return true;
    if (!user?.id) {
      setSaveError('Entre na sua conta para salvar esta anotação.');
      return false;
    }
    if (isSavingRef.current) return false;

    isSavingRef.current = true;
    setIsSaving(true);
    setSaveError('');
    let saved = false;

    try {
      if (editingId) {
        saved = await updateInboxCapture(editingId, cleanContent);
      } else {
        saved = Boolean(await addInboxCapture(user.id, cleanContent));
      }
    } catch (error) {
      console.error('Erro ao salvar anotação da descompressão:', error);
      saved = false;
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }

    if (!saved) {
      setSaveError('Não foi possível salvar. Sua anotação continua aqui; tente novamente.');
      return false;
    }

    setDraft('');
    setEditingId(null);
    setSaveError('');
    showNotification(editingId ? 'Anotação atualizada.' : 'Anotação salva.', 'success');
    return true;
  }, [addInboxCapture, draft, editingId, showNotification, updateInboxCapture, user?.id]);

  const finishSession = useCallback(async () => {
    if (finishStartedRef.current) return;
    finishStartedRef.current = true;
    setIsFinishing(true);

    setIsPlaying(false);
    await stopAudio(2.5);
    await closeAudioContext();
    const saved = await saveCurrentCard();

    if (!saved) {
      setTimerExpired(true);
      setSessionStarted(false);
      setTimerEndAt(null);
      timerEndAtRef.current = null;
      setIsFinishing(false);
      return;
    }

    await closeAudioContext();
    setIsFinishing(false);
    onClose();
  }, [closeAudioContext, onClose, saveCurrentCard, stopAudio]);

  finishSessionRef.current = finishSession;

  useEffect(() => {
    if (!isOpen || !sessionStarted || timerEndAt === null) return;

    const updateRemaining = () => {
      const remaining = Math.max(0, Math.ceil((timerEndAt - Date.now()) / 1000));
      setTimeRemaining(remaining);
      if (remaining <= 0) void finishSessionRef.current();
    };

    updateRemaining();
    const intervalId = window.setInterval(updateRemaining, 500);
    return () => window.clearInterval(intervalId);
  }, [isOpen, sessionStarted, timerEndAt]);

  useEffect(() => {
    if (!isOpen) return;
    return () => {
      const nodes = audioNodesRef.current;
      if (nodes) {
        try { nodes.source.stop(); } catch { /* fonte já encerrada */ }
        disconnectAudioNodes(nodes);
      }
      const ctx = audioContextRef.current;
      audioContextRef.current = null;
      audioBufferRef.current = null;
      if (ctx && ctx.state !== 'closed') void ctx.close().catch(() => {});
    };
  }, [disconnectAudioNodes, isOpen]);

  const startSession = async () => {
    if (sessionStarted || isFinishing) return;
    const seconds = durationMinutes * 60;
    const endAt = Date.now() + seconds * 1000;
    timerEndAtRef.current = endAt;
    setTimerEndAt(endAt);
    setTimeRemaining(seconds);
    setTimerExpired(false);

    const started = await startAudio(seconds);
    if (!started) {
      timerEndAtRef.current = null;
      setTimerEndAt(null);
      return;
    }

    setSessionStarted(true);
    setIsPlaying(true);
  };

  const toggleAudio = async () => {
    if (isFinishing || timerExpired) return;
    if (!sessionStarted) {
      await startSession();
      return;
    }

    if (isPlaying) {
      setIsPlaying(false);
      await stopAudio(1.6);
      await closeAudioContext();
      return;
    }

    const endAt = timerEndAtRef.current;
    const remaining = endAt === null ? 0 : Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
    if (remaining <= 0) {
      await finishSessionRef.current();
      return;
    }

    const started = await startAudio(remaining);
    if (started) setIsPlaying(true);
  };

  const handleClose = async () => {
    if (isFinishing) return;
    setIsFinishing(true);
    const saved = await saveCurrentCard();
    if (!saved) {
      setIsFinishing(false);
      return;
    }
    setIsPlaying(false);
    await stopAudio(2.2);
    await closeAudioContext();
    onClose();
  };

  const handleSave = async (event?: React.MouseEvent | React.KeyboardEvent) => {
    event?.preventDefault();
    event?.stopPropagation();
    await saveCurrentCard();
  };

  const handleEditorKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      event.stopPropagation();
      void handleSave(event);
    }
  };

  const handleEditCapture = (capture: InboxCapture) => {
    if (draft.trim()) {
      showNotification('Salve ou cancele o texto atual antes de editar outra anotação.', 'info');
      return;
    }
    setDraft(capture.content);
    setEditingId(capture.id);
    setSaveError('');
    window.setTimeout(() => textareaRef.current?.focus(), 40);
  };

  const handleDeleteCapture = async () => {
    if (!captureToDelete) return;
    const deleted = await deleteInboxCapture(captureToDelete.id);
    if (!deleted) {
      showNotification('Não foi possível excluir a anotação. Tente novamente.', 'error');
      return;
    }
    if (editingId === captureToDelete.id) {
      setDraft('');
      setEditingId(null);
    }
    setCaptureToDelete(null);
    showNotification('Anotação excluída.', 'success');
  };

  const chooseDuration = (minutes: number) => {
    if (sessionStarted || isFinishing) return;
    setDurationMinutes(minutes);
    setTimeRemaining(minutes * 60);
    setShowCustomDuration(false);
  };

  const applyCustomDuration = () => {
    const parsed = Number.parseInt(customMinutes, 10);
    if (!Number.isFinite(parsed) || parsed < MIN_CUSTOM_MINUTES || parsed > MAX_CUSTOM_MINUTES) {
      showNotification(`Escolha um tempo entre ${MIN_CUSTOM_MINUTES} e ${MAX_CUSTOM_MINUTES} minutos.`, 'info');
      return;
    }
    chooseDuration(parsed);
  };

  const updateVolume = (nextVolume: number) => {
    const safeVolume = Math.min(0.24, Math.max(0.02, nextVolume));
    setVolume(safeVolume);
    const nodes = audioNodesRef.current;
    const ctx = audioContextRef.current;
    if (!nodes || !ctx || ctx.state !== 'running') return;

    const now = ctx.currentTime;
    const endAt = timerEndAtRef.current;
    const remaining = endAt === null ? 0 : Math.max(0, (endAt - Date.now()) / 1000);
    nodes.gain.gain.cancelScheduledValues(now);
    nodes.gain.gain.setTargetAtTime(safeVolume, now, 0.28);
    if (remaining > 0.1) {
      const endTime = now + remaining;
      const fadeStart = Math.max(now, endTime - AUDIO_FADE_SECONDS);
      nodes.gain.gain.setValueAtTime(safeVolume, fadeStart);
      nodes.gain.gain.linearRampToValueAtTime(0, endTime);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Sessão de descompressão"
      onClick={(event) => event.stopPropagation()}
      className="fixed inset-0 z-[2000] flex h-[100dvh] flex-col overflow-hidden bg-[#100D0A] font-sans text-[#D8CABB]"
      style={{
        colorScheme: 'dark',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)'
      }}
    >
      <header className="relative z-20 flex shrink-0 items-center justify-between border-b border-[#38291F]/70 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#59402D]/60 bg-[#1D1712] text-[#B9875B]">
            <Moon size={17} strokeWidth={1.6} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium tracking-[0.14em] text-[#A99987]">DESCOMPRESSÃO</p>
            <p className="text-sm text-[#D8CABB]">{sessionStarted ? 'Tempo restante' : 'Escolha quanto tempo deseja ficar'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="font-mono text-xl tabular-nums tracking-tight text-[#E4D9CC]">{formatTime(remainingSeconds)}</p>
            <p className="text-[10px] text-[#8F7D6A]">{sessionStarted ? 'até encerrar' : 'duração'}</p>
          </div>
          <button
            type="button"
            onClick={() => void handleClose()}
            disabled={isFinishing}
            aria-label="Fechar sessão"
            className="rounded-full p-2 text-[#8F7D6A] transition-colors hover:bg-[#241B14] hover:text-[#D8CABB] disabled:opacity-40"
          >
            <X size={21} strokeWidth={1.6} />
          </button>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-5 pt-3 sm:px-6" style={{ scrollbarWidth: 'thin', scrollbarColor: '#59402D transparent' }}>
        <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-4">
          {!sessionStarted && !timerExpired && (
            <section className="w-full rounded-2xl border border-[#38291F]/70 bg-[#17110D] px-3 py-3">
              <div className="mb-2 flex items-center gap-2 text-[#A99987]">
                <Clock3 size={14} />
                <span className="text-xs">Tempo da sessão</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {TIMER_PRESETS.map(minutes => (
                  <button
                    key={minutes}
                    type="button"
                    onClick={() => chooseDuration(minutes)}
                    aria-pressed={durationMinutes === minutes && !showCustomDuration}
                    className={`min-h-10 rounded-xl border px-2 text-sm transition-colors ${durationMinutes === minutes && !showCustomDuration ? 'border-[#8F6A50] bg-[#38291F] text-[#E4D9CC]' : 'border-[#38291F] bg-[#100D0A] text-[#A99987] hover:border-[#59402D]'}`}
                  >
                    {minutes} min
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setShowCustomDuration(value => !value)}
                  aria-pressed={showCustomDuration}
                  className={`min-h-10 rounded-xl border px-2 text-xs transition-colors ${showCustomDuration ? 'border-[#8F6A50] bg-[#38291F] text-[#E4D9CC]' : 'border-[#38291F] bg-[#100D0A] text-[#A99987] hover:border-[#59402D]'}`}
                >
                  Outro
                </button>
              </div>
              {showCustomDuration && (
                <div className="mt-3 flex items-center gap-2">
                  <label htmlFor="decompression-custom-minutes" className="sr-only">Duração em minutos</label>
                  <input
                    id="decompression-custom-minutes"
                    type="number"
                    min={MIN_CUSTOM_MINUTES}
                    max={MAX_CUSTOM_MINUTES}
                    inputMode="numeric"
                    value={customMinutes}
                    onChange={event => setCustomMinutes(event.target.value)}
                    className="min-h-11 min-w-0 flex-1 rounded-xl border border-[#493526] bg-[#100D0A] px-3 text-sm text-[#E4D9CC] outline-none focus:border-[#A77A55]"
                  />
                  <span className="text-xs text-[#8F7D6A]">minutos</span>
                  <button type="button" onClick={applyCustomDuration} className="min-h-11 rounded-xl bg-[#8F6A50] px-4 text-sm font-medium text-[#100D0A] transition-colors hover:bg-[#A77A55]">Aplicar</button>
                </div>
              )}
            </section>
          )}

          <section className="flex w-full flex-col items-center gap-3 pt-1">
            <div className="flex items-center justify-center gap-2 rounded-full border border-[#38291F]/80 bg-[#17110D] p-1">
              <button
                type="button"
                onClick={() => setVisualMode('lotus')}
                aria-pressed={visualMode === 'lotus'}
                className={`rounded-full px-4 py-2 text-xs transition-colors ${visualMode === 'lotus' ? 'bg-[#3A3028] text-[#E6EEF0]' : 'text-[#9A8B7C] hover:text-[#D8CABB]'}`}
              >
                Lótus
              </button>
              <button
                type="button"
                onClick={() => setVisualMode('orb')}
                aria-pressed={visualMode === 'orb'}
                className={`rounded-full px-4 py-2 text-xs transition-colors ${visualMode === 'orb' ? 'bg-[#303426] text-[#B5BE9B]' : 'text-[#9A8B7C] hover:text-[#D8CABB]'}`}
              >
                Orbe
              </button>
            </div>

            <div className="relative flex h-[150px] w-full max-w-[420px] items-center justify-center overflow-hidden" aria-label={visualMode === 'lotus' ? 'Animação suave da flor de lótus geométrica' : 'Animação suave do orbe'}>
              <AnimatePresence mode="wait" initial={false}>
                {visualMode === 'lotus' ? (
                  <motion.div
                    key="lotus"
                    initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1.2, ease: 'easeInOut' }}
                    className="relative flex h-36 w-36 items-center justify-center"
                  >
                    {[
                      { size: 'h-36 w-36', low: 0.07, high: 0.13 },
                      { size: 'h-28 w-28', low: 0.08, high: 0.16 },
                      { size: 'h-20 w-20', low: 0.10, high: 0.19 },
                      { size: 'h-12 w-12', low: 0.12, high: 0.22 }
                    ].map((layer, index) => (
                      <motion.div
                        key={index}
                        className={`absolute ${layer.size} rounded-full border border-[#E8E9E6]/20`}
                        style={{ backgroundColor: `rgba(232, 233, 230, ${layer.low})`, boxShadow: '0 0 24px rgba(232,233,230,0.035)' }}
                        animate={prefersReducedMotion || !isVisible || timerExpired ? { scale: 1, opacity: layer.low } : {
                          scale: [0.82, 1.12, 0.82],
                          opacity: [layer.low, layer.high, layer.low]
                        }}
                        transition={{ duration: 12, ease: 'easeInOut', repeat: Infinity }}
                      />
                    ))}
                  </motion.div>
                ) : (
                  <motion.div
                    key="orb"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1.1 }}
                    className="relative flex h-20 w-full items-center justify-center"
                  >
                    <div className="absolute h-px w-[82%] bg-[#66704E]/20" />
                    <motion.div
                      className="relative h-4 w-4 rounded-full bg-[#8A9670] shadow-[0_0_22px_rgba(138,150,112,0.16)]"
                      animate={prefersReducedMotion || !isVisible || timerExpired ? { x: 0, opacity: 0.78 } : {
                        x: [-orbTravelDistance / 2, orbTravelDistance / 2, -orbTravelDistance / 2],
                        opacity: [0.58, 0.82, 0.58]
                      }}
                      transition={{ duration: 32, ease: 'easeInOut', repeat: Infinity, times: [0, 0.5, 1] }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <p className="max-w-md text-center text-xs leading-relaxed text-[#8F7D6A]">
              {visualMode === 'lotus' ? 'Círculos suaves que se expandem e se recolhem lentamente.' : 'Uma luz discreta que percorre a tela sem pressa.'}
            </p>
          </section>

          <section className="w-full rounded-2xl border border-[#38291F]/70 bg-[#17110D] p-3 sm:p-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[#D8CABB]">
                <Moon size={15} className="text-[#B9875B]" />
                <span className="text-sm font-medium">Ruído marrom</span>
              </div>
              <span className="text-[11px] text-[#8F7D6A]">Som ambiente</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => void toggleAudio()}
                disabled={isFinishing || timerExpired}
                aria-label={isPlaying ? 'Pausar áudio' : sessionStarted ? 'Retomar áudio' : 'Iniciar sessão e áudio'}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#59402D] bg-[#2B2119] text-[#D8CABB] transition-colors hover:bg-[#38291F] disabled:opacity-40"
              >
                {isPlaying ? <Pause size={19} /> : <Play size={19} className="ml-0.5" />}
              </button>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-[#A99987]">{isPlaying ? 'Reproduzindo' : sessionStarted ? 'Som pausado · retomar' : 'Iniciar som e temporizador'}</span>
                  <span className="font-mono tabular-nums text-[#8F7D6A]">{Math.round((volume / 0.24) * 100)}%</span>
                </div>
                <div className="flex items-center gap-2">
                  {volume <= 0.025 ? <VolumeX size={14} className="text-[#8F7D6A]" /> : <Volume2 size={14} className="text-[#8F7D6A]" />}
                  <input
                    type="range"
                    min="0.02"
                    max="0.24"
                    step="0.01"
                    value={volume}
                    onChange={event => updateVolume(Number(event.target.value))}
                    aria-label="Volume do ruído marrom"
                    className="h-1.5 min-w-0 flex-1 cursor-pointer accent-[#B9875B]"
                  />
                </div>
              </div>
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-[#806F5F]">Ajuste o volume do aparelho para um nível confortável. O som começa e termina gradualmente.</p>
          </section>

          <section className="w-full rounded-2xl border border-[#38291F]/70 bg-[#17110D] p-3 sm:p-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-medium text-[#E0D4C7]">Escreva o que está na sua mente</h2>
                <p className="mt-0.5 text-[11px] text-[#8F7D6A]">Não precisa organizar agora. Apenas registre.</p>
              </div>
              {editingId && (
                <button
                  type="button"
                  onClick={() => { setDraft(''); setEditingId(null); setSaveError(''); }}
                  className="shrink-0 text-xs text-[#B9875B] hover:text-[#D0A27B]"
                >
                  Cancelar edição
                </button>
              )}
            </div>
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={event => setDraft(event.target.value)}
              onKeyDown={handleEditorKeyDown}
              placeholder="Pode começar por qualquer pensamento..."
              rows={3}
              enterKeyHint="done"
              autoCapitalize="sentences"
              spellCheck
              disabled={isFinishing}
              className="block min-h-[92px] w-full resize-y rounded-xl border border-[#493526]/80 bg-[#100D0A] px-3 py-3 text-base leading-relaxed text-[#E0D4C7] caret-[#C69A73] outline-none placeholder:text-[#6F5F50] focus:border-[#8F6A50] disabled:opacity-60"
              style={{ colorScheme: 'dark', fontSize: '16px' }}
            />
            {saveError && <p role="alert" className="mt-2 text-xs leading-relaxed text-[#D0A27B]">{saveError}</p>}
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-[10px] text-[#806F5F]">Enter salva · Shift + Enter pula linha</p>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={!draft.trim() || isSaving || isFinishing}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#8F6A50] px-4 text-xs font-semibold text-[#100D0A] transition-colors hover:bg-[#A77A55] disabled:cursor-not-allowed disabled:opacity-35"
              >
                {isSaving ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#100D0A]/30 border-t-[#100D0A]" /> : <Check size={14} />}
                {isSaving ? 'Salvando' : editingId ? 'Salvar alterações' : 'Salvar anotação'}
              </button>
            </div>
          </section>

          {recentCaptures.length > 0 && (
            <section className="w-full pb-2">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-xs font-medium text-[#BBA894]">Anotações salvas</h2>
                <span className="text-[10px] text-[#806F5F]">{inboxCaptures.length}</span>
              </div>
              <div className="space-y-2">
                {recentCaptures.map(capture => (
                  <motion.div key={capture.id} layout className="flex items-start gap-2 rounded-xl border border-[#38291F]/70 bg-[#17110D] p-3">
                    <button
                      type="button"
                      onClick={() => handleEditCapture(capture)}
                      className="min-w-0 flex-1 text-left"
                      aria-label={`Editar anotação: ${capture.content.slice(0, 60)}`}
                    >
                      <span className="mb-1 block text-[10px] text-[#806F5F]">{formatCaptureTime(capture.created_at)}</span>
                      <span className="line-clamp-3 block whitespace-pre-wrap break-words text-xs leading-relaxed text-[#C9BBAA]">{capture.content}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCaptureToDelete(capture)}
                      aria-label="Excluir anotação"
                      className="rounded-lg p-2 text-[#806F5F] transition-colors hover:bg-[#3A211B] hover:text-[#D39A83]"
                    >
                      <Trash2 size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleEditCapture(capture)}
                      aria-label="Editar anotação"
                      className="rounded-lg p-2 text-[#806F5F] transition-colors hover:bg-[#2A2119] hover:text-[#D8CABB]"
                    >
                      <Pencil size={15} />
                    </button>
                  </motion.div>
                ))}
              </div>
              {inboxCaptures.length > recentCaptures.length && (
                <p className="mt-2 text-center text-[10px] text-[#806F5F]">As anotações mais recentes aparecem aqui. As demais continuam na página inicial.</p>
              )}
            </section>
          )}

          {sessionStarted && !timerExpired && (
            <p className="mb-2 text-center text-[11px] text-[#806F5F]">Quando o tempo terminar, o som será encerrado e você voltará à página inicial.</p>
          )}

          {timerExpired && (
            <div className="mb-3 w-full rounded-2xl border border-[#8F6A50]/50 bg-[#241A13] p-4">
              <p className="text-sm font-medium text-[#E0D4C7]">O tempo terminou.</p>
              <p className="mt-1 text-xs leading-relaxed text-[#A99987]">O som foi encerrado. Salve a anotação pendente para voltar à página inicial.</p>
              <button type="button" onClick={() => void handleClose()} disabled={isFinishing} className="mt-3 min-h-10 w-full rounded-xl bg-[#8F6A50] px-4 text-sm font-semibold text-[#100D0A] disabled:opacity-40">
                {isFinishing ? 'Salvando…' : 'Salvar e voltar'}
              </button>
            </div>
          )}
        </div>
      </main>

      <AnimatePresence>
        {captureToDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[2020] flex items-center justify-center bg-black/70 p-4"
            onClick={() => setCaptureToDelete(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              onClick={event => event.stopPropagation()}
              className="w-full max-w-sm rounded-2xl border border-[#493526] bg-[#1D1712] p-5 shadow-2xl"
            >
              <h3 className="text-base font-medium text-[#E0D4C7]">Excluir esta anotação?</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#A99987]">Ela também será removida da lista de anotações para organizar na página inicial.</p>
              <div className="mt-5 flex gap-2">
                <button type="button" onClick={() => setCaptureToDelete(null)} className="min-h-11 flex-1 rounded-xl border border-[#493526] text-sm text-[#C9BBAA]">Cancelar</button>
                <button type="button" onClick={() => void handleDeleteCapture()} className="min-h-11 flex-1 rounded-xl bg-[#7D4B3B] text-sm font-medium text-[#F2E5DA]">Excluir</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
