import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import BrandMark from "../components/BrandMark";
import LanguageSwitcher from "../components/LanguageSwitcher";
import { useLang } from "../i18n";

export default function Login() {
  const { t } = useLang();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError(t(err.message));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-shell auth-login">
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
        <h1 className="auth-title">{t("Welcome back")}</h1>
        <p className="auth-subtitle">{t("Sign in to pick up where you left off.")}</p>

        {error && <div className="error-banner">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="email">{t("Email")}</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@shop.com"
            />
          </div>
          <div className="field">
            <label htmlFor="password">{t("Password")}</label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <button className="btn" type="submit" disabled={submitting} style={{ width: "100%" }}>
            {submitting ? t("Signing in…") : t("Sign in")}
          </button>
        </form>

        <div className="auth-switch">
          {t("New to Tailor Notebook?")} <Link to="/register">{t("Create a shop account")}</Link>
        </div>
      </div>
    </div>
  );
}
