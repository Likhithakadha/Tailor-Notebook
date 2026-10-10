import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import OrderStepper from "../components/OrderStepper";
import OrderDesign from "../components/OrderDesign";
import DesignFields, { designFromOrder, designPayload } from "../components/DesignFields";
import NewOrderForm from "../components/NewOrderForm";
import MeasurementForm from "../components/MeasurementForm";
import ProfileCard from "../components/ProfileCard";
import { groupProfiles } from "../utils/profiles";
import { PAYMENT_LABEL, formatDay, paymentStatusOf, remainingOf, rupees } from "../utils/orders";
import { cleanValues, dressLabel, newDraft, validateDraft } from "../utils/measurementTemplates";
import { useLang } from "../i18n";

export default function CustomerDetail() {
  const { t } = useLang();
  const { id } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();

  const [customer, setCustomer] = useState(null);
  const [measurements, setMeasurements] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [editingCustomer, setEditingCustomer] = useState(false);
  const [customerForm, setCustomerForm] = useState({});

  const [showMeasurementForm, setShowMeasurementForm] = useState(false);
  const [draft, setDraft] = useState(() => newDraft("blouse"));
  const [savingMeasurement, setSavingMeasurement] = useState(false);

  const [showOrderForm, setShowOrderForm] = useState(false);
  const [orderFormKey, setOrderFormKey] = useState(0);
  const [orderMeasurementId, setOrderMeasurementId] = useState("");

  const [editingOrderId, setEditingOrderId] = useState(null);
  const [orderEdit, setOrderEdit] = useState({});

  async function load() {
    try {
      const data = await api.getCustomer(token, id);
      setCustomer(data.customer);
      setMeasurements(data.measurements);
      setOrders(data.orders);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const profiles = useMemo(() => groupProfiles(measurements), [measurements]);

  // Profiles grouped under their dress type, in the order of the most recently recorded
  const typeGroups = useMemo(() => {
    const groups = [];
    profiles.forEach((p) => {
      let g = groups.find((x) => x.garmentType === p.garmentType);
      if (!g) {
        g = { garmentType: p.garmentType, profiles: [] };
        groups.push(g);
      }
      g.profiles.push(p);
    });
    return groups;
  }, [profiles]);

  const suggestions = useMemo(
    () => [...new Set(measurements.filter((m) => m.garment_type === draft.garmentType).map((m) => m.profile_name))],
    [measurements, draft.garmentType]
  );

  function openNewOrder(measurementId = "") {
    setOrderMeasurementId(measurementId);
    setOrderFormKey((k) => k + 1);
    setShowOrderForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSaveMeasurement(e) {
    e.preventDefault();
    const problem = validateDraft(draft);
    if (problem) return setError(problem);
    setError("");
    setSavingMeasurement(true);
    try {
      await api.addMeasurement(token, id, {
        garmentType: draft.garmentType,
        profileName: draft.profileName.trim() || "Default",
        values: cleanValues(draft.values),
        notes: draft.notes,
      });
      setShowMeasurementForm(false);
      setDraft(newDraft(draft.garmentType));
      load();
    } catch (err) {
      setError(t(err.message));
    } finally {
      setSavingMeasurement(false);
    }
  }

  async function handleSaveCustomer(e) {
    e.preventDefault();
    setError("");
    try {
      await api.updateCustomer(token, id, customerForm);
      setEditingCustomer(false);
      load();
    } catch (err) {
      setError(t(err.message));
    }
  }

  async function handleDeleteCustomer() {
    if (!window.confirm(t("Delete this customer and all their measurements, orders and appointments?"))) return;
    await api.deleteCustomer(token, id);
    navigate("/customers");
  }

  function startEditOrder(o) {
    setEditingOrderId(o.id);
    setOrderEdit({
      fabricDetails: o.fabric_details || "",
      quantity: o.quantity || 1,
      orderDate: o.order_date || "",
      price: o.price,
      advancePaid: o.advance_paid,
      dueDate: o.due_date || "",
      notes: o.notes || "",
      design: designFromOrder(o),
    });
  }

  async function handleSaveOrder(e, orderId) {
    e.preventDefault();
    setError("");
    try {
      await api.updateOrder(token, orderId, {
        fabricDetails: orderEdit.fabricDetails,
        quantity: Number(orderEdit.quantity) || 1,
        orderDate: orderEdit.orderDate || undefined,
        price: Number(orderEdit.price) || 0,
        advancePaid: Number(orderEdit.advancePaid) || 0,
        dueDate: orderEdit.dueDate || "",
        ...designPayload(orderEdit.design),
        notes: orderEdit.notes,
      });
      setEditingOrderId(null);
      load();
    } catch (err) {
      setError(t(err.message));
    }
  }

  async function handleDeleteOrder(orderId) {
    if (!window.confirm(t("Delete this order?"))) return;
    await api.deleteOrder(token, orderId);
    load();
  }

  if (loading) return <p className="loading-text">{t("Loading…")}</p>;
  if (!customer) return <p className="empty-state">{t("Customer not found.")}</p>;

  return (
    <>
      <Link to="/customers" className="back-link">
        ← Back to customers
      </Link>

      <div className="page-header">
        <div>
          <h1 className="page-title">
            {customer.name} <span className="id-badge big">{customer.customer_code}</span>
          </h1>
          <p className="page-subtitle">
            {customer.phone}
            {customer.gender ? ` · ${t(customer.gender.charAt(0).toUpperCase() + customer.gender.slice(1))}` : ""}
            {customer.email ? ` · ${customer.email}` : ""}
            {customer.address ? ` · ${customer.address}` : ""}
          </p>
          {customer.notes && <p className="page-subtitle" style={{ marginTop: 4 }}>Note: {customer.notes}</p>}
        </div>
        <div className="btn-row" style={{ marginTop: 0 }}>
          <button className="btn" onClick={() => (showOrderForm ? setShowOrderForm(false) : openNewOrder())}>
            {showOrderForm ? t("Close order form") : t("+ New order")}
          </button>
          <button
            className="btn secondary"
            onClick={() => {
              setCustomerForm({
                name: customer.name,
                phone: customer.phone,
                gender: customer.gender || "",
                email: customer.email || "",
                address: customer.address || "",
                notes: customer.notes || "",
              });
              setEditingCustomer((v) => !v);
            }}
          >
            {editingCustomer ? t("Cancel") : t("Edit customer")}
          </button>
          <button className="btn danger" onClick={handleDeleteCustomer}>
            {t("Delete")}
          </button>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {editingCustomer && (
        <div className="form-panel wide" style={{ marginBottom: 24 }}>
          <form onSubmit={handleSaveCustomer}>
            <div className="field-row">
              <div className="field">
                <label>{t("Name")}</label>
                <input required value={customerForm.name} onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })} />
              </div>
              <div className="field">
                <label>{t("Phone")}</label>
                <input required value={customerForm.phone} onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })} />
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label>{t("Gender")}</label>
                <select value={customerForm.gender} onChange={(e) => setCustomerForm({ ...customerForm, gender: e.target.value })}>
                  <option value="">{t("Not set")}</option>
                  <option value="male">{t("Male")}</option>
                  <option value="female">{t("Female")}</option>
                  <option value="other">{t("Other")}</option>
                </select>
              </div>
              <div className="field">
                <label>{t("Email")}</label>
                <input value={customerForm.email} onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })} />
              </div>
            </div>
            <div className="field">
              <label>{t("Address")}</label>
              <input value={customerForm.address} onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })} />
            </div>
            <div className="field">
              <label>{t("Notes")}</label>
              <textarea rows={2} value={customerForm.notes} onChange={(e) => setCustomerForm({ ...customerForm, notes: e.target.value })} />
            </div>
            <button className="btn" type="submit">{t("Save changes")}</button>
          </form>
        </div>
      )}

      {showOrderForm && (
        <div style={{ marginBottom: 32 }}>
          <NewOrderForm
            key={orderFormKey}
            customer={customer}
            initialMeasurementId={orderMeasurementId}
            onCreated={() => {
              setShowOrderForm(false);
              load();
            }}
            onCancel={() => setShowOrderForm(false)}
          />
        </div>
      )}

      {/* ---------- Measurements ---------- */}
      <div className="page-header" style={{ marginBottom: 0 }}>
        <h2 className="section-heading" style={{ margin: "36px 0 0", border: "none", flex: 1 }}>
          {t("Measurements")}
        </h2>
        <button className="btn secondary" onClick={() => setShowMeasurementForm((s) => !s)}>
          {showMeasurementForm ? t("Cancel") : t("+ Add measurements")}
        </button>
      </div>
      <div style={{ borderBottom: "1px solid var(--paper-line)", marginBottom: 18 }} />

      {showMeasurementForm && (
        <div className="form-panel wide" style={{ marginBottom: 24 }}>
          <form onSubmit={handleSaveMeasurement}>
            <MeasurementForm draft={draft} onChange={setDraft} profileSuggestions={suggestions} />
            {suggestions.includes(draft.profileName.trim() || "Default") && (
              <p className="hint">
                {t("A \"{name}\" {type} profile already exists - saving adds a new version to it. Use a different profile name to keep both.", { name: draft.profileName.trim() || "Default", type: dressLabel(draft.garmentType).toLowerCase() })}
              </p>
            )}
            <div className="btn-row">
              <button className="btn" type="submit" disabled={savingMeasurement}>
                {savingMeasurement ? t("Saving…") : t("Save measurements")}
              </button>
            </div>
          </form>
        </div>
      )}

      {typeGroups.length === 0 ? (
        <p className="empty-state">{t("No measurements recorded yet.")}</p>
      ) : (
        typeGroups.map((g) => (
          <div key={g.garmentType} className="type-group">
            <h3 className="type-heading">
              {dressLabel(g.garmentType)}
              <span className="muted-inline"> · {g.profiles.length} profile{g.profiles.length === 1 ? "" : "s"}</span>
            </h3>
            {g.profiles.map((p) => (
              <ProfileCard
                key={p.key}
                profile={p}
                onChanged={load}
                onUseInOrder={(m) => openNewOrder(m.id)}
              />
            ))}
          </div>
        ))
      )}

      {/* ---------- Previous orders ---------- */}
      <h2 className="section-heading">Previous orders ({orders.length})</h2>

      {orders.length === 0 ? (
        <p className="empty-state">{t("No orders yet for this customer.")}</p>
      ) : (
        <div className="ledger">
          {orders.map((o) => (
            <div className="ledger-row" key={o.id}>
              <div className="ledger-main">
                <p className="ledger-title">
                  <span className="id-badge">{o.order_code}</span> {dressLabel(o.garment_type)}
                  {o.quantity > 1 ? ` × ${o.quantity}` : ""} · {rupees(o.price)}
                  <span className="muted-inline"> · remaining {rupees(remainingOf(o))}</span>
                </p>
                <p className="ledger-meta">
                  {o.fabric_details || t("No fabric notes")}
                  {o.order_date ? ` · ${t("Ordered")} ${formatDay(o.order_date)}` : ""}
                  {o.due_date ? ` · ${t("Delivery")} ${formatDay(o.due_date)}` : ""}
                  {o.measurement_id && o.measurement_profile ? ` · ${t("Measurement")}: ${o.measurement_profile} v${o.measurement_version}` : ""}
                </p>
                <div className="order-badges">
                  <span className={`pill pay-${paymentStatusOf(o)}`}>{PAYMENT_LABEL[paymentStatusOf(o)]}</span>
                </div>
                <OrderDesign order={o} />
                <OrderStepper status={o.status} />
                {editingOrderId === o.id && (
                  <form onSubmit={(e) => handleSaveOrder(e, o.id)} style={{ marginTop: 14, maxWidth: 720 }}>
                    <div className="field">
                      <label>{t("Fabric details")}</label>
                      <input value={orderEdit.fabricDetails} onChange={(e) => setOrderEdit({ ...orderEdit, fabricDetails: e.target.value })} />
                    </div>
                    <div className="field-row">
                      <div className="field">
                        <label>{t("Quantity")}</label>
                        <input type="number" min="1" step="1" value={orderEdit.quantity} onChange={(e) => setOrderEdit({ ...orderEdit, quantity: e.target.value })} />
                      </div>
                      <div className="field">
                        <label>{t("Order date")}</label>
                        <input type="date" value={orderEdit.orderDate} onChange={(e) => setOrderEdit({ ...orderEdit, orderDate: e.target.value })} />
                      </div>
                    </div>
                    <div className="field-row">
                      <div className="field">
                        <label>{t("Price (₹)")}</label>
                        <input type="number" value={orderEdit.price} onChange={(e) => setOrderEdit({ ...orderEdit, price: e.target.value })} />
                      </div>
                      <div className="field">
                        <label>{t("Paid so far (₹)")}</label>
                        <input type="number" value={orderEdit.advancePaid} onChange={(e) => setOrderEdit({ ...orderEdit, advancePaid: e.target.value })} />
                      </div>
                    </div>
                    <div className="field">
                      <label>{t("Delivery date")}</label>
                      <input type="date" value={orderEdit.dueDate} onChange={(e) => setOrderEdit({ ...orderEdit, dueDate: e.target.value })} />
                    </div>
                    <p className="step-label" style={{ marginTop: 16 }}>{t("Design details")}</p>
                    <DesignFields
                      value={orderEdit.design}
                      onChange={(design) => setOrderEdit({ ...orderEdit, design })}
                      idPrefix={`edit-${o.id}`}
                    />
                    <button className="btn" type="submit">{t("Save order")}</button>
                  </form>
                )}
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button className="btn secondary" onClick={() => (editingOrderId === o.id ? setEditingOrderId(null) : startEditOrder(o))}>
                  {editingOrderId === o.id ? t("Close") : t("Edit")}
                </button>
                <button className="btn danger" onClick={() => handleDeleteOrder(o.id)}>{t("Delete")}</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
