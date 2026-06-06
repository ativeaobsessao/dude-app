import { useState, useEffect, useMemo } from 'react';
import { useDataStore } from '../../store/useDataStore';
import { ScheduledActivity } from '../../types';
import { getLocalDateString } from '../../lib/utils';
import { Plus, Trash2, X, Settings2 } from 'lucide-react';
import { CustomSelect } from '../ui/CustomSelect';

interface ReagendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  activity: ScheduledActivity | null;
  onOpenReconfigurar: (activity: ScheduledActivity) => void;
}

export const ReagendarModal = ({ isOpen, onClose, activity, onOpenReconfigurar }: ReagendarModalProps) => {
  const dataStore = useDataStore();
  const [dateField, setDateField] = useState('');
  
  // Start Time split
  const [startHH, setStartHH] = useState('09');
  const [startMM, setStartMM] = useState('00');

  // Duration split
  const [durHH, setDurHH] = useState('00');
  const [durMM, setDurMM] = useState('30');

  useEffect(() => {
    if (activity) {
      setDateField(activity.scheduled_date || getLocalDateString(new Date()));
      const [sh, sm] = (activity.scheduled_time || '09:00').split(':');
      setStartHH(sh || '09');
      setStartMM(sm || '00');

      const totalMinutes = activity.duration_minutes || 30;
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      setDurHH(String(hours).padStart(2, '0'));
      setDurMM(String(minutes).padStart(2, '0'));
    }
  }, [activity]);

  // Compute Encerramento [HH:MM]
  const endTimeCalculated = useMemo(() => {
    const shNum = parseInt(startHH, 10) || 0;
    const smNum = parseInt(startMM, 10) || 0;
    const dhNum = parseInt(durHH, 10) || 0;
    const dmNum = parseInt(durMM, 10) || 0;

    const totalStartMinutes = shNum * 60 + smNum;
    const totalDurationMinutes = dhNum * 60 + dmNum;
    const totalEndMinutes = (totalStartMinutes + totalDurationMinutes) % 1440; // wrap day

    const eh = Math.floor(totalEndMinutes / 60);
    const em = totalEndMinutes % 60;

    return `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
  }, [startHH, startMM, durHH, durMM]);

  if (!isOpen || !activity) return null;

  const handleSave = async () => {
    const shNum = Math.min(23, Math.max(0, parseInt(startHH, 10) || 0));
    const smNum = Math.min(59, Math.max(0, parseInt(startMM, 10) || 0));
    const dhNum = Math.min(23, Math.max(0, parseInt(durHH, 10) || 0));
    const dmNum = Math.min(59, Math.max(0, parseInt(durMM, 10) || 0));

    const finalStartTime = `${String(shNum).padStart(2, '0')}:${String(smNum).padStart(2, '0')}`;
    const finalDuration = dhNum * 60 + dmNum;

    const updates = {
      scheduled_date: dateField,
      scheduled_time: finalStartTime,
      duration_minutes: finalDuration
    };

    const success = await dataStore.updateScheduledActivity(activity.id, updates);
    if (success) {
      dataStore.showNotification('Agendamento remarcado com sucesso! 📅', 'success');
      onClose();
    } else {
      dataStore.showNotification('Erro ao reagendar atividade.', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-background/90 backdrop-blur-md">
      <div className="w-full max-w-md p-6 sm:p-8 rounded-3xl bg-surface-1 border border-white/5 shadow-2xl relative text-left">
        <button onClick={onClose} className="absolute top-4 right-4 text-text-secondary hover:text-text-primary transition-colors">
          <X size={20} />
        </button>

        <h3 className="text-xl sm:text-2xl font-bold text-text-primary tracking-tight">Reagendar Atividade</h3>
        <p className="text-xs text-text-secondary/60 mt-1 mb-6">Ajuste a data, horário e duração para o seu bloco de foco.</p>

        <div className="space-y-5">
          {/* Campo Data */}
          <div className="space-y-1.5 text-left">
            <label className="text-[10px] font-bold text-text-secondary/40 uppercase tracking-widest block">Data Programada</label>
            <input
              type="date"
              value={dateField}
              onChange={(e) => setDateField(e.target.value)}
              className="w-full h-[48px] px-4 rounded-xl bg-surface-2 border border-border-custom text-text-primary focus:border-[#6ee7a8]/50 focus:outline-none transition-all font-sans text-sm"
            />
          </div>

          {/* Campo Horário de Início — TWO CONTAINER [HH]|[MM] */}
          <div className="space-y-1.5 text-left">
            <label className="text-[10px] font-bold text-text-secondary/40 uppercase tracking-widest block">Horário de Início</label>
            <div className="flex items-center gap-2">
              <div className="flex-1 flex bg-surface-2 border border-border-custom rounded-xl divide-x divide-border-custom overflow-hidden h-[48px]">
                <input
                  type="number"
                  min="0"
                  max="23"
                  placeholder="HH"
                  value={startHH}
                  onChange={(e) => {
                    const val = e.target.value.slice(0, 2);
                    setStartHH(val);
                  }}
                  className="w-1/2 text-center bg-transparent text-text-primary focus:outline-none text-sm font-mono"
                />
                <input
                  type="number"
                  min="0"
                  max="59"
                  placeholder="MM"
                  value={startMM}
                  onChange={(e) => {
                    const val = e.target.value.slice(0, 2);
                    setStartMM(val);
                  }}
                  className="w-1/2 text-center bg-transparent text-text-primary focus:outline-none text-sm font-mono"
                />
              </div>
              <span className="text-xs text-text-secondary/40 font-mono">[HH] : [MM]</span>
            </div>
          </div>

          {/* Campo Duração — TWO CONTAINER [HH]|[MM] */}
          <div className="space-y-1.5 text-left">
            <label className="text-[10px] font-bold text-text-secondary/40 uppercase tracking-widest block">Duração Estimada</label>
            <div className="flex items-center gap-2">
              <div className="flex-1 flex bg-surface-2 border border-border-custom rounded-xl divide-x divide-border-custom overflow-hidden h-[48px]">
                <input
                  type="number"
                  min="0"
                  max="23"
                  placeholder="HH"
                  value={durHH}
                  onChange={(e) => {
                    const val = e.target.value.slice(0, 2);
                    setDurHH(val);
                  }}
                  className="w-1/2 text-center bg-transparent text-text-primary focus:outline-none text-sm font-mono"
                />
                <input
                  type="number"
                  min="0"
                  max="59"
                  placeholder="MM"
                  value={durMM}
                  onChange={(e) => {
                    const val = e.target.value.slice(0, 2);
                    setDurMM(val);
                  }}
                  className="w-1/2 text-center bg-transparent text-text-primary focus:outline-none text-sm font-mono"
                />
              </div>
              <span className="text-xs text-text-secondary/40 font-mono">[HH] : [MM]</span>
            </div>
          </div>

          {/* Encerramento Calculado — Read-only */}
          <div className="space-y-1.5 text-left bg-white/[0.02] p-3 rounded-xl border border-white/5">
            <div className="text-[10px] font-bold text-text-secondary/40 uppercase tracking-widest">Encerramento Programado</div>
            <div className="text-sm font-mono font-bold text-text-primary mt-1">🕒 {endTimeCalculated}</div>
            <div className="text-[9px] text-text-secondary/40 font-light mt-0.5">Calculado automaticamente com base no início e na duração.</div>
          </div>

          {/* Botão de Reconfigurar */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenReconfigurar(activity);
            }}
            className="w-full py-3 px-4 bg-white/5 hover:bg-white/10 text-text-primary hover:text-[#6ee7a8] font-bold uppercase tracking-wider text-[10px] rounded-xl transition-all flex items-center justify-center gap-2 border border-white/5"
          >
            <Settings2 size={12} />
            reconfigurar projeto / atividade / tarefas
          </button>
        </div>

        {/* Buttons Action */}
        <div className="grid grid-cols-2 gap-3 mt-8">
          <button
            onClick={onClose}
            className="py-3.5 px-4 bg-transparent hover:bg-white/5 text-text-secondary font-bold uppercase tracking-wider text-[10px] rounded-xl transition-all border border-white/5 cursor-pointer text-center"
          >
            Voltar
          </button>
          <button
            onClick={handleSave}
            className="py-3.5 px-4 bg-[#6ee7a8] hover:brightness-110 text-background font-bold uppercase tracking-wider text-[10px] rounded-xl transition-all cursor-pointer text-center"
          >
            Ok
          </button>
        </div>
      </div>
    </div>
  );
};

interface ReconfigurarModalProps {
  isOpen: boolean;
  onClose: () => void;
  activity: ScheduledActivity | null;
}

export const ReconfigurarModal = ({ isOpen, onClose, activity }: ReconfigurarModalProps) => {
  const dataStore = useDataStore();
  
  // Fields for session content
  const [projectId, setProjectId] = useState('');
  const [activityId, setActivityId] = useState('');
  const [avulsa, setAvulsa] = useState('');
  const [habitId, setHabitId] = useState('');
  const [tasks, setTasks] = useState<string[]>([]);
  const [newTask, setNewTask] = useState('');

  useEffect(() => {
    if (activity) {
      setProjectId(activity.project_id || '');
      setActivityId(activity.activity_id || '');
      setAvulsa(activity.atividade_avulsa || '');
      setHabitId(activity.habit_id || '');
      setTasks(activity.tasks || []);
    }
  }, [activity]);

  if (!isOpen || !activity) return null;

  // Options converters
  const projectOptions = dataStore.projects.map(p => ({ value: p.id, label: p.name || '' }));
  const activityOptions = dataStore.activities
    .filter(act => !projectId || act.project_id === projectId)
    .map(act => ({ value: act.id, label: act.name || '' }));
  const habitOptions = dataStore.habits.map(h => ({ value: h.id, label: h.name || '' }));

  const handleAddTask = () => {
    if (newTask.trim()) {
      setTasks([...tasks, newTask.trim()]);
      setNewTask('');
    }
  };

  const handleRemoveTask = (idx: number) => {
    setTasks(tasks.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    // Resolve Title
    let resolvedTitle = '';
    if (avulsa.trim()) {
      resolvedTitle = avulsa.trim();
    } else if (activityId) {
      resolvedTitle = dataStore.activities.find(a => a.id === activityId)?.name || 'Atividade';
    } else if (habitId) {
      resolvedTitle = dataStore.habits.find(h => h.id === habitId)?.name || 'Hábito';
    } else {
      resolvedTitle = activity.title; // Fallback
    }

    const updates = {
      project_id: projectId || null,
      activity_id: activityId || null,
      atividade_avulsa: avulsa.trim() || null,
      habit_id: habitId || null,
      tasks: tasks,
      title: resolvedTitle
    };

    const success = await dataStore.updateScheduledActivity(activity.id, updates);
    if (success) {
      dataStore.showNotification('Definições reconfiguradas com sucesso! 🛡️', 'success');
      onClose();
    } else {
      dataStore.showNotification('Erro ao reconfigurar agendamento.', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-background/90 backdrop-blur-md">
      <div className="w-full max-w-lg p-6 sm:p-8 rounded-3xl bg-surface-1 border border-white/5 shadow-2xl relative text-left max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 text-text-secondary hover:text-text-primary transition-colors">
          <X size={20} />
        </button>

        <h3 className="text-xl sm:text-2xl font-bold text-text-primary tracking-tight">Reconfigurar Projeto e Tarefas</h3>
        <p className="text-xs text-text-secondary/60 mt-1 mb-6">Modifique a vinculação de projeto, hábito e checklist de tarefas.</p>

        <div className="space-y-5">
          {/* Projeto Link */}
          <div className="space-y-1.5 text-left">
            <label className="text-[10px] font-bold text-text-secondary/40 uppercase tracking-widest block">Projeto Associado</label>
            <CustomSelect
              options={projectOptions}
              value={projectId}
              onChange={(val) => {
                setProjectId(val);
                setActivityId(''); // Clear linked activity
              }}
              placeholder="Nenhum Projeto"
            />
          </div>

          {/* Atividades Catalogadas */}
          <div className="space-y-1.5 text-left">
            <label className="text-[10px] font-bold text-text-secondary/40 uppercase tracking-widest block">Atividade Catalogada</label>
            <CustomSelect
              options={activityOptions}
              value={activityId}
              onChange={(val) => {
                setActivityId(val);
                if (val) setHabitId(''); // exclusivity
              }}
              placeholder="Nenhuma Atividade"
              disabled={projectId === ''}
            />
          </div>

          {/* Atividade Avulsa */}
          <div className="space-y-1.5 text-left">
            <label className="text-[10px] font-bold text-text-secondary/40 uppercase tracking-widest block">Atividade Avulsa (Se não catalogada)</label>
            <input
              type="text"
              value={avulsa}
              onChange={(e) => {
                setAvulsa(e.target.value);
                if (e.target.value) {
                  setActivityId('');
                  setHabitId('');
                }
              }}
              placeholder="Digite o foco da sessão..."
              className="w-full h-[48px] px-4 rounded-xl bg-surface-2 border border-border-custom text-text-primary focus:border-[#6ee7a8]/50 focus:outline-none transition-all font-sans text-sm"
            />
          </div>

          {/* Vincular Hábito */}
          <div className="space-y-1.5 text-left">
            <label className="text-[10px] font-bold text-text-secondary/40 uppercase tracking-widest block">Vincular a um Hábito</label>
            <CustomSelect
              options={habitOptions}
              value={habitId}
              onChange={(val) => {
                setHabitId(val);
                if (val) {
                  setActivityId('');
                  setAvulsa('');
                }
              }}
              placeholder="Nenhum Hábito"
            />
          </div>

          {/* Checklist de Tarefas */}
          <div className="space-y-2 text-left">
            <label className="text-[10px] font-bold text-text-secondary/40 uppercase tracking-widest block">Checklist de Tarefas para a Sessão</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddTask(); }}
                placeholder="Ex: Ler capítulo 3, Escrever introdução..."
                className="flex-1 h-[44px] px-4 rounded-xl bg-surface-2 border border-border-custom text-text-primary focus:border-[#6ee7a8]/50 focus:outline-none transition-all font-sans text-sm"
              />
              <button
                type="button"
                onClick={handleAddTask}
                className="h-[44px] px-4 bg-white/5 hover:bg-white/10 border border-white/5 text-text-primary rounded-xl transition-all cursor-pointer flex items-center justify-center font-bold text-sm"
              >
                <Plus size={16} />
              </button>
            </div>

            {/* List checklist items */}
            {tasks.length > 0 && (
              <div className="mt-3 p-3 rounded-2xl bg-white/[0.01] border border-white/5 space-y-2">
                {tasks.map((task, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-3 bg-surface-2/40 p-2.5 rounded-xl border border-white/5">
                    <span className="text-xs text-text-secondary font-medium">{task}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveTask(idx)}
                      className="text-red-400/60 hover:text-red-400 transition-colors p-1"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Buttons Action */}
        <div className="grid grid-cols-2 gap-3 mt-8">
          <button
            onClick={onClose}
            className="py-3.5 px-4 bg-transparent hover:bg-white/5 text-text-secondary font-bold uppercase tracking-wider text-[10px] rounded-xl transition-all border border-white/5 cursor-pointer text-center"
          >
            Voltar
          </button>
          <button
            onClick={handleSave}
            className="py-3.5 px-4 bg-[#6ee7a8] hover:brightness-110 text-background font-bold uppercase tracking-wider text-[10px] rounded-xl transition-all cursor-pointer text-center"
          >
            Ok
          </button>
        </div>
      </div>
    </div>
  );
};
