import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RotateCcw } from 'lucide-react';

interface DailyReopenModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const DailyReopenModal = ({ isOpen, onClose, onConfirm }: DailyReopenModalProps) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-md"
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative w-full max-w-sm bg-[#111111] border border-white/10 rounded-[32px] p-6 shadow-2xl overflow-hidden flex flex-col items-center text-center"
        >
          <div className="w-16 h-16 rounded-full bg-[#f59e0b]/10 border border-[#f59e0b]/20 flex items-center justify-center mb-6">
            <RotateCcw size={28} className="text-[#f59e0b]" />
          </div>

          <h2 className="text-xl font-bold text-white mb-2 tracking-tight">Reabrir o Dia?</h2>
          
          <p className="text-sm text-white/60 mb-8 max-w-[260px] leading-relaxed">
            Seu ciclo diário será restaurado. O círculo central e suas tarefas voltarão ao estado anterior.
          </p>

          <div className="flex flex-col gap-3 w-full">
            <button
              onClick={onConfirm}
              className="w-full bg-[#f59e0b] text-black font-semibold text-sm py-4 rounded-2xl hover:bg-[#f59e0b]/90 transition-all active:scale-[0.98]"
            >
              Sim, Reabrir Meu Dia
            </button>
            <button
              onClick={onClose}
              className="w-full bg-white/5 text-white/80 font-medium text-sm py-4 rounded-2xl hover:bg-white/10 transition-all active:scale-[0.98]"
            >
              Cancelar
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
