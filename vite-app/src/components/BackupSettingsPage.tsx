import { useEffect, useState } from 'react';
import { getBackupSettings, saveBackupSettings, sendTestEmail, type BackupEmailSettings } from '../api/backup';
import type { Lang } from '../lib/i18n';

interface BackupSettingsPageProps {
  lang: Lang;
}

const texts = {
  en: {
    title: 'Backup Settings',
    emailSection: 'Weekly Email Backup',
    enabledLabel: 'Enable weekly email backup',
    host: 'SMTP Host',
    port: 'SMTP Port',
    user: 'Gmail Address',
    pass: 'App Password',
    to: 'Send To',
    save: 'Save',
    testEmail: 'Send Test Email',
    saved: 'Settings saved.',
    testSent: 'Test email sent!',
    testFailed: 'Failed to send test email',
    saveFailed: 'Failed to save settings',
    loadFailed: 'Failed to load settings',
    hostPlaceholder: 'smtp.gmail.com',
    userPlaceholder: 'you@gmail.com',
    passPlaceholder: 'App password (16 chars)',
    toPlaceholder: 'recipient@gmail.com',
    backupInterval: 'Auto Backup Interval',
    backupIntervalValue: 'Every 6 hours',
    retention: 'Retention Period',
    retentionValue: '7 days',
    noteTitle: 'Gmail Setup',
    noteContent: 'Use an App Password (not your account password). Enable 2-Step Verification → Security → App Passwords in your Google Account.',
  },
  zh: {
    title: '備份設定',
    emailSection: '每週 Email 備份',
    enabledLabel: '啟用每週 Email 備份',
    host: 'SMTP 主機',
    port: 'SMTP 連接埠',
    user: 'Gmail 信箱',
    pass: '應用程式密碼',
    to: '收件人',
    save: '儲存',
    testEmail: '寄送測試信',
    saved: '設定已儲存。',
    testSent: '測試信件已寄出！',
    testFailed: '測試信件寄送失敗',
    saveFailed: '儲存設定失敗',
    loadFailed: '無法載入設定',
    hostPlaceholder: 'smtp.gmail.com',
    userPlaceholder: 'you@gmail.com',
    passPlaceholder: '應用程式密碼（16碼）',
    toPlaceholder: 'recipient@gmail.com',
    backupInterval: '自動備份頻率',
    backupIntervalValue: '每 6 小時',
    retention: '備份保留期',
    retentionValue: '7 天',
    noteTitle: 'Gmail 設定說明',
    noteContent: '請使用「應用程式密碼」而非帳號密碼。前往 Google 帳號 → 安全性 → 兩步驟驗證（須先開啟）→ 應用程式密碼，產生 16 碼密碼。',
  },
  'zh-cn': {
    title: '备份设置',
    emailSection: '每周 Email 备份',
    enabledLabel: '启用每周 Email 备份',
    host: 'SMTP 主机',
    port: 'SMTP 端口',
    user: 'Gmail 邮箱',
    pass: '应用专用密码',
    to: '收件人',
    save: '保存',
    testEmail: '发送测试邮件',
    saved: '设置已保存。',
    testSent: '测试邮件已发送！',
    testFailed: '测试邮件发送失败',
    saveFailed: '保存设置失败',
    loadFailed: '无法加载设置',
    hostPlaceholder: 'smtp.gmail.com',
    userPlaceholder: 'you@gmail.com',
    passPlaceholder: '应用专用密码（16位）',
    toPlaceholder: 'recipient@gmail.com',
    backupInterval: '自动备份频率',
    backupIntervalValue: '每 6 小时',
    retention: '备份保留期',
    retentionValue: '7 天',
    noteTitle: 'Gmail 设置说明',
    noteContent: '请使用「应用专用密码」而非账号密码。前往 Google 账号 → 安全 → 两步验证（需先开启）→ 应用专用密码，生成 16 位密码。',
  },
  ja: {
    title: 'バックアップ設定',
    emailSection: '毎週メールバックアップ',
    enabledLabel: '毎週メールバックアップを有効にする',
    host: 'SMTPホスト',
    port: 'SMTPポート',
    user: 'Gmailアドレス',
    pass: 'アプリパスワード',
    to: '送信先',
    save: '保存',
    testEmail: 'テストメール送信',
    saved: '設定を保存しました。',
    testSent: 'テストメールを送信しました！',
    testFailed: 'テストメール送信失敗',
    saveFailed: '設定の保存に失敗しました',
    loadFailed: '設定の読み込みに失敗しました',
    hostPlaceholder: 'smtp.gmail.com',
    userPlaceholder: 'you@gmail.com',
    passPlaceholder: 'アプリパスワード（16文字）',
    toPlaceholder: 'recipient@gmail.com',
    backupInterval: '自動バックアップ間隔',
    backupIntervalValue: '6時間ごと',
    retention: '保持期間',
    retentionValue: '7日間',
    noteTitle: 'Gmail設定',
    noteContent: 'アカウントパスワードではなく「アプリパスワード」を使用してください。Googleアカウント → セキュリティ → 2段階認証（要有効化）→ アプリパスワード で16文字のパスワードを生成してください。',
  },
};

