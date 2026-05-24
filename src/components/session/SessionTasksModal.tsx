import React from 'react';
import { motion } from 'motion/react';
import { X } from 'lucide-react';
import { SessionTasksChecklist } from './SessionTasksChecklist';

interface SessionTasksModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: string[];
  completedTasks: string[];
  onChangeTasks: (newTasks: string[]) => void;
  onChangeCompleted: (newCompleted: string[]) => void;
}

export const SessionTasksModal: React.FC<SessionTasksModalProps> = ({
  isOpen,
  onClose,
  tasks,
  completedTasks,
  onChangeTasks,
  onChangeCompleted,
}) => {
  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[1150] bg-background/95 backdrop-blur-3xl flex items-center justify-center p-6"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 10 }}
        className="w-full max-w-sm space-y-6 shadow-[0_50px_100px_rgba(0,0,0,0.5)]"
        style={{
          backgroundColor: '#1a1f1c',
          border: '0.5px solid rgba(110, 231, 183, 0.15)',
          borderRadius: '12px',
          padding: '1.25rem 1rem',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center pb-2">
          <h3 className="text-sm font-medium text-white">Tarefas da Sessão</h3>
          <button
            onClick={onClose}
            className="text-[#6a7570] hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <SessionTasksChecklist
          tasks={tasks}
          completedTasks={completedTasks}
          onChangeTasks={onChangeTasks}
          onChangeCompleted={onChangeCompleted}
        />

        <div className="pt-2">
          <button
            onClick={onClose}
            className="w-full py-3 rounded-lg text-[10px] font-bold uppercase tracking-[0.1em] transition-all cursor-pointer"
            style={{
              backgroundColor: 'rgba(255,255,255,0.04)',
              border: '0.5px solid rgba(255,255,255,0.08)',
              color: '#fff',
            }}
          >
            VOLTAR AO TIMER
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};
