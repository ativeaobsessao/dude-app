import { useState, useEffect, useRef } from 'react';
import { Target, X, AlertTriangle, Check, Home, ListTodo, Play, BarChart2, Menu as MenuIcon, FolderKanban, Layers } from 'lucide-react';
import { TaskListScreen } from './components/dashboard/TaskListScreen';
import { CinematicBackground } from './components/layout/CinematicBackground';
import { HeroSection } from './components/dashboard/HeroSection';
import { ActiveSession } from './components/dashboard/ActiveSession';
import { HabitsSection } from './components/dashboard/HabitsSection';
import { ProjectsSection } from './components/dashboard/ProjectsSection';
import { ActivitiesSection } from './components/dashboard/ActivitiesSection';
import { AvoidanceSection } from './components/dashboard/AvoidanceSection';
import { RecentNotes } from './components/dashboard/RecentNotes';
import { LinksHeroBlock } from './components/links/LinksHeroBlock';
import { RecentHistory } from './components/dashboard/RecentHistory';
import { ActionCenter } from './components/layout/ActionCenter';
import { motion, AnimatePresence } from 'motion/react';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { ProgressStats } from './components/dashboard/ProgressStats';
import { SessaoProfundaTab } from './components/session/SessaoProfundaTab';
import { useAuthStore } from './store/useAuthStore';
import { useDataStore } from './store/useDataStore';
import { useTimerStore } from './store/useTimerStore';
import { AccountPanel } from './components/layout/AccountPanel';
import { PWAInstallPrompt } from './components/layout/PWAInstallPrompt';
import { PWAProvider } from './context/PWAContext';
import { getLocalDateString, getLocalYesterdayDateString, getCurrentPeriodAndDate } from './lib/utils';
import { supabase } from './lib/supabase';

import { ErrorBoundary } from './components/ErrorBoundary';
import { PrivacyPolicy } from './components/legal/PrivacyPolicy';
import { TermsOfUse } from './components/legal/TermsOfUse';

// Agenda Integration
import { AgendaHoje } from './components/agenda/AgendaHoje';
import { ProximasAtividades } from './components/agenda/ProximasAtividades';
import { AgendaCompletaPage } from './components/agenda/AgendaCompletaPage';
import { ReagendarModal, ReconfigurarModal } from './components/agenda/SchedulePopups';

// Mood Ritual Integration
import { MoodRitualModal } from './components/mood/MoodRitualModal';
import { MOODS } from './lib/mood';
import { DailyShutdownModal } from './components/dashboard/DailyShutdownModal';

