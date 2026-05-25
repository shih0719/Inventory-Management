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
  // Use toLocaleTimeString to ensure local timezone
  const hm = d.toLocaleTimeString(lang === 'zh' ? 'zh-TW' : lang === 'ja' ? 'ja-JP' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  if (same) return hm;
  if (yest) {
    const yestLabel = lang === 'zh' ? '昨' : lang === 'ja' ? '昨' : 'yest';
    return yestLabel + ' ' + hm;
  }
  const diffDays = Math.round((now.getTime() - d.getTime()) / 86400000);
  const agoLabel = lang === 'zh' ? ' 天前' : lang === 'ja' ? '日前' : 'd ago';
  return diffDays + agoLabel;
}

export function isToday(iso: string): boolean {
  return new Date(iso).toDateString() === new Date().toDateString();
}
