import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2 } from 'lucide-react';
import { ScheduledActivity } from '../../types';

interface ScheduledSuccessOverlayProps {
  visible: boolean;
  data: ScheduledActivity | null;
  onClose: () => void;
  onEdit: (data: ScheduledActivity) => void;
}

export const ScheduledSuccessOverlay = ({ visible, data, onClose, onEdit }: ScheduledSuccessOverlayProps) => {
  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => {
        onClose();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [visible, onClose]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[999] bg-black/40 backdrop-blur-xl flex items-center justify-center p-6"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-[#1c1c1e] w-full max-w-sm rounded-[28px] p-8 shadow-[0_20px_40px_rgba(0,0,0,0.5)] border border-white/5 flex flex-col items-center text-center gap-6"
          >
            <div className="w-16 h-16 rounded-full bg-primary-green/10 flex items-center justify-center text-primary-green">
              <CheckCircle2 size={32} />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold text-text-primary tracking-tight">Agendamento Criado</h3>
              <p className="text-sm font-light text-text-secondary leading-relaxed">
                Agendamento salvo com sucesso.
              </p>
            </div>
            <div className="w-full space-y-3 mt-2">
              <button
                onClick={() => {
                  onClose();
                  if (data) {
                    onEdit(data);
                  }
                }}
                className="w-full py-4 bg-primary-green/10 hover:bg-primary-green/20 text-primary-green rounded-2xl font-bold uppercase tracking-widest text-[10px] transition-all"
              >
                Editar Agendamento
              </button>
              <button
                onClick={() => onClose()}
                className="w-full py-4 bg-white/5 hover:bg-white/10 text-text-secondary rounded-2xl font-bold uppercase tracking-widest text-[10px] transition-all"
              >
                Fechar
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
