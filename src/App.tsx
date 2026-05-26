import { useState, useEffect } from 'react';
import { Target, X, AlertTriangle, Check } from 'lucide-react';
import { CinematicBackground } from './components/layout/CinematicBackground';
import { HeroSection } from './components/dashboard/HeroSection';
import { ActiveSession } from './components/dashboard/ActiveSession';
import { HabitsSection } from './components/dashboard/HabitsSection';
import { RecentNotes } from './components/dashboard/RecentNotes';
import { RecentHistory } from './components/dashboard/RecentHistory';
import { InspirationalFootnote } from './components/dashboard/InspirationalFootnote';
import { ActionCenter } from './components/layout/ActionCenter';
import { motion, AnimatePresence } from 'motion/react';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { ProgressStats } from './components/dashboard/ProgressStats';
import { useAuthStore } from './store/useAuthStore';
import { useDataStore } from './store/useDataStore';
import { useTimerStore } from './store/useTimerStore';

import { ErrorBoundary } from './components/ErrorBoundary';

// Agenda Integration
import { AgendaHoje } from './components/agenda/AgendaHoje';
import { ProximasAtividades } from './components/agenda/ProximasAtividades';
import { AgendaCompletaPage } from './components/agenda/AgendaCompletaPage';

export default function App() {
  const { signOut, user } = useAuthStore();
  const { hasCompletedFirstSession, profile, notification } = useDataStore();
  const [showStats, setShowStats] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [showFullAgenda, setShowFullAgenda] = useState(false);

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
    window.addEventListener('navigate-to-agenda', handleNavigate);
    return () => window.removeEventListener('navigate-to-agenda', handleNavigate);
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

  return (
    <ErrorBoundary>
      <ProtectedRoute>
        <div className="relative min-h-screen selection:bg-primary-green/30 selection:text-primary-green overflow-x-hidden text-text-primary">
        <CinematicBackground />
        <ActiveSession />
        <ActionCenter />

        <AnimatePresence>
          {notification && (
            <motion.div
              layout={false}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 pointer-events-none z-[9999] flex items-center justify-center p-6 md:items-start md:pt-[100px] md:justify-center"
            >
              <div className="mx-auto px-6 py-4 rounded-2xl bg-surface/90 border border-white/15 backdrop-blur-md shadow-[0_10px_40px_rgba(0,0,0,0.5)] flex items-center gap-3 text-text-primary pointer-events-auto max-w-sm md:max-w-md">
                {notification.type === 'success' ? (
                  <div className="w-5 h-5 rounded-full bg-primary-green/20 flex items-center justify-center text-primary-green flex-shrink-0 animate-pulse">
                    <Check size={12} strokeWidth={3} />
                  </div>
                ) : (
                  <div className="w-5 h-5 rounded-full bg-red-400/20 flex items-center justify-center text-red-100 flex-shrink-0 animate-pulse">
                    <AlertTriangle size={12} strokeWidth={3} />
                  </div>
                )}
                <span className="text-xs font-bold uppercase tracking-widest text-[#E2E8F0]">{notification.message}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showStats && <ProgressStats onClose={() => setShowStats(false)} />}
        </AnimatePresence>

        <AnimatePresence>
          {showSignOutConfirm && (
            <motion.div 
              layout={false}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-background/80 backdrop-blur-md"
            >
              <motion.div 
                layout={false}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="w-full max-w-sm bg-surface border border-border-white rounded-3xl p-10 flex flex-col items-center gap-6 text-center shadow-2xl"
              >
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-text-primary tracking-tight">
                    Sair do DUDE?
                  </h3>
                  <p className="text-text-secondary font-light text-sm">
                    Tem certeza que deseja sair?
                  </p>
                </div>
                <div className="flex flex-col w-full gap-3">
                  <button
                    onClick={() => signOut()}
                    className="w-full py-4 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-2xl font-bold uppercase tracking-widest text-[10px] transition-all"
                  >
                    Sim, sair
                  </button>
                  <button
                    onClick={() => setShowSignOutConfirm(false)}
                    className="w-full py-4 border border-primary-green/30 text-primary-green rounded-2xl font-bold uppercase tracking-widest text-[10px] hover:bg-primary-green/10 transition-all"
                  >
                    Cancelar
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <header className="fixed top-0 left-0 right-0 z-50 px-6 py-6 md:px-12 flex justify-between items-center">
          <motion.div 
            layout={false}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-xl font-bold tracking-tighter text-text-primary cursor-default"
          >
            DUDE <span className="text-primary-green">.</span>
          </motion.div>
          
          <motion.nav 
            layout={false}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-8"
          >
            <button 
              onClick={() => setShowSignOutConfirm(true)}
              className="text-[10px] font-bold uppercase tracking-widest text-text-secondary/40 hover:text-red-400 transition-colors"
            >
              Sair
            </button>
            <div className="w-10 h-10 rounded-full border border-border-white overflow-hidden hover:border-primary-green transition-colors cursor-pointer">
              {profile?.avatar_url ? (
                <img 
                  src={profile.avatar_url} 
                  alt="Avatar"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full bg-[radial-gradient(circle_at_center,rgba(110,231,168,0.2)_0%,transparent_70%)] flex items-center justify-center text-primary-green font-bold text-sm">
                  {profile?.full_name?.charAt(0).toUpperCase() || '?'}
                </div>
              )}
            </div>
          </motion.nav>
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
          <main className="min-h-screen pb-40 flex flex-col items-center">
            <HeroSection />

            <div className="w-full max-w-6xl mx-auto px-6 space-y-12 md:space-y-24 flex flex-col items-center">
              
              {/* AGENDA HOJE & ATIVIDADES PROGRAMADAS */}
              <div className="w-full space-y-12">
                <AgendaHoje 
                  onStartSession={handleStartSessionFromAgenda}
                  onOpenNewSchedule={handleOpenNewSchedule}
                />
                <ProximasAtividades
                  onStartSession={handleStartSessionFromAgenda}
                  onOpenNewSchedule={handleOpenNewSchedule}
                  onNavigateToFullAgenda={() => setShowFullAgenda(true)}
                />
              </div>

              {/* 5. Headlines com opacity-40 */}
              <div id="middle-headlines" className="w-full max-w-4xl mx-auto text-center opacity-40 select-none py-6">
              <h3 className="font-semibold tracking-[-0.04em] leading-tight text-text-primary mb-2 text-center text-2xl md:text-3xl">
                Tenha Controle Total Sobre Seu Tempo
              </h3>
              <p className="text-[10px] md:text-xs text-text-secondary font-light text-center uppercase tracking-[0.2em] leading-relaxed">
                Com a DUDE você controla o seu presente, registra o seu passado — otimizando ao máximo o seu tempo.
              </p>
            </div>

            {/* 6. Botão "VER MEU PROGRESSO" */}
            <div className="flex justify-center w-full">
              <button 
                onClick={() => setShowStats(true)}
                className="px-16 py-5 bg-primary-green rounded-2xl flex flex-col items-center gap-1 shadow-[0_0_40px_rgba(110,231,168,0.25)] hover:shadow-[0_0_60px_rgba(110,231,168,0.4)] active:scale-95 transition-all duration-300"
              >
                <span className="text-background text-xl font-bold tracking-tight">Ver Meu Progresso</span>
                <span className="text-background/60 text-[10px] font-bold uppercase tracking-[0.3em]">Evolução e Métricas Históricas</span>
              </button>
            </div>

            {/* 7. Seção Hábitos Atômicos */}
            <HabitsSection />

            {/* 8. Seção Anotações */}
            <RecentNotes />

            {/* 9. Seção Histórico Recente */}
            <RecentHistory />

            {/* 10. Headlines com opacity-40 novamente no rodapé */}
            <div id="footer-headlines" className="w-full max-w-4xl mx-auto text-center opacity-40 select-none pt-12 border-t border-white/5">
              <h3 className="font-semibold tracking-[-0.04em] leading-tight text-text-primary mb-2 text-center text-2xl md:text-3xl">
                Tenha Controle Total Sobre Seu Tempo
              </h3>
              <p className="text-[10px] md:text-xs text-text-secondary font-light text-center uppercase tracking-[0.2em] leading-relaxed">
                Com a DUDE você controla o seu presente, registra o seu passado — otimizando ao máximo o seu tempo.
              </p>
            </div>

            <InspirationalFootnote />
          </div>
        </main>
      )}

        <footer className="w-full py-12 border-t border-border-white/5 flex flex-col items-center gap-4">
          <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-text-secondary">
            Premium Personal Evolution System
          </div>
          <div className="text-[8px] text-text-secondary/40 font-mono">
            Build v2.0.0 — Powered by Supabase
          </div>
        </footer>
      </div>
    </ProtectedRoute>
  </ErrorBoundary>
);
}
