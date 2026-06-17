import React, { useState } from 'react';
import { useDataStore } from '../../store/useDataStore';
import { useAuthStore } from '../../store/useAuthStore';
import { X, ArrowLeft, Send, Link as LinkIcon, FileText, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface QuickCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QuickCaptureModal: React.FC<QuickCaptureModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuthStore();
  const { addNote, addLink, showNotification } = useDataStore();

  const [view, setView] = useState<'menu' | 'note' | 'link'>('menu');

  // Input states
  const [noteContent, setNoteContent] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleSaveNote = async (val?: string) => {
    if (!user) return;
    const content = (typeof val === 'string' ? val : noteContent).trim();
    if (!content) return;
    setIsSaving(true);
    try {
      const result = await addNote(user.id, content);
      if (result) {
        showNotification('Anotação capturada com sucesso! ⚡', 'success');
        setNoteContent('');
      }
    } catch (err) {
      console.error('Erro ao salvar anotação:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveLink = async (titleVal?: string, urlVal?: string) => {
    if (!user) return;
    const finalTitle = (typeof titleVal === 'string' ? titleVal : linkTitle).trim();
    const finalUrl = (typeof urlVal === 'string' ? urlVal : linkUrl).trim();
    if (!finalTitle || !finalUrl) return;

    setIsSaving(true);
    try {
      const result = await addLink(user.id, {
        title: finalTitle,
        url: finalUrl,
        projectId: null,
        habitId: null
      });
      if (result) {
        showNotification('Link guardado com sucesso! ⚡', 'success');
        setLinkTitle('');
        setLinkUrl('');
      }
    } catch (err) {
      console.error('Erro ao salvar link:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleNavigateToNotesHistory = () => {
    onClose();
    // Dispatch events to open the existing notes screens
    window.dispatchEvent(new CustomEvent('open-action-center', { detail: { screen: 'notes' } }));
    window.dispatchEvent(new CustomEvent('open-notes-history'));
  };

  const handleNavigateToLinksHistory = () => {
    onClose();
    // Dispatch event to open existing links list screen
    window.dispatchEvent(new CustomEvent('open-action-center', { detail: { screen: 'links-list' } }));
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[600] bg-background/80 backdrop-blur-md flex items-end sm:items-center justify-center p-4 text-left"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, y: 50 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: 50 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className="bg-surface/95 border border-white/5 rounded-t-3xl sm:rounded-3xl w-full max-w-lg p-6 space-y-6 shadow-2xl overflow-y-auto max-h-[85vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex justify-between items-center border-b border-white/5 pb-4">
            <div className="flex items-center gap-2">
              <Zap size={16} className="text-[#6ee7a8] fill-[#6ee7a8]/20 animate-pulse" />
              <h3 className="text-sm font-bold uppercase tracking-widest text-[#6ee7a8]">
                Captura Rápida
              </h3>
            </div>
            <button
              id="quick-capture-close-btn"
              onClick={onClose}
              className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-white/5 rounded-lg transition-all cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          {/* Views */}
          {view === 'menu' && (
            <div className="space-y-4 py-2">
              <p className="text-xs text-text-secondary/60 text-center mb-2">
                O que você deseja capturar neste momento?
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  id="menu-btn-note"
                  onClick={() => setView('note')}
                  className="p-6 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 rounded-2xl flex flex-col items-center justify-center gap-3 transition-all group cursor-pointer active:scale-95"
                >
                  <div className="p-3 bg-[#6ee7a8]/5 text-[#6ee7a8] rounded-xl group-hover:bg-[#6ee7a8]/10 transition-colors">
                    <FileText size={24} />
                  </div>
                  <span className="text-sm font-semibold text-text-primary">📝 Anotações</span>
                  <span className="text-[10px] text-text-secondary/50 font-medium">Salvar insights e lições</span>
                </button>

                <button
                  id="menu-btn-link"
                  onClick={() => setView('link')}
                  className="p-6 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 rounded-2xl flex flex-col items-center justify-center gap-3 transition-all group cursor-pointer active:scale-95"
                >
                  <div className="p-3 bg-[#6ee7a8]/5 text-[#6ee7a8] rounded-xl group-hover:bg-[#6ee7a8]/10 transition-colors">
                    <LinkIcon size={24} />
                  </div>
                  <span className="text-sm font-semibold text-text-primary">🔗 Links Úteis</span>
                  <span className="text-[10px] text-text-secondary/50 font-medium">Guardar referências rápidas</span>
                </button>
              </div>
            </div>
          )}

          {view === 'note' && (
            <div className="space-y-5 animate-fade-in text-left">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-[#6a7570]">Sua Anotação</label>
                <textarea
                  id="quick-note-textarea"
                  rows={4}
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="Escreva seu insight ou ideia genial..."
                  enterKeyHint="done"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSaveNote();
                      e.currentTarget.blur();
                    }
                  }}
                  onBlur={(e) => {
                    handleSaveNote(e.target.value);
                  }}
                  className="w-full bg-surface/50 border border-white/5 rounded-xl py-3 px-4 text-sm text-text-primary outline-none focus:border-primary-green transition-all placeholder:text-text-secondary/30 resize-none min-h-[100px]"
                  autoFocus
                />
              </div>

              <div className="space-y-3">
                <button
                  id="quick-note-save-btn"
                  onClick={() => handleSaveNote()}
                  disabled={isSaving || !noteContent.trim()}
                  className="w-full py-4 bg-[#6ee7a8] hover:bg-[#6ee7a8]/90 text-background rounded-2xl font-bold uppercase tracking-widest text-[10px] transition-all min-h-[44px] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
                >
                  <Send size={12} /> {isSaving ? 'Salvando...' : 'Salvar Anotação'}
                </button>

                <button
                  id="quick-note-history-btn"
                  onClick={handleNavigateToNotesHistory}
                  className="w-full py-3 bg-transparent hover:bg-white/5 text-[#6ee7a8] font-bold uppercase tracking-widest text-[9px] rounded-xl transition-all border border-white/5 cursor-pointer flex items-center justify-center"
                >
                  Ver Histórico de Notas
                </button>
              </div>

              {/* Botão voltar no rodapé */}
              <div className="border-t border-white/5 pt-4 flex justify-between items-center">
                <button
                  id="quick-note-back-btn"
                  onClick={() => setView('menu')}
                  className="flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                >
                  <ArrowLeft size={14} /> Voltar ao Menu
                </button>
              </div>
            </div>
          )}

          {view === 'link' && (
            <div className="space-y-4 animate-fade-in text-left">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-[#6a7570]">Nome do Link</label>
                <input
                  id="quick-link-title"
                  type="text"
                  value={linkTitle}
                  onChange={(e) => setLinkTitle(e.target.value)}
                  placeholder="Ex: Documentação Tailwind"
                  className="w-full bg-surface/50 border border-white/5 rounded-xl py-3 px-4 text-sm text-text-primary outline-none focus:border-primary-green transition-all placeholder:text-text-secondary/30"
                  enterKeyHint="done"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSaveLink();
                      e.currentTarget.blur();
                    }
                  }}
                  onBlur={(e) => {
                    if (e.target.value.trim() && linkUrl.trim()) {
                      handleSaveLink(e.target.value, linkUrl);
                    }
                  }}
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-[#6a7570]">Endereço (URL)</label>
                <input
                  id="quick-link-url"
                  type="text"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="Ex: tailwindcss.com"
                  className="w-full bg-surface/50 border border-white/5 rounded-xl py-3 px-4 text-sm text-text-primary outline-none focus:border-primary-green transition-all placeholder:text-text-secondary/30"
                  enterKeyHint="done"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSaveLink();
                      e.currentTarget.blur();
                    }
                  }}
                  onBlur={(e) => {
                    if (linkTitle.trim() && e.target.value.trim()) {
                      handleSaveLink(linkTitle, e.target.value);
                    }
                  }}
                />
              </div>

              <div className="space-y-3 pt-2">
                <button
                  id="quick-link-save-btn"
                  onClick={() => handleSaveLink()}
                  disabled={isSaving || !linkTitle.trim() || !linkUrl.trim()}
                  className="w-full py-4 bg-[#6ee7a8] hover:bg-[#6ee7a8]/90 text-background rounded-2xl font-bold uppercase tracking-widest text-[10px] transition-all min-h-[44px] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
                >
                  <Send size={12} /> {isSaving ? 'Salvando...' : 'Salvar Link'}
                </button>

                <button
                  id="quick-link-history-btn"
                  onClick={handleNavigateToLinksHistory}
                  className="w-full py-3 bg-transparent hover:bg-white/5 text-[#6ee7a8] font-bold uppercase tracking-widest text-[9px] rounded-xl transition-all border border-white/5 cursor-pointer flex items-center justify-center"
                >
                  Ver Todos os Links
                </button>
              </div>

              {/* Botão voltar no rodapé */}
              <div className="border-t border-white/5 pt-4 flex justify-between items-center">
                <button
                  id="quick-link-back-btn"
                  onClick={() => setView('menu')}
                  className="flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                >
                  <ArrowLeft size={14} /> Voltar ao Menu
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
