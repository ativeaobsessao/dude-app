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
  const { avoidanceCheckins, moodEntries, habits, deleteAvoidanceCheckin, updateAvoidanceCheckin, fetchAvoidanceCheckins, profile } = useDataStore();
  const [showAllVices, setShowAllVices] = useState(false);
  
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    console.log('[TrendsAntiVicioModal] Deleting checkin:', deleteTarget);
    setIsDeleting(deleteTarget);
    await deleteAvoidanceCheckin(deleteTarget);
    if (profile) await fetchAvoidanceCheckins(profile.id);
    setIsDeleting(null);
    setDeleteTarget(null);
  };

  const handleEditSave = async (id: string) => {
    console.log('[TrendsAntiVicioModal] Updating checkin:', id, 'New text:', editingNoteText);
    await updateAvoidanceCheckin(id, { trigger_note: editingNoteText.trim() });
    setEditingNoteId(null);
    if (profile) await fetchAvoidanceCheckins(profile.id);
  };

  // 1. Math Aggregation with Fallbacks & Safety Checks
  const relapses = useMemo(() => {
    return avoidanceCheckins.filter(c => c.status === 'relapse' || c.status === 'recai');
  }, [avoidanceCheckins]);

  // Pillar B — Blindagem Mental calculations
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

  const trends = useMemo(() => {
    if (relapses.length === 0) {
      return {
        totalRelapses: 0,
        topTrigger: 'Nenhuma recaída registrada ainda',
        topPeriod: 'Sem dados suficientes',
        topMood: 'Estável (Equilibrado)',
        topEnergy: 'Energia Estável ⚡',
        neuroPill: 'Excelente início. Continue mantendo o controle total dos seus focos e use o cronômetro SOS quando os impulsos surgirem para reescrever seus caminhos neurais sem fricção.'
      };
    }

    const totalRelapses = relapses.length;

    // Top Trigger Tag calculation
    const triggerCounts: { [key: string]: number } = {};
    relapses.forEach(c => {
      const tag = c.trigger_tag || 'Gatilho Desconhecido';
      triggerCounts[tag] = (triggerCounts[tag] || 0) + 1;
    });
    
    let topTrigger = 'Gatilho Desconhecido';
    let maxTriggerCount = 0;
    Object.entries(triggerCounts).forEach(([tag, count]) => {
      if (count > maxTriggerCount) {
        maxTriggerCount = count;
        topTrigger = tag;
      }
    });

    // Top Period of Day
    const periodCounts = { manha: 0, tarde: 0, noite: 0 };
    relapses.forEach(c => {
      let hr = 15; // default afternoon fallback
      if (c.created_at) {
        const d = new Date(c.created_at);
        if (!isNaN(d.getTime())) {
          hr = d.getHours();
        }
      }
      if (hr >= 5 && hr < 12) periodCounts.manha++;
      else if (hr >= 12 && hr < 18) periodCounts.tarde++;
      else periodCounts.noite++;
    });

    let topPeriod = 'Tarde ☀️';
    const maxPeriodCount = Math.max(periodCounts.manha, periodCounts.tarde, periodCounts.noite);
    if (maxPeriodCount === periodCounts.manha) topPeriod = 'Manhã 🌅';
    else if (maxPeriodCount === periodCounts.noite) topPeriod = 'Noite 🌙';

    // Correlate check-in dates with Mood Entries
    const relapseMoods: string[] = [];
    const relapseEnergies: string[] = [];

    relapses.forEach(c => {
      const relapseDay = c.checkin_date ? c.checkin_date.split('T')[0] : '';
      const dayMoodEntries = moodEntries.filter(m => m.date === relapseDay);
      dayMoodEntries.forEach(m => {
        if (m.mood) relapseMoods.push(m.mood);
        if (m.energy) relapseEnergies.push(m.energy);
      });
    });

    // Top Mood State during relapses
    const moodCounts: { [key: string]: number } = {};
    relapseMoods.forEach(m => {
      moodCounts[m] = (moodCounts[m] || 0) + 1;
    });
    let topMoodKey = '';
    let maxMoodCount = 0;
    Object.entries(moodCounts).forEach(([m, count]) => {
      if (count > maxMoodCount) {
        maxMoodCount = count;
        topMoodKey = m;
      }
    });

    const moodMap = {
      animado: 'Euforia / Impulsividade ⚡',
      tranquilo: 'Excesso de Conforto 🍃',
      neutro: 'Tédio / Distração Passiva 🥱',
      ansioso: 'Ansiedade / Estresse Extremo 🤯',
      prabaixo: 'Melancolia / Desânimo 😴'
    };
    const topMood = topMoodKey ? (moodMap[topMoodKey as keyof typeof moodMap] || 'Instável') : 'Tédio ou Sensibilidade Emocional 🧠';

    // Top Physical Energy during relapses
    const energyCounts: { [key: string]: number } = {};
    relapseEnergies.forEach(e => {
      energyCounts[e] = (energyCounts[e] || 0) + 1;
    });
    let topEnergyKey = '';
    let maxEnergyCount = 0;
    Object.entries(energyCounts).forEach(([e, count]) => {
      if (count > maxEnergyCount) {
        maxEnergyCount = count;
        topEnergyKey = e;
      }
    });

    const energyMap = {
      cansado: 'Esgotamento Mental (Fadiga) 🥱',
      fadigado: 'Esgotamento Mental (Fadiga) 🥱',
      normal: 'Homeostase Estável ⚡',
      equilibrado: 'Homeostase Estável ⚡',
      energizado: 'Alta Voltagem (Tensão) 🔥',
      pleno: 'Alta Voltagem (Tensão) 🔥',
      inquieto: 'Dispersão (Agitação) 🌪️'
    };
    const topEnergy = topEnergyKey ? (energyMap[topEnergyKey as keyof typeof energyMap] || 'Estável') : 'Dados insuficientes';

    const firstName = profile?.full_name?.split(' ')[0] || 'DUDE';
    let neuroPill = '';

    if (topEnergyKey === 'inquieto') {
      neuroPill = `${firstName}, quando você se sente Inquieto você fica muito mais vulnerável a ceder a um impulso. Para que isso não aconteça, realize uma Sessão de Descompressão ou faça uma Sessão Profunda guiada. Lembre-se, a vontade de cometer um impulso dura no máximo 15 minutos.`;
    } else if (topEnergyKey === 'fadigado' || topEnergyKey === 'cansado') {
      neuroPill = `${firstName}, o esgotamento drena seu córtex pré-frontal, facilitando recaídas quando você está Fadigado. Respeite seu limite cognitivo, faça pausas longas e mude de ambiente para quebrar o ciclo de impulsos automáticos.`;
    } else if (topEnergyKey === 'pleno' || topEnergyKey === 'energizado') {
      neuroPill = `${firstName}, picos altos de energia podem gerar autoconfiança excessiva e impulsividade. Direcione essa carga energética excedente para um Brain Dump ou tarefas operacionais ativas antes de ser pego pelo tédio.`;
    } else {
      neuroPill = `${firstName}, o autocontrole é uma barreira metabolicamente cara para o organismo. Prevenir requer fricção prévia e rotas claras de desvio de urgências. Lembre-se, o vício celular nunca é apagado completamente da memória neuronal — ele é substituído ativamente por comportamentos substitutos.`;
    }

    return {
      totalRelapses,
      topTrigger,
      topPeriod,
      topMood,
      topEnergy,
      neuroPill
    };
  }, [relapses, moodEntries]);

  // Extract Avoidance check-ins that have notes for Section 3 (Ghost Quotes)
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
              <div className="w-11 h-11 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
                <Flame size={22} className="animate-pulse" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-red-500 block">SALA DE GUERRA COCKPIT</span>
                </div>
                <h3 className="text-xl font-black text-text-primary tracking-tight font-sans">
                  Trends Anti-Vício
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
            
            {/* INLINE STATUS BAR / HEADLINE BANNER */}
            {vicesHeadline && (
              <div className="p-4 bg-gradient-to-r from-red-500/[0.04] to-transparent border border-red-500/15 rounded-2xl flex items-center gap-3 select-text shrink-0">
                <span className="text-red-400 shrink-0 text-base">🛡️</span>
                <p className="text-xs md:text-sm font-semibold tracking-wide text-text-primary leading-relaxed">
                  {vicesHeadline}
                </p>
              </div>
            )}

            {/* SECTION: BLINDAGENS ATIVAS (CARDS DOS VÍCIOS) */}
            <div className="space-y-4 text-left">
              <div className="flex justify-between items-center flex-wrap gap-2">
                <h4 className="text-[10px] font-bold text-text-secondary/50 uppercase tracking-[0.22em] font-sans">
                  BLINDAGENS ATIVAS E MONITORAMENTO
                </h4>
                <span className="text-[9px] font-mono bg-white/5 border border-white/5 px-2 py-0.5 rounded-md text-text-secondary/50 font-bold uppercase tracking-wider">
                  {avoidanceHabitsList.length} ativas
                </span>
              </div>

              {sortedVices.length === 0 ? (
                <div className="py-12 text-center bg-white/[0.01] border border-dashed border-white/5 rounded-3xl select-none">
                  <Shield className="text-text-secondary/20 mx-auto mb-3" size={28} />
                  <p className="text-xs text-text-secondary/40 italic">
                    Nenhum comportamento cadastrado para blindagem no momento.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 font-sans">
                    {visibleVices.map((vice) => {
                      const mStreak = avoidanceStreaks[vice.id] || 0;
                      const mFalls = avoidanceCheckins.filter(
                        c => c.habit_id === vice.id && (c.status === 'relapse' || c.status === 'recai')
                      );

                      // Streak status dynamically generated based on Neuroscience rule
                      const statusString = mStreak < 3 
                        ? "Zona de Perigo: Risco de abstinência aguda." 
                        : mStreak < 21 
                        ? "Força de vontade em construção. Não abaixe a guarda." 
                        : "Caminhos neurais reescritos. Hábito enfraquecendo.";

                      // Calculate cofre values
                      const totalLimpo = avoidanceCheckins.filter(
                        c => c.habit_id === vice.id && (c.status === 'success' || c.status === 'resisti')
                      ).length;
                      
                      // Chronological streaks calculation for recorde vitalício
                      const checkinsChrono = avoidanceCheckins
                        .filter(c => c.habit_id === vice.id && (c.status === 'success' || c.status === 'resisti' || c.status === 'relapse' || c.status === 'recai'))
                        .sort((a, b) => new Date(a.checkin_date || 0).getTime() - new Date(b.checkin_date || 0).getTime());

                      let currentAcc = 0;
                      let maxStk = 0;
                      checkinsChrono.forEach(chk => {
                        if (chk.status === 'success' || chk.status === 'resisti') {
                          currentAcc++;
                          if (currentAcc > maxStk) maxStk = currentAcc;
                        } else {
                          currentAcc = 0;
                        }
                      });
                      const bestStkVal = Math.max(maxStk, mStreak);

                      // Analyze peak trigger & hours
                      let peakTriggerStr = '';
                      let peakHourStr = '';
                      if (mFalls.length > 0) {
                        const fallbackCounts: { [k: string]: number } = {};
                        mFalls.forEach(f => {
                          const tg = f.trigger_tag || f.trigger_note || 'Gatilho Geral';
                          fallbackCounts[tg] = (fallbackCounts[tg] || 0) + 1;
                        });
                        let maxFallsCount = 0;
                        Object.entries(fallbackCounts).forEach(([k, count]) => {
                          if (count > maxFallsCount) {
                            maxFallsCount = count;
                            peakTriggerStr = k;
                          }
                        });

                        // Hours analyze
                        const hourCounts: { [h: number]: number } = {};
                        mFalls.forEach(f => {
                          const dtStr = f.created_at || f.checkin_date;
                          if (dtStr) {
                            try {
                              const dtObj = new Date(dtStr);
                              const hour = dtObj.getHours();
                              hourCounts[hour] = (hourCounts[hour] || 0) + 1;
                            } catch {}
                          }
                        });
                        let maxHoursLogged = -1;
                        let maxHourCount = 0;
                        Object.entries(hourCounts).forEach(([h, count]) => {
                          if (count > maxHourCount) {
                            maxHourCount = count;
                            maxHoursLogged = parseInt(h);
                          }
                        });
                        if (maxHoursLogged !== -1) {
                          peakHourStr = `${String(maxHoursLogged).padStart(2, '0')}:00`;
                        }
                      }

                      // Dots generation helpers (last 7 calendar days)
                      const last7Days = Array.from({ length: 7 }, (_, i) => {
                        const d = new Date();
                        d.setDate(d.getDate() - (6 - i));
                        return d;
                      });

                      return (
                        <div 
                          key={vice.id}
                          className="bg-white/[0.015] hover:bg-white/[0.025] border border-white/5 hover:border-red-500/15 p-5 rounded-3xl flex flex-col justify-between space-y-4 text-left transition-all duration-300 relative overflow-hidden group"
                        >
                          {/* Name of vice / header */}
                          <div className="flex justify-between items-start select-none">
                            <span className="text-base font-extrabold text-text-primary tracking-tight truncate max-w-[70%]">
                              {vice.name}
                            </span>
                            <span className="text-[9px] font-mono font-bold bg-[#6ee7a8]/10 text-[#6ee7a8] border border-[#6ee7a8]/15 px-2.5 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                              ATIVO
                            </span>
                          </div>

                          {/* Streak de Fogo com layout higienizado */}
                          <div className="space-y-1 select-none">
                            <div className="flex items-center gap-1.5 leading-none">
                              <Flame className="text-orange-500 fill-orange-500/20 animate-pulse shrink-0" size={24} />
                              <span className="text-4xl md:text-5xl font-black font-sans leading-none text-transparent bg-clip-text bg-gradient-to-br from-white to-white/60 leading-none uppercase tracking-tighter">
                                {mStreak} {mStreak === 1 ? 'Dia' : 'Dias'}
                              </span>
                            </div>
                            <p className="text-[10.5px] leading-snug font-medium text-text-secondary/70 min-h-[32px]">
                              {statusString}
                            </p>
                          </div>

                          {/* Grid de Batalha: bolinhas para os últimos 7 dias */}
                          <div className="space-y-2 pt-1.5 border-t border-white/5 select-none">
                            <span className="text-[9px] font-mono font-bold text-text-secondary/40 uppercase tracking-widest block">
                              Últimos 7 dias
                            </span>
                            <div className="flex gap-2.5 items-center justify-start overflow-x-auto py-1 no-scrollbar">
                              {last7Days.map((day, dIdx) => {
                                const dStr = getLocalDateString(day);
                                const checkinsOnDay = avoidanceCheckins.filter(c => {
                                  if (c.habit_id !== vice.id) return false;
                                  const formattedValue = c.checkin_date ? getLocalDateString(new Date(c.checkin_date)) : '';
                                  return formattedValue === dStr;
                                });

                                const isRelapse = checkinsOnDay.some(c => c.status === 'relapse' || c.status === 'recai');
                                const isSuccess = checkinsOnDay.some(c => c.status === 'success' || c.status === 'resisti');
                                const dayInit = day.toLocaleDateString('pt-BR', { weekday: 'narrow' }).toUpperCase();
                                const isTd = dStr === getLocalDateString(new Date());

                                let dotColor = 'bg-white/[0.04] border border-white/10 text-text-secondary/35';
                                let dotLabel = 'Sem registros';
                                if (isRelapse) {
                                  dotColor = 'bg-red-500/90 shadow-[0_0_8px_rgba(239,68,68,0.5)]';
                                  dotLabel = 'Queda registrada';
                                } else if (isSuccess) {
                                  dotColor = 'bg-[#6ee7a8] shadow-[0_0_8px_rgba(110,231,168,0.4)]';
                                  dotLabel = 'Dia Limpo';
                                }

                                return (
                                  <div key={dIdx} className="flex flex-col items-center gap-1 shrink-0 font-mono">
                                    <span className={`text-[8.5px] font-extrabold ${isTd ? 'text-[#6ee7a8]' : 'text-text-secondary/40'}`}>
                                      {dayInit}
                                    </span>
                                    <div 
                                      className={`w-3.5 h-3.5 rounded-full transition-all duration-300 ${dotColor}`}
                                      title={`${day.toLocaleDateString('pt-BR')}: ${dotLabel}`}
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Bloco de Inteligência - Totalmente Frameless e Clean (Sem caixas prisões) */}
                          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-white/5 select-none text-left">
                            {/* O Cofre */}
                            <div className="flex flex-col justify-between space-y-1 hover:opacity-90 transition-opacity">
                              <div>
                                <span className="text-[8.5px] font-extrabold font-mono text-white/30 uppercase tracking-widest block leading-none">O COFRE</span>
                                <div className="flex items-baseline gap-1 mt-1">
                                  <span className="text-lg font-bold text-[#6ee7a8] font-mono leading-none">{totalLimpo}</span>
                                  <span className="text-[9px] text-text-secondary/50 font-medium">limpos</span>
                                </div>
                                <div className="text-[9.5px] text-text-secondary/40 mt-1">
                                  Recorde: <span className="font-mono font-bold text-text-primary">{bestStkVal}d</span>
                                </div>
                              </div>
                              <p className="text-[9px] font-bold text-[#6ee7a8]/75 tracking-tight pt-1.5 border-t border-white/5 mt-1 block w-full text-left">
                                ⏳ ~{Math.round(totalLimpo * 1.5)}h salvas
                              </p>
                            </div>

                            {/* Ponto Cego */}
                            <div className="flex flex-col justify-between space-y-1">
                              {mFalls.length > 0 ? (
                                <div className="space-y-1 text-left h-full flex flex-col justify-between">
                                  <div>
                                    <span className="text-[8.5px] font-extrabold font-mono text-white/30 uppercase tracking-widest block leading-none">PONTO CEGO</span>
                                    <div className="text-[11px] font-bold text-text-primary mt-1.5 leading-snug flex items-start gap-1 font-sans">
                                      <span className="text-red-400 shrink-0 select-none">⚠️</span>
                                      <span className="truncate max-w-[95px]">{peakTriggerStr}</span>
                                    </div>
                                  </div>
                                  {peakHourStr && (
                                    <div className="text-[9px] font-semibold text-text-secondary/70 flex items-center gap-1 mt-0.5 pt-1.5 border-t border-white/5">
                                      <span className="text-[#6ee7a8] shrink-0 select-none">⏰</span>
                                      <span className="truncate">Risco: <span className="font-mono font-bold text-text-primary">{peakHourStr}</span></span>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="flex flex-col h-full justify-between text-left">
                                  <div>
                                    <span className="text-[8.5px] font-extrabold font-mono text-white/30 uppercase tracking-widest block leading-none">PONTO CEGO</span>
                                  </div>
                                  <p className="text-[9.5px] text-[#6ee7a8]/80 italic leading-snug pt-1 whitespace-normal">
                                    🛡️ Analisando dados...
                                  </p>
                                </div>
                              )}
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
                        className="text-xs font-mono font-bold text-red-400 hover:text-red-300 transition-colors flex items-center gap-1 cursor-pointer py-1"
                      >
                        <span>{showAllVices ? '↑ Mostrar menos' : `↓ Ver todas as ${sortedVices.length} blindagens`}</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* SECTION: PREDICTIVE INSIGHTS */}
            <div className="space-y-4 text-left pt-2 border-t border-white/[0.04]">
              <div className="flex items-center gap-2">
                <Activity size={15} className="text-red-400 shrink-0" />
                <h4 className="text-[10px] font-bold text-text-secondary/50 uppercase tracking-[0.22em] font-sans">
                  CORRELAÇÃO E PARÂMETROS DE RISCO
                </h4>
              </div>
              <p className="text-xs text-text-secondary/60 font-light leading-relaxed max-w-2xl select-text">
                O cruzamento analítico correlaciona seus momentos de vulnerabilidade às métricas de humor e níveis de energia correspondentes no sistema.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 pt-2 select-text">
                {/* Metric Item 1 */}
                <div className="space-y-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-text-secondary/40 flex items-center gap-1.5 select-none">
                    <Target size={11} className="text-red-400" /> Gatilho Crítico
                  </span>
                  <div className="text-xs sm:text-sm font-semibold text-text-primary tracking-tight">
                    {trends.topTrigger}
                  </div>
                </div>

                {/* Metric Item 2 */}
                <div className="space-y-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-text-secondary/40 flex items-center gap-1.5 select-none">
                    <Clock size={11} className="text-red-400" /> Janela Vulnerável
                  </span>
                  <div className="text-xs sm:text-sm font-semibold text-text-primary tracking-tight">
                    {trends.topPeriod}
                  </div>
                </div>

                {/* Metric Item 3 */}
                <div className="space-y-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-text-secondary/40 flex items-center gap-1.5 select-none">
                    <Smile size={11} className="text-red-400" /> Humor Correlato
                  </span>
                  <div className="text-xs sm:text-sm font-semibold text-text-primary tracking-tight">
                    {trends.topMood}
                  </div>
                </div>

                {/* Metric Item 4 */}
                <div className="space-y-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-text-secondary/40 flex items-center gap-1.5 select-none">
                    <Activity size={11} className="text-red-400" /> Nível Biológico
                  </span>
                  <div className="text-xs sm:text-sm font-semibold text-text-primary tracking-tight">
                    {trends.topEnergy}
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION: NEUROSCIENCE PILL */}
            <div className="space-y-4 text-left pt-2 border-t border-white/[0.04]">
              <div className="flex items-center gap-2">
                <Brain size={15} className="text-[#6ee7a8]" />
                <h4 className="text-[10px] font-bold text-text-secondary/50 uppercase tracking-[0.22em] font-sans">
                  PÍLULA DE DIRECIONAMENTO NEURAL
                </h4>
              </div>
              <div className="rounded-2xl bg-gradient-to-br from-[#6ee7a8]/[0.03] to-transparent border border-[#6ee7a8]/10 p-5 space-y-2 select-text">
                <div className="text-[10px] font-mono font-bold tracking-widest text-[#6ee7a8] uppercase">
                  Anatomia Do Hábito: {trends.topTrigger.replace(/[^a-zA-ZÀ-ÿ\s]/g, '')}
                </div>
                <p className="text-xs md:text-sm text-text-primary/90 font-light leading-relaxed">
                  {trends.neuroPill}
                </p>
              </div>
            </div>

            {/* SECTION: HISTORY OF BATTLES (GHOST QUOTES) */}
            <div className="space-y-4 text-left pt-2 border-t border-white/[0.04]">
              <div className="flex justify-between items-center flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Compass size={15} className="text-purple-400 shrink-0" />
                  <h4 className="text-[10px] font-bold text-text-secondary/50 uppercase tracking-[0.22em] font-sans">
                    REGISTROS DE CAMPO (GHOST QUOTES)
                  </h4>
                </div>
                <span className="text-[10px] font-mono text-text-secondary/40">
                  {battlesWithNotes.length} anotações
                </span>
              </div>
              
              {battlesWithNotes.length > 0 ? (
                <div className="max-h-[300px] overflow-y-auto space-y-6 pt-1 select-text scrollbar-thin scrollbar-thumb-white/5 pr-1">
                  {battlesWithNotes.map((battle) => {
                    const dateStr = new Date(battle.created_at || battle.checkin_date).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: 'short'
                    });
                    const isSuccess = battle.status === 'success' || battle.status === 'resisti';
                    const associatedHabit = habits.find(h => h.id === battle.habit_id);
                    const habitName = associatedHabit ? associatedHabit.name : 'Vício Geral';

                    return (
                      <div key={battle.id} className="group flex items-start gap-4 transition-all pb-3 select-text last:pb-0">
                        {/* Status Minimal indicator */}
                        <div className="pt-1.5 shrink-0 select-none">
                          {isSuccess ? (
                            <div className="w-5 h-5 rounded-full bg-emerald-500/[0.05] border border-emerald-500/20 flex items-center justify-center text-[#6ee7a8]">
                              <ShieldCheck size={12} />
                            </div>
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-red-500/[0.05] border border-red-500/20 flex items-center justify-center text-red-400">
                              <ShieldAlert size={12} />
                            </div>
                          )}
                        </div>

                        {/* Ghost quote text frame */}
                        <div className="space-y-1.5 flex-1 border-b border-white/[0.02] pb-4 last:border-0 last:pb-0 select-text relative">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 flex-wrap flex-1">
                              <span className="text-[9px] font-mono uppercase tracking-wider text-text-secondary/40 font-bold block">
                                {dateStr}
                              </span>
                              <span className="text-[10px] font-mono text-white/20 select-none">•</span>
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-white/60 font-semibold tracking-wide uppercase">
                                ⚔️ {habitName}
                              </span>
                              <span className="text-[10px] font-mono text-white/20 select-none">•</span>
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 border border-white/5 text-text-secondary/50 font-semibold">
                                {battle.trigger_tag || 'Gatilho Geral'}
                              </span>
                              <span className="text-[10px] font-mono text-white/20 select-none">•</span>
                              <span className={`text-[9px] font-bold uppercase tracking-[0.1em] ${isSuccess ? 'text-[#6ee7a8]/80' : 'text-red-400/80'}`}>
                                {isSuccess ? 'Resistiu' : 'Recaiu'}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 relative z-10">
                              {editingNoteId === battle.id ? (
                                <button
                                  type="button"
                                  onClick={() => handleEditSave(battle.id)}
                                  className="p-1.5 rounded bg-white/10 text-white hover:bg-white/20 transition-colors cursor-pointer"
                                >
                                  <Check size={12} />
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
                                  className="p-1.5 rounded text-white/40 hover:text-white/80 hover:bg-white/10 transition-colors cursor-pointer"
                                >
                                  <Pencil size={12} />
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
                                className="p-1.5 rounded text-red-500/80 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                          
                          {editingNoteId === battle.id ? (
                            <div className="mt-2 pr-8">
                              <textarea
                                value={editingNoteText}
                                onChange={(e) => setEditingNoteText(e.target.value)}
                                className="w-full min-h-[60px] bg-white/5 border border-white/10 rounded p-2 text-sm text-white/90 placeholder:text-white/20 focus:outline-none focus:border-white/20 resize-none font-light italic"
                                autoFocus
                              />
                            </div>
                          ) : (
                            <p className="text-xs md:text-sm text-text-secondary/80 font-light italic leading-relaxed pl-2 border-l-2 border-white/5 select-text mt-1.5">
                              "{battle.trigger_note}"
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-text-secondary/40 italic select-none">
                  Nenhuma reflexão de autoconsciência registrada ultimamente. Da próxima vez, anote suas reflexões no final do SOS.
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
