import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Pencil, Trash2, X, ShieldAlert } from 'lucide-react';
import { Habit } from '../../types';
import { useDataStore } from '../../store/useDataStore';
import { ConfirmDeleteModal } from '../ui/ConfirmDeleteModal';

interface AntiVicioCardOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  habit: Habit | null;
}

export const AntiVicioCardOptionsModal: React.FC<AntiVicioCardOptionsModalProps> = ({
  isOpen,
  onClose,
  habit,
}) => {
  const dataStore = useDataStore();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  if (!habit) return null;

  const handleEdit = () => {
    onClose();
    window.dispatchEvent(
      new CustomEvent('open-action-center', {
        detail: { screen: 'anti-vicio', editHabit: habit },
      })
    );
  };

  const handleConfirmDelete = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      await dataStore.deleteAvoidanceHabit(habit.id);
      dataStore.showNotification('Módulo Anti-Vício removido com sucesso.', 'success');
    } finally {
      setIsDeleting(false);
      onClose();
    }
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && !showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[650] bg-black/60 backdrop-blur-md flex items-end sm:items-center justify-center p-4"
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ y: 40, opacity: 0, scale: 0.97 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 40, opacity: 0, scale: 0.97 }}
              transition={{ type: 'spring', damping: 26, stiffness: 300 }}
              className="w-full max-w-sm bg-[#15181a]/95 border border-white/10 rounded-[2rem] p-6 shadow-2xl space-y-6 backdrop-blur-2xl"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 text-left min-w-0">
                  <div className="w-11 h-11 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 shrink-0">
                    <ShieldAlert size={20} />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-red-400/70 block">
                      Autocontrole
                    </span>
                    <h3 className="text-lg font-bold text-white tracking-tight truncate">
                      {habit.name}
                    </h3>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 text-white/40 hover:text-white hover:bg-white/5 rounded-full transition-colors cursor-pointer shrink-0"
                  title="Fechar"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-3">
                <button
                  onClick={handleEdit}
                  className="w-full flex items-center gap-3 px-5 py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-white font-semibold text-sm transition-all cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-full bg-primary-green/10 flex items-center justify-center text-primary-green shrink-0">
                    <Pencil size={16} />
                  </div>
                  Editar Anti-Vício
                </button>

                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full flex items-center gap-3 px-5 py-4 bg-red-500/10 hover:bg-red-500/15 border border-red-500/20 rounded-2xl text-red-400 font-semibold text-sm transition-all cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-full bg-red-500/10 flex items-center justify-center text-red-400 shrink-0">
                    <Trash2 size={16} />
                  </div>
                  Apagar Anti-Vício
                </button>
              </div>

              <button
                onClick={onClose}
                className="w-full py-3.5 bg-transparent hover:bg-white/5 text-white/50 hover:text-white/80 text-xs font-bold uppercase tracking-widest rounded-2xl transition-all cursor-pointer"
              >
                Cancelar
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmDeleteModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleConfirmDelete}
        title="Apagar Anti-Vício?"
        message={`Tem certeza que deseja apagar o controle "${habit.name}"? Todo o histórico de check-ins será perdido permanentemente.`}
      />
    </>
  );
};
