import { useMemo } from 'react';
import { useDataStore } from '../../store/useDataStore';
import { AgendamentoCard } from './AgendamentoCard';
import { ScheduledActivity } from '../../types';
import { ExternalLink } from 'lucide-react';
import { getLocalDateString } from '../../lib/utils';

interface ProximasAtividadesProps {
  onStartSession: (activity: ScheduledActivity) => void;
  onOpenNewSchedule: () => void;
  onNavigateToFullAgenda?: () => void;
}

export const ProximasAtividades = ({ onStartSession, onOpenNewSchedule, onNavigateToFullAgenda }: ProximasAtividadesProps) => {
  const dataStore = useDataStore();

  const todayStr = useMemo(() => {
    return getLocalDateString(new Date());
  }, []);

  const upcomingActivities = useMemo(() => {
    return dataStore.scheduledActivities
      .filter(item => {
        return item.scheduled_date > todayStr && item.status === 'pending';
      })
      .slice(0, 3); // Display top 3 compact on dashboard
  }, [dataStore.scheduledActivities, todayStr]);

  if (upcomingActivities.length === 0) {
    return null;
  }

  return (
    <div id="proximas-atividades-section" className="space-y-6 text-left">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-2xl font-bold tracking-tight text-text-primary">ATIVIDADES PROGRAMADAS</h3>
          <p className="text-xs text-text-secondary/60 mt-1">Foco planejado para os próximos dias com checklists integrados.</p>
        </div>

        {onNavigateToFullAgenda && dataStore.scheduledActivities.length > 0 && (
          <button
            onClick={onNavigateToFullAgenda}
            className="flex items-center gap-1 text-[10px] uppercase font-bold tracking-widest text-[#6ee7a8] hover:brightness-110 transition-all"
          >
            Sua Agenda <ExternalLink size={12} />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {upcomingActivities.map(activity => (
          <AgendamentoCard
            key={activity.id}
            activity={activity}
            onStartSession={onStartSession}
          />
        ))}
      </div>
    </div>
  );
};
