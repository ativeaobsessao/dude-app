import { useState, useMemo } from 'react';
import { useDataStore } from '../../store/useDataStore';
import { useAuthStore } from '../../store/useAuthStore';
import { CustomSelect } from '../ui/CustomSelect';
import { Plus, Trash2, Calendar, Clock, BookOpen, AlertTriangle } from 'lucide-react';

interface CriarAgendamentoScreenProps {
  onBack: () => void;
  onClose: () => void;
}

export const CriarAgendamentoScreen = ({ onBack, onClose }: CriarAgendamentoScreenProps) => {
  const dataStore = useDataStore();
  const { user } = useAuthStore();

  const [projectId, setProjectId] = useState('');
  const [habitId, setHabitId] = useState('');
  const [activityId, setActivityId] = useState('');
  const [activityManual, setActivityManual] = useState('');
  const [scheduledDate, setScheduledDate] = useState(new Date().toISOString().split('T')[0]);
  const [scheduledTime, setScheduledTime] = useState('09:00');
  const [endTime, setEndTime] = useState<string>('');
  const [durationMinutes, setDurationMinutes] = useState<number | ''>(30);
  const [notes, setNotes] = useState('');
  
  // Custom tasks for the scheduled activity
  const [tasks, setTasks] = useState<string[]>([]);
  const [newTaskInput, setNewTaskInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [conflictWarning, setConflictWarning] = useState<{ name: string; time: string; end: string; payload: any } | null>(null);

  // Converte "HH:MM" para minutos desde 00:00
  function timeToMinutes(time: string): number {
    if (!time) return 0;
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  }

  // Converte minutos desde 00:00 para "HH:MM"  
  function minutesToTime(totalMinutes: number): string {
    // Normaliza pra não passar de 23:59
    const normalized = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
    const h = Math.floor(normalized / 60);
    const m = normalized % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  // Calcula duração em minutos entre dois horários
  function calculateDurationMinutes(start: string, end: string): number {
    if (!start || !end) return 0;
    return timeToMinutes(end) - timeToMinutes(start);
  }

  const isEndTimeInvalid = useMemo(() => {
    if (!endTime || !scheduledTime) return false;
    return timeToMinutes(endTime) <= timeToMinutes(scheduledTime);
  }, [endTime, scheduledTime]);

  const handleEndTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setEndTime(val);
    if (val && scheduledTime) {
      const dur = calculateDurationMinutes(scheduledTime, val);
      if (dur > 0) {
        setDurationMinutes(dur);
      }
    }
  };

  const handleStartTimeChange = (val: string) => {
    setScheduledTime(val);
    if (endTime && val) {
      const dur = calculateDurationMinutes(val, endTime);
      if (dur > 0) {
        setDurationMinutes(dur);
      } else {
        setEndTime('');
      }
    }
  };

  const handleDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === '') {
      setDurationMinutes('');
      return;
    }
    const num = parseInt(val, 10);
    if (!isNaN(num) && num >= 0) {
      setDurationMinutes(num);
      if (scheduledTime) {
        setEndTime(minutesToTime(timeToMinutes(scheduledTime) + num));
      }
    }
  };

  const handleDurationBlur = () => {
    if (durationMinutes === '' || (typeof durationMinutes === 'number' && durationMinutes < 1)) {
      setDurationMinutes(1);
      if (scheduledTime) {
        setEndTime(minutesToTime(timeToMinutes(scheduledTime) + 1));
      }
    }
  };

  // Filter activities by selected project
  const filteredActivities = useMemo(() => {
    if (!projectId) return dataStore.activities;
    return dataStore.activities.filter(a => a.project_id === projectId);
  }, [dataStore.activities, projectId]);

  const handleAddTask = () => {
    if (!newTaskInput.trim()) return;
    setTasks([...tasks, newTaskInput.trim()]);
    setNewTaskInput('');
  };

  const handleRemoveTask = (index: number) => {
    setTasks(tasks.filter((_, i) => i !== index));
  };

  // Conflict Overlap Check
  const checkConflict = () => {
    const currentDur = typeof durationMinutes === 'number' ? durationMinutes : 0;
    if (!scheduledDate || !scheduledTime || !currentDur) return null;

    const [candH, candM] = scheduledTime.split(':').map(Number);
    const startCandidate = candH * 60 + candM;
    const endCandidate = startCandidate + currentDur;

    // Search existing scheduled activities (excluding canceled) for overlaps
    const conflict = dataStore.scheduledActivities.find(item => {
      if (item.scheduled_date !== scheduledDate) return false;
      if (item.status === 'cancelled') return false;

      const [extH, extM] = item.scheduled_time.split(':').map(Number);
      const startExisting = extH * 60 + extM;
      const endExisting = startExisting + item.duration_minutes;

      // Overlap calculation
      return startCandidate < endExisting && endCandidate > startExisting;
    });

    return conflict || null;
  };

  const handleSave = async (bypass = false) => {
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!user) {
      setErrorMsg('Usuário não autenticado.');
      return;
    }

    // Resolve name of the scheduled activity
    let resolvedTitle = '';
    if (habitId) {
      resolvedTitle = dataStore.habits.find(h => h.id === habitId)?.name || 'Hábito';
    } else if (activityId) {
      resolvedTitle = dataStore.activities.find(a => a.id === activityId)?.name || 'Atividade';
    } else {
      resolvedTitle = activityManual.trim();
    }

    if (!resolvedTitle) {
      setErrorMsg('Por favor, informe uma Atividade, um Hábito ou digite um título avulso.');
      return;
    }

    if (!scheduledDate) {
      setErrorMsg('Por favor, selecione a data do agendamento.');
      return;
    }

    if (!scheduledTime) {
      setErrorMsg('Por favor, defina o horário de início.');
      return;
    }

    if (endTime) {
      const dur = calculateDurationMinutes(scheduledTime, endTime);
      if (dur <= 0) {
        setErrorMsg('O horário final deve ser maior que o horário de início.');
        return;
      }
    }

    if (typeof durationMinutes !== 'number' || durationMinutes < 1) {
      setErrorMsg('A duração deve ser de pelo menos 1 minuto.');
      return;
    }

    const payload = {
      user_id: user.id,
      title: resolvedTitle,
      project_id: projectId || null,
      habit_id: habitId || null,
      activity_id: activityId || null,
      atividade_avulsa: habitId || activityId ? null : activityManual.trim(),
      scheduled_date: scheduledDate,
      scheduled_time: scheduledTime,
      duration_minutes: durationMinutes,
      notes: notes.trim() || null,
      tasks: tasks,
      completed_session_id: null
    };

    if (!bypass) {
      // Checking for scheduling conflicts
      const conflictingActivity = checkConflict();
      if (conflictingActivity) {
        let conflictName = conflictingActivity.atividade_avulsa || 'Sessão Sem Título';
        if (conflictingActivity.habit_id) {
          conflictName = dataStore.habits.find(h => h.id === conflictingActivity.habit_id)?.name || conflictName;
        } else if (conflictingActivity.activity_id) {
          conflictName = dataStore.activities.find(a => a.id === conflictingActivity.activity_id)?.name || conflictName;
        }
        setConflictWarning({
          name: conflictName,
          time: conflictingActivity.scheduled_time,
          end: addMinutesToTime(conflictingActivity.scheduled_time, conflictingActivity.duration_minutes),
          payload
        });
        return;
      }
    }

    const saved = await dataStore.addScheduledActivity(payload);
    if (saved) {
      setConflictWarning(null);
      setSuccessMsg('✅ Atividade agendada com sucesso!');
      setTimeout(() => {
        onBack();
      }, 1500);
    } else {
      setErrorMsg('Erro interno ao salvar no banco de dados.');
    }
  };

  const addMinutesToTime = (timeStr: string, minutes: number) => {
    const [h, m] = timeStr.split(':').map(Number);
    const totalMinutes = h * 60 + m + minutes;
    const finalH = Math.floor(totalMinutes / 60) % 24;
    const finalM = totalMinutes % 60;
    return `${String(finalH).padStart(2, '0')}:${String(finalM).padStart(2, '0')}`;
  };

  // Custom styling classes replicates habits styling
  const labelClasses = "text-[10px] font-bold uppercase tracking-widest text-text-secondary opacity-70 mb-2 block";
  const inputClasses = "w-full bg-white/5 border border-white/20 rounded-2xl p-4 text-text-primary outline-none focus:border-primary-green transition-all placeholder:text-text-secondary/50 touch-manipulation min-h-[44px]";

  return (
    <div className="w-full max-w-2xl space-y-8 flex flex-col items-stretch">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-text-secondary hover:text-primary-green transition-all font-bold uppercase tracking-widest text-[10px] self-start"
      >
        ← Voltar ao Menu
      </button>

      <div className="space-y-4 text-left">
        <div>
          <h3 className="text-3xl font-bold tracking-tight text-text-primary">Novo Agendamento</h3>
          <p className="text-xs text-text-secondary/60 mt-1">Configure o dia e horário para a sua atividade inteligente.</p>
        </div>

        {errorMsg && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-3xl flex items-start gap-3 text-sm">
            <AlertTriangle className="shrink-0 text-red-400" size={18} />
            <div className="space-y-1">
              <span className="font-bold">Opção inválida</span>
              <p className="text-xs opacity-90">{errorMsg}</p>
            </div>
          </div>
        )}

        {conflictWarning && (
          <div className="bg-amber-500/10 border border-amber-500/30 text-amber-400 p-6 rounded-3xl flex flex-col gap-4 text-sm text-left">
            <div className="flex items-start gap-3">
              <AlertTriangle className="shrink-0 text-amber-500 mt-1" size={20} />
              <div className="space-y-1">
                <span className="font-bold text-base text-amber-200">Aviso de Conflito de Horário</span>
                <p className="text-xs opacity-90 leading-relaxed">
                  ⚠️ Já existe a atividade de foco <strong className="text-amber-100">"{conflictWarning.name}"</strong> agendada para este mesmo dia, das <strong className="text-amber-100">{conflictWarning.time} às {conflictWarning.end}</strong>.
                </p>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-2 pt-3 border-t border-amber-500/10 justify-end">
              <button
                type="button"
                onClick={() => setConflictWarning(null)}
                className="px-5 py-2.5 rounded-xl border border-white/10 hover:bg-white/5 text-text-primary text-xs font-bold uppercase tracking-widest transition-all"
              >
                Voltar e ajustar
              </button>
              <button
                type="button"
                onClick={() => handleSave(true)}
                className="px-5 py-2.5 rounded-xl bg-primary-green hover:brightness-110 text-background text-xs font-bold uppercase tracking-widest transition-all"
              >
                Salvar mesmo assim
              </button>
            </div>
          </div>
        )}

        {successMsg && (
          <div className="bg-primary-green/10 border border-primary-green/30 text-primary-green p-4 rounded-3xl flex items-center gap-3 text-sm">
            <span className="font-bold">{successMsg}</span>
          </div>
        )}

        <div className="bg-surface/10 p-8 rounded-[2.5rem] border border-white/5 space-y-6">
          
          {/* Tipo de atividade / Contexto */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className={labelClasses}>VINCULAR PROJETO (OPCIONAL)</label>
              <CustomSelect
                value={projectId}
                onChange={(val) => {
                  setProjectId(val);
                  setActivityId('');
                  setHabitId('');
                }}
                placeholder="Selecione o Projeto"
                options={[
                  { value: '', label: 'Sem Projeto' },
                  ...dataStore.projects.map(p => ({ value: p.id, label: p.name }))
                ]}
              />
            </div>

            <div className="space-y-1">
              <label className={labelClasses}>VINCULAR HÁBITO (OPCIONAL)</label>
              <CustomSelect
                value={habitId}
                onChange={(val) => {
                  setHabitId(val);
                  if (val) {
                    setActivityId('');
                    setActivityManual('');
                    setProjectId('');
                  }
                }}
                placeholder="Selecione o Hábito"
                options={[
                  { value: '', label: 'Nenhum Hábito' },
                  ...dataStore.habits.map(h => ({ value: h.id, label: h.name }))
                ]}
              />
            </div>
          </div>

          {!habitId && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className={labelClasses}>SELECIONAR ATIVIDADE CATALOGADA</label>
                <CustomSelect
                  value={activityId}
                  onChange={(val) => {
                    setActivityId(val);
                    if (val) setActivityManual('');
                  }}
                  placeholder="Atividades do Projeto"
                  options={[
                    { value: '', label: 'Nenhuma Selecionada' },
                    ...filteredActivities.map(a => ({ value: a.id, label: a.name }))
                  ]}
                />
              </div>

              <div className="space-y-1">
                <label className={labelClasses}>OU DIGITE ATIVIDADE AVULSA</label>
                <input
                  type="text"
                  disabled={!!activityId}
                  placeholder={activityId ? "Desativado (atividade selecionada)" : "Ex: Enviar relatório do trimestre..."}
                  className={`${inputClasses} ${activityId ? 'opacity-40 cursor-not-allowed' : ''}`}
                  value={activityManual}
                  onChange={(e) => setActivityManual(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="border-t border-white/5 pt-4" />

          {/* Data e Hora */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <label className={labelClasses}>DATA</label>
              <div className="relative">
                <input
                  type="date"
                  className={`${inputClasses} pl-10`}
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                />
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary/40" size={16} />
              </div>
            </div>

            <div className="space-y-1">
              <label className={labelClasses}>HORÁRIO DE INÍCIO</label>
              <div className="relative">
                <input
                  type="time"
                  className={`${inputClasses} pl-10`}
                  value={scheduledTime}
                  onChange={(e) => handleStartTimeChange(e.target.value)}
                />
                <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary/40" size={16} />
              </div>
            </div>

            <div className="space-y-1">
              <label className={labelClasses}>HORÁRIO FINAL (OPCIONAL)</label>
              <div className="relative">
                <input
                  type="time"
                  className={`${inputClasses} pl-10 ${
                    isEndTimeInvalid ? 'border-amber-500/40' : ''
                  }`}
                  style={isEndTimeInvalid ? { borderColor: 'rgba(251, 191, 36, 0.4)' } : undefined}
                  value={endTime}
                  onChange={handleEndTimeChange}
                />
                <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary/40" size={16} />
              </div>
              {isEndTimeInvalid && (
                <span className="text-[10px] text-[#fbbf24] mt-1 block leading-tight">
                  Horário final deve ser maior que o início
                </span>
              )}
            </div>

            <div className="space-y-1">
              <label className={labelClasses}>DURAÇÃO (MINUTOS)</label>
              <input
                type="number"
                min="1"
                placeholder="Ex: 45"
                className={`${inputClasses} text-center font-bold text-lg`}
                value={durationMinutes}
                onChange={handleDurationChange}
                onBlur={handleDurationBlur}
              />
            </div>
          </div>

          {/* Notas descritivas */}
          <div className="space-y-1">
            <label className={labelClasses}>NOTAS / REQUISITOS (OPCIONAL)</label>
            <textarea
              placeholder="Ex: Pegar protótipo no Figma e separar café forte antes do início..."
              className={`${inputClasses} min-h-[80px] resize-none py-3`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="border-t border-white/5 pt-4" />

          {/* Checklist / Tarefas pré-configuradas */}
          <div className="space-y-3">
            <label className={labelClasses}>CHECKLIST INTEGRADO (PÓS-SESSÃO)</label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Adicionar tarefa pré-configurada para esta sessão..."
                className={`${inputClasses} flex-1 py-3`}
                value={newTaskInput}
                onChange={(e) => setNewTaskInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTask();
                  }
                }}
              />
              <button
                type="button"
                onClick={handleAddTask}
                className="p-4 bg-primary-green/10 hover:bg-primary-green/20 text-primary-green rounded-2xl transition-all"
              >
                <Plus size={20} />
              </button>
            </div>

            {/* Renderizar tarefas listadas */}
            {tasks.length > 0 && (
              <div className="space-y-2 mt-2 bg-surface/5 p-4 rounded-3xl border border-white/5 max-h-[200px] overflow-y-auto">
                {tasks.map((task, index) => (
                  <div key={index} className="flex justify-between items-center bg-white/5 rounded-xl p-3 border border-white/5">
                    <span className="text-xs text-text-primary text-left font-mono">{task}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveTask(index)}
                      className="p-1.5 text-red-500/40 hover:text-red-500 hover:bg-red-500/10 rounded-full transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => handleSave()}
            className="w-full py-5 bg-primary-green hover:brightness-110 text-background rounded-2xl font-bold uppercase tracking-widest text-[10px] transition-all shadow-[0_0_30px_rgba(110,231,168,0.2)]"
          >
            CONFIRMAR AGENDAMENTO
          </button>
        </div>
      </div>
    </div>
  );
};
