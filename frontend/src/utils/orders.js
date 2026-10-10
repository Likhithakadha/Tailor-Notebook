import { tr, currentLocale } from "../i18n";
// Shared helpers for order delivery + payment display

export const DELIVERY_TABS = [
  { key: "all", label: "All" },
  { key: "today", label: "Today" },
  { key: "tomorrow", label: "Tomorrow" },
  { key: "upcoming", label: "Upcoming" },
  { key: "delayed", label: "Delayed" },
];

export const PAYMENT_TABS = [
  { key: "all", label: "Any payment" },
  { key: "pending", label: "Pending" },
  { key: "partial", label: "Partial" },
  { key: "paid", label: "Paid" },
];

export const PAYMENT_LABEL = { paid: "Paid", partial: "Partial", pending: "Pending" };

export function paymentStatusOf(order) {
  const price = Number(order.price) || 0;
  const paid = Number(order.advance_paid) || 0;
  if (price > 0 && price - paid <= 0) return "paid";
  if (paid <= 0) return "pending";
  return "partial";
}

export function remainingOf(order) {
  return Math.max((Number(order.price) || 0) - (Number(order.advance_paid) || 0), 0);
}

// Text for the delivery badge: "Due today", "Due tomorrow", "Due in 5 days", "Delayed by 2 days"
export function deliveryBadge(order) {
  const state = order.delivery_state;
  const d = order.days_to_delivery;
  if (state === "today") return { cls: "today", text: tr("Due today") };
  if (state === "tomorrow") return { cls: "tomorrow", text: tr("Due tomorrow") };
  if (state === "upcoming") return { cls: "upcoming", text: tr("Due in {n} days", { n: d }) };
  if (state === "delayed") {
    const late = Math.abs(d);
    return { cls: "delayed", text: tr(late === 1 ? "Delayed by {n} day" : "Delayed by {n} days", { n: late }) };
  }
  if (state === "delivered") return { cls: "done", text: tr("Delivered") };
  if (state === "cancelled") return { cls: "done", text: tr("Cancelled") };
  return { cls: "nodate", text: tr("No delivery date") };
}

export function rupees(n) {
  return "₹" + (Number(n) || 0).toLocaleString("en-IN");
}

export function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// "2026-10-07" -> "07 Oct 2026" (date-only values, no timezone shifting)
export function formatDay(ymd) {
  if (!ymd) return "";
  const [y, m, d] = String(ymd).slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return "";
  return new Date(y, m - 1, d).toLocaleDateString(currentLocale(), { day: "2-digit", month: "short", year: "numeric" });
}

// ---------- Design details ----------

export const NECK_OPTIONS = ["Round neck", "V neck", "Boat neck", "Square neck", "Sweetheart", "Collar", "High neck", "Deep back", "Keyhole", "Mandarin collar"];
export const SLEEVE_OPTIONS = ["Sleeveless", "Cap sleeve", "Short sleeve", "Elbow length", "3/4 sleeve", "Full sleeve", "Puff sleeve", "Bell sleeve", "Net sleeve"];
export const STYLE_OPTIONS = ["Plain", "Lining", "Piping", "Princess cut", "Padded", "Hooks at front", "Zip at side", "Embroidery work", "Double stitched", "Side slits"];

export function hasDesign(o) {
  return !!(o.design_photo || o.neck_design || o.sleeve_design || o.stitching_style || o.instructions);
}

// Where a saved design photo is served from (same origin as the API, or VITE_API_URL's origin)
export function photoUrl(path) {
  if (!path) return "";
  const base = (import.meta.env.VITE_API_URL || "").replace(/\/api\/?$/, "");
  return base + path;
}

// Shrinks a picked photo in the browser (max 1200px, JPEG) so uploads stay small and fast
export function fileToResizedDataUrl(file, maxSide = 1200, quality = 0.82) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith("image/")) return reject(new Error("Please choose an image file."));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that image."));
    };
    img.src = url;
  });
}
