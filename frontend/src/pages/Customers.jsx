import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { formatDate } from "../utils/profiles";
import CustomerForm from "../components/CustomerForm";
import { useLang, tr } from "../i18n";

const GENDER_FILTERS = [
  { value: "", label: "All" },
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "other", label: "Other" },
];

function genderLabel(g) {
  return g ? tr(g.charAt(0).toUpperCase() + g.slice(1)) : "-";
}

// Customer Management: one searchable record per customer (ID, name, phone, gender, address, previous orders)
export default function Customers() {
  const { t } = useLang();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState("");
  const [gender, setGender] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await api.listCustomers(token, search.trim(), gender);
        if (!cancelled) {
          setCustomers(data.customers);
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
  }, [search, gender, token, reloadKey]);

  const returning = customers.filter((c) => c.order_count >= 2).length;

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t("Customer Management")}</h1>
          <p className="page-subtitle">
            {t("Save a customer once - find them again by name, phone or customer ID, with all previous orders and measurements ready.")}
          </p>
        </div>
        <button className="btn" onClick={() => setShowForm((s) => !s)}>
          {showForm ? t("Close") : t("+ New customer")}
        </button>
      </div>

      {showForm && (
        <div className="form-panel wide" style={{ marginBottom: 32 }}>
          <h2 className="panel-title">{t("New customer")}</h2>
          <CustomerForm
            onCreated={(c) => {
              setShowForm(false);
              navigate(`/customers/${c.id}`);
            }}
            onUseExisting={(c) => navigate(`/customers/${c.id}`)}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      <div className="filter-bar">
        <input
          className="search-input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("Search by name, phone or customer ID…")}
          aria-label={t("Search customers")}
        />
        <div className="chip-row">
          {GENDER_FILTERS.map((g) => (
            <button
              key={g.value || "all"}
              type="button"
              className={"chip" + (gender === g.value ? " active" : "")}
              onClick={() => setGender(g.value)}
            >
              {t(g.label)}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {loading && customers.length === 0 ? (
        <p className="loading-text">{t("Loading…")}</p>
      ) : customers.length === 0 ? (
        <p className="ledger-empty">
          {search || gender ? t("No customer matches this search.") : t("No customers yet. Add your first one above.")}
        </p>
      ) : (
        <>
          <p className="count-line">
            {customers.length} {t(customers.length === 1 ? "customer" : "customers")}
            {returning > 0 ? ` · ${t("{n} returning (2+ orders)", { n: returning })}` : ""}
          </p>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t("Customer ID")}</th>
                  <th>{t("Name")}</th>
                  <th>{t("Phone")}</th>
                  <th>{t("Gender")}</th>
                  <th>{t("Address")}</th>
                  <th>{t("Previous orders")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id} className="clickable" onClick={() => navigate(`/customers/${c.id}`)}>
                    <td>
                      <span className="id-badge">{c.customer_code}</span>
                    </td>
                    <td>
                      <Link to={`/customers/${c.id}`} onClick={(e) => e.stopPropagation()} className="cell-name">
                        {c.name}
                      </Link>
                    </td>
                    <td>{c.phone}</td>
                    <td>{genderLabel(c.gender)}</td>
                    <td className="cell-address">{c.address || "-"}</td>
                    <td>
                      {c.order_count}
                      {c.last_order_at ? <span className="muted-inline"> · last {formatDate(c.last_order_at)}</span> : null}
                    </td>
                    <td>
                      <Link
                        to={`/orders?new=1&customerId=${c.id}`}
                        className="btn secondary small"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {t("+ Order")}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
