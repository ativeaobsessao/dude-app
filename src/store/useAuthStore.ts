import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { User } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  loading: boolean;
  initialized: boolean;
  setUser: (user: User | null) => void;
  signOut: () => Promise<void>;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  initialized: false,
  setUser: (user) => set({ user, loading: false }),
  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null });
  },
  initialize: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    let currentUser = session?.user ?? null;

    if (currentUser) {
      const intent = localStorage.getItem('oauth_intent');
      if (intent === 'login') {
        const userCreatedAt = new Date(currentUser.created_at).getTime();
        const diffInSeconds = (Date.now() - userCreatedAt) / 1000;
        if (diffInSeconds < 60) {
          await supabase.auth.signOut();
          currentUser = null;
          localStorage.removeItem('oauth_intent');
          localStorage.setItem('auth_block_reason', 'Acesso negado! Identificamos que você ainda não possui conta. Por favor, acesse a aba CADASTRAR e aceite os Termos de Uso para continuar.');
        } else {
          localStorage.removeItem('oauth_intent');
        }
      } else if (intent === 'signup') {
        localStorage.removeItem('oauth_intent');
      }
    }

    set({ user: currentUser, initialized: true, loading: false });

    supabase.auth.onAuthStateChange(async (_event, session) => {
      let currentSessionUser = session?.user ?? null;
      if (currentSessionUser) {
        const intent = localStorage.getItem('oauth_intent');
        if (intent === 'login') {
          const userCreatedAt = new Date(currentSessionUser.created_at).getTime();
          const diffInSeconds = (Date.now() - userCreatedAt) / 1000;
          if (diffInSeconds < 60) {
            await supabase.auth.signOut();
            currentSessionUser = null;
            localStorage.removeItem('oauth_intent');
            localStorage.setItem('auth_block_reason', 'Acesso negado! Identificamos que você ainda não possui conta. Por favor, acesse a aba CADASTRAR e aceite os Termos de Uso para continuar.');
          } else {
            localStorage.removeItem('oauth_intent');
          }
        } else if (intent === 'signup') {
          localStorage.removeItem('oauth_intent');
        }
      }
      set({ user: currentSessionUser, loading: false });
    });
  },
}));
