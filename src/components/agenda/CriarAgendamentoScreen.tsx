import { useState, useMemo, useEffect } from 'react';
import { useDataStore } from '../../store/useDataStore';
import { useAuthStore } from '../../store/useAuthStore';
import { CustomSelect } from '../ui/CustomSelect';
import { Plus, Trash2, Calendar, Clock, AlertTriangle, X } from 'lucide-react';
import { getLocalDateString } from '../../lib/utils';
import { ScheduledActivity } from '../../types';

interface CriarAgendamentoScreenProps {
  onBack: () => void;
  onClose: () => void;
  editingActivity?: ScheduledActivity;
}

export const CriarAgendamentoScreen = ({ onBack, onClose, editingActivity }: CriarAgendamentoScreenProps) => {
  const dataStore = useDataStore();
  const { user } = useAuthStore();

  // Primary Input States
  const [projectId, setProjectId] = useState(editingActivity?.project_id || '');
  const [activityId, setActivityId] = useState(editingActivity?.activity_id || '');
  const [activityManual, setActivityManual] = useState(editingActivity?.atividade_avulsa || '');
  const [habitId, setHabitId] = useState(editingActivity?.habit_id || '');

  // Scheduled Date / Defaults to today
  const [scheduledDate, setScheduledDate] = useState(
    editingActivity?.scheduled_date || getLocalDateString(new Date())
  );

  // Scheduled Start Time
  const initialStartTime = editingActivity?.scheduled_time || '09:00';
  const [scheduledTime, setScheduledTime] = useState<string>(initialStartTime);
  const [startHours, setStartHours] = useState<string>(initialStartTime.split(':')[0] || '09');
  const [startMins, setStartMins] = useState<string>(initialStartTime.split(':')[1] || '00');

  // Checklist Integrated
  const [tasks, setTasks] = useState<string[]>(editingActivity?.tasks || []);
  const [newTaskInput, setNewTaskInput] = useState('');

  // Additional fields
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [conflictWarning, setConflictWarning] = useState<{ name: string; time: string; end: string; payload: any } | null>(null);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  // Duration in minutes
  const [durationMinutes, setDurationMinutes] = useState<number>(
    editingActivity?.duration_minutes ?? 30
  );

  // Helper utility converters
  function timeToMinutes(timeStr: string): number {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  }

  function minutesToTime(totalMinutes: number): string {
    const normalized = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
    const h = Math.floor(normalized / 60);
    const m = normalized % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  // End Time variables, reactive to start time + duration
  const initialEndTime = editingActivity
    ? minutesToTime(timeToMinutes(editingActivity.scheduled_time) + editingActivity.duration_minutes)
    : '09:30';
  const [endHours, setEndHours] = useState<string>(initialEndTime.split(':')[0] || '09');
  const [endMins, setEndMins] = useState<string>(initialEndTime.split(':')[1] || '30');

  // Duration inputs split in state (HH:MM)
  const initialDuration = editingActivity?.duration_minutes ?? 30;
  const initialHours = Math.floor(initialDuration / 60);
  const initialMins = initialDuration % 60;

  const [durationHours, setDurationHours] = useState<string>(
    String(initialHours).padStart(2, '0')
  );
  const [durationMinsState, setDurationMinsState] = useState<string>(
    String(initialMins).padStart(2, '0')
  );

  // Sync changes to duration with main variables and end times
  const updateDurationMinutesVal = (hrsStr: string, minsStr: string) => {
    const h = parseInt(hrsStr, 10) || 0;
    const m = parseInt(minsStr, 10) || 0;
    const total = h * 60 + m;
    setDurationMinutes(total);

    const calculatedEnd = minutesToTime(timeToMinutes(scheduledTime) + total);
    const [eh, em] = calculatedEnd.split(':');
    setEndHours(eh || '00');
    setEndMins(em || '00');
  };

  const updateStartAndEndTime = (sh: string, sm: string, dur: number) => {
    const sHNum = parseInt(sh, 10) || 0;
    const sMNum = parseInt(sm, 10) || 0;
    const formattedStart = `${String(sHNum).padStart(2, '0')}:${String(sMNum).padStart(2, '0')}`;
    setScheduledTime(formattedStart);

    const calculatedEnd = minutesToTime(timeToMinutes(formattedStart) + dur);
    const [eh, em] = calculatedEnd.split(':');
    setEndHours(eh || '00');
    setEndMins(em || '00');
  };

  // ----------------- START TIME HANDLERS -----------------
  const handleStartHoursChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 2);
    setStartHours(raw);
    const hrsNum = parseInt(raw, 10) || 0;
    if (hrsNum <= 23) {
      updateStartAndEndTime(raw, startMins, durationMinutes);
    }
  };

  const handleStartHoursBlur = () => {
    let hNum = parseInt(startHours, 10) || 0;
    if (hNum > 23) hNum = 23;
    const formatted = String(hNum).padStart(2, '0');
    setStartHours(formatted);
    updateStartAndEndTime(formatted, startMins, durationMinutes);
  };

  const handleStartMinsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 2);
    setStartMins(raw);
    const minsNum = parseInt(raw, 10) || 0;
    if (minsNum <= 59) {
      updateStartAndEndTime(startHours, raw, durationMinutes);
    }
  };

  const handleStartMinsBlur = () => {
    let mNum = parseInt(startMins, 10) || 0;
    if (mNum > 59) mNum = 59;
    const formatted = String(mNum).padStart(2, '0');
    setStartMins(formatted);
    updateStartAndEndTime(startHours, formatted, durationMinutes);
  };

  // ----------------- DURATION HANDLERS -----------------
  const handleHoursChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 2);
    setDurationHours(raw);

    const hNum = parseInt(raw, 10) || 0;
    if (hNum <= 23) {
      updateDurationMinutesVal(raw, durationMinsState);
    }
  };

  const handleHoursBlur = () => {
    let hNum = parseInt(durationHours, 10) || 0;
    if (hNum > 23) hNum = 23;
    const formatted = String(hNum).padStart(2, '0');
    setDurationHours(formatted);
    updateDurationMinutesVal(formatted, durationMinsState);
  };

  const handleMinutesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 2);
    setDurationMinsState(raw);

    const mNum = parseInt(raw, 10) || 0;
    if (mNum <= 59) {
      updateDurationMinutesVal(durationHours, raw);
    }
  };

  const handleMinutesBlur = () => {
    let mNum = parseInt(durationMinsState, 10) || 0;
    if (mNum > 59) mNum = 59;
    
    // Safety check: duration cannot be 0 minutes
    const hNum = parseInt(durationHours, 10) || 0;
    let finalMinsStr = String(mNum).padStart(2, '0');
    if (hNum === 0 && mNum === 0) {
      finalMinsStr = '30';
      setDurationMinsState('30');
    } else {
      setDurationMinsState(finalMinsStr);
    }
    updateDurationMinutesVal(durationHours, finalMinsStr);
  };

  // Filter activities by currently selected project
  const filteredActivities = useMemo(() => {
    if (!projectId) return dataStore.activities;
    return dataStore.activities.filter(a => a.project_id === projectId);
  }, [dataStore.activities, projectId]);

  // Checklist utilities matching SessionDeep exactly
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
    if (!scheduledDate || !scheduledTime || !durationMinutes) return null;

    const startCandidate = timeToMinutes(scheduledTime);
    const endCandidate = startCandidate + durationMinutes;

    const conflict = dataStore.scheduledActivities.find(item => {
      if (editingActivity && item.id === editingActivity.id) return false;
      if (item.scheduled_date !== scheduledDate) return false;
      if (item.status === 'cancelled' || item.status === 'completed') return false;

      // Exclude if it has been converted/registered to a focus session
      const isLinkedToSession = dataStore.sessions.some(s => s.scheduled_activity_id === item.id);
      if (isLinkedToSession || item.completed_session_id) return false;

      // Exclude if scheduled date is in the past
      const now = new Date();
      const itemDateStr = item.scheduled_date; // YYYY-MM-DD
      const itemTimeStr = item.scheduled_time; // HH:MM
      const itemDateTime = new Date(`${itemDateStr}T${itemTimeStr}:00`);
      if (itemDateTime < now) return false;

      const startExisting = timeToMinutes(item.scheduled_time);
      const endExisting = startExisting + item.duration_minutes;

      return startCandidate < endExisting && endCandidate > startExisting;
    });

    return conflict || null;
  };

  // Save the scheduled activity
  const handleSave = async (bypass = false) => {
    setErrorMsg(null);

    if (!user) {
      setErrorMsg('Usuário não autenticado.');
      return;
    }

    // Resolve name of the scheduled activity according to prioritization
    let resolvedTitle = '';
    if (activityManual.trim()) {
      resolvedTitle = activityManual.trim();
    } else if (activityId) {
      resolvedTitle = dataStore.activities.find(a => a.id === activityId)?.name || 'Atividade';
    } else if (habitId) {
      resolvedTitle = dataStore.habits.find(h => h.id === habitId)?.name || 'Hábito';
    }

    if (!resolvedTitle) {
      setErrorMsg('Por favor, informe uma Atividade, um Hábito ou digite uma Atividade Avulsa.');
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

    if (durationMinutes < 1) {
      setErrorMsg('A duração deve ser de pelo menos 1 minuto.');
      return;
    }

    const payload = {
      user_id: user.id,
      title: resolvedTitle,
      project_id: projectId || null,
      habit_id: habitId || null,
      activity_id: activityId || null,
      atividade_avulsa: activityManual.trim() || null,
      scheduled_date: scheduledDate,
      scheduled_time: scheduledTime,
      duration_minutes: durationMinutes,
      notes: null,
      tasks: tasks,
      completed_session_id: editingActivity ? editingActivity.completed_session_id : null
    };

    if (!bypass) {
      const conflictingActivity = checkConflict();
      if (conflictingActivity) {
        let conflictName = conflictingActivity.atividade_avulsa || 'Atividade Sem Título';
        if (conflictingActivity.habit_id) {
          conflictName = dataStore.habits.find(h => h.id === conflictingActivity.habit_id)?.name || conflictName;
        } else if (conflictingActivity.activity_id) {
          conflictName = dataStore.activities.find(a => a.id === conflictingActivity.activity_id)?.name || conflictName;
        }
        setConflictWarning({
          name: conflictName,
          time: conflictingActivity.scheduled_time,
          end: minutesToTime(timeToMinutes(conflictingActivity.scheduled_time) + conflictingActivity.duration_minutes),
          payload
        });
        return;
      }
    }

    if (editingActivity) {
      const success = await dataStore.updateScheduledActivity(editingActivity.id, payload);
      if (success) {
        setConflictWarning(null);
        dataStore.showNotification('Agendamento salvo com sucesso ✓');
        onBack();
      } else {
        setErrorMsg('Erro interno ao atualizar no banco de dados.');
      }
    } else {
      const saved = await dataStore.addScheduledActivity(payload);
      if (saved) {
        setConflictWarning(null);
        dataStore.showNotification('Agendamento salvo com sucesso ✓');
        onBack();
      } else {
        setErrorMsg('Erro interno ao salvar no banco de dados.');
      }
    }
  };

  // Custom visual capitalizing date label (e.g. "HOJE • 26/05/2026")
  const todayStr = useMemo(() => getLocalDateString(new Date()), []);
  const dataFormatadaLabel = useMemo(() => {
    if (!scheduledDate) return '';
    const isToday = scheduledDate === todayStr;
    const parts = scheduledDate.split('-');
    const yyyy = parts[0];
    const mm = parts[1];
    const dd = parts[2];

    if (isToday) {
      return `HOJE • ${dd}/${mm}/${yyyy}`;
    } else {
      try {
        const dateObj = new Date(scheduledDate + 'T00:00:00');
        const weekday = dateObj.toLocaleDateString('pt-BR', { weekday: 'short' });
        const capitalized = weekday.charAt(0).toUpperCase() + weekday.slice(1).replace('.', '');
        return `${capitalized} • ${dd}/${mm}/${yyyy}`;
      } catch (e) {
        return `${dd}/${mm}/${yyyy}`;
      }
    }
  }, [scheduledDate, todayStr]);

  const labelClasses = "text-[10px] font-bold uppercase tracking-widest text-text-secondary opacity-70 mb-2 block";
  const inputClasses = "w-full bg-white/5 border border-white/20 rounded-2xl p-4 text-text-primary outline-none focus:border-primary-green transition-all placeholder:text-text-secondary/50 touch-manipulation min-h-[44px]";

  return (
    <div className="w-full max-w-2xl space-y-8 flex flex-col items-stretch px-1">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-text-secondary hover:text-primary-green transition-all font-bold uppercase tracking-widest text-[10px] self-start"
      >
        ← Voltar ao Menu
      </button>

      <div className="space-y-4 text-left">
        <div>
          <h3 className="text-3xl font-bold tracking-tight text-text-primary">
            {editingActivity ? 'Editar Agendamento' : 'Novo Agendamento'}
          </h3>
          <p className="text-xs text-text-secondary/60 mt-1">
            {editingActivity 
              ? 'Atualize as configurações e o horário da sua Sessão Profunda planejada.' 
              : 'Configure o dia e horário para a sua atividade inteligente.'}
          </p>
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
                <span className="font-bold text-[1rem]/[1.5rem] text-amber-200">Aviso de Conflito de Horário</span>
                <p className="text-xs opacity-90 leading-relaxed">
                  ⚠️ Já existe a Sessão Profunda <strong className="text-amber-100">"{conflictWarning.name}"</strong> agendada para este mesmo dia, das <strong className="text-amber-100">{conflictWarning.time} às {conflictWarning.end}</strong>.
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



        <div className="bg-surface/10 p-6 md:p-8 rounded-[2.5rem] border border-white/5 space-y-6">
          
          {/* SEÇÕES DE INPUT UNIFICADAS VERTICALMENTE */}
          <div className="space-y-5">
            
            {/* 1. VINCULAR PROJETO (OPCIONAL) */}
            <div className="space-y-1">
              <label className={labelClasses}>1. VINCULAR PROJETO (OPCIONAL)</label>
              <CustomSelect
                value={projectId}
                onChange={(val) => {
                  setProjectId(val);
                  setActivityId('');
                }}
                placeholder="Selecione o Projeto"
                options={[
                  { value: '', label: 'Sem Projeto' },
                  ...dataStore.projects.map(p => ({ value: p.id, label: p.name }))
                ]}
              />
            </div>

            {/* 2. ATIVIDADE CATALOGADA (OPCIONAL) */}
            <div className="space-y-1">
              <label className={labelClasses}>2. SELECIONAR ATIVIDADE CATALOGADA (OPCIONAL)</label>
              <CustomSelect
                value={activityId}
                onChange={(val) => setActivityId(val)}
                placeholder="Atividades do Projeto Selecionado"
                options={[
                  { value: '', label: 'Nenhuma Selecionada' },
                  ...filteredActivities.map(a => ({ value: a.id, label: a.name }))
                ]}
              />
            </div>

            {/* 3. ATIVIDADE AVULSA (CAMPO TEXTO) */}
            <div className="space-y-1 text-left">
              <label className={labelClasses}>3. ATIVIDADE AVULSA (TEXTO OPCIONAL)</label>
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  placeholder="Ex: Enviar relatório do trimestre"
                  className={`${inputClasses} flex-1`}
                  value={activityManual}
                  onChange={(e) => setActivityManual(e.target.value)}
                  onFocus={() => setFocusedField('atividade_avulsa')}
                  onBlur={() => {
                    setTimeout(() => setFocusedField(curr => curr === 'atividade_avulsa' ? null : curr), 200);
                  }}
                />
                {focusedField === 'atividade_avulsa' && (
                  <button
                    type="button"
                    onMouseDown={(e) => {
                        e.preventDefault();
                        setFocusedField(null);
                        if (document.activeElement instanceof HTMLElement) {
                          document.activeElement.blur();
                        }
                    }}
                    className="px-5 py-4 bg-primary-green text-background text-[11px] font-extrabold uppercase tracking-wider rounded-2xl hover:bg-glow-green transition-all shadow-[0_4px_12px_rgba(110,231,168,0.2)] shrink-0 h-[58px]"
                  >
                    OK
                  </button>
                )}
              </div>
            </div>

            {/* 4. VINCULAR HÁBITO (OPCIONAL) */}
            <div className="space-y-1">
              <label className={labelClasses}>4. VINCULAR HÁBITO (OPCIONAL)</label>
              <CustomSelect
                value={habitId}
                onChange={(val) => setHabitId(val)}
                placeholder="Selecione o Hábito"
                options={[
                  { value: '', label: 'Nenhum Hábito' },
                  ...dataStore.habits.filter(h => h.habit_mode !== 'avoid').map(h => ({ value: h.id, label: h.name }))
                ]}
              />
            </div>

            {/* 5. TAREFAS INTEGRADAS (CHECKLIST PREMIUM COMPATIVEL SESSÃO PROFUNDA) */}
            <div className="space-y-3 pt-2">
              <label className={labelClasses}>TAREFAS DA SESSÃO (OPCIONAL)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  autoComplete="off"
                  autoCorrect="off"
                  enterKeyHint="done"
                  inputMode="text"
                  placeholder="O que você vai executar nessa sessão?"
                  className={`${inputClasses} flex-1`}
                  value={newTaskInput}
                  onChange={e => setNewTaskInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && newTaskInput.trim()) {
                      e.preventDefault();
                      setTasks([...tasks, newTaskInput.trim()]);
                      setNewTaskInput('');
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                  onBlur={() => {
                    if (newTaskInput.trim()) {
                      setTasks([...tasks, newTaskInput.trim()]);
                      setNewTaskInput('');
                    }
                  }}
                />
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    if (newTaskInput.trim()) {
                      setTasks([...tasks, newTaskInput.trim()]);
                      setNewTaskInput('');
                    }
                  }}
                  className="w-12 h-12 bg-primary-green/20 hover:bg-primary-green/30 border border-primary-green/30 rounded-2xl flex items-center justify-center text-primary-green transition-all shrink-0"
                >
                  <Plus size={18} />
                </button>
              </div>

              {/* Lista compacta de tarefas */}
              {tasks.length > 0 && (
                <div className="space-y-2 mt-2">
                  {tasks.map((task, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/10">
                      <div className="w-2 h-2 rounded-full bg-white/20 shrink-0" />
                      <span className="text-xs sm:text-sm text-text-primary flex-1 font-light break-all text-left">{task}</span>
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setTasks(tasks.filter((_, idx) => idx !== i));
                        }}
                        className="text-red-500/40 hover:text-red-500 transition-colors p-1"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          <div className="border-t border-white/5 pt-6" />

          {/* BLOCO DE AGENDAMENTO — RECONSTRUÇÃO COMPLETA */}
          <div className="space-y-4">
            <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#6ee7a8] block text-left">
              Configurações de Agenda
            </span>
            
            {/* ONE BOX PER LINE ON DESKTOP & MOBILE */}
            <div className="flex flex-col gap-5 w-full">
              
              {/* DATE BLOCK */}
              <div className="space-y-1 text-left w-full min-w-0">
                <div className="flex justify-between items-center mb-1">
                  <label className={labelClasses}>DATA</label>
                  {dataFormatadaLabel && (
                    <span className="text-[8px] font-extrabold text-[#6ee7a8] uppercase tracking-widest bg-[#6ee7a8]/10 px-2.5 py-1 rounded-full shrink-0">
                      {dataFormatadaLabel}
                    </span>
                  )}
                </div>
                <div className="flex gap-2 items-center relative">
                  <div className="relative flex-1">
                    <input
                      type="date"
                      className="w-full bg-white/5 border border-white/20 rounded-2xl p-4 pl-11 text-text-primary text-sm outline-none focus:border-[#6ee7a8] transition-all min-h-[58px]"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      onFocus={() => setFocusedField('data')}
                      onBlur={() => {
                        setTimeout(() => setFocusedField(curr => curr === 'data' ? null : curr), 200);
                      }}
                    />
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary/40 pointer-events-none" size={16} />
                  </div>
                  {focusedField === 'data' && (
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setFocusedField(null);
                        if (document.activeElement instanceof HTMLElement) {
                          document.activeElement.blur();
                        }
                      }}
                      className="px-4 py-4 bg-primary-green text-background text-[11px] font-extrabold uppercase tracking-wider rounded-2xl hover:bg-glow-green transition-all shadow-[0_4px_12px_rgba(110,231,168,0.2)] shrink-0 min-h-[58px]"
                    >
                      OK
                    </button>
                  )}
                </div>
              </div>

              {/* HORÁRIO DE INÍCIO (HH | MM CONTAINER) */}
              <div className="space-y-1 text-left w-full min-w-0">
                <label className={labelClasses}>HORÁRIO DE INÍCIO</label>
                <div className="flex gap-2 items-center">
                  <div className="flex-1 flex items-center justify-center bg-white/5 border border-white/20 rounded-2xl px-3 min-h-[58px] gap-1">
                    <div className="flex-1 flex flex-col items-center">
                      <span className="text-[7.5px] font-bold text-text-secondary/40 uppercase tracking-widest">Horas</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        className="w-full bg-transparent text-center font-bold text-sm text-text-primary outline-none py-1"
                        maxLength={2}
                        value={startHours}
                        onChange={handleStartHoursChange}
                        onBlur={handleStartHoursBlur}
                        onFocus={(e) => {
                          e.target.select();
                          setFocusedField('inicio');
                        }}
                      />
                    </div>
                    <span className="text-text-secondary/40 font-bold text-sm select-none mb-1">:</span>
                    <div className="flex-1 flex flex-col items-center">
                      <span className="text-[7.5px] font-bold text-text-secondary/40 uppercase tracking-widest">Minutos</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        className="w-full bg-transparent text-center font-bold text-sm text-text-primary outline-none py-1"
                        maxLength={2}
                        value={startMins}
                        onChange={handleStartMinsChange}
                        onBlur={handleStartMinsBlur}
                        onFocus={(e) => {
                          e.target.select();
                          setFocusedField('inicio');
                        }}
                      />
                    </div>
                  </div>
                  {focusedField === 'inicio' && (
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleStartHoursBlur();
                        handleStartMinsBlur();
                        setFocusedField(null);
                        if (document.activeElement instanceof HTMLElement) {
                          document.activeElement.blur();
                        }
                      }}
                      className="px-4 py-4 bg-primary-green text-background text-[11px] font-extrabold uppercase tracking-wider rounded-2xl hover:bg-glow-green transition-all shadow-[0_4px_12px_rgba(110,231,168,0.2)] shrink-0 min-h-[58px]"
                    >
                      OK
                    </button>
                  )}
                </div>
              </div>

              {/* DURAÇÃO (DUAL CONTAINER) */}
              <div className="space-y-1 text-left w-full min-w-0">
                <label className={labelClasses}>DURAÇÃO</label>
                <div className="flex gap-2 items-center">
                  <div className="flex-1 flex items-center justify-center bg-white/5 border border-white/20 rounded-2xl px-3 min-h-[58px] gap-1">
                    <div className="flex-1 flex flex-col items-center">
                      <span className="text-[7.5px] font-bold text-text-secondary/40 uppercase tracking-widest">Horas</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        className="w-full bg-transparent text-center font-bold text-sm text-text-primary outline-none py-1"
                        maxLength={2}
                        value={durationHours}
                        onChange={handleHoursChange}
                        onBlur={handleHoursBlur}
                        onFocus={(e) => {
                          e.target.select();
                          setFocusedField('duracao');
                        }}
                      />
                    </div>
                    <span className="text-text-secondary/40 font-bold text-sm select-none mb-1">:</span>
                    <div className="flex-1 flex flex-col items-center">
                      <span className="text-[7.5px] font-bold text-text-secondary/40 uppercase tracking-widest">Minutos</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        className="w-full bg-transparent text-center font-bold text-sm text-text-primary outline-none py-1"
                        maxLength={2}
                        value={durationMinsState}
                        onChange={handleMinutesChange}
                        onBlur={handleMinutesBlur}
                        onFocus={(e) => {
                          e.target.select();
                          setFocusedField('duracao');
                        }}
                      />
                    </div>
                  </div>
                  {focusedField === 'duracao' && (
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleHoursBlur();
                        handleMinutesBlur();
                        setFocusedField(null);
                        if (document.activeElement instanceof HTMLElement) {
                          document.activeElement.blur();
                        }
                      }}
                      className="px-4 py-4 bg-primary-green text-background text-[11px] font-extrabold uppercase tracking-wider rounded-2xl hover:bg-glow-green transition-all shadow-[0_4px_12px_rgba(110,231,168,0.2)] shrink-0 min-h-[58px]"
                    >
                      OK
                    </button>
                  )}
                </div>
              </div>

              {/* HORÁRIO DE ENCERRAMENTO (HH | MM CONTAINER AUTO-CALCULATED) */}
              <div className="space-y-1 text-left w-full min-w-0">
                <label className={labelClasses}>HORÁRIO DE ENCERRAMENTO</label>
                <div className="flex gap-2 items-center">
                  <div className="flex-1 flex items-center justify-center bg-white/[0.02] border border-white/10 rounded-2xl px-3 min-h-[58px] gap-1 opacity-70">
                    <div className="flex-1 flex flex-col items-center">
                      <span className="text-[7.5px] font-bold text-text-secondary/40 uppercase tracking-widest">Horas</span>
                      <input
                        type="text"
                        readOnly
                        className="w-full bg-transparent text-center font-bold text-sm text-text-primary/70 outline-none py-1 select-none pointer-events-none"
                        value={endHours}
                      />
                    </div>
                    <span className="text-text-secondary/40 font-bold text-sm select-none mb-1">:</span>
                    <div className="flex-1 flex flex-col items-center">
                      <span className="text-[7.5px] font-bold text-text-secondary/40 uppercase tracking-widest">Minutos</span>
                      <input
                        type="text"
                        readOnly
                        className="w-full bg-transparent text-center font-bold text-sm text-text-primary/70 outline-none py-1 select-none pointer-events-none"
                        value={endMins}
                      />
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>

          <div className="border-t border-white/5 pt-6" />

          {/* BOTÃO PRINCIPAL DE SALVAR/AGENDAR */}
          <button
            onClick={() => handleSave()}
            className="w-full py-5 bg-primary-green hover:brightness-110 text-background rounded-2xl font-bold uppercase tracking-widest text-[10px] transition-all shadow-[0_0_30px_rgba(110,231,168,0.2)]"
          >
            {editingActivity ? 'SALVAR ALTERAÇÕES' : 'CONFIRMAR AGENDAMENTO'}
          </button>

          {/* Divisor */}
          <div className="border-t border-white/10 mt-8 mb-6" />

          <div className="flex justify-center">
            <button
              onClick={() => {
                onClose();
                window.dispatchEvent(new CustomEvent('navigate-to-agenda'));
              }}
              className="text-[10px] font-bold uppercase tracking-widest text-primary-green border-b border-primary-green/30 pb-1 hover:border-primary-green transition-all"
            >
              VER TODAS ATIVIDADES PROGRAMADAS
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
