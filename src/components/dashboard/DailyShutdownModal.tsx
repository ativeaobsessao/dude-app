import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useDataStore } from '../../store/useDataStore';
import { useAuthStore } from '../../store/useAuthStore';
import { X, CheckCircle, Brain, Target, Compass, Lock, LogOut, Moon, Shield, Sword, Zap, BatteryMedium, BatteryLow } from 'lucide-react';
import { DailyClosureOverlay } from './DailyClosureOverlay';
import { DecompressionSession } from './DecompressionSession';

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
  const [isDecompressionOpen, setIsDecompressionOpen] = useState(false);

  const todaySessions = sessions.filter(s => s.started_at && s.started_at.startsWith(targetDate));
  const totalMinutes = todaySessions.reduce((acc, curr) => acc + (curr.duration_minutes || 0), 0);
  
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

  const totalBattlesToday = todayAvoidanceCheckins.length;

  const timeByProject = useMemo(() => {
    const times: Record<string, number> = {};
    todaySessions.forEach(s => {
      const dur = s.actual_duration_minutes !== null ? s.actual_duration_minutes : s.duration_minutes;
      const pName = s.project_id ? (projects.find(p => p.id === s.project_id)?.name || 'Outro Projeto') : 'Avulso';
      times[pName] = (times[pName] || 0) + dur;
    });
    return Object.entries(times)
      .map(([name, minutes]) => ({ name, minutes }))
      .sort((a, b) => b.minutes - a.minutes);
  }, [todaySessions, projects]);

  const formatDuration = (totalMins: number) => {
    const hours = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    if (hours > 0) return `${hours}h${mins > 0 ? ` ${mins}m` : ''}`;
    return `${mins}m`;
  };

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

  const handleStartDecompression = () => {
    setIsDecompressionOpen(true);
  };

  // Fake energy for now since it's not stored
  const energyByPeriod = {
    manha: 'high',
    tarde: 'medium',
    noite: 'low'
  };

  const getEnergyIcon = (level: string) => {
    if (level === 'high') return <Zap size={18} className="text-yellow-400" />;
    if (level === 'medium') return <BatteryMedium size={18} className="text-blue-400" />;
    return <BatteryLow size={18} className="text-zinc-500" />;
  };

  const handleDismiss = () => {
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center p-0 sm:p-4">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={handleDismiss} />
        
        <motion.div
          onClick={(e) => e.stopPropagation()}
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="w-full h-[90vh] sm:max-w-xl bg-zinc-950 sm:border border-zinc-800 rounded-t-[32px] sm:rounded-3xl p-6 sm:p-8 flex flex-col cursor-default overflow-hidden relative shadow-[0_-20px_50px_rgba(0,0,0,0.5)] z-10"
        >
          {/* Header */}
          <div className="flex justify-between items-center mb-6 shrink-0">
            <h2 className="text-2xl sm:text-3xl font-semibold text-zinc-100 tracking-tight">Resumo de Hoje</h2>
            <button
              onClick={handleDismiss}
              className="p-2 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer rounded-full hover:bg-zinc-900"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto style-scrollbar space-y-4 pr-1 pb-32">
            
            {/* Bloco 1: Métricas de Foco */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Tempo Total Presente</span>
              <div className="flex items-baseline gap-3">
                <span className="text-4xl font-light text-zinc-100 tracking-tight">{formatDuration(totalMinutes)}</span>
                <span className="text-sm font-medium text-zinc-500">{todaySessions.length} sessões</span>
              </div>
            </div>

            {/* Grade 2 colunas: Autocontrole e Biológicas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Bloco 2: Níveis de Energia */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-4">Níveis de Energia</span>
                <div className="flex justify-between items-center h-full gap-2">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700/50">
                      {getEnergyIcon(energyByPeriod.manha)}
                    </div>
                    <span className="text-[10px] font-medium text-zinc-400">Manhã</span>
                  </div>
                  <div className="w-full h-px bg-zinc-800"></div>
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700/50">
                      {getEnergyIcon(energyByPeriod.tarde)}
                    </div>
                    <span className="text-[10px] font-medium text-zinc-400">Tarde</span>
                  </div>
                  <div className="w-full h-px bg-zinc-800"></div>
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700/50">
                      {getEnergyIcon(energyByPeriod.noite)}
                    </div>
                    <span className="text-[10px] font-medium text-zinc-400">Noite</span>
                  </div>
                </div>
              </div>

              {/* Bloco 3: Autocontrole */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-4">Autocontrole</span>
                <div className="flex-1 flex flex-col justify-center gap-3">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Target size={14} className="text-zinc-500" />
                      <span className="text-xs font-medium text-zinc-300">Programadas</span>
                    </div>
                    <span className="text-sm font-semibold text-zinc-100">{totalBattlesToday}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Shield size={14} className="text-emerald-500" />
                      <span className="text-xs font-medium text-zinc-300">Vitórias</span>
                    </div>
                    <span className="text-sm font-semibold text-emerald-400">{avoidanceStats.wins}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Sword size={14} className="text-rose-500" />
                      <span className="text-xs font-medium text-zinc-300">Recaídas</span>
                    </div>
                    <span className="text-sm font-semibold text-rose-400">{avoidanceStats.relapses}</span>
                  </div>
                </div>
              </div>

            </div>

            {/* Bloco 4: Tempo por Projeto */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-3">Tempo por Projeto</span>
              {timeByProject.length > 0 ? (
                <div className="flex flex-col">
                  {timeByProject.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-end py-2 border-b border-zinc-800/50 last:border-0 group">
                      <span className="text-sm text-zinc-300 font-medium truncate pr-4">{item.name}</span>
                      <div className="flex-1 border-b border-dotted border-zinc-700/50 mb-1.5 mx-2 opacity-50 group-hover:opacity-100 transition-opacity"></div>
                      <span className="text-sm text-zinc-400 font-mono shrink-0">{formatDuration(item.minutes)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-zinc-500 font-medium py-2">Nenhum projeto registrado hoje.</p>
              )}
            </div>

          </div>

          {/* Fixed Bottom Action */}
          <div className="absolute bottom-0 left-0 w-full p-6 bg-gradient-to-t from-zinc-950 via-zinc-950 to-transparent pt-12 flex flex-col gap-3">
            <button
              type="button"
              onClick={handleStartDecompression}
              className="w-full py-4 bg-zinc-900 hover:bg-zinc-800 text-white rounded-2xl font-semibold text-[15px] transition-all flex items-center justify-center gap-2 cursor-pointer border border-zinc-800"
            >
              <Moon size={18} strokeWidth={2.5} />
              Sessão de Descompressão
            </button>
            <button 
              onClick={onConfirm} 
              disabled={isSubmitting}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-semibold text-[15px] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_20px_rgba(5,150,105,0.2)] disabled:opacity-50"
            >
              {isSubmitting ? 'Encerrando...' : 'Encerrar Dia'}
            </button>
          </div>

        </motion.div>
        
        <DailyClosureOverlay 
          isOpen={showOverlay} 
          onComplete={handleShutdown} 
        />

        <DecompressionSession 
          isOpen={isDecompressionOpen}
          onClose={() => setIsDecompressionOpen(false)}
        />
      </div>
    </AnimatePresence>
  );
};

