import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

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
