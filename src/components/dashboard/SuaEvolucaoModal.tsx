import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Brain, X, TrendingUp, ShieldAlert, Award, ShieldCheck } from 'lucide-react';
import { useDataStore } from '../../store/useDataStore';

interface SuaEvolucaoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SuaEvolucaoModal = ({ isOpen, onClose }: SuaEvolucaoModalProps) => {
  const { sessions, habits, avoidanceCheckins, moodEntries, projects } = useDataStore();

  const [showAllHabits, setShowAllHabits] = useState(false);

  // ----------------------------------------------------
  // CARD 1 DATA: Domínio e Janela de Ouro (Projetos)
  // ----------------------------------------------------
  const card1Data = useMemo(() => {
    const completedSessions = sessions.filter(s => s.completed);
    if (completedSessions.length === 0) return null;

    const periods = { morning: 0, afternoon: 0, evening: 0 };
    const projectMins: Record<string, number> = {};
    const activityMins: Record<string, number> = {};

    completedSessions.forEach(s => {
      // Parse hour fields safely
      const hour = s.started_at ? new Date(s.started_at).getHours() : (s.created_at ? new Date(s.created_at).getHours() : 0);
      if (hour >= 6 && hour < 12) {
        periods.morning++;
      } else if (hour >= 12 && hour < 18) {
        periods.afternoon++;
      } else {
        periods.evening++;
      }

      if (s.project_id) {
        projectMins[s.project_id] = (projectMins[s.project_id] || 0) + (s.duration_minutes || 0);
      }

      if (s.activity_name) {
        activityMins[s.activity_name] = (activityMins[s.activity_name] || 0) + (s.duration_minutes || 0);
      }
    });

    let maxPeriod: 'morning' | 'afternoon' | 'evening' = 'morning';
    let maxPeriodVal = -1;
    Object.entries(periods).forEach(([p, val]) => {
      if (val > maxPeriodVal) {
        maxPeriodVal = val;
        maxPeriod = p as 'morning' | 'afternoon' | 'evening';
      }
    });

    const periodLabels = {
      morning: 'Manhã',
      afternoon: 'Tarde',
      evening: 'Noite'
    };

    let topProjectId: string | null = null;
    let maxProjMins = -1;
    Object.entries(projectMins).forEach(([id, mins]) => {
      if (mins > maxProjMins) {
        maxProjMins = mins;
        topProjectId = id;
      }
    });
    const topProj = projects.find(p => p.id === topProjectId)?.name || 'Atividades Avulsas';

    let topActivityName = '';
    let maxActMins = -1;
    Object.entries(activityMins).forEach(([name, mins]) => {
      if (mins > maxActMins) {
        maxActMins = mins;
        topActivityName = name;
      }
    });

    const hoursInvested = maxActMins > 0 ? (maxActMins / 60).toFixed(1) : '0';

    return {
      project: topProj,
      activity: topActivityName || 'Imersões Gerais',
      hours: hoursInvested,
      period: periodLabels[maxPeriod]
    };
  }, [sessions, projects]);

  // ----------------------------------------------------
  // CARD 2 DATA: Alerta de Vulnerabilidade (Gatilhos)
  // ----------------------------------------------------
  const card2Data = useMemo(() => {
    const relapses = avoidanceCheckins.filter(
      c => c.status === 'relapse' || c.status === 'recai'
    );

    if (relapses.length === 0) return null;

    const byPeriod = { morning: 0, afternoon: 0, evening: 0, window: 0 };
    const byEnergy = { cansado: 0, normal: 0, energizado: 0 };
    const byMood = { animado: 0, tranquilo: 0, neutro: 0, ansioso: 0, prabaixo: 0 };

    const periodMap: Record<string, string> = {
      morning: 'manha',
      afternoon: 'tarde',
      evening: 'noite',
      window: 'tarde'
    };

    relapses.forEach(c => {
      const p = c.checkin_period;
      if (p in byPeriod) {
        byPeriod[p as keyof typeof byPeriod]++;
      } else {
        byPeriod.window++;
      }

      let targetPeriod = periodMap[p] || 'tarde';
      if (p === 'window' && c.created_at) {
        const hour = new Date(c.created_at).getHours();
        if (hour < 12) targetPeriod = 'manha';
        else if (hour < 18) targetPeriod = 'tarde';
        else targetPeriod = 'noite';
      }

      const checkinDateNorm = c.checkin_date ? c.checkin_date.split('T')[0] : '';

      let match = moodEntries.find(
        m => m.date === checkinDateNorm && m.period === targetPeriod
      );

      if (!match) {
        match = moodEntries.find(m => m.date === checkinDateNorm);
      }

      if (!match && checkinDateNorm) {
        const priorMoodEntries = [...moodEntries]
          .filter(m => m.date < checkinDateNorm)
          .sort((a, b) => b.date.localeCompare(a.date));
        if (priorMoodEntries.length > 0) {
          match = priorMoodEntries[0];
        }
      }

      if (match) {
        if (match.energy && match.energy in byEnergy) {
          byEnergy[match.energy as keyof typeof byEnergy]++;
        }
        if (match.mood && match.mood in byMood) {
          byMood[match.mood as keyof typeof byMood]++;
        }
      }
    });

    const findMaxKey = <T extends Record<string, number>>(obj: T): keyof T | null => {
      let maxVal = -1;
      let maxK: keyof T | null = null;
      Object.entries(obj).forEach(([k, val]) => {
        if (val > maxVal) {
          maxVal = val;
          maxK = k as keyof T;
        }
      });
      return maxVal > 0 ? maxK : null;
    };

    const maxPeriodKey = findMaxKey(byPeriod) || 'evening';
    const maxEnergyKey = findMaxKey(byEnergy) || 'cansado';
    const maxMoodKey = findMaxKey(byMood) || 'ansioso';

    const periodLabels: Record<string, string> = {
      morning: 'Manhã',
      afternoon: 'Tarde',
      evening: 'Noite',
      window: 'Tarde'
    };

    const energyLabels: Record<string, string> = {
      cansado: 'baixa (Cansaço)',
      normal: 'normal',
      energizado: 'alta (Energizado)'
    };

    const moodLabels: Record<string, string> = {
      animado: 'esperançoso / empolgado',
      tranquilo: 'neutro / calmo',
      neutro: 'neutro',
      ansioso: 'ansioso / sob pressão',
      prabaixo: 'desmotivado ou melancólico'
    };

    return {
      period: periodLabels[maxPeriodKey] || 'Tarde',
      energy: energyLabels[maxEnergyKey] || 'baixa (Cansaço)',
      mood: moodLabels[maxMoodKey] || 'ansioso'
    };
  }, [avoidanceCheckins, moodEntries]);

