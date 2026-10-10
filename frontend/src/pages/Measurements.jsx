import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { groupProfiles } from "../utils/profiles";
import { cleanValues, dressLabel, newDraft, PICKER_TYPES, validateDraft } from "../utils/measurementTemplates";
import CustomerPicker from "../components/CustomerPicker";
import CustomerForm from "../components/CustomerForm";
import MeasurementForm from "../components/MeasurementForm";
import ProfileCard from "../components/ProfileCard";
import { useLang } from "../i18n";

// Measurement Management: every dress type has its own set of fields, and a customer can keep
// several named profiles per dress type (e.g. Blouse - "Wedding fit" and "Casual fit").
export default function Measurements() {
  const { t } = useLang();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  // "Record measurements" panel
  const [showForm, setShowForm] = useState(false);
  const [customer, setCustomer] = useState(null);
  const [addingCustomer, setAddingCustomer] = useState(false);
  const [customerRows, setCustomerRows] = useState([]);
  const [draft, setDraft] = useState(() => newDraft("blouse"));
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const data = await api.listMeasurements(token, { search: search.trim() });
        if (!cancelled) {
          setRows(data.measurements);
          setError("");
        }
      } catch (err) {
        if (!cancelled) setError(t(err.message));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search, token, reloadKey]);

  // Saved profiles of the customer picked in the panel (for name suggestions)
  useEffect(() => {
    if (!customer) {
      setCustomerRows([]);
      return;
    }
    api
      .listMeasurements(token, { customerId: customer.id })
      .then((d) => setCustomerRows(d.measurements))
      .catch(() => {});
  }, [customer, token, reloadKey]);

  const counts = useMemo(() => {
    const c = {};
    groupProfiles(rows).forEach((p) => (c[p.garmentType] = (c[p.garmentType] || 0) + 1));
    return c;
  }, [rows]);

  const customerGroups = useMemo(() => {
    const profiles = groupProfiles(rows).filter((p) => !typeFilter || p.garmentType === typeFilter);
    const groups = [];
    const index = new Map();
    profiles.forEach((p) => {
      if (!index.has(p.customerId)) {
        index.set(p.customerId, groups.length);
        groups.push({ customerId: p.customerId, profiles: [] });
      }
      groups[index.get(p.customerId)].profiles.push(p);
    });
    return groups;
  }, [rows, typeFilter]);

  const suggestions = useMemo(
    () => [...new Set(customerRows.filter((m) => m.garment_type === draft.garmentType).map((m) => m.profile_name))],
    [customerRows, draft.garmentType]
  );

  function reload() {
    setReloadKey((k) => k + 1);
  }

  function openForm() {
    setShowForm((s) => !s);
    setCustomer(null);
    setAddingCustomer(false);
    setDraft(newDraft(typeFilter && PICKER_TYPES.some((tp) => tp.key === typeFilter) ? typeFilter : "blouse"));
    setFormError("");
  }

  async function handleSave(e) {
    e.preventDefault();
    const problem = validateDraft(draft);
    if (problem) return setFormError(problem);
    setSaving(true);
    setFormError("");
    try {
      await api.addMeasurement(token, customer.id, {
        garmentType: draft.garmentType,
        profileName: draft.profileName.trim() || "Default",
        values: cleanValues(draft.values),
        notes: draft.notes,
      });
      setShowForm(false);
      setCustomer(null);
      reload();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function useInOrder(m) {
    navigate(`/orders?new=1&customerId=${m.customer_id}&measurementId=${m.id}`);
  }

  const typeChips = PICKER_TYPES.filter((tp) => counts[tp.key]);
  const totalProfiles = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t("Measurement Management")}</h1>
          <p className="page-subtitle">
            Separate measurements for every dress type. Keep several profiles per customer (wedding fit, casual fit…)
            - each update is saved as a new version.
          </p>
        </div>
        <button className="btn" onClick={openForm}>
          {showForm ? t("Close") : t("+ Record measurements")}
        </button>
      </div>

      {showForm && (
        <div className="form-panel wide" style={{ marginBottom: 32 }}>
          <h2 className="panel-title">{t("Record measurements")}</h2>
          {formError && <div className="error-banner">{formError}</div>}

          <div className="step-block">
            <div className="step-head">
              <p className="step-label">{t("1. Customer")}</p>
              {!customer && !addingCustomer && (
                <button type="button" className="link-btn big" onClick={() => setAddingCustomer(true)}>
                  {t("+ New customer")}
                </button>
              )}
            </div>
            {customer ? (
              <div className="customer-chip">
                <div>
                  <strong>{customer.name}</strong>
                  <span className="id-badge">{customer.customer_code}</span>
                  <p className="ledger-meta">{customer.phone}</p>
                </div>
                <button type="button" className="btn secondary" onClick={() => setCustomer(null)}>
                  {t("Change")}
                </button>
              </div>
            ) : addingCustomer ? (
              <div className="inline-panel" style={{ marginTop: 0 }}>
                <CustomerForm
                  onCreated={(c) => {
                    setCustomer(c);
                    setAddingCustomer(false);
                  }}
                  onUseExisting={(c) => {
                    setCustomer(c);
                    setAddingCustomer(false);
                  }}
                  onCancel={() => setAddingCustomer(false)}
                />
              </div>
            ) : (
              <CustomerPicker onSelect={setCustomer} autoFocus />
            )}
          </div>

          {customer && (
            <form onSubmit={handleSave}>
              <div className="step-block">
                <p className="step-label">{t("2. Measurements")}</p>
                <MeasurementForm draft={draft} onChange={setDraft} profileSuggestions={suggestions} />
                {suggestions.includes(draft.profileName.trim() || "Default") && (
                  <p className="hint">
                    {t("A \"{name}\" {type} profile already exists for this customer - saving adds a new version to it.", { name: draft.profileName.trim() || "Default", type: dressLabel(draft.garmentType).toLowerCase() })}
                  </p>
                )}
              </div>
              <div className="btn-row">
                <button className="btn" type="submit" disabled={saving}>
                  {saving ? t("Saving…") : t("Save measurements")}
                </button>
                <button className="btn secondary" type="button" onClick={() => setShowForm(false)}>
                  {t("Cancel")}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      <div className="filter-bar">
        <input
          className="search-input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("Search by customer name, phone, ID or profile name…")}
          aria-label={t("Search measurements")}
        />
        <div className="chip-row">
          <button type="button" className={"chip" + (typeFilter === "" ? " active" : "")} onClick={() => setTypeFilter("")}>
            All ({totalProfiles})
          </button>
          {typeChips.map((tp) => (
            <button
              key={tp.key}
              type="button"
              className={"chip" + (typeFilter === tp.key ? " active" : "")}
              onClick={() => setTypeFilter(tp.key)}
            >
              {t(tp.label)} ({counts[tp.key]})
            </button>
          ))}
          {counts["saree-blouse"] ? (
            <button
              type="button"
              className={"chip" + (typeFilter === "saree-blouse" ? " active" : "")}
              onClick={() => setTypeFilter("saree-blouse")}
            >
              Saree blouse ({counts["saree-blouse"]})
            </button>
          ) : null}
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {loading ? (
        <p className="loading-text">{t("Loading…")}</p>
      ) : customerGroups.length === 0 ? (
        <p className="ledger-empty">
          {search || typeFilter
            ? t("No measurements match this filter.")
            : t("No measurements saved yet. Use “+ Record measurements” to add the first one.")}
        </p>
      ) : (
        customerGroups.map((g) => (
          <div className="customer-group" key={g.customerId}>
            {g.profiles.map((p) => (
              <ProfileCard key={p.key} profile={p} showCustomer onChanged={reload} onUseInOrder={useInOrder} />
            ))}
          </div>
        ))
      )}
    </>
  );
}
