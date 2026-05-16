import { useDataStore } from '../../store/useDataStore';
import { Layers } from 'lucide-react';
import { formatHumanTime } from '../../lib/utils';

export const HabitsSection = () => {
  const dataStore = useDataStore();

  return (
    <section className="w-full max-w-5xl space-y-16">
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
      
      <div className="grid grid-cols-1 gap-8">
        {dataStore.habits.length === 0 ? (
          <p className="text-text-secondary/40 font-light italic">Nenhum hábito atômico cadastrado.</p>
        ) : (
          dataStore.habits.map(habit => (
            <div key={habit.id} className="group p-10 rounded-[3rem] bg-surface/20 border border-border-white hover:border-primary-green/30 transition-all cursor-default flex flex-col md:flex-row justify-between items-start md:items-center gap-10">
              {/* Left Side */}
              <div className="space-y-6 flex-1">
                <div className="space-y-1">
                  <p className="text-text-secondary text-[10px] uppercase tracking-[0.3em] font-bold opacity-40">Atômico</p>
                  <h4 className="text-4xl font-light text-text-primary group-hover:text-primary-green transition-colors tracking-tight">{habit.name}</h4>
                </div>

                <div className="flex items-center gap-12 pt-2">
                  <div className="space-y-1">
                    <p className="text-text-secondary text-[10px] uppercase tracking-widest font-bold opacity-30">Tempo Total</p>
                    <p className="text-lg text-text-primary font-medium tracking-wide">
                      {formatHumanTime(habit.total_minutes)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-text-secondary text-[10px] uppercase tracking-widest font-bold opacity-30">Sessões Profundas</p>
                    <p className="text-lg text-text-primary font-medium tracking-wide">
                      {habit.deep_sessions_count} <span className="text-sm font-light opacity-60">sessões</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Right Side */}
              <div className="w-full md:w-auto text-left md:text-right space-y-2">
                <div className="mb-2">
                  {habit.completed_today ? (
                    <div className="flex items-center md:justify-end gap-2 text-primary-green">
                      <span className="text-xs font-bold uppercase tracking-widest">Feito hoje ✅</span>
                    </div>
                  ) : (
                    <div className="flex items-center md:justify-end gap-2 text-text-secondary/30">
                      <span className="text-xs font-bold uppercase tracking-widest">Ainda não realizado hoje</span>
                    </div>
                  )}
                </div>
                
                <div className="space-y-0 text-primary-green">
                  <p className="text-[clamp(48px,8vw,92px)] font-bold tracking-tighter leading-none">
                    {habit.current_streak}
                  </p>
                  <p className="text-sm font-bold uppercase tracking-[0.4em] opacity-60 md:mr-2">
                    Dias Invictos
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
};
