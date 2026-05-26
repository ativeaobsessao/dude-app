import { useDataStore } from '../../store/useDataStore';
import { ScheduledActivity } from '../../types';
import { Play, CheckCircle, Ban } from 'lucide-react';

interface AgendamentoCardProps {
  activity: ScheduledActivity;
  onStartSession?: (activity: ScheduledActivity) => void;
}

export const AgendamentoCard = ({ activity, onStartSession }: AgendamentoCardProps) => {
  const dataStore = useDataStore();

  // Resolve title prioritizing cataloged activities, then manual text
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

  // Convert date format to dd/mm
  const formattedDate = (() => {
    if (!activity.scheduled_date) return '';
    const parts = activity.scheduled_date.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}`;
    }
    return activity.scheduled_date;
  })();

  // Helper clock format HHhMMmin
  function formatClockTime(timeStr: string): string {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':').map(Number);
    const hourPart = String(h || 0).padStart(2, '0');
    const minPart = String(m || 0).padStart(2, '0');
    return `${hourPart}h${minPart}min`;
  }

  // Calculate end times
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
        {/* LINHA 1: Tags/Status */}
        <div className="flex justify-between items-center bg-transparent">
          <span className={`text-[8px] font-bold tracking-[0.15em] uppercase px-2.5 py-1 rounded-full shrink-0 ${
            isHabit 
              ? 'bg-purple-500/10 text-purple-400 border border-purple-500/10' 
              : 'bg-primary-green/10 text-primary-green border border-primary-green/10'
          }`}>
            {contextLabel}
          </span>

          <div className="shrink-0">
            {activity.status === 'completed' && (
              <span className="flex items-center gap-1 text-[8px] font-bold uppercase tracking-[0.15em] text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/10">
                <CheckCircle size={9} /> Concluída
              </span>
            )}
            {activity.status === 'cancelled' && (
              <span className="flex items-center gap-1 text-[8px] font-bold uppercase tracking-[0.15em] text-zinc-400 bg-white/5 px-2.5 py-1 rounded-full border border-white/5">
                <Ban size={9} /> Cancelada
              </span>
            )}
            {activity.status === 'pending' && (
              <span className="text-[8px] font-bold uppercase tracking-[0.15em] text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/10">
                Agendada
              </span>
            )}
          </div>
        </div>

        {/* LINHA 2: Nome da atividade + projeto inline discreto */}
        <div className="text-left space-y-1">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <h4 className={`text-base font-semibold text-text-primary tracking-tight leading-snug ${
              activity.status === 'cancelled' ? 'line-through text-text-secondary/60' : ''
            }`}>
              {title}
            </h4>
            {project && (
              <span className="text-[10px] text-text-secondary/40 font-medium tracking-wide">
                {project.name}
              </span>
            )}
          </div>
          
          {activity.notes && (
            <p className="text-xs text-text-secondary/60 line-clamp-2 italic font-serif">
              "{activity.notes}"
            </p>
          )}

          {hasTasks && (
            <span className="inline-block text-[9px] font-mono font-medium text-text-secondary/30">
              📋 {activity.tasks.length} {activity.tasks.length === 1 ? 'tarefa configurada' : 'tarefas configuradas'}
            </span>
          )}
        </div>
      </div>

      {/* LINHA 3: Unificação dos elementos responsivos (data, início, fim, ações) */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/5 text-xs text-text-secondary/60">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[10px] sm:text-xs">
          <span className="text-text-primary/70">{formattedDate}</span>
          <span className="opacity-30">•</span>
          <span>{formatClockTime(startTime)}</span>
          <span className="opacity-30">•</span>
          <span>{formatClockTime(endTime)}</span>
        </div>

        {activity.status === 'pending' && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={handleEdit}
              className="px-2 py-1 text-[9px] font-semibold tracking-wider uppercase text-[#6ee7a8]/60 hover:text-[#6ee7a8] transition-all bg-white/5 hover:bg-white/10 rounded-md"
              title="Editar Agendamento"
            >
              Editar
            </button>
            <button
              onClick={handleCancel}
              className="px-2 py-1 text-[9px] font-semibold tracking-wider uppercase text-red-400/60 hover:text-red-400 transition-all bg-white/5 hover:bg-white/10 rounded-md"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>

      {/* LINHA 4: Botão INICIAR em linha exclusiva inferior */}
      {activity.status === 'pending' && onStartSession && (
        <div className="pt-2 w-full flex justify-center border-t border-white/5">
          <button
            onClick={() => onStartSession(activity)}
            className="group flex items-center justify-center gap-2 w-full py-3 px-5 text-[10px] font-bold tracking-[0.15em] uppercase bg-primary-green hover:bg-glow-green text-background rounded-2xl transition-all duration-150 active:scale-95 touch-manipulation min-h-[44px]"
          >
            <Play size={10} fill="currentColor" className="shrink-0" />
            <span>Iniciar Sessão</span>
          </button>
        </div>
      )}
    </div>
  );
};
