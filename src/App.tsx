import { useState, useEffect } from 'react';
import { Zap } from 'lucide-react';

// Imports dos componentes (mantenha os caminhos como estavam no seu original)
import { ErrorBoundary } from './components/ErrorBoundary';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { SubscriptionGuard } from './components/layout/SubscriptionGuard';
import { PWAProvider } from './context/PWAContext';
import { QuickCaptureModal } from './components/shared/QuickCaptureModal';
import { TaskListScreen } from './components/dashboard/TaskListScreen';
import { CinematicBackground } from './components/layout/CinematicBackground';
import { PWAInstallPrompt } from './components/layout/PWAInstallPrompt';
import { ActiveSession } from './components/dashboard/ActiveSession';
import { ActionCenter } from './components/layout/ActionCenter';
import { MoodRitualModal } from './components/mood/MoodRitualModal';
import { DailyShutdownModal } from './components/dashboard/DailyShutdownModal';
import { ReagendarModal, ReconfigurarModal } from './components/agenda/SchedulePopups';

export default function App() {
  const [showQuickCapture, setShowQuickCapture] = useState(false);
  const [activeTab, setActiveTab] = useState<'home' | 'listas' | 'session' | 'centro' | 'menu'>('home');

  const handleStartSessionFromAgenda = () => {
    setActiveTab('session');
  };

  return (
    <ErrorBoundary>
      <ProtectedRoute>
        <SubscriptionGuard>
          <PWAProvider>
            <div className="relative min-h-screen selection:bg-green/30 selection:text-green overflow-x-hidden text-text">
              
              {/* MODAIS GLOBAIS */}
              <MoodRitualModal />
              <DailyShutdownModal />
              <ReagendarModal />
              <ReconfigurarModal />
              
              {/* MODAL DE CAPTURA SEGURA */}
              <QuickCaptureModal
                isOpen={showQuickCapture}
                onClose={() => setShowQuickCapture(false)}
              />

              <CinematicBackground />
              <PWAInstallPrompt />
              <ActiveSession />
              <ActionCenter />

              <header className="absolute top-0 left-0 right-0 z-50 px-6 py-6 md:px-12 flex items-center justify-between">
                <button
                  id="quick-capture-trigger-btn"
                  onClick={() => setShowQuickCapture(true)}
                  className="p-2 hover:bg-white/5 rounded-full transition-all cursor-pointer"
                >
                  <Zap size={18} className="text-[#6ee7a8] fill-[#6ee7a8]/15" />
                </button>
              </header>

              {/* TELA DE TAREFAS */}
              {activeTab === 'listas' && (
                <TaskListScreen 
                  onStartSession={handleStartSessionFromAgenda}
                />
              )}
            </div>
          </PWAProvider>
        </SubscriptionGuard>
      </ProtectedRoute>
    </ErrorBoundary>
  );
}
