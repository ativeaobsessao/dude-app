import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useDataStore } from '../../store/useDataStore';
import { useAuthStore } from '../../store/useAuthStore';
import { MOOD_LIST, MoodKey } from '../../lib/mood';
import { X, Heart } from 'lucide-react';

interface MoodRitualModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPeriod: 'manha' | 'tarde' | 'noite';
  currentDate: string;
}

export const MoodRitualModal = ({ isOpen, onClose, currentPeriod, currentDate }: MoodRitualModalProps) => {
  const { user } = useAuthStore();
  const { addMoodEntry } = useDataStore();
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedEnergy, setSelectedEnergy] = useState<'cansado' | 'normal' | 'energizado' | null>(null);

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setSelectedEnergy(null);
    }
  }, [isOpen]);

  const handleSelectMood = async (moodKey: MoodKey) => {
    if (!user || !currentDate || !currentPeriod) return;

    await addMoodEntry(user.id, currentDate, currentPeriod, moodKey, selectedEnergy);
    onClose();
  };

  const handleSkip = () => {
    if (!user || !currentDate || !currentPeriod) return;
    
    try {
      localStorage.setItem(`dude-mood-skipped-${currentDate}-${currentPeriod}`, 'true');
    } catch (e) {
      console.error(e);
    }
    onClose();
  };

  const getPeriodLabel = () => {
    if (currentPeriod === 'manha') return 'da manhã';
    if (currentPeriod === 'tarde') return 'da tarde';
    return 'da noite';
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div 
        onClick={handleSkip}
        className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-base/80 backdrop-blur-md cursor-pointer"
      >
        <motion.div
          onClick={(e) => e.stopPropagation()}
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-surface-2/95 border border-border-custom p-6 sm:p-10 shadow-2xl text-center cursor-default"
        >
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full blur-[80px] bg-green/10 pointer-events-none" />

          <button
            onClick={handleSkip}
            className="absolute top-4 right-4 p-2 text-text-dim/40 hover:text-text hover:bg-white/5 rounded-full transition-colors cursor-pointer animate-fade-in"
            title="Pular ritual"
          >
            <X size={16} />
          </button>

          <div className="flex flex-col items-center gap-4 sm:gap-6 relative z-10 w-full">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-green/10 flex items-center justify-center text-green shadow-[0_0_20px_rgba(110,231,168,0.15)] shrink-0">
              <Heart size={18} className="fill-green/10 sm:scale-110" />
            </div>

            <div className="space-y-1.5 sm:space-y-2 w-full px-2">
              <span className="text-[9px] sm:text-[10px] font-mono font-bold uppercase tracking-[0.25em] text-green block">
                {step === 1 ? 'RITUAL REVEAL: PASSO 1 DE 2' : 'RITUAL REVEAL: PASSO 2 DE 2'}
              </span>
              <h3 className="text-lg sm:text-2xl font-bold text-text tracking-tight animate-fade-in">
                {step === 1 
                  ? `Como está sua energia mental neste período ${getPeriodLabel()}?` 
                  : `E como você está se sentindo neste período ${getPeriodLabel()}?`
                }
              </h3>
              <p className="text-[11px] sm:text-xs text-text-dim font-light max-w-sm mx-auto animate-fade-in leading-relaxed">
                {step === 1 
                  ? "Seu 'combustível' pra focar agora — independente de como está seu humor." 
                  : "Sintonize seu humor com o DUDE para calcular insights de produtividade."
                }
              </p>
            </div>

            {step === 1 ? (
              // Step 1: Energy Axes
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full mt-2 sm:mt-4 max-w-md mx-auto animate-fade-in">
                {[
                  { key: 'cansado', label: 'Cansado mentalmente', emoji: '🥱', color: '#fb7185' },
                  { key: 'normal', label: 'Normal', emoji: '😐', color: '#fbbf24' },
                  { key: 'energizado', label: 'Energizado', emoji: '⚡', color: '#34d399' }
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      setSelectedEnergy(item.key as any);
                      setStep(2);
                    }}
                    className="group relative flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-surface-1/40 hover:bg-surface-1/90 border border-border-custom/50 hover:border-border-custom transition-all duration-300 transform hover:-translate-y-0.5 active:translate-y-0 active:scale-95 cursor-pointer min-h-[96px] sm:min-h-[110px]"
                    style={{
                      '--hover-glow': item.color
                    } as React.CSSProperties}
                  >
                    <div
                      className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-10 transition-opacity duration-300 pointer-events-none"
                      style={{
                        background: `radial-gradient(circle, ${item.color} 0%, transparent 70%)`
                      }}
                    />

                    <span 
                      className="text-2xl sm:text-3.5xl transition-transform duration-300 group-hover:scale-110"
                      role="img"
                      aria-label={item.label}
                    >
                      {item.emoji}
                    </span>

                    <div className="flex flex-col items-center gap-1 mt-1">
                      <span 
                        className="w-1.5 h-1.5 rounded-full transition-shadow duration-300 group-hover:shadow-[0_0_8px_var(--hover-glow)]"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-text-dim group-hover:text-text transition-colors text-center leading-tight">
                        {item.label}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              // Step 2: Mood Axes
              <div className="w-full mt-2 sm:mt-4 max-w-lg mx-auto animate-fade-in flex flex-col items-center gap-4">
                <div className="grid grid-cols-5 gap-1.5 sm:gap-3 w-full">
                  {MOOD_LIST.map((m) => (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => handleSelectMood(m.key)}
                      className="group relative flex flex-col items-center gap-1.5 sm:gap-2.5 p-2 sm:p-4 rounded-xl sm:rounded-2xl bg-surface-1/40 hover:bg-surface-1/90 border border-border-custom/50 hover:border-border-custom transition-all duration-300 transform hover:-translate-y-0.5 active:translate-y-0 active:scale-95 cursor-pointer min-h-[72px] sm:min-h-0"
                      style={{
                        '--hover-glow': m.color
                      } as React.CSSProperties}
                    >
                      <div
                        className="absolute inset-0 rounded-xl sm:rounded-2xl opacity-0 group-hover:opacity-10 transition-opacity duration-300 pointer-events-none"
                        style={{
                          background: `radial-gradient(circle, ${m.color} 0%, transparent 70%)`
                        }}
                      />

                      <span 
                        className="text-xl sm:text-2xl transition-transform duration-300 group-hover:scale-110"
                        role="img"
                        aria-label={m.label}
                      >
                        {m.emoji}
                      </span>

                      <div className="flex flex-col items-center gap-1 sm:gap-1.5 mt-0.5 sm:mt-1">
                        <span 
                          className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full transition-shadow duration-300 group-hover:shadow-[0_0_8px_var(--hover-glow)]"
                          style={{ backgroundColor: m.color }}
                        />
                        <span className="text-[8px] sm:text-[10px] font-bold uppercase tracking-wider text-text-dim group-hover:text-text transition-colors text-center leading-tight">
                          {m.label}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-[10px] font-mono font-bold text-green/60 hover:text-green tracking-wider uppercase transition-colors shrink-0 bg-white/[0.02] border border-white/5 py-1.5 px-3 rounded-lg"
                >
                  ← Voltar para Energia
                </button>
              </div>
            )}

            <button
              onClick={handleSkip}
              className="mt-2 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-text-dim/40 hover:text-text transition-colors cursor-pointer py-2 px-4 rounded-xl hover:bg-white/5 animate-fade-in"
            >
              Responder mais tarde
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
