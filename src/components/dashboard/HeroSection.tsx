import { motion } from 'motion/react';
import { useTimerStore } from '../../store/useTimerStore';
import { useDataStore } from '../../store/useDataStore';
import { CheckCircle, Pause } from 'lucide-react';
import { resolverNomeSessao, formatSessionDuration, formatTimeRange, getLocalDateString } from '../../lib/utils';

export const HeroSection = () => {
  const timer = useTimerStore();
  const dataStore = useDataStore();
  
  if (timer.isActive) return null;

  const firstName = dataStore.profile?.full_name?.split(' ')[0] || 'Gustavo';

  // Greeting Logic
  const hour = new Date().getHours();
  let greeting = 'Boa noite';
  if (hour >= 5 && hour < 12) greeting = 'Bom dia';
  else if (hour >= 12 && hour < 18) greeting = 'Boa tarde';

  // Date Logic
  const formattedDate = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  }).format(new Date());
  // Capitalize first letter of weekday
  const capitalizedDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1).replace('.', '');

  // Daily Metrics
  const today = getLocalDateString(new Date());
  const todaySessions = dataStore.sessions.filter(s => getLocalDateString(new Date(s.started_at)) === today);
  const totalMinutes = todaySessions.reduce((acc, s) => acc + s.duration_minutes, 0);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const streak = dataStore.profile?.current_streak || 0;

  // Reactive subheadline text
  let subheadlineText = "Se organize para passar mais tempo com as pessoas que importam ❤️";
  if (totalMinutes === 0) {
    subheadlineText = "Seu dia está começando. Que tal a primeira sessão?";
  } else if (totalMinutes > 0) {
    const formattedHour = hours > 0 ? `${hours}h ` : '';
    subheadlineText = `Você já focou [${formattedHour}${minutes}m] hoje — bom ritmo.`;
  }

  // Get upcoming/pending schedules
  const now = new Date();
  const upcomingSchedules = (dataStore.scheduledActivities || []).filter(activity => {
    if (activity.status !== 'pending') return false;
    const schedDate = new Date(`${activity.scheduled_date}T${activity.scheduled_time || '00:00'}`);
    return schedDate.getTime() > now.getTime();
  });

  const sortedUpcoming = [...upcomingSchedules].sort((a, b) => {
    const dateA = new Date(`${a.scheduled_date}T${a.scheduled_time || '00:00'}`);
    const dateB = new Date(`${b.scheduled_date}T${b.scheduled_time || '00:00'}`);
    return dateA.getTime() - dateB.getTime();
  });

  const openDeepSession = () => {
    window.dispatchEvent(new CustomEvent('open-action-center', { detail: { screen: 'session' } }));
  };

  return (
    <section className="relative pt-20 pb-4 md:pt-32 md:pb-12 px-4 sm:px-6 flex flex-col items-center text-center w-full max-w-5xl mx-auto overflow-hidden">
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-3xl space-y-8 md:space-y-12 py-4 md:py-8"
      >
        {/* Bloco 1 — Saudação */}
        <div className="space-y-2 flex flex-col items-center">
          <h2 className="text-[clamp(1.75rem,6vw,3.5rem)] font-bold tracking-tight text-text-primary leading-none whitespace-nowrap">
            {greeting}, {firstName}
          </h2>
          <span className="text-text-secondary/40 font-mono text-[9px] md:text-[10px] tracking-[0.2em] uppercase font-bold">
            {capitalizedDate}
          </span>
          <p className="text-sm md:text-base text-text-secondary font-medium max-w-xl text-center leading-relaxed">
            {subheadlineText}
          </p>
        </div>

        {/* Bloco de Agendamentos Pendentes */}
        {sortedUpcoming.length > 0 && (
          <div className="w-full max-w-sm mx-auto bg-surface/10 border border-white/5 rounded-2xl p-4 space-y-3 text-left font-sans shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#6ee7a8]/80">O que vem a seguir?</span>
              <span className="text-[8px] font-mono text-text-secondary/40 font-bold uppercase tracking-[0.1em]">PLANEJADO</span>
            </div>
            <div className="space-y-2">
              {sortedUpcoming.slice(0, 3).map(activity => {
                const d = new Date(`${activity.scheduled_date}T${activity.scheduled_time || '00:00'}`);
                const timeStr = activity.scheduled_time || '??:??';
                const formattedSchedDate = d.toLocaleDateString('pt-BR', {
                  day: 'numeric',
                  month: 'short'
                }).replace('.', '');

                return (
                  <div key={activity.id} className="flex items-center justify-between text-xs py-1.5 border-b border-white/5 last:border-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary-green animate-pulse shrink-0" />
                      <span className="text-text-primary font-medium truncate">{activity.title}</span>
                    </div>
                    <div className="text-[9px] font-mono text-text-secondary/60 bg-white/5 px-2 py-0.5 rounded-md whitespace-nowrap font-bold">
                      {formattedSchedDate} às {timeStr}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Bloco 2 — Métricas do Dia */}
        <div className="flex flex-col items-center gap-1">
          <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-text-secondary/40">Hoje</span>
          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm md:text-2xl font-light text-text-primary px-2 max-w-full">
            <span>{hours}h {minutes}min focados</span>
            <span className="text-border-white/20 select-none">·</span>
            <span>{todaySessions.length} sessões</span>
            <span className="text-border-white/20 select-none">·</span>
            <span className="flex items-center gap-1">🔥 {streak} dias</span>
          </div>
        </div>

        {/* Bloco 3 — Tarefas do Dia */}
        <div className="space-y-4 max-w-sm mx-auto w-full md:max-w-md px-1">
          <span className="text-[11px] md:text-xs font-bold uppercase tracking-[0.25em] text-[#6ee7a8] block text-center">Tarefas Realizadas no Dia</span>
          <div className="space-y-4 text-left">
            {todaySessions.length > 0 ? (
              todaySessions.slice(0, 5).map(session => {
                const resolved = resolverNomeSessao(session, dataStore.habits, dataStore.projects);
                const isPartial = session.parcial === true || 
                                 (session.actual_duration_minutes !== null && 
                                  session.actual_duration_minutes !== undefined && 
                                  session.actual_duration_minutes < session.duration_minutes);
                const durationToUse = session.actual_duration_minutes !== null ? session.actual_duration_minutes : session.duration_minutes;
                const formattedDuration = formatSessionDuration(durationToUse);
                const timeRange = formatTimeRange(session.started_at, session.completed_at, session.duration_minutes);

                const tasks = dataStore.sessionTasks.filter(t => t.session_id === session.id);
                const completedTasks = tasks.filter(t => t.completed);

                if (completedTasks.length > 0) {
                  return (
                    <div key={session.id} className="space-y-2 border-b border-white/5 pb-3">
                      {completedTasks.map((task) => (
                        <div key={task.id} className="flex gap-3 text-left items-start">
                          <CheckCircle 
                            size={14} 
                            className="shrink-0 mt-1 text-[#6ee7b7]" 
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm md:text-base text-text-primary font-medium line-through decoration-white/20">
                                {task.description}
                              </span>
                              <span className="text-text-secondary/30 hidden md:inline">—</span>
                              <span className="text-xs text-text-secondary/60 truncate font-light uppercase tracking-widest">
                                {resolved.projeto}
                              </span>
                            </div>
                            <div className="text-[11px] font-normal leading-normal mt-[2px] flex items-center gap-1.5 text-[#6a7570]">
                              <span>{timeRange}</span>
                              <span className="text-[#3a4540]">·</span>
                              <span>Sessão: {resolved.titulo}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                }

                return (
                  <div key={session.id} className="flex gap-3 text-left items-start border-b border-white/5 pb-3">
                    <CheckCircle 
                      size={14} 
                      className="shrink-0 mt-1" 
                      style={{ color: isPartial ? '#fbbf24' : '#6ee7b7' }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm md:text-base text-text-primary font-medium truncate">
                          {resolved.titulo}
                        </span>
                        <span className="text-text-secondary/30 hidden md:inline">—</span>
                        <span className="text-xs text-text-secondary/60 truncate font-light uppercase tracking-widest">
                          {resolved.projeto}
                        </span>
                        {session.scheduled_activity_id && (
                          <span 
                            className="inline-flex items-center font-bold"
                            style={{
                              backgroundColor: 'rgba(139, 92, 246, 0.12)',
                              border: '0.5px solid rgba(139, 92, 246, 0.25)',
                              color: '#8b5cf6',
                              fontSize: '9px',
                              letterSpacing: '0.12em',
                              textTransform: 'uppercase',
                              padding: '2px 6px',
                              borderRadius: '999px',
                              lineHeight: '1'
                            }}
                          >
                            AGENDADA
                          </span>
                        )}
                        {isPartial && (
                          <span 
                            className="inline-flex items-center font-bold"
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
                      </div>
                      
                      {/* Segunda linha */}
                      <div className="text-[11px] font-normal leading-normal mt-[2px] flex items-center gap-1.5 text-[#6a7570]">
                        <span>{timeRange}</span>
                        <span className="text-[#3a4540]">·</span>
                        <span>{formattedDuration}</span>
                      </div>

                      {/* Linha tracejada e ícone de pausa */}
                      {isPartial && (
                        <>
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
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-text-secondary/40 italic font-light pt-2 text-center font-sans">
                Nenhuma sessão realizada hoje — que tal começar agora?
              </p>
            )}
          </div>
        </div>

        {/* Bloco 4 — Botão de ação */}
        <motion.div 
          layout={false}
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="pt-2"
        >
          <button 
            onClick={openDeepSession}
            className="group relative px-3 sm:px-8 py-3.5 sm:py-4.5 bg-primary-green text-background rounded-2xl overflow-hidden transition-all hover:bg-glow-green active:scale-[0.98] flex items-center justify-center gap-2 sm:gap-3 mx-auto shadow-[0_20px_40px_rgba(110,231,168,0.25)] touch-manipulation min-h-[48px] w-full max-w-[320px] sm:max-w-none sm:w-auto hover:scale-[1.02] duration-200 cursor-pointer"
          >
            <div className="w-2 h-2 rounded-full bg-background animate-pulse shrink-0" />
            <span className="font-bold text-[11px] sm:text-xs uppercase tracking-[0.15em] whitespace-nowrap">
              Iniciar Sessão Profunda
            </span>
          </button>
        </motion.div>
      </motion.div>

      {/* Elemento Decorativo: Gradiente Sutil de Fundo */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[280px] h-[200px] md:w-[800px] md:h-[400px] bg-primary-green/5 blur-[80px] md:blur-[120px] rounded-full" />
      </div>
    </section>
  );
};
