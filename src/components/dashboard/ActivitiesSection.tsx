import { useState } from 'react';
import { useDataStore } from '../../store/useDataStore';
import { Layers, ChevronDown, Plus, Trash2, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../lib/supabase';

export const ActivitiesSection = () => {
  const dataStore = useDataStore();
  const [isExpanded, setIsExpanded] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const activeCount = dataStore.activities.length;

  const handleDeleteActivity = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (deleteConfirmId !== id) {
      setDeleteConfirmId(id);
      return;
    }

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
      dataStore.showNotification('Erro ao excluir atividade', 'error');
    } finally {
      setDeleteConfirmId(null);
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
                    Sistemática Operacional: Defina as etapas, escopos ou categorias padrões de tarefas dos seus projetos.
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
                    const isDeletingThis = deleteConfirmId === activity.id;
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
                          <h4 className="text-sm font-bold text-text-primary uppercase tracking-wider">{activity.name}</h4>
                          <div className="flex flex-wrap gap-1.5 pt-0.5">
                            {linkedProjectName && (
                              <span className="text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-green/10 text-green border border-green/10">
                                💼 {linkedProjectName}
                              </span>
                            )}
                            {linkedHabitName && (
                              <span className="text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-400/10 text-amber-400 border border-amber-400/10">
                                🔥 {linkedHabitName}
                              </span>
                            )}
                            <span className="text-[8px] font-mono font-bold uppercase text-text-secondary/30 self-center">
                              Criada em {new Date(activity.created_at).toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                        </div>
                        <button 
                          onClick={(e) => handleDeleteActivity(e, activity.id)}
                          className={`p-3 rounded-xl transition-all flex items-center justify-center cursor-pointer border ${
                            isDeletingThis
                              ? 'bg-red-500/25 text-red-400 border-red-500/40 hover:bg-red-500/35'
                              : 'bg-white/5 hover:bg-white/10 text-text-secondary hover:text-red-400 border border-white/5'
                          }`}
                          title={isDeletingThis ? "Confirmar exclusão" : "Excluir atividade"}
                        >
                          {isDeletingThis ? <Check size={14} /> : <Trash2 size={14} />}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};
