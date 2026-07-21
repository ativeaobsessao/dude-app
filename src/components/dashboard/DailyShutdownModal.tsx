import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useDataStore } from '../../store/useDataStore';
import { useAuthStore } from '../../store/useAuthStore';
import { X, CheckCircle, Brain, Target, Compass, Lock, LogOut, Moon, Shield, Sword, Zap, BatteryMedium, BatteryLow, Activity } from 'lucide-react';
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
    addSession, 
    habitCompletions, 
    avoidanceCheckins, 
    scheduledActivities, 
    sessionTasks, 
    addSessionTask, 
    profile, 
    projects,
    addDailyShutdown,
    moodEntries
  } = useDataStore();

  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const [isDecompressionOpen, setIsDecompressionOpen] = useState(false);
  const [internalClosed, setInternalClosed] = useState(false);

  // --- RETROACTIVE SESSIONS STATE ---
  const [pendingRetroTasks, setPendingRetroTasks] = useState<any[]>([]);
  const [isRetroModalOpen, setIsRetroModalOpen] = useState(false);
  const [retroTitle, setRetroTitle] = useState('');
  const [retroProjectId, setRetroProjectId] = useState('');
  const [retroDurationHours, setRetroDurationHours] = useState('00');
  const [retroDurationMins, setRetroDurationMins] = useState('30');
  const [retroFocusedField, setRetroFocusedField] = useState<string | null>(null);
  const [retroToast, setRetroToast] = useState<string | null>(null);


  useEffect(() => {
    if (isOpen) setInternalClosed(false);
  }, [isOpen]);

  const todaySessions = sessions.filter(s => s.started_at && s.started_at.startsWith(targetDate));
  const totalMinutes = todaySessions.reduce((acc, curr) => acc + (curr.duration_minutes || 0), 0);
  
  const todayAvoidanceCheckins = avoidanceCheckins.filter(c => {
    if (!c.checkin_date) return false;
    return c.checkin_date.startsWith(targetDate);
  });

  const todayMoodEntries = useMemo(() => {
    return moodEntries.filter(m => m.date === targetDate);
  }, [moodEntries, targetDate]);

  const energyByPeriod = useMemo(() => {
    const manhaEntry = todayMoodEntries.find(m => m.period === 'manha');
    const tardeEntry = todayMoodEntries.find(m => m.period === 'tarde');
    const noiteEntry = todayMoodEntries.find(m => m.period === 'noite');

    return {
      manha: manhaEntry?.energy || null,
      tarde: tardeEntry?.energy || null,
      noite: noiteEntry?.energy || null
    };
  }, [todayMoodEntries]);

  const getEnergyIcon = (level: string | null) => {
    if (level === 'pleno' || level === 'energizado') return <Zap size={18} className="text-yellow-400" />;
    if (level === 'inquieto') return <Activity size={18} className="text-orange-400" />;
    if (level === 'equilibrado' || level === 'normal') return <BatteryMedium size={18} className="text-blue-400" />;
    if (level === 'fadigado' || level === 'cansado') return <BatteryLow size={18} className="text-red-400" />;
    return <BatteryLow size={18} className="text-zinc-500" />;
  };

  
  const formatEnergyLabel = (level: string | null) => {
    if (!level || level === 'neutro') return '-';
    if (level === 'pleno') return 'pleno';
    if (level === 'inquieto') return 'inquieto';
    if (level === 'equilibrado') return 'equilibrado';
    if (level === 'fadigado') return 'fadigado';
    if (level === 'cansado') return 'cansado';
    if (level === 'normal') return 'normal';
    if (level === 'energizado') return 'energizado';
    return '-';
  };


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


  const handleConfirmRetroactiveShutdown = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      if (user) {
        for (const task of pendingRetroTasks) {
          const totalMins = (parseInt(task.hours) || 0) * 60 + (parseInt(task.mins) || 0);
          if (totalMins > 0) {
            const dateStr = `${targetDate}T12:00:00.000Z`;
            await addSession({
                user_id: user.id,
                project_id: task.projectId || null,
                duration_minutes: totalMins,
                started_at: dateStr,
                completed_at: dateStr,
                status: 'completed',
                activity_type: 'deep_work',
                task_id: null,
                energy_level: 'normal',
                focus_score: 5,
                success_feeling: 5
            });
          }
        }
      }
      setPendingRetroTasks([]);
      handleShutdown();
    } catch (err) {
      console.error("Error retro shutdown", err);
    } finally {
      setIsSubmitting(false);
    }
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

  const handleDismiss = async () => {
    setInternalClosed(true);
    if (user && targetDate) {
      try {
        await addDailyShutdown(user.id, targetDate, 'dismissed');
        localStorage.setItem(`dude-shutdown-dismissed-${targetDate}`, 'true');
      } catch (err) {
        console.error('Failed to dismiss shutdown', err);
      }
    }
    onClose();
  };

  if (!isOpen || internalClosed) return null;

  return (
    <AnimatePresence>
      <div 
        onClick={handleDismiss}
        className="fixed inset-0 z-[600] flex items-end justify-center bg-black/60 backdrop-blur-md cursor-pointer"
      >
        <motion.div
          onClick={(e) => e.stopPropagation()}
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="w-full h-[90vh] sm:max-w-xl bg-zinc-950 border-t border-zinc-800 rounded-t-[32px] p-6 sm:p-8 flex flex-col cursor-default overflow-hidden relative shadow-[0_-20px_50px_rgba(0,0,0,0.5)]"
        >
          {/* Header */}
          <div className="flex justify-between items-center mb-6 shrink-0">
            <h2 className="text-2xl sm:text-3xl font-semibold text-zinc-100 tracking-tight">
              {isCatchUp ? `Fechamento do Dia - ${targetDate.split('-').reverse().join('/')}` : 'Resumo de Hoje'}
            </h2>
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
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] font-medium text-zinc-400 leading-tight">Manhã</span>
                      <span className="text-[10px] text-zinc-400 font-medium capitalize mt-0.5">{formatEnergyLabel(energyByPeriod.manha) || "-"}</span>
                    </div>
                  </div>
                  <div className="w-full h-px bg-zinc-800"></div>
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700/50">
                      {getEnergyIcon(energyByPeriod.tarde)}
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] font-medium text-zinc-400 leading-tight">Tarde</span>
                      <span className="text-[10px] text-zinc-400 font-medium capitalize mt-0.5">{formatEnergyLabel(energyByPeriod.tarde) || "-"}</span>
                    </div>
                  </div>
                  <div className="w-full h-px bg-zinc-800"></div>
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700/50">
                      {getEnergyIcon(energyByPeriod.noite)}
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] font-medium text-zinc-400 leading-tight">Noite</span>
                      <span className="text-[10px] text-zinc-400 font-medium capitalize mt-0.5">{formatEnergyLabel(energyByPeriod.noite) || "-"}</span>
                    </div>
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

            {/* Bloco 5: SESSÕES PROFUNDAS ESQUECIDAS */}
            {isCatchUp && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col mt-4">
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-3">Sessões Profundas Esquecidas</span>
                
                {pendingRetroTasks.length > 0 && (
                  <div className="flex flex-col mb-3">
                    {pendingRetroTasks.map((item, idx) => {
                      const proj = projects.find(p => p.id === item.projectId);
                      const projName = proj ? proj.name : 'Sem Projeto';
                      return (
                        <div key={idx} className="flex justify-between items-end py-2 border-b border-zinc-800/50 last:border-0 group">
                          <div className="flex flex-col truncate pr-4">
                            <span className="text-sm text-zinc-300 font-medium truncate">{item.title}</span>
                            <span className="text-[10px] text-zinc-500 font-medium truncate">{projName}</span>
                          </div>
                          <div className="flex-1 border-b border-dotted border-zinc-700/50 mb-1.5 mx-2 opacity-50 group-hover:opacity-100 transition-opacity"></div>
                          <span className="text-sm text-emerald-400 font-mono shrink-0">{item.hours}h {item.mins}m</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                
                <button 
                  onClick={() => setIsRetroModalOpen(true)}
                  className="w-full py-3 bg-white/5 border border-white/10 hover:bg-white/10 text-zinc-400 hover:text-white rounded-xl text-xs font-semibold transition-colors mt-2"
                >
                  + Adicionar sessão esquecida
                </button>
              </div>
            )}

          </div>

          
          {/* Fixed Bottom Action */}
          <div className="absolute bottom-0 left-0 w-full p-6 bg-gradient-to-t from-zinc-950 via-zinc-950 to-transparent pt-12">
            {!isCatchUp ? (
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={onConfirm}
                  disabled={isSubmitting}
                  className="w-full py-4 bg-white hover:bg-zinc-200 text-black rounded-2xl font-bold text-[15px] uppercase tracking-wider transition-all active:scale-[0.98] cursor-pointer shadow-[0_0_20px_rgba(255,255,255,0.1)] disabled:opacity-50"
                >
                  {isSubmitting ? 'CONFIRMANDO...' : 'ENCERRAR DIA'}
                </button>
                <button
                  type="button"
                  onClick={handleStartDecompression}
                  className="w-full py-3.5 bg-transparent hover:bg-white/5 border border-white/10 text-zinc-400 hover:text-white rounded-2xl font-semibold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Moon size={16} strokeWidth={2.5} />
                  Sessão de Descompressão
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleConfirmRetroactiveShutdown}
                disabled={isSubmitting}
                className="w-full py-4 bg-white hover:bg-zinc-200 text-black rounded-2xl font-bold text-[15px] uppercase tracking-wider transition-all active:scale-[0.98] cursor-pointer shadow-[0_0_20px_rgba(255,255,255,0.1)] disabled:opacity-50"
              >
                {isSubmitting ? 'CONFIRMANDO...' : 'CONFIRMAR FECHAMENTO'}
              </button>
            )}
          </div>

        </motion.div>
        
        <DailyClosureOverlay 
          isOpen={showOverlay} 
          onComplete={handleShutdown} 
        />


        <AnimatePresence>
          {isRetroModalOpen && (
            <div 
              className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <AnimatePresence>
                {retroToast && (
                  <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="absolute top-6 left-1/2 -translate-x-1/2 z-[10001] bg-white/10 backdrop-blur-xl border border-white/20 text-white text-xs font-semibold px-5 py-3 rounded-full shadow-2xl flex items-center gap-2 pointer-events-none"
                  >
                    <CheckCircle size={14} className="text-emerald-400" />
                    {retroToast}
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                onClick={() => setIsRetroModalOpen(false)}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="w-full max-w-lg bg-[#0b0e11] border border-white/10 rounded-[28px] p-6 relative overflow-hidden flex flex-col shadow-2xl z-10"
              >
                <div className="flex items-center justify-between mb-6 border-b border-white/5 pb-4 shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                      <Target className="text-white" size={20} />
                    </div>
                    <h3 className="text-xl font-bold text-white tracking-tight">Sessão Esquecida</h3>
                  </div>
                  <button onClick={() => setIsRetroModalOpen(false)} className="p-2 text-zinc-500 hover:text-white transition-colors rounded-full hover:bg-white/5">
                    <X size={20} />
                  </button>
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-1 text-left">
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2 ml-1">O QUE FOI FEITO?</label>
                    <input
                      type="text"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 transition-all"
                      placeholder="Ex: Refatorar modal..."
                      value={retroTitle}
                      onChange={(e) => setRetroTitle(e.target.value)}
                    />
                  </div>
                  
                  <div className="space-y-1 text-left">
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2 ml-1">PROJETO VINCULADO</label>
                    <select
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 transition-all appearance-none cursor-pointer"
                      value={retroProjectId}
                      onChange={(e) => setRetroProjectId(e.target.value)}
                    >
                      <option value="" className="bg-zinc-900 text-zinc-500">Nenhum projeto</option>
                      {projects.map(p => (
                        <option key={p.id} value={p.id} className="bg-zinc-900 text-white">{p.name}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="bg-[#111418] border border-white/5 rounded-2xl p-5 space-y-4 mt-2">
                    <div className="space-y-1 text-left w-full min-w-0">
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2 ml-1">DURAÇÃO</label>
                      <div className="flex gap-2 items-center">
                        <div className="flex-1 flex items-center justify-center bg-white/5 border border-white/20 rounded-2xl px-3 min-h-[58px] gap-1">
                          <div className="flex-1 flex flex-col items-center">
                            <span className="text-[7.5px] font-bold text-zinc-500 uppercase tracking-widest">Horas</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              className="w-full bg-transparent text-center font-bold text-sm text-white outline-none py-1"
                              maxLength={2}
                              value={retroDurationHours}
                              onChange={(e) => setRetroDurationHours(e.target.value.replace(/\D/g, ''))}
                              onBlur={(e) => setRetroDurationHours(e.target.value.padStart(2, '0') || '00')}
                              onFocus={(e) => {
                                e.target.select();
                                setRetroFocusedField('duracao');
                              }}
                            />
                          </div>
                          <span className="text-zinc-600 font-bold text-sm select-none mb-1">:</span>
                          <div className="flex-1 flex flex-col items-center">
                            <span className="text-[7.5px] font-bold text-zinc-500 uppercase tracking-widest">Minutos</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              className="w-full bg-transparent text-center font-bold text-sm text-white outline-none py-1"
                              maxLength={2}
                              value={retroDurationMins}
                              onChange={(e) => setRetroDurationMins(e.target.value.replace(/\D/g, ''))}
                              onBlur={(e) => setRetroDurationMins(e.target.value.padStart(2, '0') || '00')}
                              onFocus={(e) => {
                                e.target.select();
                                setRetroFocusedField('duracao');
                              }}
                            />
                          </div>
                        </div>
                        {retroFocusedField === 'duracao' && (
                          <button
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setRetroDurationHours(retroDurationHours.padStart(2, '0') || '00');
                              setRetroDurationMins(retroDurationMins.padStart(2, '0') || '00');
                              setRetroFocusedField(null);
                              if (document.activeElement instanceof HTMLElement) {
                                document.activeElement.blur();
                              }
                            }}
                            className="px-4 py-4 bg-emerald-500 text-white text-[11px] font-extrabold uppercase tracking-wider rounded-2xl hover:bg-emerald-400 transition-all shadow-[0_4px_12px_rgba(16,185,129,0.2)] shrink-0 min-h-[58px]"
                          >
                            OK
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 justify-end pt-4 mt-2">
                  <button
                    onClick={() => setIsRetroModalOpen(false)}
                    className="px-5 py-3.5 bg-transparent text-zinc-400 hover:text-white font-bold text-xs uppercase tracking-wider rounded-2xl transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => {
                      if (!retroTitle) return;
                      setPendingRetroTasks([...pendingRetroTasks, {
                        title: retroTitle,
                        projectId: retroProjectId,
                        hours: retroDurationHours.padStart(2, '0') || '00',
                        mins: retroDurationMins.padStart(2, '0') || '00'
                      }]);
                      setRetroTitle('');
                      setRetroProjectId('');
                      setRetroDurationHours('00');
                      setRetroDurationMins('30');
                      
                      setRetroToast('Sessão contabilizada para ' + targetDate.split('-').reverse().join('/'));
                      setTimeout(() => setRetroToast(null), 3500);
                    }}
                    disabled={!retroTitle || (parseInt(retroDurationHours||'0') === 0 && parseInt(retroDurationMins||'0') === 0)}
                    className="px-6 py-3.5 bg-emerald-500 hover:bg-emerald-400 text-white disabled:opacity-50 disabled:cursor-not-allowed font-bold text-xs uppercase tracking-wider rounded-2xl transition-all cursor-pointer shadow-[0_4px_20px_rgba(16,185,129,0.2)]"
                  >
                    CONFIRMAR OK
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <DecompressionSession 
          isOpen={isDecompressionOpen}
          onClose={() => setIsDecompressionOpen(false)}
        />
      </div>
    </AnimatePresence>
  );
};

