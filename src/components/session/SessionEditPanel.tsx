import React, { useState } from 'react';
import { X } from 'lucide-react';
import { CustomSelect } from '../ui/CustomSelect';
import { SessionTasksChecklist } from './SessionTasksChecklist';

interface SessionEditPanelProps {
  initialProjectId: string | null;
  initialActivityName: string;
  initialHabitId: string | null;
  initialTasks: string[];
  initialCompletedTasks: string[];
  onSave: (
    projectId: string | null,
    activityName: string,
    habitId: string | null,
    tasks: string[],
    completedTasks: string[]
  ) => void;
  onCancel: () => void;
  projects: Array<{ id: string; name: string }>;
  habits: Array<{ id: string; name: string; sessions_this_week: number; sessions_per_week: number }>;
  activities: Array<{ id: string; name: string; project_id?: string | null }>;
}

export const SessionEditPanel: React.FC<SessionEditPanelProps> = ({
  initialProjectId,
  initialActivityName,
  initialHabitId,
  initialTasks,
  initialCompletedTasks,
  onSave,
  onCancel,
  projects,
  habits,
  activities,
}) => {
  const [projectId, setProjectId] = useState<string | null>(initialProjectId);
  const [activityName, setActivityName] = useState<string>(initialActivityName);
  const [habitId, setHabitId] = useState<string | null>(initialHabitId);
  const [tasks, setTasks] = useState<string[]>(initialTasks);
  const [completedTasks, setCompletedTasks] = useState<string[]>(initialCompletedTasks);

  // Filter activities based on the edited project
  const filteredActivities = projectId
    ? activities.filter((a) => a.project_id === projectId)
    : activities;

  // Render project options
  const projectOptions = [
    { value: '', label: 'Sem Projeto' },
    ...projects.map((p) => ({ value: p.id, label: p.name })),
  ];

  // Render activity options (using names as value & label, plus manual override fallback)
  const activityOptions = filteredActivities.map((a) => ({ value: a.name, label: a.name }));
  if (activityName && !activityOptions.some((opt) => opt.value === activityName)) {
    activityOptions.unshift({ value: activityName, label: activityName });
  }
  if (activityOptions.length === 0 || !activityOptions.some(opt => opt.value === '')) {
    activityOptions.unshift({ value: '', label: 'Selecionar Atividade' });
  }

  // Render habit options
  const habitOptions = [
    { value: '', label: 'Nenhum' },
    ...habits.map((h) => ({
      value: h.id,
      label: `${h.name} (${h.sessions_this_week}/${h.sessions_per_week} esta semana)`,
    })),
  ];

  const handleSaveClick = () => {
    onSave(
      projectId || null,
      activityName || 'Sessão Sem Título',
      habitId || null,
      tasks,
      completedTasks
    );
  };

  return (
    <div
      className="p-6 md:p-8 space-y-6 text-left transition-all duration-300 transform translate-z-0 rounded-3xl"
      style={{
        backgroundColor: 'rgba(255,255,255,0.02)',
        border: '0.5px solid rgba(251,191,36,0.2)',
      }}
    >
      {/* Header */}
      <div className="flex justify-between items-center border-b border-white/5 pb-3">
        <span
          style={{
            color: '#fbbf24',
            fontSize: '11px',
            letterSpacing: '0.12em',
          }}
          className="font-bold uppercase"
        >
          EDITANDO DETALHES
        </span>
        <button
          type="button"
          onClick={onCancel}
          className="text-[#6a7570] hover:text-white transition-colors cursor-pointer p-1"
        >
          <X size={16} />
        </button>
      </div>

      {/* Inputs */}
      <div className="space-y-4">
        {/* Projeto */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-widest text-[#8a9690] block">
            Projeto
          </label>
          <CustomSelect
            value={projectId || ''}
            onChange={(val) => {
              setProjectId(val || null);
              // reset activity default to let user pick from the new project
              setActivityName('');
            }}
            placeholder="Sem Projeto"
            options={projectOptions}
          />
        </div>

        {/* Atividade */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-widest text-[#8a9690] block">
            Atividade
          </label>
          <CustomSelect
            value={activityName}
            onChange={(val) => setActivityName(val)}
            placeholder="Selecionar Atividade"
            options={activityOptions}
          />
        </div>

        {/* Hábito Vinculado */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-widest text-[#8a9690] block">
            Hábito Vinculado
          </label>
          <CustomSelect
            value={habitId || ''}
            onChange={(val) => setHabitId(val || null)}
            placeholder="Nenhum"
            options={habitOptions}
          />
        </div>

        {/* Tarefas */}
        <div className="space-y-2 border-t border-white/5 pt-4">
          <label className="text-[10px] font-bold uppercase tracking-widest text-[#8a9690] block mb-1">
            Tarefas da Sessão
          </label>
          <SessionTasksChecklist
            tasks={tasks}
            completedTasks={completedTasks}
            onChangeTasks={setTasks}
            onChangeCompleted={setCompletedTasks}
          />
        </div>
      </div>

      {/* Action Button */}
      <div className="pt-2">
        <button
          type="button"
          onClick={handleSaveClick}
          className="w-full py-4 text-[10px] font-bold uppercase tracking-[0.1em] rounded-xl transition-all cursor-pointer"
          style={{
            backgroundColor: 'rgba(110, 231, 183, 0.15)',
            border: '0.5px solid rgba(110, 231, 183, 0.3)',
            color: '#6ee7b7',
          }}
        >
          Ok
        </button>
      </div>
    </div>
  );
};
