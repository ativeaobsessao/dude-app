import React, { useMemo, useState } from 'react';
import { Activity, AlertCircle, ArrowUpRight, CalendarCheck2, CheckCircle2, ChevronDown, ChevronUp, Clock3, FolderKanban, Layers3, Sparkles, Target } from 'lucide-react';
import { useDataStore } from '../../store/useDataStore';
import { analyzePersonalInsights, buildActivityCalendar, formatDateLabel, formatMinutesTotal, getRecordedSessionMinutes, type InsightPeriod } from '../../lib/behaviorInsights';
import { getLocalDateString } from '../../lib/utils';

const periodOptions: Array<{ value: InsightPeriod; label: string }> = [
  { value: 7, label: '7 dias' },
  { value: 30, label: '30 dias' },
  { value: 90, label: '90 dias' }
];

const percentWidth = (value: number) => `${Math.max(0, Math.min(100, value))}%`;

const MetricCard = ({ label, value, detail, icon: Icon }: {
  label: string;
  value: string;
  detail: string;
  icon: React.ElementType;
}) => (
  <div className="min-w-0 rounded-2xl border border-white/[0.07] bg-white/[0.035] p-4 sm:p-5">
    <div className="flex items-center justify-between gap-3">
      <span className="text-[11px] font-medium text-zinc-400">{label}</span>
      <Icon size={16} className="shrink-0 text-zinc-500" />
    </div>
    <p className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">{value}</p>
    <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">{detail}</p>
  </div>
);

const SectionCard = ({ title, subtitle, children, action }: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) => (
  <section className="rounded-3xl border border-white/[0.07] bg-[#141820] p-5 sm:p-6">
    <div className="mb-5 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-white sm:text-base">{title}</h3>
        {subtitle && <p className="mt-1 text-xs leading-relaxed text-zinc-500">{subtitle}</p>}
      </div>
      {action}
    </div>
    {children}
  </section>
);

