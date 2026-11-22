import React, { useMemo } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X, Clock3, FolderOpen, Activity, HeartPulse, CalendarDays } from 'lucide-react';
import { useDataStore } from '../../store/useDataStore';
import { getLocalDateString } from '../../lib/utils';
import { normalizeAvoidanceStatus } from '../../lib/avoidanceMetrics';

interface SuaEvolucaoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const getPeriodFromHour = (hour: number): 'manha' | 'tarde' | 'noite' => {
  if (hour < 12) return 'manha';
  if (hour < 18) return 'tarde';
  return 'noite';
};

const periodLabel = (period: string) => {
  if (period === 'manha') return 'manhã';
  if (period === 'tarde') return 'tarde';
  if (period === 'noite') return 'noite';
  return 'horário não informado';
};

const normalizeDateKey = (value?: string | null) => value?.slice(0, 10) || '';

export const SuaEvolucaoModal: React.FC<SuaEvolucaoModalProps> = ({ isOpen, onClose }) => {
  const sessions = useDataStore(state => state.sessions);
  const projects = useDataStore(state => state.projects);
  const habits = useDataStore(state => state.habits);
  const avoidanceCheckins = useDataStore(state => state.avoidanceCheckins);
  const moodEntries = useDataStore(state => state.moodEntries);

  const summary = useMemo(() => {
    const now = new Date();
    const startDate = new Date(now);
    startDate.setHours(0, 0, 0, 0);
    startDate.setDate(startDate.getDate() - 29);
    const startKey = getLocalDateString(startDate);
    const endKey = getLocalDateString(now);

    const recentSessions = sessions.filter(session => {
      if (!session.completed || !session.started_at) return false;
      const dateKey = getLocalDateString(new Date(session.started_at));
      return dateKey >= startKey && dateKey <= endKey;
    });

    const minutesByPeriod: Record<'manha' | 'tarde' | 'noite', number> = {
      manha: 0,
      tarde: 0,
      noite: 0
    };
    const minutesByProject = new Map<string, number>();
    const minutesByActivity = new Map<string, number>();
    let totalMinutes = 0;

    recentSessions.forEach(session => {
      const minutes = Math.max(0, Number(session.actual_duration_minutes ?? session.duration_minutes) || 0);
      totalMinutes += minutes;
      const hour = new Date(session.started_at).getHours();
      minutesByPeriod[getPeriodFromHour(hour)] += minutes;

      const activityName = session.activity_name?.trim() || 'Atividade sem nome';
      minutesByActivity.set(activityName, (minutesByActivity.get(activityName) || 0) + minutes);

      if (session.project_id) {
        const project = projects.find(item => item.id === session.project_id);
        const projectName = project?.name || 'Projeto sem nome';
        minutesByProject.set(projectName, (minutesByProject.get(projectName) || 0) + minutes);
      }
    });

    const bestPeriod = (Object.entries(minutesByPeriod) as Array<[keyof typeof minutesByPeriod, number]>)
      .sort((a, b) => b[1] - a[1])[0];
    const bestProject = [...minutesByProject.entries()].sort((a, b) => b[1] - a[1])[0] || null;
    const bestActivity = [...minutesByActivity.entries()].sort((a, b) => b[1] - a[1])[0] || null;

    const recentAvoidanceCheckins = avoidanceCheckins.filter(checkin => {
      const dateKey = normalizeDateKey(checkin.checkin_date) ||
        (checkin.created_at ? getLocalDateString(new Date(checkin.created_at)) : '');
      return dateKey >= startKey && dateKey <= endKey;
    });
    const recentRelapses = recentAvoidanceCheckins.filter(
      checkin => normalizeAvoidanceStatus(checkin.status) === 'relapse'
    );

    const matchedKeys = new Set<string>();
    const matchedMood = recentRelapses.flatMap(checkin => {
      const dateKey = normalizeDateKey(checkin.checkin_date) ||
        (checkin.created_at ? getLocalDateString(new Date(checkin.created_at)) : '');
      const hour = checkin.created_at ? new Date(checkin.created_at).getHours() : 12;
      const targetPeriod = checkin.checkin_period === 'morning'
        ? 'manha'
        : checkin.checkin_period === 'afternoon'
          ? 'tarde'
          : checkin.checkin_period === 'evening'
            ? 'noite'
            : getPeriodFromHour(hour);
      const matchKey = `${dateKey}:${targetPeriod}`;
      if (matchedKeys.has(matchKey)) return [];
      const entry = moodEntries.find(item =>
        item.date === dateKey && item.period === targetPeriod
      );
      if (!entry) return [];
      matchedKeys.add(matchKey);
      return [{ energy: entry.energy || null, mood: entry.mood || null }];
    });

    const countValues = (values: Array<string | null>) => {
      const counts = new Map<string, number>();
      values.filter((value): value is string => !!value).forEach(value => {
        counts.set(value, (counts.get(value) || 0) + 1);
      });
      return [...counts.entries()].sort((a, b) => b[1] - a[1])[0] || null;
    };

    const commonEnergy = countValues(matchedMood.map(item => item.energy));
    const commonMood = countValues(matchedMood.map(item => item.mood));

    const buildHabits = habits
      .filter(habit => habit.habit_mode !== 'avoid')
      .sort((a, b) => (b.weekly_streak || 0) - (a.weekly_streak || 0));
    const totalHabitSessions = buildHabits.reduce((sum, habit) => sum + (habit.deep_sessions_count || 0), 0);
    const totalHabitMinutes = buildHabits.reduce((sum, habit) => sum + (habit.total_minutes || 0), 0);

    return {
      startKey,
      endKey,
      sessionCount: recentSessions.length,
      totalMinutes,
      bestPeriod: bestPeriod?.[1] > 0 ? bestPeriod : null,
      bestProject,
      bestActivity,
      avoidanceCheckinCount: recentAvoidanceCheckins.length,
      relapseCount: recentRelapses.length,
      matchedMoodCount: matchedMood.length,
      commonEnergy,
      commonMood,
      buildHabits: buildHabits.slice(0, 3),
      buildHabitCount: buildHabits.length,
      totalHabitSessions,
      totalHabitMinutes
    };
  }, [sessions, projects, habits, avoidanceCheckins, moodEntries]);

  const formatMinutes = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const remaining = Math.round(minutes % 60);
    if (hours <= 0) return `${remaining} min`;
    return remaining > 0 ? `${hours}h ${remaining}min` : `${hours}h`;
  };

  const formatEnergy = (value?: string | null) => {
    if (!value) return '';
    const labels: Record<string, string> = {
      pleno: 'alta',
      energizado: 'alta',
      normal: 'normal',
      equilibrado: 'equilibrada',
      inquieto: 'inquieta',
      fadigado: 'baixa',
      cansado: 'baixa'
    };
    return labels[value] || value;
  };

  const formatMood = (value?: string | null) => {
    if (!value) return '';
    const labels: Record<string, string> = {
      animado: 'animado',
      tranquilo: 'tranquilo',
      neutro: 'neutro',
      ansioso: 'ansioso',
      prabaixo: 'para baixo'
    };
    return labels[value] || value;
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
        onClick={onClose}
      >
        <motion.section
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.98 }}
          onClick={event => event.stopPropagation()}
          className="relative flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#111315] text-left shadow-2xl"
          aria-label="Resumo do seu ritmo"
        >
          <header className="flex items-start justify-between gap-4 border-b border-white/10 p-5 sm:p-6">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-300">Seu ritmo</p>
              <h3 className="mt-1 text-xl font-semibold tracking-tight text-white">Como você usa seu tempo</h3>
              <p className="mt-2 text-xs text-zinc-400">Resumo dos últimos 30 dias, com base nos registros do aplicativo.</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar resumo"
              className="rounded-full p-2 text-zinc-400 hover:bg-white/10 hover:text-white"
            >
              <X size={18} />
            </button>
          </header>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5 sm:p-6">
            <section className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 sm:p-5">
              <div className="flex items-center gap-2">
                <Clock3 size={17} className="text-emerald-300" />
                <h4 className="text-sm font-semibold text-white">Seu horário de foco</h4>
              </div>
              {summary.sessionCount < 3 || !summary.bestPeriod ? (
                <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                  Ainda não há sessões concluídas suficientes nos últimos 30 dias para identificar um horário predominante.
                </p>
              ) : (
                <>
                  <p className="mt-3 text-sm leading-relaxed text-zinc-300">
                    Você registrou mais tempo de foco durante a <strong className="text-white">{periodLabel(summary.bestPeriod[0])}</strong>:
                    {' '}<strong className="text-emerald-200">{formatMinutes(summary.bestPeriod[1])}</strong> em {summary.sessionCount} sessões concluídas.
                  </p>
                  <p className="mt-2 text-[11px] text-zinc-500">
                    O cálculo considera minutos registrados, não apenas a quantidade de sessões.
                  </p>
                </>
              )}
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-black/20 p-3">
                  <p className="text-[10px] text-zinc-500">Tempo total</p>
                  <p className="mt-1 text-lg font-semibold text-white">{formatMinutes(summary.totalMinutes)}</p>
                </div>
                <div className="rounded-xl bg-black/20 p-3">
                  <p className="text-[10px] text-zinc-500">Sessões concluídas</p>
                  <p className="mt-1 text-lg font-semibold text-white">{summary.sessionCount}</p>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 sm:p-5">
              <div className="flex items-center gap-2">
                <FolderOpen size={17} className="text-sky-300" />
                <h4 className="text-sm font-semibold text-white">Onde você concentrou seu tempo</h4>
              </div>
              <div className="mt-3 space-y-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-zinc-500">Projeto com mais tempo</p>
                  {summary.bestProject ? (
                    <p className="mt-1 text-sm text-zinc-200">
                      {summary.bestProject[0]} <span className="text-zinc-500">· {formatMinutes(summary.bestProject[1])}</span>
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-zinc-500">Nenhuma sessão foi vinculada a um projeto neste período.</p>
                  )}
                </div>
                <div className="border-t border-white/5 pt-3">
                  <p className="text-[10px] uppercase tracking-wide text-zinc-500">Atividade com mais tempo</p>
                  {summary.bestActivity ? (
                    <p className="mt-1 text-sm text-zinc-200">
                      {summary.bestActivity[0]} <span className="text-zinc-500">· {formatMinutes(summary.bestActivity[1])}</span>
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-zinc-500">Ainda não há atividades registradas.</p>
                  )}
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 sm:p-5">
              <div className="flex items-center gap-2">
                <HeartPulse size={17} className="text-orange-200" />
                <h4 className="text-sm font-semibold text-white">Registros de autocontrole</h4>
              </div>
              {summary.avoidanceCheckinCount === 0 ? (
                <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                  Ainda não há registros de autocontrole nos últimos 30 dias. Quando você fizer check-ins, eles aparecerão neste resumo.
                </p>
              ) : summary.relapseCount === 0 ? (
                <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                  Nenhuma recaída foi registrada nos últimos 30 dias entre os check-ins feitos. Isso descreve os registros disponíveis, não períodos sem acompanhamento.
                </p>
              ) : (
                <>
                  <p className="mt-3 text-sm leading-relaxed text-zinc-300">
                    Foram registradas <strong className="text-white">{summary.relapseCount}</strong> ocorrências de recaída nos últimos 30 dias.
                    {` ${summary.matchedMoodCount} ${summary.matchedMoodCount === 1 ? 'ocorrência tem' : 'ocorrências têm'} um registro de humor no mesmo dia e período.`}
                  </p>
                  {summary.matchedMoodCount >= 3 && ((summary.commonEnergy?.[1] || 0) >= 3 || (summary.commonMood?.[1] || 0) >= 3) ? (
                    <p className="mt-3 rounded-xl bg-black/20 p-3 text-xs leading-relaxed text-zinc-300">
                      Entre os registros que também têm check-in de humor,
                      {summary.commonEnergy && summary.commonEnergy[1] >= 3 ? <> a energia mais informada foi <strong className="text-white">{formatEnergy(summary.commonEnergy[0])}</strong></> : null}
                      {summary.commonEnergy && summary.commonEnergy[1] >= 3 && summary.commonMood && summary.commonMood[1] >= 3 ? ' e' : null}
                      {summary.commonMood && summary.commonMood[1] >= 3 ? <> o humor mais informado foi <strong className="text-white">{formatMood(summary.commonMood[0])}</strong></> : null}.
                      {' '}Isso descreve os registros disponíveis; não significa que esses fatores causaram as ocorrências.
                    </p>
                  ) : (
                    <p className="mt-3 text-xs leading-relaxed text-zinc-500">
                      Ainda não há registros associados suficientes para apontar uma tendência de humor ou energia.
                    </p>
                  )}
                </>
              )}
            </section>

            <section className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 sm:p-5">
              <div className="flex items-center gap-2">
                <Activity size={17} className="text-violet-200" />
                <h4 className="text-sm font-semibold text-white">Hábitos em andamento</h4>
              </div>
              {summary.buildHabitCount === 0 ? (
                <p className="mt-3 text-sm text-zinc-400">Você ainda não cadastrou hábitos de construção.</p>
              ) : (
                <>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-black/20 p-3">
                      <p className="text-[10px] text-zinc-500">Hábitos ativos</p>
                      <p className="mt-1 text-lg font-semibold text-white">{summary.buildHabitCount}</p>
                    </div>
                    <div className="rounded-xl bg-black/20 p-3">
                      <p className="text-[10px] text-zinc-500">Sessões registradas</p>
                      <p className="mt-1 text-lg font-semibold text-white">{summary.totalHabitSessions}</p>
                    </div>
                  </div>
                  <div className="mt-3 space-y-2">
                    {summary.buildHabits.map(habit => (
                      <div key={habit.id} className="flex items-center justify-between gap-3 rounded-xl bg-black/20 px-3 py-2.5">
                        <span className="min-w-0 truncate text-xs text-zinc-200">{habit.name}</span>
                        <span className="shrink-0 text-[11px] text-zinc-400">
                          {habit.weekly_streak || 0} {(habit.weekly_streak || 0) === 1 ? 'semana' : 'semanas'} seguidas
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-[11px] text-zinc-500">
                    Tempo total registrado nos hábitos: {formatMinutes(summary.totalHabitMinutes)}.
                  </p>
                </>
              )}
            </section>

            <p className="flex items-start gap-2 px-1 text-[11px] leading-relaxed text-zinc-500">
              <CalendarDays size={14} className="mt-0.5 shrink-0" />
              Período analisado: {new Date(`${summary.startKey}T12:00:00`).toLocaleDateString('pt-BR')} até {new Date(`${summary.endKey}T12:00:00`).toLocaleDateString('pt-BR')}. Os resultados dependem dos registros feitos por você.
            </p>
          </div>

          <footer className="border-t border-white/10 p-4 sm:p-5">
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-xl bg-emerald-300 px-4 py-3 text-sm font-semibold text-black transition-colors hover:bg-emerald-200"
            >
              Concluir
            </button>
          </footer>
        </motion.section>
      </motion.div>
    </AnimatePresence>
  );
};
