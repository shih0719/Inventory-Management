// 数据库自动备份服务（Windows 兼容版）
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const logger = require('../config/logger');

const BACKUP_DIR = path.join(__dirname, '../../database/backups');
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../database/inventory.db');
const SETTINGS_PATH = path.join(__dirname, '../../database/backup-settings.json');
const RETENTION_DAYS = 7;
const BACKUP_INTERVAL = 6 * 3600000; // 6 小時
const WEEKLY_INTERVAL = 7 * 24 * 3600000; // 7 天

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    logger.info('备份目录已建立', { service: 'BACKUP' });
  }
}

function loadEmailSettings() {
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
    }
  } catch {
    // ignore
  }
  return {
    host: process.env.BACKUP_EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.BACKUP_EMAIL_PORT || '587'),
    user: process.env.BACKUP_EMAIL_USER || '',
    pass: process.env.BACKUP_EMAIL_PASS || '',
    to: process.env.BACKUP_EMAIL_TO || '',
    enabled: false,
  };
}

function saveEmailSettings(settings) {
  const dir = path.dirname(SETTINGS_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf8');
}

async function performBackup() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      logger.warn('数据库未找到，跳过备份', { service: 'BACKUP' });
      return null;
    }

    const timestamp = new Date().toISOString().replace(/[:-]/g, '').slice(0, 15);
    const backupFile = path.join(BACKUP_DIR, `inventory.backup_${timestamp}.db`);

    fs.copyFileSync(DB_PATH, backupFile);

    const stats = fs.statSync(backupFile);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
    logger.info(`备份成功: ${path.basename(backupFile)} (${sizeMB}MB)`, { service: 'BACKUP' });

    cleanOldBackups();
    return { file: backupFile, sizeMB };
  } catch (error) {
    logger.error(`备份失败: ${error.message}`, { service: 'BACKUP' });
    return null;
  }
}

function cleanOldBackups() {
  try {
    const now = Date.now();
    const files = fs.readdirSync(BACKUP_DIR);

    files.forEach(file => {
      if (file.startsWith('inventory.backup_') && file.endsWith('.db')) {
        const filePath = path.join(BACKUP_DIR, file);
        const stat = fs.statSync(filePath);
        const ageInDays = (now - stat.mtimeMs) / (1000 * 60 * 60 * 24);
        if (ageInDays > RETENTION_DAYS) {
          fs.unlinkSync(filePath);
          logger.info(`删除旧备份: ${file}`, { service: 'BACKUP' });
        }
      }
    });

    const backupCount = files.filter(f => f.startsWith('inventory.backup_') && f.endsWith('.db')).length;
    logger.info(`当前备份数: ${backupCount} 个`, { service: 'BACKUP' });
  } catch (error) {
    logger.error(`清理旧备份失败: ${error.message}`, { service: 'BACKUP' });
  }
}

async function sendBackupEmail(backupResult, settings) {
  const { host, port, user, pass, to } = settings;

  if (!user || !pass || !to) {
    logger.warn('未設定 Email，跳過寄信', { service: 'BACKUP' });
    return;
  }

  const transporter = nodemailer.createTransport({
    host: host || 'smtp.gmail.com',
    port: port || 587,
    secure: false,
    auth: { user, pass },
  });

  const dateStr = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });

  await transporter.sendMail({
    from: `庫存系統備份 <${user}>`,
    to,
    subject: `[庫存系統] 每週資料庫備份 ${dateStr}`,
    text: `附件為本週資料庫備份檔案。\n\n備份時間：${dateStr}\n檔案大小：${backupResult.sizeMB} MB\n`,
    attachments: [{ filename: path.basename(backupResult.file), path: backupResult.file }],
  });

  logger.info(`每週備份 Email 已寄出至 ${to}`, { service: 'BACKUP' });
}

async function sendTestEmail(settings) {
  const { host, port, user, pass, to } = settings;

  const transporter = nodemailer.createTransport({
    host: host || 'smtp.gmail.com',
    port: port || 587,
    secure: false,
    auth: { user, pass },
  });

  const dateStr = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });

  await transporter.sendMail({
    from: `庫存系統備份 <${user}>`,
    to,
    subject: `[庫存系統] Email 測試 ${dateStr}`,
    text: `這是測試信件，Email 設定正常。\n\n時間：${dateStr}`,
  });
}

async function weeklyBackupAndEmail() {
  const settings = loadEmailSettings();
  if (!settings.enabled) return;

  const result = await performBackup();
  if (result) {
    try {
      await sendBackupEmail(result, settings);
    } catch (error) {
      logger.error(`寄送備份 Email 失敗: ${error.message}`, { service: 'BACKUP' });
    }
  }
}

function startBackupDaemon() {
  ensureBackupDir();
  performBackup();

  setInterval(() => { performBackup(); }, BACKUP_INTERVAL);
  setInterval(() => { weeklyBackupAndEmail(); }, WEEKLY_INTERVAL);

  logger.info(`定期備份已啟動（每 6 小時備份，每週寄信，保留 ${RETENTION_DAYS} 天）`, { service: 'BACKUP' });
}

module.exports = {
  startBackupDaemon,
  performBackup,
  weeklyBackupAndEmail,
  loadEmailSettings,
  saveEmailSettings,
  sendTestEmail,
};
