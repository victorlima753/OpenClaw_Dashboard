import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRelativeTime(date: string | Date | null | undefined) {
  if (!date) return "sem registro";
  const value = typeof date === "string" ? new Date(date) : date;
  const diffMs = Date.now() - value.getTime();
  const minutes = Math.max(0, Math.floor(diffMs / 60000));
  if (minutes < 1) return "agora";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  return `${days} d`;
}

export function formatDuration(ms?: number | null) {
  if (!ms) return "0s";
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}min`;
  return `${Math.round(minutes / 60)}h`;
}

export function formatPercent(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "0%";
  return `${Math.round(value)}%`;
}

export function compactNumber(value: number | null | undefined) {
  return new Intl.NumberFormat("pt-BR", { notation: "compact" }).format(value ?? 0);
}
