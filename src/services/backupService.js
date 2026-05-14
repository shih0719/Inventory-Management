// 数据库自动备份服务（Windows 兼容版）
const fs = require('fs');
const path = require('path');
const logger = require('../config/logger');

const BACKUP_DIR = path.join(__dirname, '../../database/backups');
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../database/inventory.db');
const RETENTION_DAYS = 7;
const BACKUP_INTERVAL = 3600000; // 1 小时（毫秒）

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    logger.info('备份目录已建立', { service: 'BACKUP' });
  }
}

async function performBackup() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      logger.warn('数据库未找到，跳过备份', { service: 'BACKUP' });
      return;
    }

    const timestamp = new Date().toISOString().replace(/[:-]/g, '').slice(0, 15);
    const backupFile = path.join(BACKUP_DIR, `inventory.backup_${timestamp}.db`);

    // 使用文件复制备份（Windows 兼容）
    fs.copyFileSync(DB_PATH, backupFile);

    const stats = fs.statSync(backupFile);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
    logger.info(`备份成功: ${path.basename(backupFile)} (${sizeMB}MB)`, { service: 'BACKUP' });

    // 清理旧备份
    cleanOldBackups();
  } catch (error) {
    logger.error(`备份失败: ${error.message}`, { service: 'BACKUP' });
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

function startBackupDaemon() {
  ensureBackupDir();

  // 启动时立即执行一次备份
  performBackup();

  // 设置定期备份
  setInterval(() => {
    performBackup();
  }, BACKUP_INTERVAL);

  logger.info(`定期备份已启动（每小时执行一次，保留 ${RETENTION_DAYS} 天）`, { service: 'BACKUP' });
}

module.exports = {
  startBackupDaemon,
  performBackup
};
