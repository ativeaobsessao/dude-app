import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { getLocalDateString } from '../lib/utils';
import { secureLocalStorage } from '../lib/security';

interface TimerState {
  isActive: boolean;
  isPaused: boolean;
  initialStartTime: number | null; // Timestamp representing absolute session start
  startTime: number | null; // Timestamp representing start of the current active run
  totalDurationMs: number | null; // Total planned duration
  accumulatedTimeMs: number; // Replaces totalPausedMs and lastPausedAt
  activityName: string;
  projectId: string | null;
  habitId: string | null;
  activityId: string | null;
  description: string;
  targetDate: string;
  pendingTasks: string[];
  scheduledActivityId: string | null;
  setScheduledActivityId: (id: string | null) => void;
  
  start: (durationMinutes: number, activity: string, projId?: string, habId?: string, desc?: string, date?: string, actId?: string, scheduledActId?: string) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  reset: () => void;
  updateConfig: (projId?: string, habId?: string, activity?: string, actId?: string, scheduledActId?: string) => void;
  setPendingTasks: (tasks: string[]) => void;
  clearPendingTasks: () => void;
  
  // Computed values
  getRemainingMs: () => number;
}

export const useTimerStore = create<TimerState>()(
  persist(
    (set, get) => ({
      isActive: false,
      isPaused: false,
      initialStartTime: null,
      startTime: null,
      totalDurationMs: null,
      accumulatedTimeMs: 0,
      activityName: '',
      projectId: null,
      habitId: null,
      activityId: null,
      description: '',
      targetDate: '',
      pendingTasks: [] as string[],
      scheduledActivityId: null,

      setScheduledActivityId: (id) => set({ scheduledActivityId: id }),
      setPendingTasks: (tasks) => set({ pendingTasks: tasks }),
      clearPendingTasks: () => set({ pendingTasks: [] }),

      start: (durationMinutes, activity, projId, habId, desc, date, actId, scheduledActId) => {
        const now = Date.now();
        set({
          isActive: true,
          isPaused: false,
          initialStartTime: now,
          startTime: now,
          totalDurationMs: durationMinutes * 60 * 1000,
          accumulatedTimeMs: 0,
          activityName: activity || '',
          projectId: projId || null,
          habitId: habId || null,
          activityId: actId || null,
          description: desc || '',
          targetDate: date || getLocalDateString(new Date()),
          scheduledActivityId: scheduledActId || get().scheduledActivityId || null,
        });
      },

      pause: () => {
        const { isActive, isPaused, startTime, accumulatedTimeMs } = get();
        if (isActive && !isPaused && startTime) {
          const elapsedRound = Date.now() - startTime;
          set({
            isPaused: true,
            accumulatedTimeMs: accumulatedTimeMs + elapsedRound,
            startTime: null
          });
        }
      },

      resume: () => {
        const { isActive, isPaused } = get();
        if (isActive && isPaused) {
          set({
            isPaused: false,
            startTime: Date.now()
          });
        }
      },

      stop: () => {
        set({ isActive: false, isPaused: false });
      },

      reset: () => {
        set({
          isActive: false,
          isPaused: false,
          initialStartTime: null,
          startTime: null,
          totalDurationMs: null,
          accumulatedTimeMs: 0,
          activityName: '',
          projectId: null,
          habitId: null,
          activityId: null,
          description: '',
          targetDate: '',
          pendingTasks: [],
          scheduledActivityId: null,
        });
      },

      updateConfig: (projId, habId, activity, actId, scheduledActId) => {
        set({
          projectId: projId !== undefined ? projId : get().projectId,
          habitId: habId !== undefined ? habId : get().habitId,
          activityName: activity !== undefined ? activity : get().activityName,
          activityId: actId !== undefined ? actId : get().activityId,
          scheduledActivityId: scheduledActId !== undefined ? scheduledActId : get().scheduledActivityId,
        });
      },

      getRemainingMs: () => {
        const { startTime, totalDurationMs, isActive, isPaused, accumulatedTimeMs } = get();
        if (!isActive || !totalDurationMs) return 0;
        
        let actualElapsed = accumulatedTimeMs;
        if (!isPaused && startTime) {
          actualElapsed += (Date.now() - startTime);
        }

        const remaining = totalDurationMs - actualElapsed;
        return Math.max(0, remaining);
      },
    }),
    {
      name: 'dude-timer-storage',
      skipHydration: false,
      storage: createJSONStorage(() => secureLocalStorage),
    }
  )
);
