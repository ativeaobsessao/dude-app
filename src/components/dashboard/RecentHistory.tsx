import React, { useState } from 'react';
import { useDataStore } from '../../store/useDataStore';
import { History, X, Search, Filter, Trash2, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatHumanTime } from '../../lib/utils';

export const RecentHistory = () => {
  const dataStore = useDataStore();
  const [showFullHistory, setShowFullHistory] = useState(false);
  const [filterProject, setFilterProject] = useState('');
  const [filterDate, setFilterDate] = useState('');

  const latestHistory = dataStore.sessions.slice(0, 3);

  const filteredHistory = dataStore.sessions.filter(session => {
    const matchesProject = filterProject ? session.project_id === filterProject : true;
    const sessionDateStr = new Date(session.started_at).toISOString().split('T')[0];
    const matchesDate = filterDate ? sessionDateStr === filterDate : true;
    return matchesProject && matchesDate;
  });

  const handleDeleteSession = async (id: string) => {
    if (window.confirm('Deseja excluir este registro de sessão permanentemente?')) {
      try {
        await dataStore.deleteSession(id);
      } catch (error) {
        console.error('Erro ao excluir sessão:', error);
      }
    }
  };

  const formatDateShort = (date: string) => {
    const d = new Date(date);
    const day = d.getDate().toString().padStart(2, '0');
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  };

  return (
    <section className="w-full max-w-5xl space-y-10">
      <div className="flex items-center justify-between border-b border-border-white pb-4">
        <span className="text-text-secondary uppercase tracking-[0.3em] text-[10px] font-bold flex items-center gap-2">
          <History size={12} className="text-primary-green" />
          HISTÓRICO RECENTE DAS ÚLTIMAS SESSÕES PROFUNDAS
        </span>
        <span className="text-[10px] text-text-secondary/40 font-mono tracking-[0.2em]">ARQUIVO OPERACIONAL</span>
      </div>

      <div className="space-y-4">
        {latestHistory.length === 0 ? (
          <p className="text-text-secondary/30 italic text-sm font-light">Nenhum histórico operacional encontrado.</p>
        ) : (
          latestHistory.map(session => (
            <HistoryRow 
              key={session.id} 
              id={session.id}
              title={session.activity_name} 
              project={dataStore.projects.find(p => p.id === session.project_id)?.name || 'Geral'}
              duration={formatHumanTime(session.duration_minutes)} 
              date={formatDateShort(session.started_at)}
              onDelete={handleDeleteSession}
            />
          ))
        )}
      </div>

      <div className="flex justify-center pt-4">
        <button 
          onClick={() => setShowFullHistory(true)}
          className="w-full py-3 border border-white/10 rounded-xl text-xs font-bold uppercase tracking-widest text-text-secondary hover:text-primary-green hover:border-primary-green/30 transition-all"
        >
          Ver Todo Histórico
        </button>
      </div>

      {/* Full History Modal */}
      <AnimatePresence>
        {showFullHistory && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[500] bg-background/95 backdrop-blur-3xl flex flex-col items-center px-6 py-16 overflow-y-auto"
          >
            <div className="w-full max-w-4xl space-y-12">
              <header className="flex justify-between items-center border-b border-white/5 pb-8">
                <button
                  onClick={() => setShowFullHistory(false)}
                  className="flex items-center gap-2 text-text-secondary hover:text-primary-green transition-colors font-bold uppercase tracking-widest text-[10px]"
                >
                  <ArrowLeft size={16} /> Voltar
                </button>
                <h2 className="text-xl md:text-3xl font-semibold tracking-tight text-text-primary text-center">Histórico de Sessões Profundas</h2>
                <div className="w-20 hidden md:block"></div>
              </header>

              {/* Filters */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-8 border-b border-white/5">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-text-secondary/40">Filtrar por Projeto</label>
                  <select 
                    className="w-full bg-surface/40 border border-border-white rounded-xl py-3 px-4 text-sm text-text-primary outline-none focus:border-primary-green transition-all appearance-none cursor-pointer touch-manipulation min-h-[44px]"
                    value={filterProject}
                    onChange={e => setFilterProject(e.target.value)}
                  >
                    <option value="">Todos os Projetos</option>
                    {dataStore.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-text-secondary/40">Filtrar por Data</label>
                  <input 
                    type="date"
                    className="w-full bg-surface/40 border border-border-white rounded-xl py-3 px-4 text-sm text-text-primary outline-none focus:border-primary-green transition-all touch-manipulation min-h-[44px]"
                    value={filterDate}
                    onChange={e => setFilterDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-4 pb-32">
                {filteredHistory.length === 0 ? (
                  <p className="text-text-secondary/30 italic text-center py-20">Nenhum registro encontrado para os filtros selecionados.</p>
                ) : (
                  filteredHistory.map(session => (
                    <HistoryRow 
                      key={session.id} 
                      id={session.id}
                      title={session.activity_name} 
                      project={dataStore.projects.find(p => p.id === session.project_id)?.name || 'Geral'}
                      duration={formatHumanTime(session.duration_minutes)} 
                      date={formatDateShort(session.started_at)}
                      onDelete={handleDeleteSession}
                    />
                  ))
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};

interface HistoryRowProps {
  id: string;
  title: string;
  project: string;
  duration: string;
  date: string;
  onDelete: (id: string) => void;
}

const HistoryRow: React.FC<HistoryRowProps> = ({ id, title, project, duration, date, onDelete }) => {
  const dataStore = useDataStore();
  const sessionTasks = dataStore.sessionTasks.filter(t => t.session_id === id);

  return (
    <div className="py-6 border-b border-border-white/5 group">
      <div className="flex justify-between items-center">
        <div className="space-y-1">
          <span className="text-lg font-light text-text-primary group-hover:text-primary-green transition-colors">{title}</span>
          <p className="text-[10px] font-bold text-text-secondary/40 uppercase tracking-widest">{project}</p>
        </div>
        <div className="flex items-center gap-6 text-right">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-text-primary tracking-tight">{duration}</p>
            <p className="text-[10px] font-bold text-primary-green/60 uppercase tracking-widest leading-none">{date}</p>
          </div>
          <button 
            onClick={() => onDelete(id)}
            className="p-2 text-red-500/20 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {sessionTasks.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {sessionTasks.map((t) => (
            <div key={t.id} className="flex items-center gap-1.5 px-2.5 py-1 bg-white/[0.03] border border-white/[0.05] rounded-full">
              <span className={t.completed ? 'text-primary-green' : 'text-text-secondary/30'}>
                {t.completed ? '✓' : '○'}
              </span>
              <span className={`text-[9px] ${t.completed ? 'line-through text-text-secondary/40' : 'text-text-secondary/70'}`}>
                {t.description}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
