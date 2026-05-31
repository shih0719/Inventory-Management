const express = require('express');
const router = express.Router();
const { verifyAuth, requireRole } = require('../middleware/authMiddleware');
const { loadEmailSettings, saveEmailSettings, sendTestEmail } = require('../services/backupService');

router.get('/settings', verifyAuth, requireRole(['admin']), (req, res) => {
  const settings = loadEmailSettings();
  // 不回傳密碼明文，只回傳是否已設定
  res.json({ ...settings, pass: settings.pass ? '••••••••' : '' });
});

router.post('/settings', verifyAuth, requireRole(['admin']), (req, res) => {
  const { host, port, user, pass, to, enabled } = req.body;
  const current = loadEmailSettings();

  const updated = {
    host: host || current.host,
    port: parseInt(port) || current.port,
    user: user !== undefined ? user : current.user,
    // 若前端傳回遮罩值則保留舊密碼
    pass: pass && pass !== '••••••••' ? pass : current.pass,
    to: to !== undefined ? to : current.to,
    enabled: typeof enabled === 'boolean' ? enabled : current.enabled,
  };

  saveEmailSettings(updated);
  res.json({ ok: true });
});

router.post('/test-email', verifyAuth, requireRole(['admin']), async (req, res) => {
  const settings = loadEmailSettings();

  if (!settings.user || !settings.pass || !settings.to) {
    return res.status(400).json({ error: '請先設定完整的 Email 資訊' });
  }

  try {
    await sendTestEmail(settings);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
