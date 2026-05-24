import { useMemo } from 'react';
import { useDataStore } from '../../store/useDataStore';
import { AgendamentoCard } from './AgendamentoCard';
import { ScheduledActivity } from '../../types';
import { Calendar, ExternalLink } from 'lucide-react';

interface ProximasAtividadesProps {
  onStartSession: (activity: ScheduledActivity) => void;
  onOpenNewSchedule: () => void;
  onNavigateToFullAgenda?: () => void;
}

export const ProximasAtividades = ({ onStartSession, onOpenNewSchedule, onNavigateToFullAgenda }: ProximasAtividadesProps) => {
  const dataStore = useDataStore();

  const todayStr = useMemo(() => {
    return new Date().toISOString().split('T')[0];
  }, []);

  const upcomingActivities = useMemo(() => {
    return dataStore.scheduledActivities
      .filter(item => {
        return item.scheduled_date > todayStr && item.status === 'pending';
      })
      .slice(0, 3); // Display top 3 compact on dashboard
  }, [dataStore.scheduledActivities, todayStr]);

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

      {upcomingActivities.length === 0 ? (
        <div className="p-8 rounded-[2rem] bg-surface/5 border border-white/5 text-center flex flex-col items-center justify-center gap-3">
          <Calendar className="text-text-secondary/40" size={32} />
          <div className="space-y-1">
            <p className="text-sm font-medium text-text-secondary">Nenhum foco programado para o futuro.</p>
            <p className="text-xs text-text-secondary/50 max-w-sm mx-auto">
              Seu eu do futuro agradece por planejar e reservar horários de foco com antecedência.
            </p>
          </div>
          <button
            onClick={onOpenNewSchedule}
            type="button"
            className="mt-2 text-[10px] font-bold uppercase tracking-widest text-[#6ee7a8] border-b border-[#6ee7a8]/30 pb-0.5 hover:border-[#6ee7a8] transition-all"
          >
            Agendar Próxima Atividade
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {upcomingActivities.map(activity => (
            <AgendamentoCard
              key={activity.id}
              activity={activity}
              onStartSession={onStartSession}
            />
          ))}
        </div>
      )}
    </div>
  );
};