export const PersonalInsightsPanel: React.FC = () => {
  const sessions = useDataStore(state => state.sessions);
  const projects = useDataStore(state => state.projects);
  const activities = useDataStore(state => state.activities);
  const habits = useDataStore(state => state.habits);
  const habitCompletions = useDataStore(state => state.habitCompletions);
  const dailyTasks = useDataStore(state => state.dailyTasks);
  const scheduledActivities = useDataStore(state => state.scheduledActivities);
  const sessionTasks = useDataStore(state => state.sessionTasks);
  const [period, setPeriod] = useState<InsightPeriod>(30);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showFullAnalysis, setShowFullAnalysis] = useState(false);

  const summary = useMemo(() => analyzePersonalInsights({
    sessions,
    projects,
    activities,
    habits,
    habitCompletions,
    dailyTasks,
    scheduledActivities,
    days: period
  }), [sessions, projects, activities, habits, habitCompletions, dailyTasks, scheduledActivities, period]);

  const activityCalendar = useMemo(() => buildActivityCalendar(sessions, 30), [sessions]);
  const calendarCells = useMemo(() => {
    if (activityCalendar.length === 0) return [];
    const firstWeekday = new Date(`${activityCalendar[0].dateKey}T12:00:00`).getDay();
    return [...Array.from({ length: firstWeekday }, () => null), ...activityCalendar];
  }, [activityCalendar]);
  const defaultSelectedDate = [...activityCalendar].reverse().find(day => day.sessionCount > 0)?.dateKey
    || activityCalendar[activityCalendar.length - 1]?.dateKey
    || getLocalDateString(new Date());
  const selectedDateKey = selectedDate && activityCalendar.some(day => day.dateKey === selectedDate)
    ? selectedDate
    : defaultSelectedDate;
  const selectedDay = activityCalendar.find(day => day.dateKey === selectedDateKey);
  const selectedDaySessions = useMemo(() => sessions
    .filter(session => session.completed && getLocalDateString(new Date(session.started_at)) === selectedDateKey && getRecordedSessionMinutes(session) > 0)
    .sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime()), [sessions, selectedDateKey]);
  const projectById = useMemo(() => new Map(projects.map(project => [project.id, project])), [projects]);
  const activityById = useMemo(() => new Map(activities.map(activity => [activity.id, activity])), [activities]);
  const scheduledActivityById = useMemo(() => new Map(scheduledActivities.map(activity => [activity.id, activity])), [scheduledActivities]);

  const hasActivityData = summary.completedSessions > 0;
  const hasHabitData = summary.habitsTracked > 0;
  const underperformedHabit = summary.mostUnderperformedHabit;
  const habitsNeedingAttention = summary.habitAdherence.filter(habit => habit.expected > 0 && habit.completed < habit.expected && habit.rate < 70);

  const nextAdjustment = useMemo(() => {
    if (underperformedHabit) {
      return {
        title: `Revise o hábito “${underperformedHabit.name}”`,
        description: `Foram registrados ${underperformedHabit.completed} de aproximadamente ${Math.ceil(underperformedHabit.expected)} ocorrências previstas neste período. Talvez a frequência ou o horário precisem de um ajuste.`,
        label: 'Hábito com menor regularidade'
      };
    }
    if (summary.taskCompletionRate !== null && summary.taskCompletionRate < 60 && summary.tasksTotal >= 5) {
      return {
        title: 'Reduza a quantidade planejada por dia',
        description: `Você concluiu ${summary.tasksCompleted} de ${summary.tasksTotal} tarefas registradas. Experimente deixar as próximas listas mais realistas e revisar o que não coube no dia.`,
        label: 'Planejamento'
      };
    }
    if (!hasActivityData) {
      return {
        title: 'Registre sua primeira atividade',
        description: 'Quando concluir uma sessão e registrar o tempo real, este painel começará a mostrar como seus projetos e atividades recebem sua dedicação.',
        label: 'Primeiro passo'
      };
    }
    return {
      title: 'Continue registrando com consistência',
      description: 'Os dados estão sendo organizados. Com mais dias registrados, será possível comparar períodos e identificar mudanças com maior segurança.',
      label: 'Próxima etapa'
    };
  }, [underperformedHabit, summary.taskCompletionRate, summary.tasksTotal, summary.tasksCompleted, hasActivityData]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-emerald-300/15 bg-emerald-300/[0.07] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-200">
            <Activity size={12} /> Análise pessoal
          </div>
          <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Seu tempo</h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-400">
            Veja o que você realizou, onde investiu seu tempo e quais hábitos precisam de atenção.
          </p>
        </div>
        <div aria-label="Período da análise" className="flex shrink-0 rounded-xl border border-white/[0.08] bg-white/[0.03] p-1">
          {periodOptions.map(option => (
            <button
              key={option.value}
              type="button"
              onClick={() => setPeriod(option.value)}
              className={`rounded-lg px-3 py-2 text-[11px] font-medium transition-colors ${period === option.value ? 'bg-white text-zinc-950' : 'text-zinc-400 hover:text-white'}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <section className="overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-br from-[#202936] via-[#171e28] to-[#131820] p-5 sm:p-7">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs text-zinc-400">Tempo registrado · últimos {period} dias</p>
            <p className="mt-2 text-4xl font-semibold tracking-[-0.05em] text-white sm:text-5xl">{formatMinutesTotal(summary.totalMinutes)}</p>
            <p className="mt-2 text-xs text-zinc-500">Considera sessões concluídas e a duração efetivamente registrada.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:min-w-[260px]">
            <div className="rounded-2xl border border-white/[0.08] bg-black/15 p-3">
              <p className="text-[10px] text-zinc-500">Dias com atividade</p>
              <p className="mt-1 text-2xl font-semibold text-white">{summary.activeDays}</p>
            </div>
            <div className="rounded-2xl border border-white/[0.08] bg-black/15 p-3">
              <p className="text-[10px] text-zinc-500">Sessões concluídas</p>
              <p className="mt-1 text-2xl font-semibold text-white">{summary.completedSessions}</p>
            </div>
          </div>
        </div>
      </section>

      <SectionCard title="Atividade nos últimos 30 dias" subtitle="Quanto mais escuro o verde, mais tempo você registrou naquele dia.">
        <div className="overflow-x-auto pb-1">
          <div className="flex min-w-[290px] gap-2">
            <div className="grid grid-rows-7 gap-1 pt-0.5 text-[9px] text-zinc-600">
              {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((label, index) => (
                <span key={`${label}-${index}`} className="flex h-3.5 w-3 items-center justify-center">{label}</span>
              ))}
            </div>
            <div
              className="grid flex-1 grid-flow-col grid-rows-7 gap-1"
              style={{ gridTemplateColumns: `repeat(${Math.max(1, Math.ceil(calendarCells.length / 7))}, minmax(0, 1fr))` }}
            >
              {calendarCells.map((day, index) => {
                if (!day) return <span key={`blank-${index}`} aria-hidden="true" className="h-3.5 w-full" />;
                const intensityClass = [
                  'bg-white/[0.055] border-white/[0.06]',
                  'bg-emerald-100/80 border-emerald-100/80',
                  'bg-emerald-300 border-emerald-300',
                  'bg-emerald-600 border-emerald-600',
                  'bg-emerald-900 border-emerald-800'
                ][day.intensity];
                const isSelected = day.dateKey === selectedDateKey;
                const dayTitle = `${formatDateLabel(day.dateKey)} · ${day.sessionCount} ${day.sessionCount === 1 ? 'sessão' : 'sessões'} · ${formatMinutesTotal(day.minutes)}`;
                return (
                  <button
                    key={day.dateKey}
                    type="button"
                    onClick={() => setSelectedDate(day.dateKey)}
                    title={dayTitle}
                    aria-label={`${dayTitle}. ${isSelected ? 'Dia selecionado.' : 'Selecionar dia.'}`}
                    aria-pressed={isSelected}
                    className={`h-3.5 min-w-0 rounded-[3px] border transition-transform hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200 ${intensityClass} ${isSelected ? 'ring-2 ring-white ring-offset-2 ring-offset-[#141820]' : ''}`}
                  />
                );
              })}
            </div>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-end gap-1.5 text-[9px] text-zinc-500">
          <span>Menos</span>
          {['bg-white/[0.055] border-white/[0.06]', 'bg-emerald-100/80 border-emerald-100/80', 'bg-emerald-300 border-emerald-300', 'bg-emerald-600 border-emerald-600', 'bg-emerald-900 border-emerald-800'].map((tone, index) => (
            <span key={index} className={`h-3 w-3 rounded-[3px] border ${tone}`} />
          ))}
          <span>Mais</span>
        </div>

        <div className="mt-5 border-t border-white/[0.06] pt-4">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Atividades do dia</p>
              <h4 className="mt-1 text-base font-semibold capitalize text-white">
                {selectedDateKey ? new Date(`${selectedDateKey}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }) : 'Selecione um dia'}
              </h4>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold tabular-nums text-white">{formatMinutesTotal(selectedDay?.minutes || 0)}</p>
              <p className="text-[10px] text-zinc-500">{selectedDay?.sessionCount || 0} {(selectedDay?.sessionCount || 0) === 1 ? 'sessão' : 'sessões'}</p>
            </div>
          </div>
          {selectedDaySessions.length === 0 ? (
            <p className="mt-4 rounded-xl bg-white/[0.025] px-4 py-5 text-center text-xs text-zinc-500">Nenhuma sessão registrada neste dia.</p>
          ) : (
            <div className="mt-4 space-y-2">
              {selectedDaySessions.map(session => {
                const activity = session.activity_id ? activityById.get(session.activity_id) : undefined;
                const projectId = session.project_id || activity?.project_id;
                const project = projectId ? projectById.get(projectId) : undefined;
                const tasks = sessionTasks.filter(task => task.session_id === session.id);
                const scheduledActivity = session.scheduled_activity_id ? scheduledActivityById.get(session.scheduled_activity_id) : undefined;
                const startLabel = new Date(session.started_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                const endLabel = session.completed_at ? new Date(session.completed_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
                const savedActivityName = session.activity_name?.trim();
                const isPlaceholderName = !savedActivityName || ['Sessão Sem Título', 'Sem Título', 'Untitled'].includes(savedActivityName);
                const activityName = isPlaceholderName ? activity?.name || 'Atividade sem nome' : savedActivityName;
                return (
                  <article key={session.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-white">{activityName}</p>
                        <p className="mt-1 text-[10px] text-zinc-500">{project?.name || 'Sem projeto vinculado'}{activity?.name && activity.name !== activityName ? ` · ${activity.name}` : ''}</p>
                        <p className="mt-1 text-[10px] text-zinc-600">{startLabel}{endLabel ? `–${endLabel}` : ''}</p>
                      </div>
                      <span className="shrink-0 text-xs font-semibold tabular-nums text-emerald-100">{formatMinutesTotal(getRecordedSessionMinutes(session))}</span>
                    </div>
                    {tasks.length > 0 && (
                      <div className="mt-3 space-y-1.5 border-t border-white/[0.05] pt-3">
                        {tasks.map(task => (
                          <div key={task.id} className="flex items-start gap-2 text-[10px] text-zinc-400">
                            <CheckCircle2 size={12} className={`mt-0.5 shrink-0 ${task.completed ? 'text-emerald-300' : 'text-zinc-600'}`} />
                            <span className={task.completed ? 'text-zinc-300' : 'text-zinc-500'}>{task.description}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {tasks.length === 0 && scheduledActivity?.tasks?.length ? (
                      <div className="mt-3 border-t border-white/[0.05] pt-3">
                        <p className="mb-2 text-[9px] font-semibold uppercase tracking-[0.1em] text-zinc-600">Tarefas previstas</p>
                        <ul className="space-y-1">
                          {scheduledActivity.tasks.map((task, index) => <li key={`${session.id}-planned-${index}`} className="text-[10px] text-zinc-500">• {task}</li>)}
                        </ul>
                      </div>
                    ) : tasks.length === 0 && session.description ? (
                      <p className="mt-3 border-t border-white/[0.05] pt-3 text-[10px] leading-relaxed text-zinc-500">{session.description}</p>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </SectionCard>

      <button
        type="button"
        onClick={() => setShowFullAnalysis(value => !value)}
        aria-expanded={showFullAnalysis}
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.025] px-4 py-3 text-xs font-semibold text-zinc-300 transition-colors hover:bg-white/[0.06] hover:text-white"
      >
        {showFullAnalysis ? 'Ocultar análise completa' : 'Ver análise completa'}
        {showFullAnalysis ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {showFullAnalysis && (
        <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <MetricCard
          label="Projetos com tempo registrado"
          value={String(summary.projectCount)}
          detail="Projetos que receberam tempo registrado."
          icon={FolderKanban}
        />
        <MetricCard
          label="Hábitos realizados"
          value={summary.habitCompletionRate === null ? '—' : `${summary.habitCompletionRate}%`}
          detail={hasHabitData ? 'Registros realizados em relação ao previsto.' : 'Cadastre hábitos para acompanhar este indicador.'}
          icon={Target}
        />
        <MetricCard
          label="Tarefas concluídas"
          value={summary.taskCompletionRate === null ? '—' : `${summary.taskCompletionRate}%`}
          detail={summary.tasksTotal > 0 ? `${summary.tasksCompleted} de ${summary.tasksTotal} tarefas no período.` : 'Ainda não há tarefas registradas neste período.'}
          icon={CheckCircle2}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard title="Projetos com mais tempo" subtitle="Tempo registrado em sessões concluídas.">
          {summary.projectDistribution.length === 0 ? (
            <EmptyMessage text="Ainda não há tempo registrado em projetos neste período." />
          ) : (
            <div className="space-y-4">
              {summary.projectDistribution.map((item, index) => (
                <div key={item.name}>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="truncate text-xs font-medium text-zinc-200">{item.name}</span>
                    <span className="shrink-0 text-[11px] tabular-nums text-zinc-400">{formatMinutesTotal(item.minutes)} · {item.share}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
                    <div className={`h-full rounded-full ${index === 0 ? 'bg-emerald-300' : 'bg-slate-400/70'}`} style={{ width: percentWidth(item.share) }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Atividades com mais tempo" subtitle="O que recebeu mais tempo registrado.">
          {summary.activityDistribution.length === 0 ? (
            <EmptyMessage text="As atividades aparecerão aqui quando houver sessões concluídas." />
          ) : (
            <div className="space-y-3">
              {summary.activityDistribution.map((item, index) => (
                <div key={item.name} className="flex items-center gap-3 rounded-xl bg-white/[0.025] px-3 py-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-[11px] font-semibold text-zinc-400">{index + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-zinc-200">{item.name}</p>
                    <p className="mt-1 text-[10px] text-zinc-500">{item.count} {item.count === 1 ? 'sessão' : 'sessões'}</p>
                  </div>
                  <span className="shrink-0 text-xs font-medium tabular-nums text-zinc-300">{formatMinutesTotal(item.minutes)}</span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <SectionCard title="Tempo previsto e registrado" subtitle="Compare o tempo agendado com o tempo registrado em cada projeto.">
        {summary.projectTimeComparison.length === 0 ? (
          <EmptyMessage text="Agende atividades vinculadas a projetos para comparar o tempo previsto com o tempo registrado." />
        ) : (
          <div className="space-y-4">
            {summary.projectTimeComparison.map(project => {
              const progress = project.plannedMinutes > 0 ? Math.min(100, Math.round((project.recordedMinutes / project.plannedMinutes) * 100)) : 0;
              const difference = project.differenceMinutes;
              const differenceLabel = difference === 0
                ? 'Dentro do previsto'
                : difference > 0
                  ? `${formatMinutesTotal(difference)} acima do previsto`
                  : `${formatMinutesTotal(Math.abs(difference))} abaixo do previsto`;
              return (
                <div key={project.id}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-xs font-medium text-zinc-200">{project.name}</p>
                    <p className="shrink-0 text-[10px] text-zinc-500">{differenceLabel}</p>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[10px] text-zinc-500">
                    <span>Previsto: {formatMinutesTotal(project.plannedMinutes)}</span>
                    <span>Registrado: {formatMinutesTotal(project.recordedMinutes)}</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                    <div className="h-full rounded-full bg-emerald-300" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <p className="mt-4 text-[10px] leading-relaxed text-zinc-600">O tempo registrado considera todas as sessões do projeto, inclusive as que não estavam agendadas. A diferença é um sinal para revisar o planejamento, não uma avaliação automática.</p>
      </SectionCard>

      <SectionCard
        title="Seus hábitos"
        subtitle="Compare o que você planejou praticar com os registros realizados no período."
        action={<span className="rounded-full bg-white/[0.05] px-2.5 py-1 text-[10px] text-zinc-400">{summary.habitsTracked} acompanhados</span>}
      >
        {summary.habitAdherence.length === 0 ? (
          <EmptyMessage text="Seus hábitos cadastrados aparecerão aqui com a regularidade de cada um." />
        ) : (
          <div className="space-y-3">
            {summary.habitAdherence.map(habit => (
              <div key={habit.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">{habit.name}</p>
                    <p className="mt-1 text-[11px] text-zinc-500">{habit.completed} de {Math.ceil(habit.expected)} registros previstos</p>
                    {habit.expected > 0 && habit.completed < habit.expected && habit.rate < 70 && (
                      <p className="mt-1 text-[10px] font-medium text-rose-200/80">Abaixo do previsto neste período</p>
                    )}
                  </div>
                  <span className={`text-xs font-semibold tabular-nums ${habit.expected <= 0 ? 'text-zinc-400' : habit.rate >= 85 ? 'text-emerald-200' : habit.rate >= 60 ? 'text-amber-200' : 'text-rose-200'}`}>
                    {habit.expected > 0 ? `${habit.rate}%` : 'Sem meta definida'}
                  </span>
                </div>
                {habit.expected > 0 && (
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                    <div className={`h-full rounded-full ${habit.rate >= 85 ? 'bg-emerald-300' : habit.rate >= 60 ? 'bg-amber-300' : 'bg-rose-300'}`} style={{ width: percentWidth(habit.rate) }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {habitsNeedingAttention.length > 0 && (
          <div className="mt-4 rounded-2xl border border-rose-200/10 bg-rose-200/[0.035] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-rose-100/80">Hábitos abaixo do previsto</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {habitsNeedingAttention.map(habit => <span key={habit.id} className="rounded-full border border-rose-200/10 bg-rose-200/[0.05] px-2.5 py-1 text-[10px] text-rose-100/80">{habit.name}</span>)}
            </div>
          </div>
        )}
        <p className="mt-4 text-[10px] leading-relaxed text-zinc-600">
          A meta considera os dias e a frequência que você definiu. Hábitos sem uma meta definida não entram no cálculo geral.
        </p>
      </SectionCard>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard title="Planejado e concluído" subtitle="Compare o que foi agendado com o que foi realizado.">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white/[0.03] p-4">
              <CalendarCheck2 size={17} className="text-zinc-400" />
              <p className="mt-3 text-2xl font-semibold text-white">{summary.scheduledCompletionRate === null ? '—' : `${summary.scheduledCompletionRate}%`}</p>
              <p className="mt-1 text-[10px] text-zinc-500">Atividades agendadas concluídas</p>
              <p className="mt-2 text-[10px] text-zinc-600">{summary.scheduledCompleted}/{summary.scheduledTotal}</p>
            </div>
            <div className="rounded-2xl bg-white/[0.03] p-4">
              <CheckCircle2 size={17} className="text-zinc-400" />
              <p className="mt-3 text-2xl font-semibold text-white">{summary.taskCompletionRate === null ? '—' : `${summary.taskCompletionRate}%`}</p>
              <p className="mt-1 text-[10px] text-zinc-500">Tarefas concluídas</p>
              <p className="mt-2 text-[10px] text-zinc-600">{summary.tasksCompleted}/{summary.tasksTotal}</p>
            </div>
          </div>
          <p className="mt-4 text-[10px] leading-relaxed text-zinc-600">Itens cancelados e expirados não entram no cálculo das atividades agendadas.</p>
        </SectionCard>

        <SectionCard title="Dias e horários com mais atividade" subtitle="Mostramos uma tendência apenas quando há registros suficientes.">
          {summary.strongestWeekday && summary.strongestPeriod ? (
            <div className="space-y-3">
              <div className="rounded-2xl bg-white/[0.03] p-4">
                <p className="text-[10px] uppercase tracking-[0.12em] text-zinc-500">Dia com maior tempo registrado</p>
                <p className="mt-2 text-lg font-semibold capitalize text-white">{summary.strongestWeekday}</p>
              </div>
              <div className="rounded-2xl bg-white/[0.03] p-4">
                <p className="text-[10px] uppercase tracking-[0.12em] text-zinc-500">Período com maior tempo registrado</p>
                <p className="mt-2 text-lg font-semibold text-white">{summary.strongestPeriod}</p>
              </div>
              <p className="text-[10px] text-zinc-600">Base: {summary.patternSampleSessions} sessões em {summary.patternSampleDays} dias diferentes. É um retrato dos registros, não uma regra fixa.</p>
            </div>
          ) : (
            <div className="rounded-2xl bg-white/[0.025] p-4">
              <div className="flex items-center gap-2 text-zinc-300"><Clock3 size={16} /><span className="text-xs font-medium">Ainda não há dados suficientes</span></div>
              <p className="mt-2 text-xs leading-relaxed text-zinc-500">São necessárias pelo menos 5 sessões em 3 dias diferentes para identificar um horário ou dia mais ativo.</p>
              <p className="mt-2 text-[10px] text-zinc-600">Agora: {summary.patternSampleSessions} sessões em {summary.patternSampleDays} dias.</p>
            </div>
          )}
        </SectionCard>
      </div>

      <section className="rounded-3xl border border-emerald-200/10 bg-emerald-200/[0.045] p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-200/10 text-emerald-100"><Sparkles size={17} /></div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-100/70">Próximo passo · {nextAdjustment.label}</p>
            <h3 className="mt-2 text-base font-semibold text-white">{nextAdjustment.title}</h3>
            <p className="mt-2 text-xs leading-relaxed text-zinc-400">{nextAdjustment.description}</p>
          </div>
          <ArrowUpRight size={16} className="shrink-0 text-emerald-100/50" />
        </div>
      </section>

      <div className="flex items-start gap-2 px-1 text-[10px] leading-relaxed text-zinc-600">
        <AlertCircle size={13} className="mt-0.5 shrink-0" />
        <p>As análises usam apenas registros existentes. Dias sem registro não são tratados como atividade realizada.</p>
      </div>
        </>
      )}
    </div>
  );
};

const EmptyMessage = ({ text }: { text: string }) => (
  <div className="rounded-2xl border border-dashed border-white/[0.09] px-4 py-8 text-center">
    <Layers3 size={19} className="mx-auto text-zinc-600" />
    <p className="mx-auto mt-3 max-w-sm text-xs leading-relaxed text-zinc-500">{text}</p>
  </div>
);
