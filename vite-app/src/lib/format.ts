// src/lib/format.ts — relative time + helpers.

import type { Lang } from './i18n';

/** Parse ISO string ensuring it's treated as UTC, then convert to local time */
function parseUTCDate(iso: string): Date {
  // Ensure the string is treated as UTC by adding 'Z' if no timezone info exists
  let normalized = iso;
  // Check if string already has timezone info (Z, +HH:MM, or -HH:MM at the end)
  const hasTimezone = /Z$|[+-]\d{2}:\d{2}$|[+-]\d{4}$/.test(normalized.trim());
  if (!hasTimezone) {
    normalized = iso.trim() + 'Z';
  }
  return new Date(normalized);
}

/** "09:42" for today, "yest 09:42" for yesterday, "3d ago" otherwise. */
export function fmtTime(iso: string, lang: Lang): string {
  const d = parseUTCDate(iso);
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
  return parseUTCDate(iso).toDateString() === new Date().toDateString();
}

/** Format as YYYY-MM-DD in local timezone */
export function fmtDate(iso: string, lang: Lang = 'en'): string {
  const d = parseUTCDate(iso);
  const locale = lang === 'zh' ? 'zh-TW' : lang === 'ja' ? 'ja-JP' : 'en-US';
  return d.toLocaleDateString(locale);
}

/** Format as full date-time string in local timezone */
export function fmtDateTime(iso: string, lang: Lang = 'en'): string {
  const d = parseUTCDate(iso);
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  };
  const locale = lang === 'zh' ? 'zh-TW' : lang === 'ja' ? 'ja-JP' : 'en-US';
  return d.toLocaleString(locale, options);
}
