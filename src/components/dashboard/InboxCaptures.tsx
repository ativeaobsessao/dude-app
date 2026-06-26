import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDataStore } from '../../store/useDataStore';
import { useAuthStore } from '../../store/useAuthStore';
import { Inbox, ArrowRightCircle, FileText, Trash2, X } from 'lucide-react';
import { InboxCapture } from '../../types';
import { getLocalDateString } from '../../lib/utils';

// Local CreateTaskModal to handle safe task conversion
const CreateTaskModal = ({ initialData, captureId, onClose }: { initialData: string; captureId: string; onClose: () => void }) => {
  const { user } = useAuthStore();
  const dataStore = useDataStore();
  const [activityAvulsa, setActivityAvulsa] = useState(`${initialData} #CAPTURAS #TAREFADODIA`);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      // Limpa as tags do texto para gerar um título amigável e seguro para a listagem
      const cleanTitle = activityAvulsa.replace(/#\w+/g, '').trim() || 'Nova Tarefa';

      await dataStore.addDailyTask({
        user_id: user.id,
        task_date: getLocalDateString(new Date()),
        title: cleanTitle, // Título limpo e real da captura
        activity_avulsa: activityAvulsa, // Mantém a string completa com as tags para o processador do app
        project_id: null,
        habit_id: null,
        activity_id: null,
        checklist: [], // Array vazio defensivo em vez de null para evitar quebra de .length ou .map
        is_completed: false,
        completed_at: null,
        rolled_from_date: null,
        // Propriedades defensivas extras caso sua listagem exija fallbacks:
        description: '',
        notes: '',
        priority: 'normal',
        order: 0
      });

      await dataStore.deleteInboxCapture(captureId);
      
      // Força a atualização dos dados locais do Zustand se as funções de sincronização existirem
      if (typeof (dataStore as any).fetchDailyTasks === 'function') await (dataStore as any).fetchDailyTasks();
      if (typeof (dataStore as any).loadData === 'function') await (dataStore as any).loadData();

      dataStore.showNotification('Tarefa inserida na sua Lista de Hoje! 🎯', 'success');
      onClose();
    } catch (err) {
      console.error('Erro ao converter captura em tarefa:', err);
      dataStore.showNotification('Erro ao salvar a tarefa.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[800] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="w-full max-w-lg bg-[#0f1110] border border-white/10 rounded-3xl p-6 shadow-2xl text-left flex flex-col gap-6"
      >
        <div>
          <h3 className="text-xl font-bold uppercase tracking-tight text-white">Converter em Tarefa</h3>
          <p className="text-xs text-zinc-400 mt-1">A captura será salva como uma atividade avulsa na sua lista de hoje.</p>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase">Atividade Avulsa</label>
          <input
            type="text"
            value={activityAvulsa}
            onChange={(e) => setActivityAvulsa(e.target.value)}
            className="w-full bg-[#161817] border border-white/5 rounded-2xl px-4 py-3.5 text-sm text-white outline-none focus:border-[#6ee7a8]/50"
          />
        </div>

        <div className="flex gap-3 justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-3.5 bg-transparent text-zinc-400 hover:text-white font-bold text-xs uppercase tracking-wider rounded-2xl transition-all cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-3.5 bg-[#6ee7a8] text-black font-bold text-xs uppercase tracking-wider rounded-2xl transition-all hover:brightness-110 cursor-pointer disabled:opacity-50"
          >
            {isSaving ? 'Salvando...' : 'Confirmar Ok'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export const InboxCaptures = () => {
  const { inboxCaptures, deleteInboxCapture } = useDataStore();
  const { user } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  const [captureToDelete, setCaptureToDelete] = useState<InboxCapture | null>(null);
  const [selectedCapture, setSelectedCapture] = useState<InboxCapture | null>(null);

  if (!user || inboxCaptures.length === 0) return null;

  const handleSaveNote = (capture: InboxCapture) => {
    try {
      setIsOpen(false);
      window.dispatchEvent(new CustomEvent('open-action-center', {
        detail: { screen: 'notes', noteText: capture.content, captureId: capture.id }
      }));
    } catch (err) {
      console.error('Error saving capture to note:', err);
    }
  };

  const handleConfirmDelete = async () => {
    if (!captureToDelete) return;
    try {
      setDeletingId(captureToDelete.id);
      await deleteInboxCapture(captureToDelete.id);
      setDeletingId(null);
      setCaptureToDelete(null);
      if (inboxCaptures.length <= 1) {
        setIsOpen(false);
      }
    } catch (err) {
      console.error('Error deleting capture:', err);
      setDeletingId(null);
      setCaptureToDelete(null);
    }
  };

  return (
    <>
      <motion.button
        onClick={() => setIsOpen(true)}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full mt-4 flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-2xl p-4 cursor-pointer hover:bg-zinc-800 transition-colors shadow-lg shadow-black/20"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
            <Inbox size={18} className="text-indigo-400" />
          </div>
          <div className="text-left">
            <h4 className="text-sm font-semibold text-zinc-100">Limbo Descarregado</h4>
            <p className="text-xs font-medium text-zinc-400">Você tem {inboxCaptures.length} {inboxCaptures.length === 1 ? 'captura não processada' : 'capturas não processadas'} da noite anterior.</p>
          </div>
        </div>
      </motion.button>

      {/* Main Inbox Modal */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-lg max-h-[85vh] bg-zinc-950 border border-zinc-800 rounded-3xl p-6 shadow-2xl flex flex-col"
            >
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-2">
                  <Inbox size={18} className="text-indigo-400" />
                  <h3 className="text-lg font-semibold text-zinc-100">Capturas do Limbo</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-2 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer rounded-full hover:bg-zinc-900"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto style-scrollbar space-y-3 pr-1">
                <AnimatePresence>
                  {inboxCaptures.map(capture => (
                    <motion.div
                      key={capture.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, height: 0, marginBottom: 0, padding: 0 }}
                      className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 overflow-hidden"
                    >
                      <p className="text-sm text-zinc-300 mb-4 whitespace-pre-wrap">{capture.content}</p>
                      
                      {/* Botoes de Acao - Layout Alinhado Horizontalmente */}
                      <div className="flex flex-row flex-wrap items-center gap-4 mt-4 pt-4 border-t border-zinc-800/50">
                        <button
                          type="button"
                          onClick={() => setSelectedCapture(capture)}
                          disabled={deletingId === capture.id}
                          className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 rounded-xl text-sm font-medium text-emerald-400 hover:bg-emerald-500/20 transition-colors cursor-pointer"
                        >
                          <ArrowRightCircle size={16} />
                          Converter em Tarefa
                        </button>
                        
                        <button
                          type="button"
                          onClick={() => handleSaveNote(capture)}
                          disabled={deletingId === capture.id}
                          className="flex items-center gap-2 px-3 py-2 bg-indigo-500/10 rounded-xl text-sm font-medium text-indigo-400 hover:bg-indigo-500/20 transition-colors cursor-pointer"
                        >
                          <FileText size={16} />
                          Anotação
                        </button>

                        <div className="flex-1" />
                        
                        <button
                          type="button"
                          onClick={() => setCaptureToDelete(capture)}
                          disabled={deletingId === capture.id}
                          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-zinc-500 hover:text-red-400 hover:bg-red-400/10 transition-colors cursor-pointer"
                        >
                          <Trash2 size={16} />
                          Apagar
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Renderizar Modal de Criar Tarefa apenas UMA VEZ fora do loop */}
      <AnimatePresence>
        {selectedCapture && (
          <CreateTaskModal
            initialData={selectedCapture.content}
            captureId={selectedCapture.id}
            onClose={() => setSelectedCapture(null)}
          />
        )}
      </AnimatePresence>

      {/* Custom Delete Modal (Apple Style) */}
      <AnimatePresence>
        {captureToDelete && (
          <div className="fixed inset-0 z-[700] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl text-center"
            >
              <h3 className="text-lg font-semibold text-zinc-100 mb-2">Apagar captura?</h3>
              <p className="text-sm text-zinc-400 mb-6">Esta ação não pode ser desfeita.</p>
              
              <div className="flex gap-3 w-full">
                <button
                  type="button"
                  onClick={() => setCaptureToDelete(null)}
                  className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl font-medium text-sm transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="flex-1 py-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 rounded-xl font-medium text-sm transition-colors cursor-pointer"
                >
                  Apagar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