export default function App() {
  const { signOut, user } = useAuthStore();
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  const { 
    hasCompletedFirstSession, 
    profile, 
    notification, 
    clearNotification,
    sessions, 
    initialFetchDone, 
    moodEntries,
    habitCompletions,
    avoidanceCheckins,
    scheduledActivities
  } = useDataStore();
  const dataStore = useDataStore();
  const [activeTab, setActiveTab] = useState<'home' | 'listas' | 'session' | 'centro' | 'menu'>('home');

  const [showStats, setShowStats] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [showFullAgenda, setShowFullAgenda] = useState(false);
  const [showAccountPanel, setShowAccountPanel] = useState(false);

  // Reagendar & Reconfigurar popup controllers
  const [selectedPopupActivity, setSelectedPopupActivity] = useState<any | null>(null);
  const [isReagendarOpen, setIsReagendarOpen] = useState(false);
  const [isReconfigurarOpen, setIsReconfigurarOpen] = useState(false);

  const [popupState, setPopupState] = useState<{
    serverChecked: boolean;
    yesterdayClosed: boolean;
    todayMoodDone: boolean;
    yesterdayStr: string;
    todayStr: string;
    currentPeriod: 'manha' | 'tarde' | 'noite' | null;
  }>({
    serverChecked: false,
    yesterdayClosed: false,
    todayMoodDone: false,
    yesterdayStr: '',
    todayStr: '',
    currentPeriod: null,
  });

  const [manualShutdownOpen, setManualShutdownOpen] = useState(false);
  const [manualShutdownDate, setManualShutdownDate] = useState('');

  const runServerPopupCheck = async () => {
    if (!user) return;
    
    try {
      const yesterdayStr = getLocalYesterdayDateString(new Date());
      const { period, dateStr: todayStr } = getCurrentPeriodAndDate(new Date());

      const [closureRes, moodRes] = await Promise.all([
        supabase
          .from('day_closures')
          .select('id')
          .eq('user_id', user.id)
          .eq('closure_date', yesterdayStr),
        supabase
          .from('mood_entries')
          .select('id')
          .eq('user_id', user.id)
          .eq('date', todayStr)
          .eq('period', period)
      ]);

      const yesterdayClosed = !!(closureRes.data && closureRes.data.length > 0);
      const todayMoodDone = !!(moodRes.data && moodRes.data.length > 0);

      // Reconcile and write-through to local storage is okay, but serverChecked is the true key
      if (yesterdayClosed) {
        localStorage.setItem(`dude-shutdown-completed-${yesterdayStr}`, 'true');
      }

      setPopupState({
        serverChecked: true,
        yesterdayClosed,
        todayMoodDone,
        yesterdayStr,
        todayStr,
        currentPeriod: period,
      });
    } catch (err) {
      console.error('Error running authoritative server popup checks:', err);
    }
  };

  // Trigger sound alerts on app open/focus
  const hasPlayedScheduleSoundRef = useRef(false);

  useEffect(() => {
    if (!user || !initialFetchDone) return;

    runServerPopupCheck();
    dataStore.fetchScheduledActivities(user.id);

    // Play schedule state sound (app open)
    const playLoadedScheduleSounds = async () => {
      if (hasPlayedScheduleSoundRef.current) return;
      hasPlayedScheduleSoundRef.current = true;
      
      const todayStr = getLocalDateString(new Date());
      const nowTime = new Date();
      const currentHH = nowTime.getHours();
      const currentMM = nowTime.getMinutes();
      const currentTotalMins = currentHH * 60 + currentMM;

      const todaysSchedules = (dataStore.scheduledActivities || []).filter(sa => {
        return sa.scheduled_date === todayStr && (sa.status === 'pending' || sa.status === 'agendada');
      });

      const today = new Date();
      let dayOfWeek = today.getDay();
      if (dayOfWeek === 0) dayOfWeek = 7;
      const dayOfWeekStr = String(dayOfWeek);

      const activeHabits = (dataStore.habits || [])
        .filter(h => {
          if (!h.is_scheduled) return false;
          if (h.sched_weekdays === 'all') return true;
          const days = (h.sched_weekdays || '').split(',');
          return days.includes(dayOfWeekStr);
        })
        .filter(h => {
          const isCompleted = (dataStore.habitCompletions || []).some(hc => {
            if (hc.habit_id !== h.id) return false;
            const compDateStr = getLocalDateString(new Date(hc.completed_at));
            return compDateStr === todayStr;
          });
          return !isCompleted;
        });

      const times: { time: string }[] = [];
      todaysSchedules.forEach(sa => {
        times.push({ time: sa.scheduled_time || '00:00' });
      });
      activeHabits.forEach(h => {
        times.push({ time: h.sched_start || '09:00' });
      });

      if (times.length === 0) return;

      let hasStart = false;
      let hasOverdue = false;

      times.forEach(t => {
        const [sh, sm] = t.time.split(':').map(Number);
        const schedMins = sh * 60 + sm;
        const diffMins = currentTotalMins - schedMins;

        if (diffMins >= 0 && diffMins <= 5) {
          hasStart = true;
        } else if (diffMins > 5) {
          hasOverdue = true;
        }
      });

      const { playScheduleSound } = await import('./hooks/useSessionNotifications');
      if (hasStart) {
        playScheduleSound('start');
      } else if (hasOverdue) {
        playScheduleSound('overdue');
      }
    };

    playLoadedScheduleSounds();

    const handleVisibility = async () => {
      if (document.visibilityState === 'visible') {
        try {
          await dataStore.revalidateSyncState(user.id);
        } catch (e) {
          console.error("Error in revalidateSyncState:", e);
        }
        runServerPopupCheck();
        dataStore.fetchScheduledActivities(user.id);
      }
    };

    const handleFocus = async () => {
      try {
        await dataStore.revalidateSyncState(user.id);
      } catch (e) {
        console.error("Error in revalidateSyncState:", e);
      }
      runServerPopupCheck();
      dataStore.fetchScheduledActivities(user.id);
    };

    window.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
    };
  }, [user, initialFetchDone, dataStore.scheduledActivities.length]);

  // Listen to custom popups & session startup events
  useEffect(() => {
    if (!user) return;

    const handleReagendarEvent = (e: any) => {
      setSelectedPopupActivity(e.detail);
      setIsReagendarOpen(true);
    };
    const handleReconfigurarEvent = (e: any) => {
      setSelectedPopupActivity(e.detail);
      setIsReconfigurarOpen(true);
    };
    const handleStartSessionEvent = (e: any) => {
      if (e.detail) {
        handleStartSessionFromAgenda(e.detail);
      }
    };

    window.addEventListener('open-reagendar', handleReagendarEvent);
    window.addEventListener('open-reconfigurar', handleReconfigurarEvent);
    window.addEventListener('start-scheduled-session', handleStartSessionEvent);

    return () => {
      window.removeEventListener('open-reagendar', handleReagendarEvent);
      window.removeEventListener('open-reconfigurar', handleReconfigurarEvent);
      window.removeEventListener('start-scheduled-session', handleStartSessionEvent);
    };
  }, [user]);

  // Listen to manual shutdown triggers
  useEffect(() => {
    const handleManualShutdown = () => {
      const todayStr = getLocalDateString(new Date());
      setManualShutdownDate(todayStr);
      setManualShutdownOpen(true);
    };

    window.addEventListener('trigger-daily-shutdown', handleManualShutdown);
    return () => {
      window.removeEventListener('trigger-daily-shutdown', handleManualShutdown);
    };
  }, []);

  const isMoodActive = (() => {
    if (!user || !profile || !initialFetchDone || !popupState.serverChecked || !popupState.currentPeriod || !popupState.todayStr) {
      return false;
    }
    if (popupState.todayMoodDone) {
      return false;
    }
    const hasInStoreToday = moodEntries.some(m => m.date === popupState.todayStr && m.period === popupState.currentPeriod);
    if (hasInStoreToday) {
      return false;
    }

    try {
      const isSkipped = localStorage.getItem(`dude-mood-skipped-${popupState.todayStr}-${popupState.currentPeriod}`) === 'true';
      if (isSkipped) {
        return false;
      }
    } catch (e) {
      console.error("Error reading mood skip storage:", e);
    }
    
    // Check Supabase privacy settings (GDPR)
    if (profile?.mood_status === 'disabled') {
      return false;
    }
    if (profile?.mood_status === 'paused' && profile?.mood_snoozed_until) {
      const snoozedUntilDate = new Date(profile.mood_snoozed_until).getTime();
      if (Date.now() < snoozedUntilDate) {
        return false;
      }
    }
    return true;
  })();

  const isCatchUpActive = (() => {
    if (isMoodActive) return false;

    if (!user || !initialFetchDone || !popupState.serverChecked || !popupState.yesterdayStr) {
      return false;
    }
    if (popupState.yesterdayClosed) {
      return false;
    }

    const isCompletedLocal = localStorage.getItem(`dude-shutdown-completed-${popupState.yesterdayStr}`) === 'true';
    const isDismissedLocal = localStorage.getItem(`dude-shutdown-dismissed-${popupState.yesterdayStr}`) === 'true';
    if (isCompletedLocal || isDismissedLocal) {
      return false;
    }

    const yesterdaySessionsObj = sessions.filter(s => getLocalDateString(new Date(s.started_at)) === popupState.yesterdayStr && s.completed);
    const yesterdayHabitComps = habitCompletions.filter(hc => hc.completed_at.startsWith(popupState.yesterdayStr));
    const yesterdayAvoidance = avoidanceCheckins.filter(ac => ac.checkin_date === popupState.yesterdayStr);
    const yesterdayScheduled = scheduledActivities.filter(sa => sa.scheduled_date === popupState.yesterdayStr && sa.status === 'completed');

    const hasActivityYesterday = yesterdaySessionsObj.length > 0 ||
                                 yesterdayHabitComps.length > 0 ||
                                 yesterdayAvoidance.length > 0 ||
                                 yesterdayScheduled.length > 0;

    return hasActivityYesterday;
  })();

  // Dynamically set --mood CSS variable based on current today's mood
  useEffect(() => {
    if (!user) {
      document.documentElement.style.setProperty('--mood', 'var(--text-dimmer)');
      return;
    }
    
    const todayStr = getLocalDateString(new Date());
    const todayMoods = moodEntries.filter(m => m.date === todayStr);
    
    if (todayMoods.length > 0) {
      const mostRecent = todayMoods[0];
      const moodColor = MOODS[mostRecent.mood]?.color || 'var(--text-dimmer)';
      document.documentElement.style.setProperty('--mood', moodColor);
    } else {
      document.documentElement.style.setProperty('--mood', 'var(--text-dimmer)');
    }
  }, [moodEntries, user]);

  const notifiedActivityIdsRef = useRef<Set<string>>(new Set());

  // Observe approaching scheduled activities every 10 seconds
  useEffect(() => {
    if (!user) return;

    const checkSchedules = () => {
      // Check if deep task is active in timer
      const isTimerActive = useTimerStore.getState().isActive;
      if (isTimerActive) return; // Suppress reminders during deep focus sessions

      // Get current date/time
      const now = new Date();
      const todayStr = getLocalDateString(now);
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      // Find pending scheduled activities for today
      const todayPending = useDataStore.getState().scheduledActivities.filter(item => {
        return item.scheduled_date === todayStr && item.status === 'pending';
      });

      // Find active scheduled habits for today that are not completed yet
      let dayOfWeek = now.getDay();
      if (dayOfWeek === 0) dayOfWeek = 7;
      const dayOfWeekStr = String(dayOfWeek);

      const activeHabits = useDataStore.getState().habits
        .filter(habit => {
          if (!habit.is_scheduled) return false;
          if (habit.sched_weekdays === 'all') return true;
          const days = (habit.sched_weekdays || '').split(',');
          return days.includes(dayOfWeekStr);
        })
        .filter(habit => {
          // Exclude virtual/dynamic mapping if a real database scheduled activity exists for this habit today (whether pending or completed)
          const dbScheduleExists = useDataStore.getState().scheduledActivities.some(
            sa => sa.habit_id === habit.id && sa.scheduled_date === todayStr
          );
          return !dbScheduleExists;
        })
        .filter(habit => {
          const isCompleted = useDataStore.getState().habitCompletions.some(hc => {
            if (hc.habit_id !== habit.id) return false;
            const compDateStr = getLocalDateString(new Date(hc.completed_at));
            return compDateStr === todayStr;
          });
          return !isCompleted;
        });

      const triggerNotification = (alertTitle: string, alertBody: string) => {
        if ('Notification' in window && Notification.permission === 'granted') {
          try {
            new Notification(alertTitle, {
              body: alertBody,
              icon: '/icon.png'
            });
          } catch (err) {
            console.warn('Erro ao disparar notificação nativa:', err);
          }
        }
        // Also show elegant internal ActionCenter toast notification
        useDataStore.getState().showNotification(`⏰ ${alertBody}`, 'success');
      };

      const virtualActivities = activeHabits.map(habit => {
        return {
          id: `habit-sched-${habit.id}`,
          title: habit.name,
          scheduled_time: habit.sched_start || '09:00',
        };
      });

      const allTargets = [
        ...todayPending.map(ap => ({ id: ap.id, title: ap.title || 'Seu bloco de foco programado', scheduled_time: ap.scheduled_time })),
        ...virtualActivities
      ];

      allTargets.forEach(target => {
        const [h, m] = (target.scheduled_time || '09:00').split(':').map(Number);
        const scheduledMinutes = h * 60 + m;

        const diffMinutes = scheduledMinutes - currentMinutes;

        // ALERTA 1: 5 minutos antes
        if (diffMinutes === 5) {
          const key = `${target.id}-5min`;
          if (!notifiedActivityIdsRef.current.has(key)) {
            notifiedActivityIdsRef.current.add(key);
            triggerNotification(`⏰ Foco aproximando!`, `Sua atividade "${target.title}" começará em 5 minutos.`);
          }
        }

        // ALERTA 2: 1 minuto antes
        if (diffMinutes === 1) {
          const key = `${target.id}-1min`;
          if (!notifiedActivityIdsRef.current.has(key)) {
            notifiedActivityIdsRef.current.add(key);
            triggerNotification(`⏰ Quase na hora!`, `Prepare-se. Sua atividade "${target.title}" começará em instantes.`);
          }
        }

        // ALERTA 3: Hora exata (0 minutos)
        if (diffMinutes === 0) {
          const key = `${target.id}-now`;
          if (!notifiedActivityIdsRef.current.has(key)) {
            notifiedActivityIdsRef.current.add(key);
            triggerNotification(`⚡ Atividade iniciada!`, `Está na hora de iniciar sua atividade "${target.title}".`);
          }
        }
      });
    };

    // Run immediately and then every 10 seconds for high precision
    checkSchedules();
    const intervalId = setInterval(checkSchedules, 10000);

    return () => clearInterval(intervalId);
  }, [user]);

  const handleStartSessionFromAgenda = (activity: any) => {
    useTimerStore.getState().setScheduledActivityId(activity.id);
    // Send event to open ActionCenter prefilled
    window.dispatchEvent(new CustomEvent('open-action-center', {
      detail: {
        screen: 'session',
        prefill: {
          projectId: activity.project_id,
          activityId: activity.activity_id,
          activityManual: activity.atividade_avulsa,
          habitId: activity.habit_id,
          notes: activity.notes,
          hours: Math.floor(activity.duration_minutes / 60),
          minutes: activity.duration_minutes % 60,
          tasks: activity.tasks,
          scheduledActivityId: activity.id
        }
      }
    }));
  };

  const handleOpenNewSchedule = () => {
    // Open action center directly on agenda screen
    window.dispatchEvent(new CustomEvent('open-action-center', {
      detail: {
        screen: 'agenda'
      }
    }));
  };

  useEffect(() => {
    const handleNavigate = () => {
      setShowFullAgenda(true);
    };
    const handleOpenStats = () => {
      setShowStats(true);
    };
    window.addEventListener('navigate-to-agenda', handleNavigate);
    window.addEventListener('open-stats', handleOpenStats);
    return () => {
      window.removeEventListener('navigate-to-agenda', handleNavigate);
      window.removeEventListener('open-stats', handleOpenStats);
    };
  }, []);

  useEffect(() => {
    if (user && 'Notification' in window) {
      if (Notification.permission === 'default') {
        // Pequeno delay para não assustar o usuário
        setTimeout(() => {
          Notification.requestPermission().then(permission => {
            console.log('Permissão de notificação:', permission);
          });
        }, 3000);
      }
    }
  }, [user]);

  // SWIPE & DISPATCH MAPPING EFFECT
  useEffect(() => {
    const handleOpenActionCenter = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail && customEvent.detail.screen === 'session') {
        setActiveTab('session');
      }
    };
    const handleSetTab = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.tab) {
        setShowFullAgenda(false);
        setActiveTab(customEvent.detail.tab);
      }
    };
    window.addEventListener('open-action-center', handleOpenActionCenter);
    window.addEventListener('set-active-tab', handleSetTab);
    return () => {
      window.removeEventListener('open-action-center', handleOpenActionCenter);
      window.removeEventListener('set-active-tab', handleSetTab);
    };
  }, []);

  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  useEffect(() => {
    const isInteractiveElementActive = () => {
      const activeEl = document.activeElement;
      if (activeEl) {
        const tagName = activeEl.tagName.toLowerCase();
        if (tagName === 'input' || tagName === 'textarea' || tagName === 'select' || activeEl.getAttribute('contenteditable') === 'true') {
          return true;
        }
      }

      const modalSelectors = [
        '[role="dialog"]',
        '.modal',
        '.popup',
        '.dropdown-content',
        '[id^="radix-"]',
        'pre',
        '.select-content'
      ];
      for (const selector of modalSelectors) {
        if (document.querySelector(selector)) {
          return true;
        }
      }

      if (showSignOutConfirm || isReagendarOpen || isReconfigurarOpen || showFullAgenda) {
        return true;
      }

      return false;
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      if (isInteractiveElementActive()) return;

      const touch = e.touches[0];
      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now()
      };
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchStartRef.current) return;
      if (e.changedTouches.length !== 1) return;
      if (isInteractiveElementActive()) return;

      const touch = e.changedTouches[0];
      const diffX = touch.clientX - touchStartRef.current.x;
      const diffY = touch.clientY - touchStartRef.current.y;
      const duration = Date.now() - touchStartRef.current.time;

      touchStartRef.current = null;

      // Swipe requirements: duration < 400ms, X distance > 70px, Y distance < 50% of X distance
      if (duration < 400 && Math.abs(diffX) > 70 && Math.abs(diffY) < Math.abs(diffX) * 0.5) {
        const order: ('home' | 'listas' | 'session' | 'centro' | 'menu')[] = ['home', 'listas', 'session', 'centro', 'menu'];
        const currentIndex = order.indexOf(activeTab);

        if (diffX < 0) {
          // Swipe left -> advance
          if (currentIndex < order.length - 1) {
            setActiveTab(order[currentIndex + 1]);
          }
        } else {
          // Swipe right -> reverse
          if (currentIndex > 0) {
            setActiveTab(order[currentIndex - 1]);
          }
        }
      }
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [activeTab, showSignOutConfirm, isReagendarOpen, isReconfigurarOpen, showFullAgenda]);

  if (currentPath === '/privacidade') {
    return (
      <ErrorBoundary>
        <PrivacyPolicy onBack={() => {
          window.history.pushState({}, '', '/');
          setCurrentPath('/');
        }} />
      </ErrorBoundary>
    );
  }

  if (currentPath === '/termos') {
    return (
      <ErrorBoundary>
        <TermsOfUse onBack={() => {
          window.history.pushState({}, '', '/');
          setCurrentPath('/');
        }} />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <ProtectedRoute>
        <PWAProvider>
          <div className="relative min-h-screen selection:bg-green/30 selection:text-green overflow-x-hidden text-text">
        <MoodRitualModal 
          isOpen={isMoodActive} 
          onClose={(wasAnswered?: boolean) => {
            if (wasAnswered) {
              setPopupState(prev => ({
                ...prev,
                todayMoodDone: true
              }));
            }
            runServerPopupCheck();
          }} 
          currentPeriod={popupState.currentPeriod || 'manha'} 
          currentDate={popupState.todayStr || ''}
        />
        <DailyShutdownModal 
          isOpen={manualShutdownOpen || isCatchUpActive} 
          onClose={() => {
            setManualShutdownOpen(false);
            runServerPopupCheck();
          }} 
          targetDate={manualShutdownOpen ? manualShutdownDate : popupState.yesterdayStr}
          isCatchUp={manualShutdownOpen ? false : isCatchUpActive}
        />
        <ReagendarModal
          isOpen={isReagendarOpen}
          onClose={() => {
            setIsReagendarOpen(false);
            setSelectedPopupActivity(null);
          }}
          activity={selectedPopupActivity}
          onOpenReconfigurar={(act) => {
            setIsReconfigurarOpen(true);
            setSelectedPopupActivity(act);
          }}
        />
        <ReconfigurarModal
          isOpen={isReconfigurarOpen}
          onClose={() => {
            setIsReconfigurarOpen(false);
            setSelectedPopupActivity(null);
          }}
          activity={selectedPopupActivity}
        />
        <CinematicBackground />
        <PWAInstallPrompt />
        <ActiveSession />
        <ActionCenter />

        <AnimatePresence>
          {notification && (
            <div className="fixed inset-0 pointer-events-none z-[10000] flex items-center justify-center p-6 bg-background/50 backdrop-blur-[2px] transition-all duration-300">
              <motion.div
                layout={false}
                initial={{ opacity: 0, scale: 0.9, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: -15 }}
                transition={{ type: "spring", duration: 0.4 }}
                className="mx-auto px-8 py-6 rounded-[2rem] bg-surface/90 border border-border-white backdrop-blur-2xl shadow-[0_24px_80px_rgba(0,0,0,0.8),0_0_80px_rgba(110,231,168,0.15)] flex flex-col items-center gap-5 text-text pointer-events-auto max-w-sm w-full text-center relative"
              >
                <button
                  onClick={clearNotification}
                  className="absolute top-5 right-5 text-text-secondary/60 hover:text-text-primary transition-colors cursor-pointer p-1 rounded-full hover:bg-white/5"
                  title="Fechar"
                >
                  <X size={16} />
                </button>

                <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto bg-primary-green/10 text-primary-green">
                  {notification.type === 'success' ? (
                    <Check size={24} strokeWidth={3} />
                  ) : (
                    <AlertTriangle size={24} strokeWidth={3} className="text-coral" />
                  )}
                </div>

                <div className="space-y-1.5 w-full">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#6e7572]">
                    {notification.type === 'success' ? 'Salvo ✓' : 'Aviso / Erro'}
                  </p>
                  <p className="text-sm font-semibold text-text-primary leading-relaxed">
                    {notification.message}
                  </p>
                </div>

                <button
                  onClick={clearNotification}
                  className="w-full py-3 bg-primary-green hover:brightness-110 active:scale-95 text-background rounded-2xl font-bold uppercase tracking-widest text-[10px] transition-all cursor-pointer shadow-md"
                >
                  OK
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showStats && <ProgressStats onClose={() => setShowStats(false)} />}
        </AnimatePresence>

        <AnimatePresence>
          {showAccountPanel && (
            <AccountPanel
              isOpen={showAccountPanel}
              onClose={() => setShowAccountPanel(false)}
              userEmail={user?.email}
              user={user}
              onSignOut={() => setShowSignOutConfirm(true)}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showSignOutConfirm && (
            <motion.div 
              layout={false}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-base/80 backdrop-blur-md"
            >
              <motion.div 
                layout={false}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="w-full max-w-sm bg-surface-2 border border-border-custom rounded-3xl p-10 flex flex-col items-center gap-6 text-center shadow-2xl"
              >
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-text tracking-tight">
                    Sair do DUDE?
                  </h3>
                  <p className="text-text-dim font-light text-sm">
                    Tem certeza que deseja sair?
                  </p>
                </div>
                <div className="flex flex-col w-full gap-3">
                  <button
                    onClick={() => signOut()}
                    className="w-full py-4 bg-coral/10 hover:bg-coral/20 border border-coral/20 text-coral rounded-2xl font-bold uppercase tracking-widest text-[10px] transition-all"
                  >
                    Sim, sair
                  </button>
                  <button
                    onClick={() => setShowSignOutConfirm(false)}
                    className="w-full py-4 border border-green/30 text-green rounded-2xl font-bold uppercase tracking-widest text-[10px] hover:bg-green/10 transition-all"
                  >
                    Cancelar
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <header className="absolute top-0 left-0 right-0 z-50 px-6 py-6 md:px-12 flex items-center justify-between">
          {/* Left Spacer to perfectly balance the avatar on the right */}
          <div className="w-10 h-10 md:block hidden" />

          {/* Centered DUDE Brand (Text-only as required) */}
          <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center justify-center pointer-events-none select-none">
            <span className="text-xl font-black tracking-[0.2em] text-text font-sans">
              DUDE
            </span>
          </div>
          
          {/* Right User Avatar (Opening the AccountPanel) */}
          <button 
            onClick={() => setShowAccountPanel(true)}
            className="w-10 h-10 rounded-full border border-border-custom overflow-hidden hover:border-green active:scale-95 transition-all cursor-pointer focus:outline-none flex items-center justify-center ml-auto shrink-0"
          >
            {profile?.avatar_url ? (
              <img 
                src={profile.avatar_url} 
                alt="Avatar"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-full h-full bg-[radial-gradient(circle_at_center,rgba(110,231,168,0.2)_0%,transparent_70%)] flex items-center justify-center text-green font-bold text-sm">
                {profile?.full_name?.charAt(0).toUpperCase() || '?'}
              </div>
            )}
          </button>
        </header>

        {showFullAgenda ? (
          <div className="pt-24 min-h-screen">
            <AgendaCompletaPage
              onBack={() => setShowFullAgenda(false)}
              onStartSession={handleStartSessionFromAgenda}
              onOpenNewSchedule={handleOpenNewSchedule}
            />
          </div>
        ) : (
          <main className="min-h-screen pb-40 flex flex-col items-center pt-16">
            {activeTab === 'home' && (
              <>
                <HeroSection onNavigateToLists={() => setActiveTab('listas')} />

                <div className="w-full max-w-6xl mx-auto px-6 space-y-12 md:space-y-16 flex flex-col items-center">
                  {/* AGENDA HOJE BRANCH */}
                  <div className="hidden md:block w-full">
                    <AgendaHoje 
                      onStartSession={handleStartSessionFromAgenda}
                      onOpenNewSchedule={handleOpenNewSchedule}
                    />
                  </div>

                  {/* 9. Seção Histórico Recente */}
                  <div className="hidden md:block w-full">
                    <RecentHistory />
                  </div>
                </div>
              </>
            )}

            {activeTab === 'listas' && (
              <TaskListScreen 
                tasks={[]}
                onTasksChange={() => {}}
                onStartSession={handleStartSessionFromAgenda}
              />
            )}

            {activeTab === 'session' && (
              <SessaoProfundaTab />
            )}

            {activeTab === 'centro' && (
              <ProgressStats onClose={() => setActiveTab('home')} />
            )}

            {activeTab === 'menu' && (() => {
              const hasAtLeastOneProjectAndActivity = dataStore.projects.length > 0 && dataStore.activities.length > 0;

              const renderAgendamento = () => (
                <div key="agendamento-section" className="w-full max-w-4xl mx-auto p-6 rounded-3xl bg-surface/5 border border-white/5 space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="space-y-1 text-left">
                      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-green">AGENDAMENTO</span>
                      <p className="text-xs text-text-secondary leading-relaxed font-sans">Faça o agendamento das suas tarefas aqui.</p>
                    </div>
                    <button
                      onClick={() => setShowFullAgenda(true)}
                      className="px-5 py-3 bg-green text-background hover:brightness-110 active:scale-95 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-[0_4px_20px_rgba(110,231,168,0.2)] shrink-0 self-start sm:self-center font-sans"
                    >
                      REALIZAR AGENDAMENTO
                    </button>
                  </div>
                </div>
              );

              return (
                <div className="w-full max-w-6xl mx-auto px-6 py-6 space-y-4 md:space-y-6 flex flex-col items-center">
                  {!hasAtLeastOneProjectAndActivity ? (
                    <>
                      <ProjectsSection />
                      <ActivitiesSection />
                      {renderAgendamento()}
                    </>
                  ) : (
                    <>
                      {renderAgendamento()}
                      <ProjectsSection />
                      <ActivitiesSection />
                    </>
                  )}

                  <HabitsSection />
                  <AvoidanceSection />
                  <RecentNotes />
                  <LinksHeroBlock />
                  <RecentHistory variant="menuRow" />
                </div>
              );
            })()}
          </main>
        )}

        <footer className="w-full py-12 border-t border-white/5 flex flex-col items-center justify-center gap-3 pb-32 px-4 text-center">
          <div className="flex items-center gap-2 select-none justify-center">
            <span className="text-[11px] tracking-widest uppercase text-[#6a7570]/80">
              <span className="text-[#6EE7B7] font-bold tracking-wider">DUDE</span> <span className="text-[9px] font-mono opacity-80">V2.1.0</span>
            </span>
          </div>
          <p className="text-[10px] text-[#6a7570] max-w-md font-light tracking-wide leading-relaxed">
            Com a DUDE você controla o seu presente, registra o seu passado — otimizando ao máximo o seu tempo.
          </p>
          <div className="text-[8px] text-[#6a7570]/40 font-mono tracking-wider select-none uppercase mt-1">
            POWERED BY SUPABASE
          </div>
        </footer>

        {/* FIXED BOTTOM NAVIGATION BAR */}
        <div className="fixed bottom-0 left-0 right-0 z-[300] bg-[#0d0f0e]/85 backdrop-blur-xl border-t border-white/5 pb-safe">
          <div className="max-w-md mx-auto px-6 py-3 flex items-center justify-between">
            {/* 1. Início */}
            <button 
              onClick={() => {
                setShowFullAgenda(false);
                setActiveTab('home');
              }}
              className={`flex flex-col items-center gap-1 flex-1 py-1 transition-all cursor-pointer ${
                activeTab === 'home' 
                  ? 'text-green scale-105' 
                  : 'text-text-secondary/40 hover:text-text-primary'
              }`}
            >
              <Home size={20} className="transition-all" />
              <span className="text-[9px] font-bold tracking-wider font-sans uppercase">Início</span>
            </button>

            {/* 2. Listas */}
            <button 
              onClick={() => {
                setShowFullAgenda(false);
                setActiveTab('listas');
              }}
              className={`flex flex-col items-center gap-1 flex-1 py-1 transition-all cursor-pointer ${
                activeTab === 'listas' 
                  ? 'text-green scale-105' 
                  : 'text-text-secondary/40 hover:text-text-primary'
              }`}
            >
              <ListTodo size={20} className="transition-all" />
              <span className="text-[9px] font-bold tracking-wider font-sans uppercase">Tarefas</span>
            </button>

            {/* 3. CENTER HIGHLIGHTED FOCAR ACTION */}
            <div className="flex-1 flex justify-center -mt-8 relative z-50">
              <button 
                onClick={() => {
                  setShowFullAgenda(false);
                  setActiveTab('session');
                }}
                className={`w-14 h-14 hover:brightness-110 rounded-full flex items-center justify-center text-background transition-all active:scale-95 duration-200 cursor-pointer transform hover:-translate-y-0.5 ${
                  activeTab === 'session'
                    ? 'bg-gradient-to-br from-green to-[#34d399] text-background shadow-[0_0_30px_rgba(110,231,168,0.6)] ring-4 ring-green/20 scale-110'
                    : 'bg-green text-background shadow-[0_4px_20px_rgba(110,231,168,0.4)]'
                }`}
                title="Sessão Profunda"
              >
                <Play size={24} fill="currentColor" className="ml-1 text-background" />
              </button>
            </div>

            {/* 4. Centro */}
            <button 
              onClick={() => {
                setShowFullAgenda(false);
                setActiveTab('centro');
              }}
              className={`flex flex-col items-center gap-1 flex-1 py-1 transition-all cursor-pointer ${
                activeTab === 'centro' 
                  ? 'text-green scale-105' 
                  : 'text-text-secondary/40 hover:text-text-primary'
              }`}
            >
              <BarChart2 size={20} className="transition-all" />
              <span className="text-[9px] font-bold tracking-wider font-sans uppercase">Centro</span>
            </button>

            {/* 5. Menu */}
            <button 
              onClick={() => {
                setShowFullAgenda(false);
                setActiveTab('menu');
              }}
              className={`flex flex-col items-center gap-1 flex-1 py-1 transition-all cursor-pointer ${
                activeTab === 'menu' 
                  ? 'text-green scale-105' 
                  : 'text-text-secondary/40 hover:text-text-primary'
              }`}
            >
              <MenuIcon size={20} className="transition-all" strokeWidth={2.5} />
              <span className="text-[9px] font-bold tracking-wider font-sans uppercase">Menu</span>
            </button>
          </div>
        </div>
      </div>
      </PWAProvider>
    </ProtectedRoute>
  </ErrorBoundary>
);
}
