const db = require("./index");

// Next readable order ID for a shop: ORD-0001, ORD-0002, ...
function nextOrderCode(ownerId) {
  const rows = db.prepare("SELECT order_code FROM orders WHERE owner_id = ?").all(ownerId);
  let max = 0;
  for (const r of rows) {
    const m = /(\d+)$/.exec(r.order_code || "");
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return "ORD-" + String(max + 1).padStart(4, "0");
}

module.exports = { nextOrderCode };
