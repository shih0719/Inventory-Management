import { api } from './client';

export interface BackupEmailSettings {
  host: string;
  port: number;
  user: string;
  pass: string;
  to: string;
  enabled: boolean;
}

export async function getBackupSettings(): Promise<BackupEmailSettings> {
  const res = await api.get<BackupEmailSettings>('/api/backup/settings');
  return res.data;
}

export async function saveBackupSettings(settings: BackupEmailSettings): Promise<void> {
  await api.post('/api/backup/settings', settings);
}

export async function sendTestEmail(): Promise<void> {
  await api.post('/api/backup/test-email', {});
}
