import type { ActivityEntry } from '@/shared/types';

export function activityResultLabel(entry: ActivityEntry): string {
  if (entry.result.ok) return `HTTP ${entry.result.status}`;
  return entry.result.status
    ? `HTTP ${entry.result.status} · ${entry.result.code.replaceAll('_', ' ')}`
    : entry.result.code.replaceAll('_', ' ');
}

export function activityTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (left: Date, right: Date) =>
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate();
  const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (sameDay(date, today)) return `Today, ${time}`;
  if (sameDay(date, yesterday)) return `Yesterday, ${time}`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}
