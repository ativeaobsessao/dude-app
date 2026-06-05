import { useState, useEffect } from 'react';
import { useDataStore } from '../../store/useDataStore';
import { useAuthStore } from '../../store/useAuthStore';
import { StickyNote, X, Trash2, ArrowLeft, CheckCircle2, Pencil, ChevronDown, Plus, Copy, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { CustomSelect } from '../ui/CustomSelect';
import { getLocalDateString } from '../../lib/utils';
import JSZip from 'jszip';

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

  // Note Editing State
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteContent, setEditingNoteContent] = useState('');

  // Selection and Download State
  const [selectedNotes, setSelectedNotes] = useState<Set<string>>(new Set());
  const [showDownloadDialog, setShowDownloadDialog] = useState(false);

  // Toggle selection for a note
  const handleToggleSelect = (id: string) => {
    setSelectedNotes(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Select all filtered notes
  const handleSelectAll = () => {
    const allIds = filteredAllNotes.map(n => n.id);
    setSelectedNotes(new Set(allIds));
  };

  // Clear all selections
  const handleClearSelection = () => {
    setSelectedNotes(new Set());
  };

  // Copy helper
  const handleCopyNote = (note: any) => {
    const titlePrefix = note.title?.trim() ? `${note.title.trim()}\n\n` : '';
    const textToCopy = `${titlePrefix}${note.content}`;
    navigator.clipboard.writeText(textToCopy)
      .then(() => {
        dataStore.showNotification('Anotação copiada ✓', 'success');
      })
      .catch((err) => {
        console.error('Erro ao copiar: ', err);
        alert('Erro ao copiar anotação.');
      });
  };

  // Safe filename generator
  const getSafeFilename = (note: any, index: number) => {
    const project = dataStore.projects.find(p => p.id === note.project_id);
    const dateStr = (note.target_date || note.created_at).slice(0, 10);
    
    let base = '';
    if (note.title?.trim()) {
      base = note.title.trim();
    } else if (project) {
      base = `${project.name}-${dateStr}`;
    } else {
      base = `anotacao-${dateStr}-${index + 1}`;
    }
    
    return base
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // remove portuguese accents
      .replace(/[^a-z0-9_-]/g, '_')   // replace non-alphanumeric with under
      .replace(/_+/g, '_')            // collapse consecutive underscores
      .substring(0, 50) + '.md';
  };

  // Markdown renderer
  const renderNoteAsMarkdown = (note: any) => {
    const project = dataStore.projects.find(p => p.id === note.project_id);
    const activity = dataStore.activities.find(a => a.id === note.activity_id);
    
    let parts: string[] = [];
    
    if (note.title?.trim()) {
      parts.push(`## ${note.title.trim()}`);
    } else {
      const dateLabel = formatDate(note.target_date || note.created_at);
      const categoryLabel = project ? ` | ${project.name}` : '';
      parts.push(`## Anotação (${dateLabel}${categoryLabel})`);
    }
    
    parts.push(note.content);
    
    const tags: string[] = [];
    if (project) tags.push(`#projeto/${project.name.toLowerCase().replace(/\s+/g, '-')}`);
    if (activity) tags.push(`#atividade/${activity.name.toLowerCase().replace(/\s+/g, '-')}`);
    
    const formattedDate = new Date(note.target_date || note.created_at).toLocaleDateString('pt-BR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    
    const metadataLine = `*Data: ${formattedDate}* ${tags.length > 0 ? `• Tags: ${tags.join(' ')}` : ''}`;
    parts.push(metadataLine);
    
    return parts.join('\n\n');
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadAsSingleFile = () => {
    const selectedNotesList = dataStore.notes.filter(n => selectedNotes.has(n.id));
    const combinedMarkdown = selectedNotesList
      .map(note => renderNoteAsMarkdown(note))
      .join('\n\n---\n\n');
    
    const blob = new Blob([combinedMarkdown], { type: 'text/markdown;charset=utf-8' });
    downloadBlob(blob, 'anotacoes-foco.md');
    dataStore.showNotification('Download iniciado ✓', 'success');
    setShowDownloadDialog(false);
  };

  const downloadAsZip = async () => {
    const zip = new JSZip();
    const selectedNotesList = dataStore.notes.filter(n => selectedNotes.has(n.id));
    
    selectedNotesList.forEach((note, index) => {
      const filename = getSafeFilename(note, index);
      const markdown = renderNoteAsMarkdown(note);
      zip.file(filename, markdown);
    });
    
    try {
      const content = await zip.generateAsync({ type: 'blob' });
      downloadBlob(content, 'anotacoes-foco.zip');
      dataStore.showNotification('Download iniciado ✓', 'success');
      setShowDownloadDialog(false);
    } catch (err) {
      console.error('Erro ao gerar zip:', err);
      alert('Erro ao criar arquivo ZIP.');
    }
  };

  const handleUpdateNote = async (id: string) => {
    if (!editingNoteContent.trim()) return;
    const success = await dataStore.updateNote(id, editingNoteContent.trim());
    if (success) {
      setEditingNoteId(null);
      setEditingNoteContent('');
    } else {
      alert('Erro ao atualizar anotação.');
    }
  };

  const latestNotes = dataStore.notes.slice(0, 3);

  const filteredAllNotes = dataStore.notes.filter(note => {
    const matchesProject = filterProject ? note.project_id === filterProject : true;
    const noteDateStr = note.target_date || getLocalDateString(new Date(note.created_at));
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

  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <section className="w-full max-w-5xl space-y-4 font-sans">
      {/* Header Collapsible Trigger */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-6 bg-surface/20 hover:bg-surface/35 border border-border-white rounded-3xl flex items-center justify-between cursor-pointer transition-all duration-300 group"
      >
        <div className="flex items-center gap-4 font-sans">
          <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-text-secondary/60 group-hover:bg-white/10 group-hover:text-text-primary transition-colors">
            <StickyNote size={18} />
          </div>
          <div className="text-left font-sans">
            <h3 className="text-lg font-semibold text-text-primary tracking-tight">Anotações</h3>
            <p className="text-xs text-text-secondary/60 mt-0.5">
              {dataStore.notes.length} {dataStore.notes.length === 1 ? 'anotação registrada' : 'anotações registradas'}
            </p>
          </div>
        </div>
        <div className={`text-text-secondary/40 group-hover:text-text-primary transition-colors transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
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
                    Memória Cognitiva: Suas 3 anotações mais recentes.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowAddNote(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-[#6ee7a8]/10 hover:bg-[#6ee7a8]/20 border border-[#6ee7a8]/20 rounded-xl text-xs font-bold uppercase tracking-wider text-[#6ee7a8] transition-all cursor-pointer"
                  >
                    <Plus size={14} />
                    Anota Agora
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowAllNotes(true);
                    }}
                    className="px-4 py-2.5 border border-primary-green/20 hover:border-primary-green/40 hover:bg-primary-green/5 text-primary-green rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
                  >
                    Ver Todas
                  </button>
                </div>
              </div>

              <div className="w-full space-y-4">
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
                        {editingNoteId !== note.id && (
                          <>
                            <button 
                              onClick={() => handleCopyNote(note)}
                              title="Copiar para área de transferência"
                              className="absolute top-4 right-20 p-2 text-text-secondary opacity-0 group-hover:opacity-100 hover:text-primary-green hover:bg-white/5 rounded-lg transition-all cursor-pointer max-md:opacity-100 max-md:text-text-secondary/60"
                            >
                              <Copy size={14} />
                            </button>
                            <button 
                              onClick={() => {
                                setEditingNoteId(note.id);
                                setEditingNoteContent(note.content);
                              }}
                              className="absolute top-4 right-12 p-2 text-primary-green opacity-0 group-hover:opacity-100 hover:bg-primary-green/10 rounded-lg transition-all"
                            >
                              <Pencil size={14} />
                            </button>
                            <button 
                              onClick={() => handleDeleteConfirm(note.id, note.content)}
                              className="absolute top-4 right-4 p-2 text-red-500 opacity-0 group-hover:opacity-100 hover:bg-red-500/10 rounded-lg transition-all"
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}

                        {editingNoteId === note.id ? (
                          <div className="space-y-4 flex-1 mb-4">
                            <textarea
                              className="w-full bg-surface/60 border border-primary-green/40 p-3 rounded-xl text-text-primary text-sm font-light outline-none resize-none h-24 focus:border-primary-green"
                              value={editingNoteContent}
                              onChange={e => setEditingNoteContent(e.target.value)}
                              autoFocus
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => setEditingNoteId(null)}
                                className="px-3 py-1.5 border border-white/10 rounded-lg text-[9px] font-bold uppercase tracking-widest text-text-secondary hover:text-white transition-colors"
                              >
                                Cancelar
                              </button>
                              <button
                                onClick={() => handleUpdateNote(note.id)}
                                className="px-3 py-1.5 bg-primary-green text-background rounded-lg text-[9px] font-bold uppercase tracking-widest transition-colors animate-pulse"
                              >
                                Ok
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-text-primary font-light text-sm line-clamp-2 leading-relaxed mb-4 flex-1 text-left">
                            {note.content}
                          </p>
                        )}

                        <div className="space-y-2 mt-auto">
                          <div className="flex flex-wrap items-center gap-2 text-[8px] font-bold text-text-secondary/60 uppercase tracking-widest">
                            {project && (
                              <span className="px-2 py-0.5 bg-white/5 rounded-full">{project.name}</span>
                            )}
                            {activity && (
                              <span className="px-2 py-0.5 bg-white/5 rounded-full">{activity.name}</span>
                            )}
                          </div>
                          <p className="text-[9px] font-bold text-primary-green/40 uppercase tracking-widest text-left">
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
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
                      <CustomSelect
                        value={noteProjectId}
                        onChange={val => {
                          setNoteProjectId(val);
                          setNoteActivityId('');
                        }}
                        placeholder="Sem Projeto"
                        options={[
                          { value: '', label: 'Sem Projeto' },
                          ...dataStore.projects.map(p => ({ value: p.id, label: p.name }))
                        ]}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-text-secondary/40">Atividade (opcional)</label>
                      <CustomSelect
                        value={noteActivityId}
                        onChange={val => setNoteActivityId(val)}
                        placeholder="Sem Atividade"
                        options={[
                          { value: '', label: 'Sem Atividade' },
                          ...(noteProjectId ? dataStore.activities.filter(a => a.project_id === noteProjectId) : dataStore.activities).map(act => ({ value: act.id, label: act.name }))
                        ]}
                      />
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
                    Ok
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
                   <CustomSelect 
                    className="w-full md:w-64"
                    value={filterProject}
                    onChange={val => setFilterProject(val)}
                    placeholder="Filtrar Projeto"
                    options={[
                      { value: '', label: 'Filtrar Projeto' },
                      ...dataStore.projects.map(p => ({ value: p.id, label: p.name }))
                    ]}
                  />
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

              {/* Note Selection controls bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-white/[0.02] border border-white/5 rounded-2.5xl font-sans select-none animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="flex items-center gap-4 flex-wrap">
                  <span className="text-xs sm:text-sm font-bold text-text-primary">
                    {selectedNotes.size} {selectedNotes.size === 1 ? 'anotação selecionada' : 'anotações selecionadas'}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSelectAll}
                      className="text-[10px] uppercase tracking-wider font-bold text-primary-green hover:text-glow-green transition-colors cursor-pointer"
                    >
                      Selecionar Todas
                    </button>
                    <span className="text-white/10 text-xs">|</span>
                    <button
                      onClick={handleClearSelection}
                      className="text-[10px] uppercase tracking-wider font-bold text-text-secondary hover:text-white transition-colors cursor-pointer"
                    >
                      Limpar Seleção
                    </button>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    disabled={selectedNotes.size === 0}
                    onClick={() => setShowDownloadDialog(true)}
                    className="flex items-center gap-2 px-5 py-3 bg-[#6ee7a8] disabled:bg-white/[0.03] disabled:text-text-secondary/30 disabled:border-white/5 border border-primary-green/25 text-background rounded-xl text-xs font-black uppercase tracking-[0.1em] transition-all cursor-pointer shadow-[0_4px_20px_rgba(110,231,168,0.15)] disabled:shadow-none hover:brightness-110"
                  >
                    Baixar selecionadas
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-20">
                {filteredAllNotes.map(note => {
                  const project = dataStore.projects.find(p => p.id === note.project_id);
                  const activity = dataStore.activities.find(a => a.id === note.activity_id);
                  const isSelected = selectedNotes.has(note.id);
                  return (
                    <div 
                      key={note.id} 
                      onClick={() => {
                        if (editingNoteId !== note.id) {
                          handleToggleSelect(note.id);
                        }
                      }}
                      className={`group p-8 pl-14 rounded-[2rem] bg-surface/10 border transition-all flex flex-col relative ${
                        editingNoteId !== note.id ? 'cursor-pointer select-none' : ''
                      } ${
                        isSelected 
                          ? 'border-primary-green/45 bg-primary-green/[0.02] shadow-[0_4px_25px_rgba(110,231,168,0.04)]' 
                          : 'border-white/5 hover:border-primary-green/20'
                      }`}
                    >
                      {/* Custom indicator checkbox */}
                      {editingNoteId !== note.id && (
                        <div 
                          className="absolute top-8 left-5 transition-all duration-200"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleSelect(note.id);
                          }}
                        >
                          <div 
                            className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                              isSelected
                                ? 'bg-primary-green border-primary-green text-background animate-in zoom-in duration-150'
                                : 'border-white/20 group-hover:border-primary-green/50 text-transparent'
                            }`}
                          >
                            <svg className="w-3.5 h-3.5 stroke-current" fill="none" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" strokeWidth={3} />
                            </svg>
                          </div>
                        </div>
                      )}

                      {editingNoteId !== note.id && (
                        <>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyNote(note);
                            }}
                            title="Copiar para área de transferência"
                            className="absolute top-6 right-26 p-3 text-text-secondary/40 hover:text-primary-green hover:bg-white/5 rounded-xl transition-all cursor-pointer"
                          >
                            <Copy size={20} />
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingNoteId(note.id);
                              setEditingNoteContent(note.content);
                            }}
                            className="absolute top-6 right-16 p-3 text-primary-green/40 hover:text-primary-green hover:bg-primary-green/10 rounded-xl transition-all"
                          >
                            <Pencil size={20} />
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteConfirm(note.id, note.content);
                            }}
                            className="absolute top-6 right-6 p-3 text-red-500/40 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                          >
                            <Trash2 size={20} />
                          </button>
                        </>
                      )}
                      
                      {editingNoteId === note.id ? (
                        <div className="space-y-4 flex-1 mb-6">
                          <textarea
                            className="w-full bg-surface/60 border border-primary-green/40 p-4 rounded-[1.5rem] text-text-primary text-base font-light outline-none resize-none h-32 focus:border-primary-green"
                            value={editingNoteContent}
                            onChange={e => setEditingNoteContent(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            autoFocus
                          />
                          <div className="flex justify-end gap-3" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => setEditingNoteId(null)}
                              className="px-4 py-2 border border-white/10 rounded-xl text-xs font-bold uppercase tracking-widest text-text-secondary hover:text-white transition-colors min-h-[44px]"
                            >
                              Cancelar
                            </button>
                            <button
                              onClick={() => handleUpdateNote(note.id)}
                              className="px-4 py-2 bg-primary-green text-background rounded-xl text-xs font-bold uppercase tracking-widest transition-colors min-h-[44px] animate-pulse"
                            >
                              Ok
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-text-primary/90 font-light text-base leading-relaxed whitespace-pre-wrap flex-1 mb-8">
                          {note.content}
                        </p>
                      )}
                      
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

      {/* Download Mode Selection Dialog */}
      <AnimatePresence>
        {showDownloadDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1500] bg-background/90 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-surface border border-white/10 rounded-[2rem] p-6 max-w-sm w-full space-y-6 text-center shadow-2xl relative"
            >
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-text-primary tracking-tight">Exportar Anotações</h3>
                <p className="text-xs text-text-secondary/60">
                  Você selecionou <strong className="text-primary-green">{selectedNotes.size}</strong> {selectedNotes.size === 1 ? 'anotação' : 'anotações'}. Como deseja baixá-las?
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  onClick={downloadAsSingleFile}
                  className="w-full py-3.5 bg-white/5 border border-white/10 hover:border-primary-green/35 hover:bg-white/[0.08] text-text-primary rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <Download size={14} className="text-primary-green" />
                  Arquivo único (.md)
                </button>
                <button
                  onClick={downloadAsZip}
                  className="w-full py-3.5 bg-white/5 border border-white/10 hover:border-primary-green/35 hover:bg-white/[0.08] text-text-primary rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <Download size={14} className="text-primary-green" />
                  Arquivos separados (.zip)
                </button>
              </div>

              <div className="pt-2 border-t border-white/5">
                <button
                  onClick={() => setShowDownloadDialog(false)}
                  className="w-full py-2.5 bg-transparent hover:text-white text-text-secondary/60 text-xs font-bold uppercase tracking-widest transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};
