import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { useLang } from "../i18n";

// Search box that finds an existing customer by name, phone number or customer ID
// so a returning customer never has to be typed in again.
export default function CustomerPicker({ onSelect, autoFocus = false }) {
  const { t } = useLang();
  const { token } = useAuth();
  const [term, setTerm] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await api.listCustomers(token, term.trim());
        if (!cancelled) setResults(data.customers.slice(0, 8));
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [term, open, token]);

  useEffect(() => {
    function onDocClick(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function choose(customer) {
    setOpen(false);
    setTerm("");
    onSelect(customer);
  }

  return (
    <div className="picker" ref={boxRef}>
      <input
        autoFocus={autoFocus}
        value={term}
        onChange={(e) => {
          setTerm(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={t("Search existing customer by name, phone or ID…")}
        aria-label={t("Search customers")}
      />
      {open && (
        <div className="picker-list">
          {loading && results.length === 0 ? (
            <div className="picker-empty">{t("Searching…")}</div>
          ) : results.length === 0 ? (
            <div className="picker-empty">{t("No matching customer.")}</div>
          ) : (
            results.map((c) => (
              <button type="button" className="picker-item" key={c.id} onClick={() => choose(c)}>
                <span className="picker-name">{c.name}</span>
                <span className="picker-meta">
                  {c.customer_code} · {c.phone}
                  {c.order_count ? ` · ${t(c.order_count > 1 ? "{n} previous orders" : "{n} previous order", { n: c.order_count })}` : ""}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
