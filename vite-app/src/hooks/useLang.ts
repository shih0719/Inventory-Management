import { useEffect, useState } from 'react';
import type { Lang } from '../types';

const LANG_KEY = 'inv.lang';
const LANGS: Lang[] = ['en', 'zh', 'zh-cn', 'ja'];

function loadLang(): Lang {
  try {
    const saved = localStorage.getItem(LANG_KEY) as Lang | null;
    return saved && LANGS.includes(saved) ? saved : 'en';
  } catch {
    return 'en';
  }
}

/** UI language: remembered per browser and mirrored onto <html lang>. */
export function useLang(): [Lang, (lang: Lang) => void] {
  const [lang, setLang] = useState<Lang>(loadLang);

  useEffect(() => {
    const langMap: Record<Lang, string> = { en: 'en', zh: 'zh-Hant', 'zh-cn': 'zh-Hans', ja: 'ja' };
    document.documentElement.lang = langMap[lang];
    document.body.dataset.lang = lang;
    try {
      localStorage.setItem(LANG_KEY, lang);
    } catch {
      /* quota / private mode — ignore */
    }
  }, [lang]);

  return [lang, setLang];
}
