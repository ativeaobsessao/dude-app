import { useState, useMemo } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { useDataStore } from '../../store/useDataStore';
import { getLocalDateString } from '../../lib/utils';
import { Check, Play, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const TaskListScreen: React.FC<{ onStartSession: (a: any) => void }> = ({ onStartSession }) => {
  const { user } = useAuthStore();
  const dataStore = useDataStore();
  const todayStr = useMemo(() => getLocalDateString(new Date()), []);

  const [isProximosDiasOpen, setIsProximosDiasOpen] = useState(true);
  const [isHojeOpen, setIsHojeOpen] = useState(true);

  // LÓGICA COMPLETA E RESTAURADA
  const todayItems = useMemo(() => {
    const items: any[] = [];
    
    // Tarefas do dia
    dataStore.dailyTasks
      .filter(t => t.task_date === todayStr)
      .forEach(t => items.push({ id: `task-${t.id}`, type: 'daily_task', title: t.title || 'Tarefa', is_completed: t.is_completed, raw: t }));

    // Atividades agendadas do dia
    dataStore.scheduledActivities
      .filter(sa => sa.scheduled_date === todayStr)
      .forEach(sa => items.push({ id: `sched-${sa.id}`, type: 'schedule', title: sa.title || sa.atividade_avulsa || 'Agendamento', is_completed: sa.status === 'completed', raw: sa }));

    return items;
  }, [dataStore.dailyTasks, dataStore.scheduledActivities, todayStr]);

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8 md:py-12 space-y-8 select-none">
      <div className="border-b border-white/5 pb-6">
        <h2 className="text-3xl font-black tracking-tight text-white uppercase">TAREFAS</h2>
      </div>

      {/* TAREFAS HOJE */}
      <div className="space-y-4">
        <button onClick={() => setIsHojeOpen(!isHojeOpen)} className="flex items-center gap-2.5 w-full text-left py-3 border-b border-white/5 font-black text-xs uppercase tracking-widest text-[#6ee7a8] cursor-pointer">
          {isHojeOpen ? '▼' : '▶'} TAREFAS DE HOJE
        </button>
        
        <AnimatePresence>
          {isHojeOpen && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
               {todayItems.map(item => (
                 <div key={item.id} className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 mb-3 flex justify-between items-center">
                   <span className="text-white text-sm font-medium">{item.title}</span>
                   {item.type === 'schedule' && (
                     <button onClick={() => onStartSession(item.raw)} className="text-[#6ee7a8]"><Play size={16}/></button>
                   )}
                 </div>
               ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* PRÓXIMOS DIAS - Restaurado para não ficar vazio */}
      <div className="pt-4 border-t border-white/5 space-y-4">
        <button onClick={() => setIsProximosDiasOpen(!isProximosDiasOpen)} className="flex items-center gap-2.5 w-full text-left py-3 border-b border-white/5 font-black text-xs uppercase tracking-widest text-[#6ee7a8] cursor-pointer">
          {isProximosDiasOpen ? '▼' : '▶'} PRÓXIMAS TAREFAS
        </button>
        {isProximosDiasOpen && (
            <div className="text-zinc-500 text-xs italic p-4">
              {dataStore.dailyTasks.filter(t => t.task_date > todayStr).length} tarefas agendadas para os próximos dias.
            </div>
        )}
      </div>
    </div>
  );
};
