const { exec } = require("child_process");
const util = require("util");
const execPromise = util.promisify(exec);
const logger = require("../config/logger");

/**
 * 檢查更新
 * 執行 git fetch 並比較本地與遠端分支
 */
async function checkUpdate(req, res) {
  try {
    // 1. 執行 git fetch
    await execPromise("git fetch origin");

    // 2. 獲取本地 Hash
    const localHash = (await execPromise("git rev-parse HEAD")).stdout.trim();

    // 3. 獲取遠端 Hash (假設是 main 分支)
    const remoteHash = (await execPromise("git rev-parse @{u}")).stdout.trim();

    const updateAvailable = localHash !== remoteHash;

    res.json({
      success: true,
      data: {
        updateAvailable,
        localHash: localHash.substring(0, 7),
        remoteHash: remoteHash.substring(0, 7),
      },
    });
  } catch (error) {
    logger.error(`Check update error: ${error.message}`, { service: 'SYSTEM' });
    res.status(500).json({
      success: false,
      error: "無法檢查更新，請確認 Git 環境與遠端連線",
      details: error.message,
    });
  }
}

/**
 * 套用更新
 * 執行 git pull 並重啟服務 (透過 process.exit 讓 Docker 重啟)
 */
async function applyUpdate(req, res) {
  try {
    // 1. 執行 git pull
    // 這裡我們強制 pull，如果有 conflict 可能會報錯
    const { stdout, stderr } = await execPromise("git pull origin main --rebase");

    // 2. 回傳成功訊息，提醒使用者系統即將重啟
    res.json({
      success: true,
      message: "更新成功，系統即將在 3 秒後重啟...",
      output: stdout,
    });

    // 3. 延遲退出進程，讓 Docker Compose (restart: always) 重新啟動容器
    setTimeout(() => {
      logger.info("Applying update: Restarting system...", { service: 'SYSTEM' });
      process.exit(1);
    }, 3000);

  } catch (error) {
    logger.error(`Apply update error: ${error.message}`, { service: 'SYSTEM' });
    res.status(500).json({
      success: false,
      error: "更新失敗，可能存在代碼衝突",
      details: error.message,
    });
  }
}

module.exports = {
  checkUpdate,
  applyUpdate,
};
