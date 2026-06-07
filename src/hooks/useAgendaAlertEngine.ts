import { useMemo, useState } from 'react';
import { useDataStore } from '../store/useDataStore';
import { useTimerStore } from '../store/useTimerStore';
import { getLocalDateString } from '../lib/utils';

export interface AlertSchedule {
  activity: {
    id: string;
    title: string;
    scheduled_time: string;
    scheduled_date: string;
    duration_minutes: number;
    project_id: string | null;
    activity_id: string | null;
    atividade_avulsa: string | null;
    habit_id: string | null;
    notes: string | null;
    tasks: any[];
    status: string;
  };
  isOverdue: boolean;
  isImminent: boolean;
  scheduled_time: string;
}

export const useAgendaAlertEngine = () => {
  const dataStore = useDataStore();
  const timer = useTimerStore();

  const [dismissedIds, setDismissedIds] = useState<string[]>(() => {
    try {
      const saved = sessionStorage.getItem('dude_dismissed_schedule_ids');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const dismissSchedule = (id: string) => {
    setDismissedIds(prev => {
      const next = prev.includes(id) ? prev : [...prev, id];
      sessionStorage.setItem('dude_dismissed_schedule_ids', JSON.stringify(next));
      return next;
    });
  };

  const alertSchedule = useMemo<AlertSchedule | null>(() => {
    const todayStr = getLocalDateString(new Date());
    const nowTime = new Date();
    const currentHH = nowTime.getHours();
    const currentMM = nowTime.getMinutes();
    const currentTotalMins = currentHH * 60 + currentMM;

    // A) Get database schedules
    const rawSchedules = (dataStore.scheduledActivities || []).filter(sa => {
      const isBeingRun = timer.isActive && timer.scheduledActivityId === sa.id;
      const statusNormalized = sa.status?.toLowerCase();
      // Include standard states: pending or agendada
      const isPending = statusNormalized === 'pending' || statusNormalized === 'agendada';
      const isDismissed = dismissedIds.includes(sa.id);

      return sa.scheduled_date === todayStr && 
             isPending &&
             !isDismissed &&
             !isBeingRun;
    });

    // B) Get dynamic scheduled habits for today uncompleted
    const scheduledHabits = (dataStore.habits || [])
      .filter(h => h.habit_mode === 'build' && h.is_scheduled)
      .filter(habit => {
        // STRICT RULE to prevent duplicate: If there's already a real database scheduled activity for this habit today (e.g. from recurrence generation),
        // we skip the dynamic entry since the database one handles it perfectly.
        const dbScheduleExists = (dataStore.scheduledActivities || []).some(
          sa => sa.habit_id === habit.id && sa.scheduled_date === todayStr
        );
        return !dbScheduleExists;
      })
      .map(habit => {
        const isCompleted = (dataStore.habitCompletions || []).some(hc => {
          if (hc.habit_id !== habit.id) return false;
          const compDateStr = getLocalDateString(new Date(hc.completed_at));
          return compDateStr === todayStr;
        });

        const id = `habit-sched-${habit.id}`;
        const isDismissed = dismissedIds.includes(id);

        return {
          id,
          user_id: habit.user_id,
          habit_id: habit.id,
          project_id: null,
          activity_id: null,
          atividade_avulsa: habit.name,
          title: habit.name,
          scheduled_date: todayStr,
          scheduled_time: habit.sched_start || '09:00',
          duration_minutes: habit.sched_duration || 45,
          status: isCompleted ? 'completed' : 'pending',
          notes: 'Hábito Atômico Programado',
          tasks: []
        };
      })
      .filter(sh => {
        const isBeingRun = timer.isActive && timer.scheduledActivityId === sh.id;
        const isDismissed = dismissedIds.includes(sh.id);
        return sh.status === 'pending' && !isDismissed && !isBeingRun;
      });

    // Combine both into single array of active items
    const todaysPendingSchedules = [...rawSchedules, ...scheduledHabits];

    if (todaysPendingSchedules.length === 0) return null;

    // Sort to show the earliest schedule first
    todaysPendingSchedules.sort((a, b) => {
      const [ah, am] = (a.scheduled_time || '00:00').split(':').map(Number);
      const [bh, bm] = (b.scheduled_time || '00:00').split(':').map(Number);
      return (ah * 60 + am) - (bh * 60 + bm);
    });

    for (const sa of todaysPendingSchedules) {
      const [sh, sm] = (sa.scheduled_time || '00:00').split(':').map(Number);
      const schedMins = sh * 60 + sm;
      const diffMins = currentTotalMins - schedMins;

      // Imminent: scheduled in the next 15 mins (between -15 and 0)
      // Overdue: past its start time (diffMins > 0)
      const isOverdue = diffMins > 0;
      const isImminent = diffMins >= -15 && diffMins <= 0;

      if (isOverdue || isImminent) {
        return {
          activity: {
            ...sa,
            title: sa.title || sa.atividade_avulsa || 'Sessão Profunda Planejada'
          },
          isOverdue,
          isImminent,
          scheduled_time: sa.scheduled_time
        };
      }
    }

    return null;
  }, [dataStore.scheduledActivities, dataStore.habits, dataStore.habitCompletions, dismissedIds, timer.isActive, timer.scheduledActivityId]);

  return {
    alertSchedule,
    dismissSchedule,
    dismissedIds,
  };
};
