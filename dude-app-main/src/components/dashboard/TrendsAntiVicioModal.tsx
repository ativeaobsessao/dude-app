import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X, Pencil, Trash2, Check, FileText, AlertCircle } from 'lucide-react';
import { useDataStore } from '../../store/useDataStore';
import { normalizeAvoidanceStatus } from '../../lib/avoidanceMetrics';

interface TrendsAntiVicioModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const formatDate = (dateValue?: string | null, createdAt?: string | null) => {
  const key = dateValue?.slice(0, 10);
  if (key && /^\d{4}-\d{2}-\d{2}$/.test(key)) {
    return new Date(`${key}T12:00:00`).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }
  return createdAt ? new Date(createdAt).toLocaleDateString('pt-BR') : 'Data não informada';
};

const statusLabel = (status: string) => {
  const normalized = normalizeAvoidanceStatus(status);
  if (normalized === 'success') return 'Resistência';
  if (normalized === 'relapse') return 'Recaída';
  return 'Adiado';
};

export const TrendsAntiVicioModal: React.FC<TrendsAntiVicioModalProps> = ({ isOpen, onClose }) => {
  const avoidanceCheckins = useDataStore(state => state.avoidanceCheckins);
  const habits = useDataStore(state => state.habits);
  const updateAvoidanceCheckin = useDataStore(state => state.updateAvoidanceCheckin);
  const showNotification = useDataStore(state => state.showNotification);

  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const notes = useMemo(() => {
    return avoidanceCheckins
      .filter(checkin => {
        const note = checkin.trigger_note?.trim();
        if (!note) return false;
        return note !== '[SESSÃO PROFUNDA GUIADA] Resisti com a Sessão Profunda Guiada.';
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [avoidanceCheckins]);

  const saveNote = async (id: string) => {
    if (savingId) return;
    setSavingId(id);
    const updated = await updateAvoidanceCheckin(id, {
      trigger_note: editingNoteText.trim() || null
    });
    setSavingId(null);

    if (!updated) {
      showNotification('Não foi possível salvar a anotação. Tente novamente.', 'error');
      return;
    }

    setEditingNoteId(null);
    setEditingNoteText('');
    showNotification('Anotação atualizada.', 'success');
  };

  const confirmDelete = async () => {
    if (!deleteTarget || deletingId) return;
    setDeletingId(deleteTarget);
    const deleted = await updateAvoidanceCheckin(deleteTarget, { trigger_note: null });
    setDeletingId(null);

    if (!deleted) {
      showNotification('Não foi possível excluir a anotação. Tente novamente.', 'error');
      return;
    }

    setDeleteTarget(null);
    if (editingNoteId === deleteTarget) {
      setEditingNoteId(null);
      setEditingNoteText('');
    }
    showNotification('Anotação removida. O check-in foi mantido.', 'success');
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
        onClick={onClose}
      >
        <motion.section
          initial={{ opacity: 0, y: 14, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 14, scale: 0.98 }}
          onClick={event => event.stopPropagation()}
          className="relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#111315] text-left shadow-2xl"
          aria-label="Anotações de autocontrole"
        >
          <header className="flex items-start justify-between gap-4 border-b border-white/10 p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/[0.06] text-zinc-200">
                <FileText size={19} />
              </span>
              <div>
                <h3 className="text-lg font-semibold tracking-tight text-white">Anotações de autocontrole</h3>
                <p className="mt-1 max-w-md text-xs leading-relaxed text-zinc-400">
                  Registros que você escolheu guardar durante o acompanhamento.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar anotações"
              className="rounded-full p-2 text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X size={18} />
            </button>
          </header>

          <div className="flex items-center justify-between border-b border-white/5 px-5 py-3 sm:px-6">
            <span className="text-xs text-zinc-400">
              {notes.length} {notes.length === 1 ? 'anotação salva' : 'anotações salvas'}
            </span>
            <span className="text-[10px] text-zinc-500">Mais recentes primeiro</span>
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5 sm:p-6">
            {notes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-center">
                <FileText size={30} className="text-zinc-600" />
                <h4 className="mt-4 text-sm font-semibold text-zinc-200">Ainda não há anotações</h4>
                <p className="mt-2 max-w-sm text-xs leading-relaxed text-zinc-500">
                  Quando você registrar uma observação durante um check-in, ela aparecerá aqui para consultar e editar.
                </p>
              </div>
            ) : notes.map(checkin => {
              const habit = habits.find(item => item.id === checkin.habit_id);
              const isEditing = editingNoteId === checkin.id;
              const status = normalizeAvoidanceStatus(checkin.status);

              return (
                <article key={checkin.id} className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">{habit?.name || 'Controle removido'}</p>
                      <p className="mt-1 text-[11px] text-zinc-500">{formatDate(checkin.checkin_date, checkin.created_at)}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${
                      status === 'success'
                        ? 'bg-emerald-400/10 text-emerald-200'
                        : status === 'relapse'
                          ? 'bg-orange-400/10 text-orange-200'
                          : 'bg-white/10 text-zinc-300'
                    }`}>
                      {statusLabel(checkin.status)}
                    </span>
                  </div>

                  {checkin.trigger_tag && checkin.trigger_tag !== 'none' && (
                    <p className="mt-3 text-xs text-zinc-400">Contexto: {checkin.trigger_tag}</p>
                  )}

                  {isEditing ? (
                    <div className="mt-3 space-y-3">
                      <textarea
                        value={editingNoteText}
                        onChange={event => setEditingNoteText(event.target.value)}
                        rows={4}
                        autoFocus
                        className="w-full resize-y rounded-xl border border-white/10 bg-black/30 p-3 text-sm leading-relaxed text-white outline-none focus:border-emerald-300/40"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingNoteId(null);
                            setEditingNoteText('');
                          }}
                          className="rounded-xl px-3 py-2 text-xs text-zinc-400 hover:bg-white/5"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          disabled={savingId === checkin.id}
                          onClick={() => saveNote(checkin.id)}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-300 px-3 py-2 text-xs font-semibold text-black disabled:opacity-50"
                        >
                          <Check size={13} />
                          {savingId === checkin.id ? 'Salvando…' : 'Salvar'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-zinc-200">
                        {checkin.trigger_note}
                      </p>
                      <div className="mt-4 flex items-center justify-end gap-2 border-t border-white/5 pt-3">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingNoteId(checkin.id);
                            setEditingNoteText(checkin.trigger_note || '');
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs text-zinc-400 hover:bg-white/5 hover:text-white"
                        >
                          <Pencil size={13} />
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(checkin.id)}
                          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs text-zinc-400 hover:bg-red-400/10 hover:text-red-200"
                        >
                          <Trash2 size={13} />
                          Excluir
                        </button>
                      </div>
                    </>
                  )}
                </article>
              );
            })}
          </div>
        </motion.section>

        <AnimatePresence>
          {deleteTarget && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[1210] flex items-center justify-center bg-black/75 p-4"
              onClick={event => { event.stopPropagation(); setDeleteTarget(null); }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                onClick={event => event.stopPropagation()}
                className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#1a1d1f] p-5"
              >
                <div className="flex items-center gap-2 text-orange-200">
                  <AlertCircle size={18} />
                  <h4 className="text-sm font-semibold">Remover anotação?</h4>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                  A anotação será removida, mas o registro de resistência ou recaída permanecerá no histórico.
                </p>
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(null)}
                    disabled={!!deletingId}
                    className="rounded-xl px-3 py-2 text-xs text-zinc-300 hover:bg-white/5"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={confirmDelete}
                    disabled={!!deletingId}
                    className="rounded-xl bg-orange-500 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    {deletingId ? 'Excluindo…' : 'Excluir'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
};
