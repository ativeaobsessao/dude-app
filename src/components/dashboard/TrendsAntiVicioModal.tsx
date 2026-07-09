import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useDataStore } from '../../store/useDataStore';
import { 
  X, Target, Brain, Compass, Clock, Smile, Sparkles, Activity, ShieldCheck, ShieldAlert, Flame, Shield, Trash2, Pencil, Check
} from 'lucide-react';
import { getLocalDateString } from '../../lib/utils';

interface TrendsAntiVicioModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TrendsAntiVicioModal: React.FC<TrendsAntiVicioModalProps> = ({ isOpen, onClose }) => {
  const { avoidanceCheckins, habits, deleteAvoidanceCheckin, updateAvoidanceCheckin, fetchAvoidanceCheckins, profile } = useDataStore();
  const [showAllVices, setShowAllVices] = useState(false);
  
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(deleteTarget);
    await deleteAvoidanceCheckin(deleteTarget);
    if (profile) await fetchAvoidanceCheckins(profile.id);
    setIsDeleting(null);
    setDeleteTarget(null);
  };

  const handleEditSave = async (id: string) => {
    await updateAvoidanceCheckin(id, { trigger_note: editingNoteText.trim() });
    setEditingNoteId(null);
    if (profile) await fetchAvoidanceCheckins(profile.id);
  };

  // 1. Math Aggregation with Fallbacks & Safety Checks
  
  const avoidanceHabitsList = useMemo(() => {
    return habits.filter(h => h.habit_mode === 'avoid');
  }, [habits]);

  const avoidanceStreaks = useMemo(() => {
    const streakMap: { [id: string]: number } = {};
    avoidanceHabitsList.forEach(ah => {
      const checkins = avoidanceCheckins
        .filter(c => c.habit_id === ah.id && (c.status === 'success' || c.status === 'resisti' || c.status === 'relapse' || c.status === 'recai'))
        .sort((a, b) => new Date(b.checkin_date).getTime() - new Date(a.checkin_date).getTime());
      
      let currentStreak = 0;
      for (const c of checkins) {
        if (c.status === 'success' || c.status === 'resisti') {
          currentStreak++;
        } else {
          break;
        }
      }
      streakMap[ah.id] = currentStreak;
    });
    return streakMap;
  }, [avoidanceHabitsList, avoidanceCheckins]);

  const bestAvoidanceStreak = useMemo(() => {
    if (avoidanceHabitsList.length === 0) return null;
    let maxS = -1;
    let maxHabit = avoidanceHabitsList[0];
    avoidanceHabitsList.forEach(ah => {
      const s = avoidanceStreaks[ah.id] || 0;
      if (s > maxS) {
        maxS = s;
        maxHabit = ah;
      }
    });
    return maxS >= 0 ? { habit: maxHabit, streak: maxS } : null;
  }, [avoidanceHabitsList, avoidanceStreaks]);

  const sortedVices = useMemo(() => {
    return [...avoidanceHabitsList].sort((a, b) => {
      const streakA = avoidanceStreaks[a.id] || 0;
      const streakB = avoidanceStreaks[b.id] || 0;
      return streakB - streakA;
    });
  }, [avoidanceHabitsList, avoidanceStreaks]);

  
  const vicesHeadline = useMemo(() => {
    if (!bestAvoidanceStreak || bestAvoidanceStreak.streak === 0) {
      if (sortedVices.length > 0) {
        return `Iniciando sua blindagem contra ${sortedVices[0].name}. Mantenha-se firme!`;
      }
      return null;
    }
    return `Você está com um recorde de ${bestAvoidanceStreak.streak} ${bestAvoidanceStreak.streak === 1 ? 'dia limpo' : 'dias limpos'} contra ${bestAvoidanceStreak.habit.name}.`;
  }, [bestAvoidanceStreak, sortedVices]);

  const visibleVices = showAllVices ? sortedVices : sortedVices.slice(0, 3);

  // Mapeamento de Padrões
  const crises = useMemo(() => {
    return avoidanceCheckins.filter(c => c.trigger_tag && c.trigger_tag !== 'none');
  }, [avoidanceCheckins]);

  const patternMapping = useMemo(() => {
    if (crises.length === 0) return null;

    const triggerCounts: { [key: string]: number } = {};
    crises.forEach(c => {
      const tag = c.trigger_tag!;
      triggerCounts[tag] = (triggerCounts[tag] || 0) + 1;
    });

    let topTrigger = '';
    let maxTriggerCount = 0;
    Object.entries(triggerCounts).forEach(([tag, count]) => {
      if (count > maxTriggerCount) {
        maxTriggerCount = count;
        topTrigger = tag;
      }
    });

    if (!topTrigger) return null;

    const relatedNotes = crises
      .filter(c => c.trigger_tag === topTrigger && c.trigger_note && c.trigger_note.trim() !== '')
      .sort((a, b) => new Date(b.created_at || b.checkin_date).getTime() - new Date(a.created_at || a.checkin_date).getTime())
      .map(c => c.trigger_note!)
      .slice(0, 3);

    return {
      topTrigger,
      relatedNotes
    };
  }, [crises]);

  // Extract Avoidance check-ins that have notes for Section 3
  const battlesWithNotes = useMemo(() => {
    return avoidanceCheckins
      .filter(c => c.trigger_note && c.trigger_note.trim() !== '')
      .sort((a, b) => {
        const timeA = new Date(a.created_at || a.checkin_date).getTime();
        const timeB = new Date(b.created_at || b.checkin_date).getTime();
        return timeB - timeA;
      });
  }, [avoidanceCheckins]);

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md select-none font-sans overflow-hidden">
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.22 }}
            className="bg-[#0b0e11] border border-white/[0.08] w-full max-w-4xl rounded-[32px] p-6 md:p-8 relative overflow-hidden flex flex-col max-h-[90vh] text-left shadow-2xl"
          >
          {/* Subtle Ambient Color Gradients inside Modal (Frameless layout style) */}
          <div className="absolute top-0 right-0 w-44 h-44 bg-red-500/5 blur-3xl rounded-full pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-44 h-44 bg-[#6ee7a8]/5 blur-3xl rounded-full pointer-events-none" />

          {/* Header */}
          <div className="flex items-start justify-between pb-6 border-b border-white/[0.06] shrink-0">
            <div className="flex items-center gap-3.5 text-left animate-fade-in">
              <div className="w-11 h-11 rounded-2xl bg-[#6ee7a8]/10 border border-[#6ee7a8]/20 flex items-center justify-center text-[#6ee7a8]">
                <ShieldCheck size={22} className="animate-pulse" />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-xl font-black text-text-primary tracking-tight font-sans">
                  Controle de Impulsos
                </h3>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 sm:p-2.5 rounded-full bg-white/5 border border-white/10 hover:border-white/20 text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
            >
              <X size={15} />
            </button>
          </div>

          {/* Scrollable Frame Content */}
          <div className="flex-1 overflow-y-auto py-6 pr-2 flex flex-col gap-9 max-h-[72vh] scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
            
            
            {vicesHeadline && (
              <div className="p-4 bg-gradient-to-r from-emerald-500/[0.04] to-transparent border border-emerald-500/15 rounded-2xl flex items-center gap-3 select-text shrink-0">
                <p className="text-xs md:text-sm font-semibold tracking-wide text-text-primary leading-relaxed">
                  {vicesHeadline}
                </p>
              </div>
            )}

            {/* NOVO CARD: Mapeamento de Padrões */}
            <div className="space-y-4 text-left">
              <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] font-sans ml-1">
                Mapeamento de Padrões
              </h4>
              {!patternMapping ? (
                <div className="py-8 text-center bg-white/[0.01] border border-dashed border-white/5 rounded-3xl select-none">
                  <p className="text-xs text-text-secondary/40 italic">
                    Dados insuficientes para mapeamento de padrão.
                  </p>
                </div>
              ) : (
                <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
                  <p className="text-sm text-zinc-300 leading-relaxed font-light select-text">
                    Notamos um padrão crítico: a maior taxa da sua impulsividade está atrelada a <span className="font-medium text-white">{patternMapping.topTrigger}</span>. Ajuste essa variável na sua rotina para blindar sua performance.
                  </p>
                  
                  {patternMapping.relatedNotes.length > 0 && (
                    <blockquote className="mt-4 space-y-2 border-l-2 border-white/20 pl-3">
                      {patternMapping.relatedNotes.map((note, idx) => (
                        <p key={idx} className="text-sm text-gray-400 italic select-text">
                          "{note}"
                        </p>
                      ))}
                    </blockquote>
                  )}
                </div>
              )}
            </div>

            {/* SECTION: SEU PROGRESSO ATUAL */}
            <div className="space-y-4 text-left">
              <div className="flex justify-between items-center flex-wrap gap-2">
                <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] font-sans ml-1">
                  Seu Progresso Atual
                </h4>
                <span className="text-[9px] font-mono bg-white/5 border border-white/5 px-2 py-0.5 rounded-md text-zinc-400 font-bold uppercase tracking-wider">
                  {avoidanceHabitsList.length} Hábitos
                </span>
              </div>

              {sortedVices.length === 0 ? (
                <div className="py-12 text-center bg-white/[0.01] border border-dashed border-white/5 rounded-3xl select-none">
                  <Shield className="text-text-secondary/20 mx-auto mb-3" size={28} />
                  <p className="text-xs text-text-secondary/40 italic">
                    Nenhum comportamento cadastrado para acompanhamento no momento.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 font-sans">
                    {visibleVices.map((vice) => {
                      const mStreak = avoidanceStreaks[vice.id] || 0;
                      
                      return (
                        <div 
                          key={vice.id}
                          className="bg-white/[0.02] border border-white/5 hover:border-white/10 p-5 rounded-3xl flex flex-col justify-between space-y-4 text-left transition-all duration-300 relative overflow-hidden group"
                        >
                          <div className="flex justify-between items-start select-none">
                            <span className="text-base font-bold text-text-primary tracking-tight truncate max-w-[70%]">
                              {vice.name}
                            </span>
                          </div>
                          <div className="space-y-1 select-none">
                            <div className="flex items-center gap-2 leading-none">
                              <span className="text-4xl md:text-5xl font-bold font-sans text-white tracking-tighter">
                                {mStreak}
                              </span>
                              <span className="text-sm font-medium text-zinc-400 mt-2">
                                {mStreak === 1 ? 'dia limpo' : 'dias limpos'}
                              </span>
                            </div>
                          </div>
                          
                          {/* Destaque visual: Ação resistir */}
                          <div className="pt-2 border-t border-white/5">
                            <div className="flex justify-between items-center bg-[#6ee7a8]/5 border border-[#6ee7a8]/10 rounded-xl p-3">
                              <span className="text-xs font-medium text-[#6ee7a8]/80">Controle Mantido</span>
                              <ShieldCheck size={16} className="text-[#6ee7a8]/60" />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {sortedVices.length > 3 && (
                    <div className="pt-2 flex justify-start">
                      <button
                        onClick={() => setShowAllVices(!showAllVices)}
                        className="text-xs font-mono font-bold text-zinc-400 hover:text-white transition-colors flex items-center gap-1 cursor-pointer py-1"
                      >
                        <span>{showAllVices ? '↑ Mostrar menos' : `↓ Ver todos os ${sortedVices.length} hábitos`}</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* SECTION: SEUS RELATOS */}
            <div className="space-y-4 text-left pt-6 border-t border-white/[0.04]">
              <div className="flex justify-between items-center flex-wrap gap-2 mb-2">
                <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] font-sans ml-1">
                  Seus Relatos
                </h4>
                <span className="text-[10px] font-mono text-zinc-500">
                  {battlesWithNotes.length} anotações
                </span>
              </div>

              {battlesWithNotes.length > 0 ? (
                <div className="space-y-6 pt-1 select-text">
                  {battlesWithNotes.map((battle) => {
                    const dateStr = new Date(battle.created_at || battle.checkin_date).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: 'short'
                    });
                    const isSuccess = battle.status === 'success' || battle.status === 'resisti';
                    const associatedHabit = habits.find(h => h.id === battle.habit_id);
                    const habitName = associatedHabit ? associatedHabit.name : 'Vício Geral';

                    return (
                      <div key={battle.id} className="group flex flex-col gap-3 transition-all pb-4 border-b border-white/[0.04] last:border-0 last:pb-0 select-text relative">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap flex-1">
                            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider font-bold">
                              {dateStr}
                            </span>
                            <span className="text-[10px] font-mono text-white/10 select-none">•</span>
                            <span className="text-[10px] text-zinc-400 font-medium">
                              {habitName}
                            </span>
                            {battle.trigger_tag && (
                              <>
                                <span className="text-[10px] font-mono text-white/10 select-none">•</span>
                                <span className="text-[10px] text-zinc-500">
                                  {battle.trigger_tag}
                                </span>
                              </>
                            )}
                          </div>
                          
                          {/* Highlight Tag */}
                          {isSuccess && (
                            <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-[#6ee7a8] bg-[#6ee7a8]/10 px-2 py-1 rounded-full">
                              Resistiu
                            </span>
                          )}
                          {!isSuccess && (
                            <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-red-400 bg-red-500/10 px-2 py-1 rounded-full">
                              Recaiu
                            </span>
                          )}

                          <div className="flex items-center gap-2 ml-2">
                            {editingNoteId === battle.id ? (
                              <button
                                type="button"
                                onClick={() => handleEditSave(battle.id)}
                                className="p-1.5 rounded text-[#6ee7a8] hover:bg-white/10 transition-colors cursor-pointer"
                              >
                                <Check size={14} />
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setEditingNoteId(battle.id);
                                  setEditingNoteText(battle.trigger_note || '');
                                }}
                                className="p-1.5 rounded text-zinc-600 hover:text-white transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                              >
                                <Pencil size={14} />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setDeleteTarget(battle.id);
                              }}
                              disabled={isDeleting === battle.id}
                              className="p-1.5 rounded text-red-500/50 hover:text-red-400 transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                        
                        {editingNoteId === battle.id ? (
                          <div className="w-full">
                            <textarea
                              value={editingNoteText}
                              onChange={(e) => setEditingNoteText(e.target.value)}
                              className="w-full min-h-[80px] bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-white/20 resize-none font-light italic"
                              autoFocus
                            />
                          </div>
                        ) : (
                          <p className="text-sm md:text-base text-zinc-300 font-light italic leading-relaxed">
                            "{battle.trigger_note}"
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-zinc-500 italic select-none">
                  Nenhum relato registrado ultimamente.
                </div>
              )}
            </div>

            {/* Action Footer Button in main flow */}
            <div className="pt-6 mt-auto pb-4 shrink-0 w-full">
              <button
                onClick={onClose}
                className="w-full text-center py-4 px-6 rounded-2xl bg-white/5 border border-white/10 hover:border-white/15 text-text-primary text-xs font-black uppercase tracking-[0.2em] transition-all duration-200 active:scale-[0.98] cursor-pointer"
              >
                Concluir Análise
              </button>
            </div>

          </div>
          </motion.div>
        </div>
      )}

      <AnimatePresence>
        {deleteTarget && (
          <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-app-base/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#0b0e11] border border-white/10 rounded-[24px] p-6 max-w-sm w-full shadow-2xl relative overflow-hidden"
            >
              <h3 className="text-white font-semibold text-lg mb-2">Excluir Registro?</h3>
              <p className="text-text-secondary text-sm mb-6 leading-relaxed">
                Tem certeza que deseja excluir permanentemente este registro de campo? Esta ação não pode ser desfeita.
              </p>
              <div className="flex gap-3 justify-end relative z-10">
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-colors text-sm font-medium cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={isDeleting === deleteTarget}
                  className="px-4 py-2.5 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors text-sm font-medium cursor-pointer flex items-center justify-center"
                >
                  {isDeleting === deleteTarget ? 'Excluindo...' : 'Excluir'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
