import { useState, useMemo } from 'react';
import { useDataStore } from '../../store/useDataStore';
import { AgendamentoCard } from './AgendamentoCard';
import { ScheduledActivity } from '../../types';
import { Calendar, CheckCircle, Ban, Hourglass, ArrowLeft, Plus } from 'lucide-react';

interface AgendaCompletaPageProps {
  onBack: () => void;
  onStartSession: (activity: ScheduledActivity) => void;
  onOpenNewSchedule: () => void;
}

type TabFilter = 'all' | 'pending' | 'completed' | 'cancelled';

export const AgendaCompletaPage = ({ onBack, onStartSession, onOpenNewSchedule }: AgendaCompletaPageProps) => {
  const dataStore = useDataStore();
  const [activeTab, setActiveTab] = useState<TabFilter>('all');

  // Filter schedules
  const filteredSchedules = useMemo(() => {
    return dataStore.scheduledActivities.filter(sa => {
      if (activeTab === 'all') return true;
      return sa.status === activeTab;
    });
  }, [dataStore.scheduledActivities, activeTab]);

  // Group schedules by Date
  const groupedSchedules = useMemo(() => {
    const groups: { [key: string]: ScheduledActivity[] } = {};
    
    // Sort chronological: future first, completed/old second.
    // Let's sort by date and time
    const sorted = [...filteredSchedules].sort((a, b) => {
      if (a.scheduled_date !== b.scheduled_date) {
        return a.scheduled_date.localeCompare(b.scheduled_date);
      }
      return a.scheduled_time.localeCompare(b.scheduled_time);
    });

    sorted.forEach(sa => {
      const date = sa.scheduled_date;
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(sa);
    });

    return groups;
  }, [filteredSchedules]);

  // Dynamic Statistics Counters
  const stats = useMemo(() => {
    let total = dataStore.scheduledActivities.length;
    let pending = dataStore.scheduledActivities.filter(sa => sa.status === 'pending').length;
    let completed = dataStore.scheduledActivities.filter(sa => sa.status === 'completed').length;
    let cancelled = dataStore.scheduledActivities.filter(sa => sa.status === 'cancelled').length;
    
    // Total scheduled minutes calculated
    let totalMinutes = dataStore.scheduledActivities
      .filter(sa => sa.status === 'completed')
      .reduce((acc, curr) => acc + curr.duration_minutes, 0);

    return { total, pending, completed, cancelled, totalHours: Math.round(totalMinutes / 60) };
  }, [dataStore.scheduledActivities]);

  const formatDateHeader = (dateStr: string) => {
    const today = new Date().toISOString().split('T')[0];
    
    const tomorrowObj = new Date();
    tomorrowObj.setDate(tomorrowObj.getDate() + 1);
    const tomorrow = tomorrowObj.toISOString().split('T')[0];

    const yesterdayObj = new Date();
    yesterdayObj.setDate(yesterdayObj.getDate() - 1);
    const yesterday = yesterdayObj.toISOString().split('T')[0];

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
          <h1 className="text-4xl font-extrabold tracking-tight text-text-primary">
            Sua Agenda de Foco
          </h1>
          <p className="text-sm text-text-secondary/60">
            Gerencie, execute e audite seus blocos temporais e prioridades.
          </p>
        </div>

        <button
          onClick={onOpenNewSchedule}
          className="flex items-center gap-2 px-5 py-3.5 text-xs uppercase font-bold tracking-widest text-background bg-[#6ee7a8] hover:brightness-110 rounded-2xl shadow-[0_0_30px_rgba(110,231,168,0.2)] transition-all"
        >
          <Plus size={14} /> Agendar Nova Sessão
        </button>
      </div>

      {/* Metrics Section */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-surface/5 border border-white/5 p-5 rounded-3xl text-left space-y-1">
          <span className="text-[10px] font-bold text-text-secondary/40 uppercase tracking-widest block">HORAS FOCO REALIZADAS</span>
          <span className="text-3xl font-extrabold text-[#6ee7a8] font-mono block">🔥 {stats.totalHours}h</span>
        </div>
        <div className="bg-surface/5 border border-white/5 p-5 rounded-3xl text-left space-y-1">
          <span className="text-[10px] font-bold text-text-secondary/40 uppercase tracking-widest block">AGENDAMENTOS ATIVOS</span>
          <span className="text-3xl font-extrabold text-amber-400 font-mono block">⏳ {stats.pending}</span>
        </div>
        <div className="bg-surface/5 border border-white/5 p-5 rounded-3xl text-left space-y-1">
          <span className="text-[10px] font-bold text-text-secondary/40 uppercase tracking-widest block">SESSÕES COMPLETAS</span>
          <span className="text-3xl font-extrabold text-emerald-400 font-mono block">✅ {stats.completed}</span>
        </div>
        <div className="bg-surface/5 border border-white/5 p-5 rounded-3xl text-left space-y-1">
          <span className="text-[10px] font-bold text-text-secondary/40 uppercase tracking-widest block">AGENDAMENTOS CANCELADOS</span>
          <span className="text-3xl font-extrabold text-zinc-400 font-mono block">🚫 {stats.cancelled}</span>
        </div>
        <div className="bg-surface/5 border border-white/5 p-5 rounded-3xl col-span-2 md:col-span-1 text-left space-y-1">
          <span className="text-[10px] font-bold text-text-secondary/40 uppercase tracking-widest block">TOTAL REGISTRADO</span>
          <span className="text-3xl font-extrabold text-text-primary font-mono block">📊 {stats.total}</span>
        </div>
      </div>

      {/* Tabs list filter */}
      <div className="flex border-b border-white/10 gap-1 overflow-x-auto pb-px">
        {[
          { key: 'all', label: 'Todos os Agendamentos' },
          { key: 'pending', label: 'Agendados (Ativos)' },
          { key: 'completed', label: 'Concluídos' },
          { key: 'cancelled', label: 'Cancelados' }
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
      {Object.keys(groupedSchedules).length === 0 ? (
        <div className="p-16 rounded-[2.5rem] bg-surface/5 border border-white/5 text-center flex flex-col items-center justify-center gap-4">
          <Calendar className="text-text-secondary/30" size={40} />
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-text-primary">Nenhum agendamento encontrado</h3>
            <p className="text-sm text-text-secondary/50 max-w-sm">
              Não há agendamentos cadastrados nesta seção do filtro. Crie um agora clicando em "Agendar Nova Sessão" acima.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-10">
          {Object.keys(groupedSchedules).map(dateKey => (
            <div key={dateKey} className="space-y-4">
              {/* Date Group Heading */}
              <h2 className="text-md font-bold tracking-widest text-[#6ee7a8] uppercase border-l-2 border-[#6ee7a8] pl-3">
                {formatDateHeader(dateKey)}
              </h2>

              {/* Grid of activities on this day */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {groupedSchedules[dateKey].map(activity => (
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
      )}
    </div>
  );
};
