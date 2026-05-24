import React, { useState } from 'react';
import { useDataStore } from '../../store/useDataStore';
import { History, X, Search, Filter, Trash2, ArrowLeft, CheckCircle, Pause } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatHumanTime, resolverNomeSessao, formatSessionDuration, formatTimeRange } from '../../lib/utils';

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
              session={session}
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
                      session={session}
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

const HistoryRow: React.FC<{ session: any; onDelete: (id: string) => void }> = ({ session, onDelete }) => {
  const dataStore = useDataStore();
  const resolved = resolverNomeSessao(session, dataStore.habits, dataStore.projects);
  const isPartial = session.parcial === true || 
                   session.parcial === 'true' || 
                   (session.actual_duration_minutes !== null && 
                    session.actual_duration_minutes !== undefined && 
                    session.actual_duration_minutes < session.duration_minutes);
  const durationToUse = session.actual_duration_minutes !== null ? session.actual_duration_minutes : session.duration_minutes;
  const formattedDuration = formatSessionDuration(durationToUse);
  const timeRange = formatTimeRange(session.started_at, session.completed_at, session.duration_minutes);

  return (
    <div
      key={session.id}
      className={`relative flex justify-between items-start py-6 border-b border-white/5 group ${
        session.habit_id 
          ? 'pl-4 border-l-2 border-l-primary-green' 
          : ''
      }`}
    >
      <div className="flex gap-3 items-start flex-1 min-w-0">
        <CheckCircle 
          size={16} 
          className="shrink-0 mt-1" 
          style={{ color: isPartial ? '#fbbf24' : '#6ee7b7' }}
        />
        <div className="space-y-1 flex-1 min-w-0">
          {/* Badge de hábito */}
          {session.habit_id && (
            <span className="text-[9px] font-bold uppercase tracking-widest text-primary-green/60 flex items-center gap-1 mb-1">
              ⚡ Hábito Atômico
            </span>
          )}
          
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-lg font-light text-text-primary group-hover:text-primary-green transition-colors">
              {resolved.titulo}
            </span>
            <span className="text-text-secondary/30 hidden md:inline">—</span>
            <span className="text-[10px] font-bold text-text-secondary/40 uppercase tracking-widest leading-none mt-0.5">
              {resolved.projeto}
            </span>
            {isPartial && (
              <span 
                className="inline-flex items-center ml-1 font-bold"
                style={{
                  backgroundColor: 'rgba(251, 191, 36, 0.12)',
                  border: '0.5px solid rgba(251, 191, 36, 0.25)',
                  color: '#fbbf24',
                  fontSize: '9px',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  padding: '2px 6px',
                  borderRadius: '999px',
                  lineHeight: '1'
                }}
              >
                INCOMPLETA
              </span>
            )}
          </div>

          {/* Segunda linha: horário início → fim + duração */}
          <div className="text-[11px] font-normal leading-normal mt-[2px] flex items-center gap-1.5 text-[#6a7570]">
            <span>{timeRange}</span>
            <span className="text-[#3a4540]">·</span>
            <span>{formattedDuration}</span>
          </div>

          {/* Linha tracejada e ícone de pause */}
          {isPartial && (
            <>
              <div 
                style={{
                  width: '100%',
                  borderTop: '1px dashed rgba(251, 191, 36, 0.3)',
                  marginTop: '6px',
                  marginBottom: '4px'
                }}
              />
              <div 
                className="font-medium flex items-center"
                style={{
                  color: '#fbbf24',
                  fontSize: '10px',
                  opacity: 0.8
                }}
              >
                <Pause size={10} className="shrink-0 mr-1.5" style={{ color: '#fbbf24' }} />
                <span>{session.actual_duration_minutes || 0} / {session.duration_minutes} min programados</span>
              </div>
            </>
          )}

          {/* Tarefas da sessão */}
          {(() => {
            const tasks = dataStore.sessionTasks.filter(t => t.session_id === session.id);
            return tasks.length > 0 ? (
              <div className="mt-2 space-y-1">
                {tasks.map(task => (
                  <div key={task.id} className="flex items-center gap-2 text-[10px] text-text-secondary/50">
                    <span>{task.completed ? '✅' : '○'}</span>
                    <span className={task.completed ? '' : 'opacity-50'}>{task.description}</span>
                  </div>
                ))}
              </div>
            ) : null;
          })()}

          {/* Badge de conclusão antecipada */}
          {session.all_tasks_completed && session.actual_duration_minutes && (
            <p className="text-[9px] text-primary-green/60 font-bold uppercase tracking-widest mt-1">
              ⚡ Concluiu {session.duration_minutes - session.actual_duration_minutes}min antes do prazo
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 text-right shrink-0 ml-4">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-text-primary">
            {formattedDuration}
          </p>
          <p className="text-[10px] font-bold text-primary-green/60 uppercase tracking-widest">
            {(() => {
              const d = new Date(session.started_at);
              const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
              return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
            })()}
          </p>
        </div>
        <button
          onClick={() => onDelete(session.id)}
          className="p-2 text-red-500/20 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
};
