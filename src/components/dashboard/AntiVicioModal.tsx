import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
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

  const [showNote, setShowNote] = useState(false);
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
      setShowNote(false);
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

  const triggers = [
    { value: 'stress', label: '🤯 Estresse / Ansiedade' },
    { value: 'boredom', label: '🥱 Tédio / Inatividade' },
    { value: 'exhaustion', label: '🪫 Cansaço / Exaustão' },
    { value: 'sadness', label: '😔 Tristeza / Frustração' },
    { value: 'environment', label: '📍 Ambiente / Pessoas' },
    { value: 'random', label: '⚡ Impulso do Nada' },
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
        className="relative w-full bg-black/90 backdrop-blur-xl rounded-t-3xl border-t border-white/10 p-6 md:p-8 flex flex-col z-10"
      >
        {/* Header */}
        <div className="flex flex-col space-y-2 mb-6">
          <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
            Vitória Registrada! 🏆
          </h2>
          <div className="flex items-center gap-2">
            <p className="text-sm text-gray-400 font-light">
              A vontade apareceu durante a jornada? Identifique a causa:
            </p>
            <button 
              onClick={() => setShowNote(!showNote)}
              className="p-1 rounded-md hover:bg-white/10 transition-colors cursor-pointer opacity-80 hover:opacity-100"
              title="Adicionar anotação"
            >
              ✏️
            </button>
          </div>
        </div>

        {/* Optional Note Textarea */}
        <AnimatePresence>
          {showNote && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mb-6"
            >
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Se desejar, descreva o que sentiu..."
                className="w-full min-h-[80px] bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-white/25 resize-none transition-colors"
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Triggers Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          {triggers.map((trigger) => (
            <button
              key={trigger.value}
              onClick={() => handleTriggerClick(trigger.value)}
              disabled={isUpdating}
              className="flex items-center justify-start px-4 py-3.5 bg-white/5 border border-white/10 rounded-2xl text-sm font-medium text-gray-200 hover:bg-white/10 active:bg-white/15 hover:border-white/20 transition-all cursor-pointer disabled:opacity-50"
            >
              {trigger.label}
            </button>
          ))}
        </div>

        {/* Footer Action */}
        <div className="flex justify-center pb-2">
          <button
            onClick={handleNoTrigger}
            disabled={isUpdating}
            className="text-sm font-medium text-gray-500 hover:text-gray-300 transition-colors cursor-pointer disabled:opacity-50"
          >
            👉 A vontade não apareceu hoje
          </button>
        </div>
      </motion.div>
    </div>
  );
};
