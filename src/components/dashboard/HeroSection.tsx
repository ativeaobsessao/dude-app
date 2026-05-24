import { motion, AnimatePresence } from 'motion/react';
import { useTimerStore } from '../../store/useTimerStore';
import { useDataStore } from '../../store/useDataStore';
import { CheckCircle, Pause } from 'lucide-react';
import { resolverNomeSessao, formatSessionDuration, formatTimeRange } from '../../lib/utils';

export const HeroSection = () => {
  const timer = useTimerStore();
  const dataStore = useDataStore();
  
  if (timer.isActive) return null;

  const firstName = dataStore.profile?.full_name?.split(' ')[0] || 'Usuário';

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
  const today = new Date().toISOString().split('T')[0];
  const todaySessions = dataStore.sessions.filter(s => s.started_at.startsWith(today));
  const totalMinutes = todaySessions.reduce((acc, s) => acc + s.duration_minutes, 0);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const streak = dataStore.profile?.current_streak || 0;

  const openDeepSession = () => {
    window.dispatchEvent(new CustomEvent('open-action-center', { detail: { screen: 'session' } }));
  };

  return (
    <section className="relative pt-24 pb-4 md:pt-32 md:pb-12 px-6 flex flex-col items-center text-center max-w-5xl mx-auto">
      <AnimatePresence mode="wait">
        {!dataStore.hasCompletedFirstSession ? (
          <motion.div
            layout={false}
            key="new-user-hero"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.6 }}
            className="flex flex-col items-center"
          >
            {/* 1. MAIN HEADLINE - Impacto Máximo */}
            <motion.div
              layout={false}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              <h1 className="font-semibold tracking-[-0.04em] leading-tight text-text-primary mb-6 w-full text-center">
                <span className="block text-[32px] md:text-[clamp(52px,6vw,84px)]">Tenha Controle Total</span>
                <span className="block text-[32px] md:text-[clamp(52px,6vw,84px)] text-white/20">Sobre Seu Tempo</span>
              </h1>
            </motion.div>

            {/* 2. SUPERLINE - Clareza Operacional */}
            <motion.p
              layout={false}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
              className="text-sm md:text-lg text-text-secondary font-light max-w-2xl leading-snug mb-4"
            >
              Com a DUDE você controla o seu presente, registra o seu passado — otimizando ao máximo o seu tempo.
            </motion.p>

            {/* 3. EMOTIONAL SUBTEXT - O "Porquê" */}
            <motion.p
              layout={false}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1, delay: 0.4 }}
              className="text-sm md:text-base text-primary-green italic font-medium opacity-60"
            >
              Se organize para passar mais tempo com as pessoas que importam ❤️
            </motion.p>
          </motion.div>
        ) : (
          <motion.div
            layout={false}
            key="active-user-hero"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-3xl space-y-12 py-8"
          >
            {/* Bloco 1 — Saudação */}
            <div className="space-y-1">
              <div className="flex flex-col md:flex-row md:items-baseline md:justify-center gap-2 md:gap-4">
                <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-text-primary">
                  {greeting}, {firstName}
                </h2>
                <span className="text-text-secondary/40 font-light text-lg md:text-xl">
                  {capitalizedDate}
                </span>
              </div>
              <p className="text-xs md:text-sm text-primary-green italic font-medium opacity-60">
                Se organize para passar mais tempo com as pessoas que importam ❤️
              </p>
            </div>

            {/* Bloco 2 — Métricas do Dia */}
            <div className="flex flex-col items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-text-secondary/40">Hoje</span>
              <div className="flex items-center gap-3 text-lg md:text-2xl font-light text-text-primary">
                <span>{hours}h {minutes}min focados</span>
                <span className="text-border-white/20 select-none">·</span>
                <span>{todaySessions.length} sessões</span>
                <span className="text-border-white/20 select-none">·</span>
                <span className="flex items-center gap-2">🔥 {streak} dias</span>
              </div>
            </div>

            {/* Bloco 3 — Tarefas do Dia */}
            <div className="space-y-4 max-w-sm mx-auto w-full md:max-w-md">
              <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-text-secondary/40 block text-center">Tarefas realizadas no dia</span>
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

                    return (
                      <div key={session.id} className="flex gap-3 text-left items-start">
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
                  <p className="text-sm text-text-secondary/40 italic font-light pt-2 text-center">
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
              className="pt-4"
            >
              <button 
                onClick={openDeepSession}
                className="group relative px-10 py-5 bg-primary-green text-background rounded-2xl overflow-hidden transition-all hover:bg-glow-green active:scale-95 flex items-center gap-3 mx-auto shadow-[0_20px_40px_rgba(110,231,168,0.2)] touch-manipulation min-h-[44px]"
              >
                <div className="w-2 h-2 rounded-full bg-background animate-pulse" />
                <span className="font-bold text-xs uppercase tracking-[0.2em]">
                  Iniciar Nova Sessão Profunda
                </span>
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>



      {/* Elemento Decorativo: Gradiente Sutil de Fundo */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary-green/5 blur-[120px] rounded-full" />
      </div>
    </section>
  );
};
