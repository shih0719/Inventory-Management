// 數據庫自動備份服務
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');
const logger = require('../config/logger');

const execAsync = promisify(exec);

const BACKUP_DIR = path.join(__dirname, '../../database/backups');
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../database/inventory.db');
const RETENTION_DAYS = 7;
const BACKUP_INTERVAL = 3600000; // 1 小時（毫秒）

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    logger.info('備份目錄已建立', { service: 'BACKUP' });
  }
}

async function performBackup() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      logger.warn('資料庫未找到，跳過備份', { service: 'BACKUP' });
      return;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '').slice(0, 15);
    const backupFile = path.join(BACKUP_DIR, `inventory.backup_${timestamp}.db`);

    // 使用 sqlite3 進行備份
    await execAsync(`sqlite3 "${DB_PATH}" ".backup '${backupFile}'"`);

    const stats = fs.statSync(backupFile);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
    logger.info(`備份成功: ${path.basename(backupFile)} (${sizeMB}MB)`, { service: 'BACKUP' });

    // 清理舊備份
    cleanOldBackups();
  } catch (error) {
    logger.error(`備份失敗: ${error.message}`, { service: 'BACKUP' });
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
          logger.info(`刪除舊備份: ${file}`, { service: 'BACKUP' });
        }
      }
    });

    const backupCount = files.filter(f => f.startsWith('inventory.backup_') && f.endsWith('.db')).length;
    logger.info(`當前備份數: ${backupCount} 個`, { service: 'BACKUP' });
  } catch (error) {
    logger.error(`清理舊備份失敗: ${error.message}`, { service: 'BACKUP' });
  }
}

function startBackupDaemon() {
  ensureBackupDir();

  // 啟動時立即執行一次備份
  performBackup();

  // 設置定期備份
  setInterval(() => {
    performBackup();
  }, BACKUP_INTERVAL);

  logger.info(`定期備份已啟動（每小時執行一次，保留 ${RETENTION_DAYS} 天）`, { service: 'BACKUP' });
}

module.exports = {
  startBackupDaemon,
  performBackup
};
