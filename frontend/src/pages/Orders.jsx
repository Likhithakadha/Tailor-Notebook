import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import OrderStepper from "../components/OrderStepper";
import OrderDesign from "../components/OrderDesign";
import NewOrderForm from "../components/NewOrderForm";
import { dressLabel, fieldLabel } from "../utils/measurementTemplates";
import { DELIVERY_TABS, PAYMENT_TABS, PAYMENT_LABEL, deliveryBadge, formatDay, rupees } from "../utils/orders";
import { useLang } from "../i18n";

const STATUSES = ["all", "pending", "cutting", "stitching", "ready", "delivered", "cancelled"];
const NEXT_STATUS = { pending: "cutting", cutting: "stitching", stitching: "ready", ready: "delivered" };
const FORM_PARAMS = ["new", "customerId", "measurementId"];

export default function Orders() {
  const { t } = useLang();
  const { token } = useAuth();
  const [orders, setOrders] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [error, setError] = useState("");

  // Filters (delivery can be preset from the dashboard: /orders?delivery=delayed)
  const [params, setParams] = useSearchParams();
  const [delivery, setDelivery] = useState(params.get("delivery") || "all");
  const [payment, setPayment] = useState(params.get("payment") || "all");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");

  // Add-payment box
  const [payingId, setPayingId] = useState(null);
  const [payAmount, setPayAmount] = useState("");
  const [payError, setPayError] = useState("");

  // /orders?new=1&customerId=..&measurementId=.. opens the form pre-filled (used by "+ Order" and "Use in new order")
  const [showForm, setShowForm] = useState(params.get("new") === "1");
  const [formInit] = useState({
    customerId: params.get("customerId") || "",
    measurementId: params.get("measurementId") || "",
  });
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);

  async function loadSummary() {
    try {
      const data = await api.ordersSummary(token);
      setSummary(data);
    } catch {
      /* counts are optional */
    }
  }

  async function load() {
    setLoading(true);
    setError("");
    try {
      const query = {};
      if (status !== "all") query.status = status;
      if (delivery !== "all") query.delivery = delivery;
      if (payment !== "all") query.payment = payment;
      if (debounced) query.q = debounced;
      const data = await api.listOrders(token, query);
      setOrders(data.orders);
    } catch (err) {
      setError(t(err.message));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, delivery, payment, debounced]);

  useEffect(() => {
    loadSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function refresh() {
    load();
    loadSummary();
  }

  async function advanceStatus(order) {
    const next = NEXT_STATUS[order.status];
    if (!next) return;
    setUpdatingId(order.id);
    try {
      await api.updateOrderStatus(token, order.id, next);
      refresh();
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm(t("Delete this order?"))) return;
    await api.deleteOrder(token, id);
    refresh();
  }

  function openPay(o) {
    if (payingId === o.id) {
      setPayingId(null);
      return;
    }
    setPayingId(o.id);
    setPayAmount("");
    setPayError("");
  }

  async function submitPayment(e, o, amountOverride) {
    e?.preventDefault();
    const amount = Number(amountOverride ?? payAmount);
    if (!amount || amount <= 0) return setPayError(t("Enter an amount more than 0."));
    if (amount > o.remaining_amount) return setPayError(t("Only {amt} is remaining.", { amt: rupees(o.remaining_amount) }));
    setPayError("");
    try {
      await api.addOrderPayment(token, o.id, amount);
      setPayingId(null);
      refresh();
    } catch (err) {
      setPayError(t(err.message));
    }
  }

  function closeForm() {
    setShowForm(false);
    if (FORM_PARAMS.some((k) => params.has(k))) {
      const next = new URLSearchParams(params);
      FORM_PARAMS.forEach((k) => next.delete(k));
      setParams(next, { replace: true });
    }
  }

  const deliveryCount = (key) => (summary?.delivery ? summary.delivery[key] : null);

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t("Orders")}</h1>
          <p className="page-subtitle">{t("Every garment, its delivery date and what is still to be paid.")}</p>
        </div>
        <button
          className="btn"
          onClick={() => {
            if (showForm) closeForm();
            else {
              setFormKey((k) => k + 1);
              setShowForm(true);
            }
          }}
        >
          {showForm ? t("Close") : t("+ New order")}
        </button>
      </div>

      {showForm && (
        <div style={{ marginBottom: 32 }}>
          <NewOrderForm
            key={formKey}
            initialCustomerId={formKey === 0 ? formInit.customerId : ""}
            initialMeasurementId={formKey === 0 ? formInit.measurementId : ""}
            onCreated={() => {
              closeForm();
              refresh();
            }}
            onCancel={closeForm}
          />
        </div>
      )}

      {/* ---- Delivery tracking tabs ---- */}
      <div className="tab-row">
        {DELIVERY_TABS.map((tp) => {
          const count = tp.key === "all" ? null : deliveryCount(tp.key);
          return (
            <button
              key={tp.key}
              onClick={() => setDelivery(tp.key)}
              className={
                "btn secondary tab-btn" + (delivery === tp.key ? " active" : "") + (tp.key === "delayed" ? " delayed-tab" : "")
              }
            >
              {t(tp.label)}
              {count !== null && count !== undefined && <span className="tab-count">{count}</span>}
            </button>
          );
        })}
      </div>

      {/* ---- Search + payment + status filters ---- */}
      <div className="order-toolbar">
        <input
          type="search"
          placeholder={t("Search order ID, customer, phone…")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={payment} onChange={(e) => setPayment(e.target.value)} aria-label={t("Payment status")}>
          {PAYMENT_TABS.map((tp) => (
            <option key={tp.key} value={tp.key}>
              {t(tp.label)}
            </option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label={t("Work status")}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s === "all" ? t("Any work status") : t(s)}
            </option>
          ))}
        </select>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {loading ? (
        <p className="loading-text">{t("Loading…")}</p>
      ) : orders.length === 0 ? (
        <p className="ledger-empty">{t("No orders in this view.")}</p>
      ) : (
        <div className="ledger">
          {orders.map((o) => {
            const badge = deliveryBadge(o);
            const mv = o.measurement_values && Object.entries(o.measurement_values);
            return (
              <div className="ledger-row" key={o.id}>
                <div className="ledger-main">
                  <p className="ledger-title">
                    <span className="id-badge">{o.order_code}</span>{" "}
                    <Link to={`/customers/${o.customer_id}`}>{o.customer_name}</Link>
                    {o.customer_code && <span className="id-badge">{o.customer_code}</span>} — {dressLabel(o.garment_type)}
                    {o.quantity > 1 ? ` × ${o.quantity}` : ""}
                  </p>
                  <p className="ledger-meta">
                    {o.customer_phone}
                    {o.fabric_details ? ` · ${o.fabric_details}` : ""}
                  </p>

                  <div className="order-badges">
                    <span className={`pill ${badge.cls}`}>{badge.text}</span>
                    <span className={`pill pay-${o.payment_status}`}>{t(PAYMENT_LABEL[o.payment_status])}</span>
                  </div>

                  <p className="ledger-meta">
                    {t("Ordered")} {formatDay(o.order_date)}
                    {o.due_date ? ` · ${t("Delivery")} ${formatDay(o.due_date)}` : ` · ${t("No delivery date set")}`}
                  </p>

                  <div className="money-line">
                    <span>
                      {t("Price")} <b>{rupees(o.price)}</b>
                    </span>
                    <span>
                      {t("Advance paid")} <b>{rupees(o.advance_paid)}</b>
                    </span>
                    <span className={o.remaining_amount > 0 && o.status !== "cancelled" ? "remaining-due" : ""}>
                      {t("Remaining")} <b>{rupees(o.remaining_amount)}</b>
                    </span>
                  </div>

                  <OrderDesign order={o} />

                  {o.measurement_id && o.measurement_profile && (
                    <>
                      <p className="ledger-meta" style={{ marginTop: 8 }}>
                        Measurements: {o.measurement_profile} v{o.measurement_version}
                      </p>
                      {mv && mv.length > 0 && (
                        <div className="tag-row">
                          {mv.map(([k, v]) => (
                            <span className="tag" key={k}>
                              {fieldLabel(k)}: {v}"
                            </span>
                          ))}
                        </div>
                      )}
                    </>
                  )}

                  <OrderStepper status={o.status} />

                  {payingId === o.id && (
                    <form className="pay-form" onSubmit={(e) => submitPayment(e, o)}>
                      <input
                        type="number"
                        min="1"
                        max={o.remaining_amount}
                        placeholder={t("Amount (₹)")}
                        value={payAmount}
                        onChange={(e) => setPayAmount(e.target.value)}
                        autoFocus
                      />
                      <button className="btn" type="submit">
                        {t("Save payment")}
                      </button>
                      <button className="btn secondary" type="button" onClick={(e) => submitPayment(e, o, o.remaining_amount)}>
                        Paid in full ({rupees(o.remaining_amount)})
                      </button>
                      {payError && <span className="muted-inline" style={{ color: "var(--chalk-red)" }}>{payError}</span>}
                    </form>
                  )}
                </div>

                <div className="order-actions">
                  {o.remaining_amount > 0 && o.status !== "cancelled" && (
                    <button className="btn secondary" onClick={() => openPay(o)}>
                      {payingId === o.id ? t("Close") : t("Add payment")}
                    </button>
                  )}
                  {NEXT_STATUS[o.status] && (
                    <button className="btn secondary" onClick={() => advanceStatus(o)} disabled={updatingId === o.id}>
                      {updatingId === o.id ? "…" : t("Mark {status}", { status: t(NEXT_STATUS[o.status]) })}
                    </button>
                  )}
                  <button className="btn danger" onClick={() => handleDelete(o.id)}>
                    {t("Delete")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
