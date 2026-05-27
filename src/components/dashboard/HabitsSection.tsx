import { useDataStore } from '../../store/useDataStore';
import { Layers, Calendar } from 'lucide-react';
import { formatHumanTime } from '../../lib/utils';
import { Habit } from '../../types';

const HabitCard = ({ habit }: { habit: Habit }) => {
  const dataStore = useDataStore();
  
  // Preferred times labels
  const preferredTimeLabel = {
    morning: '🌅 Manhã',
    afternoon: '☀️ Tarde', 
    evening: '🌙 Noite'
  }[habit.preferred_time];

  // Calculate today's local date details
  const todayStr = new Date().toLocaleDateString('en-CA');
  const startOfWeek = new Date(habit.week_start_date);
  startOfWeek.setHours(0,0,0,0);

  // Group weekly deep focus sessions
  const habitSessionsThisWeek = dataStore.sessions.filter(s => 
    s.habit_id === habit.id && 
    new Date(s.started_at) >= startOfWeek && 
    s.completed
  );

  const minutesByDay: { [dateStr: string]: number } = {};
  habitSessionsThisWeek.forEach(s => {
    const dStr = new Date(s.started_at).toLocaleDateString('en-CA');
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
    const dStr = new Date(hc.completed_at).toLocaleDateString('en-CA');
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

  return (
    <div id={`habit-card-${habit.id}`} className="p-6 rounded-3xl bg-surface/10 border border-border-white hover:border-primary-green/20 transition-all flex flex-col justify-between">
      <div>
        <div className="flex justify-between items-start mb-2">
          <h4 className="text-lg font-semibold text-text-primary">{habit.name}</h4>
          <span className="text-[10px] text-text-secondary/40 font-bold uppercase tracking-widest">
            {preferredTimeLabel}
          </span>
        </div>
        {habit.is_recurring && (
          <div className="mb-4 flex items-center gap-1.5 text-[10px] font-bold text-primary-green/80 uppercase tracking-widest bg-primary-green/5 border border-primary-green/10 py-1 px-2.5 rounded-full w-fit">
            <Calendar size={11} className="text-primary-green" />
            <span>
              Fixo: {habit.recurrence_days?.map((d: string) => ({ '1': 'Seg', '2': 'Ter', '3': 'Qua', '4': 'Qui', '5': 'Sex', '6': 'Sáb', '7': 'Dom' }[d] || d)).join(', ')} às {habit.recurrence_time || '09:00'}
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
        </div>
      </div>
      
      {/* Visual states */}
      <div className="pt-4 border-t border-white/5 space-y-3">
        {!isTodayCompleted && !isTodayPartial && (
          <div className="flex items-center justify-between w-full">
            <span className="text-xs text-text-secondary/40">
              {formatHumanTime(habit.minutes_per_session)} por sessão
            </span>
            <span className="text-sm font-bold text-primary-green">
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
          <div className="flex items-center justify-between w-full">
            <span className="text-xs text-primary-green font-medium flex items-center gap-1.5">
              ✓ meta de hoje cumprida
            </span>
            <span className="text-xs text-primary-green font-bold">
              {todayMinutes} / {targetMinutes} min
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export const HabitsSection = () => {
  const dataStore = useDataStore();

  return (
    <section id="habits-section" className="w-full max-w-5xl space-y-16">
      <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-border-white pb-8 gap-4">
        <div className="space-y-4">
          <span className="text-text-secondary uppercase tracking-[0.4em] text-[10px] font-bold flex items-center gap-3">
            <Layers size={14} className="text-primary-green" />
            Consistência Operacional
          </span>
          <h3 className="text-4xl md:text-5xl font-semibold tracking-tight text-text-primary">Hábitos Atômicos</h3>
        </div>
        <span className="text-[10px] text-text-secondary/40 font-mono tracking-[0.1em] mb-2">EVOLUÇÃO CONSCIENTE</span>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {dataStore.habits.length === 0 ? (
          <p className="text-text-secondary/40 font-light italic col-span-2">Nenhum hábito atômico cadastrado.</p>
        ) : (
          dataStore.habits.map(habit => (
            <HabitCard key={habit.id} habit={habit} />
          ))
        )}
      </div>
    </section>
  );
};
