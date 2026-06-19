import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, ShieldAlert, X, Brain, Sparkles } from 'lucide-react';
import { useDataStore } from '../../store/useDataStore';
import { getLocalDateString } from '../../lib/utils';

interface AntiVicioModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDeepSessionContext?: boolean;
  initialHabitId?: string;
  associatedCheckinId?: string;
  isVictoryMode?: boolean;
}

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

export const AntiVicioModal = ({ isOpen, onClose, isDeepSessionContext = false, initialHabitId, associatedCheckinId, isVictoryMode = false }: AntiVicioModalProps) => {
  const dataStore = useDataStore();
  const { habits, profile } = dataStore;

  const avoidHabits = habits.filter(h => h.habit_mode === 'avoid');

  const [selectedHabitId, setSelectedHabitId] = useState<string>(
    initialHabitId || (avoidHabits.length > 0 ? avoidHabits[0].id : '')
  );
  const [selectedTag, setSelectedTag] = useState<string>('Impulso Súbito');
  const [note, setNote] = useState<string>('');
  const [successCheckedIn, setSuccessCheckedIn] = useState<boolean>(false);
  const [timeLeft, setTimeLeft] = useState<number>(10 * 60);

  // Sync selectedHabitId with initialHabitId when modal opening and initialHabitId changes
  useEffect(() => {
    if (isOpen) {
      if (initialHabitId) {
        setSelectedHabitId(initialHabitId);
      } else if (avoidHabits.length > 0) {
        setSelectedHabitId(avoidHabits[0].id);
      }
      setNote('');
      setSuccessCheckedIn(false);
    }
  }, [isOpen, initialHabitId]);

  // Countdown logic for Urge Surfing
  useEffect(() => {
    if (!isOpen) return;
    
    // Reset timer when modal opens
    setTimeLeft(10 * 60);

    const intervalId = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(intervalId);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(intervalId);
  }, [isOpen]);

  const handleCheckin = async (status: 'success' | 'relapse') => {
    if (!profile?.id) {
      dataStore.showNotification('Faça login para salvar o check-in.', 'error');
      return;
    }

    let habitId = selectedHabitId;
    if (!habitId) {
      if (avoidHabits.length > 0) {
        habitId = avoidHabits[0].id;
      } else {
        dataStore.showNotification('Selecione ou cadastre um módulo antivício de controle primeiro.', 'error');
        return;
      }
    }

    const currentHabit = avoidHabits.find(h => h.id === habitId);
    const habitName = currentHabit ? currentHabit.name : 'Vício';

    let result = null;

    if (associatedCheckinId) {
      // Bound Context Mode: UPDATE the silently-created check-in!
      const updateData = {
        trigger_tag: selectedTag,
        trigger_note: note.trim() || null
      };
      const ok = await dataStore.updateAvoidanceCheckin(associatedCheckinId, updateData);
      if (ok) {
        result = true;
      }
    } else {
      // General Mode: CREATE a new check-in
      const checkinData = {
        user_id: profile.id,
        habit_id: habitId,
        checkin_date: getLocalDateString(),
        checkin_period: 'window',
        status,
        trigger_tag: selectedTag,
        trigger_note: note.trim() || null,
        created_at: new Date().toISOString()
      };
      result = await dataStore.addAvoidanceCheckin(checkinData);
    }

    if (result) {
      if (status === 'success') {
        dataStore.showNotification(`Excelente! Força de vontade registrada para ${habitName} ✓`, 'success');
      } else {
        dataStore.showNotification(`Análise registrada. O importante é o foco no progresso de longo prazo.`, 'success');
      }
      setSuccessCheckedIn(true);
      setTimeout(() => {
        onClose();
        setSuccessCheckedIn(false);
        setNote('');
      }, 1200);
    }
  };

  const triggerTags = [
    { label: '🔥 Impulso Súbito', value: 'Impulso Súbito' },
    { label: '🤯 Ansiedade/Estresse', value: 'Ansiedade/Estresse' },
    { label: '🥱 Tédio/Inatividade', value: 'Tédio/Inatividade' },
    { label: '💤 Fadiga/Exaustão', value: 'Fadiga/Exaustão' },
    { label: '🌍 Gatilho Ambiental', value: 'Gatilho Ambiental' }
  ];

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        {/* Backdrop overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-[#000]/80 backdrop-blur-md"
        />

        {/* Modal Sheet */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-lg bg-[#0d0d0d] border border-white/10 rounded-[32px] shadow-2xl p-6 md:p-8 max-h-[85vh] md:max-h-[90vh] overflow-y-auto custom-scrollbar select-none"
        >
          {/* Subtle neon glowing accent */}
          <div className={`absolute top-0 right-0 w-32 h-32 blur-3xl rounded-full pointer-events-none ${isVictoryMode ? 'bg-emerald-500/5' : 'bg-red-500/5'}`} />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-[#6ee7a8]/5 blur-3xl rounded-full pointer-events-none" />

          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2.5">
              <div className={`w-9 h-9 rounded-xl border flex items-center justify-center ${
                isVictoryMode 
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-[#6ee7a8]' 
                  : 'bg-red-500/10 border-red-500/20 text-red-500'
              }`}>
                {isVictoryMode ? <ShieldCheck size={18} /> : <Brain size={18} className="animate-pulse" />}
              </div>
              <div className="text-left font-sans">
                <h3 className="text-xl font-bold text-text-primary tracking-tight">
                  {isVictoryMode ? 'Vitória Registrada! 🛡️' : 'S.O.S. Autocontrole'}
                </h3>
                <span className={`text-[9px] font-mono font-bold uppercase tracking-[0.2em] block ${
                  isVictoryMode ? 'text-emerald-400/75' : 'text-red-500/75'
                }`}>
                  {isVictoryMode ? 'Módulo Reconectado' : 'Blindagem Psicológica'}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full bg-white/5 border border-white/10 hover:border-white/20 text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          {successCheckedIn ? (
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="py-12 flex flex-col items-center justify-center text-center space-y-4"
            >
              <div className="w-16 h-16 rounded-full bg-[#6ee7a8]/10 flex items-center justify-center text-[#6ee7a8] border border-[#6ee7a8]/20 ring-4 ring-[#6ee7a8]/5">
                <ShieldCheck size={36} />
              </div>
              <div className="space-y-1">
                <h4 className="text-lg font-bold text-text-primary">Vigilância Registrada!</h4>
                <p className="text-xs text-text-secondary/60">Sua mente agradece pela blindagem e persistência.</p>
              </div>
            </motion.div>
          ) : (
            <div className="space-y-6 font-sans pb-32 md:pb-2">
              <p className="text-xs md:text-sm text-text-secondary/80 text-left font-light leading-relaxed">
                {isVictoryMode ? (
                  "Parabéns por se manter na linha. Quer realizar algum registro de algum gatilho que te levou à tentação?"
                ) : (
                  <>
                    Um impulso dura em média de <strong className="text-white">5 a 10 minutos</strong>. Respire profundamente. Se você registrar este momento, dará um passo crucial para reescrever seus caminhos neurais.
                  </>
                )}
              </p>

              {/* Urge Surfing Timer - Hidden in victory mode */}
              {!isVictoryMode && (
                timeLeft > 0 ? (
                  <div className="text-5xl md:text-6xl font-mono font-black text-transparent bg-clip-text bg-gradient-to-b from-[#6ee7a8] to-white/70 drop-shadow-[0_0_15px_rgba(110,231,168,0.2)] text-center my-6">
                    {formatTime(timeLeft)}
                  </div>
                ) : (
                  <motion.div 
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="py-4 px-6 my-6 text-center rounded-2xl bg-[#6ee7a8]/10 border border-[#6ee7a8]/35 shadow-[0_0_20px_rgba(110,231,168,0.1)] text-[#6ee7a8] font-bold text-xs uppercase tracking-wider"
                  >
                    O pico do impulso passou. Você assumiu o controle.
                  </motion.div>
                )
              )}

              {/* Habit / Vice Selector */}
              <div className="space-y-1.5 text-left">
                <label className="text-[10px] font-bold text-text-secondary/50 uppercase tracking-[0.2em]">O que está testando sua atenção?</label>
                {initialHabitId ? (
                  isVictoryMode ? (
                    <div className="px-3 py-2 bg-emerald-500/5 rounded-2xl border border-emerald-500/20 text-xs font-mono text-emerald-300">
                      🛡️ Blindagem ativada contra: <span className="font-sans font-bold text-emerald-200">{avoidHabits.find(h => h.id === selectedHabitId)?.name || 'Módulo Ativo'}</span>
                    </div>
                  ) : (
                    <div className="px-3 py-2 bg-red-500/5 rounded-2xl border border-red-500/20 text-xs font-mono text-red-300">
                      ⚠️ Registro de queda ativo contra: <span className="font-sans font-bold text-red-200">{avoidHabits.find(h => h.id === selectedHabitId)?.name || 'Módulo Ativo'}</span>
                    </div>
                  )
                ) : avoidHabits.length > 0 ? (
                  <select
                    value={selectedHabitId}
                    onChange={(e) => setSelectedHabitId(e.target.value)}
                    className={`w-full bg-white/[0.03] border border-white/10 rounded-2xl py-3.5 px-4 text-sm text-text-primary focus:outline-none font-bold transition-all ${
                      isVictoryMode ? 'focus:border-emerald-500/40' : 'focus:border-[#6ee7a8]/40'
                    }`}
                  >
                    {avoidHabits.map((habit) => (
                      <option key={habit.id} value={habit.id} className="bg-[#121212] text-text-primary">
                        {habit.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="p-4 bg-white/[0.02] border border-dashed border-white/10 rounded-2xl text-center space-y-2">
                    <p className="text-xs text-text-secondary/60">Você não tem módulos antivício configurados na aba Centro.</p>
                  </div>
                )}
              </div>

              {/* Neuroscience Trigger Tags */}
              <div className="space-y-3 text-left">
                <label className="text-[10px] font-bold text-text-secondary/50 uppercase tracking-[0.2em] block">Qual é o gatilho emocional?</label>
                <div className="flex flex-wrap gap-2">
                  {triggerTags.map((tag) => {
                    const isSelected = selectedTag === tag.value;
                    let selectedClass = '';
                    if (isSelected) {
                      selectedClass = isVictoryMode 
                        ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                        : 'bg-[#6ee7a8]/10 border-[#6ee7a8] text-[#6ee7a8] shadow-[0_0_15px_rgba(110,231,168,0.15)]';
                    } else {
                      selectedClass = 'bg-white/5 border-white/10 text-text-secondary/70 hover:border-white/20';
                    }
                    return (
                      <button
                        key={tag.value}
                        type="button"
                        onClick={() => setSelectedTag(tag.value)}
                        className={`text-xs px-3 py-2 rounded-xl border font-bold transition-all cursor-pointer ${selectedClass}`}
                      >
                        {tag.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Note field */}
              <div className="space-y-1.5 text-left">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold text-text-secondary/50 uppercase tracking-[0.2em]">Registro de Autoconsciência</label>
                  <span className="text-[10px] font-mono text-text-secondary/40">Opcional</span>
                </div>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={
                    isVictoryMode 
                      ? "O que te ajudou a manter a força de vontade neste momento? Registrar ajuda a fixar esses atalhos mentais saudáveis..."
                      : "O que está sentindo ou pensando agora? Escrever ajuda a desarmar o mecanismo de recompensa automática..."
                  }
                  className={`w-full min-h-[72px] bg-white/[0.03] border border-white/10 hover:border-white/15 rounded-2xl py-3 px-4 text-xs md:text-sm text-text-primary focus:outline-none transition-all resize-none placeholder-text-secondary/40 ${
                    isVictoryMode ? 'focus:border-emerald-500/40' : 'focus:border-[#6ee7a8]/40'
                  }`}
                />
              </div>

              {/* Active check-in actions */}
              <div className="pt-3 font-sans">
                {initialHabitId ? (
                  // Bound Context Mode: A single primary submission button
                  <button
                    type="button"
                    onClick={() => handleCheckin(isVictoryMode ? 'success' : 'relapse')}
                    disabled={avoidHabits.length === 0}
                    className={`w-full flex items-center justify-center gap-2 py-4 px-4 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40 disabled:pointer-events-none transition-all font-black text-xs md:text-sm uppercase tracking-widest rounded-2xl cursor-pointer ${
                      isVictoryMode
                        ? 'bg-gradient-to-r from-emerald-400 to-green-500 text-[#032d18] shadow-[0_0_20px_rgba(16,185,129,0.25)]'
                        : 'bg-gradient-to-r from-red-500 to-rose-600 text-white shadow-[0_0_20px_rgba(239,68,68,0.25)]'
                    }`}
                  >
                    {isVictoryMode ? <ShieldCheck size={18} /> : <ShieldAlert size={18} />}
                    {isVictoryMode ? "Anexar Reflexão" : "Registrar Gatilho"}
                  </button>
                ) : (
                  // Legacy/General mode: choose status in-modal
                  isVictoryMode ? (
                    <button
                      type="button"
                      onClick={() => handleCheckin('success')}
                      disabled={avoidHabits.length === 0}
                      className="w-full flex items-center justify-center gap-2 py-4 px-4 bg-gradient-to-r from-emerald-400 to-green-500 hover:brightness-110 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40 disabled:pointer-events-none transition-all text-[#032d18] font-black text-xs md:text-sm uppercase tracking-widest rounded-2xl cursor-pointer shadow-[0_0_20px_rgba(16,185,129,0.25)]"
                    >
                      <ShieldCheck size={18} />
                      Salvar Registro de Vitória ✓
                    </button>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        type="button"
                        onClick={() => handleCheckin('success')}
                        disabled={avoidHabits.length === 0}
                        className={`flex items-center justify-center gap-2 py-4 px-4 bg-gradient-to-r from-[#6ee7a8] to-[#4ade80] hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none transition-all text-[#032d18] font-black text-xs md:text-sm uppercase tracking-wider rounded-2xl cursor-pointer shadow-[0_0_20px_rgba(110,231,168,0.2)] ${
                          timeLeft === 0 ? 'animate-pulse' : ''
                        }`}
                      >
                        <ShieldCheck size={18} />
                        Resisti
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCheckin('relapse')}
                        disabled={avoidHabits.length === 0}
                        className="flex items-center justify-center gap-2 py-4 px-4 bg-transparent border border-red-500/30 hover:border-red-500/5 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none transition-all text-red-400 font-extrabold text-xs md:text-sm uppercase tracking-wider rounded-2xl cursor-pointer"
                      >
                        <ShieldAlert size={18} />
                        Recaí
                      </button>
                    </div>
                  )
                )}
              </div>

              {/* Specific Rota de Fuga Escape logic */}
              {isDeepSessionContext && (
                <div className="pt-2 border-t border-white/[0.04] mt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-full flex items-center justify-center gap-2 py-4 px-4 bg-transparent border-2 border-[#6ee7a8]/40 text-[#6ee7a8]/90 hover:text-[#6ee7a8] hover:border-[#6ee7a8] hover:bg-[#6ee7a8]/5 active:scale-[0.98] transition-all font-black text-xs md:text-sm uppercase tracking-wider rounded-2xl cursor-pointer"
                  >
                    <Sparkles size={16} />
                    VOLTA PARA SESSÃO PROFUNDA (O IMPULSO PASSOU)
                  </button>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
