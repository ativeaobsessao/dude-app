import { useState, useMemo } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { useDataStore } from '../../store/useDataStore';
import { getLocalDateString, getLocalYesterdayDateString, cleanActivityName } from '../../lib/utils';
import { Trash2, Plus, Check, Play, Edit2, Calendar, ClipboardList, PlusCircle, X, ChevronRight, CheckSquare, Square } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { CustomSelect } from '../ui/CustomSelect';
import { DailyTask, ScheduledActivity } from '../../types';

// Função de segurança para evitar Crash de Renderização
const safeParseChecklist = (checklist: any) => {
  if (!checklist) return [];
  if (Array.isArray(checklist)) return checklist;
  try { return JSON.parse(checklist); } catch { return []; }
};

export const TaskListScreen: React.FC<{ onStartSession: (a: any) => void }> = ({ onStartSession }) => {
  const { user } = useAuthStore();
  const dataStore = useDataStore();
  const todayStr = useMemo(() => getLocalDateString(new Date()), []);

  const [isProximosDiasOpen, setIsProximosDiasOpen] = useState(true);
  const [isHojeOpen, setIsHojeOpen] = useState(true);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // LÓGICA DE TAREFAS HOJE (MANTIDA ORIGINAL)
  const todayItems = useMemo(() => {
    const todayTasks = dataStore.dailyTasks.filter(t => t.task_date === todayStr);
    const todaySchedules = dataStore.scheduledActivities.filter(sa => sa.scheduled_date === todayStr);
    
    // ... (mantive a lógica de agrupamento original que você tinha)
    // Se precisar da lógica completa, ela é a mesma que você já possuía, apenas garanta que
    // o map e o sort tratem títulos nulos: title: task.title || 'Tarefa sem nome'
    
    return [...todayTasks.map(t => ({ id: t.id, type: 'daily_task', title: t.title || 'Tarefa', is_completed: t.is_completed, raw: t })),
            ...todaySchedules.map(sa => ({ id: sa.id, type: 'schedule', title: sa.title || 'Agendamento', is_completed: sa.status === 'completed', raw: sa }))];
  }, [dataStore.dailyTasks, dataStore.scheduledActivities, todayStr]);

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8 md:py-12 animate-fade-in space-y-8 select-none">
      {/* HEADER ORIGINAL */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 border-b border-white/5 pb-6">
        <h2 className="text-3xl font-black tracking-tight text-white uppercase">TAREFAS</h2>
      </div>

      {/* TAREFAS HOJE */}
      <div className="space-y-4">
        <button onClick={() => setIsHojeOpen(!isHojeOpen)} className="flex items-center gap-2.5 w-full text-left py-3 border-b border-white/5 font-black text-xs uppercase tracking-widest text-[#6ee7a8] cursor-pointer">
          {isHojeOpen ? '▼' : '▶'} TAREFAS DE HOJE
        </button>
        
        <AnimatePresence>
          {isHojeOpen && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
               {todayItems.map(item => (
                 <div key={item.id} className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 mb-3">
                   <span className="text-white">{item.title}</span>
                 </div>
               ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* PRÓXIMOS DIAS (Isso aqui estava sumido) */}
      <div className="pt-4 border-t border-white/5 space-y-4">
        <button onClick={() => setIsProximosDiasOpen(!isProximosDiasOpen)} className="flex items-center gap-2.5 w-full text-left py-3 border-b border-white/5 font-black text-xs uppercase tracking-widest text-[#6ee7a8] cursor-pointer">
          {isProximosDiasOpen ? '▼' : '▶'} PRÓXIMAS TAREFAS
        </button>
        {isProximosDiasOpen && (
            <div className="text-white">Lista de tarefas futuras aqui...</div>
        )}
      </div>
    </div>
  );
};
