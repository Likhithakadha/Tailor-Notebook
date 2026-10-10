const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const UPLOAD_DIR = path.resolve(__dirname, "../../uploads");
const MAX_BYTES = 4 * 1024 * 1024;
const EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

function ensureDir() {
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Saves a "data:image/...;base64,..." string as a file and returns its public path (/uploads/<id>.jpg).
// Throws an error with status 400 for anything that is not a small JPEG/PNG/WebP image.
function savePhoto(dataUrl) {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ""));
  if (!m) {
    const err = new Error("Photo must be a JPEG, PNG or WebP image");
    err.status = 400;
    throw err;
  }
  const buf = Buffer.from(m[2], "base64");
  if (buf.length > MAX_BYTES) {
    const err = new Error("Photo is too large (max 4 MB)");
    err.status = 400;
    throw err;
  }
  ensureDir();
  const name = `${uuidv4()}.${EXT[m[1]]}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, name), buf);
  return `/uploads/${name}`;
}

function removePhoto(publicPath) {
  if (!publicPath || !publicPath.startsWith("/uploads/")) return;
  const file = path.join(UPLOAD_DIR, path.basename(publicPath));
  try {
    fs.unlinkSync(file);
  } catch {
    /* already gone */
  }
}

module.exports = { savePhoto, removePhoto, UPLOAD_DIR };
