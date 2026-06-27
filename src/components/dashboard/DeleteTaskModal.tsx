import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trash2 } from 'lucide-react';

interface DeleteTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const DeleteTaskModal = ({ isOpen, onClose, onConfirm }: DeleteTaskModalProps) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4">
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative w-full max-w-[320px] bg-[#1a1f1c] rounded-[2rem] border border-white/5 shadow-2xl p-6 overflow-hidden flex flex-col items-center text-center"
          >
            {/* Top Icon */}
            <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4">
              <Trash2 className="text-red-500" size={28} strokeWidth={1.5} />
            </div>

            {/* Typography */}
            <h3 className="text-xl font-bold text-white mb-2 font-sans">
              Excluir Tarefa?
            </h3>
            <p className="text-sm text-zinc-400 font-medium font-sans mb-8 leading-relaxed px-2">
              Tem certeza que deseja excluir esta tarefa? Essa ação não pode ser desfeita.
            </p>

            {/* Actions */}
            <div className="flex flex-col gap-3 w-full">
              <button
                onClick={() => {
                  onConfirm();
                  onClose();
                }}
                className="w-full py-4 rounded-2xl bg-red-500/10 text-red-500 border border-red-500/20 uppercase text-[10px] tracking-widest font-bold hover:bg-red-500/20 transition-colors"
              >
                Excluir Tarefa
              </button>
              <button
                onClick={onClose}
                className="w-full py-4 rounded-2xl bg-transparent text-[#6ee7a8] border border-[#6ee7a8]/30 uppercase text-[10px] tracking-widest font-bold hover:bg-[#6ee7a8]/10 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
