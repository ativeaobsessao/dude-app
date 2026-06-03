import React, { useState, useMemo } from 'react';
import { ArrowLeft, Pencil, Trash2, ExternalLink, Link2, Folder, Sparkles } from 'lucide-react';
import { useDataStore } from '../../store/useDataStore';
import { useAuthStore } from '../../store/useAuthStore';
import { SavedLink } from '../../types';

interface LinksListScreenProps {
  onBack: () => void; // Returns to config screen (Tela A)
}

export const LinksListScreen: React.FC<LinksListScreenProps> = ({ onBack }) => {
  const { user } = useAuthStore();
  const { projects, habits, savedLinks, updateLink, deleteLink, registerLinkAccess } = useDataStore();

  const [editingLink, setEditingLink] = useState<SavedLink | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editProjectId, setEditProjectId] = useState<string>('');
  const [editHabitId, setEditHabitId] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState(false);

  const inputClasses = "w-full bg-white/5 border border-white/20 rounded-2xl p-4 text-text-primary outline-none focus:border-primary-green transition-all placeholder:text-text-secondary/50 touch-manipulation min-h-[44px]";
  const labelClasses = "text-[10px] font-bold uppercase tracking-widest text-text-secondary opacity-70 mb-2 block";
  const selectClasses = "w-full bg-white/5 border border-white/20 rounded-2xl p-4 text-text-primary outline-none focus:border-primary-green transition-all touch-manipulation min-h-[44px] cursor-pointer appearance-none px-4";

  // Group links by project and sort
  const groupData = useMemo(() => {
    const projGroups = projects
      .map((proj) => {
        const projLinks = savedLinks.filter((l) => l.project_id === proj.id);
        const sortedLinks = [...projLinks].sort((a, b) => {
          if (b.access_count !== a.access_count) {
            return b.access_count - a.access_count;
          }
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
        return {
          projectId: proj.id,
          projectName: proj.name,
          links: sortedLinks,
        };
      })
      .filter((g) => g.links.length > 0);

    const unassigned = savedLinks.filter((l) => !l.project_id);
    const sortedUnassigned = [...unassigned].sort((a, b) => {
      if (b.access_count !== a.access_count) {
        return b.access_count - a.access_count;
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return {
      projects: projGroups,
      unassigned: sortedUnassigned,
    };
  }, [projects, savedLinks]);

  // Handle edit link click
  const startEdit = (link: SavedLink) => {
    setEditingLink(link);
    setEditTitle(link.title);
    setEditUrl(link.url);
    setEditProjectId(link.project_id || '');
    setEditHabitId(link.habit_id || '');
  };

  // Get habit name
  const getHabitName = (id: string | null) => {
    if (!id) return '';
    const h = habits.find((hb) => hb.id === id);
    return h ? h.name : '';
  };

  // Handle update submit
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLink) return;

    if (!editTitle.trim() || !editUrl.trim()) {
      alert('Por favor, preencha o Nome e a URL.');
      return;
    }

    setIsUpdating(true);
    try {
      const ok = await updateLink(editingLink.id, {
        title: editTitle.trim(),
        url: editUrl.trim(),
        projectId: editProjectId || null,
        habitId: editHabitId || null,
      });

      if (ok) {
        setEditingLink(null);
      }
    } catch (err) {
      console.error('Erro ao atualizar link:', err);
    } finally {
      setIsUpdating(false);
    }
  };

  // Handle delete
  const handleDelete = async (linkId: string, title: string) => {
    const confirmed = window.confirm(`Deseja realmente excluir o link "${title}"?\nEssa ação não pode ser desfeita.`);
    if (confirmed) {
      await deleteLink(linkId);
    }
  };

  // Handle click on card
  const handleCardClick = (link: SavedLink) => {
    registerLinkAccess(link.id);
    window.open(link.url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div id="links-list-screen" className="w-full max-w-3xl space-y-8 relative">
      {/* Back to inputs / setup (Tela A) */}
      <div className="flex justify-start">
        <button
          id="links-list-back-btn"
          onClick={onBack}
          className="flex items-center gap-2 text-text-secondary hover:text-primary-green transition-colors font-bold uppercase tracking-widest text-[10px]"
        >
          <ArrowLeft size={16} /> Cadastrar Novo Link
        </button>
      </div>

      <div className="text-center space-y-2">
        <h3 id="links-list-heading" className="text-3xl font-bold tracking-tight text-text-primary uppercase tracking-[0.2em]">
          Todos os Links
        </h3>
        <p className="text-xs text-text-secondary/60">
          Pesquise e acesse rapidamente seus atalhos salvos por projeto.
        </p>
      </div>

      <div className="space-y-12">
        {/* Render grouped by project */}
        {groupData.projects.map((group) => (
          <div key={group.projectId} className="space-y-4">
            <div className="flex items-center gap-2 border-b border-white/5 pb-2">
              <Folder size={14} className="text-primary-green opacity-80" />
              <h4 id={`project-header-${group.projectId}`} className="text-xs font-bold uppercase text-primary-green/80 tracking-widest">
                {group.projectName}
              </h4>
              <span className="text-[9px] font-mono bg-white/5 text-text-secondary px-2 py-0.5 rounded-full">
                {group.links.length} {group.links.length === 1 ? 'link' : 'links'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {group.links.map((link) => (
                <div
                  key={link.id}
                  id={`link-card-${link.id}`}
                  className="group relative flex flex-col justify-between bg-surface/30 hover:bg-surface/50 border border-white/5 hover:border-primary-green/30 rounded-2xl p-5 transition-all duration-300 pointer-events-auto"
                >
                  <div 
                    onClick={() => handleCardClick(link)} 
                    className="cursor-pointer pr-16 space-y-2 flex-grow"
                  >
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-bold text-text-primary group-hover:text-primary-green transition-colors line-clamp-1">
                        {link.title}
                      </span>
                      {link.access_count > 0 && (
                        <span className="text-[8px] font-mono uppercase bg-primary-green/10 text-primary-green px-1.5 py-0.5 rounded-full font-semibold">
                          {link.access_count} {link.access_count === 1 ? 'acesso' : 'acessos'}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-text-secondary/60 font-mono block truncate max-w-xs group-hover:text-text-secondary/90 transition-colors">
                      {link.url}
                    </span>
                    {link.habit_id && (
                      <span className="inline-flex items-center gap-1 text-[8px] font-mono uppercase bg-white/5 text-primary-green/60 px-2 py-0.5 rounded-full">
                        ⚡ {getHabitName(link.habit_id)}
                      </span>
                    )}
                  </div>

                  {/* Actions (pencil & trash) */}
                  <div className="absolute top-4 right-4 flex items-center gap-1.5">
                    <button
                      id={`edit-link-btn-${link.id}`}
                      onClick={() => startEdit(link)}
                      className="p-2 rounded-xl text-text-secondary/60 hover:text-text-primary hover:bg-white/5 transition-all cursor-pointer"
                      title="Editar"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      id={`delete-link-btn-${link.id}`}
                      onClick={() => handleDelete(link.id, link.title)}
                      className="p-2 rounded-xl text-red-500/60 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
                      title="Excluir"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Render Sem Projeto */}
        {groupData.unassigned.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-white/5 pb-2">
              <Link2 size={14} className="text-text-secondary opacity-60" />
              <h4 id="project-header-sem-projeto" className="text-xs font-bold uppercase text-text-secondary/80 tracking-widest">
                Sem Projeto
              </h4>
              <span className="text-[9px] font-mono bg-white/5 text-text-secondary px-2 py-0.5 rounded-full">
                {groupData.unassigned.length} {groupData.unassigned.length === 1 ? 'link' : 'links'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {groupData.unassigned.map((link) => (
                <div
                  key={link.id}
                  id={`link-card-${link.id}`}
                  className="group relative flex flex-col justify-between bg-surface/30 hover:bg-surface/50 border border-white/5 hover:border-primary-green/30 rounded-2xl p-5 transition-all duration-300 pointer-events-auto"
                >
                  <div 
                    onClick={() => handleCardClick(link)} 
                    className="cursor-pointer pr-16 space-y-2 flex-grow"
                  >
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-bold text-text-primary group-hover:text-primary-green transition-colors line-clamp-1 font-semibold">
                        {link.title}
                      </span>
                      {link.access_count > 0 && (
                        <span className="text-[8px] font-mono uppercase bg-primary-green/10 text-primary-green px-1.5 py-0.5 rounded-full font-semibold">
                          {link.access_count} {link.access_count === 1 ? 'acesso' : 'acessos'}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-text-secondary/60 font-mono block truncate max-w-xs group-hover:text-text-secondary/90 transition-colors">
                      {link.url}
                    </span>
                    {link.habit_id && (
                      <span className="inline-flex items-center gap-1 text-[8px] font-mono uppercase bg-white/5 text-primary-green/60 px-2 py-0.5 rounded-full">
                        ⚡ {getHabitName(link.habit_id)}
                      </span>
                    )}
                  </div>

                  {/* Actions (pencil & trash) */}
                  <div className="absolute top-4 right-4 flex items-center gap-1.5">
                    <button
                      id={`edit-link-btn-${link.id}`}
                      onClick={() => startEdit(link)}
                      className="p-2 rounded-xl text-text-secondary/60 hover:text-text-primary hover:bg-white/5 transition-all cursor-pointer"
                      title="Editar"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      id={`delete-link-btn-${link.id}`}
                      onClick={() => handleDelete(link.id, link.title)}
                      className="p-2 rounded-xl text-red-500/60 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
                      title="Excluir"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {savedLinks.length === 0 && (
          <div className="text-center py-12 bg-surface/5 rounded-3xl border border-white/5 space-y-3">
            <Link2 size={32} className="mx-auto text-text-secondary/35 stroke-[1.5]" />
            <p className="text-sm text-text-secondary/70">Nenhum link cadastrado.</p>
            <p className="text-xs text-text-secondary/40">Use o botão voltar para cadastrar seu primeiro atalho.</p>
          </div>
        )}
      </div>

      {/* Quick Edit Modal */}
      {editingLink && (
        <div id="link-edit-modal-backdrop" className="fixed inset-0 z-[600] flex items-center justify-center bg-background/90 backdrop-blur-md p-6">
          <div id="link-edit-modal" className="w-full max-w-md bg-background border border-white/10 rounded-[2.5rem] p-8 space-y-6 shadow-2xl relative">
            <div className="text-center">
              <h4 className="text-lg font-bold text-text-primary uppercase tracking-wider">Editar Link</h4>
              <p className="text-xs text-text-secondary/60 mt-1">Altere as informações do atalho selecionado</p>
            </div>

            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="space-y-1 text-left">
                <label className={labelClasses}>Nome</label>
                <input
                  id="edit-link-name-input"
                  type="text"
                  className={inputClasses}
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1 text-left">
                <label className={labelClasses}>Link (URL)</label>
                <input
                  id="edit-link-url-input"
                  type="text"
                  className={inputClasses}
                  value={editUrl}
                  onChange={(e) => setEditUrl(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1 text-left relative">
                <label className={labelClasses}>Projeto (Opcional)</label>
                <div className="relative">
                  <select
                    id="edit-link-project-select"
                    className={selectClasses}
                    value={editProjectId}
                    onChange={(e) => setEditProjectId(e.target.value)}
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
                    id="edit-link-habit-select"
                    className={selectClasses}
                    value={editHabitId}
                    onChange={(e) => setEditHabitId(e.target.value)}
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
                  id="cancel-edit-link-btn"
                  type="button"
                  onClick={() => setEditingLink(null)}
                  className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-text-primary rounded-2xl font-bold uppercase tracking-widest text-[10px] transition-all min-h-[44px]"
                >
                  Cancelar
                </button>
                <button
                  id="save-edit-link-btn"
                  type="submit"
                  disabled={isUpdating}
                  className="flex-1 py-4 bg-primary-green hover:bg-primary-green/90 text-background rounded-2xl font-bold uppercase tracking-widest text-[10px] transition-all min-h-[44px] disabled:opacity-50"
                >
                  {isUpdating ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
