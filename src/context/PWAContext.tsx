import React, { createContext, useContext, useState, useEffect } from 'react';
import { useDataStore } from '../store/useDataStore';

// TypeScript schema representing the PWA State
interface PWAContextType {
  isInstalled: boolean;
  canInstall: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  isDesktop: boolean;
  showInstallPrompt: boolean;
  installApp: () => void;
  dismissInstallPrompt: () => void;
  promptCount: number;
  lastPromptDate: string | null;
  triggerSmartReengagement: (triggerEvent: string) => void;
  showTutorialModal: boolean;
  setShowTutorialModal: (show: boolean) => void;
}

const PWAContext = createContext<PWAContextType | undefined>(undefined);

// Storage key declarations
const KEYS = {
  INSTALLED: 'dude_pwa_installed',
  SEEN: 'dude_pwa_seen',
  PROMPT_COUNT: 'dude_pwa_prompt_count',
  LAST_PROMPT: 'dude_pwa_last_prompt',
  DISMISSED_UNTIL: 'dude_pwa_dismissed_until',
  INSTALL_SOURCE: 'dude_pwa_install_source',
  ANALYTICS_METRICS: 'dude_pwa_analytics',
};

// Internal Analytics interface
interface PWAAnalytics {
  shows: number;
  dismissals: number;
  clicks: number;
  installations: number;
  tutorialsOpened: number;
  logs: Array<{ event: string; timestamp: number; meta?: any }>;
}

