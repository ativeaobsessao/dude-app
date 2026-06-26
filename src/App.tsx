import React, { useState } from 'react';
// Mantenha aqui todos os seus imports originais que você já tinha (ErrorBoundary, PWAProvider, etc.)
import { QuickCaptureModal } from './components/shared/QuickCaptureModal';
import { TaskListScreen } from './components/dashboard/TaskListScreen';
import { Zap } from 'lucide-react';

// Certifique-se de que todos os outros componentes (MoodRitualModal, etc) estão importados acima

function App() {
  const [showQuickCapture, setShowQuickCapture] = useState(false);
  
  // Mantenha aqui seus estados originais (activeTab, handleStartSessionFromAgenda, etc)
  // Certifique-se de que 'activeTab' e 'handleStartSessionFromAgenda' existam neste escopo

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
              
              {/* PORTAL DE CAPTURA */}
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

// ESTA É A LINHA QUE CORRIGE O ERRO DE BUILD
export default App;
