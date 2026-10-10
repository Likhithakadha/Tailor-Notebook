import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { useLang } from "../i18n";

const EMPTY = { name: "", phone: "", gender: "", address: "", email: "" };

// Add a NEW customer. If the phone number already belongs to a saved customer, the tailor is offered
// the existing record instead of creating a duplicate.
export default function CustomerForm({ onCreated, onCancel, onUseExisting }) {
  const { t } = useLang();
  const { token } = useAuth();
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [duplicate, setDuplicate] = useState(null);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function submit(allowDuplicatePhone = false) {
    setError("");
    setSaving(true);
    try {
      const data = await api.createCustomer(token, { ...form, allowDuplicatePhone });
      setForm(EMPTY);
      setDuplicate(null);
      onCreated(data.customer);
    } catch (err) {
      if (err.status === 409 && err.data?.existing) {
        setDuplicate(err.data.existing);
      } else {
        setError(t(err.message));
      }
    } finally {
      setSaving(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    submit(false);
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="error-banner">{error}</div>}

      {duplicate && (
        <div className="dup-banner">
          <p>
            {t("This phone number is already saved for")} <strong>{duplicate.name}</strong> ({duplicate.customer_code}). {t("Returning customer?")}
          </p>
          <div className="btn-row">
            <button type="button" className="btn" onClick={() => onUseExisting(duplicate)}>
              {t("Use {name}", { name: duplicate.name })}
            </button>
            <button type="button" className="btn secondary" onClick={() => submit(true)} disabled={saving}>
              {t("Add as a different customer")}
            </button>
          </div>
        </div>
      )}

      <div className="field-row">
        <div className="field">
          <label>{t("Full name")}</label>
          <input required value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Suresh Kumar" />
        </div>
        <div className="field">
          <label>{t("Phone")}</label>
          <input
            required
            value={form.phone}
            onChange={(e) => {
              set("phone", e.target.value);
              setDuplicate(null);
            }}
            placeholder="98765 43210"
            inputMode="tel"
          />
        </div>
      </div>
      <div className="field-row">
        <div className="field">
          <label>{t("Gender")}</label>
          <select value={form.gender} onChange={(e) => set("gender", e.target.value)}>
            <option value="">{t("Select…")}</option>
            <option value="male">{t("Male")}</option>
            <option value="female">{t("Female")}</option>
            <option value="other">{t("Other")}</option>
          </select>
        </div>
        <div className="field">
          <label>{t("Email (optional)")}</label>
          <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label>{t("Address")}</label>
        <textarea rows={2} value={form.address} onChange={(e) => set("address", e.target.value)} />
      </div>
      <div className="btn-row">
        <button className="btn" type="submit" disabled={saving}>
          {saving ? t("Saving…") : t("Save customer")}
        </button>
        {onCancel && (
          <button className="btn secondary" type="button" onClick={onCancel}>
            {t("Cancel")}
          </button>
        )}
      </div>
    </form>
  );
}
