import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { useLang, currentLocale } from "../i18n";

const PURPOSES = ["measurement", "fitting", "delivery"];

export default function Appointments() {
  const { t } = useLang();
  const { token } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ customerId: "", purpose: "fitting", scheduledAt: "", notes: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [apptData, custData] = await Promise.all([
        api.listAppointments(token),
        api.listCustomers(token),
      ]);
      setAppointments(apptData.appointments);
      setCustomers(custData.customers);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await api.createAppointment(token, {
        ...form,
        scheduledAt: new Date(form.scheduledAt).toISOString(),
      });
      setForm({ customerId: "", purpose: "fitting", scheduledAt: "", notes: "" });
      setShowForm(false);
      load();
    } catch (err) {
      setError(t(err.message));
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(id, status) {
    await api.updateAppointmentStatus(token, id, status);
    load();
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t("Appointments")}</h1>
          <p className="page-subtitle">{t("Fittings, measurement visits, and delivery pickups.")}</p>
        </div>
        <button className="btn" onClick={() => setShowForm((s) => !s)}>
          {showForm ? t("Cancel") : t("+ Schedule")}
        </button>
      </div>

      {showForm && (
        <div className="form-panel" style={{ marginBottom: 28 }}>
          {error && <div className="error-banner">{error}</div>}
          <form onSubmit={handleCreate}>
            <div className="field">
              <label>{t("Customer")}</label>
              <select
                required
                value={form.customerId}
                onChange={(e) => setForm({ ...form, customerId: e.target.value })}
              >
                <option value="">{t("Select a customer")}</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {c.phone}
                  </option>
                ))}
              </select>
            </div>
            <div className="field-row">
              <div className="field">
                <label>{t("Purpose")}</label>
                <select
                  value={form.purpose}
                  onChange={(e) => setForm({ ...form, purpose: e.target.value })}
                >
                  {PURPOSES.map((p) => (
                    <option key={p} value={p}>
                      {t(p)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>{t("Date & time")}</label>
                <input
                  type="datetime-local"
                  required
                  value={form.scheduledAt}
                  onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
                />
              </div>
            </div>
            <div className="field">
              <label>{t("Notes")}</label>
              <input
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder={t("optional")}
              />
            </div>
            <button className="btn" type="submit" disabled={saving}>
              {saving ? t("Scheduling…") : t("Schedule appointment")}
            </button>
          </form>
        </div>
      )}

      {loading ? (
        <p className="loading-text">{t("Loading…")}</p>
      ) : appointments.length === 0 ? (
        <p className="ledger-empty">{t("No appointments scheduled.")}</p>
      ) : (
        <div className="ledger">
          {appointments.map((a) => (
            <div className="ledger-row" key={a.id}>
              <div className="ledger-main">
                <p className="ledger-title">{a.customer_name}</p>
                <p className="ledger-meta">
                  {t(a.purpose)} · {new Date(a.scheduled_at).toLocaleString(currentLocale())}
                  {a.notes ? ` · ${a.notes}` : ""}
                </p>
              </div>
              <span className={`pill ${a.status}`}>{t(a.status)}</span>
              {a.status === "scheduled" && (
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button className="btn secondary" onClick={() => updateStatus(a.id, "completed")}>
                    {t("Done")}
                  </button>
                  <button className="btn danger" onClick={() => updateStatus(a.id, "cancelled")}>
                    {t("Cancel")}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
