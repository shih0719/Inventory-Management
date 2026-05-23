// src/lib/format.ts — relative time + helpers.

import type { Lang } from './i18n';

/** "09:42" for today, "yest 09:42" for yesterday, "3d ago" otherwise. */
export function fmtTime(iso: string, lang: Lang): string {
  const d = new Date(iso);
  const now = new Date();
  const same = d.toDateString() === now.toDateString();
  const yest = (() => {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    return d.toDateString() === y.toDateString();
  })();
  const hm = d.toTimeString().slice(0, 5);
  if (same) return hm;
  if (yest) return (lang === 'zh' ? '昨' : 'yest') + ' ' + hm;
  const diffDays = Math.round((now.getTime() - d.getTime()) / 86400000);
  return diffDays + (lang === 'zh' ? ' 天前' : 'd ago');
}

export function isToday(iso: string): boolean {
  return new Date(iso).toDateString() === new Date().toDateString();
}
