import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trash2 } from 'lucide-react';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title = "Excluir Anotação",
  message = "Tem certeza que deseja excluir esta anotação? Esta ação não pode ser desfeita."
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[999] bg-[#0c100e]/80 backdrop-blur-md flex items-center justify-center p-6"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 20 }}
            transition={{ type: "spring", duration: 0.5 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-[#1a1f1b]/90 border border-white/10 p-6 md:p-8 rounded-[2rem] max-w-sm w-full shadow-2xl flex flex-col items-center text-center space-y-6"
          >
            <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mb-2">
              <Trash2 size={32} strokeWidth={1.5} />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-xl font-bold tracking-tight text-white">{title}</h3>
              <p className="text-sm text-white/60 font-light leading-relaxed">
                {message}
              </p>
            </div>

            <div className="flex flex-col gap-3 w-full mt-4">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onConfirm();
                  onClose();
                }}
                className="w-full py-3.5 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold text-sm tracking-widest uppercase transition-colors"
              >
                Excluir
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                className="w-full py-3.5 bg-white/5 hover:bg-white/10 text-white rounded-xl font-bold text-sm tracking-widest uppercase transition-colors border border-white/5"
              >
                Cancelar
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
