import { useState } from 'react';
import type { Lang } from '../../lib/i18n';
import { changePassword } from '../../api/auth';
import { ApiError } from '../../api/client';

export interface ChangePasswordModalProps {
  lang: Lang;
  onClose: () => void;
  onSuccess: () => void;
}

export function ChangePasswordModal({ lang, onClose, onSuccess }: ChangePasswordModalProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const title = lang === 'zh' ? '修改密碼' : lang === 'ja' ? 'パスワード変更' : 'Change Password';
  const labelCurrent = lang === 'zh' ? '目前密碼' : lang === 'ja' ? '現在のパスワード' : 'Current Password';
  const labelNew = lang === 'zh' ? '新密碼' : lang === 'ja' ? '新しいパスワード' : 'New Password';
  const labelConfirm = lang === 'zh' ? '確認新密碼' : lang === 'ja' ? '新しいパスワード（確認）' : 'Confirm New Password';
  const btnCancel = lang === 'zh' ? '取消' : lang === 'ja' ? 'キャンセル' : 'Cancel';
  const btnSave = lang === 'zh' ? '儲存' : lang === 'ja' ? '保存' : 'Save';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError(lang === 'zh' ? '新密碼不一致' : lang === 'ja' ? 'パスワードが一致しません' : 'New passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      setError(lang === 'zh' ? '新密碼至少 6 個字元' : lang === 'ja' ? 'パスワードは6文字以上' : 'New password must be at least 6 characters');
      return;
    }

    setSubmitting(true);
    try {
      await changePassword(currentPassword, newPassword);
      onSuccess();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : (err as Error).message;
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" style={{ width: 400 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button className="close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ color: 'var(--ink-2)' }}>{labelCurrent}</span>
            <input
              type="password"
              className="input"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              autoFocus
            />
          </label>

          <label style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ color: 'var(--ink-2)' }}>{labelNew}</span>
            <input
              type="password"
              className="input"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </label>

          <label style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ color: 'var(--ink-2)' }}>{labelConfirm}</span>
            <input
              type="password"
              className="input"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </label>

          {error && (
            <div style={{ fontSize: 13, color: 'var(--accent)', padding: '8px 12px', background: 'color-mix(in srgb, var(--accent) 10%, transparent)', borderRadius: 6 }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4, borderTop: '1px solid var(--border)' }}>
            <button type="button" className="btn ghost" onClick={onClose}>{btnCancel}</button>
            <button type="submit" className="btn" disabled={submitting}>
              {submitting ? '...' : btnSave}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
