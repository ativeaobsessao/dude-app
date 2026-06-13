import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ShieldCheck, Heart, Sparkles, AlertTriangle, ArrowRight, CheckCircle2, Crown, Zap, Lock } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useDataStore } from '../../store/useDataStore';

export function PaywallScreen() {
  const { signOut, user } = useAuthStore();
  const { profile, updateProfileData } = useDataStore();
  const [loading, setLoading] = useState(false);

  const keyBenefits = [
    { title: "Rastreador de Hábitos & Evitações", desc: "Monitore com análises de neurociência." },
    { title: "Sincronização Nuvem & Dispositivos", desc: "Acesse em qualquer lugar sem perder um único hábito." },
    { title: "Dashboard de Bio-Ritmo Avançado", desc: "Veja a correlação entre energia, humor e produtividade." },
    { title: "Segurança de Criptografia Total", desc: "Seus dados sensíveis blindados no seu dispositivo." },
  ];

  // Simulação funcional de ativação de assinatura para testes/homologação
  const handleSimulateSubscription = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Atualiza o estado no Supabase para inscrito com sucesso
      await updateProfileData(user.id, { 
        // @ts-ignore
        is_subscribed: true 
      } as any);
      
      // Força recarregamento parcial ou feedback
      window.location.reload();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070908] text-text flex items-center justify-center p-6 font-sans relative overflow-hidden selection:bg-green/30 selection:text-green">
      {/* Detalhes de Background Premium */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle_at_center,rgba(110,231,168,0.06)_0%,transparent_70%)] blur-[80px] pointer-events-none" />
      <div className="absolute top-10 left-10 w-40 h-40 rounded-full bg-emerald-500/5 blur-[50px] pointer-events-none animate-pulse" />

      <div className="w-full max-w-xl bg-[#0d100e]/90 border border-white/5 shadow-2xl rounded-[2.5rem] p-8 md:p-12 backdrop-blur-xl relative z-10 space-y-8">
        
        {/* Header do Paywall */}
        <div className="space-y-4 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-green/10 border border-green/20 text-green mx-auto">
            <Crown size={14} className="animate-pulse" />
            <span className="text-[10px] font-black tracking-[0.15em] uppercase font-mono">ASSINATURA PREMIUM</span>
          </div>

          <div className="space-y-2">
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tighter text-white font-sans">
              O seu período de testes expirou
            </h1>
            <p className="text-sm text-text-secondary/80 max-w-md mx-auto leading-relaxed">
              Inicie agora sua jornada permanente sem interrupções com a DUDE. Seu histórico e dados estão em segurança, esperando por você.
            </p>
          </div>
        </div>

        {/* Card do Preço/Oferta */}
        <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 relative overflow-hidden flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
          <div className="absolute top-0 right-0 w-32 h-32 bg-green/5 blur-[40px] pointer-events-none" stroke-width="0"/>
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest font-mono">Plano Anual Vitalício</span>
            <h3 className="text-2xl font-black text-white">DUDE Lifetime Pro</h3>
            <p className="text-xs text-text-secondary/70">Acesso ilimitado e definitivo sem mensalidades.</p>
          </div>
          <div className="text-left sm:text-right">
            <div className="flex items-baseline gap-1">
              <span className="text-xs text-text-secondary font-mono">BRL</span>
              <span className="text-3xl font-black text-green tracking-tight">R$ 97</span>
              <span className="text-[10px] text-text-secondary font-mono">/único</span>
            </div>
            <p className="text-[9px] text-[#6e7572] font-mono mt-0.5">Sem taxa de renovação</p>
          </div>
        </div>

        {/* Benefícios Key */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {keyBenefits.map((b, i) => (
            <div key={i} className="flex gap-3 hover:bg-white/[0.01] p-2 rounded-xl transition-colors">
              <div className="w-5 h-5 rounded bg-green/10 flex items-center justify-center shrink-0 mt-0.5 text-green">
                <CheckCircle2 size={13} strokeWidth={3} />
              </div>
              <div className="space-y-0.5 text-left">
                <h4 className="text-xs font-bold text-white tracking-tight">{b.title}</h4>
                <p className="text-[10px] text-text-secondary/60 leading-normal">{b.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Ações */}
        <div className="space-y-3.5 pt-4">
          <button
            onClick={handleSimulateSubscription}
            disabled={loading}
            className="w-full py-4 bg-green hover:brightness-110 active:scale-95 disabled:opacity-50 disabled:scale-100 text-background rounded-2xl font-extrabold uppercase tracking-widest text-[11px] transition-all cursor-pointer shadow-[0_8px_30px_rgba(110,231,168,0.25)] flex items-center justify-center gap-2"
          >
            {loading ? 'Processando...' : 'Liberar Meu Acesso Permanente'}
            <ArrowRight size={14} strokeWidth={2.5} />
          </button>

          <div className="flex items-center justify-between gap-4 px-2">
            <button
              onClick={() => signOut()}
              className="text-[10px] font-bold text-rose-400 hover:text-rose-300 uppercase tracking-widest transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Lock size={12} />
              Sair da Conta
            </button>
            <span className="text-[9px] text-text-secondary/40 font-mono">Versão V2.1.0 • SecOps Shield</span>
          </div>
        </div>

      </div>
    </div>
  );
}
