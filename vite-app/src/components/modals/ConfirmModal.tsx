import type { Lang } from '../../lib/i18n';

export interface ConfirmModalProps {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDangerous?: boolean;
  lang: Lang;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  title,
  message,
  confirmText,
  cancelText,
  isDangerous = false,
  lang,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const defaultConfirm = lang === 'en' ? 'Confirm' : '確認';
  const defaultCancel = lang === 'en' ? 'Cancel' : '取消';

  return (
    <div className="modal-scrim" onClick={onCancel}>
      <div className="modal" style={{ width: 400 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button className="close" onClick={onCancel}>
            ✕
          </button>
        </div>

        <div style={{ padding: '16px 20px', fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.5 }}>
          {message}
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', padding: '12px 20px', borderTop: '1px solid var(--border)' }}>
          <button className="btn ghost" onClick={onCancel}>
            {cancelText || defaultCancel}
          </button>
          <button
            className="btn"
            onClick={onConfirm}
            style={isDangerous ? { background: 'var(--accent)', color: 'var(--surface)', borderColor: 'var(--accent)' } : undefined}
          >
            {confirmText || defaultConfirm}
          </button>
        </div>
      </div>
    </div>
  );
}
