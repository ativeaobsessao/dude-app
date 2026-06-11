import React, { useState, useMemo } from 'react';
import { useDataStore } from '../../store/useDataStore';
import { X, Plus } from 'lucide-react';
import { motion } from 'motion/react';

interface EditSessionModalProps {
  session: any;
  onClose: () => void;
}

export const EditSessionModal: React.FC<EditSessionModalProps> = ({ session, onClose }) => {
  const dataStore = useDataStore();
  const [projectId, setProjectId] = useState(session.project_id || '');
  
  // Resolve configured activity and activity avulsa
  const [activityId, setActivityId] = useState(session.activity_id || '');
  const [activityAvulsa, setActivityAvulsa] = useState(() => {
    if (!session.activity_id) {
      return (session.activity_name && session.activity_name !== 'Sessão Sem Título') ? session.activity_name : '';
    }
    const linked = dataStore.activities.find(a => a.id === session.activity_id);
    if (linked && session.activity_name !== linked.name) {
      return session.activity_name || '';
    }
    return '';
  });

  const [durationMinutes, setDurationMinutes] = useState(session.duration_minutes || 0);
  const [actualDurationMinutes, setActualDurationMinutes] = useState(session.actual_duration_minutes ?? session.duration_minutes);
  const [taskInput, setTaskInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const sessionTasks = dataStore.sessionTasks.filter(t => t.session_id === session.id);

  const filteredActivities = useMemo(() => {
    if (!projectId) return dataStore.activities;
    return dataStore.activities.filter(a => a.project_id === projectId);
  }, [dataStore.activities, projectId]);

  const handleAddTask = async () => {
    if (!taskInput.trim()) return;
    try {
      await dataStore.addSessionTask(session.id, session.user_id, taskInput.trim(), false);
      setTaskInput('');
    } catch (err) {
      console.error('Erro ao adicionar tarefa:', err);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Determine final activity_name
      let finalActivityName = 'Sessão Sem Título';
      if (activityId) {
        const linked = dataStore.activities.find(a => a.id === activityId);
        finalActivityName = activityAvulsa.trim() || linked?.name || 'Sessão Sem Título';
      } else if (activityAvulsa.trim()) {
        finalActivityName = activityAvulsa.trim();
      }

      const updatesByField = {
        project_id: projectId || null,
        activity_id: activityId || null,
        activity_name: finalActivityName,
        duration_minutes: durationMinutes,
        actual_duration_minutes: actualDurationMinutes,
        parcial: actualDurationMinutes < durationMinutes
      };
      
      await dataStore.updateSession(session.id, updatesByField);
      onClose();
    } catch (err) {
      console.error('Erro ao salvar sessão:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[600] bg-background/85 backdrop-blur-md flex items-center justify-center p-4 text-left"
    >
      <motion.div
        initial={{ scale: 0.95, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 10 }}
        className="bg-surface/95 border border-white/5 rounded-2xl w-full max-w-lg p-6 space-y-6 shadow-2xl overflow-y-auto max-h-[90vh]"
      >
        <div className="flex justify-between items-center border-b border-white/5 pb-4">
          <h3 className="text-[1rem]/[1.5rem] font-semibold text-text-primary tracking-tight">
            Editar Sessão Profunda
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-white/5 rounded-lg transition-all cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4">
          {/* Vinculo de projeto */}
          <div className="space-y-1.5 text-left">
            <label className="text-[10px] font-bold uppercase tracking-widest text-[#6a7570]">Vincular Projeto</label>
            <select
              value={projectId}
              onChange={e => setProjectId(e.target.value)}
              className="w-full bg-surface/50 border border-white/5 rounded-xl py-2.5 px-3 text-sm text-text-primary outline-none focus:border-primary-green transition-all cursor-pointer"
            >
              <option value="">Nenhum / Geral</option>
              {dataStore.projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Atividade */}
          <div className="space-y-1.5 text-left">
            <label className="text-[10px] font-bold uppercase tracking-widest text-[#6a7570]">Atividade</label>
            <select
              value={activityId}
              onChange={e => setActivityId(e.target.value)}
              className="w-full bg-surface/50 border border-white/5 rounded-xl py-2.5 px-3 text-sm text-text-primary outline-none focus:border-primary-green transition-all cursor-pointer"
            >
              <option value="">Nenhuma</option>
              {filteredActivities.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          {/* Atividade Avulsa */}
          <div className="space-y-1.5 text-left">
            <label className="text-[10px] font-bold uppercase tracking-widest text-[#6a7570]">Atividade Avulsa (Opcional)</label>
            <input
              type="text"
              value={activityAvulsa}
              onChange={e => setActivityAvulsa(e.target.value)}
              className="w-full bg-surface/50 border border-white/5 rounded-xl py-2.5 px-3 text-sm text-text-primary outline-none focus:border-primary-green transition-all placeholder:text-text-secondary/30"
              placeholder="Ex: Estruturar headline da VSL"
            />
          </div>

          {/* Durações */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5 text-left">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[#6a7570]">Duração Meta (min)</label>
              <input
                type="number"
                value={durationMinutes}
                onChange={e => setDurationMinutes(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full bg-surface/50 border border-white/5 rounded-xl py-2.5 px-3 text-sm text-text-primary outline-none focus:border-primary-green transition-all"
              />
            </div>
            <div className="space-y-1.5 text-left">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[#6a7570]">Tempo Real (min)</label>
              <input
                type="number"
                value={actualDurationMinutes}
                onChange={e => setActualDurationMinutes(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full bg-surface/50 border border-white/5 rounded-xl py-2.5 px-3 text-sm text-text-primary outline-none focus:border-primary-green transition-all"
              />
            </div>
          </div>

          {/* Checklist de tarefas realizadas */}
          <div className="pt-4 border-t border-white/5 space-y-3 text-left">
            <label className="text-[10px] font-bold uppercase tracking-widest text-[#6a7570] block">Checklist de Execução</label>
            
            <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1">
              {sessionTasks.length === 0 ? (
                <p className="text-[11px] text-text-secondary/30 italic">Nenhuma checklist registrada para esta sessão.</p>
              ) : (
                sessionTasks.map(task => (
                  <div key={task.id} className="flex items-center gap-2 group/task bg-white/[0.02] border border-white/5 rounded-lg py-1 px-2.5">
                    <input
                      type="checkbox"
                      checked={task.completed}
                      onChange={() => dataStore.toggleSessionTask(task.id)}
                      className="w-3.5 h-3.5 rounded border-white/10 bg-surface text-primary-green focus:ring-0 checked:bg-primary-green checked:border-transparent cursor-pointer"
                    />
                    <input
                      type="text"
                      value={task.description}
                      onChange={e => dataStore.updateSessionTaskDescription(task.id, e.target.value)}
                      className="bg-transparent border-0 outline-none text-xs text-text-primary col-span-1 py-0 px-0 focus:ring-0 flex-1 min-w-0"
                    />
                    <button
                      onClick={() => dataStore.deleteSessionTask(task.id)}
                      className="p-1 text-red-500/40 hover:text-red-500 rounded hover:bg-white/5 transition-all opacity-0 group-hover/task:opacity-100 cursor-pointer"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={taskInput}
                onChange={e => setTaskInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddTask(); } }}
                placeholder="Adicionar tarefa realizada..."
                className="flex-1 bg-surface/50 border border-white/5 rounded-xl py-2 px-3 text-xs text-text-primary outline-none focus:border-primary-green transition-all"
              />
              <button
                type="button"
                onClick={handleAddTask}
                className="p-2 border border-white/10 rounded-xl hover:border-primary-green/30 text-text-secondary hover:text-primary-green transition-all cursor-pointer"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-[#6a7570] hover:text-text-primary transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-5 py-2 bg-primary-green text-background text-[10px] font-bold uppercase tracking-widest rounded-xl hover:bg-opacity-90 transition-all disabled:opacity-50 cursor-pointer"
          >
            {isSaving ? 'Ok...' : 'Ok'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};
