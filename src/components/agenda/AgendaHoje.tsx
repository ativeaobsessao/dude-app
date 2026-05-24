import { useMemo } from 'react';
import { useDataStore } from '../../store/useDataStore';
import { AgendamentoCard } from './AgendamentoCard';
import { ScheduledActivity } from '../../types';
import { CalendarDays, Plus } from 'lucide-react';

interface AgendaHojeProps {
  onStartSession: (activity: ScheduledActivity) => void;
  onOpenNewSchedule: () => void;
}

export const AgendaHoje = ({ onStartSession, onOpenNewSchedule }: AgendaHojeProps) => {
  const dataStore = useDataStore();

  const todayStr = useMemo(() => {
    return new Date().toISOString().split('T')[0];
  }, []);

  const todayActivities = useMemo(() => {
    return dataStore.scheduledActivities.filter(item => {
      return item.scheduled_date === todayStr && item.status !== 'cancelled';
    });
  }, [dataStore.scheduledActivities, todayStr]);

  const handleStart = (activity: ScheduledActivity) => {
    onStartSession(activity);
  };

  return (
    <div id="agenda-hoje-section" className="space-y-6 text-left">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-2xl font-bold tracking-tight text-text-primary">AGENDA DE HOJE</h3>
          <p className="text-xs text-text-secondary/60 mt-1">Seu cronograma de foco inteligente programado para o dia corrente.</p>
        </div>
        
        {todayActivities.length > 0 && (
          <button
            onClick={onOpenNewSchedule}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-[10px] uppercase font-bold tracking-widest text-[#6ee7a8] bg-[#6ee7a8]/10 hover:bg-[#6ee7a8]/20 rounded-full transition-all"
          >
            <Plus size={12} /> Agendar
          </button>
        )}
      </div>

      {todayActivities.length === 0 ? (
        <div className="p-8 rounded-[2rem] bg-surface/5 border border-white/5 text-center flex flex-col items-center justify-center gap-3">
          <CalendarDays className="text-text-secondary/40" size={32} />
          <div className="space-y-1">
            <p className="text-sm font-medium text-text-secondary">Nenhuma atividade agendada para hoje.</p>
            <p className="text-xs text-text-secondary/50 max-w-sm mx-auto">
              Programe suas sessões com antecedência para garantir foco e evitar paralisia de decisão.
            </p>
          </div>
          <button
            onClick={onOpenNewSchedule}
            type="button"
            className="mt-2 text-[10px] font-bold uppercase tracking-widest text-[#6ee7a8] border-b border-[#6ee7a8]/30 pb-0.5 hover:border-[#6ee7a8] transition-all"
          >
            Criar mais agendamentos e programar foco
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {todayActivities.map(activity => (
            <AgendamentoCard
              key={activity.id}
              activity={activity}
              onStartSession={handleStart}
            />
          ))}
        </div>
      )}
    </div>
  );
};
