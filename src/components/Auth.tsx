import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { LogIn, UserPlus, Github, Mail } from 'lucide-react';

export const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
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
        const firstName = fullName.trim().split(/\s+/)[0];
        const { error } = await supabase.auth.signUp({ 
          email, 
          password,
          options: {
            data: { full_name: firstName }
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
    if (!isLogin && !acceptedTerms) {
      setError("Por favor, confirme que leu e concorda com os termos de uso e política de privacidade antes de continuar.");
      return;
    }
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
            className="flex flex-col items-center justify-center font-sans select-none"
          >
            <span className="text-[#F3F4F6] text-5xl font-bold tracking-[0.2em]">
              DUDE
            </span>
          </motion.div>
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
                <label className="text-[10px] font-bold uppercase tracking-widest text-text-dim opacity-40 px-1">Seu Primeiro Nome</label>
                <input 
                  type="text" 
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  enterKeyHint="done"
                  className="w-full bg-surface-2 border border-border-custom rounded-2xl p-4 text-text focus:outline-none focus:border-green/30 transition-all min-h-[44px] touch-manipulation"
                  placeholder="Ex: Gus"
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

            {!isLogin && (
              <div className="flex items-start gap-3 px-1 py-1">
                <input
                  type="checkbox"
                  id="acceptedTerms"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="mt-1 accent-green h-4 w-4 rounded border-border-custom bg-surface-2 focus:ring-green cursor-pointer"
                  required
                />
                <label htmlFor="acceptedTerms" className="text-[11px] text-text-dim leading-relaxed cursor-pointer select-none">
                  Li e concordo com os{' '}
                  <a href="/termos" target="_blank" rel="noopener noreferrer" className="text-green hover:underline font-bold">
                    Termos de Uso
                  </a>{' '}
                  e a{' '}
                  <a href="/privacidade" target="_blank" rel="noopener noreferrer" className="text-green hover:underline font-bold">
                    Política de Privacidade
                  </a>.
                </label>
              </div>
            )}

            <button 
              disabled={loading || (!isLogin && !acceptedTerms)}
              className={`w-full py-5 rounded-2xl font-bold uppercase tracking-[0.2em] text-[10px] sm:text-xs transition-all min-h-[44px] touch-manipulation flex items-center justify-center gap-2 ${
                loading || (!isLogin && !acceptedTerms)
                  ? 'bg-green/20 text-text/30 opacity-40 cursor-not-allowed shadow-none'
                  : 'bg-green text-background hover:brightness-105 shadow-[0_0_30px_rgba(110,231,168,0.1)]'
              }`}
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
          <p className="text-center text-[9px] text-text-dimmer/40 font-mono tracking-widest uppercase select-none">
            SYSTEM SECURED BY SUPABASE SHIELD
          </p>
        </div>
      </motion.div>
    </div>
  );
};
