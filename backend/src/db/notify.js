const { v4: uuidv4 } = require("uuid");
const db = require("./index");

function createNotification(ownerId, message, type = "order", relatedId = null) {
  const id = uuidv4();
  db.prepare(
    `INSERT INTO notifications (id, owner_id, message, type, related_id) VALUES (?, ?, ?, ?, ?)`
  ).run(id, ownerId, message, type, relatedId);
  return id;
}

module.exports = { createNotification };
