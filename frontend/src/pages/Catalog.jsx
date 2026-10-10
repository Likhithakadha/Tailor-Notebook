import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { useLang } from "../i18n";

const CATEGORIES = ["all", "fabric", "design"];

export default function Catalog() {
  const { t } = useLang();
  const { token } = useAuth();
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ category: "fabric", name: "", description: "", pricePerUnit: "", imageUrl: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function load(category) {
    setLoading(true);
    try {
      const data = await api.listCatalog(token, category !== "all" ? category : undefined);
      setItems(data.items);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(filter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  async function handleCreate(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await api.createCatalogItem(token, {
        ...form,
        pricePerUnit: form.pricePerUnit ? Number(form.pricePerUnit) : null,
      });
      setForm({ category: "fabric", name: "", description: "", pricePerUnit: "", imageUrl: "" });
      setShowForm(false);
      load(filter);
    } catch (err) {
      setError(t(err.message));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm(t("Remove this catalog item?"))) return;
    await api.deleteCatalogItem(token, id);
    load(filter);
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t("Fabric & Design Catalog")}</h1>
          <p className="page-subtitle">
            {t("Keep a reference of fabrics and design styles you offer — pull from these when creating an order.")}
          </p>
        </div>
        <button className="btn" onClick={() => setShowForm((s) => !s)}>
          {showForm ? t("Cancel") : t("+ Add item")}
        </button>
      </div>

      {showForm && (
        <div className="form-panel" style={{ marginBottom: 28, maxWidth: 520 }}>
          {error && <div className="error-banner">{error}</div>}
          <form onSubmit={handleCreate}>
            <div className="field-row">
              <div className="field">
                <label>{t("Category")}</label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  <option value="fabric">{t("Fabric")}</option>
                  <option value="design">{t("Design")}</option>
                </select>
              </div>
              <div className="field">
                <label>{t("Name")}</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Navy Cotton"
                />
              </div>
            </div>
            <div className="field">
              <label>{t("Description")}</label>
              <textarea
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder={t("Lightweight, breathable — good for summer shirts")}
              />
            </div>
            <div className="field-row">
              <div className="field">
                <label>{t("Price per unit (₹, optional)")}</label>
                <input
                  type="number"
                  value={form.pricePerUnit}
                  onChange={(e) => setForm({ ...form, pricePerUnit: e.target.value })}
                />
              </div>
              <div className="field">
                <label>{t("Image URL (optional)")}</label>
                <input
                  value={form.imageUrl}
                  onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                  placeholder="https://…"
                />
              </div>
            </div>
            <button className="btn" type="submit" disabled={saving}>
              {saving ? t("Saving…") : t("Save to catalog")}
            </button>
          </form>
        </div>
      )}

      <div style={{ display: "flex", gap: 6, marginBottom: 22 }}>
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setFilter(c)}
            className="btn secondary"
            style={{
              padding: "6px 14px",
              fontSize: 13,
              background: filter === c ? "rgba(184,134,59,0.15)" : "transparent",
              borderColor: filter === c ? "var(--thread)" : "var(--paper-line)",
            }}
          >
            {t(c)}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="loading-text">{t("Loading…")}</p>
      ) : items.length === 0 ? (
        <p className="ledger-empty">
          {t("No catalog items yet. Add fabrics or design styles so they're ready to attach to orders.")}
        </p>
      ) : (
        <div className="ledger">
          {items.map((item) => (
            <div className="ledger-row" key={item.id}>
              {item.image_url && (
                <img
                  src={item.image_url}
                  alt={item.name}
                  style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 3, flexShrink: 0 }}
                  onError={(e) => (e.currentTarget.style.display = "none")}
                />
              )}
              <div className="ledger-main">
                <p className="ledger-title">
                  {item.name} <span className="pill pending" style={{ marginLeft: 6 }}>{t(item.category)}</span>
                </p>
                <p className="ledger-meta">
                  {item.description || t("No description")}
                  {item.price_per_unit ? ` · ₹${item.price_per_unit}${t("/unit")}` : ""}
                </p>
              </div>
              <button className="btn danger" onClick={() => handleDelete(item.id)} style={{ flexShrink: 0 }}>
                {t("Remove")}
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
