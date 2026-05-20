import { useDataStore } from '../../store/useDataStore';
import { Layers } from 'lucide-react';
import { formatHumanTime } from '../../lib/utils';
import { Habit } from '../../types';

const HabitCard = ({ habit }: { habit: Habit }) => {
  const progress = Array.from({ length: habit.sessions_per_week }, (_, i) => 
    i < habit.sessions_this_week
  );
  
  const preferredTimeLabel = {
    morning: '🌅 Manhã',
    afternoon: '☀️ Tarde', 
    evening: '🌙 Noite'
  }[habit.preferred_time];

  return (
    <div id={`habit-card-${habit.id}`} className="p-6 rounded-3xl bg-surface/10 border border-border-white hover:border-primary-green/20 transition-all">
      <div className="flex justify-between items-start mb-4">
        <h4 className="text-lg font-semibold text-text-primary">{habit.name}</h4>
        <span className="text-[10px] text-text-secondary/40 font-bold uppercase tracking-widest">
          {preferredTimeLabel}
        </span>
      </div>
      
      {/* Bolinhas de progresso */}
      <div className="flex items-center gap-2 mb-4">
        {progress.map((done, i) => (
          <div
            id={`habit-${habit.id}-progress-${i}`}
            key={i}
            className={`w-3 h-3 rounded-full transition-all ${
              done 
                ? 'bg-primary-green shadow-[0_0_8px_rgba(110,231,168,0.5)]' 
                : 'bg-white/10'
            }`}
          />
        ))}
        <span id={`habit-${habit.id}-week-count`} className="text-[10px] text-text-secondary/40 font-bold ml-2">
          {habit.sessions_this_week}/{habit.sessions_per_week} esta semana
        </span>
      </div>
      
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-secondary/40">
          {formatHumanTime(habit.minutes_per_session)} por sessão
        </span>
        <span className="text-sm font-bold text-primary-green">
          🔥 {habit.weekly_streak} {habit.weekly_streak === 1 ? 'semana' : 'semanas'} invicta{habit.weekly_streak !== 1 ? 's' : ''}
        </span>
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
