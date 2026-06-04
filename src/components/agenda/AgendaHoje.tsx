import { useMemo, useState } from 'react';
import { useDataStore } from '../../store/useDataStore';
import { AgendamentoCard } from './AgendamentoCard';
import { ScheduledActivity } from '../../types';
import { Plus, Calendar, ChevronDown } from 'lucide-react';
import { getLocalDateString } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface AgendaHojeProps {
  onStartSession: (activity: ScheduledActivity) => void;
  onOpenNewSchedule: () => void;
}

export const AgendaHoje = ({ onStartSession, onOpenNewSchedule }: AgendaHojeProps) => {
  const dataStore = useDataStore();
  const [isExpanded, setIsExpanded] = useState(false);

  const todayStr = useMemo(() => {
    return getLocalDateString(new Date());
  }, []);

  const todayActivities = useMemo(() => {
    return dataStore.scheduledActivities.filter(item => {
      return item.scheduled_date === todayStr && item.status === 'pending';
    });
  }, [dataStore.scheduledActivities, todayStr]);

  const handleStart = (activity: ScheduledActivity) => {
    onStartSession(activity);
  };

  if (todayActivities.length === 0) {
    return null;
  }

  return (
    <section id="agenda-hoje-section" className="w-full max-w-5xl space-y-4 font-sans">
      {/* Header Collapsible Trigger */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-6 bg-surface/20 hover:bg-surface/35 border border-border-white rounded-3xl flex items-center justify-between cursor-pointer transition-all duration-300 group"
      >
        <div className="flex items-center gap-4 font-sans">
          <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-text-secondary/60 group-hover:bg-white/10 group-hover:text-text-primary transition-colors">
            <Calendar size={18} />
          </div>
          <div className="text-left font-sans">
            <h3 className="text-lg font-semibold text-[#f8fafc] tracking-tight">Agenda de Hoje</h3>
            <p className="text-xs text-text-secondary/60 mt-0.5">
              {todayActivities.length} {todayActivities.length === 1 ? 'atividade planejada' : 'atividades planejadas'}
            </p>
          </div>
        </div>
        <div className={`text-text-secondary/40 group-hover:text-[#f8fafc] transition-colors transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
          <ChevronDown size={20} />
        </div>
      </div>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="w-full p-6 bg-surface/20 border border-border-white rounded-3xl space-y-6">
              {/* Inner header & Action panel */}
              <div className="flex items-center justify-between flex-wrap gap-4 pb-2 border-b border-white/5">
                <div className="text-left max-w-sm md:max-w-md">
                  <p className="text-xs text-text-secondary/60 font-light">
                    Seu cronograma de foco inteligente programado para o dia corrente.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenNewSchedule();
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-[#6ee7a8]/10 hover:bg-[#6ee7a8]/20 border border-[#6ee7a8]/20 rounded-xl text-xs font-bold uppercase tracking-wider text-[#6ee7a8] transition-all cursor-pointer"
                  >
                    <Plus size={14} />
                    Agendar
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      window.dispatchEvent(new CustomEvent('navigate-to-agenda'));
                    }}
                    className="px-4 py-2.5 border border-primary-green/20 hover:border-primary-green/40 hover:bg-primary-green/5 text-primary-green rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
                  >
                    Ver Todas
                  </button>
                </div>
              </div>

              {/* Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {todayActivities.map(activity => (
                  <AgendamentoCard
                    key={activity.id}
                    activity={activity}
                    onStartSession={handleStart}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};
