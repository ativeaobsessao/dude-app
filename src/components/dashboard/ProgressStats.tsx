import { useDataStore } from '../../store/useDataStore';
import { motion } from 'motion/react';
import { X, Trophy, Target, Clock, Zap } from 'lucide-react';
import { formatHumanTime } from '../../lib/utils';

export const ProgressStats = ({ onClose }: { onClose: () => void }) => {
  const { sessions, projects, habits, profile } = useDataStore();

  // Last 7 days activity
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d.toISOString().split('T')[0];
  }).reverse();

  const dailyMinutes = last7Days.map(date => {
    const daySessions = sessions.filter(s => s.started_at.startsWith(date));
    return daySessions.reduce((acc, s) => acc + s.duration_minutes, 0);
  });

  const maxMinutes = Math.max(...dailyMinutes, 1);

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-background/95 backdrop-blur-xl">
      <motion.div
        layout={false}
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-2xl bg-surface border border-primary-green/20 rounded-[2.5rem] p-10 md:p-16 relative shadow-[0_0_100px_rgba(110,231,168,0.1)] overflow-y-auto max-h-[90vh]"
      >
        <button 
          onClick={onClose}
          className="absolute top-8 right-8 w-12 h-12 rounded-full border border-border-white flex items-center justify-center text-text-secondary hover:text-primary-green hover:border-primary-green transition-all"
        >
          <X size={20} />
        </button>

        <div className="space-y-12">
          <header className="space-y-2">
            <div className="flex items-center gap-3 text-primary-green">
              <Trophy size={20} />
              <span className="text-[10px] font-bold uppercase tracking-[0.4em]">Sua Evolução</span>
            </div>
            <h2 className="text-4xl font-semibold tracking-tight text-text-primary">Métrica da sua Evolução</h2>
          </header>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-text-secondary/40 uppercase tracking-widest">Total Focado</span>
              <p className="text-2xl font-light text-text-primary">{formatHumanTime(profile?.total_focus_minutes || 0)}</p>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-text-secondary/40 uppercase tracking-widest">Sessões</span>
              <p className="text-2xl font-light text-text-primary">{sessions.length}</p>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-text-secondary/40 uppercase tracking-widest">Projetos</span>
              <p className="text-2xl font-light text-text-primary">{projects.length}</p>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-text-secondary/40 uppercase tracking-widest">DIAS INVICTOS</span>
              <p className="text-2xl font-light text-primary-green">🔥 {profile?.current_streak || 0} dias</p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex justify-between items-end">
              <span className="text-[10px] font-bold text-text-secondary/40 uppercase tracking-widest">Atividade nos últimos 7 dias</span>
              <span className="text-[10px] font-mono text-primary-green/60">Minutos por dia</span>
            </div>
            <div className="h-32 flex items-end gap-2 md:gap-4 px-2">
              {dailyMinutes.map((mins, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-3 group">
                  <div className="w-full relative group-hover:filter group-hover:brightness-125 transition-all">
                    <motion.div 
                      layout={false}
                      initial={{ height: 0 }}
                      animate={{ height: `${(mins / maxMinutes) * 100}%` }}
                      className="bg-primary-green/20 border-t-2 border-primary-green rounded-t-lg min-h-[4px] w-full"
                    />
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-[8px] font-mono text-primary-green whitespace-nowrap">
                      {mins}m
                    </div>
                  </div>
                  <span className="text-[8px] text-text-secondary uppercase font-bold tracking-tighter">
                    {new Date(last7Days[i]).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t border-white/5">
             <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-primary-green/10 flex items-center justify-center shrink-0 border border-primary-green/20">
                   <Target size={18} className="text-primary-green" />
                </div>
                <div className="space-y-1">
                   <h4 className="text-sm font-bold text-primary-green uppercase tracking-widest">Foco Principal</h4>
                   <p className="text-xs text-text-secondary font-light leading-relaxed">
                     Seu maior engajamento recente foi em <span className="text-text-primary font-medium">Projetos Operacionais</span>.
                   </p>
                </div>
             </div>
             <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-primary-green/10 flex items-center justify-center shrink-0 border border-primary-green/20">
                   <Zap size={18} className="text-primary-green" />
                </div>
                <div className="space-y-1">
                   <h4 className="text-sm font-bold text-primary-green uppercase tracking-widest">Consistência</h4>
                   <p className="text-xs text-text-secondary font-light leading-relaxed">
                     Você manteve uma média de <span className="text-text-primary font-medium">{Math.round(dailyMinutes.reduce((a,b)=>a+b,0)/7)}m</span> por dia esta semana.
                   </p>
                </div>
             </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