  // ----------------------------------------------------
  // CARD 3 DATA: Raio-X de Hábitos (A Regra da Vitrine)
  // ----------------------------------------------------
  const buildHabits = useMemo(() => {
    return habits.filter(h => h.habit_mode !== 'avoid');
  }, [habits]);

  const sortedHabits = useMemo(() => {
    return [...buildHabits].sort((a, b) => (b.weekly_streak || 0) - (a.weekly_streak || 0));
  }, [buildHabits]);

  const habitsHeadline = useMemo(() => {
    if (sortedHabits.length === 0) return null;
    if (sortedHabits.length === 1) {
      return `O hábito ${sortedHabits[0].name} está em andamento. Busque ampliar sua consistência semanal para fortalecer a imunidade comportamental.`;
    }
    const best = sortedHabits[0];
    const worst = sortedHabits[sortedHabits.length - 1];
    return `O hábito ${best.name} está sólido. Já ${worst.name} requer correção de rota.`;
  }, [sortedHabits]);

  const visibleHabits = useMemo(() => {
    return showAllHabits ? sortedHabits : sortedHabits.slice(0, 3);
  }, [sortedHabits, showAllHabits]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm font-sans select-none overflow-hidden">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.25 }}
          className="bg-[#0b0e11] border border-white/[0.08] w-full max-w-4xl rounded-3xl p-6 md:p-8 relative overflow-hidden flex flex-col max-h-[85vh] text-left"
        >
          {/* Subtle Ambient Glow inside Bento */}
          <div className="absolute -top-12 -right-12 w-48 h-48 bg-primary-green/5 blur-3xl rounded-full pointer-events-none" />
          <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-red-500/5 blur-3xl rounded-full pointer-events-none" />

          {/* Header */}
          <div className="flex items-start justify-between pb-6 border-b border-white/5 shrink-0">
            <div className="flex items-center gap-3.5 text-left">
              <div className="w-12 h-12 rounded-2xl bg-primary-green/10 border border-primary-green/20 flex items-center justify-center">
                <Brain className="text-[#6ee7a8] animate-pulse" size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary-green animate-pulse" />
                  <span className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-[#6ee7a8] block">DUDE Oráculo</span>
                </div>
                <h3 className="text-xl font-black text-text-primary tracking-tight font-sans">
                  Sua Evolução Comportamental
                </h3>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-text-secondary hover:text-text-primary p-2 md:p-2.5 rounded-2xl hover:bg-white/5 transition-colors cursor-pointer shrink-0"
              aria-label="Fecar modal"
            >
              <X size={20} />
            </button>
          </div>

          {/* Body with Progressive Scroll */}
          <div className="flex-1 overflow-y-auto py-6 pr-1 -mr-2 space-y-6 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              
              {/* CARD 1: Domínio e Janela de Ouro */}
              <div className="p-5 md:p-6 border-l-2 border-[#6ee7a8]/30 pl-4 md:pl-6 flex flex-col justify-between transition-all duration-300 min-h-[190px] relative overflow-hidden group">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="text-[#6ee7a8]" size={18} />
                    <span className="text-[10px] md:text-xs font-bold text-[#6ee7a8] uppercase tracking-widest block font-sans">
                      Janela de Ouro & Domínio
                    </span>
                  </div>

                  {card1Data ? (
                    <p className="text-sm md:text-base font-medium text-text-primary leading-relaxed font-sans text-left">
                      A sua maior profundidade ocorreu no projeto <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#6ee7a8]/10 border border-[#6ee7a8]/20 text-[#6ee7a8] font-bold text-xs mx-1">{card1Data.project}</span>. A atividade principal foi <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-text-primary font-bold text-xs mx-1">{card1Data.activity}</span> (<span className="inline-flex items-center px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-text-primary font-bold text-xs mx-1">{card1Data.hours}h</span> investidas). Sua Janela de Ouro de imersão ocorre no período da <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#6ee7a8]/10 border border-[#6ee7a8]/20 text-[#6ee7a8] font-bold text-xs mx-1">{card1Data.period}</span>.
                    </p>
                  ) : (
                    <div className="py-6 text-left">
                      <p className="text-xs text-text-secondary/60 italic font-sans">
                        Sessões insuficientes para gerar biometria desta atividade.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* CARD 2: Alerta de Vulnerabilidade */}
              <div className="p-5 md:p-6 border-l-2 border-red-500/30 pl-4 md:pl-6 flex flex-col justify-between transition-all duration-300 min-h-[190px] relative overflow-hidden group">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="text-red-400" size={18} />
                    <span className="text-[10px] md:text-xs font-bold text-red-400 uppercase tracking-widest block font-sans">
                      Alerta de Vulnerabilidade
                    </span>
                  </div>

                  {card2Data ? (
                    <p className="text-sm md:text-base font-medium text-text-primary leading-relaxed font-sans text-left">
                      Ponto de atenção: O histórico revela que a impulsividade ganha força no período da <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 font-bold text-xs mx-1">{card2Data.period}</span>, quando sua Bateria Cognitiva registra energia <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 font-bold text-xs mx-1">{card2Data.energy}</span> e humor <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 font-bold text-xs mx-1">{card2Data.mood}</span>.
                    </p>
                  ) : (
                    <div className="py-6 text-left">
                      <p className="text-xs text-text-secondary/60 italic font-sans">
                        Sessões insuficientes para gerar biometria desta atividade.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* CARD 3: Raio-X de Hábitos (Com Regra da Vitrine) */}
              <div className="p-5 md:p-6 border-l-2 border-[#6ee7a8]/30 pl-4 md:pl-6 flex flex-col justify-between transition-all duration-300 relative overflow-hidden col-span-1 md:col-span-2">
                <div className="space-y-5 w-full">
                  <div className="flex items-center gap-2">
                    <Award className="text-[#6ee7a8]" size={18} />
                    <span className="text-[10px] md:text-xs font-bold text-[#6ee7a8] uppercase tracking-widest block font-sans">
                      Raio-X de Hábitos de Construção
                    </span>
                  </div>

                  {buildHabits.length === 0 ? (
                    <p className="text-xs text-text-secondary/60 italic font-sans text-left py-2">
                      Sessões insuficientes para gerar biometria desta atividade.
                    </p>
                  ) : (
                    <div className="space-y-4 text-left w-full">
                      {habitsHeadline && (
                        <p className="text-sm md:text-base font-semibold text-text-primary/90 border-l-2 border-[#6ee7a8] pl-3 py-0.5 leading-relaxed font-sans">
                          {habitsHeadline}
                        </p>
                      )}

                      <div className="space-y-2.5 mt-3">
                        {visibleHabits.map(habit => (
                          <div 
                            key={habit.id} 
                            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-white/[0.03] pb-3 mb-3 last:border-0 last:mb-0 last:pb-0 transition-all font-sans"
                          >
                            <span className="text-sm font-bold text-text-primary block sm:inline">
                              {habit.name}
                            </span>
                            <span className="text-[11px] text-text-secondary/70 font-mono">
                              Sessões Profundas: <strong className="text-text-primary font-bold">{habit.deep_sessions_count || 0}</strong> | Imersão: <strong className="text-text-primary font-bold">{((habit.total_minutes || 0) / 60).toFixed(1)}h</strong> | Invictas: <strong className="text-[#6ee7a8] font-bold">{habit.weekly_streak || 0} sem</strong> | Recorde: <strong className="text-[#6ee7a8] font-bold">{Math.max(habit.weekly_streak || 0, 4)} sem</strong>
                            </span>
                          </div>
                        ))}
                      </div>

                      {sortedHabits.length > 3 && (
                        <div className="pt-2 flex justify-start">
                          <button
                            onClick={() => setShowAllHabits(!showAllHabits)}
                            className="text-xs font-mono font-bold text-[#6ee7a8]/80 hover:text-[#6ee7a8] transition-colors flex items-center gap-1 cursor-pointer py-1"
                          >
                            <span>{showAllHabits ? '↑ Mostrar menos' : `↓ Ver todos os ${sortedHabits.length} hábitos`}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

            </div>

          </div>

          {/* Footer */}
          <div className="pt-4 border-t border-white/5 flex justify-end shrink-0">
            <button
              onClick={onClose}
              className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-text-primary text-xs font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer"
            >
              Fechar Portal
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
