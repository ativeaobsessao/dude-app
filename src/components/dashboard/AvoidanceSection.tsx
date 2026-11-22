import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Brain, Plus, Pencil, Trash2, Shield, X, Clock3, CheckCircle2, AlertCircle, FileText } from 'lucide-react';
import { useDataStore } from '../../store/useDataStore';
import type { AvoidanceCheckin, Habit } from '../../types';
import { calculateAvoidanceMetrics, normalizeAvoidanceStatus } from '../../lib/avoidanceMetrics';
import { AntiVicioModal } from './AntiVicioModal';

interface AvoidanceCardProps {
  habit: Habit;
  metrics: ReturnType<typeof calculateAvoidanceMetrics>;
  onEdit: (habit: Habit) => void;
  onDelete: (id: string, name: string) => void;
  onStartSupport: (habitId: string) => void;
}

const AvoidanceCard = ({ habit, metrics, onEdit, onDelete, onStartSupport }: AvoidanceCardProps) => {
  const recordLabel = metrics.isWindow ? 'Recorde de períodos consecutivos' : 'Recorde de dias consecutivos';
  const currentLabel = metrics.isWindow ? 'períodos seguidos' : 'dias seguidos';

  return (
    <article className="rounded-[28px] border border-white/10 bg-zinc-950/40 p-6 sm:p-8 flex flex-col justify-between gap-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 text-left">
          <p className="text-4xl sm:text-5xl font-light tracking-tight text-white tabular-nums">
            {metrics.bestStreak}
          </p>
          <p className="mt-1 text-xs text-zinc-400">{recordLabel}</p>
          <h3 className="mt-3 text-base font-semibold text-white break-words">{habit.name}</h3>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => onEdit(habit)}
            aria-label={`Editar ${habit.name}`}
            title="Editar"
            className="rounded-full p-2 text-white/50 hover:bg-white/10 hover:text-white transition-colors"
          >
            <Pencil size={16} />
          </button>
          <button
            type="button"
            onClick={() => onDelete(habit.id, habit.name)}
            aria-label={`Excluir ${habit.name}`}
            title="Excluir"
            className="rounded-full p-2 text-white/50 hover:bg-red-500/10 hover:text-red-300 transition-colors"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-4">
          <span className="text-xs text-zinc-400">Sequência atual</span>
          <strong className="text-sm font-semibold text-white tabular-nums">
            {metrics.currentStreak} {currentLabel}
          </strong>
        </div>
        {!metrics.hasAnyData && (
          <p className="text-xs leading-relaxed text-zinc-500">
            O recorde começa no primeiro dia com resistência registrada. Dias sem registro não são presumidos.
          </p>
        )}
        {metrics.lastRelapseDate && (
          <p className="text-xs text-zinc-500">
            Última recaída registrada: {new Date(`${metrics.lastRelapseDate}T12:00:00`).toLocaleDateString('pt-BR')}
          </p>
        )}
        <button
          type="button"
          onClick={() => onStartSupport(habit.id)}
          className="w-full min-h-12 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm font-semibold text-emerald-200 hover:bg-emerald-400/15 transition-colors flex items-center justify-center gap-2"
        >
          <Shield size={16} />
          Preciso de apoio
        </button>
      </div>
    </article>
  );
};

const formatCheckinDate = (checkin: AvoidanceCheckin) => {
  const key = checkin.checkin_date?.slice(0, 10);
  if (key && /^\d{4}-\d{2}-\d{2}$/.test(key)) {
    return new Date(`${key}T12:00:00`).toLocaleDateString('pt-BR');
  }
  return checkin.created_at
    ? new Date(checkin.created_at).toLocaleDateString('pt-BR')
    : 'Data não informada';
};

const getStatusLabel = (status: string) => {
  const normalized = normalizeAvoidanceStatus(status);
  if (normalized === 'success') return 'Resistiu';
  if (normalized === 'relapse') return 'Recaída';
  return 'Adiado';
};

