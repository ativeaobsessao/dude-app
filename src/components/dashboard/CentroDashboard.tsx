import React, { useState } from 'react';
import { ArrowLeft, BarChart3, ShieldCheck } from 'lucide-react';
import { PersonalInsightsPanel } from './PersonalInsightsPanel';
import { AutocontroleLab } from './AutocontroleLab';

type CentroSection = 'tempo' | 'autocontrole';

export const CentroDashboard: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [section, setSection] = useState<CentroSection>('tempo');

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-28 pt-2 sm:px-6">
      <header className="mb-6">
        <button type="button" onClick={onClose} className="mb-5 inline-flex items-center gap-2 rounded-lg px-2 py-2 text-xs font-medium text-zinc-500 transition-colors hover:bg-white/[0.04] hover:text-white">
          <ArrowLeft size={14} /> Voltar
        </button>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-200/70">Centro</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">Seu painel de evolução</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">Uma leitura dos seus registros para entender seu tempo, seus hábitos e os comportamentos que deseja transformar.</p>
          </div>
        </div>
      </header>

      <nav aria-label="Áreas de análise" className="mb-6 grid grid-cols-2 gap-2 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-1.5">
        <button
          type="button"
          onClick={() => setSection('tempo')}
          aria-pressed={section === 'tempo'}
          className={`flex min-h-[54px] items-center justify-center gap-2 rounded-xl px-3 py-3 text-xs font-semibold transition-all ${section === 'tempo' ? 'bg-white text-zinc-950 shadow-sm' : 'text-zinc-400 hover:text-white'}`}
        >
          <BarChart3 size={16} /> Seu tempo
        </button>
        <button
          type="button"
          onClick={() => setSection('autocontrole')}
          aria-pressed={section === 'autocontrole'}
          className={`flex min-h-[54px] items-center justify-center gap-2 rounded-xl px-3 py-3 text-xs font-semibold transition-all ${section === 'autocontrole' ? 'bg-white text-zinc-950 shadow-sm' : 'text-zinc-400 hover:text-white'}`}
        >
          <ShieldCheck size={16} /> Autocontrole
        </button>
      </nav>

      {section === 'tempo' ? <PersonalInsightsPanel /> : <AutocontroleLab />}

      <footer className="mt-8 border-t border-white/[0.06] pt-4 text-center">
        <p className="text-[10px] leading-relaxed text-zinc-600">As análises são pessoais, transparentes e baseadas nos dados que você registra.</p>
      </footer>
    </div>
  );
};
