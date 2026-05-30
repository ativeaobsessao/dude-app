import { useState, useEffect } from 'react';
import { useDataStore } from '../../store/useDataStore';
import { useAuthStore } from '../../store/useAuthStore';
import { Shield, ShieldAlert, Sparkles, Flame, Plus, Brain, Calendar, Trash2, Pencil, RefreshCw, BarChart2, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Habit, AvoidanceCheckin } from '../../types';

// Helper to get formatted date string: YYYY-MM-DD
const getLocalDateString = (d = new Date()) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const AvoidanceSection = () => {
  const { user } = useAuthStore();
  const dataStore = useDataStore();
  
  const [activePromptHabitId, setActivePromptHabitId] = useState<string | null>(null);
  const [activePromptPeriod, setActivePromptPeriod] = useState<string | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  
  // Filtering habits centered on anti-vício (habit_mode === 'avoid')
  const avoidHabits = dataStore.habits.filter(h => h.habit_mode === 'avoid');

  // Listen to open-avoidance-history custom event
  useEffect(() => {
    const handleOpenHistory = () => {
      setShowHistoryModal(true);
    };
    window.addEventListener('open-avoidance-history', handleOpenHistory);
    return () => {
      window.removeEventListener('open-avoidance-history', handleOpenHistory);
    };
  }, []);

  // Trigger avoidance check-in evaluations periodically
  useEffect(() => {
    if (!user || avoidHabits.length === 0) return;

    const evaluateCheckins = () => {
      const todayStr = getLocalDateString();
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinutesTotal = currentHour * 60 + now.getMinutes();

      // Day of week: '1' -> Seg, '7' -> Dom
      const dayOfWeek = now.getDay();
      const currentDayStr = dayOfWeek === 0 ? '7' : String(dayOfWeek);

      for (const habit of avoidHabits) {
        // 1. Is the habit active on this weekday?
        const isTodayActive = !habit.recurrence_days || 
                              habit.recurrence_days.length === 0 || 
                              habit.recurrence_days.includes(currentDayStr);

        if (!isTodayActive) continue;

        // Fetch completed checkins for this habit for today
        const todaysCheckins = dataStore.avoidanceCheckins.filter(
          c => c.habit_id === habit.id && c.checkin_date === todayStr
        );

        if (habit.avoidance_scope === 'time_window') {
          // Time window parsing "HH:MM"
          const startStr = habit.avoidance_window_start || '09:00';
          const endStr = habit.avoidance_window_end || '18:00';
          
          const [sh, sm] = startStr.split(':').map(Number);
          const [eh, em] = endStr.split(':').map(Number);
          
          let startMin = sh * 60 + sm;
          let endMin = eh * 60 + em;
          if (endMin < startMin) {
            endMin += 1440; // overnight support
          }
          
          const duration = endMin - startMin;
          const currentAdjustedMin = (currentMinutesTotal < startMin && currentMinutesTotal < 120) 
            ? currentMinutesTotal + 1440 
            : currentMinutesTotal;

          // Is current time within the window?
          if (currentAdjustedMin >= startMin && currentAdjustedMin <= endMin) {
            // How many check-ins are scheduled?
            const intensity = habit.avoidance_checkin_intensity || 'balanced';
            const countRequired = intensity === 'light' ? 1 : intensity === 'balanced' ? 2 : 3;

            // Calculate due check-ins based on elapsed time within the window
            const elapsed = currentAdjustedMin - startMin;
            let dueCount = 0;

            if (countRequired === 1) {
              // 1 check-in halfway through
              if (elapsed >= duration * 0.5) dueCount = 1;
            } else if (countRequired === 2) {
              // 2 check-ins at 1/3 and 2/3
              if (elapsed >= duration * 0.33) dueCount = 1;
              if (elapsed >= duration * 0.66) dueCount = 2;
            } else {
              // 3 check-ins at 1/4, 2/4, 3/4
              if (elapsed >= duration * 0.25) dueCount = 1;
              if (elapsed >= duration * 0.5) dueCount = 2;
              if (elapsed >= duration * 0.75) dueCount = 3;
            }

            // Exclude pending ones
            const windowCheckinsCount = todaysCheckins.filter(c => c.checkin_period === 'window').length;
            if (windowCheckinsCount < dueCount) {
              setActivePromptHabitId(habit.id);
              setActivePromptPeriod('window');
              break; // Handle one at a time for elegant UX
            }
          }
        } else {
          // Full Day scope: morning, afternoon, evening slots
          const intensity = habit.avoidance_checkin_intensity || 'balanced';
          
          // Let's define target due hours
          const slots: { period: 'morning' | 'afternoon' | 'evening'; hour: number }[] = [];
          if (intensity === 'light') {
            slots.push({ period: 'afternoon', hour: 15 });
          } else if (intensity === 'balanced') {
            slots.push({ period: 'morning', hour: 11 });
            slots.push({ period: 'evening', hour: 19 });
          } else {
            slots.push({ period: 'morning', hour: 10 });
            slots.push({ period: 'afternoon', hour: 15 });
            slots.push({ period: 'evening', hour: 20 });
          }

          let foundPending = false;
          for (const slot of slots) {
            if (currentHour >= slot.hour) {
              // Has the checkin for this period been made today?
              const registered = todaysCheckins.some(c => c.checkin_period === slot.period);
              if (!registered) {
                setActivePromptHabitId(habit.id);
                setActivePromptPeriod(slot.period);
                foundPending = true;
                break;
              }
            }
          }
          if (foundPending) break;
        }
      }
    };

    evaluateCheckins();
    const interval = setInterval(evaluateCheckins, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, [user, avoidHabits, dataStore.avoidanceCheckins]);

  // Submit check-in results
  const handleCheckinSubmit = async (status: 'success' | 'relapse') => {
    if (!user || !activePromptHabitId || !activePromptPeriod) return;

    const currentHabit = avoidHabits.find(h => h.id === activePromptHabitId);
    if (!currentHabit) return;

    const checkinData = {
      user_id: user.id,
      habit_id: activePromptHabitId,
      checkin_date: getLocalDateString(),
      checkin_period: activePromptPeriod as 'morning' | 'afternoon' | 'evening' | 'window',
      status
    };

    const result = await dataStore.addAvoidanceCheckin(checkinData);
    if (result) {
      if (status === 'success') {
        dataStore.showNotification(`Excelente! Recuperando o controle sobre ${currentHabit.name}.`, 'success');
      } else {
        dataStore.showNotification(`Foco mental restabelecido. Vamos manter a consistência no próximo.`, 'error');
      }
    }

    setActivePromptHabitId(null);
    setActivePromptPeriod(null);
  };

  // Delete habit
  const handleDeleteHabit = async (id: string) => {
    await dataStore.deleteHabit(id);
    dataStore.showNotification('Módulo Anti-Vício removido com sucesso.', 'success');
    setShowDeleteConfirm(null);
  };

  // Open creation modal pre-registered via event trigger
  const triggerNewAvoidanceModal = () => {
    window.dispatchEvent(new CustomEvent('open-action-center', {
      detail: { screen: 'anti-vicio' }
    }));
  };

  const triggerEditAvoidanceModal = (habit: Habit) => {
    window.dispatchEvent(new CustomEvent('open-action-center', {
      detail: { screen: 'anti-vicio', editHabit: habit }
    }));
  };

  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <section id="avoidance-section" className="w-full max-w-5xl space-y-4">
      {/* Header Collapsible Trigger */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-6 bg-surface/20 hover:bg-surface/35 border border-border-white rounded-3xl flex items-center justify-between cursor-pointer transition-all duration-300 group"
      >
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-text-secondary/60 group-hover:bg-white/10 group-hover:text-text-primary transition-colors">
            <Brain size={18} />
          </div>
          <div className="text-left font-sans">
            <h3 className="text-lg font-semibold text-text-primary tracking-tight">Anti-Vício</h3>
            <p className="text-xs text-text-secondary/60 mt-0.5">
              {avoidHabits.length} {avoidHabits.length === 1 ? 'controle ativo' : 'controles ativos'}
            </p>
          </div>
        </div>
        <div className={`text-text-secondary/40 group-hover:text-text-primary transition-colors transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
          <ChevronDown size={20} />
        </div>
      </div>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="p-1 pt-4 space-y-8">
              {/* Inner header & Action panel */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-surface/10 p-5 rounded-2xl border border-white/5 text-left font-sans">
                <span className="text-xs text-text-secondary/60 font-light">
                  Recuperação Comportamental Proativa: Centro para se livrar de vícios que impedem seu real desenvolvimento pessoal, projetado para autocontrole progressivo e resiliência psicológica mental.
                </span>
                <button
                  onClick={triggerNewAvoidanceModal}
                  className="flex items-center gap-1.5 px-4 py-2 text-[10px] uppercase font-bold tracking-widest text-text-secondary bg-white/5 hover:bg-white/10 hover:text-text-primary border border-white/10 rounded-full transition-all cursor-pointer whitespace-nowrap self-start sm:self-auto font-sans"
                >
                  Adicionar Controle
                </button>
              </div>

      {avoidHabits.length === 0 ? (
        <div className="p-8 md:p-12 rounded-3xl bg-surface/5 border border-white/5 text-center space-y-4 flex flex-col items-center justify-center">
          <Brain size={36} className="text-text-secondary/20" />
          <p className="text-text-secondary/50 font-light italic max-w-md">
            Ambiente livre de vícios ativos. Crie um canal com autocontrole personalizado para impulsionar sua produtividade.
          </p>
          <button
            onClick={triggerNewAvoidanceModal}
            className="px-6 py-2 rounded-full border border-white/10 hover:border-primary-green hover:bg-primary-green/10 text-text-primary text-[10px] uppercase font-bold tracking-widest transition-all cursor-pointer"
          >
            Começar Agora
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {avoidHabits.map(habit => {
            // Check if there is an active checkin due for this habit
            const promptVisible = activePromptHabitId === habit.id;
            
            // Stats Calculations
            const habitCheckins = dataStore.avoidanceCheckins.filter(c => c.habit_id === habit.id);
            const totalCheckinsObj = habitCheckins.filter(c => c.status !== 'pending');
            const totalCount = totalCheckinsObj.length;
            const successCount = totalCheckinsObj.filter(c => c.status === 'success').length;
            const relapseCount = totalCheckinsObj.filter(c => c.status === 'relapse').length;
            const consistency = totalCount > 0 ? Math.round((successCount / totalCount) * 100) : 100;
            
            // Hours Recovered (2 hours per conscious success block resistance win)
            const hoursRecovered = successCount * 2;
            
            // Level designation
            let controlLevel = "Nível 1 — Iniciante Consciente";
            if (consistency >= 90 && successCount >= 20) {
              controlLevel = "Nível 5 — Superconsciência Absoluta";
            } else if (consistency >= 85 && successCount >= 10) {
              controlLevel = "Nível 4 — Domínio Inabalável";
            } else if (consistency >= 70 && successCount >= 4) {
              controlLevel = "Nível 3 — Resistência Estável";
            } else if (consistency >= 50 && totalCount >= 2) {
              controlLevel = "Nível 2 — Autocontrole em Construção";
            }

            // Map checkins to previous 14 days for a beautiful dashboard heatmap grid
            const today = new Date();
            const last14Days = Array.from({ length: 14 }, (_, i) => {
              const d = new Date();
              d.setDate(today.getDate() - (13 - i));
              return getLocalDateString(d);
            });

            return (
              <div
                key={habit.id}
                className="p-6 rounded-3xl bg-surface/10 border border-border-white hover:border-primary-green/15 transition-all flex flex-col justify-between gap-6"
              >
                <div>
                  {/* Title & Preferences */}
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <h4 className="text-xl font-semibold text-text-primary tracking-tight">{habit.name}</h4>
                      <p className="text-[10px] text-text-secondary/60 font-medium uppercase tracking-widest flex items-center gap-1.5">
                        <Calendar size={10} className="text-primary-green/60" />
                        {habit.avoidance_scope === 'full_day' ? '🛡️ Todo o Dia' : `⏱️ Janela: ${habit.avoidance_window_start} - ${habit.avoidance_window_end}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => triggerEditAvoidanceModal(habit)}
                        className="p-2 text-text-secondary/40 hover:text-primary-green rounded-full transition-colors cursor-pointer"
                        title="Configurações de autocontrole"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm({ id: habit.id, name: habit.name })}
                        className="p-2 text-text-secondary/40 hover:text-red-400 rounded-full transition-colors cursor-pointer"
                        title="Desativar Anti-Vício"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Active Prompt overlay inside the card with graceful feedback */}
                  <AnimatePresence mode="wait">
                    {promptVisible && activePromptPeriod && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="mt-4 p-4 rounded-2xl bg-primary-green/5 border border-primary-green/20 space-y-3 shadow-sm"
                      >
                        <div className="flex items-start gap-2.5">
                          <Shield size={14} className="text-primary-green mt-0.5 animate-pulse" />
                          <p className="text-xs text-text-primary font-medium leading-relaxed">
                            Você conseguiu manter o controle mental sobre <span className="text-primary-green font-bold text-sm">{habit.name}</span> neste período?
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleCheckinSubmit('success')}
                            className="flex-1 py-2 text-[10px] font-bold uppercase tracking-wider bg-primary-green text-background rounded-full hover:scale-[1.02] active:scale-95 transition-all cursor-pointer text-center"
                          >
                            ✓ Mantive o controle
                          </button>
                          <button
                            onClick={() => handleCheckinSubmit('relapse')}
                            className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider bg-transparent text-amber-500 hover:text-amber-400 border border-amber-500/20 rounded-full active:scale-95 transition-all cursor-pointer text-center"
                          >
                            Tive recaída
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Self-Control Dashboard Grid metrics */}
                  {!promptVisible && (
                    <div className="mt-5 grid grid-cols-2 gap-4">
                      {/* Consistency indicator card */}
                      <div className="p-3 bg-white/5 rounded-2xl border border-white/5 flex flex-col gap-1">
                        <span className="text-[10px] text-text-secondary/40 font-bold uppercase tracking-wider">Consistência</span>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-2xl font-bold text-primary-green font-mono">{consistency}%</span>
                          {consistency >= 85 && <Sparkles size={11} className="text-primary-green animate-bounce" />}
                        </div>
                      </div>

                      {/* Recovered mental energy time card */}
                      <div className="p-3 bg-white/5 rounded-2xl border border-white/5 flex flex-col gap-1">
                        <span className="text-[10px] text-text-secondary/40 font-bold uppercase tracking-wider">Tempo Recuperado</span>
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl font-bold font-mono text-text-primary">{hoursRecovered}h</span>
                          <span className="text-[9px] text-text-secondary/50 font-medium">este mês</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Self Control Level Status line */}
                  <div className="mt-4 flex items-center gap-1.5">
                    <span className="text-[10px] text-text-secondary/60 font-semibold">• {controlLevel}</span>
                    <span className="text-[9px] font-semibold text-primary-green/60 uppercase tracking-widest bg-primary-green/5 border border-primary-green/10 px-2 py-0.5 rounded-full ml-auto">
                      {successCount} blocos vencidos
                    </span>
                  </div>

                  {/* github-style heatmap grid rows */}
                  <div className="mt-5 space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-bold text-text-secondary/40 uppercase tracking-widest">Heatmap de Resistência (14d)</span>
                      <span className="text-[8px] text-text-secondary/40 font-mono">hoje →</span>
                    </div>
                    <div className="flex items-center gap-1.5 justify-between py-1 bg-white/[0.02] border border-white/5 rounded-xl px-2">
                      {last14Days.map((dayStr, index) => {
                        const dayCheckins = habitCheckins.filter(c => c.checkin_date === dayStr);
                        let colorClass = 'bg-white/10'; // no checkins yet
                        let label = 'Sem check-ins';
                        
                        if (dayCheckins.length > 0) {
                          const relapsed = dayCheckins.some(c => c.status === 'relapse');
                          const succeeded = dayCheckins.some(c => c.status === 'success');
                          if (relapsed) {
                            colorClass = 'bg-amber-500/50 shadow-[0_0_6px_rgba(245,158,11,0.3)]';
                            label = `${dayCheckins.length} sessão(ões) - Recaída contida`;
                          } else if (succeeded) {
                            colorClass = 'bg-primary-green shadow-[0_0_6px_rgba(110,231,168,0.4)]';
                            label = `${dayCheckins.length} check-in(s) - Controle inabalável`;
                          }
                        }

                        // format date back to readable label
                        const displayDate = new Date(dayStr).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });

                        return (
                          <div
                            key={index}
                            className={`w-3.5 h-3.5 rounded-md transition-all duration-300 ${colorClass}`}
                            title={`${displayDate}: ${label}`}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Micro Actions line */}
                <div className="pt-3 border-t border-white/5 flex items-center justify-between text-[10px] text-text-secondary/40 font-mono">
                  <span>Intensidade: {{light: 'Leve', balanced: 'Equilibrada', strong: 'Forte'}[habit.avoidance_checkin_intensity || 'balanced']}</span>
                  {relapseCount > 0 && (
                    <span className="text-[9px] text-text-secondary/60">
                      Recuperação pós-recaída: <span className="text-primary-green font-bold font-sans">Rápida (&lt; 4h)</span>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Trigger links below the cards container */}
      {avoidHabits.length > 0 && (
        <div className="flex justify-center mt-4">
          <button
            onClick={() => setShowHistoryModal(true)}
            className="text-[10px] font-bold text-primary-green/60 hover:text-primary-green uppercase tracking-[0.2em] transition-all cursor-pointer underline underline-offset-4"
          >
            Ver histórico de Anti-Vícios
          </button>
        </div>
      )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. Premium History modal implementation */}
      <AnimatePresence>
        {showHistoryModal && (() => {
          // Calculations
          const totalCheckins = dataStore.avoidanceCheckins.length;
          const totalSuccesses = dataStore.avoidanceCheckins.filter(c => c.status === 'success').length;
          const totalRelapses = dataStore.avoidanceCheckins.filter(c => c.status === 'relapse').length;
          const successRate = totalCheckins > 0 ? Math.round((totalSuccesses / totalCheckins) * 100) : 100;

          // Streak clean days
          const checkinsByDay: { [dateStr: string]: 'success' | 'relapse' } = {};
          dataStore.avoidanceCheckins.forEach(c => {
            const dStr = c.checkin_date;
            if (c.status === 'relapse') {
              checkinsByDay[dStr] = 'relapse';
            } else if (c.status === 'success' && checkinsByDay[dStr] !== 'relapse') {
              checkinsByDay[dStr] = 'success';
            }
          });

          let currentStreak = 0;
          const todayObj = new Date();
          for (let i = 0; i < 30; i++) {
            const d = new Date();
            d.setDate(todayObj.getDate() - i);
            const dStr = getLocalDateString(d);
            if (checkinsByDay[dStr] === 'success') {
              currentStreak++;
            } else if (checkinsByDay[dStr] === 'relapse') {
              break;
            } else {
              if (i === 0) continue;
              break;
            }
          }

          // Mental progress levels
          let mentalLevel = "Nível 1 — Iniciante Consciente";
          let mentalLevelDesc = "Você está começando a restabelecer o controle sobre hábitos involuntários.";
          let nextThreshold = 5;
          let prevThreshold = 0;
          if (totalSuccesses >= 50) {
            mentalLevel = "Nível 5 — Superconsciência Absoluta";
            mentalLevelDesc = "Domínio total e inabalável sobre desejos involuntários e impulsos primitivos. Consciência plena.";
            nextThreshold = 100;
            prevThreshold = 50;
          } else if (totalSuccesses >= 30) {
            mentalLevel = "Nível 4 — Domínio Inabalável";
            mentalLevelDesc = "Excelente resistência. Sua resiliência neurológica está extremamente avançada.";
            nextThreshold = 50;
            prevThreshold = 30;
          } else if (totalSuccesses >= 15) {
            mentalLevel = "Nível 3 — Resistência Estável";
            mentalLevelDesc = "Consistência robusta. Você já consegue dominar impulsos de alto estresse com facilidade.";
            nextThreshold = 30;
            prevThreshold = 15;
          } else if (totalSuccesses >= 5) {
            mentalLevel = "Nível 2 — Autocontrole em Construção";
            mentalLevelDesc = "Ativação sólida do córtex pré-frontal e bloqueio de comportamentos automáticos.";
            nextThreshold = 15;
            prevThreshold = 5;
          }

          const progressPercent = Math.min(100, Math.round(((totalSuccesses - prevThreshold) / (nextThreshold - prevThreshold)) * 100));

          // 28 days heatmap
          const last28Days = Array.from({ length: 28 }, (_, i) => {
            const d = new Date();
            d.setDate(todayObj.getDate() - (27 - i));
            const dStr = getLocalDateString(d);
            const dayCheckins = dataStore.avoidanceCheckins.filter(c => c.checkin_date === dStr);
            let dayStatus: 'success' | 'relapse' | 'none' = 'none';
            if (dayCheckins.some(c => c.status === 'relapse')) {
              dayStatus = 'relapse';
            } else if (dayCheckins.length > 0) {
              dayStatus = 'success';
            }
            return { dateStr: dStr, status: dayStatus, label: d.getDate() };
          });

          return (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-background/90 backdrop-blur-md"
            >
              <motion.div
                initial={{ scale: 0.95, y: 15 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 15 }}
                className="w-full max-w-2xl bg-surface border border-border-white rounded-3xl p-6 md:p-8 flex flex-col gap-6 shadow-2xl relative max-h-[90vh] overflow-y-auto style-scrollbar"
              >
                <div className="flex justify-between items-center border-b border-white/5 pb-4">
                  <div className="space-y-1">
                    <h3 className="text-2xl font-bold text-text-primary tracking-tight flex items-center gap-2">
                      <Brain className="text-primary-green animate-pulse" size={24} /> Centro de Autoevolução Mental
                    </h3>
                    <p className="text-xs text-text-secondary/60 font-light">Métricas operacionais, streaks de autocontrole e progresso neurológico</p>
                  </div>
                  <button
                    onClick={() => setShowHistoryModal(false)}
                    className="p-2 text-text-secondary/40 hover:text-text-primary hover:bg-white/5 rounded-full transition-all cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                {/* Grid de Métricas Principais */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl text-center space-y-1">
                    <span className="text-[9px] font-bold text-text-secondary/50 uppercase tracking-widest block">Índice Geral</span>
                    <span className="text-2xl font-semibold text-primary-green tracking-tight">{successRate}%</span>
                  </div>
                  <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl text-center space-y-1">
                    <span className="text-[9px] font-bold text-text-secondary/50 uppercase tracking-widest block">Clean Streak</span>
                    <span className="text-2xl font-semibold text-text-primary tracking-tight flex items-center justify-center gap-1">
                      <Flame size={18} className="text-amber-500 fill-amber-500/20" /> {currentStreak}d
                    </span>
                  </div>
                  <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl text-center space-y-1">
                    <span className="text-[9px] font-bold text-text-secondary/50 uppercase tracking-widest block">Controles</span>
                    <span className="text-2xl font-semibold text-primary-green tracking-tight">{totalSuccesses}</span>
                  </div>
                  <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl text-center space-y-1">
                    <span className="text-[9px] font-bold text-text-secondary/50 uppercase tracking-widest block">Lapsos</span>
                    <span className="text-2xl font-semibold text-amber-500 tracking-tight">{totalRelapses}</span>
                  </div>
                </div>

                {/* Seção Progresso Mental / Nível */}
                <div className="p-5 bg-gradient-to-r from-primary-green/5 to-transparent border border-primary-green/15 rounded-2xl space-y-3">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                    <div className="space-y-0.5">
                      <span className="text-[9px] font-extrabold text-primary-green uppercase tracking-widest flex items-center gap-1">
                        <Sparkles size={11} className="animate-pulse" /> Estágio de Resiliência Psicológica
                      </span>
                      <h4 className="text-base font-bold text-text-primary">{mentalLevel}</h4>
                    </div>
                    <span className="text-[10px] text-text-secondary/50 font-mono tracking-tight self-start sm:self-auto uppercase">
                      {totalSuccesses} / {nextThreshold} sucessos
                    </span>
                  </div>
                  <p className="text-xs text-text-secondary/70 font-light leading-relaxed">{mentalLevelDesc}</p>
                  
                  {/* Barra de Progresso */}
                  <div className="space-y-1">
                    <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden border border-white/5">
                      <div 
                        className="bg-primary-green h-full rounded-full shadow-[0_0_10px_rgba(110,231,168,0.4)] transition-all duration-1000" 
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[9px] text-text-secondary/40 font-mono">
                      <span>Nível atual</span>
                      <span>{progressPercent}% para o próximo nível</span>
                    </div>
                  </div>
                </div>

                {/* Mapa de Calor - 28 Dias Recentes */}
                <div className="p-5 bg-white/[0.02] border border-white/5 rounded-2xl space-y-3">
                  <span className="text-[9px] font-extrabold text-text-secondary/50 uppercase tracking-widest flex items-center gap-1.5">
                    <Calendar size={12} className="text-primary-green/60" /> Mapa de Consistência (Últimos 28 Dias)
                  </span>
                  
                  <div className="grid grid-cols-7 gap-2">
                    {last28Days.map((day, idx) => {
                      const colorClass = {
                        success: 'bg-primary-green/30 border-primary-green text-primary-green font-bold',
                        relapse: 'bg-amber-500/20 border-amber-500 text-amber-500 font-bold',
                        none: 'bg-white/5 border-white/5 text-text-secondary/30'
                      }[day.status];

                      return (
                        <div
                          key={idx}
                          title={`${day.dateStr}: ${day.status === 'success' ? 'Controle' : day.status === 'relapse' ? 'Lapso' : 'Sem registro'}`}
                          className={`aspect-square sm:p-2 flex flex-col items-center justify-center rounded-lg border text-[10px] transition-all hover:scale-105 ${colorClass}`}
                        >
                          <span className="font-mono">{day.label}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-center gap-4 text-[9px] text-text-secondary/40 font-mono pt-1">
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-primary-green/30 border border-primary-green rounded-full inline-block" /> Controle</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-amber-500/20 border border-amber-500 rounded-full inline-block" /> Lapso</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-white/5 border border-white/5 rounded-full inline-block" /> Sem Registro</span>
                  </div>
                </div>

                {/* Lista Geral de Registros */}
                <div className="space-y-3">
                  <span className="text-[9px] font-extrabold text-text-secondary/50 uppercase tracking-widest flex items-center gap-1.5 px-1">
                    <BarChart2 size={12} className="text-primary-green/60" /> Histórico Geral de Check-ins
                  </span>

                  <div className="space-y-2.5 max-h-[25vh] overflow-y-auto pr-1 style-scrollbar">
                    {dataStore.avoidanceCheckins.length === 0 ? (
                      <p className="text-center font-light text-text-secondary/40 italic py-6 text-xs">Nenhum check-in registrado no banco de dados.</p>
                    ) : (
                      dataStore.avoidanceCheckins.map((checkin) => {
                        const relatedHabit = avoidHabits.find(h => h.id === checkin.habit_id);
                        const displayDate = new Date(checkin.checkin_date).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        });

                        const periodLabel = {
                          morning: 'Manhã',
                          afternoon: 'Tarde',
                          evening: 'Noite',
                          window: 'Janela'
                        }[checkin.checkin_period] || checkin.checkin_period;

                        return (
                          <div
                            key={checkin.id}
                            className="flex items-center justify-between p-3.5 bg-white/[0.02] border border-white/5 rounded-2xl hover:bg-white/[0.04] transition-colors"
                          >
                            <div className="space-y-0.5">
                              <h5 className="text-xs font-semibold text-text-primary">
                                {relatedHabit?.name || 'Comportamento Excluído'}
                              </h5>
                              <p className="text-[9px] text-text-secondary/50 font-mono uppercase tracking-widest">
                                {displayDate} • {periodLabel}
                              </p>
                            </div>
                            
                            <span className={`text-[8px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full ${
                              checkin.status === 'success'
                                ? 'bg-primary-green/10 text-primary-green border border-primary-green/15 animate-pulse'
                                : 'bg-amber-500/10 text-amber-500 border border-amber-500/15'
                            }`}>
                              {checkin.status === 'success' ? '✓ Controle' : '⚠ Lapso'}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="mt-2 flex justify-end">
                  <button
                    onClick={() => setShowHistoryModal(false)}
                    className="px-6 py-3 border border-border-white rounded-2xl text-[10px] uppercase tracking-widest font-bold hover:bg-white/5 transition-all cursor-pointer"
                  >
                    Fechar Histórico
                  </button>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* Delete confirmation overlay */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[700] flex items-center justify-center p-6 bg-background/80 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm bg-surface border border-border-white rounded-3xl p-8 flex flex-col items-center gap-6 text-center shadow-2xl"
            >
              <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center text-red-400">
                <ShieldAlert size={22} className="animate-bounce" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-text-primary tracking-tight">Remover módulo mental?</h3>
                <p className="text-xs text-text-secondary font-light leading-relaxed">
                  Tem certeza que deseja apagar o registro de autocontrole para <span className="font-semibold text-primary-green">{showDeleteConfirm.name}</span>? Esta ação é definitiva.
                </p>
              </div>
              <div className="flex gap-3 w-full">
                <button
                  onClick={() => handleDeleteHabit(showDeleteConfirm.id)}
                  className="flex-1 py-3.5 bg-red-500/15 hover:bg-red-500/25 border border-red-500/20 text-red-400 rounded-2xl font-bold uppercase tracking-widest text-[9px] transition-colors cursor-pointer"
                >
                  Sim, apagar
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  className="flex-1 py-3.5 border border-border-white text-text-primary rounded-2xl font-bold uppercase tracking-widest text-[9px] hover:bg-white/5 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};
