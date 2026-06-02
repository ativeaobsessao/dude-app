import { motion } from 'motion/react';
import { useState, useMemo } from 'react';
import { useTimerStore } from '../../store/useTimerStore';
import { useDataStore } from '../../store/useDataStore';
import { CheckCircle, Pause } from 'lucide-react';
import { resolverNomeSessao, formatSessionDuration, formatTimeRange, getLocalDateString } from '../../lib/utils';
import { MOODS } from '../../lib/mood';

export const HeroSection = () => {
  const timer = useTimerStore();
  const dataStore = useDataStore();
  
  const firstName = dataStore.profile?.full_name?.split(' ')[0] || 'Gustavo';

  // Greeting Logic
  const [customGoal, setCustomGoal] = useState<number | null>(() => {
    const saved = localStorage.getItem('dude_daily_focus_goal');
    return saved ? parseInt(saved, 10) : null;
  });
  const [isEditingGoal, setIsEditingGoal] = useState(false);

  const hour = new Date().getHours();
  let greeting = 'Boa noite';
  if (hour >= 5 && hour < 12) greeting = 'Bom dia';
  else if (hour >= 12 && hour < 18) greeting = 'Boa tarde';

  // Date Logic
  const dateObj = new Date();
  const weekdayShort = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' }).format(dateObj).toUpperCase().replace('.', '');
  const dayNum = dateObj.getDate();
  const monthLong = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(dateObj).toUpperCase();
  const fullCustomDate = `${weekdayShort}, ${dayNum} DE ${monthLong}`;

  // Daily Metrics
  const today = getLocalDateString(new Date());
  const todayMoods = dataStore.moodEntries ? dataStore.moodEntries.filter(m => m.date === today) : [];
  const activeMoodEntry = todayMoods.length > 0 ? todayMoods[0] : null;

  const todaySessions = dataStore.sessions.filter(s => getLocalDateString(new Date(s.started_at)) === today);
  const totalMinutes = todaySessions.reduce((acc, s) => acc + s.duration_minutes, 0);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const streak = dataStore.profile?.current_streak || 0;

  const compactFocusTime = hours === 0
    ? `${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`
    : `${hours}h${minutes > 0 ? ` ${minutes}m` : ''}`;

  const todayFocusFormatted = hours === 0
    ? `${minutes} ${minutes === 1 ? 'minuto focado' : 'minutos focados'}`
    : `${hours}h ${minutes}m focado${hours === 1 && minutes === 0 ? '' : 's'}`;

  const hasSessions = dataStore.sessions && dataStore.sessions.length > 0;

  const formatCompact = (totalMins: number) => {
    const h = Math.floor(totalMins / 60);
    const m = Math.round(totalMins % 60);
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  const todayMinutesToShow = totalMinutes;

  const averageData = useMemo(() => {
    const map: { [key: string]: number } = {};
    dataStore.sessions.forEach(s => {
      if (!s.completed) return;
      const sDate = getLocalDateString(new Date(s.started_at));
      const mins = s.actual_duration_minutes !== null && s.actual_duration_minutes !== undefined
        ? s.actual_duration_minutes
        : s.duration_minutes;
      map[sDate] = (map[sDate] || 0) + mins;
    });

    const activeDates = Object.keys(map).filter(d => map[d] > 0);
    const activeDatesCount = activeDates.length;

    const otherActiveDates = activeDates.filter(d => d !== today);
    let avg = 0;
    if (otherActiveDates.length > 0) {
      const sum = otherActiveDates.reduce((acc, d) => acc + map[d], 0);
      avg = Math.round(sum / otherActiveDates.length);
    } else if (activeDatesCount > 0) {
      const sum = activeDates.reduce((acc, d) => acc + map[d], 0);
      avg = Math.round(sum / activeDatesCount);
    }

    const otherDaysMins = otherActiveDates.map(d => map[d]);
    const record = otherDaysMins.length > 0 ? Math.max(...otherDaysMins) : 0;

    return {
      averageMinutes: avg,
      personalRecord: record,
      hasEnoughHistory: avg > 0
    };
  }, [dataStore.sessions, today]);

  const targetMinutes = customGoal !== null ? customGoal : averageData.averageMinutes;
  const hasEnoughHistory = targetMinutes > 0;

  const percent = hasEnoughHistory ? Math.round((todayMinutesToShow / targetMinutes) * 100) : 0;
  const strokePercent = Math.min(100, percent);

  const [tempGoal, setTempGoal] = useState<number>(45);

  let stateType: 'above' | 'on_pace' | 'below' | 'neutral' = 'neutral';
  if (hasEnoughHistory) {
    if (percent > 110) {
      stateType = 'above';
    } else if (percent >= 90) {
      stateType = 'on_pace';
    } else {
      stateType = 'below';
    }
  }

  // Smart Status Phrase (varies by state — NOT always "beat record")
  let smartPhrase = '';
  if (!hasEnoughHistory) {
    smartPhrase = "Comece a registrar pra DUDE aprender seu ritmo.";
  } else if (todayMinutesToShow === 0) {
    smartPhrase = `Sua média é ${formatCompact(targetMinutes)}. Bora abrir o dia?`;
  } else if (stateType === 'above') {
    if (averageData.personalRecord > 0 && todayMinutesToShow >= averageData.personalRecord) {
      smartPhrase = `Recorde histórico superado com ${formatCompact(todayMinutesToShow)}! Você está voando alto hoje! 🏆`;
    } else if (averageData.personalRecord > 0 && (averageData.personalRecord - todayMinutesToShow) <= 15) {
      smartPhrase = `Incrível, você está quase quebrando seu recorde de ${formatCompact(averageData.personalRecord)}! 🔥`;
    } else if (averageData.personalRecord > 0) {
      smartPhrase = `Acima da média! Falta pouco pro seu recorde de ${formatCompact(averageData.personalRecord)}. 🔥`;
    } else {
      smartPhrase = `Acima da média! Excelente ritmo hoje. 🔥`;
    }
  } else if (stateType === 'on_pace') {
    smartPhrase = "No seu ritmo de sempre. Que tal superar hoje?";
  } else {
    // stateType === 'below'
    smartPhrase = "Dá tempo de virar o dia. Uma sessão já te recoloca.";
  }

  // Now, determine reactive text line (WAVE 1B living reactive line engine)
  const currentHour = new Date().getHours();
  const dayOfWeek = dateObj.getDay(); // 0 is Sunday, 1 is Monday, etc.

  // Formatted focus time for interpolation
  const formattedFocusTime = hours > 0 
    ? `${hours}h ${minutes}m` 
    : `${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`;

  // Deterministic selector using today's day number to rotate options securely and avoid re-render flickering
  const selectChoice = (options: string[]) => {
    return options[dayNum % options.length];
  };

  let reactiveLine = '';

  // PRIORITY 1 — PERFORMANCE (overrides time-based when notable)
  const isAfternoonOrLater = currentHour >= 12;

  if (totalMinutes === 0 && isAfternoonOrLater) {
    reactiveLine = selectChoice([
      "Você ainda não focou hoje. Que tal uma Sessão Profunda?",
      "Que tal começar a focar agora? O primeiro passo é o mais importante.",
      "Sua mente está pronta. Vamos iniciar uma Sessão Profunda hoje?",
      "O dia está passando. Que tal reservar um tempo para focar?"
    ]);
  } else if (averageData.hasEnoughHistory && totalMinutes > averageData.personalRecord && totalMinutes > 0) {
    reactiveLine = selectChoice([
      "Seu melhor dia de foco até agora. 🔥",
      "Incrível! Hoje é o seu dia mais focado de todos os tempos. 🏆",
      "Você quebrou seu recorde de foco diário hoje! Fantástico!",
      "Superando todos os seus limites. Hoje foi histórico! 🔥"
    ]);
  } else if (averageData.hasEnoughHistory && totalMinutes > 0 && totalMinutes < 0.8 * averageData.averageMinutes) {
    reactiveLine = selectChoice([
      "Hoje rendeu menos que sua média. Bora recuperar?",
      "Abaixo do seu ritmo normal. Que tal uma sessão rápida para retomar?",
      "O dia ainda não acabou. Um bloco de foco pode fazer a diferença hoje!",
      "Que tal ajustar o foco? Uma sessão curta ajuda a voltar ao ritmo."
    ]);
  } else if (averageData.hasEnoughHistory && totalMinutes > 0 && totalMinutes >= averageData.averageMinutes) {
    reactiveLine = selectChoice([
      `Bom ritmo hoje — ${formattedFocusTime} de foco. Continue assim.`,
      `Ótimo trabalho! Já são ${formattedFocusTime} de foco acumulados hoje.`,
      `Foco afiado hoje: ${formattedFocusTime} mantendo o controle do seu dia.`,
      `Consistência excelente! ${formattedFocusTime} dedicados ao que importa hoje.`
    ]);
  }

  // PRIORITY 2 — DAY OF WEEK (when performance is neutral or no high performance matches)
  if (!reactiveLine) {
    if (dayOfWeek === 1 && currentHour >= 5 && currentHour < 12) {
      reactiveLine = selectChoice([
        "Semana nova. Comece com uma sessão e dê o tom.",
        "Segunda-feira pede foco total para começar a semana com tudo.",
        "Nova semana, novas metas. Estabeleça seu ritmo logo cedo."
      ]);
    } else if (dayOfWeek === 5) {
      reactiveLine = selectChoice([
        "Sexta. Termine a semana no controle.",
        "Quase lá! Um último gás na sexta-feira para um fim de semana tranquilo.",
        "Sextou com produtividade. Feche as pendências e descanse em paz!"
      ]);
    } else if (dayOfWeek === 0) {
      reactiveLine = selectChoice([
        "Domingo é bom pra planejar a semana que vem.",
        "Um domingo organizado traz uma semana produtiva. Prepare-se.",
        "Planejar hoje poupa energia amanhã. Use o dia para estruturar seus alvos."
      ]);
    }
  }

  // PRIORITY 3 — TIME OF DAY (default fallback)
  if (!reactiveLine) {
    if (currentHour >= 5 && currentHour < 12) {
      reactiveLine = selectChoice([
        "Manhã é seu tempo mais nobre. Aproveite.",
        "O dia está decolando. Defina sua prioridade número um agora.",
        "Mente fresca e silenciosa nas primeiras horas. Melhor momento para focar."
      ]);
    } else if (currentHour >= 12 && currentHour < 18) {
      reactiveLine = selectChoice([
        "Tarde rende. Que tal um bloco de foco?",
        "Metade do dia já foi. Mantenha a energia e a consistência.",
        "Hora de avançar nos projetos. Que tal uma sessão produtiva?"
      ]);
    } else if (currentHour >= 18 && currentHour < 23) {
      reactiveLine = selectChoice([
        "Boa hora pra fechar uma última sessão do dia.",
        "Feche o dia com chave de ouro: mais um bloco de foco profundo.",
        "O dia está terminando. Que tal resolver aquela última pendência?"
      ]);
    } else {
      reactiveLine = selectChoice([
        "Tá tarde. Uma sessão curta e depois descanse.",
        "Quase hora de dormir. Se for focar, faça um bloco curto.",
        "Silêncio da noite ajuda a focar, mas priorize seu sono."
      ]);
    }
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

  // Compute recent project
  const sortedSessions = [...(dataStore.sessions || [])].sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
  let recentProjectName = '';
  for (const session of sortedSessions) {
    if (session.project_id) {
      const proj = dataStore.projects.find(p => p.id === session.project_id);
      if (proj && proj.name) {
        recentProjectName = proj.name;
        break;
      }
    }
  }

  // Determine habitual focus window:
  let matchingCount = 0;
  (dataStore.sessions || []).forEach(s => {
    const startHour = new Date(s.started_at).getHours();
    const diff = Math.min((startHour - currentHour + 24) % 24, (currentHour - startHour + 24) % 24);
    if (diff <= 2) {
      matchingCount++;
    }
  });
  const isInHabitualWindow = matchingCount >= 2;

  // Cascade Cases for SP Button
  let buttonLabel = 'Iniciar Sessão Profunda';
  let buttonSubline = '';

  if (recentProjectName && isInHabitualWindow) {
    buttonLabel = `Continuar ${recentProjectName}`;
    buttonSubline = 'Seu horário de foco';
  } else if (recentProjectName && !isInHabitualWindow) {
    buttonLabel = `Continuar ${recentProjectName}`;
  } else if (!recentProjectName && isInHabitualWindow) {
    buttonLabel = 'Iniciar Sessão Profunda';
    buttonSubline = 'Bom horário pra focar';
  }

  const openDeepSession = () => {
    window.dispatchEvent(new CustomEvent('open-action-center', { detail: { screen: 'session' } }));
  };

  if (timer.isActive) return null;

  return (
    <section className="relative pt-20 pb-4 md:pt-32 md:pb-12 px-4 sm:px-6 flex flex-col items-center text-center w-full max-w-5xl mx-auto overflow-hidden">
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-3xl space-y-6 md:space-y-8 py-2 md:py-4"
      >
        {/* Block B — MARKETING (Only rendered here if user has ZERO SP recorded) */}
        {dataStore.initialFetchDone && !hasSessions && (
          <div id="marketing-block" className="w-full max-w-4xl mx-auto text-center py-6 select-none border-b border-white/5 pb-8 mb-6">
            <h3 className="font-semibold tracking-[-0.04em] leading-tight text-text-primary mb-2 text-center text-2xl md:text-3xl">
              Tenha Controle Total Sobre Seu Tempo
            </h3>
            <p className="text-[10px] md:text-xs text-text-secondary font-light text-center uppercase tracking-[0.2em] leading-relaxed">
              Com a DUDE você controla o seu presente, registra o seu passado — otimizando ao máximo o seu tempo.
            </p>
          </div>
        )}

        {/* Bloco 1 — Saudação */}
        <div className="space-y-2 flex flex-col items-center w-full max-w-full overflow-hidden relative">
          <h2 className="text-[clamp(1.75rem,5.8vw,3.2rem)] font-bold tracking-tight text-text leading-none whitespace-nowrap px-2 relative z-10">
            {greeting}, {firstName}
          </h2>
          <span className="text-xs sm:text-sm md:text-base text-text-dim/60 md:text-text-dim font-mono tracking-[0.15em] uppercase font-bold md:font-semibold">
            {fullCustomDate}
          </span>
          <p className="text-[clamp(8.5px,2.4vw,1rem)] text-green italic font-semibold text-center leading-relaxed whitespace-nowrap select-none overflow-hidden max-w-full px-2">
            Se organize para passar mais tempo com as pessoas que importam ❤️
          </p>

          {/* Seu tom de hoje: [label] chip */}
          {activeMoodEntry && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              className="inline-flex items-center gap-2 px-3 py-1 bg-surface-2/65 border border-border-custom rounded-full text-[10px] uppercase font-bold tracking-wider text-text-dim mt-2 hover:bg-surface-2 transition-colors cursor-default select-none relative z-10"
            >
              <span className="w-1.5 h-1.5 rounded-full animate-pulse z-10" style={{ backgroundColor: 'var(--mood)' }} />
              <span>Seu tom de hoje: <span className="text-text font-semibold capitalize">{activeMoodEntry.mood} {MOODS[activeMoodEntry.mood]?.emoji}</span></span>
            </motion.div>
          )}
        </div>

        {/* THE AVERAGE RING COLUMNS (WAVE 2C / PART B) */}
        <div className="flex flex-col items-center justify-center gap-5 w-full py-2">
          {/* THE AVERAGE RING */}
          <div className="relative w-36 h-36 flex items-center justify-center rounded-full bg-white/[0.01]">
            <svg className="w-full h-full transform -rotate-90 select-none pointer-events-none" viewBox="0 0 36 36">
              {/* Track ring */}
              <path
                className="text-white/[0.05]"
                strokeWidth="2.8"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              {/* Active progress ring */}
              {hasEnoughHistory && (
                <motion.path
                  strokeWidth="3.2"
                  strokeLinecap="round"
                  stroke={
                    stateType === 'above'
                      ? 'var(--green)'
                      : stateType === 'on_pace'
                      ? 'var(--amber)'
                      : 'var(--coral)'
                  }
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  initial={{ strokeDasharray: "0, 100" }}
                  animate={{ strokeDasharray: `${strokePercent}, 100` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                />
              )}
            </svg>
            
            {/* Centered label element with absolute centering to prevent layout shift */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none p-2 select-none">
              {hasEnoughHistory ? (
                <>
                  <span className="text-3xl font-black font-mono text-text tracking-tighter leading-none">
                    {percent}%
                  </span>
                  <span className="text-[10px] text-text-dim/60 font-mono tracking-tight leading-normal mt-1.5 whitespace-nowrap">
                    {formatCompact(todayMinutesToShow)} / {formatCompact(targetMinutes)}
                  </span>
                  <div className={`text-[10px] font-bold uppercase tracking-wider mt-1.5 flex items-center gap-1 leading-none ${
                    stateType === 'above' ? 'text-green' : stateType === 'on_pace' ? 'text-amber' : 'text-coral'
                  }`}>
                    {stateType === 'above' && '↑ acima'}
                    {stateType === 'on_pace' && '= no ritmo'}
                    {stateType === 'below' && '↓ abaixo'}
                  </div>
                </>
              ) : (
                <>
                  <span className="text-4xl font-extrabold font-mono text-text-dim/30 leading-none">
                    —
                  </span>
                </>
              )}
            </div>
          </div>

          {/* SMART STATUS PHRASE */}
          <p className="text-xs sm:text-sm font-medium italic text-text-dim/80 max-w-sm text-center leading-relaxed select-none px-4">
            "{smartPhrase}"
          </p>
        </div>

        {/* Bloco 4 — Botão de ação (The primary action centered with generous breathing room) */}
        <motion.div 
          layout={false}
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="pb-2 flex flex-col items-center gap-2 w-full animate-fade-in"
        >
          <button 
            onClick={openDeepSession}
            className="group relative px-5 sm:px-10 py-4 sm:py-5 bg-green text-base rounded-2xl overflow-hidden transition-all hover:brightness-105 active:scale-[0.98] flex flex-col items-center justify-center gap-1.5 mx-auto shadow-[0_4px_12px_rgba(110,231,168,0.15)] sm:shadow-[0_20px_40px_rgba(110,231,168,0.25)] touch-manipulation min-h-[56px] w-full max-w-[340px] sm:max-w-md hover:scale-[1.02] duration-200 cursor-pointer text-center"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 rounded-full bg-base animate-pulse shrink-0" />
              <span className="font-bold text-xs sm:text-sm uppercase tracking-[0.18em] whitespace-nowrap">
                {buttonLabel}
              </span>
            </div>
            {buttonSubline && (
              <span className="text-[10px] font-mono text-base/80 uppercase tracking-[0.12em] font-semibold">
                {buttonSubline}
              </span>
            )}
          </button>
        </motion.div>

        {/* "SEUS NÚMEROS DE HOJE" BLOCK (PART B3 & B4) */}
        <div className="w-full space-y-4 pt-1">
          <h3 className="text-xs sm:text-sm font-bold tracking-[0.22em] text-text uppercase text-center font-sans">
            SEUS NÚMEROS DE HOJE
          </h3>
          
          <div className="grid grid-cols-3 gap-3 w-full">
            {/* Card 1 — Horas Focadas */}
            <div className="flex flex-col items-center justify-between p-4 rounded-2xl bg-surface-1 border border-border-custom hover:border-white/10 transition-all w-full select-none cursor-default">
              <div className="flex items-center justify-center w-full min-h-[40px]">
                <span className="text-xl sm:text-2xl md:text-3.5xl font-mono font-bold text-text whitespace-nowrap leading-none">
                  {formatCompact(todayMinutesToShow)}
                </span>
              </div>
              <span className="text-[10px] sm:text-xs text-text-dim text-center font-sans tracking-wide leading-tight mt-2 whitespace-nowrap">
                Horas Focadas
              </span>
            </div>

            {/* Card 2 — Sessões Profundas */}
            <div className="flex flex-col items-center justify-between p-4 rounded-2xl bg-surface-1 border border-border-custom hover:border-white/10 transition-all w-full select-none cursor-default">
              <div className="flex items-center justify-center w-full min-h-[40px]">
                <span className="text-xl sm:text-2xl md:text-3.5xl font-mono font-bold text-text whitespace-nowrap leading-none">
                  {todaySessions.length}
                </span>
              </div>
              <span className="text-[10px] sm:text-xs text-text-dim text-center font-sans tracking-wide leading-tight mt-2 whitespace-nowrap">
                {todaySessions.length === 1 ? 'Sessão Profunda' : 'Sessões Profundas'}
              </span>
            </div>

            {/* Card 3 — Dias Invictos */}
            <div className="flex flex-col items-center justify-between p-4 rounded-2xl bg-surface-1 border border-border-custom hover:border-white/10 transition-all w-full select-none cursor-default">
              <div className="flex items-center justify-center w-full min-h-[40px]">
                <div className="flex items-center justify-center gap-1.5 w-full font-mono">
                  <span className="text-lg sm:text-xl md:text-2xl select-none leading-none shrink-0 text-center">🔥</span>
                  <span className="text-xl sm:text-2xl md:text-3.5xl font-mono font-bold text-green whitespace-nowrap leading-none">
                    {streak}
                  </span>
                </div>
              </div>
              <span className="text-[10px] sm:text-xs text-text-dim text-center font-sans tracking-wide leading-tight mt-2 whitespace-nowrap">
                {streak === 1 ? 'Dia Invicto' : 'Dias Invictos'}
              </span>
            </div>
          </div>

          {/* Tiny ajust-meta link */}
          <div className="flex items-center justify-center pt-1 pb-2">
            {!isEditingGoal ? (
              <button
                onClick={() => {
                  setTempGoal(targetMinutes || 45);
                  setIsEditingGoal(true);
                }}
                className="text-[10px] font-medium text-text-dim/40 hover:text-green transition-colors cursor-pointer"
              >
                ajustar minha meta
              </button>
            ) : (
              <div className="flex items-center gap-1.5 bg-surface-2 border border-border-custom px-3 py-1.5 rounded-xl text-xs shadow-xl font-sans">
                <span className="text-[9px] font-mono text-text-dim uppercase">meta:</span>
                <input
                  type="number"
                  value={tempGoal}
                  onChange={(e) => setTempGoal(Math.max(15, parseInt(e.target.value, 10) || 15))}
                  className="w-12 bg-transparent text-center font-mono text-xs font-bold text-text focus:outline-none"
                />
                <span className="text-[9px] text-text-dim font-mono">min</span>
                <button
                  onClick={() => {
                    const cleanVal = Math.max(15, Math.min(720, tempGoal));
                    setCustomGoal(cleanVal);
                    localStorage.setItem('dude_daily_focus_goal', cleanVal.toString());
                    setIsEditingGoal(false);
                  }}
                  className="px-2 py-0.5 bg-green hover:brightness-105 rounded text-[9px] font-bold text-surface-2 uppercase cursor-pointer"
                >
                  OK
                </button>
                {customGoal !== null && (
                  <button
                    onClick={() => {
                      setCustomGoal(null);
                      localStorage.removeItem('dude_daily_focus_goal');
                      setIsEditingGoal(false);
                    }}
                    className="text-[9px] text-coral hover:underline"
                  >
                    reset
                  </button>
                )}
                <button
                  onClick={() => setIsEditingGoal(false)}
                  className="text-[10px] text-text-dim hover:text-text cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Bloco de Agendamentos Pendentes */}
        {sortedUpcoming.length > 0 && (
          <div className="w-full max-w-sm mx-auto bg-surface-1 border border-border-custom rounded-2xl p-4 space-y-3 text-left font-sans shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-text-dim/50">O que vem a seguir?</span>
              <span className="text-[8px] font-mono text-text-dimmer font-bold uppercase tracking-[0.1em]">PLANEJADO</span>
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
                  <div key={activity.id} className="flex items-center justify-between text-xs py-1.5 border-b border-border-custom last:border-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-1.5 h-1.5 rounded-full bg-white/20 shrink-0" />
                      <span className="text-text font-medium truncate">{activity.title}</span>
                    </div>
                    <div className="text-[9px] font-mono text-text-dim/60 bg-surface-2 border border-border-custom/50 px-2 py-0.5 rounded-md whitespace-nowrap font-bold">
                      {formattedSchedDate} às {timeStr}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Bloco 3 — Tarefas do Dia */}
        <div className="space-y-4 max-w-sm mx-auto w-full md:max-w-md px-1">
          <span 
            className="text-xs md:text-sm font-bold uppercase tracking-[0.25em] block text-center"
            style={{ color: '#2F8F6B' }}
          >
            Tarefas Realizadas no Dia
          </span>
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

                return (
                  <div key={session.id} className="flex gap-3 text-left items-start border-b border-border-custom pb-3">
                    <CheckCircle 
                      size={14} 
                      className="shrink-0 mt-1" 
                      style={{ color: isPartial ? 'var(--amber)' : 'var(--green)' }}
                    />
                    <div className="flex-1 min-w-0 font-sans">
                      {/* Linha 1: [ATIVIDADE] — [Projeto] */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm md:text-base text-text font-semibold truncate">
                          {resolved.titulo}
                        </span>
                        <span className="text-text-dimmer/50 md:text-text-dim/40">—</span>
                        <span className="text-xs text-text-dim/60 md:text-text-dim truncate font-light uppercase tracking-widest font-mono">
                          {resolved.projeto}
                        </span>
                        {session.scheduled_activity_id && (
                          <span 
                            className="inline-flex items-center font-bold font-mono"
                            style={{
                              backgroundColor: 'rgba(167, 139, 250, 0.12)',
                              border: '0.5px solid rgba(167, 139, 250, 0.25)',
                              color: 'var(--violet)',
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
                            className="inline-flex items-center font-bold font-mono"
                            style={{
                              backgroundColor: 'rgba(251, 191, 36, 0.12)',
                              border: '0.5px solid rgba(251, 191, 36, 0.25)',
                              color: 'var(--amber)',
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
                      
                      {/* Linha 2: [HH:MM] → [HH:MM] · [duração] */}
                      <div className="text-[11px] font-normal leading-normal mt-[2px] flex items-center gap-1.5 text-text-dimmer md:text-text-dim font-mono">
                        <span>{timeRange}</span>
                        <span className="text-text-dimmer/50 md:text-text-dim/40">·</span>
                        <span>{formattedDuration}</span>
                      </div>

                      {/* Checklist: rendered BELOW the time range with checklist style checkboxes checkmarked */}
                      {completedTasks.length > 0 && (
                        <div className="mt-2 space-y-1 pl-1">
                          {completedTasks.map(task => (
                            <div key={task.id} className="flex items-center gap-2 text-xs text-text/80">
                              <span className="text-green select-none text-[13px]">☑</span>
                              <span className="line-through decoration-white/10 text-text-dim/80">{task.description}</span>
                            </div>
                          ))}
                        </div>
                      )}

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
                              color: 'var(--amber)',
                              fontSize: '10px',
                              opacity: 0.8
                            }}
                          >
                            <Pause size={10} className="shrink-0 mr-1.5" style={{ color: 'var(--amber)' }} />
                            <span>{session.actual_duration_minutes || 0} / {session.duration_minutes} min programados</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-text-dimmer italic font-light pt-2 text-center font-sans">
                Nenhuma sessão realizada hoje — que tal começar agora?
              </p>
            )}
          </div>
        </div>
      </motion.div>

      {/* Elemento Decorativo: Gradiente Sutil de Fundo */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[280px] h-[200px] md:w-[800px] md:h-[400px] bg-green/5 blur-[80px] md:blur-[120px] rounded-full" />
      </div>
    </section>
  );
};
