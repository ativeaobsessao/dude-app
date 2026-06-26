import { useState, useMemo, useEffect } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { useDataStore } from '../../store/useDataStore';
import { getLocalDateString, getLocalYesterdayDateString, cleanActivityName } from '../../lib/utils';
import { Trash2, Plus, Check, Play, Edit2, Calendar, ClipboardList, PlusCircle, X, ChevronRight, CheckSquare, Square } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { CustomSelect } from '../ui/CustomSelect';
import { DailyTask, ScheduledActivity } from '../../types';
import { AgendamentoCard } from '../agenda/AgendamentoCard';

const isDelayed = (dateString: string) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const taskDate = new Date(dateString);
  if (isNaN(taskDate.getTime())) return false;
  taskDate.setHours(0, 0, 0, 0);
  
  return taskDate.getTime() < today.getTime();
};

const formatDelayedDate = (dateString: string) => {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
};

interface TaskListScreenProps {
  tasks: any[]; 
  onTasksChange: (newTasks: any[]) => void; 
  onStartSession: (activity: any) => void;
}

// Função auxiliar para garantir que o checklist seja sempre um Array válido
const parseSafeChecklist = (checklistRaw: any): { text: string; completed: boolean }[] => {
  if (!checklistRaw) return [];
  if (Array.isArray(checklistRaw)) return checklistRaw;
  if (typeof checklistRaw === 'string') {
    try {
      const parsed = JSON.parse(checklistRaw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

export const TaskListScreen: React.FC<TaskListScreenProps> = ({ onStartSession }) => {
  const { user } = useAuthStore();
  const dataStore = useDataStore();
  const todayStr = useMemo(() => getLocalDateString(new Date()), []);

  const [isProximosDiasOpen, setIsProximosDiasOpen] = useState(false);
  const [isHojeOpen, setIsHojeOpen] = useState(true);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // 1. GATHER ALL ITEMS OF TODAY
  const todayItems = useMemo(() => {
    const todayTasks = dataStore.dailyTasks.filter(t => t.task_date === todayStr);
    const todaySchedules = dataStore.scheduledActivities.filter(sa => sa.scheduled_date === todayStr);

    const todayObj = new Date();
    let dayOfWeek = todayObj.getDay();
    if (dayOfWeek === 0) dayOfWeek = 7;
    const dayOfWeekStr = String(dayOfWeek);

    const todayVirtualHabits = dataStore.habits
      .filter(habit => {
        if (!habit.is_scheduled) return false;
        if (!habit.sched_start) return false;
        if (habit.sched_weekdays === 'all') return true;
        const days = (habit.sched_weekdays || '').split(',');
        return days.includes(dayOfWeekStr);
      })
      .filter(habit => {
        const dbScheduleExists = dataStore.scheduledActivities.some(
          sa => sa.habit_id === habit.id && sa.scheduled_date === todayStr
        );
        return !dbScheduleExists;
      })
      .map(habit => {
        const isCompleted = dataStore.habitCompletions.some(hc => {
          if (hc.habit_id !== habit.id) return false;
          const compDateStr = getLocalDateString(new Date(hc.completed_at));
          return compDateStr === todayStr;
        });

        return {
          id: `habit-sched-${habit.id}-${todayStr}`,
          user_id: habit.user_id,
          habit_id: habit.id,
          project_id: null,
          activity_id: null,
          atividade_avulsa: habit.name,
          scheduled_date: todayStr,
          scheduled_time: habit.sched_start || '09:00',
          duration_minutes: habit.sched_duration || 45,
          status: isCompleted ? 'concluida' : 'pending',
          notes: 'Hábito Atômico Programado',
          tasks: [],
          is_habit_virtual: true
        } as unknown as ScheduledActivity;
      });

    const items: {
      id: string;
      type: 'daily_task' | 'schedule' | 'habit_virtual';
      title: string;
      time?: string;
      is_completed: boolean;
      raw: any;
    }[] = [];

    todayTasks.forEach(task => {
      items.push({
        id: `task-${task.id}`,
        type: 'daily_task',
        title: task.title || 'Nova Tarefa',
        is_completed: task.is_completed,
        raw: task
      });
    });

    todaySchedules.forEach(sa => {
      const isCompleted = sa.status === 'completed' || sa.status === 'concluida';
      const isCancelled = sa.status === 'cancelled' || sa.status === 'cancelada';
      if (!isCancelled || isCompleted) {
        items.push({
          id: `schedule-${sa.id}`,
          type: 'schedule',
          title: sa.title || sa.atividade_avulsa || 'Sessão Profunda Ocasional',
          time: sa.scheduled_time,
          is_completed: isCompleted,
          raw: sa
        });
      }
    });

    todayVirtualHabits.forEach(vh => {
      const isCompleted = vh.status === 'concluida';
      items.push({
        id: vh.id,
        type: 'habit_virtual',
        title: vh.atividade_avulsa || 'Hábito',
        time: vh.scheduled_time,
        is_completed: isCompleted,
        raw: vh
      });
    });

    return items.sort((a, b) => {
      if (a.time && b.time) return a.time.localeCompare(b.time);
      if (a.time) return -1;
      if (b.time) return 1;
      const titleA = a.title || '';
      const titleB = b.title || '';
      return titleA.localeCompare(titleB);
    });
  }, [dataStore.dailyTasks, dataStore.scheduledActivities, dataStore.habits, dataStore.habitCompletions, todayStr]);

  // 2. GATHER AND GROUP FUTURE ITEMS (PRÓXIMOS DIAS)
  const futureGroups = useMemo(() => {
    const groups: { [date: string]: any[] } = {};

    const addItem = (dateStr: string, item: any) => {
      if (!groups[dateStr]) {
        groups[dateStr] = [];
      }
      groups[dateStr].push(item);
    };

    dataStore.dailyTasks.forEach(task => {
      if (task.task_date > todayStr) {
        addItem(task.task_date, {
          id: `task-${task.id}`,
          type: 'daily_task',
          title: task.title || 'Nova Tarefa',
          is_completed: task.is_completed,
          raw: task
        });
      }
    });

    dataStore.scheduledActivities.forEach(sa => {
      if (sa.scheduled_date > todayStr) {
        const isCompleted = sa.status === 'completed' || sa.status === 'concluida';
        const isCancelled = sa.status === 'cancelled' || sa.status === 'cancelada';
        if (!isCancelled || isCompleted) {
          addItem(sa.scheduled_date, {
            id: `schedule-${sa.id}`,
            type: 'schedule',
            title: sa.title || sa.atividade_avulsa || 'Sessão Profunda Ocasional',
            time: sa.scheduled_time,
            is_completed: isCompleted,
            raw: sa
          });
        }
      }
    });

    for (let i = 1; i <= 7; i++) {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + i);
      const futureDateStr = getLocalDateString(futureDate);

      let dayOfWeek = futureDate.getDay();
      if (dayOfWeek === 0) dayOfWeek = 7;
      const dayOfWeekStr = String(dayOfWeek);

      const virtualHabits = dataStore.habits
        .filter(habit => {
          if (!habit.is_scheduled) return false;
          if (!habit.sched_start) return false;
          if (habit.sched_weekdays === 'all') return true;
          const days = (habit.sched_weekdays || '').split(',');
          return days.includes(dayOfWeekStr);
        })
        .filter(habit => {
          const dbScheduleExists = dataStore.scheduledActivities.some(
            sa => sa.habit_id === habit.id && sa.scheduled_date === futureDateStr
          );
          return !dbScheduleExists;
        })
        .map(habit => {
          const isCompleted = dataStore.habitCompletions.some(hc => {
            if (hc.habit_id !== habit.id) return false;
            const compDateStr = getLocalDateString(new Date(hc.completed_at));
            return compDateStr === futureDateStr;
          });

          return {
            id: `habit-sched-${habit.id}-${futureDateStr}`,
            user_id: habit.user_id,
            habit_id: habit.id,
            project_id: null,
            activity_id: null,
            atividade_avulsa: habit.name,
            scheduled_date: futureDateStr,
            scheduled_time: habit.sched_start || '09:00',
            duration_minutes: habit.sched_duration || 45,
            status: isCompleted ? 'concluida' : 'pending',
            notes: 'Hábito Atômico Programado',
            tasks: [],
            is_habit_virtual: true
          } as unknown as ScheduledActivity;
        });

      virtualHabits.forEach(vh => {
        const isCompleted = vh.status === 'concluida';
        addItem(futureDateStr, {
          id: vh.id,
          type: 'habit_virtual',
          title: vh.atividade_avulsa || 'Hábito',
          time: vh.scheduled_time,
          is_completed: isCompleted,
          raw: vh
        });
      });
    }

    const sortedDates = Object.keys(groups).sort();
    return sortedDates.map(date => {
      const items = groups[date].sort((a, b) => {
        if (a.time && b.time) return a.time.localeCompare(b.time);
        if (a.time) return -1;
        if (b.time) return 1;
        const titleA = a.title || '';
        const titleB = b.title || '';
        return titleA.localeCompare(titleB);
      });

      return { date, items };
    });
  }, [dataStore.dailyTasks, dataStore.scheduledActivities, dataStore.habits, dataStore.habitCompletions, todayStr]);

  // Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTask, setEditingTask] = useState<DailyTask | null>(null);

  // Form Fields State
  const [taskTitle, setTaskTitle] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedHabitId, setSelectedHabitId] = useState('');
  const [selectedActivityId, setSelectedActivityId] = useState('');
  const [activityManualText, setActivityManualText] = useState('');
  const [newSubtaskText, setNewSubtaskText] = useState('');
  const [subtasksList, setSubtasksList] = useState<{ text: string; completed: boolean }[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState('');

  // Event listener for Inbox Captures
  useEffect(() => {
    const handleOpenTask = (e: any) => {
      try {
        const { text, captureId } = e.detail;
        setEditingTask(null);
        setTaskTitle('Processar Captura');
        setActivityManualText(`${text} #CAPTURAS #TAREFADODIA`);
        
        setSelectedProjectId('');
        setSelectedHabitId('');
        setSelectedActivityId('');
        setSubtasksList([]);
        setShowCreateModal(true);
        
        if (captureId) {
          sessionStorage.setItem('pending_capture_conversion', captureId);
        }
      } catch (err) {
        console.error('Error handling capture task conversion:', err);
      }
    };
    
    window.addEventListener('open-task-from-capture', handleOpenTask);
    return () => window.removeEventListener('open-task-from-capture', handleOpenTask);
  }, []);

  const handleOpenCreateModal = () => {
    setEditingTask(null);
    setTaskTitle('');
    setSelectedProjectId('');
    setSelectedHabitId('');
    setSelectedActivityId('');
    setActivityManualText('');
    setNewSubtaskText('');
    setSubtasksList([]);
    setEditingIndex(null);
    setEditingValue('');
    setShowCreateModal(true);
  };

  const handleOpenEditModal = (task: DailyTask, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTask(task);
    setTaskTitle(task.title);
    setSelectedProjectId(task.project_id || '');
    setSelectedHabitId(task.habit_id || '');
    setSelectedActivityId(task.activity_id || '');
    setActivityManualText(task.activity_avulsa || '');
    setNewSubtaskText('');
    setSubtasksList(parseSafeChecklist(task.checklist));
    setEditingIndex(null);
    setEditingValue('');
    setShowCreateModal(true);
  };

  const handleFormAddSubtask = (e?: React.FormEvent, valueToSubmit?: string) => {
    if (e) e.preventDefault();
    const val = (typeof valueToSubmit === 'string' ? valueToSubmit : newSubtaskText).trim();
    if (!val) return;
    setSubtasksList(prev => [...prev, { text: val, completed: false }]);
    setNewSubtaskText('');
  };

  const handleFormRemoveSubtask = (index: number) => {
    setSubtasksList(subtasksList.filter((_, i) => i !== index));
    if (editingIndex === index) {
      setEditingIndex(null);
      setEditingValue('');
    }
  };

  const handleSaveSubtaskEdit = (index: number) => {
    const trimmedVal = editingValue.trim();
    if (!trimmedVal) {
      setSubtasksList(subtasksList.filter((_, i) => i !== index));
    } else {
      const updatedList = [...subtasksList];
      updatedList[index] = { ...updatedList[index], text: trimmedVal };
      setSubtasksList(updatedList);
    }
    setEditingIndex(null);
    setEditingValue('');
  };

  const handleSaveTask = async () => {
    if (!user) return;

    let computedTitle = '';
    if (activityManualText.trim()) {
      computedTitle = activityManualText.trim();
    } else if (selectedActivityId) {
      const act = dataStore.activities.find(a => a.id === selectedActivityId);
      computedTitle = act ? act.name : 'Meta de Atividade';
    } else if (selectedHabitId) {
      const habit = dataStore.habits.find(h => h.id === selectedHabitId);
      computedTitle = habit ? habit.name : 'Meta de Hábito';
    } else if (selectedProjectId) {
      const proj = dataStore.projects.find(p => p.id === selectedProjectId);
      computedTitle = proj ? `Meta: ${proj.name}` : 'Meta de Projeto';
    } else if (subtasksList.length > 0) {
      computedTitle = subtasksList[0].text;
    } else {
      computedTitle = 'Nova Tarefa';
    }

    const payload = {
      user_id: user.id,
      task_date: todayStr,
      title: computedTitle.trim(),
      project_id: selectedProjectId || null,
      habit_id: selectedHabitId || null,
      activity_id: selectedActivityId || null,
      activity_avulsa: activityManualText.trim() || null,
      checklist: subtasksList.length > 0 ? subtasksList : null,
      is_completed: editingTask ? editingTask.is_completed : false,
      completed_at: editingTask ? editingTask.completed_at : null,
      rolled_from_date: editingTask ? editingTask.rolled_from_date : null
    };

    if (editingTask) {
      await dataStore.updateDailyTask(editingTask.id, payload);
      dataStore.showNotification('Tarefa atualizada com sucesso! 📝', 'success');
    } else {
      await dataStore.addDailyTask(payload);
      dataStore.showNotification('Tarefa inserida na sua Lista de Hoje! 🎯', 'success');
      
      const captureId = sessionStorage.getItem('pending_capture_conversion');
      if (captureId) {
        await dataStore.deleteInboxCapture(captureId);
        sessionStorage.removeItem('pending_capture_conversion');
      }
    }

    setShowCreateModal(false);
    setEditingTask(null);
  };

  const handleToggleTaskCompletion = async (task: DailyTask, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextCompleted = !task.is_completed;
    const currentChecklist = parseSafeChecklist(task.checklist);

    if (nextCompleted) {
      window.dispatchEvent(new CustomEvent('open-session-setup', {
        detail: {
          activityName: task.title,
          projectId: task.project_id || null,
          activityId: task.id,
          sessionTasks: currentChecklist.map(c => c.text),
          prefilled: true 
        }
      }));
      return;
    }

    await dataStore.updateDailyTask(task.id, { is_completed: false, completed_at: null });
    dataStore.showNotification('Tarefa reaberta para progresso.', 'success');
  };

  const handleToggleSubtaskActive = async (task: DailyTask, subtaskIdx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const currentChecklist = parseSafeChecklist(task.checklist);
    if (currentChecklist.length === 0) return;

    const nextChecklist = currentChecklist.map((c, idx) => {
      if (idx === subtaskIdx) return { ...c, completed: !c.completed };
      return c;
    });

    await dataStore.updateDailyTask(task.id, { checklist: nextChecklist });
  };

  const filteredActivities = useMemo(() => {
    if (!selectedProjectId) return dataStore.activities;
    return dataStore.activities.filter(a => a.project_id === selectedProjectId);
  }, [dataStore.activities, selectedProjectId]);

  const projectOptions = useMemo(() => [
    { value: '', label: 'Nenhum Projeto (Avulso)' },
    ...dataStore.projects.map(p => ({ value: p.id, label: p.name }))
  ], [dataStore.projects]);

  const habitOptions = useMemo(() => [
    { value: '', label: 'Nenhum Hábito' },
    ...dataStore.habits.map(h => ({ value: h.id, label: h.name }))
  ], [dataStore.habits]);

  const activityOptions = useMemo(() => [
    { value: '', label: 'Nenhuma Atividade Cadastrada' },
    ...filteredActivities.map(a => ({ value: a.id, label: cleanActivityName(a.name) }))
  ], [filteredActivities]);

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8 md:py-12 space-y-8 select-none">
      {openMenuId && <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)} />}
      
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 border-b border-white/5 pb-6">
        <div className="text-center sm:text-left space-y-1.5 flex-1">
          <h2 className="text-3xl font-black tracking-tight text-white uppercase">TAREFAS</h2>
          <p className="text-xs text-zinc-400 font-medium leading-relaxed max-w-md">Organize o que precisa ser feito hoje.</p>
        </div>
        <button onClick={handleOpenCreateModal} className="px-6 py-3.5 bg-[#6ee7a8] text-black rounded-2xl font-bold uppercase tracking-widest text-xs transition-all flex items-center gap-2 cursor-pointer shadow-[0_4px_20px_rgba(110,231,168,0.2)]">
          <Plus size={16} strokeWidth={2.5} />
          <span>+ NOVA TAREFA</span>
        </button>
      </div>

      {/* HOJE COLLAPSIBLE */}
      <div className="space-y-4">
        <button onClick={() => setIsHojeOpen(!isHojeOpen)} className="flex items-center gap-2.5 w-full text-left py-3 border-b border-white/5 font-black text-xs uppercase tracking-widest text-[#6ee7a8] cursor-pointer">
          <span>{isHojeOpen ? '▼' : '▶'}</span> TAREFAS A SEREM FEITAS HOJE
        </button>

        <AnimatePresence>
          {isHojeOpen && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-3 overflow-hidden text-left">
              {todayItems.length > 0 ? (
                todayItems.map((item) => {
                  if (item.type !== 'daily_task') {
                    const activity = item.raw;
                    const isHabit = !!activity.habit_id;
                    const isCompleted = activity.status === 'completed' || activity.status === 'concluida';
                    const isCancelled = activity.status === 'cancelled' || activity.status === 'cancelada';
                    let title = activity.atividade_avulsa || 'Sessão Sem Título';

                    return (
                      <motion.div key={item.id} className={`p-5 rounded-2xl border transition-all flex flex-col gap-4 relative group ${isCompleted ? 'bg-emerald-500/5 border-emerald-500/10 opacity-75' : 'bg-zinc-900 border-zinc-800'}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4 flex-1">
                            <span className="text-sm font-semibold text-white">{title}</span>
                          </div>
                        </div>
                      </motion.div>
                    );
                  }

                  const task: DailyTask = item.raw;
                  const isRolledOver = task.rolled_from_date !== null;
                  const currentChecklist = parseSafeChecklist(task.checklist);

                  return (
                    <motion.div key={task.id} className={`p-5 rounded-2xl border transition-all flex flex-col gap-4 relative group ${task.is_completed ? 'bg-zinc-900/40 border-zinc-800/50 opacity-60' : 'bg-zinc-900 border-zinc-800'}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 flex-1 cursor-pointer" onClick={(e) => handleToggleTaskCompletion(task, e)}>
                          <button className={`w-5.5 h-5.5 rounded-lg flex items-center justify-center transition-all ${task.is_completed ? 'bg-[#6ee7a8] text-black' : 'border-2 border-zinc-600'}`}>
                            <Check size={14} strokeWidth={3} />
                          </button>
                          <div className="flex flex-col gap-2 text-left">
                            <span className={`text-sm font-semibold ${task.is_completed ? 'line-through text-zinc-500' : 'text-white'}`}>{task.title}</span>
                          </div>
                        </div>
                      </div>

                      {/* CHECKLIST SEGURO SEM CRASH */}
                      {currentChecklist.length > 0 && (
                        <div className="pl-12 pr-4 text-left pt-2">
                          <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-2">
                            Sessão Profunda ({currentChecklist.filter(c => c.completed).length}/{currentChecklist.length})
                          </p>
                          <div className="pl-4 grid grid-cols-1 gap-1.5 border-l border-zinc-800">
                            {currentChecklist.map((sub, sIdx) => (
                              <div key={sIdx} onClick={(e) => handleToggleSubtaskActive(task, sIdx, e)} className="flex items-center gap-2 cursor-pointer text-xs relative -left-[4.5px]">
                                <span className={sub.completed ? 'text-[#6ee7a8]' : 'text-zinc-600'}>
                                  {sub.completed ? <CheckSquare size={13} strokeWidth={2.5} /> : <div className="w-[8px] h-[8px] rounded-[2px] bg-zinc-700 ml-[2.5px]" />}
                                </span>
                                <span className={`font-semibold ${sub.completed ? 'line-through text-zinc-600' : 'text-zinc-400'}`}>{sub.text}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  );
                })
              ) : (
                <div className="text-center py-10 border border-dashed border-zinc-800 rounded-3xl">
                  <p className="text-xs text-zinc-600 italic">Nenhuma tarefa ativa para hoje.</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
