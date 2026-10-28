const { createOutbound, OutboundError } = require("../services/outboundService");

// POST /api/outbound — one outbound: quantity lines + AP serials (+ shipment when tag is OUTBOUND)
async function create(req, res) {
  const { tag_id, description, items, serial_numbers, shipment } = req.body;
  if (!tag_id) {
    return res.status(400).json({ success: false, code: "TAG_ID_REQUIRED", params: {}, error: "tag_id is required" });
  }
  try {
    const data = await createOutbound(
      {
        tagId: tag_id,
        description: description || "",
        items: Array.isArray(items) ? items : [],
        serials: Array.isArray(serial_numbers) ? serial_numbers : [],
        shipment: shipment || {},
      },
      { userId: req.user?.id, username: req.user?.username || "unknown", warehouseId: req.warehouseId }
    );
    res.status(201).json({ success: true, data });
  } catch (error) {
    if (error instanceof OutboundError) {
      const { code, params, message, errors } = error;
      return res.status(400).json({ success: false, code, params, error: message, errors });
    }
    console.error("Error creating outbound:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = { create };
