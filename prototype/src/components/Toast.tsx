import { useEffect } from 'react';
import type { ToastMessage } from '../types';

interface ToastProps {
  toast: ToastMessage;
  onDismiss: (id: number) => void;
}

export default function Toast({ toast, onDismiss }: ToastProps) {
  useEffect(() => {
    const duration = toast.duration ?? 3000;
    const timer = setTimeout(() => onDismiss(toast.id), duration);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onDismiss]);

  return (
    <div className={`toast ${toast.kind === 'alert' ? 'alert' : ''}`}>
      <div className="dot"></div>
      <div>{toast.text}</div>
      {toast.onUndo && (
        <button className="undo" onClick={toast.onUndo}>
          撤销
        </button>
      )}
    </div>
  );
}