export const PWAProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const dataStore = useDataStore();

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [showInstallPrompt, setShowInstallPrompt] = useState<boolean>(false);
  const [showTutorialModal, setShowTutorialModal] = useState<boolean>(false);
  const [promptCount, setPromptCount] = useState<number>(0);
  const [lastPromptDate, setLastPromptDate] = useState<string | null>(null);

  // Platform detection states
  const [isIOS, setIsIOS] = useState<boolean>(false);
  const [isAndroid, setIsAndroid] = useState<boolean>(false);
  const [isDesktop, setIsDesktop] = useState<boolean>(false);

  // Prevent multiple automated prompts in the same session tab
  const [promptedInSession, setPromptedInSession] = useState<boolean>(false);

  // Initialize analytics structure
  const [analytics, setAnalytics] = useState<PWAAnalytics>(() => {
    try {
      const saved = localStorage.getItem(KEYS.ANALYTICS_METRICS);
      return saved ? JSON.parse(saved) : { shows: 0, dismissals: 0, clicks: 0, installations: 0, tutorialsOpened: 0, logs: [] };
    } catch {
      return { shows: 0, dismissals: 0, clicks: 0, installations: 0, tutorialsOpened: 0, logs: [] };
    }
  });

  // Track event to internal logging system
  const logEvent = (eventName: string, meta?: any) => {
    setAnalytics(prev => {
      const newLogs = [...prev.logs, { event: eventName, timestamp: Date.now(), meta }].slice(-100); // keep last 100
      const updated = {
        ...prev,
        shows: eventName === 'install_banner_shown' ? prev.shows + 1 : prev.shows,
        dismissals: eventName === 'install_banner_dismissed' ? prev.dismissals + 1 : prev.dismissals,
        clicks: eventName === 'install_button_clicked' ? prev.clicks + 1 : prev.clicks,
        installations: eventName === 'install_completed' ? prev.installations + 1 : prev.installations,
        tutorialsOpened: eventName === 'install_tutorial_opened' ? prev.tutorialsOpened + 1 : prev.tutorialsOpened,
        logs: newLogs,
      };
      localStorage.setItem(KEYS.ANALYTICS_METRICS, JSON.stringify(updated));
      return updated;
    });
  };

  // Run initial startup and PWA configuration
  useEffect(() => {
    // 1. Detect environment / standalone mode
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches 
      || (window.navigator as any).standalone === true;

    const savedInstalled = localStorage.getItem(KEYS.INSTALLED) === 'true';
    const finalInstalled = isStandalone || savedInstalled;
    setIsInstalled(finalInstalled);

    if (finalInstalled && !savedInstalled) {
      localStorage.setItem(KEYS.INSTALLED, 'true');
    }

    // 2. Platform recognition
    const ua = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(ua);
    const isAndroidDevice = /android/.test(ua);
    const isDesktopDevice = !isIosDevice && !isAndroidDevice;

    setIsIOS(isIosDevice);
    setIsAndroid(isAndroidDevice);
    setIsDesktop(isDesktopDevice);

    // 3. Load persistent states
    const count = Number(localStorage.getItem(KEYS.PROMPT_COUNT) || '0');
    setPromptCount(count);

    const rawLastDate = localStorage.getItem(KEYS.LAST_PROMPT);
    if (rawLastDate) {
      setLastPromptDate(new Date(Number(rawLastDate)).toLocaleDateString('pt-BR'));
    }

    // 4. Capture native browser setup installers (Android & Chrome Desktop)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      logEvent('beforeinstallprompt_captured');

      // Trigger automatic prompt on FIRST entry if eligible
      const alreadySeen = localStorage.getItem(KEYS.SEEN) === 'true';
      if (!isStandalone && !savedInstalled && !alreadySeen && !promptedInSession) {
        setTimeout(() => {
          showPWAInstallPrompt();
        }, 3000);
      }
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      localStorage.setItem(KEYS.INSTALLED, 'true');
      logEvent('install_completed');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // If first time accessing and iOS (which lacks beforeinstallprompt), schedule high priority prompt
    const alreadySeen = localStorage.getItem(KEYS.SEEN) === 'true';
    if (isIosDevice && !isStandalone && !savedInstalled && !alreadySeen && !promptedInSession) {
      setTimeout(() => {
        showPWAInstallPrompt();
      }, 4000);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [promptedInSession]);

  // Check smart re-engagement conditions whenever sessions or profile changes
  useEffect(() => {
    if (isInstalled) return;

    // A. Check focus session count (>= 3)
    const sessionsLength = dataStore.sessions?.length || 0;
    // B. Check completed activities / habits (>= 5) - we can also check scheduled activities or completed counters
    const habitsLength = dataStore.activities?.length || 0;
    
    // C. Check signup date duration (active 7 or 30 days)
    let usageDays = 0;
    if (dataStore.profile?.created_at) {
      const createdTime = new Date(dataStore.profile.created_at).getTime();
      usageDays = Math.floor((Date.now() - createdTime) / (1000 * 60 * 60 * 24));
    }

    // Evaluate smart triggers
    if (sessionsLength >= 3) {
      triggerSmartReengagement('completed_3_focus_sessions');
    } else if (habitsLength >= 5) {
      triggerSmartReengagement('completed_5_activities');
    } else if (usageDays >= 30) {
      triggerSmartReengagement('active_30_days');
    } else if (usageDays >= 7) {
      triggerSmartReengagement('active_7_days');
    }
  }, [dataStore.sessions?.length, dataStore.activities?.length, dataStore.profile?.created_at, isInstalled]);

  // Command implementation to raise the banner elegant layout
  const showPWAInstallPrompt = () => {
    if (isInstalled) return;

    // Check dismissed timeout frequency limits
    const dismissedUntil = Number(localStorage.getItem(KEYS.DISMISSED_UNTIL) || '0');
    if (dismissedUntil > Date.now()) {
      console.log('PWA Prompt suppressed by anti-spam frequency rules');
      return;
    }

    setShowInstallPrompt(true);
    setPromptedInSession(true);
    localStorage.setItem(KEYS.SEEN, 'true');
    localStorage.setItem(KEYS.LAST_PROMPT, String(Date.now()));
    setLastPromptDate(new Date().toLocaleDateString('pt-BR'));

    logEvent('install_banner_shown');
  };

  const triggerSmartReengagement = (triggerEvent: string) => {
    if (isInstalled) return;
    if (promptedInSession) return; // Prevent duplicate popups in the same window run

    console.log(`Smart Trigger detected: ${triggerEvent}. Elevating PWA install prompt.`);
    // Bypass normal frequency restrictions for important moments, but respect same-session rule
    setShowInstallPrompt(true);
    setPromptedInSession(true);
    localStorage.setItem(KEYS.SEEN, 'true');
    localStorage.setItem(KEYS.LAST_PROMPT, String(Date.now()));
    setLastPromptDate(new Date().toLocaleDateString('pt-BR'));

    logEvent('smart_reengagement_triggered', { trigger: triggerEvent });
  };

  // Handle CTA Click Event
  const installApp = async () => {
    logEvent('install_button_clicked');

    if (deferredPrompt) {
      // 1. Android & Chrome Desktop
      try {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`PWA installation choice resolved: ${outcome}`);
        if (outcome === 'accepted') {
          logEvent('install_accepted');
          setIsInstalled(true);
          localStorage.setItem(KEYS.INSTALLED, 'true');
          setShowInstallPrompt(false);
        } else {
          logEvent('install_rejected');
          // Treat as dismissal
          dismissInstallPrompt();
        }
        setDeferredPrompt(null);
      } catch (err) {
        console.error('PWA installation error:', err);
      }
    } else {
      // 2. Safari iOS & Unsupported browsers - Trigger descriptive visual instructions modal
      logEvent('install_tutorial_opened');
      setShowTutorialModal(true);
      setShowInstallPrompt(false);
    }
  };

  // Implement strict frequency cap on user decline/dismiss action
  const dismissInstallPrompt = () => {
    const nextCount = promptCount + 1;
    setPromptCount(nextCount);
    localStorage.setItem(KEYS.PROMPT_COUNT, String(nextCount));

    // Determine lock duration: 3 days, 7 days, 15 days, 30 days
    let daysToLock = 3;
    if (nextCount === 2) daysToLock = 7;
    else if (nextCount === 3) daysToLock = 15;
    else if (nextCount >= 4) daysToLock = 30;

    const dismissTimeSecs = daysToLock * 24 * 60 * 60 * 1000;
    const dismissedUntilTime = Date.now() + dismissTimeSecs;

    localStorage.setItem(KEYS.DISMISSED_UNTIL, String(dismissedUntilTime));
    setShowInstallPrompt(false);

    logEvent('install_banner_dismissed', { promptCount: nextCount, lockedForDays: daysToLock });
  };

  const canInstall = !isInstalled;

  return (
    <PWAContext.Provider
      value={{
        isInstalled,
        canInstall,
        isIOS,
        isAndroid,
        isDesktop,
        showInstallPrompt,
        installApp,
        dismissInstallPrompt,
        promptCount,
        lastPromptDate,
        triggerSmartReengagement,
        showTutorialModal,
        setShowTutorialModal,
      }}
    >
      {children}
    </PWAContext.Provider>
  );
};

export const usePWA = () => {
  const context = useContext(PWAContext);
  if (context === undefined) {
    throw new Error('usePWA must be used inside a PWAProvider');
  }
  return context;
};
