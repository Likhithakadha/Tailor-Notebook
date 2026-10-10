import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import BrandMark from "../components/BrandMark";
import LanguageSwitcher from "../components/LanguageSwitcher";
import { useLang } from "../i18n";

export default function Register() {
  const { t } = useLang();
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", shopName: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await register(form);
      navigate("/");
    } catch (err) {
      setError(t(err.message));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-shell auth-register">
      <LanguageSwitcher variant="auth" />
      <span className="auth-orb orb-a" aria-hidden="true" />
      <span className="auth-orb orb-b" aria-hidden="true" />
      <span className="auth-orb orb-c" aria-hidden="true" />
      <div className="auth-card">
        <div className="auth-brand">
          <BrandMark />
          <strong style={{ fontFamily: "var(--font-display)", fontSize: 17 }}>
            Tailor Notebook
          </strong>
        </div>
        <h1 className="auth-title">{t("Set up your shop")}</h1>
        <p className="auth-subtitle">
          {t("One account per shop — customers, measurements, and orders live under it.")}
        </p>

        {error && <div className="error-banner">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="name">{t("Your name")}</label>
            <input
              id="name"
              required
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="Ravi Kumar"
            />
          </div>
          <div className="field">
            <label htmlFor="shopName">{t("Shop name")}</label>
            <input
              id="shopName"
              value={form.shopName}
              onChange={(e) => update("shopName", e.target.value)}
              placeholder="Ravi Tailoring Works"
            />
          </div>
          <div className="field">
            <label htmlFor="email">{t("Email")}</label>
            <input
              id="email"
              type="email"
              required
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              placeholder="you@shop.com"
            />
          </div>
          <div className="field">
            <label htmlFor="password">{t("Password")}</label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              value={form.password}
              onChange={(e) => update("password", e.target.value)}
              placeholder={t("At least 6 characters")}
            />
          </div>
          <button className="btn" type="submit" disabled={submitting} style={{ width: "100%" }}>
            {submitting ? t("Creating account…") : t("Create account")}
          </button>
        </form>

        <div className="auth-switch">
          {t("Already have an account?")} <Link to="/login">{t("Sign in")}</Link>
        </div>
      </div>
    </div>
  );
}
