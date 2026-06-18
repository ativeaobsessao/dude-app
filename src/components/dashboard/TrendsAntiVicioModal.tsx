import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useDataStore } from '../../store/useDataStore';
import { 
  X, Target, Brain, Compass, Clock, Smile, Sparkles, Activity, ShieldCheck, ShieldAlert 
} from 'lucide-react';

interface TrendsAntiVicioModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TrendsAntiVicioModal: React.FC<TrendsAntiVicioModalProps> = ({ isOpen, onClose }) => {
  const { avoidanceCheckins, moodEntries, habits } = useDataStore();

  // 1. Math Aggregation with Fallbacks & Safety Checks
  const relapses = useMemo(() => {
    return avoidanceCheckins.filter(c => c.status === 'relapse' || c.status === 'recai');
  }, [avoidanceCheckins]);

  const trends = useMemo(() => {
    if (relapses.length === 0) {
      return {
        totalRelapses: 0,
        topTrigger: 'Nenhuma recaída registrada ainda',
        topPeriod: 'Sem dados suficientes',
        topMood: 'Estável (Equilibrado)',
        topEnergy: 'Energia Estável ⚡',
        neuroPill: 'Excelente início. Continue mantendo o controle total dos seus focos e use o cronômetro SOS quando os impulsos surgirem para reescrever seus caminhos neurais sem fricção.'
      };
    }

    const totalRelapses = relapses.length;

    // Top Trigger Tag calculation
    const triggerCounts: { [key: string]: number } = {};
    relapses.forEach(c => {
      const tag = c.trigger_tag || 'Gatilho Desconhecido';
      triggerCounts[tag] = (triggerCounts[tag] || 0) + 1;
    });
    
    let topTrigger = 'Gatilho Desconhecido';
    let maxTriggerCount = 0;
    Object.entries(triggerCounts).forEach(([tag, count]) => {
      if (count > maxTriggerCount) {
        maxTriggerCount = count;
        topTrigger = tag;
      }
    });

    // Top Period of Day
    const periodCounts = { manha: 0, tarde: 0, noite: 0 };
    relapses.forEach(c => {
      let hr = 15; // default afternoon fallback
      if (c.created_at) {
        const d = new Date(c.created_at);
        if (!isNaN(d.getTime())) {
          hr = d.getHours();
        }
      }
      if (hr >= 5 && hr < 12) periodCounts.manha++;
      else if (hr >= 12 && hr < 18) periodCounts.tarde++;
      else periodCounts.noite++;
    });

    let topPeriod = 'Tarde ☀️';
    const maxPeriodCount = Math.max(periodCounts.manha, periodCounts.tarde, periodCounts.noite);
    if (maxPeriodCount === periodCounts.manha) topPeriod = 'Manhã 🌅';
    else if (maxPeriodCount === periodCounts.noite) topPeriod = 'Noite 🌙';

    // Correlate check-in dates with Mood Entries
    const relapseMoods: string[] = [];
    const relapseEnergies: string[] = [];

    relapses.forEach(c => {
      const relapseDay = c.checkin_date ? c.checkin_date.split('T')[0] : '';
      const dayMoodEntries = moodEntries.filter(m => m.date === relapseDay);
      dayMoodEntries.forEach(m => {
        if (m.mood) relapseMoods.push(m.mood);
        if (m.energy) relapseEnergies.push(m.energy);
      });
    });

    // Top Mood State during relapses
    const moodCounts: { [key: string]: number } = {};
    relapseMoods.forEach(m => {
      moodCounts[m] = (moodCounts[m] || 0) + 1;
    });
    let topMoodKey = '';
    let maxMoodCount = 0;
    Object.entries(moodCounts).forEach(([m, count]) => {
      if (count > maxMoodCount) {
        maxMoodCount = count;
        topMoodKey = m;
      }
    });

    const moodMap = {
      animado: 'Euforia / Impulsividade ⚡',
      tranquilo: 'Excesso de Conforto 🍃',
      neutro: 'Tédio / Distração Passiva 🥱',
      ansioso: 'Ansiedade / Estresse Extremo 🤯',
      prabaixo: 'Melancolia / Desânimo 😴'
    };
    const topMood = topMoodKey ? (moodMap[topMoodKey as keyof typeof moodMap] || 'Instável') : 'Tédio ou Sensibilidade Emocional 🧠';

    // Top Physical Energy during relapses
    const energyCounts: { [key: string]: number } = {};
    relapseEnergies.forEach(e => {
      energyCounts[e] = (energyCounts[e] || 0) + 1;
    });
    let topEnergyKey = '';
    let maxEnergyCount = 0;
    Object.entries(energyCounts).forEach(([e, count]) => {
      if (count > maxEnergyCount) {
        maxEnergyCount = count;
        topEnergyKey = e;
      }
    });

    const energyMap = {
      cansado: 'Esgotamento Mental (Fadiga) 🥱',
      normal: 'Homeostase Estável ⚡',
      energizado: 'Alta Voltagem (Tensão) 🔥'
    };
    const topEnergy = topEnergyKey ? (energyMap[topEnergyKey as keyof typeof energyMap] || 'Estável') : 'Fadiga Mental / Cansaço Ativo 🔋';

    // Hardcoded Neuroscience Pills dynamically mapped from topTrigger
    const triggerClean = topTrigger.replace(/[^a-zA-Z0-9À-ÿ\s]/g, '').trim().toLowerCase();
    let neuroPill = '';
    if (triggerClean.includes('impulso') || triggerClean.includes('subito')) {
      neuroPill = 'Seu córtex pré-frontal leva até 10 minutos para frear a liberação impulsiva de dopamina no estriado. Use a regra dos 10 minutos: coloque barreiras físicas imediatas (afaste o celular, apague abas de distração) e ative o cronômetro SOS. A onda passa quando o pico de liberação decai.';
    } else if (triggerClean.includes('ansiedade') || triggerClean.includes('estresse')) {
      neuroPill = 'A amígdala sequestra sua modulação racional sob estresse crônico. Execute a Respiração Quadrada por 2 minutos (inspire por 4s, retenha por 4s, expire por 4s, prenda livre por 4s) para estimular imediatamente o nervo vago e desarmar a tensão nervosa e a busca de fuga digital.';
    } else if (triggerClean.includes('tedio') || triggerClean.includes('inatividade')) {
      neuroPill = 'A carência súbita de estímulos perturba a rede cerebral padrão (DMN). Interrompa a inércia injetando fricção benigna de 2 minutos (organize uma gaveta física, alongue seus ombros, respire fundo ao sol). Isso redireciona a intenção executiva antes que o hábito automático ganhe tração.';
    } else if (triggerClean.includes('fadiga') || triggerClean.includes('exaustao') || triggerClean.includes('sono')) {
      neuroPill = 'O esvaziamento das reservas glicogênicas reduz a integridade da sua tomada de decisões executivas em até 80%. Não negocie com sua bioquímica cansada. Mude de ambiente imediato, priorize 15 minutos de descanso sem telas ou tome água fria para redefinir o acúmulo de adenosina cortical.';
    } else if (triggerClean.includes('ambiental') || triggerClean.includes('contexto')) {
      neuroPill = 'Sua rede cerebral de atenção involuntária reage mais rápido do que sua disciplina racional. O design ambiental previne o esforço. Mantenha os estimulantes fora do campo de resposta mecânica natural. Fora de visão física significa fora do foco cerebral compulsivo.';
    } else {
      neuroPill = 'O autocontrole é uma barreira metabolicamente cara para o organismo. Prevenir requer fricção prévia e rotas claras de desvio de urgências. Lembre-se, o vício celular nunca é apagado completamente da memória neuronal — ele é substituído ativamente por comportamentos substitutos.';
    }

    return {
      totalRelapses,
      topTrigger,
      topPeriod,
      topMood,
      topEnergy,
      neuroPill
    };
  }, [relapses, moodEntries]);

