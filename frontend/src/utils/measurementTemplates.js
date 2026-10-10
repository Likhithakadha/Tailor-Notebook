import { tr } from "../i18n";
// Measurement fields for every dress type. Keys are stored in the database exactly as written here,
// so keep them stable. (Tailors can also add custom fields per measurement from the form.)

const BLOUSE_FIELDS = ["shoulder", "bust", "waist", "sleeve-length", "armhole", "neck-depth", "blouse-length"];

export const DRESS_TYPES = [
  { key: "blouse", label: "Blouse", fields: BLOUSE_FIELDS },
  {
    key: "salwar",
    label: "Salwar kameez",
    fields: [
      "top-length", "shoulder", "bust", "waist", "hip", "sleeve-length", "armhole", "neck-depth",
      "bottom-length", "bottom-waist", "thigh", "ankle",
    ],
  },
  { key: "churidar", label: "Churidar / Leggings", fields: ["waist", "hip", "thigh", "knee", "calf", "ankle", "length"] },
  { key: "kurta", label: "Kurta", fields: ["chest", "waist", "hip", "shoulder", "sleeve", "length", "armhole", "neck-depth"] },
  { key: "shirt", label: "Shirt", fields: ["chest", "waist", "hip", "shoulder", "sleeve", "length", "collar", "cuff"] },
  { key: "pant", label: "Pant", fields: ["waist", "hip", "inseam", "length", "thigh", "knee", "bottom-opening", "crotch"] },
  {
    key: "suit",
    label: "Suit / Blazer",
    fields: ["chest", "waist", "hip", "shoulder", "sleeve", "jacket-length", "trouser-length"],
  },
  { key: "lehenga", label: "Lehenga", fields: ["waist", "hip", "lehenga-length"] },
  { key: "skirt", label: "Skirt", fields: ["waist", "hip", "skirt-length"] },
  {
    key: "frock",
    label: "Kids frock",
    fields: ["chest", "waist", "shoulder", "sleeve-length", "frock-length", "neck-depth"],
  },
  { key: "other", label: "Other (custom)", fields: [] },
  // Older records may use this type; it stays readable/updatable but is no longer offered for new entries.
  { key: "saree-blouse", label: "Saree blouse", fields: BLOUSE_FIELDS, hidden: true },
];

const BY_KEY = Object.fromEntries(DRESS_TYPES.map((t) => [t.key, t]));

export const PICKER_TYPES = DRESS_TYPES.filter((t) => !t.hidden);

// Options for a dress-type <select>; keeps a legacy type visible if a record already uses it
export function typeOptions(current) {
  if (current && BY_KEY[current]?.hidden) return [...PICKER_TYPES, BY_KEY[current]];
  return PICKER_TYPES;
}

export function dressLabel(key) {
  if (BY_KEY[key]) return tr(BY_KEY[key].label);
  const text = String(key || "").replace(/-/g, " ");
  return tr(text.charAt(0).toUpperCase() + text.slice(1));
}

export function fieldLabel(key) {
  const text = String(key).replace(/-/g, " ");
  return tr(text.charAt(0).toUpperCase() + text.slice(1));
}

export function slugField(name) {
  return String(name)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function templateFields(typeKey) {
  return BY_KEY[typeKey]?.fields || [];
}

// { field: "" } for every field of the dress type; carries over values for fields it shares
export function emptyValues(typeKey, carry = {}) {
  const out = {};
  templateFields(typeKey).forEach((f) => {
    out[f] = carry[f] !== undefined ? String(carry[f]) : "";
  });
  return out;
}

export function newDraft(typeKey = "blouse") {
  return { garmentType: typeKey, profileName: "", values: emptyValues(typeKey), notes: "" };
}

// Draft for adding a new VERSION of an existing profile: template fields + any custom keys it already has
export function draftFromMeasurement(m) {
  const values = emptyValues(m.garment_type);
  Object.entries(m.values || {}).forEach(([k, v]) => (values[k] = String(v)));
  return { garmentType: m.garment_type, profileName: m.profile_name || "Default", values, notes: m.notes || "" };
}

export function cleanValues(values) {
  return Object.fromEntries(
    Object.entries(values).filter(([, v]) => v !== "" && v !== null && v !== undefined)
  );
}

// Returns an error message, or "" when the draft can be saved
export function validateDraft(draft) {
  const filled = cleanValues(draft.values);
  if (Object.keys(filled).length === 0) return tr("Enter at least one measurement.");
  for (const [k, v] of Object.entries(filled)) {
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0 || n > 500) {
      return tr("\"{field}\" must be a number between 0 and 500 inches.", { field: fieldLabel(k) });
    }
  }
  if (draft.profileName && draft.profileName.length > 60) return tr("Profile name is too long (max 60 characters).");
  return "";
}
