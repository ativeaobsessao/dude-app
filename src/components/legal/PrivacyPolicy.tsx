import React from 'react';
import { ArrowLeft, Shield } from 'lucide-react';

interface PrivacyPolicyProps {
  onBack?: () => void;
}

export const PrivacyPolicy: React.FC<PrivacyPolicyProps> = ({ onBack }) => {
  return (
    <div className="min-h-screen bg-base text-text py-12 px-6 flex flex-col items-center">
      <div className="w-full max-w-2xl space-y-12">
        {/* Header Navigation */}
        <div className="flex items-center justify-between border-b border-white/5 pb-6">
          <button
            onClick={onBack ? onBack : () => {
              window.history.pushState({}, '', '/');
              window.dispatchEvent(new Event('popstate'));
            }}
            className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-text-dim hover:text-green transition-colors cursor-pointer group"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
            Voltar
          </button>
          <div className="flex items-center gap-1.5 select-none">
            <span className="text-[11px] tracking-widest uppercase text-text-dim/80">
              <span className="text-green font-bold tracking-wider">DUDE</span> <span className="text-[8px] font-mono opacity-80">JURÍDICO</span>
            </span>
          </div>
        </div>

        {/* Content Body */}
        <div className="space-y-8">
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-green/10 flex items-center justify-center text-green mb-2">
              <Shield size={22} />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white uppercase font-sans">
              Política de Privacidade
            </h1>
            <p className="text-[10px] uppercase tracking-widest font-mono text-green font-bold">
              CONFORMIDADE LGPD & GDPR
            </p>
          </div>

          <div className="space-y-6 text-sm text-text-dim leading-relaxed font-sans">
            <p className="text-white font-medium text-[1rem]/[1.5rem]">
              A nossa promessa é simples: os seus dados são seus. Nós construímos a DUDE para ser a sua ferramenta definitiva de controle de hábitos e foco, não para vender a sua intimidade. Este documento explica de forma clara e sem letras miúdas como tratamos as suas informações e quais são as regras do jogo.
            </p>

            <div className="space-y-3 bg-surface-1/50 border border-border-custom p-6 rounded-3xl mt-8">
              <h2 className="text-xs font-bold uppercase tracking-widest text-[#6EE7B7]">
                O que nós coletamos (e por quê)
              </h2>
              <p className="text-xs text-text-dim">
                Para que a DUDE funcione e entregue as métricas que você precisa, nós armazenamos:
              </p>
              <ul className="list-none space-y-3 pl-1 text-[13px]">
                <li className="flex items-start gap-2">
                  <span className="text-green select-none font-bold mt-0.5">•</span>
                  <span>
                    <strong className="text-white">Dados de Conta:</strong> Seu nome e e-mail. Usamos isso exclusivamente para autenticar o seu login com segurança e enviar comunicações vitais sobre a sua conta.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green select-none font-bold mt-0.5">•</span>
                  <span>
                    <strong className="text-white">Dados de Uso:</strong> Seus registros de hábitos, sessões de foco, variações de humor e histórico do sistema anti-vício.
                  </span>
                </li>
              </ul>
            </div>

            <div className="space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-widest text-[#6EE7B7] mt-8">
                Com quem compartilhamos
              </h2>
              <p className="text-[13px] text-text-dim leading-relaxed">
                Com ninguém. Nós não vendemos, não alugamos e não compartilhamos a sua base de dados com anunciantes, redes sociais ou corretores de dados. A DUDE utiliza a infraestrutura do Supabase com criptografia de ponta a ponta e políticas de segurança em nível de linha (RLS).
              </p>
            </div>

            <div className="space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-widest text-[#6EE7B7] mt-8">
                Os seus direitos (LGPD e GDPR)
              </h2>
              <p className="text-[13px] text-text-dim leading-relaxed">
                Você está no controle absoluto. A qualquer momento, você pode Acessar e Exportar seus dados, ou exercer o Direito ao Esquecimento usando a função de exclusão de conta dentro da DUDE (protocolo de "Terra Arrasada").
              </p>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="border-t border-white/5 pt-8 text-center">
          <p className="text-[9px] text-[#6a7570] font-mono tracking-widest uppercase">
            Última atualização: Junho de 2026
          </p>
        </div>
      </div>
    </div>
  );
};
