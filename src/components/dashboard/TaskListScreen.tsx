import { useState, useMemo } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { useDataStore } from '../../store/useDataStore';
import { getLocalDateString, getLocalYesterdayDateString } from '../../lib/utils';
import { Trash2, Plus, Check, Play, Edit2, Calendar, ClipboardList, PlusCircle, X, ChevronRight, CheckSquare, Square } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { CustomSelect } from '../ui/CustomSelect';
import { DailyTask, ScheduledActivity } from '../../types';
import { AgendamentoCard } from '../agenda/AgendamentoCard';

interface TaskListScreenProps {
  tasks: any[]; // handled by dataStore, but kept in props for legacy compatibility
  onTasksChange: (newTasks: any[]) => void; // legacy
  onStartSession: (activity: any) => void;
}

export const TaskListScreen: React.FC<TaskListScreenProps> = ({ onStartSession }) => {
  const { user } = useAuthStore();
  const dataStore = useDataStore();
  const todayStr = useMemo(() => getLocalDateString(new Date()), []);

  const [isProximosDiasOpen, setIsProximosDiasOpen] = useState(false);

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
        title: task.title,
        is_completed: task.is_completed,
        raw: task
      });
    });

    todaySchedules.forEach(sa => {
      const isCompleted = sa.status === 'completed' || sa.status === 'concluida';
      const isCancelled = sa.status === 'cancelled' || sa.status === 'cancelada';
      // Only show non-cancelled in today's active tasks tab or show them if completed
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
        title: vh.atividade_avulsa,
        time: vh.scheduled_time,
        is_completed: isCompleted,
        raw: vh
      });
    });

    // Sort chronologically (items with times first, sorted; then standard tasks sorted alphabetically)
    return items.sort((a, b) => {
      if (a.time && b.time) return a.time.localeCompare(b.time);
      if (a.time) return -1;
      if (b.time) return 1;
      return a.title.localeCompare(b.title);
    });
  }, [dataStore.dailyTasks, dataStore.scheduledActivities, dataStore.habits, dataStore.habitCompletions, todayStr]);

  // 2. GATHER AND GROUP FUTURE ITEMS (PRÓXIMOS DIAS)
  const futureGroups = useMemo(() => {
    const groups: { [date: string]: {
      id: string;
      type: 'daily_task' | 'schedule' | 'habit_virtual';
      title: string;
      time?: string;
      is_completed: boolean;
      raw: any;
    }[] } = {};

    const addItem = (dateStr: string, item: any) => {
      if (!groups[dateStr]) {
        groups[dateStr] = [];
      }
      groups[dateStr].push(item);
    };

    // a. Future DailyTasks
    dataStore.dailyTasks.forEach(task => {
      if (task.task_date > todayStr) {
        addItem(task.task_date, {
          id: `task-${task.id}`,
          type: 'daily_task',
          title: task.title,
          is_completed: task.is_completed,
          raw: task
        });
      }
    });

    // b. Future ScheduledActivities
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

    // c. Future Virtual Habits for next 7 days
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
          title: vh.atividade_avulsa,
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
        return a.title.localeCompare(b.title);
      });

      return {
        date,
        items
      };
    });
  }, [dataStore.dailyTasks, dataStore.scheduledActivities, dataStore.habits, dataStore.habitCompletions, todayStr]);

  // Count stats
  const completedCount = todayItems.filter(t => t.is_completed).length;
  const totalCount = todayItems.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

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

  // Open modal for creating new task
  const handleOpenCreateModal = () => {
    setEditingTask(null);
    setTaskTitle('');
    setSelectedProjectId('');
    setSelectedHabitId('');
    setSelectedActivityId('');
    setActivityManualText('');
    setNewSubtaskText('');
    setSubtasksList([]);
    setShowCreateModal(true);
  };

  // Open modal for editing existing task
  const handleOpenEditModal = (task: DailyTask, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTask(task);
    setTaskTitle(task.title);
    setSelectedProjectId(task.project_id || '');
    setSelectedHabitId(task.habit_id || '');
    setSelectedActivityId(task.activity_id || '');
    setActivityManualText(task.activity_avulsa || '');
    setNewSubtaskText('');
    setSubtasksList(task.checklist || []);
    setShowCreateModal(true);
  };

  // Toggle Subtask inside form builder
  const handleFormAddSubtask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtaskText.trim()) return;
    setSubtasksList([...subtasksList, { text: newSubtaskText.trim(), completed: false }]);
    setNewSubtaskText('');
  };

  const handleFormRemoveSubtask = (index: number) => {
    setSubtasksList(subtasksList.filter((_, i) => i !== index));
  };

  // Save or Update Daily Task
  const handleSaveTask = async () => {
    if (!taskTitle.trim() || !user) return;

    const payload = {
      user_id: user.id,
      task_date: todayStr,
      title: taskTitle.trim(),
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
    }

    setShowCreateModal(false);
    setEditingTask(null);
  };

  // Complete/Uncomplete action
  const handleToggleTaskCompletion = async (task: DailyTask, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextCompleted = !task.is_completed;
    const updates = {
      is_completed: nextCompleted,
      completed_at: nextCompleted ? new Date().toISOString() : null
    };
    
    await dataStore.updateDailyTask(task.id, updates);

    if (nextCompleted) {
      dataStore.showNotification('Fantástico! Meta diária concluída. 🌟', 'success');
    } else {
      dataStore.showNotification('Tarefa reaberta para progresso.', 'success');
    }
  };

  // Subtask checkbox inside main checklist
  const handleToggleSubtaskActive = async (task: DailyTask, subtaskIdx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!task.checklist) return;
    const nextChecklist = task.checklist.map((c, idx) => {
      if (idx === subtaskIdx) {
        return { ...c, completed: !c.completed };
      }
      return c;
    });

    await dataStore.updateDailyTask(task.id, { checklist: nextChecklist });
  };

  // Delete Action
  const handleDeleteTask = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await dataStore.deleteDailyTask(id);
    dataStore.showNotification('Tarefa removida da sua lista.', 'success');
  };

  // Iniciar SP Pre-filled Click
  const handleStartSessaoProfunda = (task: DailyTask, e: React.MouseEvent) => {
    e.stopPropagation();
    const subtaskList = task.checklist ? task.checklist.map(c => c.text) : [];
    
    const activityPayload = {
      id: task.id, // Sets scheduledActivityId to task.id
      project_id: task.project_id,
      activity_id: task.activity_id,
      atividade_avulsa: task.activity_avulsa || task.title,
      habit_id: task.habit_id,
      duration_minutes: 30, // standard prefill placeholder
      tasks: subtaskList,
      notes: ''
    };

    onStartSession(activityPayload);
    dataStore.showNotification('Sessão Profunda configurada para esta tarefa! Inicie para focar. ⚡', 'success');
  };

  // Agendar Click (converts daily task to fix-time ScheduledActivity)
  const handleConvertTaskToSchedule = (task: DailyTask, e: React.MouseEvent) => {
    e.stopPropagation();

    const todayDate = new Date();
    const curHH = String(todayDate.getHours()).padStart(2, '0');
    const curMM = String(todayDate.getMinutes()).padStart(2, '0');

    window.dispatchEvent(new CustomEvent('open-action-center', {
      detail: {
        screen: 'agenda',
        editingActivity: {
          id: undefined, // ensure it saves as a NEW task
          title: task.title,
          project_id: task.project_id,
          activity_id: task.activity_id,
          atividade_avulsa: task.activity_avulsa,
          habit_id: task.habit_id,
          tasks: task.checklist ? task.checklist.map(c => c.text) : [],
          duration_minutes: 30,
          scheduled_date: todayStr,
          scheduled_time: `${curHH}:${curMM}`,
          status: 'pending'
        }
      }
    }));

    dataStore.showNotification('Defina o horário e a duração para agendar a tarefa! ◷', 'success');
  };

  // Filter activities to only ones for selected project (if project is set)
  const filteredActivities = useMemo(() => {
    if (!selectedProjectId) return dataStore.activities;
    return dataStore.activities.filter(a => a.project_id === selectedProjectId);
  }, [dataStore.activities, selectedProjectId]);

  // Option lists for CustomSelect components
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
    ...filteredActivities.map(a => ({ value: a.id, label: a.name }))
  ], [filteredActivities]);

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8 md:py-12 animate-fade-in space-y-8 select-none">
      
      {/* HEADER WITH ACTION */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 border-b border-white/5 pb-6">
        <div className="text-center sm:text-left space-y-1.5 flex-1">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-green">
            Organizador Diário
          </span>
          <h2 className="text-3xl font-black tracking-tight text-text-primary uppercase font-sans">
            Lista de Hoje
          </h2>
          <p className="text-xs text-text-secondary font-medium leading-relaxed max-w-md">
            O que você quer fazer hoje — <span className="text-green">sem hora marcada, no seu ritmo</span>.
          </p>
        </div>
        <button
          onClick={handleOpenCreateModal}
          className="px-6 py-3.5 bg-green hover:brightness-110 active:scale-95 text-background rounded-2xl font-bold uppercase tracking-wider text-xs transition-all flex items-center gap-2 select-none cursor-pointer shadow-[0_4px_20px_rgba(110,231,168,0.2)]"
        >
          <Plus size={16} strokeWidth={2.5} />
          <span>+ Tarefa</span>
        </button>
      </div>

      {/* STATS AREA */}
      <div className="p-6 rounded-3xl bg-surface/10 border border-border-white flex flex-col md:flex-row gap-6 justify-between items-center">
        <div className="space-y-1.5 text-center md:text-left">
          <p className="text-[10px] font-bold uppercase tracking-wider text-text-secondary/60">Aproveitamento Diario</p>
          <h3 className="text-xl font-bold text-text-primary tracking-tight">
            Você fez <span className="text-green font-extrabold">{completedCount}</span> de <span className="text-text-primary font-extrabold">{totalCount}</span> tarefas que planejou para hoje
          </h3>
        </div>
        
        <div className="w-full md:w-64 space-y-2 shrink-0">
          <div className="flex justify-between items-center text-[10px] font-mono font-bold text-text-secondary">
            <span>METAS DIÁRIAS</span>
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

      {/* TASKS LIST */}
      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {todayItems.length > 0 ? (
            todayItems.map((item) => {
              if (item.type !== 'daily_task') {
                return (
                  <AgendamentoCard
                    key={item.id}
                    activity={item.raw}
                    onStartSession={onStartSession}
                  />
                );
              }

              const task: DailyTask = item.raw;
              const isRolledOver = task.rolled_from_date !== null;
              const isYesterday = task.rolled_from_date === getLocalYesterdayDateString(todayStr);
              const rolloverLabel = isYesterday ? "↩ veio de ontem" : "veio de dias anteriores";

              return (
                <motion.div
                  key={task.id}
                  layoutId={task.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={`p-5 rounded-2xl border transition-all flex flex-col gap-4 relative group ${
                    task.is_completed 
                      ? 'bg-white/[0.01] border-white/5 text-text-secondary/40' 
                      : isRolledOver
                        ? 'bg-[#1a1711]/40 border-amber-500/20 hover:border-amber-500/40 shadow-[0_4px_20px_rgba(245,158,11,0.02)]'
                        : 'bg-surface/5 border-border-white hover:border-green/20'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    {/* Checkbox and Title */}
                    <div className="flex items-center gap-4 cursor-pointer flex-1" onClick={(e) => handleToggleTaskCompletion(task, e)}>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleTaskCompletion(task, e);
                        }}
                        className={`w-5.5 h-5.5 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                          task.is_completed 
                            ? 'bg-green text-background' 
                            : 'border-2 border-text-secondary/40 hover:border-green/50 text-transparent'
                        }`}
                      >
                        <Check size={14} strokeWidth={3} />
                      </button>
                      
                      <div className="flex flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`text-sm font-semibold leading-relaxed ${task.is_completed ? 'line-through text-text-secondary/30 font-light' : 'text-text-primary'}`}>
                            {task.title}
                          </span>
                          
                          {/* Rollover badge */}
                          {isRolledOver && !task.is_completed && (
                            <span className="px-2 py-0.5 bg-amber-500/10 text-amber-500 text-[9px] font-bold uppercase tracking-wider rounded border border-amber-500/10 shrink-0">
                              {rolloverLabel}
                            </span>
                          )}
                        </div>

                        {/* Breadcrumbs metadata */}
                        <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-sans font-bold text-text-secondary/50 uppercase tracking-wider">
                          {task.project_id && (
                            <span>📁 {dataStore.projects.find(p => p.id === task.project_id)?.name}</span>
                          )}
                          {task.habit_id && (
                            <span>• 🔁 {dataStore.habits.find(h => h.id === task.habit_id)?.name}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Meta Action Elements */}
                    <div className="flex items-center gap-1 shrink-0 relative z-10">
                      {/* Edit Button */}
                      <button
                        onClick={(e) => handleOpenEditModal(task, e)}
                        className="p-2 text-text-secondary hover:text-green hover:bg-green/10 rounded-lg transition-all cursor-pointer"
                        title="Editar"
                      >
                        <Edit2 size={13} />
                      </button>

                      {/* Delete Button */}
                      <button
                        onClick={(e) => handleDeleteTask(task.id, e)}
                        className="p-2 text-text-secondary/30 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all cursor-pointer opacity-0 group-hover:opacity-100 max-md:opacity-100"
                        title="Excluir"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Checklist of Subtasks inside card */}
                  {task.checklist && task.checklist.length > 0 && (
                    <div className="border-t border-white/5 pt-3 pl-9.5 space-y-2">
                      <p className="text-[9px] font-mono font-bold tracking-wider text-text-secondary/50 uppercase">Subtarefas ({task.checklist.filter(c => c.completed).length}/{task.checklist.length})</p>
                      <div className="grid grid-cols-1 gap-1.5">
                        {task.checklist.map((sub, sIdx) => (
                          <div 
                            key={sIdx}
                            onClick={(e) => handleToggleSubtaskActive(task, sIdx, e)}
                            className="flex items-center gap-2 cursor-pointer text-xs select-none"
                          >
                            <span className={sub.completed ? 'text-green' : 'text-text-secondary/40'}>
                              {sub.completed ? <CheckSquare size={13} strokeWidth={2.5} /> : <Square size={13} />}
                            </span>
                            <span className={`font-medium ${sub.completed ? 'line-through text-text-secondary/30 font-light' : 'text-text-secondary/80'}`}>
                              {sub.text}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* BOTTOM ACTION BUTTONS connecting Macro to Execution */}
                  {!task.is_completed && (
                    <div className="border-t border-white/5 pt-3 pl-9.5 flex flex-wrap gap-2.5">
                      <button
                        onClick={(e) => handleStartSessaoProfunda(task, e)}
                        className="px-3.5 py-2 bg-green/10 hover:bg-green/20 text-green rounded-xl text-[10px] font-extrabold uppercase tracking-widest transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <Play size={11} fill="currentColor" />
                        <span>Iniciar SP</span>
                      </button>
                      <button
                        onClick={(e) => handleConvertTaskToSchedule(task, e)}
                        className="px-3.5 py-2 bg-white/5 hover:bg-white/10 text-text-primary rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all cursor-pointer flex items-center gap-1.5 border border-white/5"
                      >
                        <Calendar size={11} />
                        <span>Agendar</span>
                      </button>
                    </div>
                  )}
                </motion.div>
              );
            })
          ) : (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-20 border border-dashed border-white/5 rounded-3xl select-none"
            >
              <div className="text-4xl block mb-4">🔮</div>
              <h4 className="text-sm font-bold text-text-primary uppercase tracking-wider mb-1">Nenhuma meta para hoje</h4>
              <p className="text-xs text-text-secondary leading-relaxed font-light max-w-xs mx-auto">
                Seu dia está livre de obrigações macro. Toque em <span className="text-green font-medium">+ Tarefa</span> para planejar seu dia estruturado.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* PRÓXIMOS DIAS RAMAL COLAPSÁVEL */}
      <div className="pt-4 border-t border-white/5 space-y-4">
        <button
          onClick={() => setIsProximosDiasOpen(!isProximosDiasOpen)}
          className="flex items-center gap-2.5 px-4 py-3 bg-surface/5 hover:bg-surface/10 border border-white/5 rounded-2xl text-[10px] font-extrabold uppercase tracking-widest transition-all cursor-pointer select-none"
        >
          {isProximosDiasOpen ? (
            <span className="flex items-center gap-1.5 text-green">
              <span>▼</span> PRÓXIMOS DIAS
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-text-secondary hover:text-text-primary">
              <span>▶</span> PRÓXIMOS DIAS
            </span>
          )}
        </button>

        <AnimatePresence>
          {isProximosDiasOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-6 overflow-hidden pl-2"
            >
              {(() => {
                const formatGroupDate = (dateStr: string) => {
                  const parts = dateStr.split('-');
                  if (parts.length !== 3) return dateStr.toUpperCase();
                  const dateObj = new Date(dateStr + 'T00:00:00');
                  const weekday = dateObj.toLocaleDateString('pt-BR', { weekday: 'long' }).toUpperCase();
                  const dayMonth = `${parts[2]}/${parts[1]}`;
                  return `${weekday} (${dayMonth})`;
                };

                return futureGroups.length > 0 ? (
                  futureGroups.map((group) => (
                    <div key={group.date} className="space-y-3">
                      <h4 className="text-[10px] font-extrabold text-[#6ee7a8]/80 uppercase tracking-[0.2em] border-b border-white/5 pb-1">
                        {formatGroupDate(group.date)}
                      </h4>
                      
                      <div className="space-y-3 pl-1">
                        {group.items.map((item) => {
                          if (item.type !== 'daily_task') {
                            return (
                              <AgendamentoCard
                                key={item.id}
                                activity={item.raw}
                                onStartSession={onStartSession}
                              />
                            );
                          }

                          const task: DailyTask = item.raw;
                          const isRolledOver = task.rolled_from_date !== null;
                          const isYesterday = task.rolled_from_date === getLocalYesterdayDateString(todayStr);
                          const rolloverLabel = isYesterday ? "↩ veio de ontem" : "veio de dias anteriores";

                          return (
                            <motion.div
                              key={task.id}
                              initial={{ opacity: 0, y: 5 }}
                              animate={{ opacity: 1, y: 0 }}
                              className={`p-5 rounded-2xl border transition-all flex flex-col gap-4 relative group ${
                                task.is_completed 
                                  ? 'bg-white/[0.01] border-white/5 text-text-secondary/40' 
                                  : isRolledOver
                                    ? 'bg-[#1a1711]/40 border-amber-500/20 shadow-[0_4px_20px_rgba(245,158,11,0.02)]'
                                    : 'bg-surface/5 border-border-white hover:border-green/20'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4 cursor-pointer flex-1" onClick={(e) => handleToggleTaskCompletion(task, e)}>
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleToggleTaskCompletion(task, e);
                                    }}
                                    className={`w-5.5 h-5.5 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                                      task.is_completed 
                                        ? 'bg-green text-background' 
                                        : 'border-2 border-text-secondary/40 hover:border-green/50 text-transparent'
                                    }`}
                                  >
                                    {task.is_completed && <Check size={12} strokeWidth={3} />}
                                  </button>
                                  <div className="text-left">
                                    <span className={`text-sm font-semibold tracking-tight transition-all leading-snug block ${
                                      task.is_completed ? 'line-through text-text-secondary/30 font-light' : 'text-text-primary'
                                    }`}>
                                      {task.title}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    onClick={(e) => handleOpenEditModal(task, e)}
                                    className="p-2 text-text-secondary hover:text-green hover:bg-green/10 rounded-lg transition-all cursor-pointer"
                                    title="Editar"
                                  >
                                    <Edit2 size={13} />
                                  </button>
                                  <button
                                    onClick={(e) => handleDeleteTask(task.id, e)}
                                    className="p-2 text-text-secondary/30 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all cursor-pointer opacity-0 group-hover:opacity-100 max-md:opacity-100"
                                    title="Excluir"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-text-secondary/40 italic py-2 pl-2">Nenhum compromisso ou tarefa agendados para os próximos dias.</p>
                );
              })()}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* QUICK SUGGESTIONS BLOCK */}
      <div className="p-6 rounded-3xl bg-surface/5 border border-white/5 space-y-4">
        <h4 className="text-[10px] font-bold uppercase tracking-wider text-text-secondary/40">Ideias de Foco Diário</h4>
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
              onClick={async () => {
                if (!user) return;
                const matches = todayItems.some(t => t.title === item);
                if (matches) {
                  dataStore.showNotification('Esta sugestão já está cadastrada para hoje!', 'error');
                  return;
                }
                const payload = {
                  user_id: user.id,
                  task_date: todayStr,
                  title: item,
                  project_id: null,
                  habit_id: null,
                  activity_id: null,
                  activity_avulsa: null,
                  checklist: null,
                  is_completed: false,
                  completed_at: null,
                  rolled_from_date: null
                };
                await dataStore.addDailyTask(payload);
                dataStore.showNotification(`"${item}" adicionada à sua Lista de Hoje!`);
              }}
              className="text-left text-xs bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 rounded-xl px-4 py-3.5 text-text-secondary hover:text-text-primary transition-all cursor-pointer truncate"
            >
              ➕ {item}
            </button>
          ))}
        </div>
      </div>

      {/* MODAL OVERLAY: CREATE OR EDIT TASK */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCreateModal(false)}
              className="absolute inset-0 bg-background/80 backdrop-blur-md"
            />
            
            {/* Modal Card */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="relative w-full max-w-lg bg-[#0f1110] border border-white/10 rounded-3xl p-6 md:p-8 overflow-hidden flex flex-col gap-6 shadow-[0_24px_50px_rgba(0,0,0,0.8)]"
            >
              <div>
                <h3 className="text-xl font-bold uppercase tracking-tight text-text-primary">
                  {editingTask ? 'Editar Tarefa Diária' : 'Nova Tarefa Diária'}
                </h3>
                <p className="text-xs text-text-secondary mt-1">
                  Configure os detalhes da sua tarefa física para hoje. É totalmente opcional vincular sub-elementos.
                </p>
              </div>

              {/* Form Areas */}
              <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
                
                {/* Título */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold tracking-wider text-text-secondary/70 uppercase">Título da Tarefa <span className="text-green">*</span></label>
                  <input 
                    type="text" 
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    placeholder="Ex: Resolver documentação de arquitetura"
                    className="w-full bg-[#161817] border border-white/5 rounded-2xl px-4 py-3.5 text-sm text-text-primary outline-none focus:border-green/50 placeholder:text-text-secondary/30"
                  />
                </div>

                {/* Projeto Selector */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold tracking-wider text-text-secondary/70 uppercase">Projeto (Opcional)</label>
                  <CustomSelect 
                    options={projectOptions}
                    value={selectedProjectId}
                    onChange={(val) => {
                      setSelectedProjectId(val);
                      setSelectedActivityId(''); // reset activity on change
                    }}
                    placeholder="Selecione um Projeto..."
                  />
                </div>

                {/* Atividade Selector */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold tracking-wider text-text-secondary/70 uppercase">Atividade Vinculada (Opcional)</label>
                  <CustomSelect 
                    options={activityOptions}
                    value={selectedActivityId}
                    onChange={setSelectedActivityId}
                    placeholder="Selecione uma Atividade..."
                  />
                </div>

                {/* Alternativa: Atividade Avulsa */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold tracking-wider text-text-secondary/70 uppercase">Ou Digite Atividade Avulsa (Opcional)</label>
                  <input 
                    type="text" 
                    value={activityManualText}
                    onChange={(e) => setActivityManualText(e.target.value)}
                    placeholder="Ex: Pesquisar concorrência no dribbble"
                    className="w-full bg-[#161817] border border-white/5 rounded-2xl px-4 py-3.5 text-sm text-text-primary outline-none focus:border-green/50 placeholder:text-text-secondary/30"
                  />
                </div>

                {/* Hábito Selector */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold tracking-wider text-text-secondary/70 uppercase">Vincular a um Hábito (Opcional)</label>
                  <CustomSelect 
                    options={habitOptions}
                    value={selectedHabitId}
                    onChange={setSelectedHabitId}
                    placeholder="Selecione um Hábito..."
                  />
                </div>

                {/* Checklist (Subtarefas) */}
                <div className="space-y-2 border-t border-white/5 pt-4">
                  <label className="text-[10px] font-bold tracking-wider text-text-secondary/70 uppercase block mb-1">Checklist de Subtarefas</label>
                  
                  <form onSubmit={handleFormAddSubtask} className="flex gap-2">
                    <input 
                      type="text" 
                      value={newSubtaskText}
                      onChange={(e) => setNewSubtaskText(e.target.value)}
                      placeholder="Adicionar subtarefa..."
                      className="flex-1 bg-[#161817] border border-white/5 rounded-2xl px-4 py-3 text-xs text-text-primary outline-none focus:border-green/50"
                    />
                    <button 
                      type="submit"
                      className="px-4 bg-[#1e2220] hover:bg-green hover:text-background text-text-primary rounded-2xl text-xs font-bold font-sans transition-all active:scale-95 cursor-pointer"
                    >
                      + Sub
                    </button>
                  </form>

                  {subtasksList.length > 0 && (
                    <div className="space-y-1.5 mt-2 bg-white/[0.01] border border-white/5 p-3 rounded-2xl max-h-32 overflow-y-auto">
                      {subtasksList.map((st, sIdx) => (
                        <div key={sIdx} className="flex justify-between items-center text-xs gap-3">
                          <div className="flex items-center gap-2">
                            <span className="text-green text-[8px]">●</span>
                            <span className="font-medium text-text-secondary">{st.text}</span>
                          </div>
                          <button 
                            type="button" 
                            onClick={() => handleFormRemoveSubtask(sIdx)}
                            className="text-text-secondary/30 hover:text-red-500 hover:bg-red-500/10 p-1.5 rounded transition-all cursor-pointer"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 justify-end pt-2">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingTask(null);
                  }}
                  className="px-5 py-3.5 bg-transparent text-text-secondary hover:text-text-primary font-bold text-xs uppercase tracking-wider rounded-2xl transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveTask}
                  disabled={!taskTitle.trim()}
                  className="px-6 py-3.5 bg-green text-background disabled:opacity-40 disabled:pointer-events-none font-bold text-xs uppercase tracking-wider rounded-2xl transition-all hover:brightness-110 cursor-pointer shadow-[0_4px_20px_rgba(110,231,168,0.2)]"
                >
                  Confirmar Ok
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
