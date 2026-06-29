import React, { useState, useMemo, useEffect } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { useDataStore } from '../../store/useDataStore';
import { getLocalDateString, getLocalYesterdayDateString, cleanActivityName } from '../../lib/utils';
import { Trash2, Plus, Check, Play, Edit2, Calendar, ClipboardList, PlusCircle, X, ChevronRight, CheckSquare, Square, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { CustomSelect } from '../ui/CustomSelect';
import { DailyTask, ScheduledActivity } from '../../types';
import { AgendamentoCard } from '../agenda/AgendamentoCard';
import { DeleteTaskModal } from './DeleteTaskModal';

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
  tasks: any[]; // handled by dataStore, but kept in props for legacy compatibility
  onTasksChange: (newTasks: any[]) => void; // legacy
  onStartSession: (activity: any) => void;
}

const TaskItemCard = ({ task, isRolledOver, rolloverLabel, todayStr, handleToggleTaskCompletion, handleStartSessaoProfunda, openMenuId, setOpenMenuId, setTaskToDelete, handleOpenEditModal, dataStore, handleToggleSubtaskActive }: any) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasChecklist = Array.isArray(task.checklist) && task.checklist.length > 0;

  return (
    <motion.div
      layoutId={task.id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      onClick={() => {
        if (hasChecklist) setIsExpanded(!isExpanded);
      }}
      className={`p-5 rounded-2xl border transition-all flex flex-col gap-4 relative group ${hasChecklist ? 'cursor-pointer' : ''} ${
        task.is_completed 
          ? 'bg-white/[0.01] border-white/5 text-text-secondary/40' 
          : isRolledOver
            ? 'bg-[#1a1711]/40 border-amber-500/20 hover:border-amber-500/40 shadow-[0_4px_20px_rgba(245,158,11,0.02)]'
            : 'bg-surface/5 border-border-white hover:border-green/20'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 flex-1">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              handleToggleTaskCompletion(task, e);
            }}
            className={`w-5.5 h-5.5 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
              task.is_completed 
                ? 'bg-primary-green text-background border border-primary-green' 
                : 'border-2 border-text-secondary/40 hover:border-primary-green/50 text-transparent'
            }`}
          >
            <Check size={14} strokeWidth={3} />
          </button>
          
          <div className="flex flex-col gap-2 text-left w-full pr-8">
            <span className={`text-sm font-semibold leading-relaxed font-sans ${task.is_completed ? 'line-through text-text-secondary/30 font-light' : 'text-text-primary'}`}>
              {task.title}
            </span>
            
            <div className="flex flex-wrap items-center gap-2">
              {task.habit_id ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] uppercase tracking-wider font-medium text-emerald-400">
                  HÁBITO ATÔMICO
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] uppercase tracking-wider font-medium text-white/60">
                  TAREFA DO DIA
                </span>
              )}
              
              {task.project_id && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] uppercase tracking-wider font-medium text-white/60 font-sans">
                  {dataStore.projects.find((p: any) => p.id === task.project_id)?.name}
                </span>
              )}

              {!task.is_completed && (task as any).scheduled_date && (task as any).scheduled_date < todayStr && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-[10px] uppercase tracking-wider font-medium text-red-400">
                  ATRASADA
                </span>
              )}
              
              {isRolledOver && !task.is_completed && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/10 text-[10px] uppercase tracking-wider text-amber-500 font-sans">
                  {rolloverLabel}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* DROPDOWN MENU */}
        <div className="absolute top-5 right-5 z-50">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setOpenMenuId(openMenuId === task.id ? null : task.id);
            }}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/5 transition-all text-text-secondary/50 hover:text-white cursor-pointer"
          >
            <span className="text-lg leading-none transform -translate-y-1">...</span>
          </button>
          
          {openMenuId === task.id && (
            <div className="absolute top-full right-0 mt-1 w-36 bg-surface border border-white/10 rounded-2xl shadow-2xl overflow-hidden py-1 animate-fade-in origin-top-right">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenMenuId(null);
                  handleOpenEditModal(task, e as any);
                }}
                className="w-full text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-white/80 hover:bg-white/5 transition-all font-sans cursor-pointer"
              >
                Editar
              </button>
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  setOpenMenuId(null);
                  setTaskToDelete(task.id);
                }}
                className="w-full text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-white/80 hover:bg-white/5 transition-all font-sans cursor-pointer"
              >
                Cancelar
              </button>
              <div className="h-px bg-white/5 my-1 mx-2" />
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  setOpenMenuId(null);
                  setTaskToDelete(task.id);
                }}
                className="w-full text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-red-500 hover:bg-red-500/10 transition-all font-sans cursor-pointer"
              >
                Excluir
              </button>
            </div>
          )}
        </div>
      </div>

      <CollapsibleChecklist task={task} onToggleSubtask={handleToggleSubtaskActive} isExpanded={isExpanded} setIsExpanded={setIsExpanded} />

      {!task.is_completed && (
        <div className="mt-2 -mx-5 -mb-5 border-t border-white/5">
          <button
            onClick={(e) => handleStartSessaoProfunda(task, e)}
            className="w-full py-3.5 text-[#6ee7a8] hover:bg-white/5 text-[10px] font-extrabold uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-1.5 font-sans rounded-b-2xl"
          >
            <Play size={11} fill="currentColor" />
            <span>SESSÃO PROFUNDA</span>
          </button>
        </div>
      )}
    </motion.div>
  );
};
const CollapsibleChecklist = ({ task, onToggleSubtask, isExpanded, setIsExpanded }: { task: DailyTask, onToggleSubtask: (task: DailyTask, subtaskIdx: number, e: React.MouseEvent) => void, isExpanded: boolean, setIsExpanded: (v: boolean) => void }) => {
  if (!Array.isArray(task.checklist) || task.checklist.length === 0) {
    return null;
  }

  const completedCount = task.checklist.filter(c => c.completed).length;
  const totalCount = task.checklist.length;

  return (
    <div className="pl-14 pr-4 pt-1 pb-2">
      <button 
        onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
        className="flex items-center gap-2 text-[10px] text-white/40 uppercase tracking-widest mb-1 hover:text-white/60 transition-colors cursor-pointer"
      >
        <span>Sessão Profunda ({completedCount}/{totalCount})</span>
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.3 }}
        >
          <ChevronDown size={12} />
        </motion.div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 200 }}
            className="overflow-hidden"
          >
            <div className="mt-2 bg-white/5 rounded-2xl p-4 grid grid-cols-1 gap-3">
              {task.checklist.map((sub, sIdx) => (
                <div 
                  key={sIdx}
                  onClick={(e) => onToggleSubtask(task, sIdx, e)}
                  className="flex items-start gap-3 cursor-pointer text-xs select-none group"
                >
                  <span className={`w-4 h-4 rounded-full border flex-shrink-0 flex items-center justify-center transition-all mt-[1px] ${sub.completed ? 'bg-primary-green border-primary-green' : 'border-white/20 bg-surface group-hover:border-white/40'}`}>
                    {sub.completed && <Check size={10} strokeWidth={4} className="text-background" />}
                  </span>
                  <span className={`font-semibold font-sans line-clamp-2 flex-1 transition-all ${sub.completed ? 'line-through text-text-secondary/30 font-light' : 'text-text-secondary/80 group-hover:text-text-secondary'}`}>
                    {sub.text}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const TaskListScreen: React.FC<TaskListScreenProps> = ({ onStartSession }) => {
  const { user } = useAuthStore();
  const dataStore = useDataStore();
  const todayStr = useMemo(() => getLocalDateString(new Date()), []);

  const [isProximosDiasOpen, setIsProximosDiasOpen] = useState(false);
  const [isHojeOpen, setIsHojeOpen] = useState(true);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);

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
        if (habit.sched_weekdays === 'all' || (Array.isArray(habit.sched_weekdays) && habit.sched_weekdays.includes('all'))) return true;
        const days = Array.isArray(habit.sched_weekdays) ? habit.sched_weekdays : (habit.sched_weekdays || '').split(',');
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
      return (a.title || '').localeCompare(b.title || '');
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
          if (habit.sched_weekdays === 'all' || (Array.isArray(habit.sched_weekdays) && habit.sched_weekdays.includes('all'))) return true;
          const days = Array.isArray(habit.sched_weekdays) ? habit.sched_weekdays : (habit.sched_weekdays || '').split(',');
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
        return (a.title || '').localeCompare(b.title || '');
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
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState('');

  // Event listener for Inbox Captures
  useEffect(() => {
    const handleOpenTask = (e: any) => {
      try {
        const { text, captureId } = e.detail;
        setEditingTask(null);
        setTaskTitle('Processar Captura');
        
        // Smart parse logic
        const trimmedText = text.trim();
        const lines = trimmedText.split(/\r?\n/).filter((l: string) => l.trim() !== '');
        
        let avulsa = '';
        let subtasks = [];
        
        if (lines.length === 1 && trimmedText.length < 80) {
          // Explicitly simple activity
          avulsa = trimmedText;
        } else {
          // Complex note/capture, put it in subtasks
          avulsa = 'Processar Anotação / Captura';
          subtasks = lines.map((l: string, idx: number) => ({ id: `sub-${Date.now()}-${idx}`, text: l.trim(), completed: false }));
        }

        setActivityManualText(avulsa);
        setSelectedProjectId('');
        setSelectedHabitId('');
        setSelectedActivityId('');
        setSubtasksList(subtasks);
        setShowCreateModal(true);
        
        // Store the captureId in a global or state to delete upon save
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
    setEditingIndex(null);
    setEditingValue('');
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
    setSubtasksList(Array.isArray(task.checklist) ? task.checklist : []);
    setEditingIndex(null);
    setEditingValue('');
    setShowCreateModal(true);
  };

  // Toggle Subtask inside form builder
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
    } else if (editingIndex !== null && editingIndex > index) {
      setEditingIndex(editingIndex - 1);
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

  // Save or Update Daily Task
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

    if (editingTask && !activityManualText.trim() && !selectedActivityId && !selectedHabitId && !selectedProjectId && subtasksList.length === 0) {
      computedTitle = editingTask.title;
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

  // Complete/Uncomplete action
  const handleToggleTaskCompletion = async (task: DailyTask, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextCompleted = !task.is_completed;

    if (nextCompleted) {
      // Preenche o formulário com dados da tarefa e abre o modal parcial
      window.dispatchEvent(new CustomEvent('open-session-setup', {
        detail: {
          activityName: task.title,
          projectId: task.project_id || null,
          activityId: task.id,
          sessionTasks: Array.isArray(task.checklist) ? task.checklist.map(c => c.text) : [], // Injeta as tarefas existentes
          prefilled: true 
        }
      }));
      return;
    }

    // Reabertura da tarefa (se desmarcar)
    const updates = {
      is_completed: false,
      completed_at: null
    };
    
    await dataStore.updateDailyTask(task.id, updates);
    dataStore.showNotification('Tarefa reaberta para progresso.', 'success');
  };

  // Subtask checkbox inside main checklist
  const handleToggleSubtaskActive = async (task: DailyTask, subtaskIdx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!task.checklist) return;
    if (!Array.isArray(task.checklist)) return;
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
    const subtaskList = Array.isArray(task.checklist) ? task.checklist.map(c => c.text) : [];
    
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
          tasks: Array.isArray(task.checklist) ? task.checklist.map(c => c.text) : [],
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
    ...filteredActivities.map(a => ({ value: a.id, label: cleanActivityName(a.name) }))
  ], [filteredActivities]);

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8 md:py-12 animate-fade-in space-y-8 select-none">
      {openMenuId && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={(e) => { e.stopPropagation(); setOpenMenuId(null); }}
        />
      )}
      
      {/* HEADER WITH ACTION */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 border-b border-white/5 pb-6">
        <div className="text-center sm:text-left space-y-1.5 flex-1">
          <h2 className="text-3xl font-black tracking-tight text-text-primary uppercase font-sans">
            TAREFAS
          </h2>
          <p className="text-xs text-text-secondary font-medium leading-relaxed max-w-md">
            Organize o que precisa ser feito hoje.
          </p>
        </div>
        <button
          onClick={handleOpenCreateModal}
          className="px-6 py-3.5 bg-green hover:brightness-110 active:scale-95 text-background rounded-2xl font-bold uppercase tracking-widest text-xs transition-with-all flex items-center gap-2 select-none cursor-pointer shadow-[0_4px_20px_rgba(110,231,168,0.2)] font-sans"
        >
          <Plus size={16} strokeWidth={2.5} />
          <span>+ NOVA TAREFA</span>
        </button>
      </div>

      {/* TAREFAS A SEREM FEITAS HOJE COLLAPSIBLE BRANCH */}
      <div className="space-y-4">
        <button
          onClick={() => setIsHojeOpen(!isHojeOpen)}
          className="flex items-center gap-2.5 w-full text-left py-3 border-b border-white/5 font-sans font-black text-xs uppercase tracking-widest text-[#6ee7a8] hover:text-green transition-all cursor-pointer select-none"
        >
          <span className="text-[10px]">{isHojeOpen ? '▼' : '▶'}</span> TAREFAS A SEREM FEITAS HOJE
        </button>

        <AnimatePresence>
          {isHojeOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-3 overflow-hidden text-left"
            >
              {todayItems.length > 0 ? (
                todayItems.map((item) => {
                  if (item.type !== 'daily_task') {
                    const activity = item.raw;
                    const isHabit = !!activity.habit_id;
                    const contextLabel = isHabit ? 'Hábito Atômico' : 'Atividade';
                    const isCompleted = activity.status === 'completed' || activity.status === 'concluida';
                    const isCancelled = activity.status === 'cancelled' || activity.status === 'cancelada';

                    let title = activity.atividade_avulsa || 'Sessão Sem Título';
                    if (activity.habit_id) {
                      const habit = dataStore.habits.find(h => h.id === activity.habit_id);
                      title = habit?.name || title;
                    } else if (activity.activity_id) {
                      const act = dataStore.activities.find(a => a.id === activity.activity_id);
                      title = act?.name || title;
                    }

                    const formatClockTime = (timeStr: string): string => {
                      if (!timeStr) return '';
                      const [h, m] = timeStr.split(':').map(Number);
                      return `${String(h || 0).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}`;
                    };

                    const startTime = activity.scheduled_time;
                    const [sh, sm] = startTime?.split(':').map(Number) || [0, 0];
                    const totalMin = sh * 60 + sm + activity.duration_minutes;
                    const endH = Math.floor(totalMin / 60) % 24;
                    const endM = totalMin % 60;
                    const endTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

                    const delayed = isDelayed(activity.scheduled_date);
                    const formattedDate = formatDelayedDate(activity.scheduled_date);

                    return (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`p-5 rounded-2xl border transition-all flex flex-col gap-4 relative group ${
                          isCompleted
                            ? 'bg-emerald-500/5 border-emerald-500/10 opacity-75 text-text-secondary/40'
                            : isCancelled
                            ? 'bg-red-400/5 border-red-400/10 opacity-60'
                            : 'bg-surface/5 border-border-white hover:border-[#6ee7a8]/20'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4 flex-1">
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                const nextStatus = isCompleted ? 'pending' : 'concluida';
                                await dataStore.updateScheduledActivity(activity.id, {
                                  status: nextStatus,
                                  resolved_at: nextStatus === 'concluida' ? new Date().toISOString() : null
                                });
                                dataStore.showNotification(
                                  nextStatus === 'concluida' ? 'Atividade concluída com sucesso! 🎉' : 'Atividade reaberta.',
                                  'success'
                                );
                              }}
                              className={`w-5.5 h-5.5 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                                isCompleted
                                  ? 'bg-green text-background'
                                  : 'border-2 border-text-secondary/40 hover:border-green/50 text-transparent'
                              }`}
                            >
                              <Check size={14} strokeWidth={3} />
                            </button>

                            <div className="flex flex-col gap-2 text-left w-full pr-8">
                              <span className={`text-sm font-semibold leading-relaxed ${isCompleted ? 'line-through text-text-secondary/35 font-light' : 'text-text-primary'}`}>
                                {title}
                              </span>
                              <div className="flex flex-wrap items-center gap-2">
                                {isHabit ? (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] uppercase tracking-wider font-medium text-emerald-400">
                                    HÁBITO ATÔMICO
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] uppercase tracking-wider font-medium text-blue-400">
                                    TAREFA AGENDADA
                                  </span>
                                )}
                                {activity.project_id && (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] uppercase tracking-wider font-medium text-white/60">
                                    {dataStore.projects.find(p => p.id === activity.project_id)?.name}
                                  </span>
                                )}
                                {!isCompleted && !isCancelled && activity.scheduled_date && activity.scheduled_date < todayStr && (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-[10px] uppercase tracking-wider font-medium text-red-400">
                                    ATRASADA
                                  </span>
                                )}
                                {startTime && (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] uppercase tracking-wider font-medium text-white/60">
                                    {formatClockTime(startTime)} - {endTime} ({activity.duration_minutes} min)
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* DROPDOWN MENU */}
                          <div className="absolute top-5 right-5 z-50">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMenuId(openMenuId === item.id ? null : item.id);
                              }}
                              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/5 transition-all text-text-secondary/50 hover:text-white"
                            >
                              <span className="text-lg leading-none transform -translate-y-1">...</span>
                            </button>
                            
                            {openMenuId === item.id && (
                              <div className="absolute top-full right-0 mt-1 w-36 bg-surface border border-white/10 rounded-2xl shadow-2xl overflow-hidden py-1 animate-fade-in origin-top-right">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenMenuId(null);
                                    window.dispatchEvent(new CustomEvent('open-action-center', {
                                      detail: { screen: 'agenda', editingActivity: activity }
                                    }));
                                  }}
                                  className="w-full text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-white/80 hover:bg-white/5 transition-all font-sans"
                                >
                                  Editar
                                </button>
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    setOpenMenuId(null);
                                    if (confirm('Ficou tarde? Deseja cancelar este agendamento?')) {
                                      await dataStore.updateScheduledActivity(activity.id, {
                                        status: 'cancelada',
                                        resolved_at: new Date().toISOString()
                                      });
                                      dataStore.showNotification('Agendamento cancelado com sucesso.', 'success');
                                    }
                                  }}
                                  className="w-full text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-white/80 hover:bg-white/5 transition-all font-sans"
                                >
                                  Cancelar
                                </button>
                                <div className="h-px bg-white/5 my-1 mx-2" />
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    setOpenMenuId(null);
                                    if (confirm('Excluir este agendamento permanentemente?')) {
                                      await dataStore.deleteScheduledActivity(activity.id);
                                      dataStore.showNotification('Agendamento excluído do sistema.', 'success');
                                    }
                                  }}
                                  className="w-full text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-red-500 hover:bg-red-500/10 transition-all font-sans"
                                >
                                  Excluir
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {Array.isArray(activity.tasks) && activity.tasks.length > 0 && (
                          <div className="pl-12 pr-4 text-left pt-2">
                            <p className="text-[10px] text-white/40 uppercase tracking-widest mb-2">
                              TAREFAS DA SESSÃO ({activity.tasks.length})
                            </p>
                            <div className="pl-4 grid grid-cols-1 gap-1.5 border-l border-white/5">
                              {activity.tasks.map((taskStr: string, tIdx: number) => (
                                <div key={tIdx} className="flex items-center gap-2 text-xs relative -left-[4.5px]">
                                  <div className="w-[8px] h-[8px] rounded-[2px] bg-white/10 flex-shrink-0" />
                                  <span className="text-text-secondary/80 font-medium font-sans">
                                    {taskStr}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {!isCompleted && !isCancelled && (
                          <div className="mt-2 -mx-5 -mb-5 border-t border-white/5">
                            <button
                              onClick={() => onStartSession(activity)}
                              className="w-full py-3.5 text-[#6ee7a8] hover:bg-white/5 text-[10px] font-extrabold uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-1.5 font-sans rounded-b-2xl"
                            >
                              <Play size={11} fill="currentColor" />
                              <span>SESSÃO PROFUNDA</span>
                            </button>
                          </div>
                        )}
                      </motion.div>
                    );
                  }

                  const task: DailyTask = item.raw;
                  const isRolledOver = task.rolled_from_date !== null;
                  const isYesterday = task.rolled_from_date === getLocalYesterdayDateString(todayStr);
                  const rolloverLabel = isYesterday ? "↩ veio de ontem" : "veio de dias anteriores";
                  
                  const delayed = isDelayed(task.created_at);
                  const formattedDate = formatDelayedDate(task.created_at);

                  return (
                    <TaskItemCard 
                      key={task.id}
                      task={task} 
                      isRolledOver={isRolledOver} 
                      rolloverLabel={rolloverLabel} 
                      todayStr={todayStr} 
                      handleToggleTaskCompletion={handleToggleTaskCompletion} 
                      handleStartSessaoProfunda={handleStartSessaoProfunda} 
                      openMenuId={openMenuId} 
                      setOpenMenuId={setOpenMenuId} 
                      setTaskToDelete={setTaskToDelete} 
                      handleOpenEditModal={handleOpenEditModal} 
                      dataStore={dataStore} 
                      handleToggleSubtaskActive={handleToggleSubtaskActive} 
                    />
                  );
                })
              ) : (
                <div className="text-center py-10 border border-dashed border-white/5 rounded-3xl select-none">
                  <p className="text-xs text-text-secondary/40 italic font-sans">Nenhuma tarefa ou atividade ativa para hoje.</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* PRÓXIMAS TAREFAS COLLAPSIBLE BRANCH */}
      <div className="pt-4 border-t border-white/5 space-y-4">
        <button
          onClick={() => setIsProximosDiasOpen(!isProximosDiasOpen)}
          className="flex items-center gap-2.5 w-full text-left py-3 border-b border-white/5 font-sans font-black text-xs uppercase tracking-widest text-[#6ee7a8] hover:text-green transition-all cursor-pointer select-none"
        >
          <span className="text-[10px]">{isProximosDiasOpen ? '▼' : '▶'}</span> PRÓXIMAS TAREFAS
        </button>

        <AnimatePresence>
          {isProximosDiasOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-6 overflow-hidden text-left"
            >
              {(() => {
                const formatGroupDate = (dateStr: string) => {
                  const parts = dateStr.split('-');
                  if (parts.length !== 3) return dateStr.toUpperCase();
                  const dateObj = new Date(dateStr + 'T00:00:00');
                  
                  const tomorrow = new Date();
                  tomorrow.setDate(tomorrow.getDate() + 1);
                  const tomorrowStr = getLocalDateString(tomorrow);
                  if (dateStr === tomorrowStr) {
                    return "AMANHÃ";
                  }

                  const weekday = dateObj.toLocaleDateString('pt-BR', { weekday: 'long' }).toUpperCase();
                  return weekday;
                };

                return futureGroups.length > 0 ? (
                  futureGroups.map((group) => (
                    <div key={group.date} className="space-y-2 p-4 bg-surface/5 border border-white/5 rounded-2xl">
                      <h4 className="text-[11px] font-black text-text-primary uppercase tracking-[0.2em] border-b border-white/5 pb-1.5 flex justify-between items-center">
                        <span>{formatGroupDate(group.date)}</span>
                        <span className="text-[9px] font-mono text-text-secondary/40 font-bold">{group.date.split('-').reverse().slice(0,2).join('/')}</span>
                      </h4>
                      
                      <div className="space-y-2 pt-1 text-left font-sans">
                        {group.items.map((item) => {
                          let itemTitle = item.title;
                          if (item.type === 'schedule' || item.type === 'habit_virtual') {
                            const activity = item.raw;
                            if (activity.habit_id) {
                              const habit = dataStore.habits.find(h => h.id === activity.habit_id);
                              itemTitle = habit?.name || itemTitle;
                            } else if (activity.activity_id) {
                              const act = dataStore.activities.find(a => a.id === activity.activity_id);
                              itemTitle = act?.name || itemTitle;
                            }
                          }
                          
                          return (
                            <div key={item.id} className="flex items-start gap-2 py-0.5 text-xs text-text-secondary font-sans overflow-hidden">
                              <span className="text-green text-[10px] mt-0.5 font-sans">•</span>
                              <div className="flex-1 flex flex-wrap items-center gap-2 text-left font-sans">
                                <span className={`font-semibold font-sans ${item.is_completed ? 'line-through text-text-secondary/40 font-light' : 'text-text-primary'}`}>
                                  {itemTitle}
                                </span>
                                {item.time && (
                                  <span className="text-[9px] font-mono text-text-secondary/40 font-bold bg-white/5 px-1.5 py-0.5 rounded">
                                    {item.time}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-text-secondary/45 italic py-2 pl-2 font-sans">Nenhuma tarefa futura agendada.</p>
                );
              })()}
            </motion.div>
          )}
        </AnimatePresence>
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
                  Salve todas as tarefas que você precisa executar no dia de hoje
                </p>
              </div>

              {/* Form Areas */}
              <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">

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

                {/* Checklist (Sessão Profunda checklist) */}
                <div className="space-y-3.5 border-t border-white/5 pt-4 text-left">
                  <label className="text-[10px] font-bold tracking-wider text-[#6ee7a8] uppercase block mb-1">
                    LISTE TUDO QUE PRECISA FAZER OU INFORMAÇÕES IMPORTANTES
                  </label>
                  
                  {subtasksList.length > 0 && (
                    <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
                      {subtasksList.map((st, sIdx) => (
                        <div key={sIdx} className="flex justify-between items-start text-xs gap-3 bg-white/[0.02] border border-white/5 p-3 rounded-xl">
                          {editingIndex === sIdx ? (
                            <div className="flex items-start gap-2 flex-1 min-w-0">
                              <span className="text-text-secondary/40 select-none shrink-0 font-sans mt-[1.5px]">☐</span>
                              <textarea
                                autoFocus
                                value={editingValue}
                                onChange={(e) => setEditingValue(e.target.value)}
                                onBlur={() => handleSaveSubtaskEdit(sIdx)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSaveSubtaskEdit(sIdx);
                                  }
                                }}
                                className="font-semibold text-text-primary font-sans bg-[#161817] border border-white/10 rounded-lg px-2 py-1 outline-none focus:border-green/50 flex-1 min-w-0 w-full resize-none overflow-hidden"
                                rows={1}
                                ref={(el) => {
                                  if (el) {
                                    el.style.height = 'auto';
                                    el.style.height = el.scrollHeight + 'px';
                                  }
                                }}
                              />
                            </div>
                          ) : (
                            <div 
                              className="flex items-start gap-2 flex-1 min-w-0 cursor-pointer select-none py-1 group"
                              onClick={() => {
                                setEditingIndex(sIdx);
                                setEditingValue(st.text);
                              }}
                            >
                              <span className="text-text-secondary/40 select-none shrink-0 font-sans mt-[1.5px]">☐</span>
                              <span className="font-semibold text-text-primary font-sans break-words whitespace-pre-wrap leading-relaxed group-hover:text-[#6ee7a8] transition-colors flex-1">
                                {st.text}
                              </span>
                            </div>
                          )}
                          <button 
                            type="button" 
                            onClick={() => handleFormRemoveSubtask(sIdx)}
                            className="text-text-secondary/30 hover:text-red-500 hover:bg-red-500/10 p-1.5 rounded transition-all cursor-pointer font-bold mt-[-2px]"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <form onSubmit={handleFormAddSubtask} className="flex gap-2 items-center">
                    <input 
                      type="text" 
                      value={newSubtaskText}
                      onChange={(e) => setNewSubtaskText(e.target.value)}
                      placeholder="Adicionar item..."
                      className="flex-1 bg-[#161817] border border-white/5 rounded-2xl px-4 py-3.5 text-xs text-text-primary outline-none focus:border-green/50 placeholder:text-text-secondary/30"
                      enterKeyHint="done"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleFormAddSubtask(undefined);
                          e.currentTarget.value = '';
                          e.currentTarget.blur();
                        }
                      }}
                      onBlur={(e) => {
                        handleFormAddSubtask(undefined, e.target.value);
                      }}
                    />
                    <button 
                      type="submit"
                      className="w-11 h-11 flex items-center justify-center bg-[#1e2220] hover:bg-green hover:text-background text-text-primary rounded-2xl transition-all active:scale-95 cursor-pointer shrink-0"
                    >
                      <Plus size={16} />
                    </button>
                  </form>
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
                  className="px-6 py-3.5 bg-green text-background font-bold text-xs uppercase tracking-wider rounded-2xl transition-all hover:brightness-110 cursor-pointer shadow-[0_4px_20px_rgba(110,231,168,0.2)]"
                >
                  Confirmar Ok
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <DeleteTaskModal
        isOpen={!!taskToDelete}
        onClose={() => setTaskToDelete(null)}
        onConfirm={async () => {
          if (taskToDelete) {
            await dataStore.deleteDailyTask(taskToDelete);
            dataStore.showNotification('Tarefa excluída permanentemente.', 'success');
          }
        }}
      />
    </div>
  );
};
