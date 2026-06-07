import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { LogIn, UserPlus, Github, Mail } from 'lucide-react';

export const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ 
          email, 
          password,
          options: {
            data: { full_name: fullName }
          }
        });
        if (error) throw error;
        setError("Verifique seu email para confirmar o cadastro.");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({ provider: 'google' });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-base">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md space-y-12"
      >
        <div className="text-center space-y-4 flex flex-col items-center">
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            className="flex flex-col items-center gap-4"
          >
            <img 
              src="/logo-dude-oficial.svg" 
              alt="DUDE Logo Oficial"
              className="w-16 h-16 object-contain"
              referrerPolicy="no-referrer"
            />
            <span className="text-3xl font-black tracking-[0.2em] text-text font-sans select-none">
              DUDE
            </span>
          </motion.div>
          <p className="text-text-dim font-light tracking-wide opacity-60 uppercase text-[10px]">
            Personal Operational System
          </p>
        </div>

        <div className="bg-surface-1 border border-border-custom p-8 md:p-12 rounded-[2.5rem] space-y-8">
          <div className="flex gap-4 border-b border-border-custom pb-6">
            <button 
              onClick={() => setIsLogin(true)}
              className={`pb-2 text-sm font-bold uppercase tracking-widest transition-all ${isLogin ? 'text-green border-b border-green' : 'text-text-dim opacity-40'}`}
            >
              Entrar
            </button>
            <button 
              onClick={() => setIsLogin(false)}
              className={`pb-2 text-sm font-bold uppercase tracking-widest transition-all ${!isLogin ? 'text-green border-b border-green' : 'text-text-dim opacity-40'}`}
            >
              Cadastrar
            </button>
          </div>

          <form onSubmit={handleAuth} className="space-y-6">
            {!isLogin && (
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-text-dim opacity-40 px-1">Nome Completo</label>
                <input 
                  type="text" 
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  enterKeyHint="done"
                  className="w-full bg-surface-2 border border-border-custom rounded-2xl p-4 text-text focus:outline-none focus:border-green/30 transition-all min-h-[44px] touch-manipulation"
                  placeholder="Seu nome"
                  required
                />
              </div>
            )}
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-text-dim opacity-40 px-1">Email</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                enterKeyHint="done"
                className="w-full bg-surface-2 border border-border-custom rounded-2xl p-4 text-text focus:outline-none focus:border-green/30 transition-all min-h-[44px] touch-manipulation"
                placeholder="seu@email.com"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-text-dim opacity-40 px-1">Senha</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                enterKeyHint="done"
                className="w-full bg-surface-2 border border-border-custom rounded-2xl p-4 text-text focus:outline-none focus:border-green/30 transition-all min-h-[44px] touch-manipulation"
                placeholder="••••••••"
                required
              />
            </div>

            <AnimatePresence>
              {error && (
                <motion.p 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="text-coral text-xs px-1"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            <button 
              disabled={loading}
              className="w-full py-5 bg-green text-base rounded-2xl font-bold uppercase tracking-[0.2em] text-xs hover:brightness-105 transition-all shadow-[0_0_30px_rgba(110,231,168,0.1)] min-h-[44px] touch-manipulation"
            >
              {loading ? 'Processando...' : isLogin ? 'Acessar Sistema' : 'Criar Conta'}
            </button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border-custom"></div></div>
            <div className="relative flex justify-center text-[8px] uppercase tracking-[0.4em] text-text-dim opacity-40 font-bold">
              <span className="bg-surface-1 px-4">Ou continue com</span>
            </div>
          </div>

          <button 
            type="button"
            onClick={handleGoogleLogin}
            className="w-full py-4 border border-border-custom rounded-2xl flex items-center justify-center gap-3 text-text text-xs font-bold uppercase tracking-widest hover:bg-surface-2 transition-all min-h-[44px] touch-manipulation"
          >
            <Mail size={16} />
            Google
          </button>
        </div>

        <div className="flex flex-col items-center gap-3 mt-4">
          <img 
            src="/logo-dude-oficial.svg" 
            alt="DUDE Logo"
            className="w-5 h-5 object-contain"
            referrerPolicy="no-referrer"
          />
          <p className="text-center text-[9px] text-text-dimmer/40 font-mono tracking-widest uppercase select-none">
            SYSTEM SECURED BY SUPABASE SHIELD
          </p>
        </div>
      </motion.div>
    </div>
  );
};
