// 版本檢查與更新服務
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');

const execAsync = promisify(exec);

class UpdateService {
  constructor() {
    this.currentVersion = this.readVersion();
    this.updateStatus = {
      available: false,
      remoteVersion: null,
      lastCheckTime: null,
      isUpdating: false,
      error: null
    };
  }

  readVersion() {
    try {
      const packagePath = path.join(__dirname, '../../package.json');
      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      return packageJson.version;
    } catch {
      return '1.0.0';
    }
  }

  // 檢查遠端版本（從 GitHub 或本地 git）
  async checkRemoteVersion() {
    try {
      // 方式 1：使用 git 標籤（如果有）
      // 方式 2：直接讀取遠端 package.json

      const { stdout } = await execAsync('git fetch origin --quiet 2>&1 && git rev-parse origin/main');

      // 檢查是否有新提交
      const { stdout: localHash } = await execAsync('git rev-parse HEAD');
      const localCommit = localHash.trim();
      const remoteCommit = stdout.trim();

      const hasUpdates = localCommit !== remoteCommit;

      this.updateStatus = {
        available: hasUpdates,
        localCommit,
        remoteCommit,
        lastCheckTime: new Date(),
        isUpdating: false,
        error: null
      };

      return this.updateStatus;
    } catch (error) {
      this.updateStatus.error = error.message;
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

      // 第一步：備份當前狀態
      console.log('[UPDATE] 開始更新流程...');

      // 第二步：git pull
      console.log('[UPDATE] 下載新版本代碼...');
      await execAsync('git fetch origin --quiet && git reset --hard origin/main');

      // 第三步：安裝依賴（如有變更）
      console.log('[UPDATE] 安裝依賴...');
      await execAsync('npm install --production');

      // 第四步：重新讀取版本
      this.currentVersion = this.readVersion();

      this.updateStatus = {
        available: false,
        remoteVersion: null,
        lastCheckTime: new Date(),
        isUpdating: false,
        error: null,
        updateSuccess: true
      };

      console.log('[UPDATE] 更新完成，應用將重啟...');

      // 第五步：重啟應用（Docker 會自動重啟，本地需要手動）
      process.exit(0);

      return { success: true, message: '更新完成，應用重啟中...' };
    } catch (error) {
      console.error('[UPDATE] 更新失敗:', error.message);
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

  // 定期檢查更新（應在應用啟動時調用）
  startPeriodicCheck(intervalMinutes = 60) {
    // 啟動時立即檢查一次
    this.checkRemoteVersion().catch(err => {
      console.error('[UPDATE] 初始版本檢查失敗:', err.message);
    });

    // 之後定期檢查
    setInterval(() => {
      this.checkRemoteVersion().catch(err => {
        console.error('[UPDATE] 版本檢查失敗:', err.message);
      });
    }, intervalMinutes * 60 * 1000);

    console.log(`[UPDATE] 版本檢查已啟動（每 ${intervalMinutes} 分鐘檢查一次）`);
  }
}

module.exports = new UpdateService();
