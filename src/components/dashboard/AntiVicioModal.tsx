import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useDataStore } from '../../store/useDataStore';
import { UrgeSurfingProtocol } from './UrgeSurfingProtocol';

interface AntiVicioModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDeepSessionContext?: boolean;
  initialHabitId?: string;
  associatedCheckinId?: string;
  isVictoryMode?: boolean;
}

export const AntiVicioModal = ({ isOpen, onClose, initialHabitId, associatedCheckinId, isVictoryMode = false }: AntiVicioModalProps) => {
  const dataStore = useDataStore();
  const { habits } = dataStore;
  
  const avoidHabits = habits.filter(h => h.habit_mode === 'avoid');
  
  const [selectedHabitId, setSelectedHabitId] = useState<string>(
    initialHabitId || (avoidHabits.length > 0 ? avoidHabits[0].id : '')
  );
  
  const [note, setNote] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (initialHabitId) {
        setSelectedHabitId(initialHabitId);
      } else if (avoidHabits.length > 0) {
        setSelectedHabitId(avoidHabits[0].id);
      }
      setNote('');
    }
  }, [isOpen, initialHabitId]);

  if (!isOpen) return null;

  if (!isVictoryMode) {
    return (
      <UrgeSurfingProtocol 
        key={selectedHabitId || 'general'} 
        habitId={selectedHabitId || (avoidHabits.length > 0 ? avoidHabits[0].id : undefined)} 
        onClose={onClose} 
      />
    );
  }

  const currentHabitName = habits.find(h => h.id === selectedHabitId)?.name || 'este vício';

  const triggers = [
    { value: 'Fome/Sede', label: 'FOME/SEDE' },
    { value: 'Raiva/Estresse', label: 'RAIVA/ESTRESSE' },
    { value: 'Solidão/Tédio', label: 'SOLIDÃO/TÉDIO' },
    { value: 'Cansaço/Exaustão', label: 'CANSAÇO/EXAUSTÃO' },
    { value: 'Ambiente/Gatilho', label: 'AMBIENTE / GATILHO VISUAL' },
    { value: 'Impulso do Nada', label: 'IMPULSO ESPONTÂNEO' },
  ];

  const handleTriggerClick = async (triggerValue: string) => {
    if (isUpdating) return;
    setIsUpdating(true);
    
    if (associatedCheckinId) {
      await dataStore.updateAvoidanceCheckin(associatedCheckinId, {
        trigger_tag: triggerValue,
        trigger_note: note.trim() || null
      });
    }
    
    setIsUpdating(false);
    onClose();
  };

  const handleNoTrigger = async () => {
    if (isUpdating) return;
    setIsUpdating(true);
    
    if (associatedCheckinId) {
      await dataStore.updateAvoidanceCheckin(associatedCheckinId, {
        trigger_tag: 'none',
        trigger_note: note.trim() || null
      });
    }
    
    setIsUpdating(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[1000] flex flex-col justify-end font-sans">
      {/* Backdrop overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 transition-opacity"
      />

      {/* Bottom Sheet */}
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="relative w-full bg-black/90 backdrop-blur-xl rounded-t-3xl border-t border-white/10 p-6 md:p-8 flex flex-col z-10 max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex flex-col space-y-4 mb-6 items-center text-center">
          <div className="relative w-24 h-24 mb-2">
            <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 144 144">
              <circle cx="72" cy="72" r="64" className="text-emerald-500/10" strokeWidth="8" stroke="currentColor" fill="transparent" />
              <motion.circle 
                initial={{ strokeDashoffset: 402 }}
                animate={{ strokeDashoffset: 0 }}
                transition={{ duration: 1.5, ease: "easeOut" }}
                cx="72" cy="72" r="64" className="text-emerald-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.5)]" 
                strokeWidth="8" strokeDasharray="402" strokeLinecap="round" stroke="currentColor" fill="transparent" 
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.span 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 1, type: "spring" }}
                className="text-4xl"
              >
                🏆
              </motion.span>
            </div>
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-emerald-300 tracking-tight">
            VONTADE SURFADA!
          </h2>
          <div className="flex items-center gap-2">
            <p className="text-sm text-gray-400 font-light max-w-xs mx-auto">
              Nessa janela de monitoramento de {currentHabitName}, teve alguma crise de impulsividade? Se sim, marque a opção que melhor descreva:
            </p>
          </div>
        </div>

        {/* Textarea Fixo */}
        <div className="mb-4">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="O que passou pela sua mente? (Opcional)"
            className="w-full min-h-[80px] bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-white/25 resize-none transition-colors"
          />
        </div>

        {/* O Caminho Feliz (Ação Principal) */}
        <button
          onClick={handleNoTrigger}
          disabled={isUpdating}
          className="w-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 py-4 rounded-2xl font-bold uppercase tracking-wide hover:bg-emerald-500/20 active:scale-[0.98] transition-all mb-6 disabled:opacity-50"
        >
          A vontade não apareceu hoje
        </button>

        {/* Triggers Grid */}
        <div className="w-full">
          <p className="text-xs text-gray-500 font-medium mb-3 uppercase tracking-wider text-left">
            Se teve crise, selecione o gatilho:
          </p>
          <div className="grid grid-cols-2 gap-3 mb-2">
            {triggers.map((trigger) => (
              <button
                key={trigger.value}
                onClick={() => handleTriggerClick(trigger.value)}
                disabled={isUpdating}
                className="flex items-center justify-center px-4 py-3.5 bg-white/5 border border-white/10 rounded-2xl text-[11px] sm:text-xs font-semibold text-gray-300 hover:bg-white/10 active:bg-white/15 hover:border-white/20 transition-all cursor-pointer text-center disabled:opacity-50"
              >
                {trigger.label}
              </button>
            ))}
          </div>
        </div>

      </motion.div>
    </div>
  );
};
