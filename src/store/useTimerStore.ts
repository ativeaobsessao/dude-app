import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface TimerState {
  isActive: boolean;
  isPaused: boolean;
  startTime: number | null; // Timestamp
  totalDurationMs: number | null; // Total planned duration
  totalPausedMs: number;
  lastPausedAt: number | null;
  activityName: string;
  projectId: string | null;
  habitId: string | null;
  description: string;
  targetDate: string;
  pendingTasks: string[];
  
  start: (durationMinutes: number, activity: string, projId?: string, habId?: string, desc?: string, date?: string) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  reset: () => void;
  updateConfig: (projId?: string, habId?: string, activity?: string) => void;
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
      startTime: null,
      totalDurationMs: null,
      totalPausedMs: 0,
      lastPausedAt: null,
      activityName: '',
      projectId: null,
      habitId: null,
      description: '',
      targetDate: '',
      pendingTasks: [] as string[],

      setPendingTasks: (tasks) => set({ pendingTasks: tasks }),
      clearPendingTasks: () => set({ pendingTasks: [] }),

      start: (durationMinutes, activity, projId, habId, desc, date) => {
        set({
          isActive: true,
          isPaused: false,
          startTime: Date.now(),
          totalDurationMs: durationMinutes * 60 * 1000,
          totalPausedMs: 0,
          lastPausedAt: null,
          activityName: activity || '',
          projectId: projId || null,
          habitId: habId || null,
          description: desc || '',
          targetDate: date || new Date().toISOString().split('T')[0],
        });
      },

      pause: () => {
        const { isActive, isPaused } = get();
        if (isActive && !isPaused) {
          set({
            isPaused: true,
            lastPausedAt: Date.now()
          });
        }
      },

      resume: () => {
        const { isActive, isPaused, lastPausedAt, totalPausedMs } = get();
        if (isActive && isPaused && lastPausedAt) {
          const newlyPaused = Date.now() - lastPausedAt;
          set({
            isPaused: false,
            lastPausedAt: null,
            totalPausedMs: totalPausedMs + newlyPaused
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
          startTime: null,
          totalDurationMs: null,
          totalPausedMs: 0,
          lastPausedAt: null,
          activityName: '',
          projectId: null,
          habitId: null,
          description: '',
          targetDate: '',
          pendingTasks: [],
        });
      },

      updateConfig: (projId, habId, activity) => {
        set({
          projectId: projId !== undefined ? projId : get().projectId,
          habitId: habId !== undefined ? habId : get().habitId,
          activityName: activity !== undefined ? activity : get().activityName,
        });
      },

      getRemainingMs: () => {
        const { startTime, totalDurationMs, isActive, totalPausedMs, isPaused, lastPausedAt } = get();
        if (!isActive || !startTime || !totalDurationMs) return 0;
        
        let currentTotalPaused = totalPausedMs;
        if (isPaused && lastPausedAt) {
          currentTotalPaused += (Date.now() - lastPausedAt);
        }

        const elapsedSinceStart = Date.now() - startTime;
        const actualElapsed = elapsedSinceStart - currentTotalPaused;
        const remaining = totalDurationMs - actualElapsed;
        return Math.max(0, remaining);
      },
    }),
    {
      name: 'dude-timer-storage',
      skipHydration: false,
    }
  )
);
