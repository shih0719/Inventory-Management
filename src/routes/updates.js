// 更新管理路由
const express = require('express');
const updateService = require('../services/updateService');
const router = express.Router();

// 獲取更新狀態
router.get('/status', (req, res) => {
  try {
    const status = updateService.getStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 手動檢查更新
router.post('/check', async (req, res) => {
  try {
    const status = await updateService.checkRemoteVersion();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 執行更新
router.post('/apply', async (req, res) => {
  try {
    if (updateService.updateStatus.isUpdating) {
      return res.status(409).json({ error: '更新正在進行中' });
    }

    // 非阻塞方式執行更新（應用會重啟）
    res.json({ message: '更新已開始，應用將自動重啟...' });

    // 延遲執行以確保回應已送出
    setTimeout(() => {
      updateService.performUpdate().catch(err => {
        console.error('[UPDATE] 更新失敗:', err.message);
      });
    }, 500);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
