import { useState, type FormEvent, useMemo, useEffect, useRef } from 'react';
import { useTimerStore } from '../../store/useTimerStore';
import { useDataStore } from '../../store/useDataStore';
import { useAuthStore } from '../../store/useAuthStore';
import { supabase } from '../../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { ScheduledActivity } from '../../types';
import { 
  Plus, X, ArrowLeft, ArrowRight, Layers, Target, Clock, 
  StickyNote, History, FolderKanban, Search, Trash2,
  CircleX, AlertTriangle, CheckCircle2, CheckCircle, Pause, Info,
  Pencil, Calendar
} from 'lucide-react';
import { sendToServiceWorker } from '../../hooks/useServiceWorker';
import { unlockAudio } from '../../hooks/useSessionNotifications';
import { formatHumanTime, resolverNomeSessao, formatSessionDuration, formatTimeRange, getLocalDateString } from '../../lib/utils';

type Screen = 'session' | 'projects' | 'activities' | 'notes' | 'habits' | 'history' | 'agenda' | 'anti-vicio' | 'saved-links' | 'links-list';

import { CustomSelect } from '../ui/CustomSelect';
import { CriarAgendamentoScreen } from '../agenda/CriarAgendamentoScreen';
import { SavedLinksConfigScreen } from '../links/SavedLinksConfigScreen';
import { LinksListScreen } from '../links/LinksListScreen';
import { EditSessionModal } from '../shared/EditSessionModal';