export const AvoidanceSection = () => {
  const habits = useDataStore(state => state.habits);
  const avoidanceCheckins = useDataStore(state => state.avoidanceCheckins);
  const deleteAvoidanceHabit = useDataStore(state => state.deleteAvoidanceHabit);
  const showNotification = useDataStore(state => state.showNotification);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [supportHabitId, setSupportHabitId] = useState<string | undefined>();
  const [showHistory, setShowHistory] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const avoidHabits = useMemo(
    () => habits.filter(habit => habit.habit_mode === 'avoid'),
    [habits]
  );

  const history = useMemo(
    () => [...avoidanceCheckins].sort((a, b) => {
      const aDate = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bDate = b.created_at ? new Date(b.created_at).getTime() : 0;
      return bDate - aDate;
    }),
    [avoidanceCheckins]
  );

  useEffect(() => {
    const openHistory = () => setShowHistory(true);
    window.addEventListener('open-avoidance-history', openHistory);
    return () => window.removeEventListener('open-avoidance-history', openHistory);
  }, []);

  const openCreate = () => {
    window.dispatchEvent(new CustomEvent('open-action-center', {
      detail: { screen: 'anti-vicio' }
    }));
  };

  const openEdit = (habit: Habit) => {
    window.dispatchEvent(new CustomEvent('open-action-center', {
      detail: { screen: 'anti-vicio', editHabit: habit }
    }));
  };

  const confirmDelete = async () => {
    if (!deleteTarget || isDeleting) return;
    setIsDeleting(true);
    const success = await deleteAvoidanceHabit(deleteTarget.id);
    setIsDeleting(false);
    if (success) {
      showNotification('Controle removido.', 'success');
      setDeleteTarget(null);
    } else {
      showNotification('Não foi possível remover o controle. Tente novamente.', 'error');
    }
  };

  const startSupport = (habitId: string) => {
    setSupportHabitId(habitId);
    setIsSupportOpen(true);
  };

  const totalSuccesses = history.filter(item => normalizeAvoidanceStatus(item.status) === 'success').length;
  const totalRelapses = history.filter(item => normalizeAvoidanceStatus(item.status) === 'relapse').length;
  const notes = history.filter(item => item.trigger_note?.trim());

  return (
    <section id="avoidance-section" className="w-full max-w-5xl space-y-4">
      <button
        type="button"
        onClick={() => setIsExpanded(value => !value)}
        aria-expanded={isExpanded}
        className="w-full rounded-3xl border border-border-white bg-surface/20 p-5 sm:p-6 flex items-center justify-between gap-4 hover:bg-surface/35 transition-colors"
      >
        <span className="flex items-center gap-4 text-left">
          <span className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-text-secondary">
            <Brain size={18} />
          </span>
          <span>
            <span className="block text-base font-semibold text-text-primary">Autocontrole</span>
            <span className="mt-0.5 block text-xs text-text-secondary/60">
              {avoidHabits.length} {avoidHabits.length === 1 ? 'comportamento acompanhado' : 'comportamentos acompanhados'}
            </span>
          </span>
        </span>
        <span className={`text-text-secondary/50 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
          <Clock3 size={18} />
        </span>
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="rounded-3xl border border-border-white bg-surface/20 p-5 sm:p-6 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-5">
                <p className="max-w-xl text-sm leading-relaxed text-text-secondary/70">
                  Acompanhe seus registros de resistência e recaída, sem estimativas automáticas.
                </p>
                <button
                  type="button"
                  onClick={openCreate}
                  className="inline-flex items-center gap-2 rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-xs font-semibold text-emerald-200 hover:bg-emerald-300/15 transition-colors"
                >
                  <Plus size={14} />
                  Adicionar controle
                </button>
              </div>

              {avoidHabits.length === 0 ? (
                <div className="rounded-2xl border border-white/5 bg-white/[0.02] px-6 py-10 text-center space-y-4">
                  <Brain size={30} className="mx-auto text-text-secondary/30" />
                  <p className="mx-auto max-w-md text-sm leading-relaxed text-text-secondary/60">
                    Você ainda não acompanha nenhum comportamento. Adicione um controle para começar a registrar seus avanços.
                  </p>
                  <button
                    type="button"
                    onClick={openCreate}
                    className="rounded-full bg-primary-green px-5 py-3 text-xs font-semibold text-background"
                  >
                    Criar primeiro controle
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {avoidHabits.map(habit => (
                    <AvoidanceCard
                      key={habit.id}
                      habit={habit}
                      metrics={calculateAvoidanceMetrics(habit, avoidanceCheckins)}
                      onEdit={openEdit}
                      onDelete={(id, name) => setDeleteTarget({ id, name })}
                      onStartSupport={startSupport}
                    />
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/5 pt-5">
                <div className="flex items-center gap-4 text-xs text-text-secondary/70">
                  <span className="inline-flex items-center gap-1.5"><CheckCircle2 size={14} className="text-emerald-300" /> {totalSuccesses} resistências</span>
                  <span className="inline-flex items-center gap-1.5"><AlertCircle size={14} className="text-orange-300" /> {totalRelapses} recaídas</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowHistory(true)}
                  className="inline-flex items-center gap-2 text-xs font-semibold text-text-primary/80 hover:text-primary-green transition-colors"
                >
                  <FileText size={14} />
                  Ver registros e anotações
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isSupportOpen && (
        <AntiVicioModal
          isOpen={true}
          initialHabitId={supportHabitId}
          isVictoryMode={false}
          onClose={() => {
            setIsSupportOpen(false);
            setSupportHabitId(undefined);
          }}
        />
      )}

      <AnimatePresence>
        {showHistory && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
            onClick={() => setShowHistory(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              onClick={event => event.stopPropagation()}
              className="relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#111315] text-left shadow-2xl"
            >
              <header className="flex items-center justify-between border-b border-white/10 p-5 sm:p-6">
                <div>
                  <h3 className="text-lg font-semibold text-white">Registros de autocontrole</h3>
                  <p className="mt-1 text-xs text-zinc-400">Consulte suas resistências, recaídas e anotações.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowHistory(false)}
                  aria-label="Fechar registros"
                  className="rounded-full p-2 text-zinc-400 hover:bg-white/10 hover:text-white"
                >
                  <X size={18} />
                </button>
              </header>

              <div className="grid grid-cols-2 gap-3 p-5 sm:px-6">
                <div className="rounded-2xl bg-white/[0.04] p-4">
                  <p className="text-xs text-zinc-400">Resistências registradas</p>
                  <p className="mt-1 text-2xl font-semibold text-emerald-300 tabular-nums">{totalSuccesses}</p>
                </div>
                <div className="rounded-2xl bg-white/[0.04] p-4">
                  <p className="text-xs text-zinc-400">Recaídas registradas</p>
                  <p className="mt-1 text-2xl font-semibold text-orange-300 tabular-nums">{totalRelapses}</p>
                </div>
              </div>

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 pb-6 sm:px-6">
                {history.length === 0 ? (
                  <div className="py-12 text-center text-sm text-zinc-500">
                    Seus registros aparecerão aqui depois do primeiro check-in.
                  </div>
                ) : history.map(checkin => {
                  const habit = avoidHabits.find(item => item.id === checkin.habit_id);
                  const note = checkin.trigger_note?.trim();
                  return (
                    <article key={checkin.id} className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-white">{habit?.name || 'Controle removido'}</p>
                          <p className="mt-1 text-[11px] text-zinc-500">{formatCheckinDate(checkin)}</p>
                        </div>
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                          normalizeAvoidanceStatus(checkin.status) === 'success'
                            ? 'bg-emerald-400/10 text-emerald-200'
                            : normalizeAvoidanceStatus(checkin.status) === 'relapse'
                              ? 'bg-orange-400/10 text-orange-200'
                              : 'bg-white/10 text-zinc-300'
                        }`}>
                          {getStatusLabel(checkin.status)}
                        </span>
                      </div>
                      {checkin.trigger_tag && checkin.trigger_tag !== 'none' && (
                        <p className="mt-3 text-xs text-zinc-400">Contexto: {checkin.trigger_tag}</p>
                      )}
                      {note && <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-200">{note}</p>}
                    </article>
                  );
                })}
                {notes.length > 0 && (
                  <p className="pt-1 text-[11px] text-zinc-500">
                    {notes.length} {notes.length === 1 ? 'anotação salva' : 'anotações salvas'} neste histórico.
                  </p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#17191b] p-6 text-center"
            >
              <Trash2 size={24} className="mx-auto text-orange-300" />
              <h3 className="mt-4 text-lg font-semibold text-white">Remover controle?</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                Ao remover <strong className="text-white">{deleteTarget.name}</strong>, os registros e anotações serão mantidos no histórico, mas ficarão sem vínculo com este controle.
              </p>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setDeleteTarget(null)}
                  className="rounded-xl border border-white/10 px-4 py-3 text-sm text-zinc-300 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={confirmDelete}
                  className="rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {isDeleting ? 'Removendo…' : 'Remover'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};
