import React, { useState } from 'react';
import { useDataStore } from '../../store/useDataStore';
import { Layers, Calendar, ChevronDown, Plus, Pencil, Trash2, Check } from 'lucide-react';
import { formatHumanTime, getLocalDateString, safeParseDate } from '../../lib/utils';
import { Habit } from '../../types';
import { motion, AnimatePresence } from 'motion/react';

const HabitCard = ({ habit }: { key?: string | number; habit: Habit }) => {
  const dataStore = useDataStore();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  
  // Preferred times labels
  const preferredTimeLabel = {
    morning: '🌅 Manhã',
    afternoon: '☀️ Tarde', 
    evening: '🌙 Noite'
  }[habit.preferred_time];

  // Calculate today's local date details
  const todayStr = getLocalDateString(new Date());
  const startOfWeek = safeParseDate(habit.week_start_date);
  startOfWeek.setHours(0,0,0,0);

  // Group weekly deep focus sessions
  const habitSessionsThisWeek = dataStore.sessions.filter(s => 
    s.habit_id === habit.id && 
    new Date(s.started_at) >= startOfWeek && 
    s.completed
  );

  const minutesByDay: { [dateStr: string]: number } = {};
  habitSessionsThisWeek.forEach(s => {
    const dStr = getLocalDateString(new Date(s.started_at));
    const duration = s.actual_duration_minutes !== null ? s.actual_duration_minutes : s.duration_minutes;
    minutesByDay[dStr] = (minutesByDay[dStr] || 0) + duration;
  });

  // Include manual completions
  const manualCompletionsThisWeek = dataStore.habitCompletions.filter(hc => 
    hc.habit_id === habit.id && 
    new Date(hc.completed_at) >= startOfWeek && 
    !hc.focus_session_id
  );
  manualCompletionsThisWeek.forEach(hc => {
    const dStr = getLocalDateString(new Date(hc.completed_at));
    minutesByDay[dStr] = (minutesByDay[dStr] || 0) + hc.duration_minutes;
  });

  // Calculate final dynamic metrics
  const completedDaysCount = Object.keys(minutesByDay).filter(dStr => 
    minutesByDay[dStr] >= habit.minutes_per_session
  ).length;

  const todayMinutes = minutesByDay[todayStr] || 0;
  const targetMinutes = habit.minutes_per_session;

  const isTodayCompleted = todayMinutes >= targetMinutes;
  const isTodayPartial = todayMinutes > 0 && todayMinutes < targetMinutes;

  // Render weekly circles: COMPLETED (green), PARTIAL (amber), or EMPTY (gray)
  const progressCircles = Array.from({ length: habit.sessions_per_week }, (_, i) => {
    if (i < completedDaysCount) {
      return 'completed';
    } else if (i === completedDaysCount && isTodayPartial) {
      return 'partial';
    } else {
      return 'empty';
    }
  });

  const handleRegisterSession = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent('open-session-setup', {
      detail: {
        activityName: habit.name,
        habitId: habit.id,
        minutes: habit.minutes_per_session,
        prefilled: true
      }
    }));
  };

  const handleEditHabit = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent('open-action-center', {
      detail: {
        screen: 'habits',
        editingHabit: habit
      }
    }));
  };

  const handleDeleteHabit = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (showConfirmDelete) {
      await dataStore.deleteHabit(habit.id);
      dataStore.showNotification('Hábito excluído com sucesso', 'success');
      setShowConfirmDelete(false);
    } else {
      setShowConfirmDelete(true);
    }
  };

  const createdDateFormatted = habit.created_at 
    ? new Date(habit.created_at).toLocaleDateString('pt-BR') 
    : todayStr;

  const orderMap: Record<string, number> = { '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7 };
  const getDayName = (d: string) => ({ '1': 'Seg', '2': 'Ter', '3': 'Qua', '4': 'Qui', '5': 'Sex', '6': 'Sáb', '7': 'Dom' }[d] || d);
  const sortedDays = habit.recurrence_days 
    ? [...habit.recurrence_days].sort((a, b) => (orderMap[a] || 99) - (orderMap[b] || 99)) 
    : [];
  const formattedTime = habit.recurrence_time ? habit.recurrence_time.substring(0, 5) : '09:00';

  return (
    <div 
      id={`habit-card-${habit.id}`} 
      onClick={() => setIsExpanded(!isExpanded)}
      className={`p-6 rounded-3xl bg-surface/10 border transition-all flex flex-col justify-between cursor-pointer select-none ${
        isExpanded ? 'border-primary-green/30 bg-surface/20 shadow-lg' : 'border-border-white hover:border-primary-green/20'
      }`}
    >
      <div>
        <div className="flex justify-between items-start mb-2">
          <div className="flex-1 min-w-0 pr-3 flex items-start gap-2">
            <h4 className="text-lg font-semibold text-text-primary line-clamp-2">
              {habit.name}
            </h4>
            <span className={`text-[10px] mt-2 transform transition-transform duration-200 text-text-secondary/30 flex-shrink-0 ${isExpanded ? 'rotate-180 text-primary-green' : ''}`}>
              ▼
            </span>
          </div>
          <span className="text-[10px] text-text-secondary/40 font-bold uppercase tracking-widest whitespace-nowrap mt-1">
            {preferredTimeLabel}
          </span>
        </div>
        {habit.is_recurring && (
          <div className="mb-4 flex items-center gap-1.5 text-[10px] font-bold text-primary-green/80 uppercase tracking-widest bg-primary-green/5 border border-primary-green/10 py-1 px-2.5 rounded-full w-fit">
            <Calendar size={11} className="text-primary-green" />
            <span>
              Fixo: {sortedDays.map(getDayName).join(', ')} às {formattedTime}
            </span>
          </div>
        )}
        
        {/* Bolinhas de progresso */}
        <div className="flex items-center gap-2 mb-6">
          {progressCircles.map((state, i) => (
            <div
              id={`habit-${habit.id}-progress-${i}`}
              key={i}
              className={`w-3.5 h-3.5 rounded-full transition-all flex items-center justify-center relative ${
                state === 'completed' 
                  ? 'bg-primary-green shadow-[0_0_8px_rgba(110,231,168,0.5)]' 
                  : state === 'partial' 
                  ? 'border border-amber-400/40 bg-transparent overflow-hidden' 
                  : 'bg-white/10'
              }`}
            >
              {state === 'partial' && (
                <div 
                  className="absolute inset-y-0 left-0 bg-amber-400" 
                  style={{ width: `${(todayMinutes / targetMinutes) * 100}%` }}
                />
              )}
            </div>
          ))}
          <span id={`habit-${habit.id}-week-count`} className="text-[10px] text-text-secondary/40 font-bold ml-2">
            {completedDaysCount}/{habit.sessions_per_week} esta semana
          </span>
          {completedDaysCount > habit.sessions_per_week && (
            <span className="ml-2 px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-[9px] font-extrabold uppercase tracking-widest font-sans">
              Meta Superada: +{completedDaysCount - habit.sessions_per_week} Extras
            </span>
          )}
        </div>
      </div>
      
      {/* Visual states */}
      <div className="pt-4 border-t border-white/5 space-y-4">
        {!isTodayCompleted && !isTodayPartial && (
          <div className="flex items-center justify-between w-full text-xs">
            <span className="text-text-secondary/40">
              {formatHumanTime(habit.minutes_per_session)} por sessão
            </span>
            <span className="font-bold text-primary-green">
              🔥 {habit.weekly_streak} {habit.weekly_streak === 1 ? 'semana' : 'semanas'} invicta{habit.weekly_streak !== 1 ? 's' : ''}
            </span>
          </div>
        )}

        {isTodayPartial && (
          <div className="space-y-2">
            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
              <div 
                className="h-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.3)]"
                style={{ width: `${(todayMinutes / targetMinutes) * 100}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-amber-400 font-medium">
              <span>faltam {targetMinutes - todayMinutes} min hoje</span>
              <span>{todayMinutes} / {targetMinutes} min ({Math.round((todayMinutes / targetMinutes) * 100)}%)</span>
            </div>
          </div>
        )}

        {isTodayCompleted && (
          <div className="flex items-center justify-between w-full text-xs">
            <span className="text-primary-green font-medium flex items-center gap-1.5">
              ✓ meta de hoje cumprida
            </span>
            <span className="text-primary-green font-bold">
              {todayMinutes} / {targetMinutes} min
            </span>
          </div>
        )}

        {/* Collapsible expanded section */}
        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden space-y-4 pt-2 border-t border-white/5"
              onClick={(e) => e.stopPropagation()} // prevent collapsing on click
            >
              {/* Detailed metrics block */}
              <div className="space-y-2 bg-white/5 p-4 rounded-2xl border border-white/5 text-left">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-text-secondary/40 font-mono uppercase tracking-widest">Criado em</span>
                  <span className="font-mono font-medium text-text-primary">{createdDateFormatted}</span>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-text-secondary/40 font-sans uppercase tracking-widest">Sessões Totais</span>
                  <span className="font-semibold text-primary-green">🎯 {habit.deep_sessions_count || 0}</span>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-text-secondary/40 font-sans uppercase tracking-widest">Tempo Total Dedicado</span>
                  <span className="font-semibold text-text-primary">⌛ {formatHumanTime(habit.total_minutes || 0)}</span>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-text-secondary/40 font-sans uppercase tracking-widest">Semana Invicta</span>
                  <span className="font-semibold text-amber-400">🔥 {habit.weekly_streak} {habit.weekly_streak === 1 ? 'semana' : 'semanas'}</span>
                </div>
              </div>

              {/* Obligatory Action Buttons according to directive */}
              <div className="flex items-center gap-2 w-full pt-1">
                <button
                  onClick={handleRegisterSession}
                  className="flex-1 py-3 bg-primary-green hover:bg-primary-green/90 text-background rounded-xl font-bold uppercase tracking-widest text-[9px] transition-all flex items-center justify-center gap-1 min-h-[40px] cursor-pointer"
                >
                  <Plus size={11} />
                  + REGISTRAR SESSÃO
                </button>
                
                <button
                  onClick={handleEditHabit}
                  title="Editar hábito"
                  className="w-10 h-10 bg-white/5 hover:bg-white/10 active:scale-95 text-text-secondary hover:text-text-primary border border-white/10 rounded-xl flex items-center justify-center transition-all cursor-pointer"
                >
                  <Pencil size={14} />
                </button>

                <button
                  onClick={handleDeleteHabit}
                  title={showConfirmDelete ? "Confirmar exclusão" : "Excluir hábito"}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer border ${
                    showConfirmDelete 
                      ? 'bg-red-500/25 text-red-400 border-red-500/40 hover:bg-red-500/35 scale-105' 
                      : 'bg-white/5 hover:bg-white/10 text-text-secondary hover:text-red-400 border border-white/10'
                  }`}
                >
                  {showConfirmDelete ? <Check size={14} /> : <Trash2 size={14} />}
                </button>
              </div>

              {showConfirmDelete && (
                <p className="text-[9px] text-red-400/80 font-semibold tracking-wide uppercase text-center animate-pulse">
                  ⚠️ Confirme para excluir clicando no botão verde
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export const HabitsSection = () => {
  const dataStore = useDataStore();
  const [isExpanded, setIsExpanded] = useState(false);

  const activeCount = dataStore.habits.filter(h => h.habit_mode !== 'avoid').length;

  return (
    <section id="habits-section" className="w-full max-w-5xl space-y-4">
      {/* Header Collapsible Trigger */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-6 bg-surface/20 hover:bg-surface/35 border border-border-white rounded-3xl flex items-center justify-between cursor-pointer transition-all duration-300 group"
      >
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-text-secondary/60 group-hover:bg-white/10 group-hover:text-text-primary transition-colors">
            <Layers size={18} />
          </div>
          <div className="text-left">
            <h3 className="text-lg font-semibold text-text-primary tracking-tight font-sans">Hábitos Atômicos</h3>
            <p className="text-xs text-text-secondary/60 mt-0.5 font-sans">
              {activeCount} {activeCount === 1 ? 'hábito ativo' : 'hábitos ativos'}
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
            <div className="w-full p-6 bg-surface/20 border border-border-white rounded-3xl space-y-6">
              {/* Inner header & Action panel */}
              <div className="flex items-center justify-between flex-wrap gap-4 pb-2 border-b border-white/5">
                <div className="text-left max-w-sm md:max-w-md">
                  <p className="text-xs text-text-secondary/60 font-light">
                    Consistência Operacional: Tudo aquilo que você pratica repetidamente se torna um hábito definitivo.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      window.dispatchEvent(new CustomEvent('open-action-center', { detail: { screen: 'habits' } }));
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-[#6ee7a8]/10 hover:bg-[#6ee7a8]/20 border border-[#6ee7a8]/20 rounded-xl text-xs font-bold uppercase tracking-wider text-[#6ee7a8] transition-all cursor-pointer"
                  >
                    <Plus size={14} />
                    + Novo Hábito
                  </button>
                </div>
              </div>

              {/* Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {activeCount === 0 ? (
                  <p className="text-text-secondary/40 font-light italic col-span-2 text-left p-2">Nenhum hábito atômico cadastrado.</p>
                ) : (
                  dataStore.habits.filter(h => h.habit_mode !== 'avoid').map(habit => (
                    <HabitCard key={habit.id} habit={habit} />
                  ))
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};
