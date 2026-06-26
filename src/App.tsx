import { useState, useEffect, useRef } from 'react';
import { Target, X, AlertTriangle, Check, Home, ListTodo, Play, BarChart2, Menu as MenuIcon, Zap, Moon } from 'lucide-react';
import { TaskListScreen } from './components/dashboard/TaskListScreen';
import { CinematicBackground } from './components/layout/CinematicBackground';
import { HeroSection } from './components/dashboard/HeroSection';
import { ActiveSession } from './components/dashboard/ActiveSession';
import { ActionCenter } from './components/layout/ActionCenter';
import { motion, AnimatePresence } from 'motion/react';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { SubscriptionGuard } from './components/layout/SubscriptionGuard';
import { useAuthStore } from './store/useAuthStore';
import { useDataStore } from './store/useDataStore';
import { useTimerStore } from './store/useTimerStore';
import { PWAProvider } from './context/PWAContext';
import { QuickCaptureModal } from './components/shared/QuickCaptureModal';
import { ErrorBoundary } from './components/ErrorBoundary';

// Adicione aqui os outros imports (MoodRitualModal, etc) que você já tinha

export default function App() {
  const { user } = useAuthStore();
  const dataStore = useDataStore();
  const [showQuickCapture, setShowQuickCapture] = useState(false);
  const [activeTab, setActiveTab] = useState<'home' | 'listas' | 'session' | 'centro' | 'menu'>('home');
  const [showFullAgenda, setShowFullAgenda] = useState(false);

  // Função crítica que estava faltando e causava erro
  const handleStartSessionFromAgenda = (activity: any) => {
    useTimerStore.getState().setScheduledActivityId(activity.id);
    window.dispatchEvent(new CustomEvent('open-action-center', {
      detail: { screen: 'session', prefill: activity }
    }));
    setActiveTab('session');
  };

  return (
    <ErrorBoundary>
      <ProtectedRoute>
        <SubscriptionGuard>
          <PWAProvider>
            <div className="relative min-h-screen selection:bg-green/30 selection:text-green overflow-x-hidden text-text">
              
              {/* MODAIS GLOBAIS - Mantenha seus Modais aqui */}
              
              <QuickCaptureModal
                isOpen={showQuickCapture}
                onClose={() => setShowQuickCapture(false)}
              />

              <CinematicBackground />
              <ActiveSession />
              <ActionCenter />

              <header className="absolute top-0 left-0 right-0 z-50 px-6 py-6 md:px-12 flex items-center justify-between">
                <button
                  onClick={() => setShowQuickCapture(true)}
                  className="p-2 hover:bg-white/5 rounded-full transition-all cursor-pointer"
                >
                  <Zap size={18} className="text-[#6ee7a8] fill-[#6ee7a8]/15" />
                </button>
                <div className="text-xl font-black tracking-[0.2em] text-white">DUDE</div>
                <div className="w-10"></div> {/* Spacer para centralizar */}
              </header>

              {/* TELA DE TAREFAS - Agora sem props quebrando o build */}
              {activeTab === 'listas' && (
                <TaskListScreen onStartSession={handleStartSessionFromAgenda} />
              )}

              {/* BARRA DE NAVEGAÇÃO - Mantenha igual ao original */}
              <div className="fixed bottom-0 left-0 right-0 z-[300] bg-[#0d0f0e]/85 backdrop-blur-xl border-t border-white/5">
                <div className="max-w-md mx-auto px-6 py-3 flex items-center justify-between">
                   <button onClick={() => setActiveTab('home')} className="flex flex-col items-center text-white"><Home size={20}/>Início</button>
                   <button onClick={() => setActiveTab('listas')} className="flex flex-col items-center text-white"><ListTodo size={20}/>Tarefas</button>
                   <button onClick={() => setActiveTab('session')} className="bg-green p-3 rounded-full"><Play size={20}/></button>
                   <button onClick={() => setActiveTab('centro')} className="flex flex-col items-center text-white"><BarChart2 size={20}/>Centro</button>
                   <button onClick={() => setActiveTab('menu')} className="flex flex-col items-center text-white"><MenuIcon size={20}/>Menu</button>
                </div>
              </div>
            </div>
          </PWAProvider>
        </SubscriptionGuard>
      </ProtectedRoute>
    </ErrorBoundary>
  );
}
