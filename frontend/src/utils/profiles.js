import { currentLocale } from "../i18n";
// Groups flat measurement rows into profiles: one profile = customer + dress type + profile name,
// holding every saved version (newest first).
export function groupProfiles(measurements) {
  const map = new Map();
  for (const m of measurements) {
    const name = m.profile_name || "Default";
    const key = `${m.customer_id}|${m.garment_type}|${name}`;
    if (!map.has(key)) {
      map.set(key, { key, customerId: m.customer_id, garmentType: m.garment_type, profileName: name, versions: [] });
    }
    map.get(key).versions.push(m);
  }
  const profiles = [...map.values()];
  profiles.forEach((p) => {
    p.versions.sort((a, b) => b.version - a.version);
    p.latest = p.versions[0];
  });
  profiles.sort(
    (a, b) =>
      String(b.latest.recorded_at || "").localeCompare(String(a.latest.recorded_at || "")) ||
      b.latest.version - a.latest.version
  );
  return profiles;
}

export function formatDate(value) {
  if (!value) return "";
  // SQLite timestamps look like "2026-10-07 05:59:00" (UTC)
  const d = new Date(String(value).includes("T") ? value : String(value).replace(" ", "T") + "Z");
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(currentLocale());
}
