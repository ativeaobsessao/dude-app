import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useShallow } from 'zustand/react/shallow';
import {
  Check,
  ChevronDown,
  Clock3,
  FolderKanban,
  Layers3,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { useDataStore } from '../../store/useDataStore';
import { useAuthStore } from '../../store/useAuthStore';
import { cleanActivityName } from '../../lib/utils';
import type { Activity, FocusSession, Project } from '../../types';

type PickerPanel = 'project' | 'activity' | null;

type ProjectActivityPickerProps = {
  projectId: string;
  activityId: string;
  onProjectChange: (projectId: string) => void;
  onActivityChange: (activityId: string) => void;
  activityDisabled?: boolean;
  className?: string;
};

const sessionTimestamp = (session: FocusSession) => {
  const value = session.completed_at || session.started_at || session.created_at;
  const timestamp = value ? new Date(value).getTime() : 0;
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const uniqueIds = (ids: Array<string | null | undefined>) =>
  Array.from(new Set(ids.filter((id): id is string => Boolean(id))));

const orderByRecentSessions = <T extends { id: string; created_at: string }>(
  items: T[],
  recentIds: string[],
  priorityId: string | null,
) => {
  const byId = new Map(items.map(item => [item.id, item]));
  const orderedIds = uniqueIds([priorityId, ...recentIds, ...items.map(item => item.id)]);
  return orderedIds.map(id => byId.get(id)).filter((item): item is T => Boolean(item));
};

export const ProjectActivityPicker = ({
  projectId,
  activityId,
  onProjectChange,
  onActivityChange,
  activityDisabled = false,
  className = '',
}: ProjectActivityPickerProps) => {
  const { projects, activities, sessions, addProject, addActivity, showNotification } = useDataStore(
    useShallow(state => ({
      projects: state.projects,
      activities: state.activities,
      sessions: state.sessions,
      addProject: state.addProject,
      addActivity: state.addActivity,
      showNotification: state.showNotification,
    })),
  );
  const user = useAuthStore(state => state.user);

  const [openPanel, setOpenPanel] = useState<PickerPanel>(null);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState<'project' | 'activity' | null>(null);
  const [draftName, setDraftName] = useState('');
  const [saving, setSaving] = useState(false);
  const [showOtherProjectActivities, setShowOtherProjectActivities] = useState(false);
  const [priorityProjectId, setPriorityProjectId] = useState<string | null>(null);
  const [priorityActivityId, setPriorityActivityId] = useState<string | null>(null);

  const selectedProject = projects.find(project => project.id === projectId) || null;
  const selectedActivity = activities.find(activity => activity.id === activityId) || null;

  const sortedSessions = useMemo(
    () => [...sessions].sort((a, b) => sessionTimestamp(b) - sessionTimestamp(a)),
    [sessions],
  );

  const recentProjectIds = useMemo(
    () => uniqueIds(sortedSessions.map(session => session.project_id)).slice(0, 5),
    [sortedSessions],
  );

  const recentActivityIds = useMemo(() => {
    const ids = uniqueIds(sortedSessions.map(session => session.activity_id));
    // Older sessions may not have activity_id. Match their saved activity name as a fallback.
    const names = new Set(
      sortedSessions
        .filter(session => !session.activity_id && session.activity_name)
        .map(session => cleanActivityName(session.activity_name).toLocaleLowerCase('pt-BR')),
    );
    const legacyMatches = activities
      .filter(activity => names.has(cleanActivityName(activity.name).toLocaleLowerCase('pt-BR')))
      .map(activity => activity.id);
    return uniqueIds([...ids, ...legacyMatches]).slice(0, 8);
  }, [activities, sortedSessions]);

  const orderedProjects = useMemo(
    () => orderByRecentSessions<Project>(projects, recentProjectIds, priorityProjectId || projectId || projects[0]?.id || null),
    [projects, recentProjectIds, priorityProjectId, projectId],
  );

  const projectScopedActivities = useMemo(() => {
    if (showOtherProjectActivities) return activities;
    return activities.filter(activity => projectId
      ? activity.project_id === projectId
      : activity.project_id === null);
  }, [activities, projectId, showOtherProjectActivities]);

  const orderedActivities = useMemo(
    () => orderByRecentSessions<Activity>(projectScopedActivities, recentActivityIds, priorityActivityId || activityId || projectScopedActivities[0]?.id || null),
    [projectScopedActivities, recentActivityIds, priorityActivityId, activityId],
  );

  const normalizedSearch = search.trim().toLocaleLowerCase('pt-BR');
  const filteredProjects = orderedProjects.filter(project =>
    project.name.toLocaleLowerCase('pt-BR').includes(normalizedSearch),
  );
  const filteredActivities = orderedActivities.filter(activity =>
    cleanActivityName(activity.name).toLocaleLowerCase('pt-BR').includes(normalizedSearch),
  );
  const recentProjectItems = filteredProjects.filter(project => recentProjectIds.includes(project.id) || project.id === priorityProjectId || project.id === projectId || project.id === projects[0]?.id);
  const otherProjectItems = filteredProjects.filter(project => !recentProjectItems.some(recent => recent.id === project.id));
  const recentActivityItems = filteredActivities.filter(activity => recentActivityIds.includes(activity.id) || activity.id === priorityActivityId || activity.id === activityId || activity.id === projectScopedActivities[0]?.id);
  const otherActivityItems = filteredActivities.filter(activity => !recentActivityItems.some(recent => recent.id === activity.id));

  const open = (panel: Exclude<PickerPanel, null>) => {
    setSearch('');
    setCreating(null);
    setDraftName('');
    setOpenPanel(current => current === panel ? null : panel);
  };

  const selectProject = (nextProjectId: string) => {
    onProjectChange(nextProjectId);
    onActivityChange('');
    setOpenPanel('activity');
    setSearch('');
    setCreating(null);
    setDraftName('');
    setShowOtherProjectActivities(false);
  };

  const selectActivity = (nextActivityId: string) => {
    const nextActivity = activities.find(activity => activity.id === nextActivityId);
    // When browsing activities from another project, keep the session relationship consistent.
    if (nextActivity && (nextActivity.project_id || '') !== projectId) {
      onProjectChange(nextActivity.project_id || '');
    }
    onActivityChange(nextActivityId);
    setOpenPanel(null);
    setSearch('');
    setCreating(null);
    setDraftName('');
    setShowOtherProjectActivities(false);
  };

  const handleCreateProject = async () => {
    const name = draftName.trim();
    if (!name || !user || saving) return;

    setSaving(true);
    try {
      const created = await addProject(user.id, name);
      if (!created) {
        showNotification('Não foi possível criar o projeto. Tente novamente.', 'error');
        return;
      }
      setPriorityProjectId(created.id);
      onProjectChange(created.id);
      onActivityChange('');
      setDraftName('');
      setSearch('');
      setCreating(null);
      setOpenPanel('activity');
      setShowOtherProjectActivities(false);
      showNotification('Projeto criado e selecionado.', 'success');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateActivity = async () => {
    const name = draftName.trim();
    if (!name || !user || saving) return;

    setSaving(true);
    try {
      const created = await addActivity(user.id, name, projectId || undefined);
      if (!created) {
        showNotification('Não foi possível criar a atividade. Tente novamente.', 'error');
        return;
      }
      setPriorityActivityId(created.id);
      onActivityChange(created.id);
      setDraftName('');
      setSearch('');
      setCreating(null);
      setOpenPanel(null);
      setShowOtherProjectActivities(false);
      showNotification('Atividade criada e selecionada.', 'success');
    } finally {
      setSaving(false);
    }
  };

  const renderSearch = (placeholder: string) => (
    <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3">
      <Search size={15} className="shrink-0 text-text-secondary/60" />
      <input
        autoFocus
        type="search"
        value={search}
        onChange={event => setSearch(event.target.value)}
        onKeyDown={event => {
          if (event.key === 'Escape') setOpenPanel(null);
          if (event.key === 'Enter') event.preventDefault();
        }}
        placeholder={placeholder}
        className="h-11 min-w-0 flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-secondary/45"
      />
      {search && (
        <button type="button" onClick={() => setSearch('')} aria-label="Limpar pesquisa" className="p-1 text-text-secondary/60 hover:text-text-primary">
          <X size={14} />
        </button>
      )}
    </div>
  );

  const renderCreateField = (kind: 'project' | 'activity') => (
    <div className="mt-3 rounded-xl border border-primary-green/20 bg-primary-green/[0.05] p-3 space-y-2">
      <label className="block text-[10px] font-bold uppercase tracking-wider text-primary-green">
        {kind === 'project' ? 'Nome do projeto' : 'Nome da atividade'}
      </label>
      <input
        autoFocus
        value={draftName}
        onChange={event => setDraftName(event.target.value)}
        onKeyDown={event => {
          if (event.key === 'Enter') {
            event.preventDefault();
            if (kind === 'project') void handleCreateProject();
            else void handleCreateActivity();
          }
          if (event.key === 'Escape') {
            setCreating(null);
            setDraftName('');
          }
        }}
        placeholder={kind === 'project' ? 'Ex.: Projeto pessoal' : 'Ex.: Revisar a interface'}
        maxLength={80}
        className="h-11 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-text-primary outline-none transition-colors focus:border-primary-green/50 placeholder:text-text-secondary/40"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => { setCreating(null); setDraftName(''); }}
          className="min-h-10 flex-1 rounded-lg border border-white/10 px-3 text-xs font-semibold text-text-secondary transition-colors hover:bg-white/5"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={!draftName.trim() || saving}
          onClick={() => kind === 'project' ? void handleCreateProject() : void handleCreateActivity()}
          className="min-h-10 flex-1 rounded-lg bg-primary-green px-3 text-xs font-bold text-background transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? 'Salvando…' : kind === 'project' ? 'Criar projeto' : 'Criar atividade'}
        </button>
      </div>
    </div>
  );

  const panelMotion = {
    initial: { opacity: 0, y: -6, height: 0 },
    animate: { opacity: 1, y: 0, height: 'auto' },
    exit: { opacity: 0, y: -4, height: 0 },
  };

  return (
    <div className={`grid grid-cols-1 gap-4 md:grid-cols-2 ${className}`}>
      <div className="min-w-0 space-y-2 text-left">
        <label className="block text-[10px] font-extrabold uppercase tracking-widest text-text-secondary/60">Projeto</label>
        <button
          type="button"
          onClick={() => open('project')}
          aria-expanded={openPanel === 'project'}
          className={`flex min-h-14 w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all ${openPanel === 'project' ? 'border-primary-green/40 bg-primary-green/[0.06]' : 'border-white/10 bg-surface/30 hover:border-white/20 hover:bg-surface/45'}`}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/5 text-primary-green">
            <FolderKanban size={17} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-text-primary">{selectedProject?.name || 'Sem projeto'}</span>
            <span className="mt-0.5 block text-[11px] text-text-secondary/55">{selectedProject ? 'Projeto selecionado' : 'Registrar como atividade geral'}</span>
          </span>
          <ChevronDown size={17} className={`shrink-0 text-text-secondary/60 transition-transform ${openPanel === 'project' ? 'rotate-180' : ''}`} />
        </button>

        <AnimatePresence initial={false}>
          {openPanel === 'project' && (
            <motion.div {...panelMotion} transition={{ duration: 0.18, ease: 'easeOut' }} className="overflow-hidden">
              <div className="rounded-2xl border border-white/10 bg-[#15191f] p-3 shadow-xl space-y-3">
                {renderSearch('Buscar projeto')}
                <div className="max-h-64 space-y-1 overflow-y-auto overscroll-contain pr-1">
                  <button
                    type="button"
                    onClick={() => selectProject('')}
                    className={`flex min-h-11 w-full items-center justify-between rounded-xl px-3 text-left text-sm transition-colors ${!projectId ? 'bg-primary-green/10 text-primary-green' : 'text-text-secondary hover:bg-white/5 hover:text-text-primary'}`}
                  >
                    <span>Sem projeto</span>
                    {!projectId && <Check size={16} />}
                  </button>
                  {recentProjectItems.length > 0 && (
                    <>
                      <p className="px-3 pb-1 pt-1 text-[9px] font-bold uppercase tracking-widest text-text-secondary/40">Acesso rápido</p>
                      {recentProjectItems.map(project => (
                        <button
                          type="button"
                          key={project.id}
                          onClick={() => selectProject(project.id)}
                          className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-3 text-left text-sm transition-colors ${project.id === projectId ? 'bg-primary-green/10 text-primary-green' : 'text-text-primary hover:bg-white/5'}`}
                        >
                          <span className="min-w-0 truncate">{project.name}</span>
                          {project.id === projectId ? <Check size={16} className="shrink-0" /> : <Clock3 size={13} className="shrink-0 text-text-secondary/40" />}
                        </button>
                      ))}
                    </>
                  )}
                  {otherProjectItems.length > 0 && (
                    <>
                      <p className="px-3 pb-1 pt-2 text-[9px] font-bold uppercase tracking-widest text-text-secondary/40">Todos os projetos</p>
                      {otherProjectItems.map(project => (
                        <button
                          type="button"
                          key={project.id}
                          onClick={() => selectProject(project.id)}
                          className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-3 text-left text-sm text-text-primary transition-colors hover:bg-white/5"
                        >
                          <span className="min-w-0 truncate">{project.name}</span>
                          {project.id === projectId && <Check size={16} className="shrink-0 text-primary-green" />}
                        </button>
                      ))}
                    </>
                  )}
                  {filteredProjects.length === 0 && normalizedSearch && (
                    <p className="px-3 py-5 text-center text-xs text-text-secondary/55">Nenhum projeto encontrado.</p>
                  )}
                </div>
                {creating === 'project' ? renderCreateField('project') : (
                  <button
                    type="button"
                    onClick={() => { setCreating('project'); setDraftName(search); }}
                    className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-primary-green/30 px-3 text-xs font-bold text-primary-green transition-colors hover:bg-primary-green/5"
                  >
                    <Plus size={15} /> Novo projeto
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="min-w-0 space-y-2 text-left">
        <label className="block text-[10px] font-extrabold uppercase tracking-widest text-text-secondary/60">Atividade</label>
        <button
          type="button"
          disabled={activityDisabled}
          onClick={() => open('activity')}
          aria-expanded={openPanel === 'activity'}
          className={`flex min-h-14 w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all ${activityDisabled ? 'cursor-not-allowed border-white/5 bg-surface/10 opacity-45' : openPanel === 'activity' ? 'border-primary-green/40 bg-primary-green/[0.06]' : 'border-white/10 bg-surface/30 hover:border-white/20 hover:bg-surface/45'}`}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/5 text-primary-green">
            <Layers3 size={17} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-text-primary">{selectedActivity ? cleanActivityName(selectedActivity.name) : 'Escolher atividade'}</span>
            <span className="mt-0.5 block truncate text-[11px] text-text-secondary/55">
              {activityDisabled ? 'Remova o texto avulso para escolher uma atividade' : selectedProject?.name || 'Atividades gerais'}
            </span>
          </span>
          <ChevronDown size={17} className={`shrink-0 text-text-secondary/60 transition-transform ${openPanel === 'activity' ? 'rotate-180' : ''}`} />
        </button>

        <AnimatePresence initial={false}>
          {openPanel === 'activity' && !activityDisabled && (
            <motion.div {...panelMotion} transition={{ duration: 0.18, ease: 'easeOut' }} className="overflow-hidden">
              <div className="rounded-2xl border border-white/10 bg-[#15191f] p-3 shadow-xl space-y-3">
                {renderSearch('Buscar atividade')}
                <div className="max-h-64 space-y-1 overflow-y-auto overscroll-contain pr-1">
                  <button
                    type="button"
                    onClick={() => selectActivity('')}
                    className={`flex min-h-11 w-full items-center justify-between rounded-xl px-3 text-left text-sm transition-colors ${!activityId ? 'bg-primary-green/10 text-primary-green' : 'text-text-secondary hover:bg-white/5 hover:text-text-primary'}`}
                  >
                    <span>Sem atividade</span>
                    {!activityId && <Check size={16} />}
                  </button>
                  {recentActivityItems.length > 0 && (
                    <>
                      <p className="px-3 pb-1 pt-1 text-[9px] font-bold uppercase tracking-widest text-text-secondary/40">Acesso rápido</p>
                      {recentActivityItems.map(activity => {
                        const linkedProject = projects.find(project => project.id === activity.project_id);
                        return (
                          <button
                            type="button"
                            key={activity.id}
                            onClick={() => selectActivity(activity.id)}
                            className={`flex min-h-12 w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left transition-colors ${activity.id === activityId ? 'bg-primary-green/10 text-primary-green' : 'text-text-primary hover:bg-white/5'}`}
                          >
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium">{cleanActivityName(activity.name)}</span>
                              {showOtherProjectActivities && linkedProject && (
                                <span className="mt-0.5 block truncate text-[10px] text-text-secondary/50">{linkedProject.name}</span>
                              )}
                            </span>
                            {activity.id === activityId ? <Check size={16} className="shrink-0" /> : <Clock3 size={13} className="shrink-0 text-text-secondary/40" />}
                          </button>
                        );
                      })}
                    </>
                  )}
                  {otherActivityItems.length > 0 && (
                    <>
                      <p className="px-3 pb-1 pt-2 text-[9px] font-bold uppercase tracking-widest text-text-secondary/40">{showOtherProjectActivities ? 'Outras atividades' : 'Neste projeto'}</p>
                      {otherActivityItems.map(activity => {
                        const linkedProject = projects.find(project => project.id === activity.project_id);
                        return (
                          <button
                            type="button"
                            key={activity.id}
                            onClick={() => selectActivity(activity.id)}
                            className={`flex min-h-12 w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left transition-colors ${activity.id === activityId ? 'bg-primary-green/10 text-primary-green' : 'text-text-primary hover:bg-white/5'}`}
                          >
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium">{cleanActivityName(activity.name)}</span>
                              {showOtherProjectActivities && linkedProject && (
                                <span className="mt-0.5 block truncate text-[10px] text-text-secondary/50">{linkedProject.name}</span>
                              )}
                            </span>
                            {activity.id === activityId && <Check size={16} className="shrink-0" />}
                          </button>
                        );
                      })}
                    </>
                  )}
                  {filteredActivities.length === 0 && (
                    <div className="px-3 py-5 text-center">
                      <p className="text-xs text-text-secondary/65">{normalizedSearch ? 'Nenhuma atividade encontrada.' : projectId ? 'Este projeto ainda não tem atividades.' : 'Nenhuma atividade geral cadastrada.'}</p>
                      {!normalizedSearch && projectId && <p className="mt-1 text-[11px] text-text-secondary/40">Crie a primeira atividade aqui mesmo.</p>}
                    </div>
                  )}
                </div>
                {!showOtherProjectActivities && activities.some(activity => activity.project_id && activity.project_id !== projectId) && (
                  <button
                    type="button"
                    onClick={() => { setShowOtherProjectActivities(true); setSearch(''); }}
                    className="w-full rounded-lg px-2 py-2 text-[11px] font-semibold text-text-secondary transition-colors hover:bg-white/5 hover:text-text-primary"
                  >
                    {projectId ? 'Ver atividades de outros projetos' : 'Ver atividades vinculadas a projetos'}
                  </button>
                )}
                {showOtherProjectActivities && (
                  <button
                    type="button"
                    onClick={() => { setShowOtherProjectActivities(false); setSearch(''); }}
                    className="w-full rounded-lg px-2 py-2 text-[11px] font-semibold text-text-secondary transition-colors hover:bg-white/5 hover:text-text-primary"
                  >
                    {projectId ? 'Voltar às atividades deste projeto' : 'Voltar às atividades gerais'}
                  </button>
                )}
                {creating === 'activity' ? renderCreateField('activity') : (
                  <button
                    type="button"
                    onClick={() => { setCreating('activity'); setDraftName(search); }}
                    className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-primary-green/30 px-3 text-xs font-bold text-primary-green transition-colors hover:bg-primary-green/5"
                  >
                    <Plus size={15} /> Nova atividade{selectedProject ? ` em ${selectedProject.name}` : ''}
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
