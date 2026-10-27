import { useCallback, useState } from 'react';
import type { Lang, ToastState } from '../types';

export interface Toasts {
  toast: ToastState | null;
  showToast: (text: string, opts?: Partial<ToastState>) => void;
  dismissToast: (id: number) => void;
}

/** The single toast the app shows; a new one replaces the current one. */
export function useToast(lang: Lang): Toasts {
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = useCallback(
    (text: string, opts: Partial<ToastState> = {}) => {
      setToast({ id: Date.now(), text, lang, ...opts });
    },
    [lang],
  );

  const dismissToast = useCallback((id: number) => {
    setToast((curr) => (curr && curr.id === id ? null : curr));
  }, []);

  return { toast, showToast, dismissToast };
}
