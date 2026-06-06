import { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { useDataStore } from '../../store/useDataStore';
import { getLocalDateString } from '../../lib/utils';
import { Trash2, Plus, Check, Play, Square, CheckSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface DailyTask {
  id: string;
  description: string;
  completed: boolean;
  created_at: string;
}

interface TaskListScreenProps {
  tasks: DailyTask[];
  onTasksChange: (newTasks: DailyTask[]) => void;
  onStartSession: (activity: any) => void;
}

export const TaskListScreen: React.FC<TaskListScreenProps> = ({ tasks, onTasksChange, onStartSession }) => {
  const { user } = useAuthStore();
  const dataStore = useDataStore();
  const [newTaskText, setNewTaskText] = useState('');
  const todayStr = getLocalDateString(new Date());

  // Count stats
  const completedCount = tasks.filter(t => t.completed).length;
  const totalCount = tasks.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const handleAddTask = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newTaskText.trim()) return;

    const newTask: DailyTask = {
      id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      description: newTaskText.trim(),
      completed: false,
      created_at: new Date().toISOString()
    };

    const updated = [...tasks, newTask];
    onTasksChange(updated);
    setNewTaskText('');
    dataStore.showNotification('Tarefa adicionada à sua lista de hoje! 📝', 'success');
  };

  const handleToggleTask = (id: string) => {
    const updated = tasks.map(t => {
      if (t.id === id) {
        const nextState = !t.completed;
        if (nextState) {
          dataStore.showNotification('Excelente progresso! Tarefa concluída. 🌟', 'success');
        }
        return { ...t, completed: nextState };
      }
      return t;
    });
    onTasksChange(updated);
  };

  const handleDeleteTask = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = tasks.filter(t => t.id !== id);
    onTasksChange(updated);
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8 md:py-12 animate-fade-in space-y-8 select-none">
      {/* HEADER SECTION */}
      <div className="text-center space-y-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#6e7572]">
          Evolução do Dia
        </span>
        <h2 className="text-3xl font-black tracking-tight text-text-primary uppercase font-sans">
          Lista de Tarefas
        </h2>
        <p className="text-xs text-text-secondary/70 font-medium max-w-md mx-auto leading-normal">
          Defina, acompanhe e triture suas metas para hoje.
        </p>
      </div>

      {/* STATS HERO GRID */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* PROGRESS CARD */}
        <div className="md:col-span-2 p-6 rounded-3xl bg-surface/10 border border-border-white flex flex-col justify-between space-y-4">
          <div className="space-y-1">
            <p className="text-xs font-bold uppercase tracking-wider text-text-secondary/60 font-sans">Aproveitamento</p>
            <h3 className="text-2xl font-bold text-text-primary tracking-tight">
              Você fez <span className="text-green font-extrabold">{completedCount}</span> de <span className="text-text-primary font-extrabold">{totalCount}</span> tarefas planejadas
            </h3>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between items-center text-[10px] font-mono font-bold text-text-secondary">
              <span>PROGRESSO</span>
              <span className="text-green">{progressPercent}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
              <motion.div 
                className="h-full bg-green rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>
          </div>
        </div>

        {/* MOTIVATION CARD */}
        <div className="p-6 rounded-3xl bg-surface/10 border border-border-white flex flex-col justify-between text-center md:text-left">
          <div className="space-y-1.5">
            <span className="text-2xl block select-none">🎯</span>
            <h4 className="text-sm font-bold text-text-primary uppercase tracking-wide">Foco Impecável</h4>
            <p className="text-xs text-text-secondary/70 leading-relaxed font-light">
              Mantenha o ritmo. Cada tarefa concluída é um passo a mais em direção à maestria.
            </p>
          </div>
        </div>
      </div>

      {/* ADD TASK INPUT */}
      <form onSubmit={handleAddTask} className="flex gap-2.5 w-full bg-white/5 border border-white/10 rounded-2xl p-1.5 focus-within:border-green/45 focus-within:bg-white/[0.07] transition-all">
        <input
          type="text"
          value={newTaskText}
          onChange={(e) => setNewTaskText(e.target.value)}
          placeholder="Escreva sua próxima tarefa para hoje..."
          className="flex-1 bg-transparent border-none outline-none text-sm text-text-primary px-4 font-sans focus:ring-0 placeholder:text-text-secondary/35 min-h-[44px]"
        />
        <button
          type="submit"
          className="px-5 bg-green hover:brightness-115 active:scale-95 text-background rounded-xl font-bold uppercase tracking-wider text-[10px] transition-all flex items-center gap-1.5 shrink-0 select-none cursor-pointer"
        >
          <Plus size={14} strokeWidth={2.5} />
          <span>Adicionar</span>
        </button>
      </form>

      {/* LIST CONTENT */}
      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {tasks.length > 0 ? (
            tasks.map((task) => (
              <motion.div
                key={task.id}
                layoutId={task.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`p-5 rounded-2xl border transition-all flex items-center justify-between group relative ${
                  task.completed 
                    ? 'bg-white/[0.01] border-white/5 text-text-secondary/40' 
                    : 'bg-surface/5 border-border-white hover:border-green/20'
                }`}
                onClick={() => handleToggleTask(task.id)}
              >
                <div className="flex items-center gap-4 cursor-pointer flex-1 mr-4">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleTask(task.id);
                    }}
                    className={`w-5 h-5 rounded flex items-center justify-center transition-all ${
                      task.completed 
                        ? 'bg-green text-background' 
                        : 'border border-text-secondary/40 hover:border-green/50 text-transparent'
                    }`}
                  >
                    <Check size={12} strokeWidth={3} />
                  </button>
                  <span className={`text-sm font-medium leading-relaxed break-words line-clamp-2 ${task.completed ? 'line-through text-text-secondary/30 font-light' : 'text-text-primary'}`}>
                    {task.description}
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0 relative z-10">
                  <button
                    onClick={(e) => handleDeleteTask(task.id, e)}
                    className="p-2 text-text-secondary/30 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all cursor-pointer opacity-0 group-hover:opacity-100 max-md:opacity-100"
                    title="Excluir"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </motion.div>
            ))
          ) : (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-16 border border-dashed border-white/5 rounded-3xl select-none"
            >
              <div className="text-3xl block mb-3">📝</div>
              <h4 className="text-sm font-bold text-text-primary uppercase tracking-wider mb-1">Nenhuma tarefa por enquanto</h4>
              <p className="text-xs text-text-secondary/40 leading-relaxed font-light max-w-xs mx-auto">
                Sua lista está limpa. Adicione tarefas acima para planejar as conquistas do seu dia!
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* QUICK SUGGESTIONS BLOCK */}
      <div className="p-6 rounded-3xl bg-surface/5 border border-white/5 space-y-4">
        <h4 className="text-[10px] font-bold uppercase tracking-wider text-text-secondary/40">Ideias de Foco Prontas</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            'Trabalho ininterrupto (Deep Work)',
            'Estudar programação por 1 hora',
            'Leitura silenciosa sem distrações',
            'Sessão de exercícios ou Alongamento',
            'Planejamento Semanal / Check-in',
            'Organização da Área de Trabalho'
          ].map((item, idx) => (
            <button
              key={idx}
              onClick={() => {
                if (tasks.some(t => t.description === item)) return;
                const newTask: DailyTask = {
                  id: `task-${Date.now()}-${idx}`,
                  description: item,
                  completed: false,
                  created_at: new Date().toISOString()
                };
                onTasksChange([...tasks, newTask]);
                dataStore.showNotification(`"${item}" adicionada! 🚀`);
              }}
              className="text-left text-xs bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 rounded-xl px-4 py-3 text-text-secondary hover:text-text-primary transition-all cursor-pointer truncate"
            >
              ➕ {item}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
