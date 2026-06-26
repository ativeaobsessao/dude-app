import React, { useState } from 'react';
// Mantenha seus outros imports originais
import { QuickCaptureModal } from './components/shared/QuickCaptureModal';
import { TaskListScreen } from './components/dashboard/TaskListScreen';
import { Zap } from 'lucide-react';

export const App: React.FC = () => {
  // 1. Estado essencial para o Modal Global
  const [showQuickCapture, setShowQuickCapture] = useState(false);
  
  // ... (seus outros estados, ex: activeTab, handleStartSessionFromAgenda)

  return (
    <ErrorBoundary>
      <ProtectedRoute>
        <SubscriptionGuard>
          <PWAProvider>
            <div className="relative min-h-screen selection:bg-green/30 selection:text-green overflow-x-hidden text-text">
              
              {/* MODAIS GLOBAIS - Agora isolados fora da árvore da TaskList */}
              <MoodRitualModal />
              <DailyShutdownModal />
              <ReagendarModal />
              <ReconfigurarModal />
              
              {/* O PORTAL DE CAPTURA SEGURA (Z-Index 600 garante prioridade máxima) */}
              <QuickCaptureModal
                isOpen={showQuickCapture}
                onClose={() => setShowQuickCapture(false)}
              />

              <CinematicBackground />
              <PWAInstallPrompt />
              <ActiveSession />
              <ActionCenter />

              <header className="absolute top-0 left-0 right-0 z-50 px-6 py-6 md:px-12 flex items-center justify-between">
                {/* Gatilho disparado de forma independente */}
                <button
                  id="quick-capture-trigger-btn"
                  onClick={() => setShowQuickCapture(true)}
                  className="p-2 hover:bg-white/5 rounded-full transition-all cursor-pointer"
                >
                  <Zap size={18} className="text-[#6ee7a8] fill-[#6ee7a8]/15" />
                </button>
              </header>

              {/* TELA DE TAREFAS - Limpa e otimizada */}
              {activeTab === 'listas' && (
                <TaskListScreen 
                  onStartSession={handleStartSessionFromAgenda}
                />
              )}

              {/* ... resto do seu layout ... */}
            </div>
          </PWAProvider>
        </SubscriptionGuard>
      </ProtectedRoute>
    </ErrorBoundary>
  );
};
