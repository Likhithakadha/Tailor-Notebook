import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { groupProfiles, formatDate } from "../utils/profiles";
import {
  cleanValues,
  dressLabel,
  emptyValues,
  fieldLabel,
  newDraft,
  typeOptions,
  validateDraft,
} from "../utils/measurementTemplates";
import { todayYmd } from "../utils/orders";
import DesignFields, { designFromOrder, designPayload, emptyDesign } from "./DesignFields";
import CustomerPicker from "./CustomerPicker";
import CustomerForm from "./CustomerForm";
import MeasurementForm from "./MeasurementForm";
import { useLang } from "../i18n";

// Create an order in three steps: 1) who (search an existing customer or add a new one),
// 2) which dress + which saved measurement profile (or take new measurements now), 3) fabric, price, due date.
export default function NewOrderForm({
  customer: fixedCustomer = null,
  initialCustomerId = "",
  initialMeasurementId = "",
  onCreated,
  onCancel,
}) {
  const { t } = useLang();
  const { token } = useAuth();
  const [customer, setCustomer] = useState(fixedCustomer);
  const [addingCustomer, setAddingCustomer] = useState(false);
  const [measurements, setMeasurements] = useState([]);
  const [previousOrders, setPreviousOrders] = useState(0);
  const [pastOrders, setPastOrders] = useState([]);
  const [design, setDesign] = useState(emptyDesign());
  const [loadingCustomer, setLoadingCustomer] = useState(false);

  const [dressType, setDressType] = useState("blouse");
  const [choice, setChoice] = useState(""); // "" (auto) | "none" | "new" | <measurement id>
  const [draft, setDraft] = useState(() => newDraft("blouse"));

  const [catalog, setCatalog] = useState([]);
  const [fabricDetails, setFabricDetails] = useState("");
  const [price, setPrice] = useState("");
  const [advancePaid, setAdvancePaid] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [orderDate, setOrderDate] = useState(todayYmd());
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Customer given only by id (e.g. coming from the Measurements page)
  useEffect(() => {
    if (customer || !initialCustomerId) return;
    api
      .getCustomer(token, initialCustomerId)
      .then((d) => setCustomer(d.customer))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    api
      .listCatalog(token)
      .then((d) => setCatalog(d.items || []))
      .catch(() => {});
  }, [token]);

  // Load the picked customer's saved measurement profiles + order count
  useEffect(() => {
    if (!customer) {
      setMeasurements([]);
      setPreviousOrders(0);
      setPastOrders([]);
      return;
    }
    let cancelled = false;
    setLoadingCustomer(true);
    api
      .getCustomer(token, customer.id)
      .then((d) => {
        if (cancelled) return;
        setMeasurements(d.measurements);
        setPreviousOrders(d.orders.length);
        setPastOrders(d.orders);
        const wanted = initialMeasurementId && d.measurements.find((m) => m.id === initialMeasurementId);
        if (wanted) {
          setDressType(wanted.garment_type);
          setChoice(wanted.id);
          setDraft(newDraft(wanted.garment_type));
        } else {
          // Returning customer: start from the dress they ordered (or were measured for) most recently
          const last = d.orders[0]?.garment_type || d.measurements[0]?.garment_type;
          if (last) {
            setDressType(last);
            setDraft(newDraft(last));
          }
        }
      })
      .catch((err) => !cancelled && setError(t(err.message)))
      .finally(() => !cancelled && setLoadingCustomer(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer?.id]);

  const profiles = useMemo(
    () => groupProfiles(measurements.filter((m) => m.garment_type === dressType)),
    [measurements, dressType]
  );

  // Pre-select the newest saved profile for this dress type, or "take new measurements" if there is none
  useEffect(() => {
    if (!customer || loadingCustomer) return;
    setChoice((prev) => {
      if (prev === "none" || prev === "new") return prev;
      if (prev && profiles.some((p) => p.versions.some((v) => v.id === prev))) return prev;
      return profiles.length ? profiles[0].latest.id : "new";
    });
  }, [profiles, customer, loadingCustomer]);

  function pickDressType(type) {
    setDressType(type);
    setChoice("");
    setDraft((d) => ({ ...d, garmentType: type, values: emptyValues(type, d.values) }));
  }

  function pickCustomer(c) {
    setCustomer(c);
    setAddingCustomer(false);
    setChoice("");
    setError("");
  }

  function pickAnother() {
    setCustomer(null);
    setChoice("");
    setError("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    const priceNum = price ? Number(price) : 0;
    const advanceNum = advancePaid ? Number(advancePaid) : 0;
    if (priceNum < 0 || advanceNum < 0) return setError(t("Price and advance cannot be negative."));
    if (advanceNum > priceNum) return setError(t("Advance paid cannot be more than the price."));
    const qtyNum = Number(quantity);
    if (!Number.isInteger(qtyNum) || qtyNum < 1) return setError(t("Quantity must be a whole number, 1 or more."));
    if (!orderDate) return setError(t("Please pick the order date."));
    if (dueDate && dueDate < orderDate) return setError(t("Delivery date cannot be before the order date."));

    if (choice === "new") {
      const problem = validateDraft(draft);
      if (problem) return setError(problem);
    }

    setSaving(true);
    try {
      let measurementId = choice === "none" || choice === "new" ? null : choice;

      if (choice === "new") {
        const saved = await api.addMeasurement(token, customer.id, {
          garmentType: dressType,
          profileName: draft.profileName.trim() || "Default",
          values: cleanValues(draft.values),
          notes: draft.notes,
        });
        measurementId = saved.measurement.id;
        // Keep the saved profile selected, so a retry after an order error does not save it twice
        setMeasurements((list) => [saved.measurement, ...list]);
        setChoice(measurementId);
      }

      const data = await api.createOrder(token, {
        customerId: customer.id,
        measurementId,
        garmentType: dressType,
        fabricDetails,
        quantity: qtyNum,
        orderDate,
        ...designPayload(design),
        price: priceNum,
        advancePaid: advanceNum,
        dueDate: dueDate || null,
        notes: notes || null,
      });
      onCreated(data.order);
    } catch (err) {
      setError(t(err.message));
    } finally {
      setSaving(false);
    }
  }

  // Most recent earlier order of this dress type that has design details saved
  const lastDesignOrder = pastOrders.find(
    (o) => o.garment_type === dressType && (o.neck_design || o.sleeve_design || o.stitching_style || o.instructions)
  );

  const fabrics = catalog.filter((c) => c.category === "fabric" || c.category === "design");

  return (
    <div className="form-panel wide">
      <h2 className="panel-title">{t("New order")}</h2>
      {error && <div className="error-banner">{error}</div>}

      {/* ---- Step 1: customer ---- */}
      <div className="step-block">
        <div className="step-head">
          <p className="step-label">{t("1. Customer")}</p>
          {!customer && !addingCustomer && (
            <button type="button" className="link-btn big" onClick={() => setAddingCustomer(true)}>
              {t("+ New customer")}
            </button>
          )}
        </div>
        {customer ? (
          <div className="customer-chip">
            <div>
              <strong>{customer.name}</strong>
              <span className="id-badge">{customer.customer_code}</span>
              <p className="ledger-meta">
                {customer.phone}
                {customer.address ? ` · ${customer.address}` : ""}
                {!loadingCustomer ? ` · ${t(previousOrders === 1 ? "{n} previous order" : "{n} previous orders", { n: previousOrders })}` : ""}
              </p>
            </div>
            {!fixedCustomer && (
              <button type="button" className="btn secondary" onClick={pickAnother}>
                {t("Change")}
              </button>
            )}
          </div>
        ) : addingCustomer ? (
          <div className="inline-panel" style={{ marginTop: 0 }}>
            <CustomerForm
              onCreated={pickCustomer}
              onUseExisting={pickCustomer}
              onCancel={() => setAddingCustomer(false)}
            />
          </div>
        ) : (
          <>
            <CustomerPicker onSelect={pickCustomer} autoFocus />
            <p className="hint">
              {t("Returning customer? Search and pick them - their details and saved measurements load automatically.")}
            </p>
          </>
        )}
      </div>

      {customer && (
        <form onSubmit={handleSubmit}>
          {/* ---- Step 2: dress + measurements ---- */}
          <div className="step-block">
            <p className="step-label">{t("2. Dress & measurements")}</p>
            <div className="field" style={{ maxWidth: 280 }}>
              <label>{t("Dress type")}</label>
              <select value={dressType} onChange={(e) => pickDressType(e.target.value)}>
                {typeOptions(dressType).map((tp) => (
                  <option key={tp.key} value={tp.key}>
                    {t(tp.label)}
                  </option>
                ))}
              </select>
            </div>

            {loadingCustomer ? (
              <p className="loading-text">{t("Loading saved measurements…")}</p>
            ) : (
              <div className="choice-list">
                {profiles.map((p) => (
                  <label
                    key={p.key}
                    className={"choice-card" + (choice === p.latest.id ? " selected" : "")}
                  >
                    <input
                      type="radio"
                      name="measurement-choice"
                      checked={choice === p.latest.id}
                      onChange={() => setChoice(p.latest.id)}
                    />
                    <div className="choice-body">
                      <strong>{p.profileName}</strong>
                      <span className="muted-inline">
                        {" "}
                        · v{p.latest.version} · {formatDate(p.latest.recorded_at)}
                      </span>
                      <div className="tag-row">
                        {Object.entries(p.latest.values).map(([k, v]) => (
                          <span className="tag" key={k}>
                            {fieldLabel(k)}: {v}"
                          </span>
                        ))}
                      </div>
                    </div>
                  </label>
                ))}

                <label className={"choice-card" + (choice === "new" ? " selected" : "")}>
                  <input
                    type="radio"
                    name="measurement-choice"
                    checked={choice === "new"}
                    onChange={() => setChoice("new")}
                  />
                  <div className="choice-body">
                    <strong>
                      {profiles.length ? t("Take new measurements") : t("No saved {type} measurements - take them now", { type: dressLabel(dressType).toLowerCase() })}
                    </strong>
                    <span className="muted-inline"> {t("(saved as a new profile)")}</span>
                  </div>
                </label>

                <label className={"choice-card" + (choice === "none" ? " selected" : "")}>
                  <input
                    type="radio"
                    name="measurement-choice"
                    checked={choice === "none"}
                    onChange={() => setChoice("none")}
                  />
                  <div className="choice-body">
                    <strong>{t("Don't link any measurement")}</strong>
                  </div>
                </label>
              </div>
            )}

            {choice === "new" && !loadingCustomer && (
              <div className="inline-panel">
                <MeasurementForm
                  draft={draft}
                  onChange={setDraft}
                  lockGarment
                  profileSuggestions={[]}
                />
              </div>
            )}
          </div>

          {/* ---- Step 3: design details ---- */}
          <div className="step-block">
            <div className="step-head">
              <p className="step-label">{t("3. Design details")}</p>
              {lastDesignOrder && (
                <button
                  type="button"
                  className="link-btn big"
                  onClick={() => setDesign((d) => ({ ...designFromOrder(lastDesignOrder), photo: "", newPhoto: d.newPhoto, removePhoto: false }))}
                >
                  {t("Copy from last {type} order ({code})", { type: dressLabel(dressType).toLowerCase(), code: lastDesignOrder.order_code })}
                </button>
              )}
            </div>
            <DesignFields value={design} onChange={setDesign} idPrefix="new-order" />
          </div>

          {/* ---- Step 4: order details ---- */}
          <div className="step-block">
            <p className="step-label">{t("4. Order details")}</p>
            {fabrics.length > 0 && (
              <div className="field">
                <label>{t("Pick fabric or design from catalog (optional)")}</label>
                <select
                  value=""
                  onChange={(e) => {
                    const item = catalog.find((c) => c.id === e.target.value);
                    if (item) {
                      setFabricDetails(item.name + (item.description ? " - " + item.description : ""));
                      if (!price && item.price_per_unit && item.category === "design") {
                        setPrice(String(item.price_per_unit));
                      }
                    }
                  }}
                >
                  <option value="">{t("Select a fabric or design…")}</option>
                  {fabrics.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.category}: {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="field">
              <label>{t("Fabric / design details")}</label>
              <input
                value={fabricDetails}
                onChange={(e) => setFabricDetails(e.target.value)}
                placeholder={t("e.g. Maroon silk, boat neck, back deep cut")}
              />
            </div>
            <div className="field-row">
              <div className="field">
                <label>{t("Quantity")}</label>
                <input type="number" min="1" step="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
              </div>
              <div className="field">
                <label>{t("Order date")}</label>
                <input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
              </div>
              <div className="field">
                <label>{t("Delivery date")}</label>
                <input type="date" min={orderDate || undefined} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label>{t("Price (₹)")}</label>
                <input type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} />
              </div>
              <div className="field">
                <label>{t("Advance amount (₹)")}</label>
                <input type="number" min="0" value={advancePaid} onChange={(e) => setAdvancePaid(e.target.value)} />
              </div>
              <div className="field">
                <label>{t("Remaining amount (₹)")}</label>
                <input
                  readOnly
                  value={Math.max((Number(price) || 0) - (Number(advancePaid) || 0), 0)}
                  style={{ background: "rgba(0,0,0,0.04)" }}
                />
              </div>
            </div>
            <div className="field">
              <label>{t("Notes (optional)")}</label>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>

          <div className="btn-row">
            <button className="btn" type="submit" disabled={saving || loadingCustomer || !choice}>
              {saving ? t("Creating…") : t("Create order")}
            </button>
            <button className="btn secondary" type="button" onClick={onCancel}>
              {t("Cancel")}
            </button>
          </div>
        </form>
      )}

      {!customer && (
        <div className="btn-row">
          <button className="btn secondary" type="button" onClick={onCancel}>
            {t("Cancel")}
          </button>
        </div>
      )}
    </div>
  );
}
