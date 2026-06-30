import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useDataStore } from '../../store/useDataStore';
import { useAuthStore } from '../../store/useAuthStore';
import { X, CheckCircle, Brain, Target, Compass, Lock, LogOut } from 'lucide-react';
import { DailyClosureOverlay } from './DailyClosureOverlay';

interface DailyShutdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetDate: string;
  isCatchUp: boolean;
}

export const DailyShutdownModal = ({ isOpen, onClose, targetDate, isCatchUp }: DailyShutdownModalProps) => {
  const { user } = useAuthStore();
  const { 
    habits,
    sessions, 
    habitCompletions, 
    avoidanceCheckins, 
    scheduledActivities, 
    sessionTasks, 
    addSessionTask, 
    profile, 
    projects,
    addDailyShutdown
  } = useDataStore();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);

  const todayHabitsCount = habits.filter(h => h.habit_mode !== 'avoid').length;
  const completedHabits = habitCompletions.filter(c => c.completed_at && c.completed_at.startsWith(targetDate)).length;
  const completionRate = todayHabitsCount > 0 ? Math.round((completedHabits / todayHabitsCount) * 100) : 100;

  const todaySessions = sessions.filter(s => s.started_at && s.started_at.startsWith(targetDate));
  const totalFocusTime = todaySessions.reduce((acc, curr) => acc + (curr.duration_minutes || 0), 0);
  const tasksCompleted = todaySessions.reduce((acc, curr) => acc + (curr.all_tasks_completed ? 1 : 0), 0);

  const todayAvoidanceCheckins = avoidanceCheckins.filter(c => {
    if (!c.checkin_date) return false;
    return c.checkin_date.startsWith(targetDate);
  });

  const avoidanceStats = useMemo(() => {
    let wins = 0;
    let relapses = 0;
    todayAvoidanceCheckins.forEach(ac => {
      const status = ac.status?.toLowerCase();
      if (status === 'resisti' || status === 'success') {
        wins++;
      } else if (status === 'recai' || status === 'relapse') {
        relapses++;
      }
    });
    return { wins, relapses };
  }, [todayAvoidanceCheckins]);

  const projectTimes = useMemo(() => {
    const times: Record<string, number> = {};
    todaySessions.forEach(s => {
      const dur = s.actual_duration_minutes !== null ? s.actual_duration_minutes : s.duration_minutes;
      const pName = s.project_id ? (projects.find(p => p.id === s.project_id)?.name || 'Outro Projeto') : 'Avulso';
      times[pName] = (times[pName] || 0) + dur;
    });
    return Object.entries(times).sort((a, b) => b[1] - a[1]);
  }, [todaySessions, projects]);

  const handleShutdown = async () => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      await addDailyShutdown(user.id, targetDate, 'completed');
      localStorage.setItem(`dude-shutdown-completed-${targetDate}`, 'true');
      
      window.dispatchEvent(new CustomEvent('reset-daily-circle'));
      window.dispatchEvent(new CustomEvent('reload-tasks')); // to force UI update on tasks

      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
      setShowOverlay(false);
    }
  };

  const onConfirm = () => {
    setShowOverlay(true);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }} 
          animate={{ opacity: 1, scale: 1 }} 
          exit={{ opacity: 0, scale: 0.95 }} 
          className="bg-surface border border-border-custom rounded-2xl w-full max-w-lg overflow-hidden relative z-10 p-6 flex flex-col gap-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                <LogOut className="text-[#6ee7a8]" /> 
                {isCatchUp ? 'Fechamento Retroativo' : 'Fechamento Diário'}
              </h2>
              <p className="text-sm text-text-dim">Revisão de atividades para {targetDate}</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
              <X size={20} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/5 p-4 rounded-xl flex flex-col gap-1 border border-white/5">
              <span className="text-xs text-text-dim uppercase tracking-wider font-semibold flex items-center gap-2">
                <CheckCircle size={14} /> Hábitos
              </span>
              <span className="text-2xl font-bold">{completionRate}%</span>
              <span className="text-xs text-text-dimmer">{completedHabits} de {todayHabitsCount} concluídos</span>
            </div>
            
            <div className="bg-white/5 p-4 rounded-xl flex flex-col gap-1 border border-white/5">
              <span className="text-xs text-text-dim uppercase tracking-wider font-semibold flex items-center gap-2">
                <Brain size={14} /> Foco Profundo
              </span>
              <span className="text-2xl font-bold">{totalFocusTime}m</span>
              <span className="text-xs text-text-dimmer">{tasksCompleted} tarefas concluídas</span>
            </div>

            <div className="bg-white/5 p-4 rounded-xl flex flex-col gap-1 border border-white/5 col-span-2">
              <span className="text-xs text-text-dim uppercase tracking-wider font-semibold flex items-center gap-2">
                <Lock size={14} /> Blindagem (Vícios)
              </span>
              <div className="flex gap-4 mt-1">
                <div>
                  <span className="text-xl font-bold text-green-400">{avoidanceStats.wins}</span>
                  <span className="text-xs text-text-dimmer ml-2">Resistências</span>
                </div>
                <div>
                  <span className="text-xl font-bold text-red-400">{avoidanceStats.relapses}</span>
                  <span className="text-xs text-text-dimmer ml-2">Recaídas</span>
                </div>
              </div>
            </div>

            <div className="bg-white/5 p-4 rounded-xl flex flex-col gap-1 border border-white/5 col-span-2">
              <span className="text-xs text-text-dim uppercase tracking-wider font-semibold flex items-center gap-2">
                <Target size={14} /> Tempo por Projeto
              </span>
              <div className="space-y-2 mt-2">
                {projectTimes.length > 0 ? (
                  projectTimes.map(([projName, mins]) => (
                    <div key={projName} className="flex justify-between items-center text-sm">
                      <span className="text-white/80 line-clamp-1">{projName}</span>
                      <span className="font-mono font-bold whitespace-nowrap ml-2">{mins}m</span>
                    </div>
                  ))
                ) : (
                  <span className="text-xs text-text-dimmer block">Nenhum tempo registrado hoje.</span>
                )}
              </div>
            </div>
          </div>

          <button 
            onClick={onConfirm} 
            disabled={isSubmitting}
            className="w-full bg-[#6ee7a8] text-background font-bold py-3 rounded-xl hover:bg-[#5cd698] transition-colors disabled:opacity-50"
          >
            {isSubmitting ? 'Encerrando...' : 'Confirmar e Encerrar o Dia'}
          </button>
        </motion.div>
        
        <DailyClosureOverlay 
          isOpen={showOverlay} 
          onComplete={handleShutdown} 
        />
      </div>
    </AnimatePresence>
  );
};
