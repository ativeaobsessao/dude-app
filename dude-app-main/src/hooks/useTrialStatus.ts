import { useMemo } from 'react';
import { useDataStore } from '../store/useDataStore';

export interface TrialStatus {
  trialEndsAt: string | null;
  isSubscribed: boolean;
  isAdmin: boolean;
  daysLeft: number;
  isTrialExpired: boolean;
  isAuthorized: boolean;
  loading: boolean;
}

export function useTrialStatus(): TrialStatus {
  const { profile, initialFetchDone } = useDataStore();

  return useMemo(() => {
    // Se ainda não carregou o perfil, consideramos autorizado provisoriamente para evitar flashing
    if (!initialFetchDone || !profile) {
      return {
        trialEndsAt: null,
        isSubscribed: false,
        isAdmin: false,
        daysLeft: 21,
        isTrialExpired: false,
        isAuthorized: true,
        loading: true,
      };
    }

    const trialEndsAt = profile.trial_ends_at || null;
    const isSubscribed = !!profile.is_subscribed;
    const isAdmin = !!profile.is_admin;

    if (isAdmin || isSubscribed) {
      return {
        trialEndsAt,
        isSubscribed,
        isAdmin,
        daysLeft: 9999,
        isTrialExpired: false,
        isAuthorized: true,
        loading: false,
      };
    }

    if (!trialEndsAt) {
      // Se por algum motivo o trial_ends_at não existir no banco ainda, assumimos 21 dias para segurança
      return {
        trialEndsAt,
        isSubscribed,
        isAdmin,
        daysLeft: 21,
        isTrialExpired: false,
        isAuthorized: true,
        loading: false,
      };
    }

    const trialDate = new Date(trialEndsAt);
    const now = new Date();
    
    // Calcula a diferença em milissegundos
    const diffMs = trialDate.getTime() - now.getTime();
    
    // Converte para dias (arredondando para cima para mostrar "X dias restantes")
    const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    const isTrialExpired = daysLeft <= 0;

    return {
      trialEndsAt,
      isSubscribed,
      isAdmin,
      daysLeft: isTrialExpired ? 0 : daysLeft,
      isTrialExpired,
      // É autorizado se for admin, se for assinante ou se o período de teste ainda for ativo
      isAuthorized: isAdmin || isSubscribed || !isTrialExpired,
      loading: false,
    };
  }, [profile, initialFetchDone]);
}
