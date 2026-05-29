import { useMemo } from 'react';
import { useDataStore } from '../../store/useDataStore';
import { AgendamentoCard } from './AgendamentoCard';
import { ScheduledActivity } from '../../types';
import { Plus } from 'lucide-react';
import { getLocalDateString } from '../../lib/utils';

interface AgendaHojeProps {
  onStartSession: (activity: ScheduledActivity) => void;
  onOpenNewSchedule: () => void;
}

export const AgendaHoje = ({ onStartSession, onOpenNewSchedule }: AgendaHojeProps) => {
  const dataStore = useDataStore();

  const todayStr = useMemo(() => {
    return getLocalDateString(new Date());
  }, []);

  const todayActivities = useMemo(() => {
    return dataStore.scheduledActivities.filter(item => {
      return item.scheduled_date === todayStr && item.status === 'pending';
    });
  }, [dataStore.scheduledActivities, todayStr]);

  const handleStart = (activity: ScheduledActivity) => {
    onStartSession(activity);
  };

  if (todayActivities.length === 0) {
    return null;
  }

  return (
    <div id="agenda-hoje-section" className="space-y-6 text-left">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-2xl font-bold tracking-tight text-text-primary">AGENDA DE HOJE</h3>
          <p className="text-xs text-text-secondary/60 mt-1">Seu cronograma de foco inteligente programado para o dia corrente.</p>
        </div>
        
        <button
          onClick={onOpenNewSchedule}
          className="flex items-center gap-1.5 px-3.5 py-1.5 text-[10px] uppercase font-bold tracking-widest text-[#6ee7a8] bg-[#6ee7a8]/10 hover:bg-[#6ee7a8]/20 rounded-full transition-all"
        >
          <Plus size={12} /> Agendar
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {todayActivities.map(activity => (
          <AgendamentoCard
            key={activity.id}
            activity={activity}
            onStartSession={handleStart}
          />
        ))}
      </div>

      <button 
        onClick={() => {
          window.dispatchEvent(new CustomEvent('navigate-to-agenda'));
        }}
        className="w-full py-4 mt-4 border border-white/10 rounded-xl text-[10px] font-bold uppercase tracking-widest text-text-secondary hover:text-primary-green hover:border-primary-green/30 transition-all"
      >
        VER TODAS ATIVIDADES PROGRAMADAS
      </button>
    </div>
  );
};
