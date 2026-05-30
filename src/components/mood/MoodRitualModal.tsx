import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useDataStore } from '../../store/useDataStore';
import { useAuthStore } from '../../store/useAuthStore';
import { getCurrentPeriodAndDate } from '../../lib/utils';
import { MOOD_LIST, MoodKey } from '../../lib/mood';
import { X, Heart } from 'lucide-react';

export const MoodRitualModal = () => {
  const { user } = useAuthStore();
  const { moodEntries, addMoodEntry, initialFetchDone } = useDataStore();
  const [isOpen, setIsOpen] = useState(false);
  const [currentPeriod, setCurrentPeriod] = useState<'manha' | 'tarde' | 'noite' | null>(null);
  const [currentDate, setCurrentDate] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !initialFetchDone) return;

    const checkMoodRequirement = () => {
      const { period, dateStr } = getCurrentPeriodAndDate(new Date());
      setCurrentPeriod(period);
      setCurrentDate(dateStr);

      const hasAnswered = moodEntries.some(
        m => m.date === dateStr && m.period === period
      );

      setIsOpen(!hasAnswered);
    };

    checkMoodRequirement();

    window.addEventListener('focus', checkMoodRequirement);
    return () => {
      window.removeEventListener('focus', checkMoodRequirement);
    };
  }, [user, moodEntries, initialFetchDone]);

  const handleSelectMood = async (moodKey: MoodKey) => {
    if (!user || !currentDate || !currentPeriod) return;

    await addMoodEntry(user.id, currentDate, currentPeriod, moodKey);
    setIsOpen(false);
  };

  const handleSkip = () => {
    if (!user || !currentDate || !currentPeriod) return;
    
    try {
      localStorage.setItem(`dude-mood-skipped-${currentDate}-${currentPeriod}`, 'true');
    } catch (e) {
      console.error(e);
    }
    setIsOpen(false);
  };

  useEffect(() => {
    if (!user || !initialFetchDone || !isOpen || !currentDate || !currentPeriod) return;

    try {
      const isSkipped = localStorage.getItem(`dude-mood-skipped-${currentDate}-${currentPeriod}`) === 'true';
      if (isSkipped) {
        setIsOpen(false);
      }
    } catch {}
  }, [isOpen, currentDate, currentPeriod, initialFetchDone, user]);

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
            className="absolute top-4 right-4 p-2 text-text-dim/40 hover:text-text hover:bg-white/5 rounded-full transition-colors cursor-pointer"
            title="Pular ritual"
          >
            <X size={16} />
          </button>

          <div className="flex flex-col items-center gap-4 sm:gap-6 relative z-10">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-green/10 flex items-center justify-center text-green shadow-[0_0_20px_rgba(110,231,168,0.15)]">
              <Heart size={18} className="fill-green/10 sm:scale-110" />
            </div>

            <div className="space-y-1.5 sm:space-y-2">
              <span className="text-[9px] sm:text-[10px] font-mono font-bold uppercase tracking-[0.25em] text-green block">
                MOOD RITUAL
              </span>
              <h3 className="text-lg sm:text-2xl font-bold text-text tracking-tight px-2">
                Como você está se sentindo neste período {getPeriodLabel()}?
              </h3>
              <p className="text-[11px] sm:text-xs text-text-dim font-light max-w-sm mx-auto">
                Sintonize o tom do DUDE com o seu estado de espírito atual.
              </p>
            </div>

            <div className="grid grid-cols-5 gap-1.5 sm:gap-3 w-full mt-2 sm:mt-4">
              {MOOD_LIST.map((m) => (
                <button
                  key={m.key}
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
              onClick={handleSkip}
              className="mt-3 sm:mt-4 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-text-dim/40 hover:text-text transition-colors cursor-pointer py-2 px-4 rounded-xl hover:bg-white/5 animate-fade-in"
            >
              Responder mais tarde
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
