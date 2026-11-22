import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check } from 'lucide-react';

interface DailyClosureOverlayProps {
  isOpen: boolean;
  onComplete: () => void;
}

export const DailyClosureOverlay: React.FC<DailyClosureOverlayProps> = ({ isOpen, onComplete }) => {
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        onComplete();
      }, 4000); // 4 seconds
      return () => clearTimeout(timer);
    }
  }, [isOpen, onComplete]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-black/40"
        >
          {/* Glassmorphism Card */}
          <motion.div
            initial={{ scale: 0.95, y: 10, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="w-full max-w-sm rounded-[28px] bg-[#1c1c1e]/80 p-8 shadow-2xl flex flex-col items-center justify-center text-center relative overflow-hidden"
            style={{
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              boxShadow: '0 24px 48px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
            }}
          >
            {/* Animated Check */}
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, type: 'spring', damping: 15, stiffness: 200 }}
              className="w-16 h-16 rounded-full bg-primary-green/10 flex items-center justify-center mb-6"
            >
              <Check size={32} strokeWidth={3} className="text-primary-green" />
            </motion.div>

            {/* Typography */}
            <motion.h2 
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-xl font-semibold text-white tracking-tight mb-2 font-sans"
            >
              Dia Encerrado
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="text-sm text-white/60 font-medium font-sans"
            >
              Bom descanso e até amanhã.
            </motion.p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
