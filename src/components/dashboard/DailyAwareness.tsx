import React from 'react';
import { Check, Activity } from 'lucide-react';
import { useDataStore } from '../../store/useDataStore';
import { formatHumanTime } from '../../lib/utils';

export const DailyAwareness = () => {
  const dataStore = useDataStore();

  const today = new Date().toDateString();
  const todaySessions = dataStore.sessions.filter(s => 
    new Date(s.started_at).toDateString() === today
  );

  const totalMinutesToday = todaySessions.reduce((acc, s) => acc + s.duration_minutes, 0);
  const deepSessionsCountToday = todaySessions.length;
  const currentStreak = dataStore.profile?.current_streak || 0;

  return (
    <section className="w-full max-w-5xl space-y-6 md:space-y-12">
      <div className="space-y-2 md:space-y-4">
        <h3 className="text-2xl md:text-3xl font-semibold tracking-tight text-text-primary">Seu Dia Até Agora</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 border-t border-border-white pt-6 md:pt-8">
        <MetricItem label="Tempo focado hoje" value={formatHumanTime(totalMinutesToday)} />
        <MetricItem label="Sessões profundas" value={`${deepSessionsCountToday} sessões profundas`} />
        <MetricItem label="Dias Invictos" value={`${currentStreak} dias`} />
      </div>

      <div className="space-y-4 md:space-y-8 pt-6 md:pt-8 border-t border-border-white">
        <div className="flex items-center justify-between">
          <span className="text-text-secondary uppercase tracking-[0.3em] text-[10px] font-bold flex items-center gap-2">
            <Activity size={12} className="text-primary-green" />
            Tarefas Realizadas no Dia
          </span>
          <span className="text-[10px] text-text-secondary/40 font-mono">HOJE</span>
        </div>
        <div className="space-y-6">
          {todaySessions.length === 0 ? (
            <p className="text-text-secondary/40 font-light italic">Nenhuma sessão realizada hoje.</p>
          ) : (
            todaySessions.map(session => (
              <HistoryItem 
                key={session.id} 
                title={session.activity_name} 
                project={dataStore.projects.find(p => p.id === session.project_id)?.name || 'Geral'} 
                duration={formatHumanTime(session.duration_minutes)} 
              />
            ))
          )}
        </div>
      </div>
    </section>
  );
};

const MetricItem = ({ label, value }: { label: string; value: string }) => (
  <div className="space-y-3">
    <p className="text-text-secondary text-[10px] uppercase tracking-[0.3em] font-bold opacity-40">{label}</p>
    <p className="text-3xl font-light text-text-primary tracking-tight">{value}</p>
  </div>
);

interface HistoryItemProps {
  title: string;
  project: string;
  duration: string;
}

const HistoryItem: React.FC<HistoryItemProps> = ({ title, project, duration }) => (
  <div className="flex flex-col gap-1 text-text-primary/80 group cursor-default">
    <div className="flex items-center gap-5">
      <div className="w-8 h-8 rounded-xl border border-border-white flex items-center justify-center text-primary-green group-hover:bg-primary-green/10 group-hover:border-primary-green/20 transition-all">
        <Check size={16} />
      </div>
      <span className="text-xl font-light tracking-tight">
        {title} 
        <span className="text-text-secondary/20 mx-3">—</span> 
        <span className="text-text-secondary uppercase tracking-widest text-xs font-bold">{project}</span>
      </span>
    </div>
    <div className="pl-13 text-sm text-text-secondary/60 font-medium">
      {duration}
    </div>
  </div>
);