  // Extract Avoidance check-ins that have notes for Section 3 (Ghost Quotes)
  const battlesWithNotes = useMemo(() => {
    return avoidanceCheckins
      .filter(c => c.trigger_note && c.trigger_note.trim() !== '')
      .sort((a, b) => {
        const timeA = new Date(a.created_at || a.checkin_date).getTime();
        const timeB = new Date(b.created_at || b.checkin_date).getTime();
        return timeB - timeA;
      });
  }, [avoidanceCheckins]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md select-none font-sans overflow-hidden">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ duration: 0.22 }}
          className="bg-[#0b0e11] border border-white/[0.08] w-full max-w-3xl rounded-[32px] p-6 md:p-8 relative overflow-hidden flex flex-col max-h-[88vh] text-left shadow-2xl"
        >
          {/* Subtle Ambient Color Gradients inside Modal (Frameless layout style) */}
          <div className="absolute top-0 right-0 w-44 h-44 bg-red-500/5 blur-3xl rounded-full pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-44 h-44 bg-blue-500/5 blur-3xl rounded-full pointer-events-none" />

          {/* Header */}
          <div className="flex items-start justify-between pb-6 border-b border-white/[0.06] shrink-0">
            <div className="flex items-center gap-3.5 text-left">
              <div className="w-11 h-11 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
                <Target size={22} className="animate-pulse" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-red-500 block">Neurociência Aplicada</span>
                </div>
                <h3 className="text-xl font-bold text-text-primary tracking-tight font-sans">
                  Diagnóstico Trends Anti-Vício
                </h3>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 sm:p-2.5 rounded-full bg-white/5 border border-white/10 hover:border-white/20 text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
            >
              <X size={15} />
            </button>
          </div>

          {/* Scrollable Frame Content */}
          <div className="flex-1 overflow-y-auto py-6 pr-1 space-y-9 max-h-[70vh] scrollbar-thin scrollbar-thumb-white/10">
            
            {/* SECTION 1: PREDICTIVE INSIGHTS */}
            <div className="space-y-4 text-left">
              <h4 className="text-xs font-bold text-text-secondary/50 uppercase tracking-[0.22em] font-sans">
                Seção 1 · Parâmetros e Padrões de Risco
              </h4>
              <p className="text-xs text-text-secondary/60 font-light leading-relaxed max-w-xl">
                Suas escolhas mapeadas de forma objetiva. Abaixo está o cruzamento estatístico que correlaciona seus momentos de fraqueza à sua biometria mental de humor recente.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
                {/* Metric Item 1 */}
                <div className="space-y-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-text-secondary/40 flex items-center gap-1.5">
                    <Target size={12} className="text-red-400" /> Gatilho Emocional de Alto Risco
                  </span>
                  <div className="text-sm font-semibold text-text-primary tracking-tight">
                    {trends.topTrigger}
                  </div>
                </div>

                {/* Metric Item 2 */}
                <div className="space-y-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-text-secondary/40 flex items-center gap-1.5">
                    <Clock size={12} className="text-red-400" /> Janela Diária de Vulnerabilidade
                  </span>
                  <div className="text-sm font-semibold text-text-primary tracking-tight">
                    {trends.topPeriod}
                  </div>
                </div>

                {/* Metric Item 3 */}
                <div className="space-y-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-text-secondary/40 flex items-center gap-1.5">
                    <Smile size={12} className="text-red-400" /> Humor Correlato do Tropeço
                  </span>
                  <div className="text-sm font-semibold text-text-primary tracking-tight">
                    {trends.topMood}
                  </div>
                </div>

                {/* Metric Item 4 */}
                <div className="space-y-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-text-secondary/40 flex items-center gap-1.5">
                    <Activity size={12} className="text-red-400" /> Nível Biológico Recorrente
                  </span>
                  <div className="text-sm font-semibold text-text-primary tracking-tight">
                    {trends.topEnergy}
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 2: NEUROSCIENCE PILL */}
            <div className="space-y-4 text-left pt-2 border-t border-white/[0.04]">
              <h4 className="text-xs font-bold text-text-secondary/50 uppercase tracking-[0.22em] font-sans flex items-center gap-1.5">
                <Brain size={14} className="text-[#6ee7a8]" /> Seção 2 · Pílula de Direcionamento Neural
              </h4>
              <div className="rounded-2xl bg-gradient-to-br from-[#6ee7a8]/[0.04] to-transparent border border-[#6ee7a8]/10 p-5 space-y-2 select-text">
                <div className="text-[10px] font-mono font-bold tracking-widest text-[#6ee7a8] uppercase">
                  Anatomia Do Hábito: {trends.topTrigger.replace(/[^a-zA-ZÀ-ÿ\s]/g, '')}
                </div>
                <p className="text-xs md:text-[13px] text-text-primary/90 font-light leading-relaxed">
                  {trends.neuroPill}
                </p>
              </div>
            </div>

