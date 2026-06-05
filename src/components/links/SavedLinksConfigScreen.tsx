import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useDataStore } from '../../store/useDataStore';
import { useAuthStore } from '../../store/useAuthStore';
import { CustomSelect } from '../ui/CustomSelect';

interface SavedLinksConfigScreenProps {
  onBack: () => void;
  onNavigateToViewAll: () => void;
}

export const SavedLinksConfigScreen: React.FC<SavedLinksConfigScreenProps> = ({
  onBack,
  onNavigateToViewAll,
}) => {
  const { user } = useAuthStore();
  const { projects, habits, addLink } = useDataStore();

  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [projectId, setProjectId] = useState<string>('');
  const [habitId, setHabitId] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  const inputClasses = "w-full bg-white/5 border border-white/20 rounded-2xl p-4 text-text-primary outline-none focus:border-primary-green transition-all placeholder:text-text-secondary/50 touch-manipulation min-h-[44px]";
  const labelClasses = "text-[10px] font-bold uppercase tracking-widest text-text-secondary opacity-70 mb-2 block";

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!title.trim() || !url.trim()) {
      alert('Por favor, preencha o Nome e a URL do link.');
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
      }
    } catch (err) {
      console.error('Erro ao salvar link:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div id="saved-links-config-screen" className="w-full max-w-2xl space-y-10">
      {/* Botão de voltar */}
      <div className="flex justify-start">
        <button
          id="saved-links-back-btn"
          onClick={onBack}
          className="flex items-center gap-2 text-text-secondary hover:text-primary-green transition-colors font-bold uppercase tracking-widest text-[10px]"
        >
          <ArrowLeft size={16} /> Voltar ao Menu
        </button>
      </div>

      <div className="text-center space-y-2">
        <h3 id="saved-links-title" className="text-3xl font-bold tracking-tight text-text-primary uppercase tracking-[0.2em]">
          Organizador de Links
        </h3>
        <p className="text-xs text-text-secondary/60 max-w-md mx-auto">
          Cadastre seus links mais importantes para acessar sempre que precisar de forma ágil e centralizada.
        </p>
      </div>

      <form onSubmit={handleSave} className="bg-surface/10 p-8 rounded-[2.5rem] border border-white/5 space-y-6">
        <div className="space-y-1 text-left">
          <label className={labelClasses}>Nome</label>
          <input
            id="link-name-input"
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
            id="link-url-input"
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

        <div className="space-y-1 text-left">
          <label className={labelClasses}>Projeto (Opcional)</label>
          <CustomSelect
            options={[
              { value: '', label: 'Nenhum Projeto' },
              ...projects.map((proj) => ({ value: proj.id, label: proj.name })),
            ]}
            value={projectId}
            onChange={(val) => setProjectId(val)}
          />
        </div>

        <div className="space-y-1 text-left">
          <label className={labelClasses}>Hábito (Opcional)</label>
          <CustomSelect
            options={[
              { value: '', label: 'Nenhum Hábito' },
              ...habits.map((h) => ({ value: h.id, label: h.name })),
            ]}
            value={habitId}
            onChange={(val) => setHabitId(val)}
          />
        </div>

        <div className="pt-4 space-y-4">
          <button
            id="save-link-btn"
            type="submit"
            disabled={isSaving}
            className="w-full py-5 bg-primary-green hover:bg-primary-green/90 text-background rounded-2xl font-bold uppercase tracking-widest text-[10px] transition-all min-h-[44px] disabled:opacity-50"
          >
            {isSaving ? 'Ok...' : 'Ok'}
          </button>

          <button
            id="view-all-links-btn"
            type="button"
            onClick={onNavigateToViewAll}
            className="w-full py-4 border border-white/20 hover:border-white/40 text-text-primary rounded-2xl font-bold uppercase tracking-widest text-[10px] transition-all min-h-[44px]"
          >
            Ver Todas
          </button>
        </div>
      </form>
    </div>
  );
};
