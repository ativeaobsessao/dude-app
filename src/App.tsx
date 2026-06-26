import { useState, useEffect, useRef } from 'react';
// ... (mantenha todos os seus imports originais)
// Adicionei apenas o QuickCaptureModal que já estava no seu projeto
import { QuickCaptureModal } from './components/shared/QuickCaptureModal';

// ... (todo o resto do seu código original até o return)

  return (
    <ErrorBoundary>
      <ProtectedRoute>
        <SubscriptionGuard>
          <PWAProvider>
            <div className="relative min-h-screen selection:bg-green/30 selection:text-green overflow-x-hidden text-text">
              {/* MODAIS E OVERLAYS GLOBAIS */}
              <MoodRitualModal ... />
              <DailyShutdownModal ... />
              <ReagendarModal ... />
              <ReconfigurarModal ... />
              
              {/* O PORTAL DE CAPTURA SEGURA (Integrado ao botão Zap) */}
              <QuickCaptureModal
                isOpen={showQuickCapture}
                onClose={() => setShowQuickCapture(false)}
              />

              <CinematicBackground />
              <PWAInstallPrompt />
              <ActiveSession />
              <ActionCenter />
              
              {/* ... resto do seu App.tsx (notificações, modais, etc) ... */}

              <header className="absolute top-0 left-0 right-0 z-50 px-6 py-6 md:px-12 flex items-center justify-between">
                {/* O BOTÃO ZAP ABRE O MODAL SEM TOCAR NA TELA DE TAREFAS */}
                <button
                  id="quick-capture-trigger-btn"
                  onClick={() => setShowQuickCapture(true)}
                  className="..."
                >
                  <Zap size={18} className="text-[#6ee7a8] fill-[#6ee7a8]/15" />
                </button>
                {/* ... resto do seu header ... */}
              </header>

              {/* TELA DE TAREFAS (Restaurada, sem o InboxCaptures dentro) */}
              {activeTab === 'listas' && (
                <TaskListScreen 
                  tasks={[]}
                  onTasksChange={() => {}}
                  onStartSession={handleStartSessionFromAgenda}
                />
              )}
              
              {/* ... resto do seu App.tsx ... */}
            </div>
          </PWAProvider>
        </SubscriptionGuard>
      </ProtectedRoute>
    </ErrorBoundary>
  );
}
