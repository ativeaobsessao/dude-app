import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Activity, AlertCircle, CalendarDays, Check, CheckCircle2, Clock3, FileText, Pencil, Plus, ShieldCheck, Trash2, TrendingDown, TrendingUp, X } from 'lucide-react';
import { useDataStore } from '../../store/useDataStore';
import { getLocalDateString } from '../../lib/utils';
import { normalizeAvoidanceStatus } from '../../lib/avoidanceMetrics';
import { analyzeAvoidancePatterns, formatDateLabel, type InsightPeriod } from '../../lib/behaviorInsights';
import type { AvoidanceCheckin } from '../../types';

const periodOptions: Array<{ value: InsightPeriod; label: string }> = [
  { value: 7, label: '7 dias' },
  { value: 30, label: '30 dias' },
  { value: 90, label: '90 dias' }
];

const triggerOptions = ['Estresse', 'Tédio', 'Solidão', 'Cansaço', 'Ansiedade', 'Frustração', 'Ambiente digital', 'Conflito', 'Outro'];
const emotionOptions = ['Ansiedade', 'Estresse', 'Tédio', 'Tristeza', 'Frustração', 'Solidão', 'Cansaço', 'Calma', 'Não identifiquei'];
const environmentOptions = ['Em casa', 'No trabalho', 'Na rua', 'Na cama', 'Sozinho', 'Com outras pessoas', 'No celular ou computador', 'Outro'];
const recoveryOptions = ['Mudei de ambiente', 'Adiei a decisão', 'Conversei com alguém', 'Fiz uma pausa', 'Escolhi outra atividade', 'Usei uma estratégia pessoal', 'Não se aplica'];

type EventStatus = 'success' | 'relapse' | 'pending';
interface EventFormState {
  habitId: string;
  status: EventStatus | '';
  triggerTag: string;
  emotionTag: string;
  environmentTag: string;
  precedingActivity: string;
  recoveryAction: string;
  urgeIntensity: number;
  note: string;
  occurredAt: string;
}

const toLocalDateTimeInput = (value: Date) => {
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
};

const emptyForm = (habitId: string): EventFormState => ({
  habitId,
  status: '',
  triggerTag: '',
  emotionTag: '',
  environmentTag: '',
  precedingActivity: '',
  recoveryAction: 'Não se aplica',
  urgeIntensity: 5,
  note: '',
  occurredAt: toLocalDateTimeInput(new Date())
});

const statusMeta = (status: string) => {
  const normalized = normalizeAvoidanceStatus(status);
  if (normalized === 'success') return { label: 'Resistência', className: 'bg-emerald-300/10 text-emerald-200', icon: CheckCircle2 };
  if (normalized === 'relapse') return { label: 'Recaída', className: 'bg-rose-300/10 text-rose-200', icon: TrendingDown };
  return { label: 'Adiado', className: 'bg-white/[0.07] text-zinc-300', icon: Clock3 };
};

