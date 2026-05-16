import { useState, useEffect } from 'react';
import { Target, X, AlertTriangle } from 'lucide-react';
import { CinematicBackground } from './components/layout/CinematicBackground';
import { HeroSection } from './components/dashboard/HeroSection';
import { ActiveSession } from './components/dashboard/ActiveSession';
import { DailyAwareness } from './components/dashboard/DailyAwareness';
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

import { ErrorBoundary } from './components/ErrorBoundary';

export default function App() {
  const { signOut, user } = useAuthStore();
  const { hasCompletedFirstSession } = useDataStore();
  const [showStats, setShowStats] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);

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
            <div className="w-10 h-10 rounded-full border border-border-white flex items-center justify-center overflow-hidden bg-surface hover:border-primary-green transition-colors cursor-pointer">
              <div className="w-full h-full bg-[radial-gradient(circle_at_center,rgba(110,231,168,0.2)_0%,transparent_70%)]" />
            </div>
          </motion.nav>
        </header>

        <main className="min-h-screen pb-40">
          <HeroSection />

          <div className="max-w-6xl mx-auto px-6 space-y-4 md:space-y-28">
            <section id="operational-zone">
            </section>

            <DailyAwareness />
            
            <div className="flex flex-col space-y-12 md:space-y-28">
              <div className="flex justify-center">
                <button 
                  onClick={() => setShowStats(true)}
                  className="px-16 py-5 bg-primary-green rounded-2xl flex flex-col items-center gap-1 shadow-[0_0_40px_rgba(110,231,168,0.25)] hover:shadow-[0_0_60px_rgba(110,231,168,0.4)] active:scale-95 transition-all duration-300"
                >
                  <span className="text-background text-xl font-bold tracking-tight">Ver Meu Progresso</span>
                  <span className="text-background/60 text-[10px] font-bold uppercase tracking-[0.3em]">Evolução e Métricas Históricas</span>
                </button>
              </div>

              <HabitsSection />
              <RecentNotes />
              <RecentHistory />
              <InspirationalFootnote />
            </div>
          </div>
        </main>

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