function t(lang: Lang, key: keyof typeof texts.en): string {
  const map = texts[lang] ?? texts.en;
  return (map as typeof texts.en)[key] ?? texts.en[key];
}

const defaultSettings: BackupEmailSettings = {
  host: 'smtp.gmail.com',
  port: 587,
  user: '',
  pass: '',
  to: '',
  enabled: false,
};

export function BackupSettingsPage({ lang }: BackupSettingsPageProps) {
  const [form, setForm] = useState<BackupEmailSettings>(defaultSettings);
  const [status, setStatus] = useState<{ kind: 'idle' | 'ok' | 'err'; msg?: string }>({ kind: 'idle' });
  const [testStatus, setTestStatus] = useState<{ kind: 'idle' | 'sending' | 'ok' | 'err'; msg?: string }>({ kind: 'idle' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getBackupSettings()
      .then(setForm)
      .catch(() => setStatus({ kind: 'err', msg: t(lang, 'loadFailed') }));
  }, [lang]);

  function set(field: keyof BackupEmailSettings, value: string | number | boolean) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    setSaving(true);
    setStatus({ kind: 'idle' });
    try {
      await saveBackupSettings(form);
      setStatus({ kind: 'ok', msg: t(lang, 'saved') });
    } catch {
      setStatus({ kind: 'err', msg: t(lang, 'saveFailed') });
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTestStatus({ kind: 'sending' });
    try {
      await sendTestEmail();
      setTestStatus({ kind: 'ok', msg: t(lang, 'testSent') });
    } catch (err) {
      setTestStatus({ kind: 'err', msg: `${t(lang, 'testFailed')}: ${(err as Error).message}` });
    }
  }

  return (
    <div className="page-shell" style={{ maxWidth: 560 }}>
      <h2 style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 16, marginBottom: 24 }}>
        {t(lang, 'title')}
      </h2>

      {/* 備份狀態卡片 */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 0' }}>
          <span style={{ color: 'var(--ink-3)', fontSize: 13 }}>{t(lang, 'backupInterval')}</span>
          <span style={{ fontFamily: 'monospace', fontSize: 13 }}>{t(lang, 'backupIntervalValue')}</span>
          <span style={{ color: 'var(--ink-3)', fontSize: 13 }}>{t(lang, 'retention')}</span>
          <span style={{ fontFamily: 'monospace', fontSize: 13 }}>{t(lang, 'retentionValue')}</span>
        </div>
      </div>

      {/* Email 設定 */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 16 }}>{t(lang, 'emailSection')}</div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={e => set('enabled', e.target.checked)}
          />
          <span style={{ fontSize: 13 }}>{t(lang, 'enabledLabel')}</span>
        </label>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Field label={t(lang, 'host')}>
            <input
              className="inp"
              value={form.host}
              placeholder={t(lang, 'hostPlaceholder')}
              onChange={e => set('host', e.target.value)}
            />
          </Field>
          <Field label={t(lang, 'port')}>
            <input
              className="inp"
              type="number"
              value={form.port}
              onChange={e => set('port', parseInt(e.target.value) || 587)}
              style={{ width: 100 }}
            />
          </Field>
          <Field label={t(lang, 'user')}>
            <input
              className="inp"
              value={form.user}
              placeholder={t(lang, 'userPlaceholder')}
              onChange={e => set('user', e.target.value)}
            />
          </Field>
          <Field label={t(lang, 'pass')}>
            <input
              className="inp"
              type="password"
              value={form.pass}
              placeholder={t(lang, 'passPlaceholder')}
              onChange={e => set('pass', e.target.value)}
            />
          </Field>
          <Field label={t(lang, 'to')}>
            <input
              className="inp"
              value={form.to}
              placeholder={t(lang, 'toPlaceholder')}
              onChange={e => set('to', e.target.value)}
            />
          </Field>
        </div>

        {/* Gmail 說明 */}
        <div style={{
          marginTop: 16,
          padding: '10px 12px',
          background: 'var(--surface-2)',
          borderRadius: 6,
          fontSize: 12,
          color: 'var(--ink-3)',
          lineHeight: 1.5,
        }}>
          <strong style={{ color: 'var(--ink-2)' }}>{t(lang, 'noteTitle')}：</strong>
          {' '}{t(lang, 'noteContent')}
        </div>
      </div>

      {/* 操作按鈕 */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn primary" onClick={handleSave} disabled={saving}>
          {t(lang, 'save')}
        </button>
        <button className="btn ghost" onClick={handleTest} disabled={testStatus.kind === 'sending'}>
          {testStatus.kind === 'sending' ? '…' : t(lang, 'testEmail')}
        </button>

        {status.kind !== 'idle' && (
          <span style={{ fontSize: 13, color: status.kind === 'ok' ? 'var(--green)' : 'var(--red)' }}>
            {status.msg}
          </span>
        )}
        {testStatus.kind !== 'idle' && testStatus.kind !== 'sending' && (
          <span style={{ fontSize: 13, color: testStatus.kind === 'ok' ? 'var(--green)' : 'var(--red)' }}>
            {testStatus.msg}
          </span>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>{label}</span>
      {children}
    </div>
  );
}
