// 版本檢查與更新服務
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');

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
      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      return packageJson.version;
    } catch {
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
        console.log(`[UPDATE] 發現新版本：${this.currentVersion} → ${remoteVersion}`);
      } else {
        console.log(`[UPDATE] 已是最新版本：${this.currentVersion}`);
      }

      return this.updateStatus;
    } catch (error) {
      this.updateStatus.error = error.message;
      console.error('[UPDATE] 版本檢查失敗:', error.message);
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

      console.log('[UPDATE] 開始更新流程...');

      // 第一步：git pull
      console.log(`[UPDATE] 將版本從 ${this.currentVersion} 更新至 ${this.updateStatus.remoteVersion}...`);
      await execAsync('git fetch origin --quiet && git reset --hard origin/main');

      // 第二步：安裝依賴（如有變更）
      console.log('[UPDATE] 安裝依賴...');
      await execAsync('npm install --production');

      // 第三步：重新讀取版本
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

      console.log(`[UPDATE] 更新完成，當前版本：${this.currentVersion}，應用將重啟...`);

      // 第四步：重啟應用（Docker 會自動重啟，本地需要手動）
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

  // 注意：版本檢查現在只在用戶手動請求時進行，不自動檢查
  // 如需重新啟用自動檢查，可呼叫此方法
  startPeriodicCheck(intervalMinutes = 60) {
    this.checkRemoteVersion().catch(err => {
      console.error('[UPDATE] 初始版本檢查失敗:', err.message);
    });

    setInterval(() => {
      this.checkRemoteVersion().catch(err => {
        console.error('[UPDATE] 版本檢查失敗:', err.message);
      });
    }, intervalMinutes * 60 * 1000);

    console.log(`[UPDATE] 版本檢查已啟動（每 ${intervalMinutes} 分鐘檢查一次）`);
  }
}

module.exports = new UpdateService();
