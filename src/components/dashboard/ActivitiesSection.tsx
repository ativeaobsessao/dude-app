import { useState } from 'react';
import { useDataStore } from '../../store/useDataStore';
import { Layers, ChevronDown, Plus, Trash2, Check, Pencil } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../lib/supabase';

export const ActivitiesSection = () => {
  const dataStore = useDataStore();
  const [isExpanded, setIsExpanded] = useState(false);
  const [activityToDelete, setActivityToDelete] = useState<any | null>(null);

  const activeCount = dataStore.activities.length;

  const confirmDeleteActivity = async (id: string) => {
    try {
      // Desvincular recursos da atividade
      const linkedTasks = dataStore.dailyTasks.filter(t => t.activity_id === id);
      for (const t of linkedTasks) {
        await supabase.from('daily_tasks').update({ activity_id: null }).eq('id', t.id);
      }
      const linkedSched = dataStore.scheduledActivities.filter(sa => sa.activity_id === id);
      for (const sa of linkedSched) {
        await supabase.from('scheduled_activities').update({ activity_id: null }).eq('id', sa.id);
      }
      
      // Estado local
      const updatedTasks = dataStore.dailyTasks.map(t => t.activity_id === id ? { ...t, activity_id: null } : t);
      const updatedSched = dataStore.scheduledActivities.map(sa => sa.activity_id === id ? { ...sa, activity_id: null } : sa);
      
      useDataStore.setState({
        dailyTasks: updatedTasks,
        scheduledActivities: updatedSched
      });

      await dataStore.deleteActivity(id);
      dataStore.showNotification('Atividade excluída com sucesso!', 'success');
    } catch (err) {
      console.error('Erro ao excluir atividade:', err);
      dataStore.showNotification('Erro: Não foi possível excluir a atividade. Verifique as dependências.', 'error');
    } finally {
      setActivityToDelete(null);
    }
  };


  return (
    <section id="activities-section" className="w-full max-w-5xl space-y-4">
      {/* Header Collapsible Trigger */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-6 bg-surface/20 hover:bg-surface/35 border border-border-white rounded-3xl flex items-center justify-between cursor-pointer transition-all duration-300 group"
      >
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-text-secondary/60 group-hover:bg-white/10 group-hover:text-text-primary transition-colors">
            <Layers size={18} />
          </div>
          <div className="text-left font-sans">
            <h3 className="text-lg font-semibold text-text-primary tracking-tight font-sans">Atividades</h3>
            <p className="text-xs text-text-secondary/60 mt-0.5 font-sans">
              {activeCount} {activeCount === 1 ? 'atividade registrada' : 'atividades registradas'}
            </p>
          </div>
        </div>
        <div className={`text-text-secondary/40 group-hover:text-text-primary transition-colors transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
          <ChevronDown size={20} />
        </div>
      </div>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="w-full p-6 bg-surface/20 border border-border-white rounded-3xl space-y-6">
              {/* Inner header & Action panel */}
              <div className="flex items-center justify-between flex-wrap gap-4 pb-2 border-b border-white/5">
                <div className="text-left max-w-sm md:max-w-md">
                  <p className="text-xs text-text-secondary/60 font-light">
                    Liste todas as atividades que você precisa fazer no seu dia a dia
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      window.dispatchEvent(new CustomEvent('open-action-center', { detail: { screen: 'activities' } }));
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-[#6ee7a8]/10 hover:bg-[#6ee7a8]/20 border border-[#6ee7a8]/20 rounded-xl text-xs font-bold uppercase tracking-wider text-[#6ee7a8] transition-all cursor-pointer"
                  >
                    <Plus size={14} />
                    + Nova Atividade
                  </button>
                </div>
              </div>

              {/* Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeCount === 0 ? (
                  <p className="text-text-secondary/40 font-light italic col-span-2 text-left p-2">Nenhuma atividade cadastrada.</p>
                ) : (
                  dataStore.activities.map(activity => {
                    const linkedProjectName = activity.project_id
                      ? dataStore.projects.find(p => p.id === activity.project_id)?.name
                      : null;
                    const linkedHabitName = activity.habit_id
                      ? dataStore.habits.find(h => h.id === activity.habit_id)?.name
                      : null;

                    return (
                      <div 
                        key={activity.id}
                        className="p-5 bg-surface/10 border border-border-white hover:border-primary-green/20 rounded-2xl flex justify-between items-center transition-all duration-200"
                      >
                        <div className="text-left space-y-1">
                          <h4 className="text-sm font-bold text-text-primary uppercase tracking-wider">{activity.name.split(/#HABIT:/i)[0].trim()}</h4>
                          <div className="flex flex-wrap gap-1.5 pt-0.5">
                            {linkedProjectName && (
                              <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-medium uppercase tracking-wider">
                                {linkedProjectName}
                              </span>
                            )}
                            {linkedHabitName && (
                              <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-medium uppercase tracking-wider">
                                {linkedHabitName}
                              </span>
                            )}
                            <span className="text-[8px] font-mono font-bold uppercase text-text-secondary/30 self-center">
                              Criada em {new Date(activity.created_at).toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => {
                              window.dispatchEvent(new CustomEvent('open-action-center', {
                                detail: { screen: 'activities', editActivityObj: activity }
                              }));
                            }}
                            className="p-3 bg-white/5 hover:bg-white/10 text-text-secondary hover:text-primary-green rounded-xl transition-all flex items-center justify-center cursor-pointer border border-white/5"
                            title="Editar atividade"
                          >
                            <Pencil size={14} />
                          </button>
                          <button 
                            onClick={() => setActivityToDelete(activity)}
                            className="p-3 bg-white/5 hover:bg-white/10 text-text-secondary hover:text-red-400 rounded-xl transition-all flex items-center justify-center cursor-pointer border border-white/5"
                            title="Excluir atividade"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activityToDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1000] bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="w-full max-w-sm bg-surface border border-white/5 p-8 rounded-[2rem] text-center space-y-6 shadow-2xl"
            >
              <div className="w-14 h-14 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto">
                <Trash2 size={24} />
              </div>
              <div className="space-y-2">
                <h4 className="text-lg font-bold text-text-primary">
                  Excluir Atividade?
                </h4>
                <p className="text-text-secondary/85 text-xs leading-relaxed font-light">
                  Tem certeza que deseja excluir a atividade <span className="text-text-primary font-semibold">"{activityToDelete.name}"</span>? Esta ação não pode ser desfeita e irá desvincular recursos relacionados.
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setActivityToDelete(null)}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-text-secondary/80 rounded-xl font-bold uppercase tracking-wider text-[10px] transition-all cursor-pointer border border-white/5"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => confirmDeleteActivity(activityToDelete.id)}
                  className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold uppercase tracking-wider text-[10px] transition-all cursor-pointer shadow-lg shadow-red-500/15"
                >
                  Excluir
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};
