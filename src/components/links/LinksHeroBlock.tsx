import React, { useState } from 'react';
import { useDataStore } from '../../store/useDataStore';
import { useAuthStore } from '../../store/useAuthStore';
import { Link2, Plus, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const LinksHeroBlock = () => {
  const { user } = useAuthStore();
  const { projects, habits, savedLinks, addLink, registerLinkAccess } = useDataStore();

  const [showAddModal, setShowAddModal] = useState(false);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [projectId, setProjectId] = useState('');
  const [habitId, setHabitId] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Top 3 most accessed links
  const topLinks = [...savedLinks]
    .sort((a, b) => {
      if (b.access_count !== a.access_count) {
        return b.access_count - a.access_count;
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    })
    .slice(0, 3);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!title.trim() || !url.trim()) {
      alert('Por favor, preencha o Nome e a URL.');
      return;
    }

    setIsSaving(true);
    try {
      const result = await addLink(user.id, {
        title: title.trim(),
        url: url.trim(),
        projectId: projectId || null,
        habitId: habitId || null,
      });

      if (result) {
        setTitle('');
        setUrl('');
        setProjectId('');
        setHabitId('');
        setShowAddModal(false);
      }
    } catch (err) {
      console.error('Erro ao salvar link:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleLinkClick = (link: any) => {
    registerLinkAccess(link.id);
    window.open(link.url, '_blank', 'noopener,noreferrer');
  };

  const handleVerTodos = () => {
    window.dispatchEvent(
      new CustomEvent('open-action-center', { detail: { screen: 'links-list' } })
    );
  };

  const inputClasses = "w-full bg-white/5 border border-white/20 rounded-2xl p-4 text-text-primary outline-none focus:border-primary-green transition-all placeholder:text-text-secondary/50 touch-manipulation min-h-[44px]";
  const labelClasses = "text-[10px] font-bold uppercase tracking-widest text-text-secondary opacity-70 mb-2 block";
  const selectClasses = "w-full bg-white/5 border border-white/20 rounded-2xl p-4 text-text-primary outline-none focus:border-primary-green transition-all touch-manipulation min-h-[44px] cursor-pointer appearance-none px-4";

  return (
    <section id="links-hero-block" className="w-full max-w-5xl space-y-4 font-sans">
      <div className="w-full p-6 bg-surface/20 border border-border-white rounded-3xl space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-text-secondary/60">
              <Link2 size={18} />
            </div>
            <div className="text-left">
              <h3 className="text-lg font-semibold text-text-primary tracking-tight">🔗 Links Importantes</h3>
              <p className="text-xs text-text-secondary/60 mt-0.5">
                Acesse rapidamente seus atalhos mais utilizados
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="hero-add-link-btn"
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold uppercase tracking-wider text-text-primary border border-white/5 hover:border-primary-green/30 transition-all cursor-pointer"
            >
              <Plus size={14} className="text-primary-green" />
              Salvar Link
            </button>

            {savedLinks.length > 0 && (
              <button
                id="hero-ver-todos-btn"
                onClick={handleVerTodos}
                className="px-4 py-2.5 border border-primary-green/20 hover:border-primary-green/40 hover:bg-primary-green/5 text-primary-green rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
              >
                Ver Todos
              </button>
            )}
          </div>
        </div>

        {/* Top Links Preview */}
        {topLinks.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {topLinks.map((link) => (
              <div
                key={link.id}
                id={`hero-preview-link-${link.id}`}
                onClick={() => handleLinkClick(link)}
                className="group relative flex flex-col justify-between bg-surface/30 hover:bg-surface/50 border border-white/5 hover:border-primary-green/35 rounded-2xl p-5 cursor-pointer transition-all duration-300 overflow-hidden"
              >
                <div className="space-y-1 text-left">
                  <div className="flex items-center justify-between gap-2 overflow-hidden">
                    <span className="text-sm font-bold text-text-primary group-hover:text-primary-green transition-colors truncate">
                      {link.title}
                    </span>
                    <ExternalLink size={12} className="text-text-secondary/40 group-hover:text-primary-green transition-colors flex-shrink-0 animate-pulse" />
                  </div>
                  <span className="text-[10px] text-text-secondary/50 font-mono block truncate">
                    {link.url}
                  </span>
                </div>

                <div className="mt-4 flex items-center justify-between text-[8px] font-mono uppercase text-text-secondary/40">
                  <span className="bg-white/5 px-2 py-0.5 rounded-full">
                    {link.access_count} {link.access_count === 1 ? 'acesso' : 'acessos'}
                  </span>
                  {link.project_id && (
                    <span className="text-primary-green/60">
                      📂 {projects.find(p => p.id === link.project_id)?.name || 'Projeto'}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 bg-white/5 rounded-2xl border border-white/5 space-y-2">
            <p className="text-xs text-text-secondary/60">Nenhum link cadastrado.</p>
            <p className="text-[10px] text-text-secondary/40 uppercase tracking-wider">Configure seus primeiros atalhos para aparecerem aqui</p>
          </div>
        )}
      </div>

      {/* Quick Add Popup Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div id="quick-add-link-backdrop" className="fixed inset-0 z-[600] flex items-center justify-center bg-background/90 backdrop-blur-md p-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              id="quick-add-link-modal"
              className="w-full max-w-md bg-background border border-white/10 rounded-[2.5rem] p-8 space-y-6 shadow-2xl relative"
            >
              <div className="text-center">
                <h4 className="text-lg font-bold text-text-primary uppercase tracking-wider">Configurar Atalho</h4>
                <p className="text-xs text-text-secondary/60 mt-1">Insira os dados do seu novo atalho rápido</p>
              </div>

              <form onSubmit={handleSave} className="space-y-4">
                <div className="space-y-1 text-left">
                  <label className={labelClasses}>Nome</label>
                  <input
                    id="quick-link-name-input"
                    type="text"
                    placeholder="Nome do link"
                    className={inputClasses}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    autoComplete="off"
                  />
                </div>

                <div className="space-y-1 text-left">
                  <label className={labelClasses}>Link (URL)</label>
                  <input
                    id="quick-link-url-input"
                    type="text"
                    placeholder="Cole o link aqui"
                    className={inputClasses}
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    required
                    autoComplete="off"
                    inputMode="url"
                  />
                </div>

                <div className="space-y-1 text-left relative">
                  <label className={labelClasses}>Projeto (Opcional)</label>
                  <div className="relative">
                    <select
                      id="quick-link-project-select"
                      className={selectClasses}
                      value={projectId}
                      onChange={(e) => setProjectId(e.target.value)}
                    >
                      <option value="">Nenhum Projeto</option>
                      {projects.map((proj) => (
                        <option key={proj.id} value={proj.id}>
                          {proj.name}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-text-secondary">
                      ▼
                    </div>
                  </div>
                </div>

                <div className="space-y-1 text-left relative">
                  <label className={labelClasses}>Hábito (Opcional)</label>
                  <div className="relative">
                    <select
                      id="quick-link-habit-select"
                      className={selectClasses}
                      value={habitId}
                      onChange={(e) => setHabitId(e.target.value)}
                    >
                      <option value="">Nenhum Hábito</option>
                      {habits.map((h) => (
                        <option key={h.id} value={h.id}>
                          {h.name}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-text-secondary">
                      ▼
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex gap-4">
                  <button
                    id="quick-cancel-link-btn"
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-text-primary rounded-2xl font-bold uppercase tracking-widest text-[10px] transition-all min-h-[44px]"
                  >
                    Cancelar
                  </button>
                  <button
                    id="quick-save-link-btn"
                    type="submit"
                    disabled={isSaving}
                    className="flex-1 py-4 bg-primary-green hover:bg-primary-green/90 text-background rounded-2xl font-bold uppercase tracking-widest text-[10px] transition-all min-h-[44px] disabled:opacity-50"
                  >
                    {isSaving ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </section>
  );
};
