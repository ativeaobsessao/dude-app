import React from 'react';
import { useTrialStatus } from '../../hooks/useTrialStatus';
import { PaywallScreen } from './PaywallScreen';

interface SubscriptionGuardProps {
  children: React.ReactNode;
}

export function SubscriptionGuard({ children }: SubscriptionGuardProps) {
  const { isAuthorized, loading } = useTrialStatus();

  // Durante o carregamento inicial das informações do perfil, renderiza um esqueleto ou spinner minimalista
  if (loading) {
    return (
      <div className="min-h-screen bg-[#070908] flex flex-col items-center justify-center font-sans gap-4">
        <div className="w-10 h-10 border-2 border-green/20 border-t-green rounded-full animate-spin" />
        <span className="text-[10px] font-bold text-text-secondary/50 tracking-widest uppercase font-mono">
          Alinhando Órbita...
        </span>
      </div>
    );
  }

  // Se o período de teste expirou e o usuário não é assinante nem admin, barra o acesso
  if (!isAuthorized) {
    return <PaywallScreen />;
  }

  return <>{children}</>;
}
export default SubscriptionGuard;
