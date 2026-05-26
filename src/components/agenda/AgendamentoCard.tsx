import { useDataStore } from '../../store/useDataStore';
import { ScheduledActivity } from '../../types';
import { Play, Calendar, Clock, BookOpen, Trash2, CheckCircle, Ban, Pencil } from 'lucide-react';

interface AgendamentoCardProps {
  activity: ScheduledActivity;
  onStartSession?: (activity: ScheduledActivity) => void;
}

export const AgendamentoCard = ({ activity, onStartSession }: AgendamentoCardProps) => {
  const dataStore = useDataStore();

  // Resolve title
  let title = activity.atividade_avulsa || 'Sessão Sem Título';
  let contextLabel = 'Atividade avulsa';
  let isHabit = false;

  if (activity.habit_id) {
    const habit = dataStore.habits.find(h => h.id === activity.habit_id);
    title = habit?.name || title;
    contextLabel = 'Hábito Atômico';
    isHabit = true;
  } else if (activity.activity_id) {
    const act = dataStore.activities.find(a => a.id === activity.activity_id);
    title = act?.name || title;
    contextLabel = 'Tarefa Catalogada';
  }

  // Resolve project
  const project = activity.project_id
    ? dataStore.projects.find(p => p.id === activity.project_id)
    : null;

  const handleCancel = async () => {
    if (confirm('Ficou tarde? Deseja realmente cancelar este agendamento?')) {
      await dataStore.updateScheduledActivity(activity.id, { status: 'cancelled' });
    }
  };

  const handleEdit = () => {
    window.dispatchEvent(new CustomEvent('open-action-center', { 
      detail: { 
        screen: 'agenda',
        editingActivity: activity 
      } 
    }));
  };

  const formattedDate = new Date(activity.scheduled_date + 'T00:00:00').toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'short'
  });

  // Calculate times
  const startTime = activity.scheduled_time;
  const [h, m] = startTime.split(':').map(Number);
  const totalMin = h * 60 + m + activity.duration_minutes;
  const endH = Math.floor(totalMin / 60) % 24;
  const endM = totalMin % 60;
  const endTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

  const hasTasks = activity.tasks && activity.tasks.length > 0;

  return (
    <div
      id={`agenda-card-${activity.id}`}
      className={`relative p-5 rounded-3xl border transition-all duration-200 flex flex-col justify-between gap-4 ${
        activity.status === 'completed'
          ? 'bg-emerald-500/5 border-emerald-500/10 opacity-75'
          : activity.status === 'cancelled'
          ? 'bg-zinc-500/5 border-white/5 opacity-50'
          : 'bg-surface/5 border-white/5 hover:border-white/10 hover:bg-surface/10'
      }`}
    >
      <div className="space-y-3">
        {/* Header with tags and status */}
        <div className="flex flex-wrap md:flex-nowrap gap-2 justify-between items-center">
          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
            <span className={`text-[9px] font-bold tracking-widest uppercase px-2.5 py-1 rounded-full shrink-0 ${
              isHabit 
                ? 'bg-purple-500/10 text-purple-400 border border-purple-500/10' 
                : 'bg-primary-green/10 text-primary-green border border-primary-green/10'
            }`}>
              {contextLabel}
            </span>
            {project && (
              <span className="text-[9px] font-bold tracking-widest uppercase bg-white/5 text-text-secondary px-2.5 py-1 rounded-full border border-white/5 truncate max-w-[120px] sm:max-w-[180px] md:max-w-none">
                📁 {project.name}
              </span>
            )}
          </div>

          <div className="shrink-0">
            {activity.status === 'completed' && (
              <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/10">
                <CheckCircle size={10} /> Concluída
              </span>
            )}
            {activity.status === 'cancelled' && (
              <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-zinc-400 bg-white/5 px-2.5 py-1 rounded-full border border-white/5">
                <Ban size={10} /> Cancelada
              </span>
            )}
            {activity.status === 'pending' && (
              <span className="text-[9px] font-bold uppercase tracking-widest text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/10">
                Agendada
              </span>
            )}
          </div>
        </div>

        {/* Title and notes */}
        <div className="text-left space-y-1">
          <h4 className={`text-base font-semibold text-text-primary tracking-tight leading-snug ${
            activity.status === 'cancelled' ? 'line-through text-text-secondary/60' : ''
          }`}>
            {title}
          </h4>
          
          {activity.notes && (
            <p className="text-xs text-text-secondary/60 line-clamp-2 italic font-serif">
              "{activity.notes}"
            </p>
          )}

          {hasTasks && (
            <span className="inline-block text-[10px] font-mono font-medium text-text-secondary/40">
              📋 {activity.tasks.length} {activity.tasks.length === 1 ? 'tarefa pré-configurada' : 'tarefas pré-configuradas'}
            </span>
          )}
        </div>
      </div>

      {/* Footer info & interactive buttons */}
      <div className="flex justify-between items-center pt-2 border-t border-white/5">
        <div className="flex items-center gap-2.5 text-xs text-text-secondary/60">
          <div className="flex items-center gap-1">
            <Calendar size={13} className="text-text-secondary/40" />
            <span>{formattedDate}</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock size={13} className="text-text-secondary/40" />
            <span className="font-mono">{startTime} - {endTime} <span className="opacity-40 text-[10px]">({activity.duration_minutes}m)</span></span>
          </div>
        </div>

        {activity.status === 'pending' && (
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleEdit}
              className="px-2.5 py-1.5 text-[9px] font-bold tracking-widest uppercase text-[#6ee7a8]/60 hover:text-[#6ee7a8] border border-[#6ee7a8]/10 hover:border-[#6ee7a8]/20 rounded-full transition-all flex items-center gap-1"
              title="Editar Agendamento"
            >
              <Pencil size={10} /> Editar
            </button>
            <button
              onClick={handleCancel}
              className="px-3 py-1.5 text-[9px] font-bold tracking-widest uppercase text-red-500/60 hover:text-red-500 border border-red-500/10 hover:border-red-500/20 rounded-full transition-all"
            >
              Cancelar
            </button>
            {onStartSession && (
              <button
                onClick={() => onStartSession(activity)}
                className="flex items-center gap-1 px-4 py-1.5 text-[9px] font-bold tracking-widest uppercase bg-primary-green hover:bg-primary-green/90 text-background rounded-full transition-all duration-150"
              >
                <Play size={10} fill="currentColor" /> Iniciar ►
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
