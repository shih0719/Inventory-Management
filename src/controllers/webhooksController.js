const db = require("../config/database");

const SUPPORTED_EVENTS = ["inventory.changed", "batch.created"];

// GET /api/webhooks — List all subscriptions
async function getAll(req, res) {
  try {
    const subs = await db.all(
      "SELECT * FROM webhook_subscriptions ORDER BY created_at DESC"
    );
    res.json({ success: true, data: subs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

// POST /api/webhooks — Create subscription
async function create(req, res) {
  try {
    const { name, url, events } = req.body;

    if (!name || !url) {
      return res.status(400).json({
        success: false,
        error: "name and url are required",
      });
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      return res.status(400).json({ success: false, error: "Invalid URL format" });
    }

    // Validate events
    const eventsArr = Array.isArray(events) ? events : SUPPORTED_EVENTS;
    const invalidEvents = eventsArr.filter((e) => !SUPPORTED_EVENTS.includes(e));
    if (invalidEvents.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Unsupported events: ${invalidEvents.join(", ")}. Valid: ${SUPPORTED_EVENTS.join(", ")}`,
      });
    }

    const result = await db.run(
      `INSERT INTO webhook_subscriptions (name, url, events) VALUES (?, ?, ?)`,
      [name, url, JSON.stringify(eventsArr)]
    );

    const sub = await db.get(
      "SELECT * FROM webhook_subscriptions WHERE id = ?",
      [result.id]
    );
    res.status(201).json({ success: true, data: sub });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

// PUT /api/webhooks/:id — Update subscription
async function update(req, res) {
  try {
    const { id } = req.params;
    const { name, url, events, is_active } = req.body;

    const sub = await db.get(
      "SELECT * FROM webhook_subscriptions WHERE id = ?",
      [id]
    );
    if (!sub) {
      return res.status(404).json({ success: false, error: "Subscription not found" });
    }

    if (url) {
      try { new URL(url); } catch {
        return res.status(400).json({ success: false, error: "Invalid URL format" });
      }
    }

    let eventsStr = sub.events;
    if (events !== undefined) {
      const eventsArr = Array.isArray(events) ? events : JSON.parse(sub.events);
      const invalid = eventsArr.filter((e) => !SUPPORTED_EVENTS.includes(e));
      if (invalid.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Unsupported events: ${invalid.join(", ")}`,
        });
      }
      eventsStr = JSON.stringify(eventsArr);
    }

    await db.run(
      `UPDATE webhook_subscriptions
       SET name = ?, url = ?, events = ?, is_active = ?
       WHERE id = ?`,
      [
        name ?? sub.name,
        url ?? sub.url,
        eventsStr,
        is_active !== undefined ? (is_active ? 1 : 0) : sub.is_active,
        id,
      ]
    );

    const updated = await db.get(
      "SELECT * FROM webhook_subscriptions WHERE id = ?",
      [id]
    );
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

// DELETE /api/webhooks/:id — Remove subscription
async function remove(req, res) {
  try {
    const { id } = req.params;
    const sub = await db.get(
      "SELECT id FROM webhook_subscriptions WHERE id = ?",
      [id]
    );
    if (!sub) {
      return res.status(404).json({ success: false, error: "Subscription not found" });
    }

    await db.run("DELETE FROM webhook_subscriptions WHERE id = ?", [id]);
    res.json({ success: true, message: "Subscription deleted" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

// GET /api/webhooks/:id/logs — Query delivery logs
async function getLogs(req, res) {
  try {
    const { id } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const sub = await db.get(
      "SELECT id FROM webhook_subscriptions WHERE id = ?",
      [id]
    );
    if (!sub) {
      return res.status(404).json({ success: false, error: "Subscription not found" });
    }

    const logs = await db.all(
      `SELECT id, event, status_code, attempts, success, error_message, created_at
       FROM webhook_logs
       WHERE subscription_id = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [id, parseInt(limit), parseInt(offset)]
    );
    res.json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

// POST /api/webhooks/:id/test — Send a test payload
async function test(req, res) {
  try {
    const { id } = req.params;
    const sub = await db.get(
      "SELECT * FROM webhook_subscriptions WHERE id = ?",
      [id]
    );
    if (!sub) {
      return res.status(404).json({ success: false, error: "Subscription not found" });
    }

    const webhookService = require("../services/webhookService");
    // Fire a test event matching the first subscribed event
    const events = JSON.parse(sub.events);
    const testEvent = events[0] || "inventory.changed";

    webhookService.fire(testEvent, {
      _test: true,
      message: "This is a test payload from Inventory Management System",
      subscription_id: sub.id,
      subscription_name: sub.name,
    });

    res.json({
      success: true,
      message: `Test webhook fired for event "${testEvent}". Check logs for delivery result.`,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = { getAll, create, update, remove, getLogs, test };
