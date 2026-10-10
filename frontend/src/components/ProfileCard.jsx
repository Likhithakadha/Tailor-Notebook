import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { downloadBlob } from "../utils/download";
import { formatDate } from "../utils/profiles";
import {
  cleanValues,
  dressLabel,
  draftFromMeasurement,
  fieldLabel,
  validateDraft,
} from "../utils/measurementTemplates";
import MeasurementForm from "./MeasurementForm";
import { useLang } from "../i18n";

function ValueTags({ values }) {
  return (
    <div className="tag-row">
      {Object.entries(values).map(([k, v]) => (
        <span className="tag" key={k}>
          {fieldLabel(k)}: {v}"
        </span>
      ))}
    </div>
  );
}

// One measurement profile (e.g. Blouse - "Wedding fit"): latest values, update-as-new-version,
// rename, version history, PDF card, and a shortcut to start an order with it.
export default function ProfileCard({ profile, showCustomer = false, onChanged, onUseInOrder }) {
  const { t } = useLang();
  const { token } = useAuth();
  const { latest, versions } = profile;
  const [mode, setMode] = useState(null); // null | "update" | "rename" | "history"
  const [draft, setDraft] = useState(null);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function toggle(next) {
    setError("");
    if (mode === next) {
      setMode(null);
      return;
    }
    if (next === "update") setDraft(draftFromMeasurement(latest));
    if (next === "rename") setNewName(profile.profileName);
    setMode(next);
  }

  async function saveUpdate(e) {
    e.preventDefault();
    const problem = validateDraft(draft);
    if (problem) return setError(problem);
    setBusy(true);
    setError("");
    try {
      await api.addMeasurement(token, profile.customerId, {
        garmentType: profile.garmentType,
        profileName: profile.profileName,
        values: cleanValues(draft.values),
        notes: draft.notes,
      });
      setMode(null);
      onChanged();
    } catch (err) {
      setError(t(err.message));
    } finally {
      setBusy(false);
    }
  }

  async function saveRename(e) {
    e.preventDefault();
    if (!newName.trim()) return setError(t("Profile name cannot be empty."));
    setBusy(true);
    setError("");
    try {
      await api.renameMeasurementProfile(token, profile.customerId, {
        garmentType: profile.garmentType,
        from: profile.profileName,
        to: newName.trim(),
      });
      setMode(null);
      onChanged();
    } catch (err) {
      setError(t(err.message));
    } finally {
      setBusy(false);
    }
  }

  async function downloadPdf(m) {
    try {
      const { blob, filename } = await api.downloadMeasurementPdf(token, profile.customerId, m.id);
      downloadBlob(blob, filename);
    } catch (err) {
      setError(t(err.message));
    }
  }

  async function deleteVersion(m) {
    const last = versions.length === 1;
    const msg = last
      ? t("Delete the \"{name}\" {type} profile? Orders using it keep working but lose the link.", { name: profile.profileName, type: dressLabel(profile.garmentType) })
      : t("Delete version {v} of \"{name}\"?", { v: m.version, name: profile.profileName });
    if (!window.confirm(msg)) return;
    try {
      await api.deleteMeasurement(token, profile.customerId, m.id);
      onChanged();
    } catch (err) {
      setError(t(err.message));
    }
  }

  return (
    <div className="profile-card">
      <div className="profile-head">
        <div>
          {showCustomer && (
            <p className="profile-customer">
              <Link to={`/customers/${profile.customerId}`}>{latest.customer_name}</Link>
              <span className="id-badge">{latest.customer_code}</span>
            </p>
          )}
          <p className="profile-title">
            <span className="type-badge">{dressLabel(profile.garmentType)}</span>
            {profile.profileName}
            <span className="muted-inline"> · v{latest.version}</span>
          </p>
          <p className="ledger-meta">
            {t("Recorded")} {formatDate(latest.recorded_at)}
            {versions.length > 1 ? ` · ${t("{n} versions saved", { n: versions.length })}` : ""}
            {latest.notes ? ` · ${latest.notes}` : ""}
          </p>
        </div>
        <div className="profile-actions">
          {onUseInOrder && (
            <button type="button" className="btn" onClick={() => onUseInOrder(latest)}>
              {t("Use in new order")}
            </button>
          )}
          <button type="button" className="btn secondary" onClick={() => toggle("update")}>
            {mode === "update" ? t("Cancel") : t("Update")}
          </button>
          <button type="button" className="btn secondary" onClick={() => downloadPdf(latest)}>
            {t("PDF card")}
          </button>
          <button type="button" className="btn secondary" onClick={() => toggle("rename")}>
            {t("Rename")}
          </button>
          {versions.length > 1 && (
            <button type="button" className="btn secondary" onClick={() => toggle("history")}>
              {mode === "history" ? t("Hide history") : `${t("History")} (${versions.length})`}
            </button>
          )}
          {versions.length === 1 && (
            <button type="button" className="btn danger" onClick={() => deleteVersion(latest)}>
              {t("Delete")}
            </button>
          )}
        </div>
      </div>

      <ValueTags values={latest.values} />

      {error && (
        <div className="error-banner" style={{ marginTop: 12 }}>
          {error}
        </div>
      )}

      {mode === "update" && draft && (
        <form className="inline-panel" onSubmit={saveUpdate}>
          <p className="hint">
            {t("Saving creates version {n} of this profile. The older version stays in history.", { n: latest.version + 1 })}
          </p>
          <MeasurementForm draft={draft} onChange={setDraft} lockGarment lockProfile />
          <div className="btn-row">
            <button className="btn" type="submit" disabled={busy}>
              {busy ? "Saving…" : t("Save as version {n}", { n: latest.version + 1 })}
            </button>
          </div>
        </form>
      )}

      {mode === "rename" && (
        <form className="inline-panel" onSubmit={saveRename}>
          <div className="field" style={{ maxWidth: 320 }}>
            <label>{t("New profile name")}</label>
            <input value={newName} maxLength={60} onChange={(e) => setNewName(e.target.value)} autoFocus />
          </div>
          <div className="btn-row">
            <button className="btn" type="submit" disabled={busy}>
              {t("Save name")}
            </button>
          </div>
        </form>
      )}

      {mode === "history" && (
        <div className="inline-panel">
          {versions.map((m) => (
            <div className="history-row" key={m.id}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong>v{m.version}</strong>
                <span className="muted-inline"> · {formatDate(m.recorded_at)}</span>
                <ValueTags values={m.values} />
              </div>
              <div className="profile-actions">
                <button type="button" className="btn secondary" onClick={() => downloadPdf(m)}>
                  PDF
                </button>
                <button type="button" className="btn danger" onClick={() => deleteVersion(m)}>
                  {t("Delete")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
