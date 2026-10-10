import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import te from "./te";
import hi from "./hi";

export const LANGUAGES = [
  { code: "en", label: "English", short: "EN", locale: "en-IN" },
  { code: "te", label: "తెలుగు", short: "తె", locale: "te-IN" },
  { code: "hi", label: "हिन्दी", short: "हि", locale: "hi-IN" },
];

const DICTS = { en: {}, te, hi };
const STORAGE_KEY = "tailor-notebook-lang";

function initialLang() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && DICTS[saved]) return saved;
  } catch {
    /* ignore */
  }
  return "en";
}

// Module-level current language so plain helper functions (utils) can translate too.
let currentLang = initialLang();

function interpolate(str, vars) {
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (_, k) => (vars[k] === undefined ? `{${k}}` : String(vars[k])));
}

// tr("Cancel") -> translated text; tr("Due in {n} days", { n: 3 }) -> with values filled in.
// The English text itself is the key, so a missing translation just shows English.
export function tr(text, vars) {
  if (text === null || text === undefined || text === "") return text;
  const dict = DICTS[currentLang] || {};
  const key = String(text);
  return interpolate(dict[key] ?? key, vars);
}

export function currentLocale() {
  return (LANGUAGES.find((l) => l.code === currentLang) || LANGUAGES[0]).locale;
}

const LangContext = createContext({ lang: "en", setLang: () => {}, t: tr });

export function LangProvider({ children }) {
  const [lang, setLangState] = useState(currentLang);

  const setLang = useCallback((code) => {
    if (!DICTS[code]) return;
    currentLang = code;
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch {
      /* ignore */
    }
    setLangState(code);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.setAttribute("data-lang", lang);
  }, [lang]);

  // New `t` identity per language so every consumer re-renders when the language changes.
  const value = useMemo(() => ({ lang, setLang, t: (text, vars) => tr(text, vars) }), [lang, setLang]);

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang() {
  return useContext(LangContext);
}

// Notification messages are saved in English by the server; rebuild them in the chosen language.
const NOTICE_PATTERNS = [
  [/^New order (\S+): (.+) for (.+)$/, "New order {code}: {type} for {name}", (m) => ({ code: m[1], type: tr(m[2]), name: m[3] })],
  [/^(.+)'s (.+) order (\S*) moved to "(\w+)"$/, "{name}'s {type} order {code} moved to \"{status}\"", (m) => ({ name: m[1], type: tr(m[2]), code: m[3], status: tr(m[4]) })],
  [/^₹(\d+(?:\.\d+)?) received from (.+) for (\S+) - fully paid$/, "₹{amt} received from {name} for {code} - fully paid", (m) => ({ amt: m[1], name: m[2], code: m[3] })],
  [/^₹(\d+(?:\.\d+)?) received from (.+) for (\S+) - ₹(\d+(?:\.\d+)?) remaining$/, "₹{amt} received from {name} for {code} - ₹{rem} remaining", (m) => ({ amt: m[1], name: m[2], code: m[3], rem: m[4] })],
  [/^(\w+) appointment scheduled with (.+) on (.+)$/, "{purpose} appointment scheduled with {name} on {when}", (m) => ({ purpose: tr(m[1]), name: m[2], when: m[3] })],
];

export function trNotice(message) {
  if (!message || currentLang === "en") return message;
  for (const [re, tpl, vars] of NOTICE_PATTERNS) {
    const m = String(message).match(re);
    if (m) return tr(tpl, vars(m));
  }
  return tr(message);
}
