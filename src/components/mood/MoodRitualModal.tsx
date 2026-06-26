import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useDataStore } from '../../store/useDataStore';
import { useAuthStore } from '../../store/useAuthStore';
import { MOOD_LIST, MoodKey } from '../../lib/mood';
import { X, Heart } from 'lucide-react';

interface MoodRitualModalProps {
  isOpen: boolean;
  onClose: (wasAnswered?: boolean) => void;
  currentPeriod: 'manha' | 'tarde' | 'noite';
  currentDate: string;
}

export const MoodRitualModal = ({ isOpen, onClose, currentPeriod, currentDate }: MoodRitualModalProps) => {
  const { user } = useAuthStore();
  const { addMoodEntry } = useDataStore();
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedEnergy, setSelectedEnergy] = useState<'pleno' | 'inquieto' | 'equilibrado' | 'fadigado' | 'cansado' | 'normal' | 'energizado' | null>(null);
  const [selectedMood, setSelectedMood] = useState<MoodKey | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setSelectedEnergy(null);
      setSelectedMood(null);
      setIsSaving(false);
    }
  }, [isOpen]);

  const handleSaveEnergy = async (energyKey: any) => {
    if (!user || !currentDate || !currentPeriod || isSaving) return;

    setSelectedEnergy(energyKey);
    setIsSaving(true);
    useDataStore.getState().setCurrentEnergyState(energyKey);
    
    // Immediate clear feedback to the user via notification toast
    const { showNotification } = useDataStore.getState();

    try {
      // Persist the energy entry across the client store and database (passing null for mood)
      await addMoodEntry(user.id, currentDate, currentPeriod, null, energyKey);
      showNotification('Sintonização de energia concluída! ⚡', 'success');
      onClose(true);
    } catch (e) {
      console.error("Erro ao salvar energia:", e);
      showNotification('Erro ao salvar energia. Tente novamente.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSelectMood = async (moodKey: MoodKey) => {
    // Keep this for backwards compatibility if needed elsewhere, but no longer used in UI
    if (!user || !currentDate || !currentPeriod || isSaving) return;

    setSelectedMood(moodKey);
    setIsSaving(true);
    
    const { showNotification } = useDataStore.getState();

    try {
      await addMoodEntry(user.id, currentDate, currentPeriod, moodKey, selectedEnergy);
      showNotification('Sintonização de período concluída! 🌟', 'success');
      onClose(true);
    } catch (e) {
      console.error("Erro ao salvar humor:", e);
      showNotification('Erro ao salvar humor. Tente novamente.', 'error');
    } finally {
      setIsSaving(false);
    }
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
        className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-app-base/80 backdrop-blur-md cursor-pointer"
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
                RITUAL REVEAL
              </span>
              <h3 className="text-lg sm:text-2xl font-bold text-text tracking-tight animate-fade-in">
                Qual o seu nível de energia mental?
              </h3>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full mt-2 sm:mt-4 max-w-2xl mx-auto animate-fade-in">
              {[
                  { key: 'pleno', label: 'Pleno', emoji: '⚡', color: '#34d399', glow: 'rgba(110, 231, 183, 0.4)' },
                  { key: 'inquieto', label: 'Inquieto', emoji: '🌪️', color: '#fbbf24', glow: 'rgba(251, 191, 36, 0.4)' },
                  { key: 'equilibrado', label: 'Equilibrado', emoji: '⚖️', color: '#60a5fa', glow: 'rgba(96, 165, 250, 0.4)' },
                  { key: 'fadigado', label: 'Fadigado', emoji: '🪫', color: '#fb7185', glow: 'rgba(251, 113, 133, 0.4)' }
                ].map((item) => {
                  const isEnergySelected = selectedEnergy === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      disabled={isSaving}
                      onClick={() => handleSaveEnergy(item.key)}
                      className={`group relative flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border transition-all duration-300 transform cursor-pointer min-h-[96px] sm:min-h-[110px] ${
                        isEnergySelected
                          ? '-translate-y-1 shadow-[0_0_20px_var(--selected-glow)] bg-surface-1/95 scale-102 z-20'
                          : 'bg-surface-1/40 hover:bg-surface-1/90 border-border-custom/50 hover:border-border-custom hover:-translate-y-0.5 active:translate-y-0 active:scale-95'
                      }`}
                      style={{
                        '--hover-glow': item.color,
                        '--selected-glow': item.glow,
                        borderColor: isEnergySelected ? item.color : undefined,
                        backgroundColor: isEnergySelected ? `${item.color}25` : undefined,
                        borderWidth: isEnergySelected ? '2px' : '1px',
                      } as React.CSSProperties}
                    >
                      <div
                        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-10 transition-opacity duration-300 pointer-events-none"
                        style={{
                          background: `radial-gradient(circle, ${item.color} 0%, transparent 70%)`
                        }}
                      />

                      {isEnergySelected && (
                        <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-green text-black flex items-center justify-center shadow-[0_0_8px_rgba(110,231,168,0.5)] z-20 scale-100 animate-fade-in animate-duration-150">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3.5} stroke="currentColor" className="w-2.5 h-2.5 text-black">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9.75-9.75" />
                          </svg>
                        </div>
                      )}

                      <span 
                        className={`text-2xl sm:text-3.5xl transition-transform duration-300 ${
                          isEnergySelected ? 'scale-120 filter drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]' : 'group-hover:scale-110'
                        }`}
                        role="img"
                        aria-label={item.label}
                      >
                        {item.emoji}
                      </span>

                      <div className="flex flex-col items-center gap-1 mt-1">
                        <span 
                          className={`w-1.5 h-1.5 rounded-full transition-shadow duration-300 ${
                            isEnergySelected ? 'shadow-[0_0_12px_var(--selected-glow)] scale-125' : 'group-hover:shadow-[0_0_8px_var(--hover-glow)]'
                          }`}
                          style={{ backgroundColor: item.color }}
                        />
                        <span 
                          className={`text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-center leading-tight transition-colors ${
                            isEnergySelected ? 'text-text font-extrabold' : 'text-text-dim group-hover:text-text'
                          }`}
                          style={{
                            color: isEnergySelected ? item.color : undefined
                          }}
                        >
                          {item.label}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            

            <div className="mt-4 flex flex-col sm:flex-row items-center justify-center gap-2.5 sm:gap-4 text-[9px] sm:text-[10px] uppercase tracking-wider font-semibold animate-fade-in text-center">
              <button
                type="button"
                onClick={() => {
                  const snoozedDate = new Date();
                  snoozedDate.setDate(snoozedDate.getDate() + 7);
                  localStorage.setItem('energy_snooze_until', snoozedDate.getTime().toString());
                  useDataStore.getState().showNotification('Adiado por 7 dias. Perguntaremos depois! 📅', 'success');
                  onClose();
                }}
                className="text-text-dim/60 hover:text-text transition-colors cursor-pointer py-1 px-2 rounded-lg hover:bg-white/5"
              >
                Perguntar novamente em 7 dias
              </button>

              <span className="hidden sm:inline text-text-dim/10">|</span>

              <button
                type="button"
                onClick={() => {
                  localStorage.setItem('energy_tracking_disabled', 'true');
                  useDataStore.getState().showNotification('Radar desativado.', 'success');
                  onClose();
                }}
                className="text-[#f87171]/60 hover:text-[#f87171] transition-colors cursor-pointer py-1 px-2 rounded-lg hover:bg-white/5"
              >
                Não quero mais rastrear
              </button>

              <span className="hidden sm:inline text-text-dim/10">|</span>

              <button
                type="button"
                onClick={() => onClose()}
                className="text-text-dim/40 hover:text-text transition-colors cursor-pointer py-1 px-2 rounded-lg hover:bg-white/5"
              >
                Responder mais tarde
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
