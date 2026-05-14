// 版本檢查與更新服務
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');
const logger = require('../config/logger');

const execAsync = promisify(exec);

class UpdateService {
  constructor() {
    this.currentVersion = this.readLocalVersion();
    this.updateStatus = {
      available: false,
      remoteVersion: null,
      lastCheckTime: null,
      isUpdating: false,
      error: null
    };
  }

  readLocalVersion() {
    try {
      const packagePath = path.join(__dirname, '../../package.json');
      if (!fs.existsSync(packagePath)) {
        logger.error(`package.json not found at: ${packagePath}`, { service: 'UPDATE' });
        return '0.0.0';
      }
      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      const version = packageJson.version;
      logger.info(`Local version loaded: ${version}`, { service: 'UPDATE' });
      return version;
    } catch (error) {
      logger.error(`Error reading version: ${error.message}`, { service: 'UPDATE' });
      return '0.0.0';
    }
  }

  async readRemoteVersion() {
    try {
      // 獲取遠端 package.json（使用 git show）
      const { stdout } = await execAsync('git show origin/main:package.json');
      const remotePackage = JSON.parse(stdout);
      return remotePackage.version;
    } catch (error) {
      throw new Error('無法讀取遠端版本：' + error.message);
    }
  }

  compareVersions(local, remote) {
    const localParts = local.split('.').map(Number);
    const remoteParts = remote.split('.').map(Number);

    for (let i = 0; i < Math.max(localParts.length, remoteParts.length); i++) {
      const l = localParts[i] || 0;
      const r = remoteParts[i] || 0;

      if (l < r) return -1; // local < remote (有新版本)
      if (l > r) return 1;  // local > remote (本地版本較新)
    }
    return 0; // 版本相同
  }

  // 檢查遠端版本
  async checkRemoteVersion() {
    try {
      // 先 fetch 最新信息
      await execAsync('git fetch origin --quiet 2>&1');

      // 讀取遠端版本
      const remoteVersion = await this.readRemoteVersion();

      // 比較版本
      const comparison = this.compareVersions(this.currentVersion, remoteVersion);
      const hasUpdates = comparison < 0;

      this.updateStatus = {
        available: hasUpdates,
        remoteVersion,
        currentVersion: this.currentVersion,
        lastCheckTime: new Date(),
        isUpdating: false,
        error: null
      };

      if (hasUpdates) {
        logger.info(`發現新版本：${this.currentVersion} → ${remoteVersion}`, { service: 'UPDATE' });
      } else {
        logger.info(`已是最新版本：${this.currentVersion}`, { service: 'UPDATE' });
      }

      return this.updateStatus;
    } catch (error) {
      this.updateStatus.error = error.message;
      logger.error(`版本檢查失敗: ${error.message}`, { service: 'UPDATE' });
      return this.updateStatus;
    }
  }

  // 執行更新
  async performUpdate() {
    if (this.updateStatus.isUpdating) {
      throw new Error('更新正在進行中，請勿重複觸發');
    }

    try {
      this.updateStatus.isUpdating = true;
      this.updateStatus.error = null;

      logger.info('開始更新流程...', { service: 'UPDATE' });

      // 第一步：停止 Docker 容器（解除文件鎖定）
      logger.info('停止 Docker 容器以解除文件鎖定...', { service: 'UPDATE' });
      try {
        await execAsync('docker-compose down 2>&1');
        logger.info('Docker 容器已停止', { service: 'UPDATE' });
      } catch (err) {
        logger.warn(`Docker 容器停止失敗，將繼續執行: ${err.message}`, { service: 'UPDATE' });
      }

      // 等待一秒確保容器完全停止
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 第二步：git pull
      logger.info(`將版本從 ${this.currentVersion} 更新至 ${this.updateStatus.remoteVersion}...`, { service: 'UPDATE' });
      await execAsync('git fetch origin --quiet && git reset --hard origin/main');

      // 第三步：安裝依賴（如有變更）
      logger.info('安裝依賴...', { service: 'UPDATE' });
      await execAsync('npm install --production');

      // 第四步：重新讀取版本
      this.currentVersion = this.readLocalVersion();

      this.updateStatus = {
        available: false,
        remoteVersion: null,
        currentVersion: this.currentVersion,
        lastCheckTime: new Date(),
        isUpdating: false,
        error: null,
        updateSuccess: true
      };

      logger.info(`更新完成，當前版本：${this.currentVersion}，應用將重啟...`, { service: 'UPDATE' });

      // 第五步：重啟應用（Docker 會自動重啟，本地需要手動）
      process.exit(0);

      return { success: true, message: '更新完成，應用重啟中...' };
    } catch (error) {
      logger.error(`更新失敗: ${error.message}`, { service: 'UPDATE' });
      this.updateStatus.isUpdating = false;
      this.updateStatus.error = error.message;
      throw error;
    }
  }

  // 獲取更新狀態
  getStatus() {
    return {
      currentVersion: this.currentVersion,
      ...this.updateStatus
    };
  }

  // 注意：版本檢查現在只在用戶手動請求時進行，不自動檢查
  // 如需重新啟用自動檢查，可呼叫此方法
  startPeriodicCheck(intervalMinutes = 60) {
    this.checkRemoteVersion().catch(err => {
      logger.error(`初始版本檢查失敗: ${err.message}`, { service: 'UPDATE' });
    });

    setInterval(() => {
      this.checkRemoteVersion().catch(err => {
        logger.error(`版本檢查失敗: ${err.message}`, { service: 'UPDATE' });
      });
    }, intervalMinutes * 60 * 1000);

    logger.info(`版本檢查已啟動（每 ${intervalMinutes} 分鐘檢查一次）`, { service: 'UPDATE' });
  }
}

module.exports = new UpdateService();
