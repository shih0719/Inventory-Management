// src/components/Toast.tsx
import { useEffect } from 'react';
import type { Lang } from '../lib/i18n';

export interface ToastState {
  id: number;
  text: string;
  lang?: Lang;
  kind?: 'alert' | 'info';
  duration?: number;
  onUndo?: () => void | Promise<void>;
}

export interface ToastProps {
  toast: ToastState | null;
  onDismiss: (id: number) => void;
}

export function Toast({ toast, onDismiss }: ToastProps) {
  useEffect(() => {
    if (!toast) return;
    const tm = setTimeout(() => onDismiss(toast.id), toast.duration || 4200);
    return () => clearTimeout(tm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast]);

  if (!toast) return null;

  return (
    <div className={'toast' + (toast.kind === 'alert' ? ' alert' : '')}>
      <span className="dot" />
      <span>{toast.text}</span>
      {toast.onUndo && (
        <button
          className="undo"
          onClick={() => {
            toast.onUndo?.();
            onDismiss(toast.id);
          }}
        >
          {toast.lang === 'zh' ? '復原' : toast.lang === 'ja' ? '取り消す' : 'Undo'}
        </button>
      )}
    </div>
  );
}
