import { useDataStore } from '../../store/useDataStore';
import { motion } from 'motion/react';
import { X, Trophy, Target, Clock, Zap } from 'lucide-react';
import { formatHumanTime } from '../../lib/utils';

export const ProgressStats = ({ onClose }: { onClose: () => void }) => {
  const { sessions, projects, habits, profile } = useDataStore();

  // Last 7 days activity
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    // Usar horário local, não UTC
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });

  const dailyMinutes = last7Days.map(date => {
    const daySessions = sessions.filter(s => {
      // Converter started_at para data local
      const sessionDate = new Date(s.started_at);
      const year = sessionDate.getFullYear();
      const month = String(sessionDate.getMonth() + 1).padStart(2, '0');
      const day = String(sessionDate.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}` === date;
    });
    return daySessions.reduce((acc, s) => acc + s.duration_minutes, 0);
  });

  const maxMinutes = Math.max(...dailyMinutes, 1);

  // Calcular projeto mais trabalhado
  const projectMinutes = projects.map(p => ({
    name: p.name,
    minutes: sessions
      .filter(s => s.project_id === p.id)
      .reduce((acc, s) => acc + s.duration_minutes, 0)
  })).filter(p => p.minutes > 0)
     .sort((a, b) => b.minutes - a.minutes);

  const topProject = projectMinutes[0];

  // Calcular média diária
  const avgMinutes = Math.round(
    dailyMinutes.reduce((a, b) => a + b, 0) / 
    dailyMinutes.filter(m => m > 0).length || 1
  );

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

          <div id="stats-summary-grid" className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t border-white/5">
             <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-primary-green/10 flex items-center justify-center shrink-0 border border-primary-green/20">
                   <Target size={18} className="text-primary-green" />
                </div>
                <div className="space-y-1">
                   <h4 className="text-sm font-bold text-primary-green uppercase tracking-widest">Foco Principal</h4>
                   <p className="text-xs text-text-secondary font-light leading-relaxed">
                     Seu maior engajamento foi em{' '}
                     <span className="text-text-primary font-medium">
                       {topProject ? topProject.name : 'nenhum projeto ainda'}
                     </span>
                     {topProject && ` com ${formatHumanTime(topProject.minutes)} focados`}.
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
                     Você manteve uma média de{' '}
                     <span className="text-text-primary font-medium">
                       {formatHumanTime(avgMinutes)}
                     </span>{' '}
                     por dia nos últimos 7 dias.
                   </p>
                </div>
             </div>
          </div>

          {habits.length > 0 && (
            <div className="pt-6 border-t border-white/5 space-y-4">
              <h4 className="text-xs font-bold text-text-secondary/40 uppercase tracking-[0.2em] mb-3">Hábitos Atômicos esta semana</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {habits.map(h => {
                  const pct = Math.min(100, Math.round((h.sessions_this_week / h.sessions_per_week) * 100));
                  return (
                    <div key={h.id} className="p-4 bg-white/5 border border-white/5 rounded-2xl flex flex-col justify-between space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-[10px] font-bold text-text-secondary/40 uppercase tracking-widest">Hábito</p>
                          <h5 className="text-sm font-medium text-text-primary">{h.name}</h5>
                        </div>
                        <span className="text-xs font-mono text-primary-green font-bold">🔥 {h.weekly_streak} sem</span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-text-secondary font-mono">
                          <span>Progresso: {h.sessions_this_week}/{h.sessions_per_week} sessões</span>
                          <span>{pct}%</span>
                        </div>
                        <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-primary-green h-full rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
