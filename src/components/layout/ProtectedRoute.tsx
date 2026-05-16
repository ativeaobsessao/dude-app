import React, { useEffect } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { useDataStore } from '../../store/useDataStore';
import { Auth } from '../Auth';

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading, initialized, initialize } = useAuthStore();
  const { fetchData, fetchProfile } = useDataStore();

  useEffect(() => {
    if (!initialized) {
      initialize();
    }
  }, [initialized, initialize]);

  useEffect(() => {
    if (user) {
      fetchProfile(user.id);
      fetchData(user.id);
    }
  }, [user, fetchData, fetchProfile]);

  if (loading || !initialized) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="text-2xl font-bold tracking-tighter text-text-primary">DUDE</div>
          <div className="w-48 h-px bg-white/10" />
          <div className="text-[10px] text-primary-green/40 uppercase tracking-[0.5em] font-bold">Iniciando...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  return <>{children}</>;
};
