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
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#050505]">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md space-y-12"
      >
        <div className="text-center space-y-4">
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            className="text-4xl font-bold tracking-tighter text-text-primary"
          >
            DUDE <span className="text-primary-green">.</span>
          </motion.div>
          <p className="text-text-secondary font-light tracking-wide opacity-60 uppercase text-[10px]">
            Personal Operational System
          </p>
        </div>

        <div className="bg-surface border border-white/5 p-8 md:p-12 rounded-[2.5rem] space-y-8">
          <div className="flex gap-4 border-b border-white/5 pb-6">
            <button 
              onClick={() => setIsLogin(true)}
              className={`pb-2 text-sm font-bold uppercase tracking-widest transition-all ${isLogin ? 'text-primary-green border-b border-primary-green' : 'text-text-secondary opacity-40'}`}
            >
              Entrar
            </button>
            <button 
              onClick={() => setIsLogin(false)}
              className={`pb-2 text-sm font-bold uppercase tracking-widest transition-all ${!isLogin ? 'text-primary-green border-b border-primary-green' : 'text-text-secondary opacity-40'}`}
            >
              Cadastrar
            </button>
          </div>

          <form onSubmit={handleAuth} className="space-y-6">
            {!isLogin && (
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-text-secondary opacity-40 px-1">Nome Completo</label>
                <input 
                  type="text" 
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  enterKeyHint="done"
                  className="w-full bg-white/5 border border-white/5 rounded-2xl p-4 text-text-primary focus:outline-none focus:border-primary-green/30 transition-all min-h-[44px] touch-manipulation"
                  placeholder="Seu nome"
                  required
                />
              </div>
            )}
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-text-secondary opacity-40 px-1">Email</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                enterKeyHint="done"
                className="w-full bg-white/5 border border-white/5 rounded-2xl p-4 text-text-primary focus:outline-none focus:border-primary-green/30 transition-all min-h-[44px] touch-manipulation"
                placeholder="seu@email.com"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-text-secondary opacity-40 px-1">Senha</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                enterKeyHint="done"
                className="w-full bg-white/5 border border-white/5 rounded-2xl p-4 text-text-primary focus:outline-none focus:border-primary-green/30 transition-all min-h-[44px] touch-manipulation"
                placeholder="••••••••"
                required
              />
            </div>

            <AnimatePresence>
              {error && (
                <motion.p 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="text-red-400 text-xs px-1"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            <button 
              disabled={loading}
              className="w-full py-5 bg-primary-green text-background rounded-2xl font-bold uppercase tracking-[0.2em] text-xs hover:bg-glow-green transition-all shadow-[0_0_30px_rgba(110,231,168,0.1)] min-h-[44px] touch-manipulation"
            >
              {loading ? 'Processando...' : isLogin ? 'Acessar Sistema' : 'Criar Conta'}
            </button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5"></div></div>
            <div className="relative flex justify-center text-[8px] uppercase tracking-[0.4em] text-text-secondary opacity-40 font-bold">
              <span className="bg-[#121212] px-4">Ou continue com</span>
            </div>
          </div>

          <button 
            type="button"
            onClick={handleGoogleLogin}
            className="w-full py-4 border border-white/5 rounded-2xl flex items-center justify-center gap-3 text-text-primary text-xs font-bold uppercase tracking-widest hover:bg-white/5 transition-all min-h-[44px] touch-manipulation"
          >
            <Mail size={16} />
            Google
          </button>
        </div>

        <p className="text-center text-[9px] text-text-secondary/30 font-mono tracking-widest">
          SYSTEM SECURED BY SUPABASE SHIELD
        </p>
      </motion.div>
    </div>
  );
};