const formatEventDate = (event: AvoidanceCheckin) => {
  const timestamp = event.occurred_at || event.created_at;
  const dateKey = event.occurred_at ? getLocalDateString(new Date(event.occurred_at)) : (event.checkin_date?.slice(0, 10) || getLocalDateString(new Date(event.created_at)));
  const dateLabel = formatDateLabel(dateKey);
  const timeLabel = timestamp && !Number.isNaN(new Date(timestamp).getTime())
    ? new Date(timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : '';
  return timeLabel ? `${dateLabel} · ${timeLabel}` : dateLabel;
};

const FieldLabel = ({ children }: { children: React.ReactNode }) => (
  <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">{children}</label>
);

const selectClass = 'w-full rounded-xl border border-white/[0.09] bg-[#10141b] px-3 py-3 text-xs text-zinc-200 outline-none transition-colors focus:border-emerald-200/40';
const inputClass = 'w-full rounded-xl border border-white/[0.09] bg-[#10141b] px-3 py-3 text-xs text-zinc-200 outline-none transition-colors placeholder:text-zinc-600 focus:border-emerald-200/40';

export const AutocontroleLab: React.FC = () => {
  const profile = useDataStore(state => state.profile);
  const habits = useDataStore(state => state.habits);
  const avoidanceCheckins = useDataStore(state => state.avoidanceCheckins);
  const sessions = useDataStore(state => state.sessions);
  const projects = useDataStore(state => state.projects);
  const activities = useDataStore(state => state.activities);
  const addAvoidanceCheckin = useDataStore(state => state.addAvoidanceCheckin);
  const updateAvoidanceCheckin = useDataStore(state => state.updateAvoidanceCheckin);
  const deleteAvoidanceCheckin = useDataStore(state => state.deleteAvoidanceCheckin);
  const showNotification = useDataStore(state => state.showNotification);

  const avoidHabits = useMemo(() => habits.filter(habit => habit.habit_mode === 'avoid'), [habits]);
  const [period, setPeriod] = useState<InsightPeriod>(30);
  const [selectedHabitId, setSelectedHabitId] = useState('all');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<EventFormState>(() => emptyForm(''));

  const summary = useMemo(() => analyzeAvoidancePatterns({
    checkins: avoidanceCheckins,
    selectedHabitId,
    days: period,
    sessions,
    projects,
    activities,
    habits: avoidHabits
  }), [avoidanceCheckins, selectedHabitId, period, sessions, projects, activities, avoidHabits]);

  const selectedHabitName = selectedHabitId === 'all'
    ? 'Todos os acompanhamentos'
    : avoidHabits.find(habit => habit.id === selectedHabitId)?.name || 'Acompanhamento';

  const resistanceActions = useMemo(() => {
    const counts = new Map<string, number>();
    summary.recentEvents
      .filter(event => normalizeAvoidanceStatus(event.status) === 'success')
      .forEach(event => {
        const action = event.recovery_action?.trim();
        if (action && action !== 'Não se aplica') counts.set(action, (counts.get(action) || 0) + 1);
      });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [summary.recentEvents]);

  const openNewEvent = () => {
    const firstHabitId = selectedHabitId !== 'all' ? selectedHabitId : (avoidHabits[0]?.id || '');
    setEditingEventId(null);
    setForm(emptyForm(firstHabitId));
    setIsFormOpen(true);
  };

  const openEditEvent = (event: AvoidanceCheckin) => {
    const status = normalizeAvoidanceStatus(event.status) || 'pending';
    setEditingEventId(event.id);
    setForm({
      habitId: event.habit_id || avoidHabits[0]?.id || '',
      status,
      triggerTag: event.trigger_tag || '',
      emotionTag: event.emotion_tag || '',
      environmentTag: event.environment_tag || '',
      precedingActivity: event.preceding_activity || '',
      recoveryAction: event.recovery_action || 'Não se aplica',
      urgeIntensity: Math.min(10, Math.max(1, Number(event.urge_intensity) || 5)),
      note: event.trigger_note || '',
      occurredAt: toLocalDateTimeInput(new Date(event.occurred_at || event.created_at || new Date().toISOString()))
    });
    setIsFormOpen(true);
  };

  const saveEvent = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    if (!profile?.id) {
      showNotification('Sua sessão expirou. Entre novamente para salvar o registro.', 'error');
      return;
    }
    if (!form.habitId) {
      showNotification('Selecione um acompanhamento antes de salvar.', 'error');
      return;
    }
    if (!form.status) {
      showNotification('Selecione como terminou este episódio.', 'error');
      return;
    }
    const occurredDate = new Date(form.occurredAt);
    if (Number.isNaN(occurredDate.getTime())) {
      showNotification('Informe uma data e um horário válidos.', 'error');
      return;
    }

    setSaving(true);
    const payload = {
      habit_id: form.habitId,
      status: form.status,
      checkin_date: getLocalDateString(occurredDate),
      occurred_at: occurredDate.toISOString(),
      checkin_period: 'window',
      trigger_tag: form.triggerTag || null,
      emotion_tag: form.emotionTag || null,
      environment_tag: form.environmentTag || null,
      preceding_activity: form.precedingActivity.trim() || null,
      recovery_action: form.status === 'success' && form.recoveryAction !== 'Não se aplica' ? form.recoveryAction : null,
      urge_intensity: form.urgeIntensity,
      trigger_note: form.note.trim() || null
    };

    const saved = editingEventId
      ? await updateAvoidanceCheckin(editingEventId, payload)
      : await addAvoidanceCheckin({ user_id: profile.id, ...payload });

    setSaving(false);
    if (!saved) {
      showNotification('Não foi possível salvar. Verifique a conexão e tente novamente.', 'error');
      return;
    }

    setIsFormOpen(false);
    setEditingEventId(null);
    showNotification(editingEventId ? 'Registro atualizado.' : 'Registro adicionado ao histórico.', 'success');
  };

  const confirmDelete = async () => {
    if (!deleteTarget || saving) return;
    setSaving(true);
    const deleted = await deleteAvoidanceCheckin(deleteTarget);
    setSaving(false);
    if (!deleted) {
      showNotification('Não foi possível excluir este registro.', 'error');
      return;
    }
    setDeleteTarget(null);
    showNotification('Registro removido do histórico.', 'success');
  };

  const openCreateHabit = () => {
    window.dispatchEvent(new CustomEvent('open-action-center', { detail: { screen: 'anti-vicio' } }));
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-violet-200/15 bg-violet-200/[0.07] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-100">
            <ShieldCheck size={12} /> Autocontrole
          </div>
          <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Entenda seus registros</h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-400">
            Registre recaídas e resistências. Com o tempo, você verá quais situações se repetem e o que costuma ajudar.
          </p>
        </div>
        <button
          type="button"
          onClick={openNewEvent}
          disabled={avoidHabits.length === 0}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-xs font-semibold text-zinc-950 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus size={15} /> Novo registro
        </button>
      </div>

      {avoidHabits.length === 0 ? (
        <section className="rounded-3xl border border-dashed border-white/[0.12] bg-white/[0.02] p-7 text-center">
          <ShieldCheck size={25} className="mx-auto text-zinc-500" />
          <h3 className="mt-4 text-base font-semibold text-white">Comece criando um acompanhamento</h3>
          <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-zinc-500">Depois de cadastrar o comportamento que deseja acompanhar, você poderá registrar resistências, recaídas, contextos e anotações nesta área.</p>
          <button type="button" onClick={openCreateHabit} className="mt-5 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-xs font-semibold text-white hover:bg-white/10">Criar acompanhamento</button>
        </section>
      ) : (
        <>
          <div className="flex flex-col gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1">
              <FieldLabel>Qual comportamento?</FieldLabel>
              <select value={selectedHabitId} onChange={event => setSelectedHabitId(event.target.value)} className={selectClass}>
                <option value="all">Todos os acompanhamentos</option>
                {avoidHabits.map(habit => <option key={habit.id} value={habit.id}>{habit.name}</option>)}
              </select>
            </div>
            <div className="flex shrink-0 rounded-xl border border-white/[0.08] bg-black/15 p-1">
              {periodOptions.map(option => (
                <button key={option.value} type="button" onClick={() => setPeriod(option.value)} className={`rounded-lg px-3 py-2 text-[11px] font-medium transition-colors ${period === option.value ? 'bg-white text-zinc-950' : 'text-zinc-400 hover:text-white'}`}>
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <section className="overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-br from-[#252334] via-[#1b1c29] to-[#141820] p-5 sm:p-7">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs text-zinc-400">{selectedHabitName} · últimos {period} dias</p>
                <p className="mt-2 text-4xl font-semibold tracking-[-0.05em] text-white sm:text-5xl">{summary.relapseEvents}</p>
                <p className="mt-1 text-xs text-zinc-400">{summary.relapseEvents === 1 ? 'recaída registrada' : 'recaídas registradas'}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:min-w-[260px]">
                <div className="rounded-2xl border border-white/[0.08] bg-black/15 p-3">
                  <p className="text-[10px] text-zinc-500">Resistências</p>
                  <p className="mt-1 text-2xl font-semibold text-emerald-100">{summary.resistanceEvents}</p>
                </div>
                <div className="rounded-2xl border border-white/[0.08] bg-black/15 p-3">
                  <p className="text-[10px] text-zinc-500">Registros com anotação</p>
                  <p className="mt-1 text-2xl font-semibold text-white">{summary.noteCount}</p>
                </div>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label="Taxa de resistência" value={summary.resistanceRate === null ? '—' : `${summary.resistanceRate}%`} detail="Entre registros conclusivos" tone="green" />
            <Metric label="Taxa de recaída" value={summary.relapseRate === null ? '—' : `${summary.relapseRate}%`} detail="Entre registros conclusivos" tone="rose" />
            <Metric label="Dias com resistência" value={String(summary.resistanceDays)} detail={selectedHabitId === 'all' ? 'Cada acompanhamento é contado separadamente.' : 'Datas com resistência registrada.'} tone="green" />
            <Metric label="Dias com recaída" value={String(summary.relapseDays)} detail={selectedHabitId === 'all' ? 'Cada acompanhamento é contado separadamente.' : 'Datas com recaída registrada.'} tone="rose" />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <section className="rounded-3xl border border-white/[0.07] bg-[#141820] p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-white">O que costuma vir antes</h3>
                  <p className="mt-1 text-xs text-zinc-500">Situações e sentimentos informados nos registros.</p>
                </div>
                <Activity size={17} className="text-zinc-500" />
              </div>
              {selectedHabitId === 'all' && summary.relapseByHabitDistribution.length > 0 && (
                <div className="mt-5">
                  <PatternList title="Comportamentos com recaída" items={summary.relapseByHabitDistribution} />
                </div>
              )}
              {summary.hasEnoughPatternData ? (
                <div className="mt-5 space-y-4">
                  <PatternList title="Gatilhos informados" items={summary.triggerDistribution} />
                  <PatternList title="Como você se sentia" items={summary.emotionDistribution} />
                  <PatternList title="Onde estava" items={summary.environmentDistribution} />
                  <PatternList title="Atividade informada" items={summary.precedingActivityDistribution} />
                  <div className="border-t border-white/[0.06] pt-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400">Atividade registrada no DUDE</p>
                    <p className="mt-1 text-[10px] text-zinc-600">Sessão em andamento ou concluída até 4 horas antes de cada recaída.</p>
                    {summary.recordedSessionContextSample > 0 ? (
                      <div className="mt-3 space-y-3">
                        <PatternList title="Atividades" items={summary.recordedActivityBeforeRelapseDistribution} />
                        <PatternList title="Projetos" items={summary.recordedProjectBeforeRelapseDistribution} />
                        <p className="text-[10px] text-zinc-600">Encontramos uma sessão próxima em {summary.recordedSessionContextSample} recaídas. Proximidade no tempo não significa que a atividade causou o episódio.</p>
                      </div>
                    ) : (
                      <p className="mt-3 text-[11px] leading-relaxed text-zinc-500">Não encontramos sessões concluídas nas 4 horas anteriores às recaídas deste período.</p>
                    )}
                  </div>
                  <p className="text-[10px] text-zinc-600">Considera {summary.patternSample} recaídas registradas. Um fator que aparece junto de uma recaída não significa, por si só, que a causou.</p>
                </div>
              ) : (
                <>
                  <SampleNotice count={summary.patternSample} />
                  {summary.recordedSessionContextSample > 0 && (
                    <div className="mt-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400">Sessões próximas às recaídas</p>
                      <p className="mt-1 text-[10px] text-zinc-600">Sessões em andamento ou concluídas até 4 horas antes.</p>
                      <div className="mt-3 space-y-3">
                        <PatternList title="Atividades" items={summary.recordedActivityBeforeRelapseDistribution} />
                        <PatternList title="Projetos" items={summary.recordedProjectBeforeRelapseDistribution} />
                      </div>
                      <p className="mt-3 text-[10px] text-zinc-600">Encontramos uma sessão próxima em {summary.recordedSessionContextSample} recaídas. Isso mostra proximidade no tempo, não uma causa.</p>
                    </div>
                  )}
                </>
              )}
            </section>

            <section className="rounded-3xl border border-white/[0.07] bg-[#141820] p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-white">Quando acontece</h3>
                  <p className="mt-1 text-xs text-zinc-500">Distribuição por horário e dia da semana.</p>
                </div>
                <CalendarDays size={17} className="text-zinc-500" />
              </div>
              {summary.hasEnoughPatternData ? (
                <div className="mt-5 space-y-3">
                  <div className="rounded-2xl bg-white/[0.03] p-4">
                    <p className="text-[10px] uppercase tracking-[0.12em] text-zinc-500">Período mais frequente</p>
                    <p className="mt-2 text-lg font-semibold text-white">{summary.strongestRelapsePeriod || 'Sem predominância'}</p>
                  </div>
                  <div className="rounded-2xl bg-white/[0.03] p-4">
                    <p className="text-[10px] uppercase tracking-[0.12em] text-zinc-500">Dia mais frequente</p>
                    <p className="mt-2 text-lg font-semibold capitalize text-white">{summary.strongestRelapseWeekday || 'Sem predominância'}</p>
                  </div>
                  <p className="text-[10px] text-zinc-600">Usamos a data e a hora informadas para o acontecimento. Registros antigos sem esse campo usam o horário em que foram gravados.</p>
                </div>
              ) : (
                <SampleNotice count={summary.patternSample} />
              )}
            </section>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <section className="rounded-3xl border border-white/[0.07] bg-[#141820] p-5 sm:p-6">
              <h3 className="text-sm font-semibold text-white">O que ajudou você</h3>
              <p className="mt-1 text-xs text-zinc-500">Estratégias que você marcou quando conseguiu interromper o impulso.</p>
              {resistanceActions.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {resistanceActions.slice(0, 4).map(([action, count]) => (
                    <div key={action} className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.03] px-3 py-3">
                      <span className="text-xs text-zinc-300">{action}</span>
                      <span className="text-xs font-semibold tabular-nums text-emerald-200">{count} {count === 1 ? 'vez' : 'vezes'}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 rounded-xl bg-white/[0.025] p-4 text-xs leading-relaxed text-zinc-500">Ainda não há estratégias registradas. Ao marcar uma resistência, indique o que ajudou naquele momento.</p>
              )}
            </section>

            <section className="rounded-3xl border border-white/[0.07] bg-[#141820] p-5 sm:p-6">
              <h3 className="text-sm font-semibold text-white">Intensidade da vontade</h3>
              <p className="mt-1 text-xs text-zinc-500">Média informada nos registros deste período.</p>
              {summary.averageUrgeIntensity !== null ? (
                <div className="mt-5">
                  <div className="flex items-end justify-between">
                    <p className="text-4xl font-semibold text-white">{summary.averageUrgeIntensity}<span className="ml-1 text-base text-zinc-500">/10</span></p>
                    <p className="text-[10px] text-zinc-500">Escala pessoal</p>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.07]">
                    <div className="h-full rounded-full bg-violet-200" style={{ width: `${summary.averageUrgeIntensity * 10}%` }} />
                  </div>
                </div>
              ) : (
                <p className="mt-4 rounded-xl bg-white/[0.025] p-4 text-xs leading-relaxed text-zinc-500">A intensidade ainda não foi informada nos registros deste período.</p>
              )}
            </section>
          </div>

          <section className="rounded-3xl border border-violet-200/10 bg-violet-200/[0.045] p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-200/10 text-violet-100"><Activity size={17} /></div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-100/70">O que os registros mostram</p>
                {summary.hasEnoughPatternData && summary.topRelapseTrigger ? (
                  <>
                    <h3 className="mt-2 text-base font-semibold text-white">“{summary.topRelapseTrigger.label}” aparece com mais frequência.</h3>
                    <p className="mt-2 text-xs leading-relaxed text-zinc-400">Esse contexto apareceu em {summary.topRelapseTrigger.count} de {summary.relapseEvents} recaídas registradas. Trate isso como uma hipótese para observar, não como uma explicação definitiva.</p>
                  </>
                ) : (
                  <>
                    <h3 className="mt-2 text-base font-semibold text-white">Ainda não há amostra suficiente para apontar um padrão.</h3>
                    <p className="mt-2 text-xs leading-relaxed text-zinc-400">Mostramos padrões quando há pelo menos 3 recaídas em 2 dias diferentes. Antes disso, exibimos apenas os registros.</p>
                  </>
                )}
                {summary.relapseRateChange !== null && (
                  <p className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-zinc-300">
                    {summary.relapseRateChange <= 0 ? <TrendingDown size={13} className="text-emerald-200" /> : <TrendingUp size={13} className="text-rose-200" />}
                    Taxa de recaída {summary.relapseRateChange === 0 ? 'estável' : `${Math.abs(summary.relapseRateChange)} pontos percentuais ${summary.relapseRateChange < 0 ? 'menor' : 'maior'}`} que no período anterior.
                  </p>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-white/[0.07] bg-[#141820] p-5 sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-white">Registros e anotações</h3>
                <p className="mt-1 text-xs text-zinc-500">Consulte, edite ou remova seus registros.</p>
              </div>
              <span className="rounded-full bg-white/[0.05] px-2.5 py-1 text-[10px] text-zinc-400">{summary.totalEvents} registros</span>
            </div>
            {summary.recentEvents.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/[0.09] px-4 py-9 text-center">
                <FileText size={20} className="mx-auto text-zinc-600" />
                <p className="mt-3 text-xs text-zinc-500">Nenhum registro encontrado neste período.</p>
                <button type="button" onClick={openNewEvent} className="mt-4 text-xs font-semibold text-emerald-200 hover:text-white">Criar primeiro registro</button>
              </div>
            ) : (
              <div className="space-y-2">
                {summary.recentEvents.map(event => {
                  const meta = statusMeta(event.status);
                  const StatusIcon = meta.icon;
                  const habitName = avoidHabits.find(habit => habit.id === event.habit_id)?.name || 'Acompanhamento removido';
                  return (
                    <article key={event.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium ${meta.className}`}><StatusIcon size={11} />{meta.label}</span>
                            <span className="text-[10px] text-zinc-500">{formatEventDate(event)}</span>
                          </div>
                          <p className="mt-2 truncate text-xs font-semibold text-white">{habitName}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <button type="button" onClick={() => openEditEvent(event)} aria-label="Editar registro" className="rounded-lg p-2 text-zinc-500 hover:bg-white/[0.06] hover:text-white"><Pencil size={14} /></button>
                          <button type="button" onClick={() => setDeleteTarget(event.id)} aria-label="Excluir registro" className="rounded-lg p-2 text-zinc-500 hover:bg-rose-300/10 hover:text-rose-200"><Trash2 size={14} /></button>
                        </div>
                      </div>
                      {(event.trigger_tag || event.emotion_tag || event.environment_tag || event.urge_intensity) && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {event.trigger_tag && <Tag>{event.trigger_tag}</Tag>}
                          {event.emotion_tag && <Tag>{event.emotion_tag}</Tag>}
                          {event.environment_tag && <Tag>{event.environment_tag}</Tag>}
                          {event.urge_intensity && <Tag>Intensidade {event.urge_intensity}/10</Tag>}
                        </div>
                      )}
                      {event.preceding_activity && <p className="mt-3 text-[11px] leading-relaxed text-zinc-400">Antes: {event.preceding_activity}</p>}
                      {event.recovery_action && <p className="mt-2 text-[11px] leading-relaxed text-emerald-100/80">Ajudou: {event.recovery_action}</p>}
                      {event.trigger_note && <p className="mt-3 whitespace-pre-wrap border-t border-white/[0.05] pt-3 text-xs leading-relaxed text-zinc-300">{event.trigger_note}</p>}
                      {!event.trigger_note && <p className="mt-3 text-[10px] text-zinc-600">Sem anotação adicional.</p>}
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <div className="flex items-start gap-2 px-1 text-[10px] leading-relaxed text-zinc-600">
            <AlertCircle size={13} className="mt-0.5 shrink-0" />
            <p>Os resultados mostram apenas o que foi registrado. O DUDE não faz diagnósticos nem substitui acompanhamento profissional.</p>
          </div>
        </>
      )}

      <AnimatePresence>
        {isFormOpen && (
          <div className="fixed inset-0 z-[1400] flex items-center justify-center bg-black/80 p-3 backdrop-blur-md sm:p-5" onClick={() => !saving && setIsFormOpen(false)}>
            <motion.form
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              onSubmit={saveEvent}
              onClick={event => event.stopPropagation()}
              className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#171b23] shadow-2xl"
            >
              <header className="flex items-start justify-between gap-4 border-b border-white/[0.07] p-5">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-200">Registro pessoal</p>
                  <h3 className="mt-1 text-lg font-semibold text-white">{editingEventId ? 'Editar acontecimento' : 'O que aconteceu?'}</h3>
                  <p className="mt-1 text-xs text-zinc-500">Registre apenas o que você sabe. O restante pode ficar em branco.</p>
                </div>
                <button type="button" onClick={() => setIsFormOpen(false)} disabled={saving} className="rounded-full p-2 text-zinc-500 hover:bg-white/[0.06] hover:text-white"><X size={18} /></button>
              </header>
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
                <div>
                  <FieldLabel>Comportamento</FieldLabel>
                  <select value={form.habitId} onChange={event => setForm(current => ({ ...current, habitId: event.target.value }))} className={selectClass} required>
                    {avoidHabits.map(habit => <option key={habit.id} value={habit.id}>{habit.name}</option>)}
                  </select>
                </div>
                <div>
                  <FieldLabel>Quando aconteceu?</FieldLabel>
                  <input type="datetime-local" value={form.occurredAt} onChange={event => setForm(current => ({ ...current, occurredAt: event.target.value }))} className={inputClass} required />
                </div>
                <div>
                  <FieldLabel>Como terminou este episódio?</FieldLabel>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { value: 'relapse', label: 'Recaída', tone: 'rose' },
                      { value: 'success', label: 'Resisti', tone: 'green' },
                      { value: 'pending', label: 'Adiei', tone: 'neutral' }
                    ] as const).map(option => (
                      <button key={option.value} type="button" onClick={() => setForm(current => ({ ...current, status: option.value }))} className={`rounded-xl border px-2 py-3 text-[11px] font-semibold transition-colors ${form.status === option.value ? option.tone === 'rose' ? 'border-rose-200/40 bg-rose-200/10 text-rose-100' : option.tone === 'green' ? 'border-emerald-200/40 bg-emerald-200/10 text-emerald-100' : 'border-white/30 bg-white/10 text-white' : 'border-white/[0.07] bg-white/[0.025] text-zinc-500 hover:text-zinc-200'}`}>
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <FieldLabel>O que veio antes?</FieldLabel>
                    <select value={form.triggerTag} onChange={event => setForm(current => ({ ...current, triggerTag: event.target.value }))} className={selectClass}>
                      <option value="">Não identificado</option>
                      {triggerOptions.map(option => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </div>
                  <div>
                    <FieldLabel>Como você estava se sentindo?</FieldLabel>
                    <select value={form.emotionTag} onChange={event => setForm(current => ({ ...current, emotionTag: event.target.value }))} className={selectClass}>
                      <option value="">Não informado</option>
                      {emotionOptions.map(option => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </div>
                  <div>
                    <FieldLabel>Onde ou com quem?</FieldLabel>
                    <select value={form.environmentTag} onChange={event => setForm(current => ({ ...current, environmentTag: event.target.value }))} className={selectClass}>
                      <option value="">Não informado</option>
                      {environmentOptions.map(option => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </div>
                  <div>
                    <FieldLabel>O que fazia antes?</FieldLabel>
                    <input value={form.precedingActivity} onChange={event => setForm(current => ({ ...current, precedingActivity: event.target.value }))} placeholder="Ex.: navegando no celular" className={inputClass} maxLength={120} />
                  </div>
                </div>
                <div className="rounded-2xl bg-white/[0.025] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <FieldLabel>Intensidade do impulso</FieldLabel>
                    <span className="text-sm font-semibold tabular-nums text-white">{form.urgeIntensity}/10</span>
                  </div>
                  <input type="range" min="1" max="10" step="1" value={form.urgeIntensity} onChange={event => setForm(current => ({ ...current, urgeIntensity: Number(event.target.value) }))} className="mt-2 w-full accent-violet-200" />
                  <div className="mt-1 flex justify-between text-[9px] text-zinc-600"><span>Leve</span><span>Muito intenso</span></div>
                </div>
                {form.status === 'success' && (
                  <div>
                    <FieldLabel>O que ajudou você?</FieldLabel>
                    <select value={form.recoveryAction} onChange={event => setForm(current => ({ ...current, recoveryAction: event.target.value }))} className={selectClass}>
                      {recoveryOptions.map(option => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <FieldLabel>Anotação livre</FieldLabel>
                  <textarea value={form.note} onChange={event => setForm(current => ({ ...current, note: event.target.value }))} rows={4} maxLength={2000} placeholder="O que aconteceu? O que você percebeu? O que gostaria de fazer diferente na próxima vez?" className={`${inputClass} resize-y leading-relaxed`} />
                  <p className="mt-1 text-right text-[9px] text-zinc-600">{form.note.length}/2000</p>
                </div>
              </div>
              <footer className="flex justify-end gap-2 border-t border-white/[0.07] p-4">
                <button type="button" onClick={() => setIsFormOpen(false)} disabled={saving} className="rounded-xl px-4 py-3 text-xs font-medium text-zinc-400 hover:bg-white/[0.05]">Cancelar</button>
                <button type="submit" disabled={saving || !form.habitId || !form.status} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-xs font-semibold text-zinc-950 disabled:opacity-50"><Check size={14} />{saving ? 'Salvando…' : 'Salvar registro'}</button>
              </footer>
            </motion.form>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteTarget && (
          <div className="fixed inset-0 z-[1500] flex items-center justify-center bg-black/75 p-4" onClick={() => !saving && setDeleteTarget(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} onClick={event => event.stopPropagation()} className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#1b2029] p-5">
              <div className="flex items-center gap-2 text-rose-200"><AlertCircle size={17} /><h4 className="text-sm font-semibold text-white">Excluir este registro?</h4></div>
              <p className="mt-2 text-xs leading-relaxed text-zinc-400">Esta ação remove o acontecimento e suas anotações do histórico. Não é possível desfazer.</p>
              <div className="mt-5 flex justify-end gap-2">
                <button type="button" onClick={() => setDeleteTarget(null)} disabled={saving} className="rounded-xl px-3 py-2 text-xs text-zinc-400 hover:bg-white/[0.05]">Cancelar</button>
                <button type="button" onClick={confirmDelete} disabled={saving} className="rounded-xl bg-rose-300 px-3 py-2 text-xs font-semibold text-zinc-950 disabled:opacity-50">{saving ? 'Excluindo…' : 'Excluir registro'}</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const Metric = ({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: 'green' | 'rose' }) => (
  <div className="rounded-2xl border border-white/[0.07] bg-white/[0.035] p-4">
    <p className="text-[10px] leading-relaxed text-zinc-500">{label}</p>
    <p className={`mt-2 text-2xl font-semibold tracking-tight ${tone === 'green' ? 'text-emerald-100' : 'text-rose-100'}`}>{value}</p>
    <p className="mt-1 text-[9px] leading-relaxed text-zinc-600">{detail}</p>
  </div>
);

const PatternList = ({ title, items }: { title: string; items: Array<{ label: string; count: number; share: number }> }) => (
  <div>
    <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">{title}</p>
    {items.length === 0 ? <p className="text-[11px] text-zinc-600">Nenhuma categoria identificada.</p> : (
      <div className="space-y-2">
        {items.slice(0, 3).map(item => (
          <div key={item.label}>
            <div className="mb-1 flex items-center justify-between gap-3 text-[11px]">
              <span className="truncate text-zinc-300">{item.label}</span>
              <span className="shrink-0 tabular-nums text-zinc-500">{item.count} · {item.share}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full bg-violet-200/70" style={{ width: `${item.share}%` }} /></div>
          </div>
        ))}
      </div>
    )}
  </div>
);

const SampleNotice = ({ count }: { count: number }) => (
  <div className="mt-5 rounded-2xl bg-white/[0.025] p-4">
    <div className="flex items-center gap-2 text-zinc-300"><Activity size={15} /><span className="text-xs font-medium">Ainda não há dados suficientes</span></div>
    <p className="mt-2 text-xs leading-relaxed text-zinc-500">Há {count} {count === 1 ? 'recaída registrada' : 'recaídas registradas'} neste período. Mostraremos situações recorrentes quando houver pelo menos 3 registros em 2 dias diferentes.</p>
  </div>
);

const Tag = ({ children }: { children: React.ReactNode }) => <span className="rounded-full border border-white/[0.07] bg-white/[0.04] px-2 py-1 text-[9px] text-zinc-400">{children}</span>;
