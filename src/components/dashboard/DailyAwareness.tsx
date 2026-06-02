import React from 'react';
import { Check, Activity, Pause } from 'lucide-react';
import { useDataStore } from '../../store/useDataStore';
import { formatHumanTime, resolverNomeSessao, formatSessionDuration, formatTimeRange, getLocalDateString } from '../../lib/utils';

export const DailyAwareness = () => {
  const dataStore = useDataStore();

  const today = getLocalDateString(new Date());
  const todaySessions = dataStore.sessions.filter(s => 
    getLocalDateString(new Date(s.started_at)) === today
  );

  const totalMinutesToday = todaySessions.reduce((acc, s) => {
    const min = s.actual_duration_minutes !== null ? s.actual_duration_minutes : s.duration_minutes;
    return acc + min;
  }, 0);
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
          <span 
            className="uppercase tracking-[0.3em] text-[10px] font-bold flex items-center gap-2"
            style={{ color: '#2F8F6B' }}
          >
            <Activity size={12} className="text-primary-green animate-pulse" />
            Tarefas Realizadas no Dia
          </span>
          <span className="text-[10px] text-text-secondary/40 font-mono">HOJE</span>
        </div>
        <div className="space-y-6 text-left">
          {todaySessions.length === 0 ? (
            <p className="text-text-secondary/40 font-light italic text-center md:text-left">Nenhuma sessão realizada hoje.</p>
          ) : (
            todaySessions.map(session => {
              const resolved = resolverNomeSessao(session, dataStore.habits, dataStore.projects);
              const isPartial = session.parcial === true || 
                               (session.actual_duration_minutes !== null && 
                                session.actual_duration_minutes !== undefined && 
                                session.actual_duration_minutes < session.duration_minutes);
              return (
                <HistoryItem 
                  key={session.id} 
                  title={resolved.titulo} 
                  project={resolved.projeto} 
                  duration={formatSessionDuration(isPartial ? (session.actual_duration_minutes || 0) : session.duration_minutes)} 
                  isPartial={isPartial}
                  session={session}
                />
              );
            })
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
  isPartial: boolean;
  session: any;
}

const HistoryItem: React.FC<HistoryItemProps> = ({ title, project, duration, isPartial, session }) => {
  const timeRange = formatTimeRange(session.started_at, session.completed_at, session.duration_minutes);
  return (
    <div className="flex flex-col gap-1 text-text-primary/80 group cursor-default">
      <div className="flex items-center gap-5">
        <div 
          className="w-8 h-8 rounded-xl border flex items-center justify-center transition-all"
          style={{
            color: isPartial ? '#fbbf24' : '#6ee7b7',
            borderColor: isPartial ? 'rgba(251, 191, 36, 0.2)' : 'rgba(255,255,255,0.06)'
          }}
        >
          <Check size={16} />
        </div>
        <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-3">
          <span className="text-xl font-light tracking-tight flex items-center gap-2 flex-wrap md:text-text">
            {title} 
            <span className="text-text-secondary/20 hidden md:inline">—</span> 
            <span className="text-text-secondary uppercase tracking-widest text-xs font-bold">{project}</span>
            {isPartial && (
              <span 
                className="inline-flex items-center ml-1 font-bold"
                style={{
                  backgroundColor: 'rgba(251, 191, 36, 0.12)',
                  border: '0.5px solid rgba(251, 191, 36, 0.25)',
                  color: '#fbbf24',
                  fontSize: '9px',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  padding: '2px 6px',
                  borderRadius: '999px',
                  lineHeight: '1'
                }}
              >
                INCOMPLETA
              </span>
            )}
          </span>
        </div>
      </div>
      <div className="pl-13 text-sm text-[#6a7570] md:text-text-secondary/80 font-normal flex items-center gap-1.5 mt-0.5 flex-wrap">
        <span>{timeRange}</span>
        <span className="text-[#3a4540] md:text-text-secondary/40">·</span>
        <span>{duration}</span>
      </div>
      {isPartial && (
        <div className="pl-13">
          <div 
            style={{
              width: '100%',
              borderTop: '1px dashed rgba(251, 191, 36, 0.3)',
              marginTop: '6px',
              marginBottom: '4px'
            }}
          />
          <div 
            className="font-medium flex items-center"
            style={{
              color: '#fbbf24',
              fontSize: '10px',
              opacity: 0.8
            }}
          >
            <Pause size={10} className="shrink-0 mr-1.5" style={{ color: '#fbbf24' }} />
            <span>{session.actual_duration_minutes || 0} / {session.duration_minutes} min programados</span>
          </div>
        </div>
      )}
    </div>
  );
};
