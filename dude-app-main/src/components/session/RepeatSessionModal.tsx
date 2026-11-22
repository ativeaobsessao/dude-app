import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, ChevronDown, Plus, Trash2 } from 'lucide-react';
import { CustomSelect } from '../ui/CustomSelect';
import { cleanActivityName } from '../../lib/utils';

interface RepeatSessionSnapshot {
  projectId: string | null;
  habitId: string | null;
  activityId: string | null;
  activityName: string;
  durationMinutes: number;
  incompleteTasks: string[];
}

interface RepeatSessionModalProps {
  isOpen: boolean;
  initialData: RepeatSessionSnapshot | null;
  projects: Array<{ id: string; name: string }>;
  activities: Array<{ id: string; name: string; project_id?: string | null }>;
  habits: Array<{ id: string; name: string; habit_mode?: 'build' | 'avoid' }>;
  onRepeat: (config: {
    projectId: string | null;
    habitId: string | null;
    activityId: string | null;
    activityName: string;
    durationMinutes: number;
    tasks: string[];
  }) => void;
  onConcludeNow: () => void;
}

export const RepeatSessionModal: React.FC<RepeatSessionModalProps> = ({
  isOpen,
  initialData,
  projects,
  activities,
  habits,
  onRepeat,
  onConcludeNow,
}) => {
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const [hours, setHours] = useState('00');
  const [minutes, setMinutes] = useState('30');
  const [projectId, setProjectId] = useState('');
  const [activityId, setActivityId] = useState('');
  const [habitId, setHabitId] = useState('');
  const [tasks, setTasks] = useState<string[]>([]);
  const [newTaskInput, setNewTaskInput] = useState('');

  // Sempre que o modal abre com um novo snapshot, repopula os campos
  useEffect(() => {
    if (isOpen && initialData) {
      const h = Math.floor(initialData.durationMinutes / 60);
      const m = initialData.durationMinutes % 60;
      setHours(String(h).padStart(2, '0'));
      setMinutes(String(m).padStart(2, '0'));
      setProjectId(initialData.projectId || '');
      setActivityId(initialData.activityId || '');
      setHabitId(initialData.habitId || '');
      setTasks(initialData.incompleteTasks || []);
      setIsDetailsOpen(false);
      setNewTaskInput('');
    }
  }, [isOpen, initialData]);

  if (!isOpen || !initialData) return null;

  const filteredActivities = projectId
    ? activities.filter(a => a.project_id === projectId)
    : activities;

  const handleAddTask = () => {
    if (newTaskInput.trim()) {
      setTasks([...tasks, newTaskInput.trim()]);
      setNewTaskInput('');
    }
  };

  const handleRemoveTask = (idx: number) => {
    setTasks(tasks.filter((_, i) => i !== idx));
  };

  const handleConfirmRepeat = () => {
    const totalMinutes = (parseInt(hours, 10) || 0) * 60 + (parseInt(minutes, 10) || 0);
    if (totalMinutes < 1) return;

    onRepeat({
      projectId: projectId || null,
      habitId: habitId || null,
      activityId: activityId || null,
      activityName: initialData.activityName,
      durationMinutes: totalMinutes,
      tasks,
    });
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[1400] bg-background/95 backdrop-blur-3xl flex items-center justify-center p-6"
      >
        <motion.div
          initial={{ scale: 0.95, y: 20, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.95, y: 20, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="w-full max-w-lg bg-surface border border-white/10 rounded-[2.5rem] p-6 md:p-10 shadow-[0_0_100px_rgba(110,231,168,0.1)] space-y-8 max-h-[88vh] overflow-y-auto"
        >
          {/* Success Header */}
          <div className="flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary-green/10 flex items-center justify-center text-primary-green">
              <CheckCircle2 size={32} />
            </div>
            
            <h2 className="text-2xl font-semibold tracking-tight text-text-primary">Sessão Registrada!</h2>

            {/* Caminho 1: Concluir por agora (Padrão Apple - destaque tátil e ação natural) */}
            <div className="w-full pt-1">
              <button
                type="button"
                onClick={onConcludeNow}
                className="w-full py-3.5 sm:py-4 px-6 bg-white hover:bg-zinc-100 active:scale-[0.98] text-black font-bold text-xs sm:text-[13px] tracking-wider uppercase rounded-2xl shadow-[0_4px_24px_rgba(255,255,255,0.12)] transition-all duration-200 cursor-pointer flex items-center justify-center"
              >
                Concluir por Agora
              </button>
            </div>

            {/* Divisor sutil sintonizando os dois caminhos */}
            <div className="w-full flex items-center gap-3 pt-2">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-[10px] uppercase font-bold tracking-widest text-text-secondary/50">ou</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            <p className="text-sm text-text-secondary font-light">
              Quer repetir a mesma Sessão Profunda agora?
            </p>
          </div>

          {/* Duration - Bloco Principal (sempre visível) */}
          <div className="space-y-3">
            <label className="text-[10px] font-bold uppercase tracking-widest text-text-secondary opacity-70 block text-center">
              Duração da Próxima Sessão
            </label>
            <div className="grid grid-cols-2 gap-4 max-w-xs mx-auto">
              <div className="space-y-1 text-center">
                <span className="text-[9px] font-bold text-text-secondary/40 uppercase tracking-widest block">Horas</span>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={2}
                  value={hours}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setHours(e.target.value.replace(/\D/g, '').slice(0, 2))}
                  onBlur={() => setHours(String(Math.min(12, parseInt(hours, 10) || 0)).padStart(2, '0'))}
                  className="w-full bg-white/5 border border-white/20 rounded-2xl p-4 text-center text-2xl font-bold text-text-primary outline-none focus:border-primary-green transition-all"
                />
              </div>
              <div className="space-y-1 text-center">
                <span className="text-[9px] font-bold text-text-secondary/40 uppercase tracking-widest block">Minutos</span>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={2}
                  value={minutes}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setMinutes(e.target.value.replace(/\D/g, '').slice(0, 2))}
                  onBlur={() => setMinutes(String(Math.min(59, parseInt(minutes, 10) || 0)).padStart(2, '0'))}
                  className="w-full bg-white/5 border border-white/20 rounded-2xl p-4 text-center text-2xl font-bold text-text-primary outline-none focus:border-primary-green transition-all"
                />
              </div>
            </div>
          </div>

          {/* Progressive Disclosure: Ajustar Detalhes */}
          <div className="border-t border-white/5 pt-4">
            <button
              type="button"
              onClick={() => setIsDetailsOpen(!isDetailsOpen)}
              className="w-full flex items-center justify-between text-left cursor-pointer group"
            >
              <span className="text-[11px] font-bold uppercase tracking-widest text-text-secondary group-hover:text-primary-green transition-colors">
                Ajustar Projeto, Atividade e Tarefas
              </span>
              <ChevronDown
                size={16}
                className={`text-text-secondary/40 group-hover:text-primary-green transition-all duration-300 ${isDetailsOpen ? 'rotate-180' : ''}`}
              />
            </button>

            <AnimatePresence initial={false}>
              {isDetailsOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden"
                >
                  <div className="pt-5 space-y-4 text-left">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-text-secondary opacity-70 block">Projeto</label>
                      <CustomSelect
                        value={projectId}
                        onChange={(val) => { setProjectId(val); setActivityId(''); }}
                        placeholder="Geral (Sem Projeto)"
                        options={[
                          { value: '', label: 'Geral (Sem Projeto)' },
                          ...projects.map(p => ({ value: p.id, label: p.name }))
                        ]}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-text-secondary opacity-70 block">Atividade</label>
                      <CustomSelect
                        value={activityId}
                        onChange={(val) => setActivityId(val)}
                        placeholder="Nenhuma"
                        options={[
                          { value: '', label: 'Nenhuma' },
                          ...filteredActivities.map(a => ({ value: a.id, label: cleanActivityName(a.name) }))
                        ]}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-text-secondary opacity-70 block">Vincular Hábito</label>
                      <CustomSelect
                        value={habitId}
                        onChange={(val) => setHabitId(val)}
                        placeholder="Nenhum"
                        options={[
                          { value: '', label: 'Nenhum' },
                          ...habits.filter(h => h.habit_mode !== 'avoid').map(h => ({ value: h.id, label: h.name }))
                        ]}
                      />
                    </div>

                    <div className="space-y-2 pt-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-text-secondary opacity-70 block">Tarefas da Sessão</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Adicionar tarefa..."
                          value={newTaskInput}
                          onChange={(e) => setNewTaskInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddTask();
                            }
                          }}
                          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-text-primary outline-none focus:border-primary-green placeholder-text-secondary/30"
                        />
                        <button
                          type="button"
                          onClick={handleAddTask}
                          className="w-10 h-10 shrink-0 bg-primary-green/10 hover:bg-primary-green/20 border border-primary-green/20 rounded-xl flex items-center justify-center text-primary-green transition-all cursor-pointer"
                        >
                          <Plus size={16} />
                        </button>
                      </div>

                      {tasks.length > 0 && (
                        <div className="space-y-2 pt-1">
                          {tasks.map((task, idx) => (
                            <div key={idx} className="flex items-center gap-2 p-2.5 bg-white/5 rounded-xl border border-white/10">
                              <span className="text-xs text-text-primary flex-1 font-light break-words">{task}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveTask(idx)}
                                className="text-red-500/50 hover:text-red-500 transition-colors cursor-pointer shrink-0"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Ações */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleConfirmRepeat}
              className="w-full py-4 bg-primary-green hover:brightness-110 active:scale-[0.98] text-background rounded-2xl font-bold uppercase tracking-widest text-[11px] transition-all cursor-pointer shadow-[0_0_30px_rgba(110,231,168,0.2)]"
            >
              Iniciar Sessão Novamente
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
