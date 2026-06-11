import React from 'react';
import { ArrowLeft, FileText, AlertTriangle } from 'lucide-react';

interface TermsOfUseProps {
  onBack?: () => void;
}

export const TermsOfUse: React.FC<TermsOfUseProps> = ({ onBack }) => {
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
              <span className="text-green font-bold tracking-wider">DUDE</span> <span className="text-[8px] font-mono opacity-80">TERMOS</span>
            </span>
          </div>
        </div>

        {/* Content Body */}
        <div className="space-y-8">
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-green/10 flex items-center justify-center text-green mb-2">
              <FileText size={22} />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white uppercase font-sans">
              Termos de Uso
            </h1>
            <p className="text-[10px] uppercase tracking-widest font-mono text-green font-bold">
              CONTRATO DE USO E CONDUTA
            </p>
          </div>

          <div className="space-y-6 text-sm text-text-dim leading-relaxed font-sans">
            <p className="text-white font-medium text-[1rem]/[1.5rem]">
              Termos de Uso e Isenção de Responsabilidade. Ao utilizar a DUDE, você concorda em usar o sistema de forma íntegra, sem tentar aplicar engenharia reversa, hackear ou sobrecarregar nossos servidores com robôs.
            </p>

            {/* Health Disclaimer Block */}
            <div className="space-y-4 bg-orange-500/5 border border-orange-500/20 p-6 rounded-3xl mt-8">
              <div className="flex items-center gap-2 text-orange-400">
                <AlertTriangle size={18} />
                <h2 className="text-xs font-extrabold uppercase tracking-widest">
                  Aviso Importante sobre Saúde
                </h2>
              </div>
              <p className="text-xs text-text-dim/90 leading-relaxed">
                A DUDE é uma ferramenta de produtividade, organização e autoconhecimento. Os nossos módulos de rastreamento e o sistema "Anti-Vício" são desenhados para auxiliar na sua disciplina pessoal, mas não substituem, sob nenhuma hipótese, diagnósticos médicos, tratamentos clínicos, aconselhamento psicológico ou terapia profissional. Se você estiver enfrentando dependências severas ou crises de saúde mental, procure ajuda de um profissional de saúde qualificado.
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
