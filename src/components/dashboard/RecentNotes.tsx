import { useState, useEffect } from 'react';
import { useDataStore } from '../../store/useDataStore';
import { useAuthStore } from '../../store/useAuthStore';
import { StickyNote, X, Trash2, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const RecentNotes = () => {
  const dataStore = useDataStore();
  const { user } = useAuthStore();
  const [showAllNotes, setShowAllNotes] = useState(false);
  const [showAddNote, setShowAddNote] = useState(false);
  const [filterProject, setFilterProject] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Handle external trigger to open history modal
  useEffect(() => {
    const handleOpenHistory = () => setShowAllNotes(true);
    window.addEventListener('open-notes-history', handleOpenHistory);
    return () => window.removeEventListener('open-notes-history', handleOpenHistory);
  }, []);

  // Note Creation State
  const [noteContent, setNoteContent] = useState('');
  const [noteProjectId, setNoteProjectId] = useState('');
  const [noteActivityId, setNoteActivityId] = useState('');

  const latestNotes = dataStore.notes.slice(0, 3);

  const filteredAllNotes = dataStore.notes.filter(note => {
    const matchesProject = filterProject ? note.project_id === filterProject : true;
    const noteDateStr = note.target_date || note.created_at.split('T')[0];
    const matchesDate = filterDate ? noteDateStr === filterDate : true;
    return matchesProject && matchesDate;
  });

  const handleAddNote = async () => {
    if (!user || !noteContent) return;
    
    const result = await dataStore.addNote(
      user.id, 
      noteContent, 
      noteProjectId || undefined, 
      noteActivityId || undefined
    );

    if (result) {
      setSuccessMessage('✅ Anotação salva!');
      setTimeout(() => setSuccessMessage(''), 3000);
      setNoteContent('');
      setNoteProjectId('');
      setNoteActivityId('');
      // Delay closing to show success message if not in a modal, 
      // but here we are in a modal for "Anota Agora"
      setTimeout(() => setShowAddNote(false), 1500);
    } else {
      alert('Erro ao salvar anotação. Tente novamente.');
    }
  };

  const handleDeleteConfirm = async (id: string, content: string) => {
    if (window.confirm(`Deseja excluir esta anotação?\n"${content.substring(0, 30)}..."\nEsta ação não pode ser desfeita.`)) {
      await dataStore.deleteNote(id);
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('pt-BR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).replace('.', '');
  };

  return (
    <section className="w-full max-w-5xl space-y-12 pb-20">
      <div className="flex flex-col items-center gap-8">
        <button 
          onClick={() => setShowAddNote(true)}
          className="group px-12 py-6 bg-primary-green text-background rounded-2xl text-xs font-bold uppercase tracking-[0.3em] hover:bg-glow-green transition-all shadow-[0_20px_40px_rgba(110,231,168,0.2)] active:scale-95"
        >
          Anota Agora
        </button>

        <div className="w-full max-w-4xl space-y-4">
          {latestNotes.length > 0 && (
            <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-text-secondary/40 block text-center mb-6">Anotações Recentes</span>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {latestNotes.map(note => {
              const project = dataStore.projects.find(p => p.id === note.project_id);
              const activity = dataStore.activities.find(a => a.id === note.activity_id);
              return (
                <motion.div 
                  key={note.id} 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-6 rounded-3xl bg-surface/10 border border-border-white hover:border-primary-green/30 transition-all flex flex-col group relative overflow-hidden"
                >
                  <button 
                    onClick={() => handleDeleteConfirm(note.id, note.content)}
                    className="absolute top-4 right-4 p-2 text-red-500 opacity-0 group-hover:opacity-100 hover:bg-red-500/10 rounded-lg transition-all"
                  >
                    <Trash2 size={16} />
                  </button>

                  <p className="text-text-primary font-light text-sm line-clamp-2 leading-relaxed mb-4 flex-1">
                    {note.content}
                  </p>

                  <div className="space-y-2 mt-auto">
                    <div className="flex flex-wrap items-center gap-2 text-[8px] font-bold text-text-secondary/60 uppercase tracking-widest">
                      {project && (
                        <span className="px-2 py-0.5 bg-white/5 rounded-full">{project.name}</span>
                      )}
                      {activity && (
                        <span className="px-2 py-0.5 bg-white/5 rounded-full">{activity.name}</span>
                      )}
                    </div>
                    <p className="text-[9px] font-bold text-primary-green/40 uppercase tracking-widest">
                      {formatDate(note.target_date || note.created_at)}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {latestNotes.length === 0 && (
            <p className="text-center text-text-secondary/20 italic text-sm font-light py-10">Nenhuma anotação registrada.</p>
          )}

          <button 
            onClick={() => setShowAllNotes(true)}
            className="w-full py-4 mt-4 border border-white/10 rounded-xl text-[10px] font-bold uppercase tracking-widest text-text-secondary hover:text-primary-green hover:border-primary-green/30 transition-all"
          >
            Ver Todas as Anotações
          </button>
        </div>
      </div>

      {/* Add Note Modal - Forma 1 */}
      <AnimatePresence>
        {showAddNote && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[600] bg-background/95 backdrop-blur-3xl flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-surface border border-border-white p-8 md:p-12 rounded-[2.5rem] max-w-xl w-full space-y-10 shadow-[0_50px_100px_rgba(0,0,0,0.5)]"
            >
              <div className="flex justify-between items-center border-b border-white/5 pb-6">
                <h3 className="text-2xl font-semibold tracking-tight text-text-primary flex items-center gap-3">
                  <StickyNote className="text-primary-green" /> Anota Agora
                </h3>
                <button onClick={() => setShowAddNote(false)} className="w-10 h-10 rounded-full border border-border-white flex items-center justify-center text-text-secondary hover:text-white transition-colors">
                  <X size={18} />
                </button>
              </div>

              {successMessage ? (
                <div className="py-20 text-center space-y-4">
                  <div className="w-16 h-16 bg-primary-green/10 text-primary-green rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 size={32} />
                  </div>
                  <p className="text-xl font-bold text-primary-green">{successMessage}</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-text-secondary/40">Projeto (opcional)</label>
                      <select 
                        className="w-full bg-transparent border-b border-border-white py-2 text-sm text-text-primary outline-none focus:border-primary-green touch-manipulation min-h-[44px] appearance-none"
                        value={noteProjectId}
                        onChange={e => {
                          setNoteProjectId(e.target.value);
                          setNoteActivityId('');
                        }}
                      >
                        <option value="">Sem Projeto</option>
                        {dataStore.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-text-secondary/40">Atividade (opcional)</label>
                      <select 
                        className="w-full bg-transparent border-b border-border-white py-2 text-sm text-text-primary outline-none focus:border-primary-green touch-manipulation min-h-[44px] appearance-none"
                        value={noteActivityId}
                        onChange={e => setNoteActivityId(e.target.value)}
                      >
                        <option value="">Sem Atividade</option>
                        {(noteProjectId ? dataStore.activities.filter(a => a.project_id === noteProjectId) : dataStore.activities).map(act => (
                          <option key={act.id} value={act.id}>{act.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-text-secondary/40">O que não pode esquecer?</label>
                    <textarea
                      placeholder="Algo importante que não pode esquecer?"
                      autoComplete="off" autoCorrect="off" enterKeyHint="send" inputMode="text"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleAddNote();
                        }
                      }}
                      className="w-full bg-surface/40 border border-border-white rounded-2xl p-6 text-lg font-light text-text-primary outline-none focus:border-primary-green transition-all resize-none h-40 touch-manipulation min-h-[44px]"
                      value={noteContent}
                      onChange={e => setNoteContent(e.target.value)}
                    />
                  </div>

                  <button
                    onClick={handleAddNote}
                    disabled={!noteContent}
                    className="w-full py-5 bg-primary-green text-background rounded-2xl font-bold uppercase tracking-[0.2em] text-xs hover:bg-glow-green transition-all disabled:opacity-20 min-h-[44px]"
                  >
                    Salvar Anotação
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* All Notes Modal - Histórico */}
      <AnimatePresence>
        {showAllNotes && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1000] bg-background/98 backdrop-blur-3xl flex flex-col items-center px-6 py-12 overflow-y-auto"
          >
            <div className="w-full max-w-4xl space-y-12">
              <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 border-b border-white/5 pb-8 relative">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setShowAllNotes(false)}
                    className="flex items-center gap-2 text-text-secondary hover:text-primary-green transition-colors font-bold uppercase tracking-widest text-[10px]"
                  >
                    <ArrowLeft size={16} /> Voltar
                  </button>
                  <div className="flex items-center gap-3">
                    <StickyNote className="text-primary-green" />
                    <h2 className="text-2xl md:text-4xl font-semibold tracking-tight text-text-primary">Anotações</h2>
                  </div>
                </div>
                
                <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
                   <select 
                    className="w-full md:w-auto bg-white/5 border border-white/10 rounded-full px-6 py-2 text-xs text-text-primary outline-none focus:border-primary-green touch-manipulation min-h-[44px] appearance-none"
                    value={filterProject}
                    onChange={e => setFilterProject(e.target.value)}
                  >
                    <option value="">Filtrar Projeto</option>
                    {dataStore.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <input
                    type="date"
                    className="w-full md:w-auto bg-white/5 border border-white/10 rounded-full px-6 py-2 text-xs text-text-primary outline-none focus:border-primary-green touch-manipulation min-h-[44px]"
                    value={filterDate}
                    onChange={e => setFilterDate(e.target.value)}
                  />
                  <button
                    onClick={() => setShowAllNotes(false)}
                    className="absolute -top-4 -right-4 w-10 h-10 rounded-full border border-border-white flex items-center justify-center text-text-secondary hover:text-text-primary transition-all"
                  >
                    <X size={18} />
                  </button>
                </div>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-20">
                {filteredAllNotes.map(note => {
                  const project = dataStore.projects.find(p => p.id === note.project_id);
                  const activity = dataStore.activities.find(a => a.id === note.activity_id);
                  return (
                    <div key={note.id} className="group p-8 rounded-[2rem] bg-surface/10 border border-white/5 hover:border-primary-green/20 transition-all flex flex-col relative">
                      <button 
                        onClick={() => handleDeleteConfirm(note.id, note.content)}
                        className="absolute top-6 right-6 p-3 text-red-500/40 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                      >
                        <Trash2 size={20} />
                      </button>
                      
                      <p className="text-text-primary/90 font-light text-base leading-relaxed whitespace-pre-wrap flex-1 mb-8">
                        {note.content}
                      </p>
                      
                      <div className="flex flex-wrap items-center gap-3 text-[9px] font-bold text-text-secondary/40 uppercase tracking-widest pt-6 border-t border-white/5">
                        <span className="text-primary-green/60">{formatDate(note.target_date || note.created_at)}</span>
                        {project && (
                          <>
                            <span className="w-1 h-1 rounded-full bg-border-white" />
                            <span className="text-text-secondary">{project.name}</span>
                          </>
                        )}
                        {activity && (
                          <>
                            <span className="w-1 h-1 rounded-full bg-border-white" />
                            <span className="text-text-secondary/60">{activity.name}</span>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
                {filteredAllNotes.length === 0 && (
                  <div className="col-span-full py-20 text-center text-text-secondary/20 italic">
                    Nenhuma anotação encontrada com os filtros selecionados.
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};
