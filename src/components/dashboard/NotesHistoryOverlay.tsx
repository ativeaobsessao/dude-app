import React, { useState, useEffect } from 'react';
import { useDataStore } from '../../store/useDataStore';
import { useAuthStore } from '../../store/useAuthStore';
import { StickyNote, X, Trash2, ArrowLeft, Pencil, Copy, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { CustomSelect } from '../ui/CustomSelect';
import { getLocalDateString, safeParseDate } from '../../lib/utils';
import JSZip from 'jszip';

interface NotesHistoryOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotesHistoryOverlay: React.FC<NotesHistoryOverlayProps> = ({ isOpen, onClose }) => {
  const { user } = useAuthStore();
  const dataStore = useDataStore();

  const [filterProject, setFilterProject] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterActivity, setFilterActivity] = useState('');

  // Note Editing State
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteContent, setEditingNoteContent] = useState('');

  // Selection and Download State
  const [selectedNotes, setSelectedNotes] = useState<Set<string>>(new Set());
  const [showDownloadDialog, setShowDownloadDialog] = useState(false);

  // Monitor visibility to reset search filters when closed
  useEffect(() => {
    if (!isOpen) {
      setFilterProject('');
      setFilterDate('');
      setFilterActivity('');
      setSelectedNotes(new Set());
      setEditingNoteId(null);
      setEditingNoteContent('');
      setShowDownloadDialog(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredAllNotes = dataStore.notes.filter(note => {
    const matchesProject = filterProject ? note.project_id === filterProject : true;
    const noteDateStr = note.target_date || getLocalDateString(note.created_at);
    const matchesDate = filterDate ? noteDateStr === filterDate : true;
    const matchesActivity = filterActivity ? note.activity_id === filterActivity : true;
    return matchesProject && matchesDate && matchesActivity;
  });

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

  const formatDate = (date: string | null) => {
    if (!date) return '';
    return safeParseDate(date).toLocaleDateString('pt-BR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).replace('.', '');
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
    
    const formattedDate = safeParseDate(note.target_date || note.created_at).toLocaleDateString('pt-BR', {
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

  const handleDeleteConfirm = async (id: string, content: string) => {
    if (window.confirm(`Deseja excluir esta anotação?\n"${content.substring(0, 30)}..."\nEsta ação não pode ser desfeita.`)) {
      await dataStore.deleteNote(id);
    }
  };

  return (
    <>
      <div className="fixed inset-x-0 top-0 bottom-20 z-[210] bg-[#0c100e]/98 backdrop-blur-3xl flex flex-col items-center px-6 py-12 overflow-y-auto">
        <div className="w-full max-w-4xl space-y-12 pb-20">
          <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 border-b border-white/5 pb-8 relative">
            <div className="flex items-center gap-4">
              <button 
                onClick={onClose}
                className="flex items-center gap-2 text-text-secondary hover:text-primary-green transition-colors font-bold uppercase tracking-widest text-[10px] cursor-pointer outline-none"
              >
                <ArrowLeft size={16} /> Voltar
              </button>
              <div className="flex items-center gap-3">
                <StickyNote className="text-primary-green" />
                <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-text-primary font-sans">Anotações (Histórico)</h2>
              </div>
            </div>
            
            <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto flex-wrap md:flex-nowrap">
              <CustomSelect 
                className="w-full md:w-48 text-xs h-10"
                value={filterProject}
                onChange={val => setFilterProject(val)}
                placeholder="Filtrar Projeto"
                options={[
                  { value: '', label: 'Filtrar Projeto' },
                  ...dataStore.projects.map(p => ({ value: p.id, label: p.name }))
                ]}
              />
              <CustomSelect 
                className="w-full md:w-48 text-xs h-10"
                value={filterActivity}
                onChange={val => setFilterActivity(val)}
                placeholder="Filtrar Atividade"
                options={[
                  { value: '', label: 'Filtrar Atividade' },
                  ...dataStore.activities.map(a => ({ value: a.id, label: a.name }))
                ]}
              />
              <input
                type="date"
                className="w-full md:w-auto bg-white/5 border border-white/10 rounded-full px-4 py-2 text-xs text-text-primary outline-none focus:border-primary-green touch-manipulation min-h-[40px]"
                value={filterDate}
                onChange={e => setFilterDate(e.target.value)}
              />
              <button
                onClick={onClose}
                className="absolute -top-4 -right-4 w-10 h-10 rounded-full border border-border-white flex items-center justify-center text-text-secondary hover:text-text-primary transition-all cursor-pointer outline-none"
              >
                <X size={18} />
              </button>
            </div>
          </header>

          {/* Note Selection controls bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-white/[0.02] border border-white/5 rounded-2.5xl font-sans select-none">
            <div className="flex items-center gap-4 flex-wrap">
              <span className="text-xs sm:text-sm font-bold text-text-primary">
                {selectedNotes.size} {selectedNotes.size === 1 ? 'anotação selecionada' : 'anotações selecionadas'}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSelectAll}
                  className="text-[10px] uppercase tracking-wider font-bold text-primary-green hover:text-glow-green transition-colors cursor-pointer outline-none"
                >
                  Selecionar Todas
                </button>
                <span className="text-white/10 text-xs">|</span>
                <button
                  onClick={handleClearSelection}
                  className="text-[10px] uppercase tracking-wider font-bold text-text-secondary hover:text-white transition-colors cursor-pointer outline-none"
                >
                  Limpar Seleção
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                disabled={selectedNotes.size === 0}
                onClick={() => setShowDownloadDialog(true)}
                className="flex items-center gap-2 px-5 py-3 bg-[#6ee7a8] disabled:bg-white/[0.03] disabled:text-text-secondary/30 disabled:border-white/5 border border-primary-green/25 text-background rounded-xl text-xs font-black uppercase tracking-[0.1em] transition-all cursor-pointer shadow-[0_4px_20px_rgba(110,231,168,0.15)] disabled:shadow-none hover:brightness-110 outline-none"
              >
                Baixar selecionadas
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                    <div className="flex justify-between items-center gap-4 mb-3 border-b border-white/5 pb-2">
                      <div className="text-[10px] font-bold text-text-secondary/40 uppercase tracking-widest flex items-center gap-2">
                        Anotação
                      </div>
                      <div className="flex items-center gap-1.5 relative z-10">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyNote(note);
                          }}
                          title="Copiar para área de transferência"
                          className="p-1.5 text-text-secondary/50 hover:text-primary-green hover:bg-white/5 rounded-lg transition-all cursor-pointer outline-none"
                        >
                          <Copy size={16} />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingNoteId(note.id);
                            setEditingNoteContent(note.content);
                          }}
                          title="Editar Anotação"
                          className="p-1.5 text-primary-green/50 hover:text-primary-green hover:bg-primary-green/10 rounded-lg transition-all cursor-pointer outline-none"
                        >
                          <Pencil size={16} />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteConfirm(note.id, note.content);
                          }}
                          title="Excluir Anotação"
                          className="p-1.5 text-red-500/50 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all cursor-pointer outline-none"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {editingNoteId === note.id ? (
                    <div className="space-y-4 flex-1 mb-6">
                      <textarea
                        className="w-full bg-surface/60 border border-primary-green/40 p-4 rounded-[1.5rem] text-text-primary text-[1rem]/[1.5rem] font-light outline-none resize-none h-32 focus:border-primary-green"
                        value={editingNoteContent}
                        onChange={e => setEditingNoteContent(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        autoFocus
                      />
                      <div className="flex justify-end gap-3" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setEditingNoteId(null)}
                          className="px-4 py-2 border border-white/10 rounded-xl text-xs font-bold uppercase tracking-widest text-text-secondary hover:text-white transition-colors min-h-[44px] cursor-pointer outline-none"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={() => handleUpdateNote(note.id)}
                          className="px-4 py-2 bg-primary-green text-background rounded-xl text-xs font-bold uppercase tracking-widest transition-colors min-h-[44px] animate-pulse cursor-pointer outline-none"
                        >
                          Ok
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-text-primary/90 font-light text-[1rem]/[1.5rem] leading-relaxed whitespace-pre-wrap flex-1 mb-8">
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
              <div className="col-span-full py-20 text-center text-text-secondary/20 italic font-sans text-sm">
                Nenhuma anotação encontrada com os filtros selecionados.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Download Mode Selection Dialog */}
      <AnimatePresence>
        {showDownloadDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1500] bg-background/90 backdrop-blur-md flex items-center justify-center p-4 text-center"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-surface border border-white/10 rounded-[2rem] p-6 max-w-sm w-full space-y-6 text-center shadow-2xl relative"
            >
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-text-primary tracking-tight font-sans">Exportar Anotações</h3>
                <p className="text-xs text-text-secondary/60 font-sans">
                  Você selecionou <strong className="text-primary-green">{selectedNotes.size}</strong> {selectedNotes.size === 1 ? 'anotação' : 'anotações'}. Como deseja baixá-las?
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  onClick={downloadAsSingleFile}
                  className="w-full py-3.5 bg-white/5 border border-white/10 hover:border-primary-green/35 hover:bg-white/[0.08] text-text-primary rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 outline-none"
                >
                  <Download size={14} className="text-primary-green" />
                  Arquivo único (.md)
                </button>
                <button
                  onClick={downloadAsZip}
                  className="w-full py-3.5 bg-white/5 border border-white/10 hover:border-primary-green/35 hover:bg-white/[0.08] text-text-primary rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 outline-none"
                >
                  <Download size={14} className="text-primary-green" />
                  Arquivos separados (.zip)
                </button>
              </div>

              <div className="pt-2 border-t border-white/5">
                <button
                  onClick={() => setShowDownloadDialog(false)}
                  className="w-full py-2.5 bg-transparent hover:text-white text-text-secondary/60 text-xs font-bold uppercase tracking-widest transition-colors cursor-pointer outline-none"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
