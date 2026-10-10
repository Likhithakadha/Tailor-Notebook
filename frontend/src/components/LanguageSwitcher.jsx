import { LANGUAGES, useLang } from "../i18n";

export default function LanguageSwitcher({ variant = "sidebar" }) {
  const { lang, setLang, t } = useLang();
  return (
    <div className={`lang-switch lang-switch-${variant}`} role="group" aria-label={t("Language")}>
      {LANGUAGES.map((l) => (
        <button
          key={l.code}
          type="button"
          className={"lang-btn" + (lang === l.code ? " active" : "")}
          onClick={() => setLang(l.code)}
          aria-pressed={lang === l.code}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