export const ActionCenter = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentScreen, setCurrentScreen] = useState<Screen | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string, type: 'project' | 'activity' | 'habit' | 'note' | 'session', name: string } | null>(null);
  const [showListModal, setShowListModal] = useState<'projects' | 'activities' | null>(null);
  const [editingActivity, setEditingActivity] = useState<ScheduledActivity | undefined>(undefined);
  const [editingSession, setEditingSession] = useState<any>(null);

  const touchStartRef = useRef<{ x: number, y: number } | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    let current: HTMLElement | null = target;
    while (current && current !== e.currentTarget) {
      const style = window.getComputedStyle(current);
      if (
        (style.overflowX === 'auto' || style.overflowX === 'scroll' || current.scrollWidth > current.clientWidth) &&
        style.overflowX !== 'hidden'
      ) {
        return;
      }
      current = current.parentElement;
    }

    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const touch = e.changedTouches[0];
    const diffX = touch.clientX - touchStartRef.current.x;
    const diffY = touch.clientY - touchStartRef.current.y;
    touchStartRef.current = null;

    if (diffX > 80 && diffX > Math.abs(diffY) * 1.5) {
      if (currentScreen !== null) {
        if (currentScreen === 'links-list') {
          setIsOpen(false);
          setCurrentScreen(null);
        } else {
          setIsOpen(false);
          setEditingActivity(undefined);
          setCurrentScreen(null);
        }
      } else {
        setIsOpen(false);
      }
    }
  };

  const renderBottomBackButton = (customLabel?: string) => (
    <div className="pt-10 w-full flex justify-center pb-6">
      <button
        onClick={() => {
          setIsOpen(false);
          setEditingActivity(undefined);
          setCurrentScreen(null);
        }}
        className="w-full max-w-xs py-4 bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 text-text-secondary hover:text-text-primary rounded-2xl font-bold uppercase tracking-widest text-[10px] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md hover:border-white/20"
      >
        <ArrowLeft size={14} /> {customLabel || "Voltar ao Menu"}
      </button>
    </div>
  );

  const timer = useTimerStore();
  const dataStore = useDataStore();
  const { user } = useAuthStore();

  // Reset screen when opening/closing
  useEffect(() => {
    if (isOpen && currentScreen === null) {
      // Normal open, reset to menu if it was closed
    }
  }, [isOpen]);

  const [isPrefilled, setIsPrefilled] = useState(false);

  // Global event listener for opening to specific screen
  useEffect(() => {
    const handleOpen = (e: any) => {
      setIsOpen(true);
      setIsPrefilled(e.detail?.prefilled || false);
      if (e.detail?.prefilled) {
        setRegistrationMode('manual');
      }
      if (e.detail?.screen) {
        setCurrentScreen(e.detail.screen);
      } else {
        setCurrentScreen(null);
      }

      if (e.detail?.editingActivity) {
        setEditingActivity(e.detail.editingActivity);
      } else {
        setEditingActivity(undefined);
      }

      if (e.detail?.showHabitsHistory) {
        setShowHabitsModal(true);
      } else {
        setShowHabitsModal(false);
      }

      // Prefill Anti-Vício editing/creation states
      if (e.detail?.screen === 'anti-vicio' && e.detail?.editHabit) {
        const h = e.detail.editHabit;
        setEditingAvoidanceId(h.id);
        setAvoidanceName(h.name);
        
        const resolvedScope = h.monitor_type ? (h.monitor_type === 'janela' ? 'time_window' : 'full_day') : (h.avoidance_scope || 'full_day');
        setAvoidanceScope(resolvedScope);
        setAvoidanceStart(h.monitor_start || h.avoidance_window_start || '14:00');
        setAvoidanceEnd(h.monitor_end || h.avoidance_window_end || '18:00');
        
        let days: string[] = [];
        if (h.monitor_weekdays && h.monitor_weekdays !== 'all') {
          days = h.monitor_weekdays.split(',').map(d => d === '0' ? '7' : d);
        } else if (h.recurrence_days) {
          days = h.recurrence_days;
        }
        setAvoidanceDays(days);
        setAvoidanceIntensity(h.avoidance_checkin_intensity || 'balanced');
      } else if (e.detail?.screen === 'anti-vicio') {
        setEditingAvoidanceId(null);
        setAvoidanceName('');
        setAvoidanceScope('full_day');
        setAvoidanceStart('14:00');
        setAvoidanceEnd('18:00');
        setAvoidanceDays([]);
        setAvoidanceIntensity('balanced');
      }

      // Se houver dados de pré-preenchimento (ex: de um agendamento)
      if (e.detail?.prefill) {
        const p = e.detail.prefill;
        setSessionData({
          project: p.projectId || '',
          activityId: p.activityId || '',
          activityManual: p.activityManual || '',
          habit: p.habitId || '',
          description: p.notes || '',
          hours: p.hours !== undefined ? p.hours : 0,
          minutes: p.minutes !== undefined ? p.minutes : 25,
          date: getLocalDateString(new Date())
        });
        if (p.tasks) {
          setCustomUserTasks(p.tasks);
          setRestoredTasks([]);
        }
        if (p.scheduledActivityId) {
          timer.updateConfig(
            p.projectId || undefined,
            p.habitId || undefined,
            p.activityManual || undefined,
            p.activityId || undefined,
            p.scheduledActivityId
          );
        }
      } else if (e.detail?.editingHabit) {
        const habit = e.detail.editingHabit;
        setEditingHabitId(habit.id);
        setNewHabitName(habit.name);
        setNewHabitFrequency(habit.sessions_per_week || 3);
        setNewHabitDuration(habit.minutes_per_session || 0);
        setNewHabitTime(habit.preferred_time || 'morning');
        setIsRecurring(!!habit.is_recurring);
        setRecurrenceDays(habit.recurrence_days || []);
        const recTime = habit.recurrence_time || '09:00';
        const [rh, rm] = recTime.split(':');
        setRecurrenceTimeHours(rh ? rh.padStart(2, '0') : '09');
        setRecurrenceTimeMinutes(rm ? rm.padStart(2, '0') : '00');
        setIsScheduled(!!habit.is_scheduled);
        if (habit.sched_start) {
          const [sh, sm] = habit.sched_start.split(':');
          setSchedStartHH(sh || '09');
          setSchedStartMM(sm || '00');
        } else {
          setSchedStartHH('09');
          setSchedStartMM('00');
        }
        if (habit.sched_duration !== undefined && habit.sched_duration !== null) {
          const totalMin = parseInt(habit.sched_duration, 10) || 0;
          const h = Math.floor(totalMin / 60);
          const m = totalMin % 60;
          setSchedDurHH(String(h).padStart(2, '0'));
          setSchedDurMM(String(m).padStart(2, '0'));
        } else {
          setSchedDurHH('00');
          setSchedDurMM('45');
        }
        if (habit.sched_weekdays) {
          if (habit.sched_weekdays === 'all') {
            setSchedWeekdays(['1', '2', '3', '4', '5', '6', '7']);
          } else {
            setSchedWeekdays(habit.sched_weekdays.split(','));
          }
        } else {
          setSchedWeekdays([]);
        }
      }

      if (e.detail?.editProject) {
        const proj = e.detail.editProject;
        setEditingProjectId(proj.id);
        setNewProjectName(proj.name);
        setProjectsSection('create');
      } else {
        setEditingProjectId(null);
        if (e.detail?.screen === 'projects') {
          setNewProjectName('');
        }
      }

      if (e.detail?.editActivityObj) {
        const act = e.detail.editActivityObj;
        setEditingActivityId(act.id);
        setNewActivityName(act.name);
        setNewActivityProject(act.project_id || '');
        setLinkActivityToHabit(!!act.habit_id);
        setActivitiesSection('create');
      } else {
        setEditingActivityId(null);
        if (e.detail?.screen === 'activities') {
          setNewActivityName('');
          setNewActivityProject('');
          setLinkActivityToHabit(false);
        }
      }

      if (e.detail?.projectId) {
        setSessionData({
          activityId: '',
          activityManual: '',
          project: e.detail.projectId,
          habit: '',
          description: '',
          hours: 0,
          minutes: 25,
          date: getLocalDateString(new Date())
        });
        setCustomUserTasks([]);
        setRestoredTasks([]);
      }
    };
    const handleOpenSessionSetup = (e: any) => {
      setIsOpen(true);
      setCurrentScreen('session');
      setIsPrefilled(true);
      setRegistrationMode('manual');
      setSessionData({
        project: e.detail?.projectId || '',
        activityId: '',
        activityManual: e.detail?.activityName || '',
        habit: e.detail?.habitId || '',
        description: '',
        hours: e.detail?.hours || 0,
        minutes: e.detail?.minutes || 25,
        date: getLocalDateString(new Date())
      });
      if (e.detail?.sessionTasks && e.detail.sessionTasks.length > 0) {
        setCustomUserTasks(e.detail.sessionTasks);
      } else {
        setCustomUserTasks([]);
      }
      setRestoredTasks([]);
      timer.updateConfig(
        e.detail?.projectId || undefined,
        e.detail?.habitId || undefined,
        e.detail?.activityName || undefined,
        undefined,
        e.detail?.activityId
      );
    };
    window.addEventListener('open-action-center', handleOpen);
    window.addEventListener('open-session-setup', handleOpenSessionSetup);
    return () => {
      window.removeEventListener('open-action-center', handleOpen);
      window.removeEventListener('open-session-setup', handleOpenSessionSetup);
    };
  }, []);

  // Session States
  const [sessionData, setSessionData] = useState({
    activityId: '',
    activityManual: '',
    project: '',
    habit: '',
    description: '',
    hours: 0,
    minutes: 25,
    date: getLocalDateString(new Date())
  });

  // Activity States
  const [newActivityName, setNewActivityName] = useState('');
  const [newActivityProject, setNewActivityProject] = useState('');
  const [linkToHabit, setLinkToHabit] = useState<'sim' | 'nao'>('nao');
  const [newActivityHabitFrequency, setNewActivityHabitFrequency] = useState(3);
  const [newActivityHabitDuration, setNewActivityHabitDuration] = useState(0);
  const [newActivityHabitTime, setNewActivityHabitTime] = useState('morning');

  // Project/Habit/Note States
  const [newProjectName, setNewProjectName] = useState('');
  const [newHabitName, setNewHabitName] = useState('');
  const [projectsSection, setProjectsSection] = useState<'create' | 'list'>('create');
  const [activitiesSection, setActivitiesSection] = useState<'create' | 'list'>('create');
  const [linkActivityToHabit, setLinkActivityToHabit] = useState(false);
  const [pendingActivityId, setPendingActivityId] = useState<string | null>(null);
  const [newHabitFrequency, setNewHabitFrequency] = useState(3);
  const [newHabitDuration, setNewHabitDuration] = useState(0);
  const [newHabitTime, setNewHabitTime] = useState('morning');
  const [showHabitsModal, setShowHabitsModal] = useState(false);
  const [editingHabitId, setEditingHabitId] = useState<string | null>(null);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceDays, setRecurrenceDays] = useState<string[]>([]);
  const [newTaskInput, setNewTaskInput] = useState('');

  // Scheduled Habit States
  const [isScheduled, setIsScheduled] = useState(false);
  const [schedStartHH, setSchedStartHH] = useState('09');
  const [schedStartMM, setSchedStartMM] = useState('00');
  const [schedDurHH, setSchedDurHH] = useState('00');
  const [schedDurMM, setSchedDurMM] = useState('45');
  const [schedWeekdays, setSchedWeekdays] = useState<string[]>([]);

  // Helper patterns for [HH] | [MM] layout
  const [recurrenceTimeHours, setRecurrenceTimeHours] = useState('09');
  const [recurrenceTimeMinutes, setRecurrenceTimeMinutes] = useState('00');

  const handleRecurrenceHoursChange = (h: string) => {
    let val = h.replace(/\D/g, '').slice(0, 2);
    if (val !== '') {
      const num = parseInt(val, 10);
      if (!isNaN(num) && num > 23) {
        val = '23';
      }
    }
    setRecurrenceTimeHours(val);
  };

  const handleRecurrenceHoursBlur = () => {
    const num = Math.min(23, parseInt(recurrenceTimeHours, 10) || 0);
    const hs = String(num).padStart(2, '0');
    setRecurrenceTimeHours(hs);
  };

  const handleRecurrenceMinutesChange = (m: string) => {
    let val = m.replace(/\D/g, '').slice(0, 2);
    if (val !== '') {
      const num = parseInt(val, 10);
      if (!isNaN(num) && num > 59) {
        val = '59';
      }
    }
    setRecurrenceTimeMinutes(val);
  };

  const handleRecurrenceMinutesBlur = () => {
    const num = Math.min(59, parseInt(recurrenceTimeMinutes, 10) || 0);
    const ms = String(num).padStart(2, '0');
    setRecurrenceTimeMinutes(ms);
  };

  // Anti-Vício States
  const [avoidanceName, setAvoidanceName] = useState('');
  const [avoidanceScope, setAvoidanceScope] = useState<'full_day' | 'time_window'>('full_day');
  const [avoidanceStart, setAvoidanceStart] = useState('14:00');
  const [avoidanceEnd, setAvoidanceEnd] = useState('18:00');

  const [avoidanceStartHours, setAvoidanceStartHours] = useState('14');
  const [avoidanceStartMinutes, setAvoidanceStartMinutes] = useState('00');
  const [avoidanceEndHours, setAvoidanceEndHours] = useState('18');
  const [avoidanceEndMinutes, setAvoidanceEndMinutes] = useState('00');

  useEffect(() => {
    const [h, m] = avoidanceStart.split(':');
    if (h && m) {
      setAvoidanceStartHours(h.padStart(2, '0'));
      setAvoidanceStartMinutes(m.padStart(2, '0'));
    }
  }, [avoidanceStart]);

  useEffect(() => {
    const [h, m] = avoidanceEnd.split(':');
    if (h && m) {
      setAvoidanceEndHours(h.padStart(2, '0'));
      setAvoidanceEndMinutes(m.padStart(2, '0'));
    }
  }, [avoidanceEnd]);

  const handleAvoidanceStartHoursChange = (h: string) => {
    const val = h.replace(/\D/g, '').slice(0, 2);
    if (!val) {
      setAvoidanceStartHours('');
      return;
    }
    const num = parseInt(val, 10);
    if (num <= 23) {
      setAvoidanceStartHours(val);
    } else {
      setAvoidanceStartHours('23');
    }
  };

  const handleAvoidanceStartHoursBlur = () => {
    const num = Math.min(23, parseInt(avoidanceStartHours, 10) || 0);
    const hs = String(num).padStart(2, '0');
    setAvoidanceStartHours(hs);
    const currentMinNum = Math.min(59, parseInt(avoidanceStartMinutes, 10) || 0);
    const ms = String(currentMinNum).padStart(2, '0');
    setAvoidanceStart(`${hs}:${ms}`);
  };

  const handleAvoidanceStartMinutesChange = (m: string) => {
    const val = m.replace(/\D/g, '').slice(0, 2);
    if (!val) {
      setAvoidanceStartMinutes('');
      return;
    }
    const num = parseInt(val, 10);
    if (num <= 59) {
      setAvoidanceStartMinutes(val);
    } else {
      setAvoidanceStartMinutes('59');
    }
  };

  const handleAvoidanceStartMinutesBlur = () => {
    const num = Math.min(59, parseInt(avoidanceStartMinutes, 10) || 0);
    const ms = String(num).padStart(2, '0');
    setAvoidanceStartMinutes(ms);
    const currentHourNum = Math.min(23, parseInt(avoidanceStartHours, 10) || 0);
    const hs = String(currentHourNum).padStart(2, '0');
    setAvoidanceStart(`${hs}:${ms}`);
  };

  const handleAvoidanceEndHoursChange = (h: string) => {
    const val = h.replace(/\D/g, '').slice(0, 2);
    if (!val) {
      setAvoidanceEndHours('');
      return;
    }
    const num = parseInt(val, 10);
    if (num <= 23) {
      setAvoidanceEndHours(val);
    } else {
      setAvoidanceEndHours('23');
    }
  };

  const handleAvoidanceEndHoursBlur = () => {
    const num = Math.min(23, parseInt(avoidanceEndHours, 10) || 0);
    const hs = String(num).padStart(2, '0');
    setAvoidanceEndHours(hs);
    const currentMinNum = Math.min(59, parseInt(avoidanceEndMinutes, 10) || 0);
    const ms = String(currentMinNum).padStart(2, '0');
    setAvoidanceEnd(`${hs}:${ms}`);
  };

  const handleAvoidanceEndMinutesChange = (m: string) => {
    const val = m.replace(/\D/g, '').slice(0, 2);
    if (!val) {
      setAvoidanceEndMinutes('');
      return;
    }
    const num = parseInt(val, 10);
    if (num <= 59) {
      setAvoidanceEndMinutes(val);
    } else {
      setAvoidanceEndMinutes('59');
    }
  };

  const handleAvoidanceEndMinutesBlur = () => {
    const num = Math.min(59, parseInt(avoidanceEndMinutes, 10) || 0);
    const ms = String(num).padStart(2, '0');
    setAvoidanceEndMinutes(ms);
    const currentHourNum = Math.min(23, parseInt(avoidanceEndHours, 10) || 0);
    const hs = String(currentHourNum).padStart(2, '0');
    setAvoidanceEnd(`${hs}:${ms}`);
  };

  const [avoidanceDays, setAvoidanceDays] = useState<string[]>([]);
  const [avoidanceIntensity, setAvoidanceIntensity] = useState<'light' | 'balanced' | 'strong'>('balanced');
  const [editingAvoidanceId, setEditingAvoidanceId] = useState<string | null>(null);
  
  const [restoredTasks, setRestoredTasks] = useState<{ id: string; description: string }[]>([]);
  const [customUserTasks, setCustomUserTasks] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const [registrationMode, setRegistrationMode] = useState<'timer' | 'manual'>('timer');

  const resetSPState = () => {
    setSessionData({
      activityId: '',
      activityManual: '',
      project: '',
      habit: '',
      description: '',
      hours: 0,
      minutes: 25,
      date: getLocalDateString(new Date())
    });
    setCustomUserTasks([]);
    setRestoredTasks([]);
    setNewTaskInput('');
    setRegistrationMode('timer');
    setIsPrefilled(false);
  };

  const prevIsActive = useRef(timer.isActive);
  useEffect(() => {
    if (prevIsActive.current && !timer.isActive) {
      resetSPState();
    }
    prevIsActive.current = timer.isActive;
  }, [timer.isActive]);

  useEffect(() => {
    if (!isOpen && !timer.isActive) {
      resetSPState();
    }
  }, [isOpen, timer.isActive]);

  const currentContext = useMemo(() => {
    if (sessionData.habit) {
      return { type: 'habit', value: sessionData.habit };
    }
    if (sessionData.activityId) {
      return { type: 'activity', value: sessionData.activityId };
    }
    const cleanManual = sessionData.activityManual.trim();
    if (cleanManual) {
      return { type: 'manual', value: cleanManual };
    }
    return null;
  }, [sessionData.habit, sessionData.activityId, sessionData.activityManual]);

  useEffect(() => {
    if (!currentContext) {
      setRestoredTasks([]);
      return;
    }

    const matches = dataStore.pendingTasks.filter(task => {
      if (currentContext.type === 'habit') {
        return task.habit_id === currentContext.value;
      }
      if (currentContext.type === 'activity') {
        return task.activity_id === currentContext.value;
      }
      if (currentContext.type === 'manual') {
        return task.atividade_avulsa?.trim() === currentContext.value;
      }
      return false;
    });

    setRestoredTasks(matches.map(m => ({ id: m.id, description: m.description })));
  }, [currentContext, dataStore.pendingTasks]);

  const pendingTasks = useMemo(() => {
    return [...restoredTasks.map(t => t.description), ...customUserTasks];
  }, [restoredTasks, customUserTasks]);

  const [registeringHabit, setRegisteringHabit] = useState<string | null>(null);
  const [manualSessionDuration, setManualSessionDuration] = useState<number>(30);
  const [noteText, setNoteText] = useState('');
  const [noteProject, setNoteProject] = useState('');
  const [noteActivityId, setNoteActivityId] = useState('');
  const [noteDate, setNoteDate] = useState(getLocalDateString(new Date()));

  const [filterProject, setFilterProject] = useState('');
  const [filterDate, setFilterDate] = useState('');

  const filteredActivities = useMemo(() => {
    if (!sessionData.project) return dataStore.activities;
    return dataStore.activities.filter(a => a.project_id === sessionData.project);
  }, [dataStore.activities, sessionData.project]);

  const showSuccess = (msg: string) => {
    dataStore.showNotification(msg, 'success');
  };

  const handleStartSession = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    let finalActivityName = '';
    if (sessionData.activityId) {
      finalActivityName = dataStore.activities.find(a => a.id === sessionData.activityId)?.name || '';
    } else {
      finalActivityName = sessionData.activityManual;
    }

    // Activity name is NOT mandatory anymore, default to "Sessão Sem Título" if empty
    const activityName = finalActivityName || 'Sessão Sem Título';
    
    const totalMinutes = (Number(sessionData.hours) * 60) + Number(sessionData.minutes);
    if (totalMinutes < 1) return; // Validation: 1 min minimum

    if (registrationMode === 'manual') {
      if (!user) return;
      
      const now = new Date();
      const startedAt = new Date(now.getTime() - totalMinutes * 60 * 1000).toISOString();
      const completedAt = now.toISOString();

      const sessionToSave = {
        user_id: user.id,
        project_id: sessionData.project || null,
        habit_id: sessionData.habit || null,
        activity_name: activityName,
        description: sessionData.description || '',
        duration_minutes: totalMinutes,
        started_at: startedAt,
        completed_at: completedAt,
        completed: true,
        all_tasks_completed: true,
        actual_duration_minutes: totalMinutes,
        activity_id: sessionData.activityId || null,
        scheduled_activity_id: timer.scheduledActivityId || null,
      };

      try {
        useTimerStore.setState({ totalDurationMs: null });
        
        const savedSession = await dataStore.addSession(sessionToSave);

        if (savedSession?.id) {
          if (timer.scheduledActivityId) {
            const isScheduled = dataStore.scheduledActivities.some(sa => sa.id === timer.scheduledActivityId);
            if (isScheduled) {
              await dataStore.updateScheduledActivity(timer.scheduledActivityId, {
                status: 'concluida',
                completed_session_id: savedSession.id,
                resolved_at: new Date().toISOString()
              });
            } else {
              const isDailyTask = dataStore.dailyTasks.some(dt => dt.id === timer.scheduledActivityId);
              if (isDailyTask) {
                await dataStore.updateDailyTask(timer.scheduledActivityId, {
                  is_completed: true,
                  completed_at: new Date().toISOString()
                });
              }
            }
          }

          if (pendingTasks.length > 0) {
            for (const task of pendingTasks) {
              await dataStore.addSessionTask(
                savedSession.id,
                user.id,
                task,
                true // Mark as completed
              );
            }
          }

          // Auto-save note if description exists
          if (sessionData.description.trim()) {
            await dataStore.addNote(
              user.id,
              sessionData.description,
              sessionData.project || undefined,
              sessionData.activityId || undefined
            );
          }

          if (!dataStore.hasCompletedFirstSession) {
            dataStore.completeFirstSession();
          }

          showSuccess('✅ Sessão registrada com sucesso!');
          timer.reset();
          resetSPState();
          setIsOpen(false);
        }
      } catch (err) {
        console.error('Erro ao registrar sessão manual:', err);
        showSuccess('Erro ao registrar sessão manualmente.');
      }
      return;
    }
    
    // Auto-save note if description exists (Form 2)
    if (sessionData.description.trim() && user) {
      await dataStore.addNote(
        user.id,
        sessionData.description,
        sessionData.project || undefined,
        sessionData.activityId || undefined
      );
    }

    // Unlock audio context on user click gesture before timer start
    unlockAudio();

    timer.start(
      totalMinutes, 
      activityName, 
      sessionData.project || undefined, 
      sessionData.habit || undefined,
      sessionData.description,
      sessionData.date,
      sessionData.activityId || undefined,
      timer.scheduledActivityId || undefined
    );
    timer.setPendingTasks(pendingTasks);
    setRestoredTasks([]);
    setCustomUserTasks([]);
    setNewTaskInput('');
    setIsOpen(false);
  };

  const handleAddActivity = async () => {
    if (isSaving) return;
    if (!newActivityName.trim() || !user) {
      showSuccess('Por favor, insira o nome da atividade.');
      return;
    }

    if (linkActivityToHabit && isRecurring && recurrenceDays.length === 0) {
      showSuccess('Escolha pelo menos um dia fixo da semana para a recorrência.');
      return;
    }

    setIsSaving(true);
    try {
      let finalHabitId: string | null = null;

      // 1. Processamento Cascata/Batch do Hábito
      if (linkActivityToHabit) {
        const startHHFiltered = recurrenceTimeHours ? String(Math.min(23, parseInt(recurrenceTimeHours, 10) || 0)).padStart(2, '0') : '09';
        const startMMFiltered = recurrenceTimeMinutes ? String(Math.min(59, parseInt(recurrenceTimeMinutes, 10) || 0)).padStart(2, '0') : '00';
        const schedStartCombined = `${startHHFiltered}:${startMMFiltered}`;

        const durHHNum = parseInt(schedDurHH, 10) || 0;
        const durMMNum = parseInt(schedDurMM, 10) || 0;
        const schedDurMinsCombined = durHHNum * 60 + durMMNum;

        const schedulingParams = {
          is_scheduled: isRecurring,
          sched_start: isRecurring ? schedStartCombined : null,
          sched_duration: isRecurring ? (schedDurMinsCombined || null) : null,
          sched_weekdays: isRecurring ? (recurrenceDays.join(',') || 'all') : null
        };

        let targetHabitId: string | null = null;
        if (editingActivityId) {
          const oldActivity = dataStore.activities.find(a => a.id === editingActivityId);
          if (oldActivity && oldActivity.habit_id) {
            targetHabitId = oldActivity.habit_id;
          }
        }

        if (targetHabitId) {
          // Edição do Hábito já vinculado
          const success = await dataStore.updateHabit(targetHabitId, {
            name: newActivityName.trim(),
            sessions_per_week: newHabitFrequency,
            minutes_per_session: newHabitDuration,
            preferred_time: newHabitTime as 'morning' | 'afternoon' | 'evening',
            is_recurring: isRecurring,
            recurrence_days: isRecurring ? recurrenceDays : [],
            recurrence_time: isRecurring ? schedStartCombined : null,
            ...schedulingParams
          });
          if (success) {
            finalHabitId = targetHabitId;
          }
        } else {
          // Criação de um novo tipo Hábito
          const createdHabit = await dataStore.addHabit(
            user.id,
            newActivityName.trim(),
            newHabitFrequency,
            newHabitDuration,
            newHabitTime as 'morning' | 'afternoon' | 'evening',
            isRecurring,
            isRecurring ? recurrenceDays : [],
            isRecurring ? schedStartCombined : '',
            { ...schedulingParams }
          );
          if (createdHabit) {
            finalHabitId = createdHabit.id;
          }
        }
      }

      // 2. Processamento da Atividade
      if (editingActivityId) {
        // Modo Edição
        // Se desmarcou o checkbox (ou não possui mais hábito), o nome final não conterá o sufixo #habit
        const finalName = finalHabitId 
          ? `${newActivityName.trim()} #habit:${finalHabitId}` 
          : newActivityName.trim();

        const { data, error } = await supabase
          .from('activities')
          .update({
            name: finalName,
            project_id: newActivityProject || null,
            habit_id: finalHabitId || null
          })
          .eq('id', editingActivityId)
          .select()
          .single();

        if (error) throw error;

        if (data) {
          const parts = data.name.split(' #habit:');
          const parsedData = {
            ...data,
            name: parts[0],
            habit_id: parts[1] || null
          };
          const updatedActivities = dataStore.activities.map(a => a.id === editingActivityId ? parsedData : a);
          useDataStore.setState({ activities: updatedActivities });
        }
      } else {
        // Modo Criação
        const activityAdded = await dataStore.addActivity(
          user.id,
          newActivityName.trim(),
          newActivityProject || undefined,
          finalHabitId
        );
        if (!activityAdded) {
          showSuccess('Erro ao processar criação da atividade.');
          return;
        }
      }

      // Notificação de sucesso simplificada
      if (linkActivityToHabit) {
        showSuccess('✅ Atividade e Hábito salvos com sucesso!');
      } else {
        showSuccess('Atividade salva com sucesso!');
      }

      // 3. Reset do Estado & Fechamento do Modal
      setNewActivityName('');
      setNewActivityProject('');
      setLinkActivityToHabit(false);
      setNewHabitName('');
      setEditingActivityId(null);
      setEditingHabitId(null);
      setIsRecurring(false);
      setRecurrenceDays([]);
      setRecurrenceTimeHours('09');
      setRecurrenceTimeMinutes('00');
      setSchedDurHH('00');
      setSchedDurMM('45');
      setSchedStartHH('');
      setSchedStartMM('');

      setIsOpen(false);
      setCurrentScreen(null);

    } catch (err) {
      console.error('Erro crítico ao salvar atividade:', err);
      showSuccess('Erro crítico ao processar salvamento.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddProject = async () => {
    if (isSaving) return;
    const nameTrimmed = (newProjectName || '').trim();
    if (!nameTrimmed || !user) return;
    setIsSaving(true);
    try {
      if (editingProjectId) {
        const { data, error } = await supabase
          .from('projects')
          .update({ name: nameTrimmed })
          .eq('id', editingProjectId)
          .select()
          .single();
        if (error) throw error;
        if (data) {
          const updatedProjects = dataStore.projects.map(p => p.id === editingProjectId ? data : p);
          useDataStore.setState({ projects: updatedProjects });
          showSuccess('Projeto atualizado com sucesso!');
        }
        setEditingProjectId(null);
      } else {
        await dataStore.addProject(user.id, nameTrimmed);
        showSuccess('Projeto salvo com sucesso!');
      }
      setNewProjectName('');
      setIsOpen(false);
      setCurrentScreen(null);
    } catch (err) {
      console.error('Erro ao salvar projeto:', err);
      dataStore.showNotification('Erro ao salvar projeto.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditHabitClick = (habit: any) => {
    setEditingHabitId(habit.id);
    setNewHabitName(habit.name);
    setNewHabitFrequency(habit.sessions_per_week || 3);
    setNewHabitDuration(habit.minutes_per_session || 0);
    setNewHabitTime(habit.preferred_time || 'morning');
    setIsRecurring(!!habit.is_recurring);
    setRecurrenceDays(habit.recurrence_days || []);
    const recTime = habit.recurrence_time || '09:00';
    const [rh, rm] = recTime.split(':');
    setRecurrenceTimeHours(rh ? rh.padStart(2, '0') : '09');
    setRecurrenceTimeMinutes(rm ? rm.padStart(2, '0') : '00');
    
    setIsScheduled(!!habit.is_scheduled);
    if (habit.sched_start) {
      const [sh, sm] = habit.sched_start.split(':');
      setSchedStartHH(sh || '09');
      setSchedStartMM(sm || '00');
    } else {
      setSchedStartHH('09');
      setSchedStartMM('00');
    }
    if (habit.sched_duration !== undefined && habit.sched_duration !== null) {
      const totalMin = parseInt(habit.sched_duration, 10) || 0;
      const h = Math.floor(totalMin / 60);
      const m = totalMin % 60;
      setSchedDurHH(String(h).padStart(2, '0'));
      setSchedDurMM(String(m).padStart(2, '0'));
    } else {
      setSchedDurHH('00');
      setSchedDurMM('45');
    }
    if (habit.sched_weekdays) {
      if (habit.sched_weekdays === 'all') {
        setSchedWeekdays(['1', '2', '3', '4', '5', '6', '7']);
      } else {
        setSchedWeekdays(habit.sched_weekdays.split(',').filter(Boolean));
      }
    } else {
      setSchedWeekdays([]);
    }

    // Smoothly scroll the container to the top so fields are visible
    const scrollContainer = document.querySelector('.overflow-y-auto');
    if (scrollContainer) {
      scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleAddHabit = async () => {
    if (isSaving) return;
    if (!newHabitName.trim() || !user) {
      showSuccess('Por favor, insira o nome do hábito.');
      return;
    }
    if (isRecurring && recurrenceDays.length === 0) {
      showSuccess('Escolha pelo menos um dia fixo da semana para a recorrência.');
      return;
    }

    // Vinculação Automática: Se for recorrente, o sistema agenda automaticamente
    const startHHFiltered = recurrenceTimeHours ? String(Math.min(23, parseInt(recurrenceTimeHours, 10) || 0)).padStart(2, '0') : '09';
    const startMMFiltered = recurrenceTimeMinutes ? String(Math.min(59, parseInt(recurrenceTimeMinutes, 10) || 0)).padStart(2, '0') : '00';
    const schedStartCombined = `${startHHFiltered}:${startMMFiltered}`;

    const durHHNum = parseInt(schedDurHH, 10) || 0;
    const durMMNum = parseInt(schedDurMM, 10) || 0;
    const schedDurMinsCombined = durHHNum * 60 + durMMNum;

    const schedulingParams = {
      is_scheduled: isRecurring, // Todo hábito com dia fixo agora é agendado no sistema de alertas
      sched_start: isRecurring ? schedStartCombined : null,
      sched_duration: isRecurring ? (schedDurMinsCombined || null) : null,
      sched_weekdays: isRecurring ? (recurrenceDays.join(',') || 'all') : null
    };

    setIsSaving(true);
    try {
      if (editingHabitId) {
        const success = await dataStore.updateHabit(editingHabitId, {
          name: newHabitName.trim(),
          sessions_per_week: newHabitFrequency,
          minutes_per_session: newHabitDuration,
          preferred_time: newHabitTime as 'morning' | 'afternoon' | 'evening',
          is_recurring: isRecurring,
          recurrence_days: isRecurring ? recurrenceDays : [],
          recurrence_time: isRecurring ? schedStartCombined : null,
          ...schedulingParams
        });
        if (success) {
          showSuccess('✅ Hábito atualizado e agendado com sucesso!');
          setEditingHabitId(null);
          setIsOpen(false);
          setCurrentScreen(null);
        }
      } else {
        const createdHabit = await dataStore.addHabit(
          user.id,
          newHabitName.trim(),
          newHabitFrequency,
          newHabitDuration,
          newHabitTime as 'morning' | 'afternoon' | 'evening',
          isRecurring,
          isRecurring ? recurrenceDays : [],
          isRecurring ? schedStartCombined : '',
          { ...schedulingParams }
        );

        if (createdHabit) {
          showSuccess('✅ Hábito criado e agendado com sucesso!');

          if (pendingActivityId) {
            const activity = dataStore.activities.find(a => a.id === pendingActivityId);
            if (activity) {
              const updatedName = `${activity.name} #habit:${createdHabit.id}`;
              const { error: updateError } = await supabase
                .from('activities')
                .update({ name: updatedName })
                .eq('id', pendingActivityId);

              if (!updateError) {
                const updatedActivities = dataStore.activities.map(a =>
                  a.id === pendingActivityId ? { ...a, habit_id: createdHabit.id } : a
                );
                useDataStore.setState({ activities: updatedActivities });
              } else {
                console.error('Erro ao vincular atividade ao hábito:', updateError);
              }
            }
            setPendingActivityId(null);
          }

          setIsOpen(false);
          setCurrentScreen(null);
        } else {
          showSuccess('Erro ao criar hábito.');
        }
      }

      setNewHabitName('');
      setIsRecurring(false);
      setRecurrenceDays([]);
      setRecurrenceTimeHours('09');
      setRecurrenceTimeMinutes('00');
      setSchedDurHH('00');
      setSchedDurMM('45');
      setSchedStartHH('');
      setSchedStartMM('');
    } catch (err) {
      showSuccess('Erro ao salvar hábito.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddAvoidance = async () => {
    if (isSaving) return;
    if (!avoidanceName || avoidanceName.trim() === '' || !user) {
      dataStore.showNotification('Por favor, informe o vício ou comportamento que deseja controlar.', 'error');
      return;
    }

    let finalStart = avoidanceStart;
    let finalEnd = avoidanceEnd;

    if (avoidanceScope === 'time_window') {
      const startHs = String(Math.min(23, parseInt(avoidanceStartHours, 10) || 0)).padStart(2, '0');
      const startMs = String(Math.min(59, parseInt(avoidanceStartMinutes, 10) || 0)).padStart(2, '0');
      finalStart = `${startHs}:${startMs}`;

      const endHs = String(Math.min(23, parseInt(avoidanceEndHours, 10) || 0)).padStart(2, '0');
      const endMs = String(Math.min(59, parseInt(avoidanceEndMinutes, 10) || 0)).padStart(2, '0');
      finalEnd = `${endHs}:${endMs}`;

      if (!finalStart || !finalEnd) {
        dataStore.showNotification('Por favor, defina a janela de horários para o autocontrole.', 'error');
        return;
      }
    }

    setIsSaving(true);
    try {
      const payload = {
        habit_mode: 'avoid' as 'build' | 'avoid',
        avoidance_target: avoidanceName.trim(),
        avoidance_scope: avoidanceScope,
        avoidance_window_start: avoidanceScope === 'time_window' ? finalStart : null,
        avoidance_window_end: avoidanceScope === 'time_window' ? finalEnd : null,
        avoidance_checkin_intensity: avoidanceIntensity,
        monitor_type: (avoidanceScope === 'time_window' ? 'janela' : 'dia_todo') as 'janela' | 'dia_todo',
        monitor_start: avoidanceScope === 'time_window' ? finalStart : null,
        monitor_end: avoidanceScope === 'time_window' ? finalEnd : null,
        monitor_weekdays: avoidanceDays.length === 0 ? 'all' : avoidanceDays.map(d => d === '7' ? '0' : d).join(','),
      };

      if (editingAvoidanceId) {
        const success = await dataStore.updateHabit(editingAvoidanceId, {
          name: avoidanceName.trim(),
          recurrence_days: avoidanceDays,
          ...payload
        });
        if (success) {
          dataStore.showNotification('Módulo Anti-Vício atualizado com sucesso.', 'success');
          setIsOpen(false);
          setCurrentScreen(null);
        } else {
          dataStore.showNotification('Não foi possível atualizar as configurações.', 'error');
        }
      } else {
        const result = await dataStore.addHabit(
          user.id,
          avoidanceName.trim(),
          7, // Dummy sessions_per_week
          25, // Dummy minutes_per_session
          'afternoon', // Dummy preferred_time
          false, // is_recurring dummy
          avoidanceDays,
          null,
          payload
        );
        if (result) {
          dataStore.showNotification('Módulo Anti-Vício cadastrado com sucesso!', 'success');
          setIsOpen(false);
          setCurrentScreen(null);
        } else {
          dataStore.showNotification('Erro ao criar módulo Anti-Vício.', 'error');
        }
      }

      setAvoidanceName('');
      setAvoidanceScope('full_day');
      setAvoidanceStart('14:00');
      setAvoidanceEnd('18:00');
      setAvoidanceDays([]);
      setAvoidanceIntensity('balanced');
      setEditingAvoidanceId(null);
    } catch (err) {
      console.error('Erro ao salvar autocontrole:', err);
      dataStore.showNotification('Erro interno ao salvar autocontrole.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddNote = async () => {
    if (isSaving) return;
    if (!noteText || !user) return;
    setIsSaving(true);
    try {
      await dataStore.addNote(
        user.id, 
        noteText, 
        noteProject || undefined,
        noteActivityId || undefined
      );
      setNoteText('');
      setNoteProject('');
      setNoteActivityId('');
      showSuccess('✅ Anotação salva!');
      setIsOpen(false);
      setCurrentScreen(null);
    } catch (err) {
      console.error('Erro ao salvar anotação:', err);
      dataStore.showNotification('Erro ao criar anotação.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    const { id, type } = deleteConfirm;
    
    if (type === 'project') {
      try {
        // Desvincular daily_tasks
        const linkedTasks = dataStore.dailyTasks.filter(t => t.project_id === id);
        for (const t of linkedTasks) {
          await supabase.from('daily_tasks').update({ project_id: null }).eq('id', t.id);
        }
        // Desvincular scheduled_activities
        const linkedSched = dataStore.scheduledActivities.filter(sa => sa.project_id === id);
        for (const sa of linkedSched) {
          await supabase.from('scheduled_activities').update({ project_id: null }).eq('id', sa.id);
        }
        // Desvincular activities
        const linkedActs = dataStore.activities.filter(a => a.project_id === id);
        for (const a of linkedActs) {
          await supabase.from('activities').update({ project_id: null }).eq('id', a.id);
        }
        
        // Also update local state
        const updatedTasks = dataStore.dailyTasks.map(t => t.project_id === id ? { ...t, project_id: null } : t);
        const updatedSched = dataStore.scheduledActivities.map(sa => sa.project_id === id ? { ...sa, project_id: null } : sa);
        const updatedActs = dataStore.activities.map(a => a.project_id === id ? { ...a, project_id: null } : a);
        
        useDataStore.setState({
          dailyTasks: updatedTasks,
          scheduledActivities: updatedSched,
          activities: updatedActs
        });
      } catch (err) {
        console.error('Erro ao desvincular recursos do projeto:', err);
      }
      
      await dataStore.deleteProject(id);
      showSuccess('Projeto excluído com sucesso!');
    } else if (type === 'activity') {
      try {
        // Desvincular daily_tasks
        const linkedTasks = dataStore.dailyTasks.filter(t => t.activity_id === id);
        for (const t of linkedTasks) {
          await supabase.from('daily_tasks').update({ activity_id: null }).eq('id', t.id);
        }
        // Desvincular scheduled_activities
        const linkedSched = dataStore.scheduledActivities.filter(sa => sa.activity_id === id);
        for (const sa of linkedSched) {
          await supabase.from('scheduled_activities').update({ activity_id: null }).eq('id', sa.id);
        }
        
        // Also update local state
        const updatedTasks = dataStore.dailyTasks.map(t => t.activity_id === id ? { ...t, activity_id: null } : t);
        const updatedSched = dataStore.scheduledActivities.map(sa => sa.activity_id === id ? { ...sa, activity_id: null } : sa);
        
        useDataStore.setState({
          dailyTasks: updatedTasks,
          scheduledActivities: updatedSched
        });
      } catch (err) {
        console.error('Erro ao desvincular recursos da atividade:', err);
      }
      
      await dataStore.deleteActivity(id);
      showSuccess('Atividade excluída com sucesso!');
    } else {
      if (type === 'habit') await dataStore.deleteHabit(id);
      if (type === 'note') await dataStore.deleteNote(id);
      if (type === 'session') await dataStore.deleteSession(id);
    }
    setDeleteConfirm(null);
  };

  const inputClasses = "w-full bg-white/5 border border-white/20 rounded-2xl p-4 text-text-primary outline-none focus:border-primary-green transition-all placeholder:text-text-secondary/50 touch-manipulation min-h-[44px]";
  const labelClasses = "text-[10px] font-bold uppercase tracking-widest text-text-secondary opacity-70 mb-2 block";
  const selectClasses = "w-full bg-white/5 border border-white/20 rounded-2xl p-4 text-text-primary outline-none focus:border-primary-green transition-all touch-manipulation min-h-[44px] cursor-pointer appearance-none px-4";

  const renderMenu = () => {
    const menuItems: { id: Screen, label: string, subtitle: string }[] = [
      {
        id: 'session',
        label: 'SESSÃO PROFUNDA',
        subtitle: 'Vai usar seu tempo para qual finalidade? Controle seu tempo agora!'
      },
      {
        id: 'agenda',
        label: 'AGENDAMENTOS',
        subtitle: 'Defina quando vai executar suas próximas atividades.'
      },
      {
        id: 'projects',
        label: 'PROJETOS',
        subtitle: 'Liste todos os projetos que você precisa executar.'
      },
      {
        id: 'activities',
        label: 'ATIVIDADES',
        subtitle: 'Defina as tarefas padrões que seus projetos demandam.'
      },
      {
        id: 'habits',
        label: 'HÁBITOS ATÔMICOS',
        subtitle: 'Tudo aquilo que você pratica repetidamente, se torna um hábito.'
      },
      {
        id: 'anti-vicio',
        label: 'ANTI-VÍCIO',
        subtitle: 'Centro para se livrar de vícios que impedem seu real desenvolvimento pessoal.'
      },
      {
        id: 'notes',
        label: 'ANOTAÇÕES',
        subtitle: 'Seu espaço para registrar o que não pode ser esquecido.'
      },
      {
        id: 'saved-links',
        label: 'ORGANIZADOR DE LINKS',
        subtitle: 'Centro organizacional dos links mais importantes para acessar sempre que precisar'
      },
      {
        id: 'history',
        label: 'HISTÓRICO',
        subtitle: 'Seu passado operacional revela seus padrões de execução.'
      }
    ];

    return (
      <div className="w-full max-w-lg space-y-0">
        {menuItems.map((item) => (
          <div key={item.id}>
            <button
              onClick={() => setCurrentScreen(item.id)}
              className="w-full py-5 px-6 bg-surface/40 border border-white/10 rounded-2xl text-left hover:border-primary-green/40 active:scale-95 transition-all duration-200"
            >
              <span className="text-lg font-bold text-text-primary tracking-tight block">
                {item.label}
              </span>
            </button>
            <p className="text-xs text-text-secondary/60 px-2 mt-2 mb-4">
              {item.subtitle}
            </p>
          </div>
        ))}
        
        <div className="pt-4">
          <button
            onClick={() => setIsOpen(false)}
            className="w-full py-4 border border-primary-green/30 text-primary-green rounded-2xl font-bold uppercase tracking-widest text-sm hover:bg-primary-green/10 transition-all"
          >
            ← Voltar
          </button>
        </div>
      </div>
    );
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && currentScreen !== 'links-list' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={isPrefilled || currentScreen !== null
              ? "fixed inset-x-0 top-16 bottom-20 z-[200] bg-black/70 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
              : "fixed inset-x-0 top-16 bottom-20 z-[200] bg-background/95 backdrop-blur-3xl flex flex-col items-center px-6 py-12 md:py-24 overflow-y-auto"
            }
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <div className={isPrefilled || currentScreen !== null
              ? "w-full max-w-xl bg-background border border-white/10 p-6 md:p-8 rounded-[2rem] shadow-2xl space-y-6 my-auto max-h-[85vh] flex flex-col overflow-y-auto"
              : "w-full max-w-4xl space-y-12 pb-32"
            }>
              <header className="flex justify-between items-center border-b border-white/5 pb-8">
                <div className="flex items-center gap-4">
                  {currentScreen !== null && (
                    <button 
                      onClick={() => {
                        setIsOpen(false);
                        setCurrentScreen(null);
                      }}
                      className="flex items-center gap-2 text-text-secondary hover:text-primary-green transition-colors font-bold uppercase tracking-widest text-[10px]"
                    >
                      <ArrowLeft size={16} /> Voltar
                    </button>
                  )}
                  <div className="space-y-1">
                    <h2 className="text-[10px] font-bold uppercase tracking-[0.4em] text-text-secondary opacity-40">Centro de Operações</h2>
                    <p className="text-[8px] text-primary-green/60 font-mono text-left">MODO EXECUÇÃO ATIVADO</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-10 h-10 rounded-full border border-border-white flex items-center justify-center text-text-secondary hover:text-text-primary hover:border-primary-green transition-all"
                >
                  <X size={18} />
                </button>
              </header>

              <div className="flex flex-col items-center">
                {currentScreen === null && renderMenu()}
                
                {currentScreen === 'session' && (
                  <div className="w-full max-w-2xl space-y-10">
                    {isPrefilled ? (
                      <div className="space-y-1">
                        <h3 className="text-xl md:text-2xl font-bold tracking-tight text-white text-center">Concluir Execução</h3>
                        <p className="text-sm font-mono text-primary-green uppercase tracking-widest text-center">{sessionData.activityManual}</p>
                      </div>
                    ) : (
                      <h3 className="text-3xl font-bold tracking-tight text-text-primary text-center">Sessão Profunda</h3>
                    )}
                    {timer.isActive ? (
                       <div className="bg-surface/30 border border-primary-green/20 p-10 rounded-[2.5rem] text-center space-y-6">
                         <p className="text-primary-green/60 font-mono text-xs uppercase tracking-widest">Sessão em curso</p>
                         <h4 className="text-4xl font-light text-text-primary tracking-tight">{(timer.activityName && timer.activityName !== 'Sessão Sem Título') ? timer.activityName : 'Sessão Profunda'}</h4>
                         <button onClick={() => setShowCancelConfirm(true)} className="px-10 py-4 border border-white/10 text-text-secondary hover:text-red-400 hover:border-red-400/30 rounded-2xl font-bold uppercase tracking-widest text-[10px] transition-all min-h-[44px]">Cancelar Sessão</button>
                       </div>
                    ) : (
                      <div className="space-y-8 bg-surface/10 p-8 rounded-[2.5rem] border border-white/5">
                        {!isPrefilled && (
                          <>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                              <div className="space-y-1 text-left">
                                <label className={labelClasses}>Projeto (opcional)</label>
                                <CustomSelect
                                  value={sessionData.project}
                                  onChange={val => setSessionData({...sessionData, project: val, activityId: ''})}
                                  placeholder="Geral (Sem Projeto)"
                                  options={[
                                    { value: '', label: 'Geral (Sem Projeto)' },
                                    ...dataStore.projects.map(p => ({ value: p.id, label: p.name }))
                                  ]}
                                />
                              </div>
                              <div className="space-y-1 text-left">
                                <label className={labelClasses}>Atividade (opcional)</label>
                                <CustomSelect
                                  className={!!sessionData.activityManual ? 'opacity-50 pointer-events-none' : ''}
                                  value={sessionData.activityId}
                                  onChange={val => setSessionData({...sessionData, activityId: val})}
                                  placeholder="Selecionar Atividade"
                                  options={[
                                    { value: '', label: 'Selecionar Atividade' },
                                    ...filteredActivities.map(a => ({ value: a.id, label: a.name }))
                                  ]}
                                />
                              </div>
                            </div>
                            <div className="space-y-1 text-left">
                              <label className={labelClasses}>Atividade Avulsa (opcional)</label>
                              <input
                                disabled={!!sessionData.activityId}
                                autoComplete="off" autoCorrect="off" enterKeyHint="done" inputMode="text"
                                placeholder="Atividade sem projeto..."
                                className={inputClasses}
                                value={sessionData.activityManual}
                                onChange={e => setSessionData({...sessionData, activityManual: e.target.value})}
                              />
                            </div>
                            <div className="space-y-1 text-left">
                              <label className={labelClasses}>Vincular Hábito (opcional)</label>
                              <CustomSelect
                                value={sessionData.habit}
                                onChange={val => setSessionData({...sessionData, habit: val})}
                                placeholder="Nenhum"
                                options={[
                                  { value: '', label: 'Nenhum' },
                                  ...dataStore.habits.filter(h => h.habit_mode !== 'avoid').map(h => ({ 
                                    value: h.id, 
                                    label: `${h.name} (${h.sessions_this_week}/${h.sessions_per_week} esta semana)`
                                  }))
                                ]}
                              />
                            </div>
                          </>
                        )}
                        <div className="space-y-3 text-left">
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
                                  setCustomUserTasks([...customUserTasks, newTaskInput.trim()]);
                                  setNewTaskInput('');
                                  (e.target as HTMLInputElement).blur();
                                }
                              }}
                              onBlur={() => {
                                if (newTaskInput.trim()) {
                                  setCustomUserTasks([...customUserTasks, newTaskInput.trim()]);
                                  setNewTaskInput('');
                                }
                              }}
                            />
                            <button
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                if (newTaskInput.trim()) {
                                  setCustomUserTasks([...customUserTasks, newTaskInput.trim()]);
                                  setNewTaskInput('');
                                }
                              }}
                              className="w-12 h-12 bg-primary-green/20 hover:bg-primary-green/30 border border-primary-green/30 rounded-2xl flex items-center justify-center text-primary-green transition-all"
                            >
                              <Plus size={18} />
                            </button>
                          </div>

                          {restoredTasks.length > 0 && (
                            <div 
                              id="pending-tasks-banner"
                              className="bg-[#fbbf24]/[0.06] border border-[#fbbf24]/20 rounded-[6px] py-2 px-3 flex items-center gap-2 text-[#fbbf24] text-[11px] tracking-[0.04em] mb-2 font-medium"
                            >
                              <Info size={14} className="shrink-0 text-[#fbbf24]" id="pending-tasks-info-icon" />
                              <span>
                                {restoredTasks.length === 1 
                                  ? '1 tarefa pendente de sessão anterior' 
                                  : `${restoredTasks.length} tarefas pendentes de sessão anterior`}
                              </span>
                            </div>
                          )}

                          {pendingTasks.length > 0 && (
                            <div className="space-y-2 mt-2">
                              {pendingTasks.map((task, i) => (
                                <div key={i} className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/10">
                                  <div className="w-2 h-2 rounded-full bg-white/20 shrink-0" />
                                  <span className="text-sm text-text-primary flex-1 font-light">{task}</span>
                                  <button
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      if (i < restoredTasks.length) {
                                        setRestoredTasks(restoredTasks.filter((_, idx) => idx !== i));
                                      } else {
                                        const customIdx = i - restoredTasks.length;
                                        setCustomUserTasks(customUserTasks.filter((_, idx) => idx !== customIdx));
                                      }
                                    }}
                                    className="text-red-500/40 hover:text-red-500 transition-colors"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="space-y-6">
                          <div className="grid grid-cols-2 gap-4">
                             {/* HORAS */}
                             <div className="space-y-1 text-left">
                               <label className={labelClasses}>Horas</label>
                               <input
                                 type="tel"
                                 inputMode="numeric"
                                 pattern="[0-9]*"
                                 maxLength={2}
                                 enterKeyHint="done"
                                 placeholder="0"
                                 className={`${inputClasses} text-center text-2xl font-bold`}
                                 value={sessionData.hours === 0 ? '' : sessionData.hours}
                                 onFocus={(e) => e.target.select()}
                                 onChange={(e) => {
                                   const val = e.target.value.replace(/\D/g, '');
                                   const num = parseInt(val) || 0;
                                   setSessionData({...sessionData, hours: Math.min(12, num)});
                                 }}
                                 onBlur={(e) => {
                                   if (!e.target.value) {
                                     setSessionData({...sessionData, hours: 0});
                                   }
                                   e.target.blur();
                                 }}
                                 onKeyDown={(e) => {
                                   if (e.key === 'Enter') {
                                     e.preventDefault();
                                     (e.target as HTMLInputElement).blur();
                                   }
                                 }}
                               />
                             </div>

                             {/* MINUTOS */}
                             <div className="space-y-1 text-left">
                               <label className={labelClasses}>Minutos</label>
                               <input
                                 type="tel"
                                 inputMode="numeric"
                                 pattern="[0-9]*"
                                 maxLength={2}
                                 enterKeyHint="done"
                                 placeholder="25"
                                 className={`${inputClasses} text-center text-2xl font-bold`}
                                 value={sessionData.minutes === 0 ? '' : sessionData.minutes}
                                 onFocus={(e) => e.target.select()}
                                 onChange={(e) => {
                                   const val = e.target.value.replace(/\D/g, '');
                                   const num = parseInt(val) || 0;
                                   setSessionData({...sessionData, minutes: Math.min(59, num)});
                                 }}
                                 onBlur={(e) => {
                                   if (!e.target.value) {
                                     setSessionData({...sessionData, minutes: 0});
                                   }
                                   e.target.blur();
                                 }}
                                 onKeyDown={(e) => {
                                   if (e.key === 'Enter') {
                                     e.preventDefault();
                                     (e.target as HTMLInputElement).blur();
                                   }
                                 }}
                               />
                             </div>
                          </div>

                          {/* COMO DESEJA REGISTRAR */}
                          {!isPrefilled && (
                          <div className="space-y-3 pt-4 border-t border-white/5 text-left">
                            <label className={labelClasses}>Como deseja registrar?</label>
                            <div className="flex gap-4">
                              <button
                                type="button"
                                onClick={() => setRegistrationMode('timer')}
                                className={`flex-grow md:flex-1 py-3.5 px-4 rounded-xl font-bold uppercase tracking-widest text-[10px] border transition-all duration-200 min-h-[44px] ${
                                  registrationMode === 'timer'
                                    ? 'bg-primary-green/10 border-primary-green/40 text-primary-green shadow-[0_0_15px_rgba(110,231,168,0.15)]'
                                    : 'bg-transparent border-white/10 text-text-secondary hover:border-white/20'
                                }`}
                              >
                                Sessão com Timer
                              </button>
                              <button
                                type="button"
                                onClick={() => setRegistrationMode('manual')}
                                className={`flex-grow md:flex-1 py-3.5 px-4 rounded-xl font-bold uppercase tracking-widest text-[10px] border transition-all duration-200 min-h-[44px] ${
                                  registrationMode === 'manual'
                                    ? 'bg-white/5 border-white/30 text-text-primary'
                                    : 'bg-transparent border-white/10 text-text-secondary hover:border-white/20'
                                }`}
                              >
                                Registrar Manualmente
                              </button>
                            </div>
                          </div>
                          )}

                          <button
                            onClick={async () => {
                              if (isPrefilled) {
                                try {
                                  // 1. Salva a sessão manual com o tempo informado e as tarefas da sessão
                                  await dataStore.addManualSession({
                                    activityName: sessionData.activityManual,
                                    projectId: sessionData.project || null,
                                    activityId: timer.scheduledActivityId,
                                    durationMinutes: (Number(sessionData.hours) * 60) + Number(sessionData.minutes),
                                    sessionTasks: customUserTasks,
                                    completed_at: new Date().toISOString()
                                  });
                                  
                                  // 2. Atualiza a tarefa original para concluída no banco de dados
                                  if (timer.scheduledActivityId) {
                                    await dataStore.updateDailyTask(timer.scheduledActivityId, { 
                                      is_completed: true, 
                                      completed_at: new Date().toISOString() 
                                    });
                                  }
                                  
                                  // 3. Fecha o modal instantaneamente para retornar à tela de TAREFAS
                                  setIsOpen(false);
                                  
                                } catch (err) {
                                  console.error("Erro ao registrar sessão:", err);
                                }
                              } else {
                                handleStartSession();
                              }
                            }}
                            disabled={(sessionData.hours === 0 && sessionData.minutes === 0)}
                            className="w-full py-5 bg-primary-green text-background rounded-2xl font-bold uppercase tracking-widest text-[10px] shadow-[0_0_40px_rgba(110,231,168,0.2)] disabled:opacity-20 transition-all duration-200 flex items-center justify-center gap-2 min-h-[44px] cursor-pointer"
                          >
                            {registrationMode === 'timer' ? 'INICIAR' : 'REGISTRAR'}
                            {registrationMode === 'timer' && <ArrowRight size={14} />}
                          </button>
                        </div>
                      </div>
                    )}
                    {isPrefilled ? renderBottomBackButton("VOLTAR PARA TAREFAS") : renderBottomBackButton()}
                  </div>
                )}

                {currentScreen === 'projects' && (
                  <div className="w-full max-w-xl mx-auto flex flex-col h-full max-h-[70vh]">
                    {/* Header do Sub-menu */}
                    <div className="text-center mb-6">
                      <h3 className="text-2xl font-bold tracking-tight text-text-primary">Projetos</h3>
                      <p className="text-xs text-text-secondary/60 mt-1">
                        Gerencie e organize seus escopos de trabalho.
                      </p>
                    </div>

                    {/* Ramal de Menu: Exibe "CRIAR" e "VER TODOS" */}
                    <div className="flex gap-1.5 p-1 bg-white/5 rounded-2xl mb-6 border border-white/5">
                      <button
                        onClick={() => setProjectsSection('create')}
                        type="button"
                        className={`flex-1 py-2.5 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all ${
                          projectsSection === 'create'
                            ? 'bg-primary-green text-background shadow-lg shadow-primary-green/10'
                            : 'text-text-secondary hover:text-white'
                        }`}
                      >
                        {editingProjectId ? 'Editar Projeto' : 'Criar Projeto'}
                      </button>
                      <button
                        onClick={() => setProjectsSection('list')}
                        type="button"
                        className={`flex-1 py-2.5 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all ${
                          projectsSection === 'list'
                            ? 'bg-primary-green text-background shadow-lg shadow-primary-green/10'
                            : 'text-text-secondary hover:text-white'
                        }`}
                      >
                        Ver Todos ({dataStore.projects.length})
                      </button>
                    </div>

                    {/* Conteúdo dinâmico da seção */}
                    <div className="flex-1 overflow-y-auto pr-1 min-h-[220px] max-h-[350px]">
                      {projectsSection === 'create' ? (
                        <div className="bg-surface/10 p-6 rounded-3xl border border-white/5 space-y-5 text-left">
                          <div className="space-y-1">
                            <label className={labelClasses}>{editingProjectId ? 'Editar Nome do Projeto' : 'Nome do Projeto'}</label>
                            <input
                              autoComplete="off" autoCorrect="off" enterKeyHint="done" inputMode="text"
                              placeholder="Ex: TCC, Lançamento, Exercícios..."
                              className={inputClasses}
                              value={newProjectName}
                              onChange={e => setNewProjectName(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  (e.target as HTMLInputElement).blur();
                                }
                              }}
                            />
                          </div>
                          <button
                            onClick={handleAddProject}
                            className="w-full py-4 bg-primary-green hover:bg-primary-green/90 text-background rounded-2xl font-bold uppercase tracking-widest text-[10px] transition-all min-h-[44px] shadow-lg shadow-primary-green/5"
                          >
                            {editingProjectId ? 'Atualizar Projeto' : 'Salvar Projeto'}
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {dataStore.projects.map(item => (
                            <div key={item.id} className="p-4 bg-surface/30 border border-white/5 rounded-2xl flex justify-between items-center transition-all hover:bg-surface/40">
                              <div className="text-left">
                                <h4 className="text-sm font-medium text-text-primary">{item.name}</h4>
                                <p className="text-[9px] text-text-secondary/40 font-bold uppercase tracking-widest mt-0.5">
                                  {item.created_at ? new Date(item.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : 'Recente'}
                                </p>
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => {
                                    setEditingProjectId(item.id);
                                    setNewProjectName(item.name);
                                    setProjectsSection('create');
                                  }}
                                  className="p-2 text-text-secondary hover:text-primary-green hover:bg-white/5 rounded-xl transition-all cursor-pointer"
                                  title="Editar Projeto"
                                >
                                  <Pencil size={15} />
                                </button>
                                <button
                                  onClick={() => setDeleteConfirm({ id: item.id, type: 'project', name: item.name })}
                                  className="p-2 text-red-500/40 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all cursor-pointer"
                                  title="Excluir Projeto"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </div>
                          ))}
                          {dataStore.projects.length === 0 && (
                            <p className="text-text-secondary/20 italic text-center py-12 text-xs">Nenhum projeto registrado.</p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Botões de Rodapé customizados de acordo com as especificações */}
                    <div className="pt-4 border-t border-white/5 mt-6 w-full flex justify-center">
                      {projectsSection === 'create' ? (
                        <button
                          onClick={() => setCurrentScreen(null)}
                          type="button"
                          className="w-full py-3.5 bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 text-text-secondary hover:text-text-primary rounded-xl font-bold uppercase tracking-widest text-[10px] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
                        >
                          <ArrowLeft size={14} /> Voltar ao Menu
                        </button>
                      ) : (
                        <button
                          onClick={() => setProjectsSection('create')}
                          type="button"
                          className="w-full py-3.5 bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 text-text-secondary hover:text-text-primary rounded-xl font-bold uppercase tracking-widest text-[10px] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
                        >
                          <ArrowLeft size={14} /> Voltar
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {currentScreen === 'activities' && (
                  <div className="w-full max-w-xl mx-auto flex flex-col h-full max-h-[70vh]">
                    {/* Header do Sub-menu */}
                    <div className="text-center mb-6">
                      <h3 className="text-2xl font-bold tracking-tight text-text-primary">Atividades</h3>
                    </div>

                    {/* Ramal de Menu: Exibe "CRIAR" e "VER TODOS" */}
                    <div className="flex gap-1.5 p-1 bg-white/5 rounded-2xl mb-6 border border-white/5">
                      <button
                        onClick={() => setActivitiesSection('create')}
                        type="button"
                        className={`flex-1 py-2.5 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all ${
                          activitiesSection === 'create'
                            ? 'bg-primary-green text-background shadow-lg shadow-primary-green/10'
                            : 'text-text-secondary hover:text-white'
                        }`}
                      >
                        {editingActivityId ? 'Editar Atividade' : 'Criar Atividade'}
                      </button>
                      <button
                        onClick={() => setActivitiesSection('list')}
                        type="button"
                        className={`flex-1 py-2.5 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all ${
                          activitiesSection === 'list'
                            ? 'bg-primary-green text-background shadow-lg shadow-primary-green/10'
                            : 'text-text-secondary hover:text-white'
                        }`}
                      >
                        Ver Todas ({dataStore.activities.length})
                      </button>
                    </div>

                    {/* Conteúdo dinâmico da seção */}
                    <div className="flex-1 overflow-y-auto pr-1 min-h-[220px] max-h-[480px]">
                      {activitiesSection === 'create' ? (
                        <div className="bg-surface/10 p-6 rounded-3xl border border-white/5 space-y-4 text-left">
                          <div className="space-y-1">
                            <label className={labelClasses}>{editingActivityId ? 'Editar Nome da Atividade' : 'Nome da Atividade'}</label>
                            <input
                              autoComplete="off" autoCorrect="off" enterKeyHint="done" inputMode="text"
                              placeholder="Ex: Refatoração, Estudo, Reunião..."
                              className={inputClasses}
                              value={newActivityName}
                              onChange={e => setNewActivityName(e.target.value)}
                              onKeyDown={e => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    (e.target as HTMLInputElement).blur();
                                  }
                              }}
                            />
                          </div>

                          <div className="space-y-1">
                            <label className={labelClasses}>Vincular Projeto (Opcional)</label>
                            <CustomSelect
                              value={newActivityProject}
                              onChange={val => setNewActivityProject(val)}
                              placeholder="Geral (Sem Projeto)"
                              options={[
                                { value: '', label: 'Geral (Sem Projeto)' },
                                ...dataStore.projects.map(p => ({ value: p.id, label: p.name }))
                              ]}
                            />
                          </div>

                          {/* Checkbox: "Vincular atividade a um hábito?" */}
                          <div className="pt-2 border-t border-white/5">
                            <label className="flex items-center gap-3 cursor-pointer select-none py-1.5 text-text-primary text-left">
                              <input
                                type="checkbox"
                                checked={linkActivityToHabit}
                                onChange={(e) => setLinkActivityToHabit(e.target.checked)}
                                className="w-5 h-5 rounded border border-white/20 bg-white/5 text-primary-green focus:ring-0 focus:ring-offset-0 cursor-pointer accent-primary-green"
                              />
                              <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">Vincular atividade a um hábito?</span>
                            </label>
                          </div>

                          <AnimatePresence>
                            {linkActivityToHabit && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.25 }}
                                className="overflow-hidden"
                              >
                                <div className="p-5 bg-white/5 rounded-2xl border border-white/10 space-y-6 text-left my-2">
                                  <h4 className="text-xs font-bold text-primary-green uppercase tracking-wider">Configuração Prática do Hábito</h4>
                                  
                                  <div className="space-y-1">
                                    <label className={labelClasses}>QUANTAS VEZES POR SEMANA?</label>
                                    <CustomSelect
                                      value={String(newHabitFrequency)}
                                      onChange={(val) => setNewHabitFrequency(Number(val))}
                                      placeholder="Vezes por semana"
                                      options={[
                                        { value: '1', label: '1x' },
                                        { value: '2', label: '2x' },
                                        { value: '3', label: '3x' },
                                        { value: '4', label: '4x' },
                                        { value: '5', label: '5x' },
                                        { value: '6', label: '6x' },
                                        { value: '7', label: '7x por semana' }
                                      ]}
                                    />
                                  </div>
                                  
                                  <div className="space-y-1">
                                    <label className={labelClasses}>DURAÇÃO POR SESSÃO (minutos)</label>
                                    <input
                                      type="tel"
                                      inputMode="numeric"
                                      pattern="[0-9]*"
                                      maxLength={3}
                                      enterKeyHint="done"
                                      placeholder="Ex: 45"
                                      className={`${inputClasses} text-center text-xl font-bold`}
                                      value={newHabitDuration === 0 ? '' : newHabitDuration}
                                      onFocus={(e) => e.target.select()}
                                      onChange={(e) => {
                                        const val = e.target.value.replace(/\D/g, '');
                                        setNewHabitDuration(parseInt(val) || 0);
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          e.preventDefault();
                                          (e.target as HTMLInputElement).blur();
                                        }
                                      }}
                                    />
                                  </div>
                                  
                                  <div className="space-y-1">
                                    <label className={labelClasses}>MELHOR HORÁRIO</label>
                                    <CustomSelect
                                      value={newHabitTime}
                                      onChange={(val) => setNewHabitTime(val)}
                                      placeholder="Melhor horário"
                                      options={[
                                        { value: 'morning', label: '🌅 Manhã' },
                                        { value: 'afternoon', label: '☀️ Tarde' },
                                        { value: 'evening', label: '🌙 Noite' }
                                      ]}
                                    />
                                  </div>

                                  <div className="pt-2 border-t border-white/5">
                                    <label className="flex items-center gap-3 cursor-pointer select-none py-2 text-text-primary">
                                      <input
                                        type="checkbox"
                                        checked={isRecurring}
                                        onChange={(e) => {
                                          setIsRecurring(e.target.checked);
                                          if (e.target.checked && recurrenceDays.length === 0) {
                                            setRecurrenceDays(['1', '3', '5']);
                                          }
                                        }}
                                        className="w-5 h-5 rounded border border-white/20 bg-white/5 text-primary-green focus:ring-0 focus:ring-offset-0 cursor-pointer accent-primary-green"
                                      />
                                      <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                                        Definir dias e horários fixos
                                      </span>
                                    </label>

                                    <AnimatePresence>
                                      {isRecurring && (
                                        <motion.div
                                          initial={{ opacity: 0, height: 0 }}
                                          animate={{ opacity: 1, height: 'auto' }}
                                          exit={{ opacity: 0, height: 0 }}
                                          transition={{ duration: 0.25 }}
                                          className="overflow-hidden"
                                        >
                                          <div className="space-y-5 pt-4 border-t border-white/5 mt-3 text-left">
                                            <div>
                                              <label className={labelClasses}>Dias Fixos da Semana</label>
                                              <div className="grid grid-cols-7 gap-1 pt-1">
                                                {[
                                                  { value: '1', label: 'Seg' },
                                                  { value: '2', label: 'Ter' },
                                                  { value: '3', label: 'Qua' },
                                                  { value: '4', label: 'Qui' },
                                                  { value: '5', label: 'Sex' },
                                                  { value: '6', label: 'Sáb' },
                                                  { value: '7', label: 'Dom' }
                                                ].map((day) => {
                                                  const isSelected = recurrenceDays.includes(day.value);
                                                  return (
                                                    <button
                                                      key={day.value}
                                                      type="button"
                                                      onClick={() => {
                                                        if (isSelected) {
                                                          setRecurrenceDays(recurrenceDays.filter(d => d !== day.value));
                                                        } else {
                                                          setRecurrenceDays([...recurrenceDays, day.value]);
                                                        }
                                                      }}
                                                      className={`h-9 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center border cursor-pointer ${
                                                        isSelected
                                                          ? 'bg-primary-green text-background border-primary-green shadow-[0_0_12px_rgba(110,231,168,0.2)]'
                                                          : 'bg-white/5 text-text-secondary border-white/10 hover:bg-white/10'
                                                      }`}
                                                    >
                                                      {day.label}
                                                    </button>
                                                  );
                                                })}
                                              </div>
                                            </div>

                                            <div className="space-y-1 text-left">
                                              <label className={labelClasses}>Horário Fixo de Execução</label>
                                              <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-1 text-left">
                                                  <span className="text-[9px] font-bold text-text-secondary/40 uppercase tracking-widest block text-center">Horas</span>
                                                  <input
                                                    type="tel"
                                                    inputMode="numeric"
                                                    pattern="[0-9]*"
                                                    maxLength={2}
                                                    enterKeyHint="done"
                                                    placeholder="09"
                                                    className={`${inputClasses} text-center text-lg font-bold`}
                                                    value={recurrenceTimeHours}
                                                    onFocus={(e) => e.target.select()}
                                                    onChange={(e) => handleRecurrenceHoursChange(e.target.value)}
                                                    onBlur={handleRecurrenceHoursBlur}
                                                    onKeyDown={(e) => {
                                                      if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        (e.target as HTMLInputElement).blur();
                                                      }
                                                    }}
                                                  />
                                                </div>
                                                <div className="space-y-1 text-left">
                                                  <span className="text-[9px] font-bold text-text-secondary/40 uppercase tracking-widest block text-center">Minutos</span>
                                                  <input
                                                    type="tel"
                                                    inputMode="numeric"
                                                    pattern="[0-9]*"
                                                    maxLength={2}
                                                    enterKeyHint="done"
                                                    placeholder="00"
                                                    className={`${inputClasses} text-center text-lg font-bold`}
                                                    value={recurrenceTimeMinutes}
                                                    onFocus={(e) => e.target.select()}
                                                    onChange={(e) => handleRecurrenceMinutesChange(e.target.value)}
                                                    onBlur={handleRecurrenceMinutesBlur}
                                                    onKeyDown={(e) => {
                                                      if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        (e.target as HTMLInputElement).blur();
                                                      }
                                                    }}
                                                  />
                                                </div>
                                              </div>
                                            </div>

                                            <div className="space-y-1 text-left mt-5 border-t border-white/5 pt-4">
                                              <label className={labelClasses}>Duração (Opcional)</label>
                                              <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-1 text-left">
                                                  <span className="text-[9px] font-bold text-text-secondary/40 uppercase tracking-widest block text-center">Horas</span>
                                                  <input type="tel" maxLength={2} placeholder="00" value={schedDurHH} onChange={(e) => setSchedDurHH(e.target.value)} className={`${inputClasses} text-center text-lg font-bold`} />
                                                </div>
                                                <div className="space-y-1 text-left">
                                                  <span className="text-[9px] font-bold text-text-secondary/40 uppercase tracking-widest block text-center">Minutos</span>
                                                  <input type="tel" maxLength={2} placeholder="45" value={schedDurMM} onChange={(e) => setSchedDurMM(e.target.value)} className={`${inputClasses} text-center text-lg font-bold`} />
                                                </div>
                                              </div>
                                            </div>

                                            <div className="space-y-1 text-left mt-4 border-t border-white/5 pt-4">
                                              <label className={labelClasses}>Horário Fixo de Encerramento (Opcional)</label>
                                              <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-1 text-left">
                                                  <span className="text-[9px] font-bold text-text-secondary/40 uppercase tracking-widest block text-center">Horas</span>
                                                  <input type="tel" maxLength={2} placeholder="10" value={schedStartHH} onChange={(e) => setSchedStartHH(e.target.value)} className={`${inputClasses} text-center text-lg font-bold`} />
                                                </div>
                                                <div className="space-y-1 text-left">
                                                  <span className="text-[9px] font-bold text-text-secondary/40 uppercase tracking-widest block text-center">Minutos</span>
                                                  <input type="tel" maxLength={2} placeholder="00" value={schedStartMM} onChange={(e) => setSchedStartMM(e.target.value)} className={`${inputClasses} text-center text-lg font-bold`} />
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        </motion.div>
                                      )}
                                    </AnimatePresence>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          <button
                            onClick={handleAddActivity}
                            className="w-full py-4 bg-primary-green hover:bg-primary-green/90 text-background rounded-2xl font-bold uppercase tracking-widest text-[10px] transition-all min-h-[44px] shadow-lg shadow-primary-green/5"
                          >
                            {editingActivityId ? 'Atualizar Atividade' : 'Salvar Atividade'}
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {dataStore.activities.map(item => {
                            const linkedProj = dataStore.projects.find(p => p.id === item.project_id);
                            return (
                              <div key={item.id} className="p-4 bg-surface/30 border border-white/5 rounded-2xl flex justify-between items-center transition-all hover:bg-surface/40">
                                <div className="text-left space-y-2">
                                  <h4 className="text-sm font-medium text-text-primary">
                                    {item.name.split('#habit:')[0].trim()}
                                  </h4>
                                  <div className="inline-flex items-center justify-center px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-medium uppercase tracking-wider text-emerald-500">
                                    {linkedProj ? linkedProj.name : 'Atividade Geral'}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => {
                                      setEditingActivityId(item.id);
                                      setNewActivityName(item.name);
                                      setNewActivityProject(item.project_id || '');
                                      
                                      const hasHabit = !!item.habit_id;
                                      setLinkActivityToHabit(hasHabit);
                                      
                                      if (hasHabit) {
                                        const linkedHabit = dataStore.habits.find(h => h.id === item.habit_id);
                                        if (linkedHabit) {
                                          setNewHabitFrequency(linkedHabit.sessions_per_week || 3);
                                          setNewHabitDuration(linkedHabit.minutes_per_session || 0);
                                          setNewHabitTime(linkedHabit.preferred_time || 'morning');
                                          setIsRecurring(!!linkedHabit.is_recurring);
                                          setRecurrenceDays(linkedHabit.recurrence_days || []);
                                          if (linkedHabit.recurrence_time) {
                                            const [h, m] = linkedHabit.recurrence_time.split(':');
                                            setRecurrenceTimeHours(h ? h.padStart(2, '0') : '09');
                                            setRecurrenceTimeMinutes(m ? m.padStart(2, '0') : '00');

                                          } else {
                                            setRecurrenceTimeHours('09');
                                            setRecurrenceTimeMinutes('00');
                                          }
                                          if (linkedHabit.sched_duration !== undefined && linkedHabit.sched_duration !== null) {
                                            const totalMin = Number(linkedHabit.sched_duration) || 0;
                                            const h = Math.floor(totalMin / 60);
                                            const m = totalMin % 60;
                                            setSchedDurHH(String(h).padStart(2, '0'));
                                            setSchedDurMM(String(m).padStart(2, '0'));
                                          } else {
                                            setSchedDurHH('00');
                                            setSchedDurMM('45');
                                          }
                                          if (linkedHabit.sched_start) {
                                            const [sh, sm] = linkedHabit.sched_start.split(':');
                                            setSchedStartHH(sh || '');
                                            setSchedStartMM(sm || '');
                                          } else {
                                            setSchedStartHH('');
                                            setSchedStartMM('');
                                          }
                                        }
                                      } else {
                                        // Reset to defaults
                                        setNewHabitFrequency(3);
                                        setNewHabitDuration(0);
                                        setNewHabitTime('morning');
                                        setIsRecurring(false);
                                        setRecurrenceDays([]);
                                        setRecurrenceTimeHours('09');
                                        setRecurrenceTimeMinutes('00');

                                        setSchedDurHH('00');
                                        setSchedDurMM('45');
                                        setSchedStartHH('');
                                        setSchedStartMM('');
                                      }
                                      setActivitiesSection('create');
                                    }}
                                    className="p-2 text-text-secondary hover:text-primary-green hover:bg-white/5 rounded-xl transition-all cursor-pointer"
                                    title="Editar Atividade"
                                  >
                                    <Pencil size={15} />
                                  </button>
                                  <button
                                    onClick={() => setDeleteConfirm({ id: item.id, type: 'activity', name: item.name })}
                                    className="p-2 text-red-500/40 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all cursor-pointer"
                                    title="Excluir Atividade"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                          {dataStore.activities.length === 0 && (
                            <p className="text-text-secondary/20 italic text-center py-12 text-xs">Nenhuma atividade registrada.</p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Botões de Rodapé customizados de acordo com as especificações */}
                    <div className="pt-4 border-t border-white/5 mt-6 w-full flex justify-center">
                      {activitiesSection === 'create' ? (
                        <button
                          onClick={() => setCurrentScreen(null)}
                          type="button"
                          className="w-full py-3.5 bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 text-text-secondary hover:text-text-primary rounded-xl font-bold uppercase tracking-widest text-[10px] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
                        >
                          <ArrowLeft size={14} /> Voltar ao Menu
                        </button>
                      ) : (
                        <button
                          onClick={() => setActivitiesSection('create')}
                          type="button"
                          className="w-full py-3.5 bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 text-text-secondary hover:text-text-primary rounded-xl font-bold uppercase tracking-widest text-[10px] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
                        >
                          <ArrowLeft size={14} /> Voltar
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {currentScreen === 'notes' && (
                  <div className="w-full max-w-2xl space-y-10">
                    <h3 className="text-3xl font-bold tracking-tight text-text-primary text-center">Anotações</h3>
                    <div className="bg-surface/10 p-8 rounded-[2.5rem] border border-white/5 space-y-8">
                      <div className="flex justify-between items-center border-b border-white/5 pb-4">
                        <span className="text-[10px] font-bold text-text-secondary/40 uppercase tracking-widest px-1">Nova Anotação</span>
                        <span className="text-[10px] font-bold text-primary-green/60 uppercase tracking-widest">
                          {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-1 text-left">
                          <label className={labelClasses}>Projeto (opcional)</label>
                          <CustomSelect
                            value={noteProject}
                            onChange={val => {setNoteProject(val); setNoteActivityId('');}}
                            placeholder="Sem Projeto"
                            options={[
                              { value: '', label: 'Sem Projeto' },
                              ...dataStore.projects.map(p => ({ value: p.id, label: p.name }))
                            ]}
                          />
                        </div>
                        <div className="space-y-1 text-left">
                          <label className={labelClasses}>Atividade (opcional)</label>
                          <CustomSelect
                            value={noteActivityId}
                            onChange={val => setNoteActivityId(val)}
                            placeholder="Sem Atividade"
                            options={[
                              { value: '', label: 'Sem Atividade' },
                              ...(noteProject ? dataStore.activities.filter(a => a.project_id === noteProject) : dataStore.activities).map(a => ({ value: a.id, label: a.name }))
                            ]}
                          />
                        </div>
                      </div>
                      <div className="space-y-1 text-left">
                        <label className={labelClasses}>O que não pode esquecer?</label>
                        <textarea
                          autoComplete="off" autoCorrect="off" enterKeyHint="send" inputMode="text"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleAddNote();
                            }
                          }}
                          placeholder="Algo importante que não pode esquecer?"
                          className={`${inputClasses} h-40 resize-none`}
                          value={noteText}
                          onChange={e => setNoteText(e.target.value)}
                        />
                      </div>
                      <button onClick={handleAddNote} disabled={!noteText} className="w-full py-5 bg-primary-green text-background rounded-2xl font-bold uppercase tracking-widest text-[10px] shadow-[0_0_40px_rgba(110,231,168,0.2)] transition-all min-h-[44px] disabled:opacity-20 touch-manipulation">Ok</button>
                    </div>

                    <div className="flex justify-center text-center pb-20">
                      <button 
                        onClick={() => {
                          // Close action center and signal to open history in RecentNotes
                          setIsOpen(false);
                          setTimeout(() => {
                            window.dispatchEvent(new CustomEvent('open-notes-history'));
                          }, 300);
                        }}
                        className="text-[10px] font-bold uppercase tracking-[0.3em] text-primary-green border-b border-primary-green/20 pb-1 touch-manipulation"
                      >
                        VER TODAS AS ANOTAÇÕES
                      </button>
                    </div>
                    {renderBottomBackButton()}
                  </div>
                )}

                {currentScreen === 'history' && (
                  <div className="w-full max-w-4xl space-y-12">
                    <div className="flex flex-col items-center gap-10">
                      <h3 className="text-3xl font-bold tracking-tight text-text-primary text-center uppercase tracking-[0.2em]">Histórico de Sessões Profundas</h3>
                      
                      {/* Filters */}
                      <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-6 pb-8 border-b border-white/5">
                        <div className="space-y-2 text-left">
                          <label className={labelClasses}>Filtrar por Projeto</label>
                          <CustomSelect
                            value={filterProject}
                            onChange={val => setFilterProject(val)}
                            placeholder="Todos os Projetos"
                            options={[
                              { value: '', label: 'Todos os Projetos' },
                              ...dataStore.projects.map(p => ({ value: p.id, label: p.name }))
                            ]}
                          />
                        </div>
                        <div className="space-y-2 text-left">
                          <label className={labelClasses}>Filtrar por Data</label>
                          <input 
                            type="date"
                            className={inputClasses}
                            value={filterDate}
                            onChange={e => setFilterDate(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="w-full space-y-4 pb-32">
                        {dataStore.sessions
                          .filter(session => {
                            const matchesProject = filterProject ? session.project_id === filterProject : true;
                            const sessionDateStr = getLocalDateString(new Date(session.started_at));
                            const matchesDate = filterDate ? sessionDateStr === filterDate : true;
                            return matchesProject && matchesDate;
                          })
                          .length === 0 ? (
                            <p className="text-text-secondary/30 italic text-center py-20">Nenhum registro encontrado.</p>
                          ) : (
                            dataStore.sessions
                              .filter(session => {
                                const matchesProject = filterProject ? session.project_id === filterProject : true;
                                const sessionDateStr = getLocalDateString(new Date(session.started_at));
                                const matchesDate = filterDate ? sessionDateStr === filterDate : true;
                                return matchesProject && matchesDate;
                              })
                              .map(session => {
                                const resolved = resolverNomeSessao(session, dataStore.habits, dataStore.projects);
                                const isPartial = session.parcial === true || 
                                                 (session.actual_duration_minutes !== null && 
                                                  session.actual_duration_minutes !== undefined && 
                                                  session.actual_duration_minutes < session.duration_minutes);
                                const durationToUse = session.actual_duration_minutes !== null ? session.actual_duration_minutes : session.duration_minutes;
                                const formattedDuration = formatSessionDuration(durationToUse);
                                const timeRange = formatTimeRange(session.started_at, session.completed_at, session.duration_minutes);

                                return (
                                  <div
                                    key={session.id}
                                    className={`relative flex justify-between items-start py-6 border-b border-white/5 group ${
                                      session.habit_id 
                                        ? 'pl-4 border-l-2 border-l-primary-green' 
                                        : ''
                                    }`}
                                  >
                                    <div className="flex gap-3 items-start flex-1 min-w-0">
                                      <CheckCircle 
                                        size={16} 
                                        className="shrink-0 mt-1" 
                                        style={{ color: isPartial ? '#fbbf24' : '#6ee7b7' }}
                                      />
                                      <div className="space-y-1 flex-1 min-w-0">
                                        {/* Badge de hábito */}
                                        {session.habit_id && (
                                          <span className="text-[9px] font-bold uppercase tracking-widest text-primary-green/60 flex items-center gap-1 mb-1">
                                            ⚡ Hábito Atômico
                                          </span>
                                        )}
                                        
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="text-lg font-light text-text-primary group-hover:text-primary-green transition-colors">
                                            {resolved.titulo}
                                          </span>
                                          <span className="text-text-secondary/30 hidden md:inline">—</span>
                                          <span className="text-[10px] font-bold text-text-secondary/40 md:text-text-secondary/75 uppercase tracking-widest leading-none mt-0.5">
                                            {resolved.projeto}
                                          </span>
                                          {session.scheduled_activity_id && (
                                            <span 
                                              className="inline-flex items-center font-bold"
                                              style={{
                                                backgroundColor: 'rgba(139, 92, 246, 0.12)',
                                                border: '0.5px solid rgba(139, 92, 246, 0.25)',
                                                color: '#8b5cf6',
                                                fontSize: '9px',
                                                letterSpacing: '0.12em',
                                                textTransform: 'uppercase',
                                                padding: '2px 6px',
                                                borderRadius: '999px',
                                                lineHeight: '1'
                                              }}
                                            >
                                              AGENDADA
                                            </span>
                                          )}
                                          {isPartial && (
                                            <span 
                                              className="inline-flex items-center ml-1 font-bold"
                                              style={{
                                                backgroundColor: 'rgba(251, 191, 36, 0.12)',
                                                border: '0.5px solid rgba(251, 191, 36, 0.25)',
                                                color: '#fbbf24',
                                                fontSize: '9px',
                                                letterSpacing: '0.12em',
                                                textTransform: 'uppercase',
                                                padding: '2px 6px',
                                                borderRadius: '999px',
                                                lineHeight: '1'
                                              }}
                                            >
                                              INCOMPLETA
                                            </span>
                                          )}
                                        </div>

                                        {/* Segunda linha: horário início → fim + duração */}
                                        <div className="text-[11px] font-normal leading-normal mt-[2px] flex items-center gap-1.5 text-[#6a7570] md:text-text-secondary/85">
                                          <span>{timeRange}</span>
                                          <span className="text-[#3a4540] md:text-text-secondary/40">·</span>
                                          <span>{formattedDuration}</span>
                                        </div>

                                        {/* Linha tracejada e ícone de pause */}
                                        {isPartial && (
                                          <>
                                            <div 
                                              style={{
                                                width: '100%',
                                                borderTop: '1px dashed rgba(251, 191, 36, 0.3)',
                                                marginTop: '6px',
                                                marginBottom: '4px'
                                              }}
                                            />
                                            <div 
                                              className="font-medium flex items-center"
                                              style={{
                                                color: '#fbbf24',
                                                fontSize: '10px',
                                                opacity: 0.8
                                              }}
                                            >
                                              <Pause size={10} className="shrink-0 mr-1.5" style={{ color: '#fbbf24' }} />
                                              <span>{session.actual_duration_minutes || 0} / {session.duration_minutes} min programados</span>
                                            </div>
                                          </>
                                        )}

                                        {/* Tarefas da sessão */}
                                        {(() => {
                                          const tasks = dataStore.sessionTasks.filter(t => t.session_id === session.id);
                                          return tasks.length > 0 ? (
                                            <div className="mt-2 space-y-1">
                                              {tasks.map(task => (
                                                <div key={task.id} className="flex items-center gap-2 text-[10px] text-text-secondary/50">
                                                  <span>{task.completed ? '✅' : '○'}</span>
                                                  <span className={task.completed ? '' : 'opacity-50'}>{task.description}</span>
                                                </div>
                                              ))}
                                            </div>
                                          ) : null;
                                        })()}

                                        {/* Badge de conclusão antecipada */}
                                        {session.all_tasks_completed && session.actual_duration_minutes && (
                                          <p className="text-[9px] text-primary-green/60 font-bold uppercase tracking-widest mt-1">
                                            ⚡ Concluiu {session.duration_minutes - session.actual_duration_minutes}min antes do prazo
                                          </p>
                                        )}
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-4 text-right shrink-0 ml-4">
                                      <div className="space-y-1">
                                        <p className="text-sm font-semibold text-text-primary">
                                          {formattedDuration}
                                        </p>
                                        <p className="text-[10px] font-bold text-primary-green/60 uppercase tracking-widest">
                                          {(() => {
                                            const d = new Date(session.started_at);
                                            const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
                                            return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
                                          })()}
                                        </p>
                                      </div>
                                      <button
                                        onClick={() => setEditingSession(session)}
                                        className="p-2 text-primary-green/60 hover:text-primary-green hover:bg-[#6ee7a8]/10 rounded-lg transition-all lg:opacity-0 lg:group-hover:opacity-100 opacity-80 hover:opacity-100 duration-150 cursor-pointer"
                                        title="Editar Sessão"
                                      >
                                        <Pencil size={15} />
                                      </button>
                                      <button
                                        onClick={() => setDeleteConfirm({ id: session.id, type: 'session', name: session.activity_name })}
                                        className="p-2 text-red-500/50 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all lg:opacity-0 lg:group-hover:opacity-100 opacity-80 hover:opacity-100 duration-150 cursor-pointer"
                                        title="Excluir Sessão"
                                      >
                                        <Trash2 size={15} />
                                      </button>
                                    </div>
                                  </div>
                                )})
                          )
                        }
                      </div>
                    </div>
                    {renderBottomBackButton()}
                  </div>
                )}

                {currentScreen === 'anti-vicio' && (
                  <div className="w-full max-w-2xl space-y-10 flex flex-col items-stretch">
                    <button
                      onClick={() => {
                        setIsOpen(false);
                        setCurrentScreen(null);
                      }}
                      className="flex items-center gap-2 text-text-secondary hover:text-primary-green transition-all font-bold uppercase tracking-widest text-[10px] self-start"
                    >
                      ← Voltar
                    </button>

                    <div className="space-y-4 text-left">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-3xl font-bold tracking-tight text-text-primary">
                            {editingAvoidanceId ? 'Editar Módulo' : 'Novo Autocontrole'}
                          </h3>
                          <p className="text-xs text-text-secondary/60 mt-1">
                            {editingAvoidanceId ? 'Ajuste os parâmetros de monitoramento mental.' : 'Defina o comportamento e restabeleça seu controle.'}
                          </p>
                        </div>
                        {editingAvoidanceId && (
                          <button
                            onClick={() => {
                              setEditingAvoidanceId(null);
                              setAvoidanceName('');
                              setAvoidanceScope('full_day');
                              setAvoidanceDays([]);
                              setAvoidanceIntensity('balanced');
                            }}
                            className="text-xs text-red-400 hover:text-red-300 font-bold uppercase tracking-widest px-3 py-1 bg-red-400/10 rounded-full"
                          >
                            Cancelar Edição
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-6 text-left">
                      {/* Name input */}
                      <div className="flex flex-col">
                        <label className={labelClasses}>O que você quer controlar?</label>
                        <input
                          type="text"
                          value={avoidanceName}
                          onChange={(e) => setAvoidanceName(e.target.value)}
                          placeholder="Ex: Instagram, Café, Cigarro, Apostas, Compras..."
                          className={inputClasses}
                        />
                      </div>

                      {/* Control Scope / Type */}
                      <div className="flex flex-col">
                        <label className={labelClasses}>Escopo do Autocontrole</label>
                        <div className="grid grid-cols-2 gap-4">
                          <button
                            onClick={() => setAvoidanceScope('full_day')}
                            className={`py-4 px-6 rounded-2xl font-bold text-xs uppercase tracking-widest border transition-all ${
                              avoidanceScope === 'full_day'
                                ? 'bg-primary-green/10 border-primary-green text-primary-green shadow-[0_0_15px_rgba(110,231,168,0.15)]'
                                : 'bg-white/5 border-white/10 text-text-secondary/80 hover:border-white/20'
                            }`}
                          >
                            🛡️ O dia todo
                          </button>
                          <button
                            onClick={() => setAvoidanceScope('time_window')}
                            className={`py-4 px-6 rounded-2xl font-bold text-xs uppercase tracking-widest border transition-all ${
                              avoidanceScope === 'time_window'
                                ? 'bg-primary-green/10 border-primary-green text-primary-green shadow-[0_0_15px_rgba(110,231,168,0.15)]'
                                : 'bg-white/5 border-white/10 text-text-secondary/80 hover:border-white/20'
                            }`}
                          >
                            ⏱️ Janela de Horário
                          </button>
                        </div>
                      </div>

                      {/* Time window inputs */}
                      <AnimatePresence>
                        {avoidanceScope === 'time_window' && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="grid grid-cols-2 gap-4 overflow-hidden"
                          >
                            <div className="space-y-1 text-left">
                              <label className={labelClasses}>Início da Janela</label>
                              <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1 text-left">
                                  <span className="text-[9px] font-bold text-text-secondary/40 uppercase tracking-widest block text-center">Horas</span>
                                  <input
                                    type="tel"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    maxLength={2}
                                    enterKeyHint="done"
                                    placeholder="14"
                                    className={`${inputClasses} text-center text-xl font-bold`}
                                    value={avoidanceStartHours}
                                    onFocus={(e) => e.target.select()}
                                    onChange={(e) => handleAvoidanceStartHoursChange(e.target.value)}
                                    onBlur={handleAvoidanceStartHoursBlur}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        (e.target as HTMLInputElement).blur();
                                      }
                                    }}
                                  />
                                </div>
                                <div className="space-y-1 text-left">
                                  <span className="text-[9px] font-bold text-text-secondary/40 uppercase tracking-widest block text-center">Minutos</span>
                                  <input
                                    type="tel"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    maxLength={2}
                                    enterKeyHint="done"
                                    placeholder="00"
                                    className={`${inputClasses} text-center text-xl font-bold`}
                                    value={avoidanceStartMinutes}
                                    onFocus={(e) => e.target.select()}
                                    onChange={(e) => handleAvoidanceStartMinutesChange(e.target.value)}
                                    onBlur={handleAvoidanceStartMinutesBlur}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        (e.target as HTMLInputElement).blur();
                                      }
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                            <div className="space-y-1 text-left">
                              <label className={labelClasses}>Fim da Janela</label>
                              <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1 text-left">
                                  <span className="text-[9px] font-bold text-text-secondary/40 uppercase tracking-widest block text-center">Horas</span>
                                  <input
                                    type="tel"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    maxLength={2}
                                    enterKeyHint="done"
                                    placeholder="18"
                                    className={`${inputClasses} text-center text-xl font-bold`}
                                    value={avoidanceEndHours}
                                    onFocus={(e) => e.target.select()}
                                    onChange={(e) => handleAvoidanceEndHoursChange(e.target.value)}
                                    onBlur={handleAvoidanceEndHoursBlur}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        (e.target as HTMLInputElement).blur();
                                      }
                                    }}
                                  />
                                </div>
                                <div className="space-y-1 text-left">
                                  <span className="text-[9px] font-bold text-text-secondary/40 uppercase tracking-widest block text-center">Minutos</span>
                                  <input
                                    type="tel"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    maxLength={2}
                                    enterKeyHint="done"
                                    placeholder="00"
                                    className={`${inputClasses} text-center text-xl font-bold`}
                                    value={avoidanceEndMinutes}
                                    onFocus={(e) => e.target.select()}
                                    onChange={(e) => handleAvoidanceEndMinutesChange(e.target.value)}
                                    onBlur={handleAvoidanceEndMinutesBlur}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        (e.target as HTMLInputElement).blur();
                                      }
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Recurrence days */}
                      <div className="flex flex-col">
                        <label className={labelClasses}>Dias de Monitoramento</label>
                        <div className="flex flex-wrap gap-2">
                          {['1', '2', '3', '4', '5', '6', '7'].map((day) => {
                            const name = { '1': 'Seg', '2': 'Ter', '3': 'Qua', '4': 'Qui', '5': 'Sex', '6': 'Sáb', '7': 'Dom' }[day];
                            const active = avoidanceDays.includes(day);
                            return (
                              <button
                                key={day}
                                onClick={() => {
                                  if (active) {
                                    setAvoidanceDays(avoidanceDays.filter(d => d !== day));
                                  } else {
                                    setAvoidanceDays([...avoidanceDays, day]);
                                  }
                                }}
                                className={`w-10 h-10 rounded-xl font-bold text-[10px] uppercase border transition-all ${
                                  active
                                    ? 'bg-primary-green text-background border-primary-green font-extrabold shadow-[0_0_10px_rgba(110,231,168,0.3)]'
                                    : 'bg-white/5 border-white/10 text-text-secondary/60 hover:border-white/20'
                                }`}
                              >
                                {name}
                              </button>
                            );
                          })}
                        </div>
                        <p className="text-[10px] text-text-secondary/40 mt-2">
                          * Deixe em branco para monitoramento diário irrestrito.
                        </p>
                      </div>

                      {/* Action buttons */}
                      <button
                        onClick={handleAddAvoidance}
                        className="w-full py-5 bg-primary-green hover:brightness-110 text-background rounded-2xl font-bold uppercase tracking-widest text-[10px] transition-all shadow-[0_0_30px_rgba(110,231,168,0.2)] cursor-pointer mt-4"
                      >
                        Ok
                      </button>

                      <button
                        onClick={() => {
                          setIsOpen(false);
                          window.dispatchEvent(new CustomEvent('open-avoidance-history'));
                          const el = document.getElementById('avoidance-section');
                          if (el) {
                            el.scrollIntoView({ behavior: 'smooth' });
                          }
                        }}
                        className="w-full text-center text-[10px] font-bold text-primary-green hover:text-primary-green/80 uppercase tracking-[0.2em] transition-all cursor-pointer underline underline-offset-4 mt-6 block"
                      >
                        VER TODOS OS REGISTROS
                      </button>
                    </div>
                    {renderBottomBackButton()}
                  </div>
                )}

                {currentScreen === 'habits' && (
                  <div className="w-full max-w-2xl space-y-10 flex flex-col items-stretch">
                    <button
                      onClick={() => {
                        setIsOpen(false);
                        setCurrentScreen(null);
                      }}
                      className="flex items-center gap-2 text-text-secondary hover:text-primary-green transition-all font-bold uppercase tracking-widest text-[10px] self-start"
                    >
                      ← Voltar
                    </button>

                    {/* SEÇÃO 1 — Criar novo hábito */}
                    <div className="space-y-4 text-left">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-3xl font-bold tracking-tight text-text-primary">
                            {editingHabitId ? 'Editar Hábito' : 'Novo Hábito'}
                          </h3>
                          <p className="text-xs text-text-secondary/60 mt-1">
                            {editingHabitId ? 'Ajuste os detalhes do seu hábito e recorrência.' : 'Configure sua prática e construa consistência.'}
                          </p>
                        </div>
                        {editingHabitId && (
                          <button
                            onClick={() => {
                              setEditingHabitId(null);
                              setNewHabitName('');
                              setNewHabitFrequency(3);
                              setNewHabitDuration(0);
                              setNewHabitTime('morning');
                              setIsRecurring(false);
                              setRecurrenceDays([]);
                              setRecurrenceTimeHours('09');
                              setRecurrenceTimeMinutes('00');
                            }}
                            className="text-[10px] font-bold uppercase tracking-widest text-red-500 bg-red-500/10 hover:bg-red-500/20 px-3 py-1.5 rounded-full transition-all cursor-pointer"
                          >
                            Cancelar
                          </button>
                        )}
                      </div>
                      
                      <div className="bg-surface/10 p-8 rounded-[2.5rem] border border-white/5 space-y-6">
                        <div className="space-y-1">
                          <label className={labelClasses}>NOME DO HÁBITO</label>
                          <input
                            type="text"
                            autoComplete="off"
                            autoCorrect="off"
                            enterKeyHint="done"
                            inputMode="text"
                            placeholder="Ex: Leitura, Exercício, Meditação..."
                            className={inputClasses}
                            value={newHabitName}
                            onChange={e => setNewHabitName(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                (e.target as HTMLInputElement).blur();
                              }
                            }}
                            onBlur={() => {
                              // Não salva ao sair do campo — apenas fecha o teclado
                            }}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className={labelClasses}>QUANTAS VEZES POR SEMANA?</label>
                          <CustomSelect
                            value={String(newHabitFrequency)}
                            onChange={(val) => setNewHabitFrequency(Number(val))}
                            placeholder="Vezes por semana"
                            options={[
                              { value: '1', label: '1x' },
                              { value: '2', label: '2x' },
                              { value: '3', label: '3x' },
                              { value: '4', label: '4x' },
                              { value: '5', label: '5x' },
                              { value: '6', label: '6x' },
                              { value: '7', label: '7x por semana' }
                            ]}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className={labelClasses}>DURAÇÃO POR SESSÃO (minutos)</label>
                          <input
                            type="tel"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={3}
                            enterKeyHint="done"
                            placeholder="Ex: 45"
                            className={`${inputClasses} text-center text-2xl font-bold`}
                            value={newHabitDuration === 0 ? '' : newHabitDuration}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, '');
                              setNewHabitDuration(parseInt(val) || 0);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                (e.target as HTMLInputElement).blur();
                              }
                            }}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className={labelClasses}>MELHOR HORÁRIO</label>
                          <CustomSelect
                            value={newHabitTime}
                            onChange={(val) => setNewHabitTime(val)}
                            placeholder="Melhor horário"
                            options={[
                              { value: 'morning', label: '🌅 Manhã' },
                              { value: 'afternoon', label: '☀️ Tarde' },
                              { value: 'evening', label: '🌙 Noite' }
                            ]}
                          />
                        </div>

                        {/* NOVO BLOCO OPCIONAL PREMIUM PARA RECORRÊNCIA */}
                        <div className="pt-2">
                          <label className="flex items-center gap-3 cursor-pointer select-none py-2 text-text-primary">
                            <input
                              type="checkbox"
                              checked={isRecurring}
                              onChange={(e) => {
                                setIsRecurring(e.target.checked);
                                if (e.target.checked && recurrenceDays.length === 0) {
                                  // Auto preselect 3 days for comfortable UX
                                  setRecurrenceDays(['1', '3', '5']);
                                }
                              }}
                              className="w-5 h-5 rounded border border-white/20 bg-white/5 text-primary-green focus:ring-0 focus:ring-offset-0 cursor-pointer accent-primary-green"
                            />
                            <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                              Definir dias e horários fixos
                            </span>
                          </label>

                          <AnimatePresence>
                            {isRecurring && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.25 }}
                                className="overflow-hidden"
                              >
                                <div className="space-y-5 pt-4 border-t border-white/5 mt-3 text-left">
                                  {/* Days select */}
                                  <div>
                                    <label className={labelClasses}>Dias Fixos da Semana</label>
                                    <div className="grid grid-cols-7 gap-1.5 pt-1">
                                      {[
                                        { value: '1', label: 'Seg' },
                                        { value: '2', label: 'Ter' },
                                        { value: '3', label: 'Qua' },
                                        { value: '4', label: 'Qui' },
                                        { value: '5', label: 'Sex' },
                                        { value: '6', label: 'Sáb' },
                                        { value: '7', label: 'Dom' }
                                      ].map((day) => {
                                        const isSelected = recurrenceDays.includes(day.value);
                                        return (
                                          <button
                                            key={day.value}
                                            type="button"
                                            onClick={() => {
                                              if (isSelected) {
                                                setRecurrenceDays(recurrenceDays.filter(d => d !== day.value));
                                              } else {
                                                setRecurrenceDays([...recurrenceDays, day.value]);
                                              }
                                            }}
                                            className={`h-11 rounded-xl text-xs font-bold transition-all transition-colors flex items-center justify-center border cursor-pointer ${
                                              isSelected
                                                ? 'bg-primary-green text-background border-primary-green shadow-[0_0_12px_rgba(110,231,168,0.2)]'
                                                : 'bg-white/5 text-text-secondary border-white/10 hover:bg-white/10'
                                            }`}
                                          >
                                            {day.label}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>

                                  {/* Horário Fixo de Execução (HH | MM CONTAINER) */}
                                  <div className="space-y-1 text-left">
                                    <label className={labelClasses}>Horário Fixo de Execução</label>
                                    <div className="grid grid-cols-2 gap-4">
                                      {/* HORAS */}
                                      <div className="space-y-1 text-left">
                                        <span className="text-[9px] font-bold text-text-secondary/40 uppercase tracking-widest block text-center">Horas</span>
                                        <input
                                          type="tel"
                                          inputMode="numeric"
                                          pattern="[0-9]*"
                                          maxLength={2}
                                          enterKeyHint="done"
                                          placeholder="09"
                                          className={`${inputClasses} text-center text-xl font-bold`}
                                          value={recurrenceTimeHours}
                                          onFocus={(e) => e.target.select()}
                                          onChange={(e) => handleRecurrenceHoursChange(e.target.value)}
                                          onBlur={handleRecurrenceHoursBlur}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                              e.preventDefault();
                                              (e.target as HTMLInputElement).blur();
                                            }
                                          }}
                                        />
                                      </div>
                                      {/* MINUTOS */}
                                      <div className="space-y-1 text-left">
                                        <span className="text-[9px] font-bold text-text-secondary/40 uppercase tracking-widest block text-center">Minutos</span>
                                        <input
                                          type="tel"
                                          inputMode="numeric"
                                          pattern="[0-9]*"
                                          maxLength={2}
                                          enterKeyHint="done"
                                          placeholder="00"
                                          className={`${inputClasses} text-center text-xl font-bold`}
                                          value={recurrenceTimeMinutes}
                                          onFocus={(e) => e.target.select()}
                                          onChange={(e) => handleRecurrenceMinutesChange(e.target.value)}
                                          onBlur={handleRecurrenceMinutesBlur}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                              e.preventDefault();
                                              (e.target as HTMLInputElement).blur();
                                            }
                                          }}
                                        />
                                      </div>
                                    </div>
                                    {/* DURAÇÃO (OPCIONAL) */}
                                    <div className="space-y-1 text-left mt-5 border-t border-white/5 pt-4">
                                      <label className={labelClasses}>Duração (Opcional)</label>
                                      <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1 text-left">
                                          <span className="text-[9px] font-bold text-text-secondary/40 uppercase tracking-widest block text-center">Horas</span>
                                          <input type="tel" maxLength={2} placeholder="00" value={schedDurHH} onChange={(e) => setSchedDurHH(e.target.value)} className={`${inputClasses} text-center text-xl font-bold`} />
                                        </div>
                                        <div className="space-y-1 text-left">
                                          <span className="text-[9px] font-bold text-text-secondary/40 uppercase tracking-widest block text-center">Minutos</span>
                                          <input type="tel" maxLength={2} placeholder="45" value={schedDurMM} onChange={(e) => setSchedDurMM(e.target.value)} className={`${inputClasses} text-center text-xl font-bold`} />
                                        </div>
                                      </div>
                                    </div>

                                    {/* HORÁRIO DE ENCERRAMENTO (OPCIONAL) */}
                                    <div className="space-y-1 text-left mt-4 border-t border-white/5 pt-4">
                                      <label className={labelClasses}>Horário Fixo de Encerramento (Opcional)</label>
                                      <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1 text-left">
                                          <span className="text-[9px] font-bold text-text-secondary/40 uppercase tracking-widest block text-center">Horas</span>
                                          <input type="tel" maxLength={2} placeholder="10" value={schedStartHH} onChange={(e) => setSchedStartHH(e.target.value)} className={`${inputClasses} text-center text-xl font-bold`} />
                                        </div>
                                        <div className="space-y-1 text-left">
                                          <span className="text-[9px] font-bold text-text-secondary/40 uppercase tracking-widest block text-center">Minutos</span>
                                          <input type="tel" maxLength={2} placeholder="00" value={schedStartMM} onChange={(e) => setSchedStartMM(e.target.value)} className={`${inputClasses} text-center text-xl font-bold`} />
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        <button onClick={handleAddHabit} className="w-full py-5 bg-primary-green hover:brightness-110 text-background rounded-2xl font-bold uppercase tracking-widest text-[10px] transition-all shadow-[0_0_30px_rgba(110,231,168,0.2)] cursor-pointer">
                          Ok
                        </button>
                      </div>
                    </div>

                    {/* Divisor */}
                    <div className="border-t border-white/10 pt-4" />

                    <div className="flex justify-center">
                      <button
                        onClick={() => setShowHabitsModal(true)}
                        className="text-[10px] font-bold uppercase tracking-widest text-primary-green border-b border-primary-green/30 pb-1 hover:border-primary-green transition-all"
                      >
                        Ver Todos os Hábitos
                      </button>
                    </div>

                    {renderBottomBackButton()}
                  </div>
                )}

                {currentScreen === 'agenda' && (
                  <div className="w-full max-w-2xl flex flex-col items-stretch">
                    <CriarAgendamentoScreen
                      onBack={() => {
                        setIsOpen(false);
                        setCurrentScreen(null);
                        setEditingActivity(undefined);
                      }}
                      onClose={() => {
                        setIsOpen(false);
                        setEditingActivity(undefined);
                      }}
                      editingActivity={editingActivity}
                    />
                    {renderBottomBackButton()}
                  </div>
                )}

                {currentScreen === 'saved-links' && (
                  <div className="w-full max-w-2xl flex flex-col items-stretch">
                    <SavedLinksConfigScreen
                      onBack={() => {
                        setIsOpen(false);
                        setCurrentScreen(null);
                      }}
                      onNavigateToViewAll={() => {
                        setIsOpen(false);
                        setCurrentScreen(null);
                        useDataStore.getState().setLinksHistoryOpen(true);
                      }}
                    />
                    {renderBottomBackButton()}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* List Modals */}
      <AnimatePresence>
        {isOpen && currentScreen === 'links-list' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-x-0 top-0 bottom-20 z-[210] bg-background/98 backdrop-blur-3xl flex flex-col items-center px-6 py-12 overflow-y-auto"
          >
            <div className="w-full max-w-2xl space-y-10 pb-20">
              <LinksListScreen
                onBack={() => {
                  setIsOpen(false);
                  setCurrentScreen(null);
                }}
                onBackToMenu={() => {
                  setIsOpen(false);
                  setCurrentScreen(null);
                }}
              />
            </div>
          </motion.div>
        )}

        {showHabitsModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-x-0 top-0 bottom-20 z-[210] bg-background/98 backdrop-blur-3xl flex flex-col items-center px-6 py-12 overflow-y-auto"
          >
            <div className="w-full max-w-2xl space-y-10">
              <header className="flex justify-between items-center border-b border-white/5 pb-8">
                <button
                  onClick={() => setShowHabitsModal(false)}
                  className="flex items-center gap-2 text-text-secondary hover:text-primary-green transition-colors font-bold uppercase tracking-widest text-[10px]"
                >
                  ← Voltar
                </button>
                <h3 className="text-2xl font-bold text-text-primary tracking-tight">
                  Todos os Hábitos
                </h3>
                <button
                  onClick={() => setShowHabitsModal(false)}
                  className="w-10 h-10 rounded-full border border-border-white flex items-center justify-center text-text-secondary hover:text-white transition-all"
                >
                  <X size={18} />
                </button>
              </header>

              <div className="space-y-4 pb-20">
                {dataStore.habits.filter(h => h.habit_mode !== 'avoid').length === 0 ? (
                  <p className="text-text-secondary/40 italic text-center py-20">
                    Nenhum hábito cadastrado ainda.
                  </p>
                ) : (
                  dataStore.habits.filter(h => h.habit_mode !== 'avoid').map(h => {
                    const total = h.sessions_per_week || 3;
                    const current = h.sessions_this_week || 0;
                    const preferredTimeLabel = {
                      morning: '🌅 Manhã',
                      afternoon: '☀️ Tarde',
                      evening: '🌙 Noite'
                    }[h.preferred_time] || h.preferred_time;

                    return (
                      <div key={h.id} className="p-6 bg-surface/10 border border-white/10 rounded-3xl space-y-4">
                        <div className="flex justify-between items-start">
                          <div className="space-y-1">
                            <h4 className="text-lg font-bold text-text-primary">{h.name}</h4>
                            <div className="text-xs text-text-secondary/60 flex flex-wrap items-center gap-x-1.5">
                              <span>
                                {preferredTimeLabel} · {h.minutes_per_session}min por sessão
                              </span>
                              {h.is_recurring && (
                                <span className="flex items-center gap-1 text-[10px] font-bold text-primary-green uppercase tracking-widest bg-primary-green/10 px-2 py-0.5 rounded-full mt-0.5">
                                  <Calendar size={10} />
                                  Fixo: {h.recurrence_days?.map((d: string) => ({ '1': 'Seg', '2': 'Ter', '3': 'Qua', '4': 'Qui', '5': 'Sex', '6': 'Sáb', '7': 'Dom' }[d] || d)).join(', ')} às {h.recurrence_time || '09:00'}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="text-sm font-bold text-primary-green">
                            🔥 {h.weekly_streak} {h.weekly_streak === 1 ? 'semana' : 'semanas'} invicta{h.weekly_streak !== 1 ? 's' : ''}
                          </span>
                        </div>

                        {/* Bolinhas de progresso */}
                        <div className="flex items-center gap-2">
                          {Array.from({ length: total }, (_, i) => (
                            <div
                              key={i}
                              className={`w-3 h-3 rounded-full transition-all ${
                                i < current
                                  ? 'bg-primary-green shadow-[0_0_8px_rgba(110,231,168,0.5)]'
                                  : 'bg-white/10'
                              }`}
                            />
                          ))}
                          <span className="text-[10px] font-bold text-text-secondary/40 uppercase tracking-widest ml-2">
                            {current}/{total} esta semana
                          </span>
                          {current > total && (
                            <span className="ml-2 px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-[9px] font-extrabold uppercase tracking-widest font-sans">
                              Meta Superada: +{current - total} Extras
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-white/5">
                          <p className="text-[10px] text-text-secondary/40 uppercase tracking-widest font-bold">
                            Criado em {new Date(h.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </p>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => {
                                setRegisteringHabit(h.id);
                                setManualSessionDuration(h.minutes_per_session);
                                setShowHabitsModal(false);
                              }}
                              className="text-[10px] font-bold uppercase tracking-widest text-primary-green/60 hover:text-primary-green border border-primary-green/20 hover:border-primary-green/40 px-3 py-1 rounded-full transition-all cursor-pointer"
                            >
                              + Registrar sessão
                            </button>
                            <button
                              onClick={() => {
                                handleEditHabitClick(h);
                                setShowHabitsModal(false);
                              }}
                              className="p-2 text-primary-green/40 hover:text-primary-green hover:bg-primary-green/10 rounded-full transition-all cursor-pointer"
                              title="Editar hábito"
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              onClick={() => {
                                setDeleteConfirm({ id: h.id, type: 'habit', name: h.name });
                                setShowHabitsModal(false);
                              }}
                              className="p-2 text-red-500/40 hover:text-red-500 hover:bg-red-500/10 rounded-full transition-all cursor-pointer"
                              title="Excluir hábito"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
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

      {/* List Modals */}
      <AnimatePresence>
        {showListModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-x-0 top-0 bottom-20 z-[210] bg-background/98 backdrop-blur-3xl flex flex-col items-center px-6 py-20 overflow-y-auto">
            <div className="w-full max-w-2xl space-y-12">
               <header className="flex justify-between items-center bg-white/5 -mx-6 -mt-20 p-10 border-b border-white/5 mb-8">
                 <h3 className="text-2xl font-bold text-text-primary tracking-tight">Listagem de {showListModal === 'projects' ? 'Projetos' : 'Atividades'}</h3>
                 <button onClick={() => setShowListModal(null)} className="w-12 h-12 rounded-full border border-border-white flex items-center justify-center text-text-secondary hover:text-white"><X size={20} /></button>
               </header>
               <div className="space-y-4">
                 {(showListModal === 'projects' ? dataStore.projects : dataStore.activities).map(item => (
                   <div key={item.id} className="p-6 bg-surface/40 border border-white/10 rounded-2xl flex justify-between items-center">
                     <div>
                       <h4 className="text-lg font-medium text-text-primary">{item.name}</h4>
                       <p className="text-[10px] text-text-secondary/40 font-bold uppercase tracking-widest">{new Date(item.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                     </div>
                     <button 
                      onClick={() => setDeleteConfirm({ id: item.id, type: showListModal === 'projects' ? 'project' : 'activity', name: item.name })}
                      className="p-3 text-red-500/40 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                     >
                       <Trash2 size={18} />
                     </button>
                   </div>
                 ))}
                 {(showListModal === 'projects' ? dataStore.projects : dataStore.activities).length === 0 && (
                   <p className="text-text-secondary/20 italic text-center py-20">Nenhum registro encontrado.</p>
                 )}
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation */}
      <AnimatePresence>
        {deleteConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[600] bg-background/80 backdrop-blur-sm flex items-center justify-center p-6">
            <div className="w-full max-w-sm bg-surface border border-border-white/20 p-10 rounded-[2.5rem] text-center space-y-6">
              <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto"><AlertTriangle size={32} /></div>
              <div className="space-y-2">
                <h4 className="text-xl font-bold text-text-primary">
                  {deleteConfirm.type === 'habit' ? `Deseja excluir o hábito ${deleteConfirm.name}?` : `Deseja excluir ${deleteConfirm.name}?`}
                </h4>
                <p className="text-text-secondary text-sm font-light">
                  {deleteConfirm.type === 'habit' ? 'Todo o histórico será perdido.' : 'Esta ação não pode ser desfeita.'}
                </p>
                {(() => {
                  if (deleteConfirm.type === 'project') {
                    const tasksCount = dataStore.dailyTasks.filter(t => t.project_id === deleteConfirm.id).length;
                    const schedulesCount = dataStore.scheduledActivities.filter(sa => sa.project_id === deleteConfirm.id).length;
                    const activitiesCount = dataStore.activities.filter(a => a.project_id === deleteConfirm.id).length;
                    const total = tasksCount + schedulesCount + activitiesCount;
                    if (total > 0) {
                      return (
                        <div className="text-amber-500 text-xs font-medium bg-amber-500/10 p-3 rounded-xl border border-amber-500/20 text-left mt-3 space-y-1">
                          <p className="font-bold">⚠️ Recursos Vinculados:</p>
                          <ul className="list-disc pl-4 space-y-0.5">
                            {activitiesCount > 0 && <li>{activitiesCount} atividade(s) catalogada(s)</li>}
                            {tasksCount > 0 && <li>{tasksCount} tarefa(s) diária(s)</li>}
                            {schedulesCount > 0 && <li>{schedulesCount} atividade(s) agendada(s)</li>}
                          </ul>
                          <p className="text-[10px] opacity-80 pt-1 border-t border-amber-500/10 mt-1">Ao excluir, todos serão desvinculados com segurança.</p>
                        </div>
                      );
                    }
                  } else if (deleteConfirm.type === 'activity') {
                    const tasksCount = dataStore.dailyTasks.filter(t => t.activity_id === deleteConfirm.id).length;
                    const schedulesCount = dataStore.scheduledActivities.filter(sa => sa.activity_id === deleteConfirm.id).length;
                    const total = tasksCount + schedulesCount;
                    if (total > 0) {
                      return (
                        <div className="text-amber-500 text-xs font-medium bg-amber-500/10 p-3 rounded-xl border border-amber-500/20 text-left mt-3 space-y-1">
                          <p className="font-bold">⚠️ Recursos Vinculados:</p>
                          <ul className="list-disc pl-4 space-y-0.5">
                            {tasksCount > 0 && <li>{tasksCount} tarefa(s) diária(s)</li>}
                            {schedulesCount > 0 && <li>{schedulesCount} atividade(s) agendada(s)</li>}
                          </ul>
                          <p className="text-[10px] opacity-80 pt-1 border-t border-amber-500/10 mt-1">Ao excluir, todos serão desvinculados com segurança.</p>
                        </div>
                      );
                    }
                  }
                  return null;
                })()}
              </div>
              <div className="flex flex-col gap-3">
                <button onClick={handleDelete} className="w-full py-4 bg-red-500 text-white rounded-2xl font-bold uppercase tracking-widest text-[10px]">Sim, excluir</button>
                <button onClick={() => setDeleteConfirm(null)} className="w-full py-4 bg-white/5 text-text-secondary rounded-2xl font-bold uppercase tracking-widest text-[10px]">Cancelar</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cancel Session Confirmation */}
      <AnimatePresence>
        {showCancelConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[700] bg-background/90 backdrop-blur-md flex items-center justify-center p-6">
            <div className="w-full max-w-md bg-surface border border-white/10 p-12 rounded-[2.5rem] text-center space-y-8">
              <div className="w-20 h-20 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto"><AlertTriangle size={40} /></div>
              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-text-primary">Cancelar sessão?</h3>
                <p className="text-text-secondary font-light">Seu progresso atual será descartado.</p>
              </div>
              <div className="flex flex-col gap-4">
                <button onClick={async () => { 
                  sendToServiceWorker('CANCEL_TIMER'); 
                  if (timer.scheduledActivityId) {
                    await dataStore.updateScheduledActivity(timer.scheduledActivityId, {
                      status: 'cancelada',
                      resolved_at: new Date().toISOString()
                    });
                  }
                  timer.reset(); 
                  setShowCancelConfirm(false); 
                  setIsOpen(false); 
                }} className="w-full py-5 text-red-500 font-bold uppercase tracking-widest text-[10px]">Sim, cancelar</button>
                <button onClick={() => setShowCancelConfirm(false)} className="w-full py-5 bg-primary-green text-background rounded-2xl font-bold uppercase tracking-widest text-[10px]">Continuar Sessão</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Manual Habit Session Registration */}
      <AnimatePresence>
        {registeringHabit && (() => {
          const habit = dataStore.habits.find(h => h.id === registeringHabit);
          if (!habit) return null;
          return (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[600] bg-background/80 backdrop-blur-sm flex items-center justify-center p-6">
              <div className="w-full max-w-sm bg-surface border border-border-white/20 p-10 rounded-[2.5rem] text-center space-y-6">
                <div className="w-16 h-16 bg-primary-green/10 text-primary-green rounded-full flex items-center justify-center mx-auto">
                  <Clock size={32} />
                </div>
                <div className="space-y-4">
                  <h4 className="text-xl font-bold text-text-primary text-center">Registrar sessão — {habit.name}</h4>
                </div>
                <div className="space-y-2 text-left">
                  <label className={labelClasses}>DURAÇÃO</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder="Minutos"
                    className="w-full bg-white/5 border border-white/20 rounded-2xl p-4 text-text-primary outline-none focus:border-primary-green text-center text-xl font-bold"
                    value={manualSessionDuration || ''}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const num = parseInt(e.target.value) || 0;
                      setManualSessionDuration(num);
                    }}
                  />
                </div>
                <div className="flex flex-col gap-3">
                  <button 
                    onClick={async () => {
                      if (user && manualSessionDuration > 0) {
                        await dataStore.completeHabitSession(habit.id, user.id, manualSessionDuration);
                        setRegisteringHabit(null);
                        showSuccess('✅ Sessão registrada com sucesso!');
                      }
                    }} 
                    className="w-full py-4 bg-primary-green text-background rounded-2xl font-bold uppercase tracking-widest text-[10px] shadow-[0_0_20px_rgba(110,231,168,0.2)] hover:scale-[1.02] active:scale-95 transition-all"
                  >
                    CONFIRMAR
                  </button>
                  <button 
                    onClick={() => setRegisteringHabit(null)} 
                    className="w-full py-4 bg-white/5 text-text-secondary rounded-2xl font-bold uppercase tracking-widest text-[10px] hover:bg-white/10 transition-all"
                  >
                    CANCELAR
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      <AnimatePresence>
        {editingSession && (
          <EditSessionModal
            session={editingSession}
            onClose={() => setEditingSession(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
};

