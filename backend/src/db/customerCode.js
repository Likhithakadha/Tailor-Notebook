const db = require("./index");

// Next readable customer ID for a shop: CUST-0001, CUST-0002, ...
function nextCustomerCode(ownerId) {
  const rows = db.prepare("SELECT customer_code FROM customers WHERE owner_id = ?").all(ownerId);
  let max = 0;
  for (const r of rows) {
    const m = /(\d+)$/.exec(r.customer_code || "");
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return "CUST-" + String(max + 1).padStart(4, "0");
}

module.exports = { nextCustomerCode };
