import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { Habit, Project } from "../types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatHumanTime = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  
  const hLabel = h === 1 ? 'hora' : 'horas';
  const mLabel = m === 1 ? 'minuto' : 'minutos';

  if (h > 0 && m > 0) return `${h} ${hLabel} • ${m} ${mLabel}`;
  if (h > 0) return `${h} ${hLabel}`;
  return `${m} ${mLabel}`;
};

const VALORES_LEGADOS_INVALIDOS = [
  "Sessão Sem Título",
  "Sem Título",
  "Untitled",
  null,
  undefined,
  ""
];

function isValido(valor?: string | null): boolean {
  if (!valor) return false;
  return !VALORES_LEGADOS_INVALIDOS.includes(valor.trim());
}

export function resolverNomeSessao(
  session: { habit_id?: string | null; project_id?: string | null; activity_name?: string | null },
  habits: Habit[],
  projects: Project[]
): { titulo: string; projeto: string } {
  const project = projects.find(p => p.id === session.project_id);
  const projectNome = project?.name || (session as any).projeto?.name || (session as any).project?.name;

  let habitNome: string | null = null;
  if (session.habit_id) {
    const habit = habits.find(h => h.id === session.habit_id);
    if (habit) habitNome = habit.name;
  }
  if (!habitNome) {
    habitNome = (session as any).habito?.nome || (session as any).habit?.name;
  }

  const atividadeNome = (session as any).atividade?.nome || session.activity_name || (session as any).activity?.name;
  const atividadeAvulsa = (session as any).atividade_avulsa || (session as any).activity_avulsa;

  let titulo: string;
  if (isValido(habitNome)) titulo = habitNome!;
  else if (isValido(atividadeNome)) titulo = atividadeNome!;
  else if (isValido(atividadeAvulsa)) titulo = atividadeAvulsa!;
  else if (isValido(projectNome)) titulo = projectNome!;
  else titulo = "Sessão Livre";

  const projeto = isValido(projectNome) ? projectNome!.toUpperCase() : "GERAL";

  return { titulo, projeto };
}

export function formatSessionDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) {
    return m > 0 ? `${h}h ${m}min` : `${h}h`;
  }
  return `${minutes} min`;
}

export function formatTimeRange(startedAt: string, completedAt?: string | null, actualOrPlannedMins: number = 0): string {
  const dStart = new Date(startedAt);
  const startStr = dStart.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false });
  
  let dEnd: Date;
  if (completedAt) {
    dEnd = new Date(completedAt);
  } else {
    dEnd = new Date(dStart.getTime() + actualOrPlannedMins * 60000);
  }
  const endStr = dEnd.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false });
  
  return `${startStr} → ${endStr}`;
}

export function getLocalDateString(date_or_str?: Date | string): string {
  const d = !date_or_str ? new Date() : (typeof date_or_str === 'string' ? new Date(date_or_str) : date_or_str);
  // Guard against invalid Date parsing
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getLocalYesterdayDateString(date_or_str?: Date | string): string {
  const d = !date_or_str ? new Date() : (typeof date_or_str === 'string' ? new Date(date_or_str) : new Date(date_or_str.getTime()));
  if (isNaN(d.getTime())) return '';
  d.setDate(d.getDate() - 1);
  return getLocalDateString(d);
}

export function getLocalTomorrowDateString(date_or_str?: Date | string): string {
  const d = !date_or_str ? new Date() : (typeof date_or_str === 'string' ? new Date(date_or_str) : new Date(date_or_str.getTime()));
  if (isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + 1);
  return getLocalDateString(d);
}

export function isSameLocalDay(date1: Date | string, date2: Date | string): boolean {
  const str1 = getLocalDateString(date1);
  const str2 = getLocalDateString(date2);
  return str1 !== '' && str1 === str2;
}

export function getCurrentPeriodAndDate(now: Date = new Date()): { period: 'manha' | 'tarde' | 'noite'; dateStr: string } {
  const hours = now.getHours();
  let period: 'manha' | 'tarde' | 'noite';
  let dateStr: string;

  if (hours >= 5 && hours < 12) {
    period = 'manha';
    dateStr = getLocalDateString(now);
  } else if (hours >= 12 && hours < 18) {
    period = 'tarde';
    dateStr = getLocalDateString(now);
  } else {
    period = 'noite';
    if (hours >= 18) {
      dateStr = getLocalDateString(now);
    } else {
      const yesterday = new Date(now.getTime());
      yesterday.setDate(now.getDate() - 1);
      dateStr = getLocalDateString(yesterday);
    }
  }

  return { period, dateStr };
}

