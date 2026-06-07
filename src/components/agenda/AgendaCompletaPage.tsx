import { useState, useMemo } from 'react';
import { useDataStore } from '../../store/useDataStore';
import { AgendamentoCard } from './AgendamentoCard';
import { ScheduledActivity } from '../../types';
import { Calendar, CheckCircle, Ban, Hourglass, ArrowLeft, Plus } from 'lucide-react';
import { getLocalDateString, getLocalYesterdayDateString, getLocalTomorrowDateString } from '../../lib/utils';

interface AgendaCompletaPageProps {
  onBack: () => void;
  onStartSession: (activity: ScheduledActivity) => void;
  onOpenNewSchedule: () => void;
}

type TabFilter = 'all' | 'pending' | 'completed' | 'cancelled';

export const AgendaCompletaPage = ({ onBack, onStartSession, onOpenNewSchedule }: AgendaCompletaPageProps) => {
  const dataStore = useDataStore();
  const [activeTab, setActiveTab] = useState<TabFilter>('pending');

  // Filter, sort, and group schedules into PRÓXIMOS and JÁ PASSARAM
  const splitSchedules = useMemo(() => {
    const filtered = dataStore.scheduledActivities.filter(sa => {
      const matchStatus = (saStatus: string, filterTab: TabFilter): boolean => {
        if (filterTab === 'all') return true;
        if (filterTab === 'pending') return saStatus === 'pending' || saStatus === 'agendada';
        if (filterTab === 'completed') return saStatus === 'completed' || saStatus === 'concluida';
        if (filterTab === 'cancelled') return saStatus === 'cancelled' || saStatus === 'cancelada' || saStatus === 'expirada';
        return saStatus === filterTab;
      };
      return matchStatus(sa.status, activeTab);
    });

    // Upcoming: pending/agendada
    const upcomingList = filtered.filter(sa => sa.status === 'pending' || sa.status === 'agendada');
    // Resolved/Past: completed, concluida, cancelled, cancelada, expirada
    const pastList = filtered.filter(sa => sa.status !== 'pending' && sa.status !== 'agendada');

    // Sort upcoming ascending: soonest first
    const sortedUpcoming = [...upcomingList].sort((a, b) => {
      if (a.scheduled_date !== b.scheduled_date) {
        return a.scheduled_date.localeCompare(b.scheduled_date);
      }
      return a.scheduled_time.localeCompare(b.scheduled_time);
    });

    // Sort past descending: most recent first
    const sortedPast = [...pastList].sort((a, b) => {
      if (a.scheduled_date !== b.scheduled_date) {
        return b.scheduled_date.localeCompare(a.scheduled_date);
      }
      return b.scheduled_time.localeCompare(a.scheduled_time);
    });

    // Group upcoming by date
    const upcomingGroups: { date: string; activities: ScheduledActivity[] }[] = [];
    sortedUpcoming.forEach(sa => {
      let group = upcomingGroups.find(g => g.date === sa.scheduled_date);
      if (!group) {
        group = { date: sa.scheduled_date, activities: [] };
        upcomingGroups.push(group);
      }
      group.activities.push(sa);
    });

    // Group past by date
    const pastGroups: { date: string; activities: ScheduledActivity[] }[] = [];
    sortedPast.forEach(sa => {
      let group = pastGroups.find(g => g.date === sa.scheduled_date);
      if (!group) {
        group = { date: sa.scheduled_date, activities: [] };
        pastGroups.push(group);
      }
      group.activities.push(sa);
    });

    return { upcomingGroups, pastGroups, totalFiltered: filtered.length };
  }, [dataStore.scheduledActivities, activeTab]);

  // Dynamic Statistics Counters
  const stats = useMemo(() => {
    let total = dataStore.scheduledActivities.length;
    let pending = dataStore.scheduledActivities.filter(sa => sa.status === 'pending' || sa.status === 'agendada').length;
    let completed = dataStore.scheduledActivities.filter(sa => sa.status === 'completed' || sa.status === 'concluida').length;
    let cancelled = dataStore.scheduledActivities.filter(sa => sa.status === 'cancelled' || sa.status === 'cancelada' || sa.status === 'expirada').length;
    
    // Total scheduled minutes calculated
    let totalMinutes = dataStore.scheduledActivities
      .filter(sa => sa.status === 'completed' || sa.status === 'concluida')
      .reduce((acc, curr) => acc + curr.duration_minutes, 0);

    return { total, pending, completed, cancelled, totalHours: Math.round(totalMinutes / 60) };
  }, [dataStore.scheduledActivities]);

  const formatDateHeader = (dateStr: string) => {
    const today = getLocalDateString(new Date());
    const tomorrow = getLocalTomorrowDateString(new Date());
    const yesterday = getLocalYesterdayDateString(new Date());

    if (dateStr === today) return 'Hoje 📅';
    if (dateStr === tomorrow) return 'Amanhã 🌅';
    if (dateStr === yesterday) return 'Ontem 🌌';

    const dateObj = new Date(dateStr + 'T00:00:00');
    return dateObj.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  return (
    <div id="agenda-completa-page" className="w-full max-w-7xl mx-auto px-4 md:px-8 py-10 space-y-10 animate-fade-in text-left">
      
      {/* Navigation Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-2">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-text-secondary hover:text-primary-green transition-all font-bold uppercase tracking-widest text-[10px]"
          >
            <ArrowLeft size={12} /> Voltar ao Dashboard
          </button>
          <h1 className="text-4xl font-extrabold tracking-tight text-text-primary uppercase">
            REALIZAR AGENDAMENTO
          </h1>
        </div>

        <button
          onClick={onOpenNewSchedule}
          className="flex items-center gap-2 px-5 py-3.5 text-xs uppercase font-bold tracking-widest text-background bg-[#6ee7a8] hover:brightness-110 rounded-2xl shadow-[0_0_30px_rgba(110,231,168,0.2)] transition-all"
        >
          <Plus size={14} /> + NOVO AGENDAMENTO
        </button>
      </div>

      {/* Tabs list filter */}
      <div className="flex border-b border-white/10 gap-1 overflow-x-auto pb-px">
        {[
          { key: 'pending', label: 'AGENDADOS' },
          { key: 'completed', label: 'CONCLUÍDOS' },
          { key: 'cancelled', label: 'CANCELADOS' },
          { key: 'all', label: 'TODOS' }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as TabFilter)}
            className={`px-5 py-4 text-xs font-bold uppercase tracking-widest whitespace-nowrap transition-all border-b-2 -mb-px ${
              activeTab === tab.key
                ? 'border-[#6ee7a8] text-[#6ee7a8]'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Group List rendering */}
      {splitSchedules.totalFiltered === 0 ? (
        <div className="p-16 rounded-[2.5rem] bg-surface/5 border border-white/5 text-center flex flex-col items-center justify-center gap-4">
          <Calendar className="text-text-secondary/30" size={40} />
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-text-primary">Nenhum agendamento encontrado</h3>
            <p className="text-sm text-text-secondary/50 max-w-sm">
              Não há agendamentos cadastrados nesta seção do filtro. Crie um agora clicando em "+ NOVO AGENDAMENTO" acima.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-12">
          {/* PRÓXIMOS SECTION */}
          {splitSchedules.upcomingGroups.length > 0 && (
            <div className="space-y-6">
              <h3 className="text-xs font-bold tracking-[0.25em] text-[#6ee7a8] uppercase border-b border-[#6ee7a8]/20 pb-2">
                PRÓXIMOS AGENDAMENTOS ⏳
              </h3>
              <div className="space-y-8">
                {splitSchedules.upcomingGroups.map(group => (
                  <div key={`upcoming-${group.date}`} className="space-y-4">
                    <h4 className="text-sm font-bold tracking-widest text-[#6ee7a8]/80 uppercase border-l-2 border-[#6ee7a8] pl-3 text-left">
                      {formatDateHeader(group.date)}
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                      {group.activities.map(activity => (
                        <AgendamentoCard
                          key={activity.id}
                          activity={activity}
                          onStartSession={onStartSession}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* JÁ PASSARAM SECTION */}
          {splitSchedules.pastGroups.length > 0 && (
            <div className="space-y-6">
              <h3 className="text-xs font-bold tracking-[0.25em] text-text-dim uppercase border-b border-white/10 pb-2">
                HISTÓRICO / PASSADOS ⚡
              </h3>
              <div className="space-y-8">
                {splitSchedules.pastGroups.map(group => (
                  <div key={`past-${group.date}`} className="space-y-4">
                    <h4 className="text-sm font-bold tracking-widest text-text-dim/80 uppercase border-l-2 border-text-dim/50 pl-3 text-left">
                      {formatDateHeader(group.date)}
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                      {group.activities.map(activity => (
                        <AgendamentoCard
                          key={activity.id}
                          activity={activity}
                          onStartSession={onStartSession}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