            {/* SECTION 3: HISTORY OF BATTLES (GHOST QUOTES) */}
            <div className="space-y-4 text-left pt-2 border-t border-white/[0.04]">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-bold text-text-secondary/50 uppercase tracking-[0.22em] font-sans">
                  Seção 3 · Registros de Campo (Ghost Quotes)
                </h4>
                <span className="text-[10px] font-mono text-text-secondary/40">
                  {battlesWithNotes.length} anotações
                </span>
              </div>
              
              {battlesWithNotes.length > 0 ? (
                <div className="space-y-6 pt-1 select-text">
                  {battlesWithNotes.map((battle) => {
                    const dateStr = new Date(battle.created_at || battle.checkin_date).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: 'short'
                    });
                    const isSuccess = battle.status === 'success' || battle.status === 'resisti';

                    return (
                      <div key={battle.id} className="group flex items-start gap-4 transition-all pb-3 select-text">
                        {/* Status Minimal indicator */}
                        <div className="pt-1 shrink-0">
                          {isSuccess ? (
                            <div className="w-5 h-5 rounded-full bg-emerald-500/[0.05] border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                              <ShieldCheck size={12} />
                            </div>
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-red-500/[0.05] border border-red-500/20 flex items-center justify-center text-red-400">
                              <ShieldAlert size={12} />
                            </div>
                          )}
                        </div>

                        {/* Ghost quote text frame */}
                        <div className="space-y-1.5 flex-1 border-b border-white/[0.02] pb-4 select-text">
                          <div className="flex items-center gap-2 select-none">
                            <span className="text-[9px] font-mono uppercase tracking-wider text-text-secondary/40 font-bold block">
                              {dateStr}
                            </span>
                            <span className="text-[10px] font-mono text-white/20 select-none">•</span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 border border-white/5 text-text-secondary/50 text-[9px] font-semibold">
                              {battle.trigger_tag || 'Gatilho Geral'}
                            </span>
                            <span className="text-[10px] font-mono text-white/20 select-none">•</span>
                            <span className={`text-[9px] font-bold uppercase tracking-[0.1em] ${isSuccess ? 'text-emerald-400/80' : 'text-red-400/80'}`}>
                              {isSuccess ? 'Resistiu' : 'Recaiu'}
                            </span>
                          </div>
                          
                          <p className="text-xs md:text-sm text-text-secondary/80 font-light italic leading-relaxed pl-1 border-l-2 border-white/5 select-text">
                            "{battle.trigger_note}"
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-text-secondary/40 italic select-none">
                  Nenhuma reflexão de autoconsciência registrada ultimamente. Da próxima vez, anote suas reflexões no final do SOS.
                </div>
              )}
            </div>

          </div>

          {/* Action Footer */}
          <div className="pt-6 border-t border-white/[0.06] flex items-center justify-end shrink-0 gap-3">
            <button
              onClick={onClose}
              className="py-3 px-6 rounded-2xl bg-white/5 border border-white/10 hover:border-white/15 text-text-primary text-xs font-black uppercase tracking-wider transition-all duration-200 active:scale-[0.98] cursor-pointer"
            >
              Concluir Análise
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
