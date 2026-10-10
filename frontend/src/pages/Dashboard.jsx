import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { dressLabel } from "../utils/measurementTemplates";
import { formatDay, photoUrl, remainingOf, rupees, todayYmd } from "../utils/orders";
import { useLang, tr, currentLocale } from "../i18n";

// Numbers count up when the dashboard opens
function useCountUp(target, ms = 700) {
  const [value, setValue] = useState(0);
  const raf = useRef(0);
  useEffect(() => {
    const end = Number(target) || 0;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min((now - start) / ms, 1);
      setValue(Math.round(end * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, ms]);
  return value;
}

function Swatch({ to, tone, icon, label, value, money, sub }) {
  const n = useCountUp(value);
  return (
    <Link to={to} className={`swatch swatch-${tone}`}>
      <div className="swatch-top">
        <span className="swatch-icon" aria-hidden="true">{icon}</span>
        <span className="swatch-label">{label}</span>
      </div>
      <div className="swatch-body">
        <div className="swatch-value">{money ? rupees(n) : n}</div>
        <div className="swatch-sub">{sub}</div>
      </div>
    </Link>
  );
}

const ICONS = {
  customers: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5" /><path d="M16.5 4.8a3.3 3.3 0 0 1 0 6.4M18 14.8c2 .6 3.3 2.3 3.6 5" />
    </svg>
  ),
  orders: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="6" r="2.6" /><circle cx="6" cy="18" r="2.6" /><path d="M8.2 7.6 20 17M8.2 16.4 20 7" />
    </svg>
  ),
  delivery: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z" /><path d="M3 7.5 12 12l9-4.5M12 12v9" />
    </svg>
  ),
  money: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" /><path d="M8.5 7.5h7M8.5 11h7M10 7.5c3.6 0 4.6 3.5 0 3.5l4.5 5.5" />
    </svg>
  ),
};

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return tr("Good morning");
  if (h < 17) return tr("Good afternoon");
  return tr("Good evening");
}

// The next 7 days, starting today, as { ymd, label, count }
function weekStrip(orders) {
  const out = [];
  const base = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
    const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const count = orders.filter((o) => o.due_date === ymd && o.status !== "delivered" && o.status !== "cancelled").length;
    out.push({
      ymd,
      count,
      day: i === 0 ? tr("Today") : i === 1 ? tr("Tmrw") : d.toLocaleDateString(currentLocale(), { weekday: "short" }),
      date: d.getDate(),
    });
  }
  return out;
}

export default function Dashboard() {
  const { t } = useLang();
  const { token, user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [delivery, setDelivery] = useState(null);
  const [payments, setPayments] = useState(null);
  const [orders, setOrders] = useState([]);
  const [upcoming, setUpcoming] = useState([]);
  const [customerCount, setCustomerCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const now = new Date().toISOString();
        const [summaryData, apptData, customerData, orderData] = await Promise.all([
          api.ordersSummary(token),
          api.listAppointments(token, { from: now, status: "scheduled" }),
          api.listCustomers(token),
          api.listOrders(token),
        ]);
        if (ignore) return;
        setSummary(summaryData.summary);
        setDelivery(summaryData.delivery);
        setPayments(summaryData.payments);
        setUpcoming(apptData.appointments.slice(0, 4));
        setCustomerCount(customerData.customers.length);
        setOrders(orderData.orders);
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, [token]);

  const activeOrders = summary ? summary.pending + summary.cutting + summary.stitching + summary.ready : 0;
  const todayCount = delivery?.today ?? 0;
  const pendingAmount = payments?.pendingAmount ?? 0;
  const pendingOrders = (payments?.pending ?? 0) + (payments?.partial ?? 0);

  // Collection meter: money received vs total value of all non-cancelled orders
  const live = orders.filter((o) => o.status !== "cancelled");
  const totalValue = live.reduce((sum, o) => sum + (Number(o.price) || 0), 0);
  const collected = live.reduce((sum, o) => sum + (Number(o.advance_paid) || 0), 0);
  const pct = totalValue > 0 ? Math.round((collected / totalValue) * 100) : 0;

  const dueToday = orders.filter((o) => o.delivery_state === "today");
  const delayed = orders.filter((o) => o.delivery_state === "delayed");
  const week = weekStrip(orders);
  const maxWeek = Math.max(1, ...week.map((w) => w.count));
  const gallery = orders.filter((o) => o.design_photo).slice(0, 6);
  const today = todayYmd();

  return (
    <div className="dash-wrap">
      <div className="dash-hero">
        <div>
          <p className="dash-date">
            {new Date().toLocaleDateString(currentLocale(), { weekday: "long", day: "numeric", month: "long" })}
          </p>
          <h1 className="dash-title">
            {greeting()}, {user?.name?.split(" ")[0]}
          </h1>
          <p className="dash-sub">
            {loading
              ? t("Laying out the cutting table…")
              : todayCount > 0
              ? t(todayCount === 1 ? "{n} garment is due today." : "{n} garments are due today.", { n: todayCount })
              : t("Nothing is due today. A good day to get ahead.")}
            {delivery?.delayed > 0 && <span className="dash-warn"> {delivery.delayed} {t("delayed.")}</span>}
          </p>
        </div>
        <div className="dash-hero-actions">
          <Link to="/orders?new=1" className="btn">
            {t("+ New order")}
          </Link>
          <Link to="/customers" className="btn secondary light">
            {t("+ New customer")}
          </Link>
        </div>
        <div className="tape" aria-hidden="true" />
      </div>

      {loading ? (
        <p className="loading-text">{t("Loading…")}</p>
      ) : (
        <>
          <div className="swatch-grid">
            <Swatch to="/customers" tone="indigo" icon={ICONS.customers} label={t("Customers")} value={customerCount} sub={t("in your notebook")} />
            <Swatch
              to="/orders"
              tone="teal"
              icon={ICONS.orders}
              label={t("Active orders")}
              value={activeOrders}
              sub={`${summary?.stitching ?? 0} ${t("stitching")} · ${summary?.ready ?? 0} ${t("ready")}`}
            />
            <Swatch
              to="/orders?delivery=today"
              tone="amber"
              icon={ICONS.delivery}
              label={t("Today's delivery")}
              value={todayCount}
              sub={t("{n} more tomorrow", { n: delivery?.tomorrow ?? 0 })}
            />
            <Swatch
              to="/orders?payment=pending"
              tone="rose"
              icon={ICONS.money}
              label={t("Pending payments")}
              value={pendingAmount}
              money
              sub={t(pendingOrders === 1 ? "across {n} order" : "across {n} orders", { n: pendingOrders })}
            />
          </div>

          <div className="dash-two">
            {/* ---- Delivery week ---- */}
            <section className="dash-card">
              <div className="dash-card-head">
                <h2>{t("This week's deliveries")}</h2>
                <Link to="/orders" className="dash-link">{t("All orders")}</Link>
              </div>
              <div className="week-strip">
                {week.map((w) => (
                  <Link key={w.ymd} to={w.ymd === today ? "/orders?delivery=today" : "/orders"} className={"week-day" + (w.ymd === today ? " is-today" : "")}>
                    <span className="week-count">{w.count}</span>
                    <span className="week-bar-track">
                      <span className="week-bar" style={{ height: `${w.count ? 18 + (w.count / maxWeek) * 82 : 6}%` }} />
                    </span>
                    <span className="week-day-name">{w.day}</span>
                    <span className="week-date">{w.date}</span>
                  </Link>
                ))}
              </div>
              <div className="delivery-chips">
                <Link to="/orders?delivery=today" className="chip chip-amber">{t("Today")} <b>{delivery?.today ?? 0}</b></Link>
                <Link to="/orders?delivery=tomorrow" className="chip chip-blue">{t("Tomorrow")} <b>{delivery?.tomorrow ?? 0}</b></Link>
                <Link to="/orders?delivery=upcoming" className="chip chip-grey">{t("Upcoming")} <b>{delivery?.upcoming ?? 0}</b></Link>
                <Link to="/orders?delivery=delayed" className={"chip chip-red" + (delivery?.delayed ? " pulse" : "")}>{t("Delayed")} <b>{delivery?.delayed ?? 0}</b></Link>
              </div>
            </section>

            {/* ---- Collection meter ---- */}
            <section className="dash-card">
              <div className="dash-card-head">
                <h2>{t("Collection meter")}</h2>
                <Link to="/orders?payment=partial" className="dash-link">{t("Partial payments")}</Link>
              </div>
              <div className="meter-figure">
                <span className="meter-pct">{pct}%</span>
                <span className="meter-text">of {rupees(totalValue)} collected</span>
              </div>
              <div className="meter-track" role="progressbar" aria-valuenow={pct} aria-valuemin="0" aria-valuemax="100">
                <div className="meter-fill" style={{ width: `${pct}%` }} />
                <div className="meter-needle" style={{ left: `${pct}%` }} />
              </div>
              <div className="meter-legend">
                <div><span className="dot dot-green" /> {t("Received")} <b>{rupees(collected)}</b></div>
                <div><span className="dot dot-red" /> {t("To collect")} <b>{rupees(pendingAmount)}</b></div>
              </div>
              <div className="delivery-chips" style={{ marginTop: 14 }}>
                <Link to="/orders?payment=paid" className="chip chip-green">{t("Paid")} <b>{payments?.paid ?? 0}</b></Link>
                <Link to="/orders?payment=partial" className="chip chip-amber">{t("Partial")} <b>{payments?.partial ?? 0}</b></Link>
                <Link to="/orders?payment=pending" className="chip chip-red">{t("Pending")} <b>{payments?.pending ?? 0}</b></Link>
              </div>
            </section>
          </div>

          {/* ---- Today + delayed ---- */}
          <div className="dash-two">
            <section className="dash-card">
              <div className="dash-card-head">
                <h2>{t("Deliver today")}</h2>
                <Link to="/orders?delivery=today" className="dash-link">{t("Open")}</Link>
              </div>
              {dueToday.length === 0 ? (
                <p className="dash-empty">{t("No deliveries due today.")}</p>
              ) : (
                <ul className="mini-list">
                  {dueToday.slice(0, 5).map((o) => (
                    <li key={o.id}>
                      <MiniThumb order={o} />
                      <div className="mini-main">
                        <strong>{o.customer_name}</strong>
                        <span>
                          {o.order_code} · {dressLabel(o.garment_type)}
                          {o.quantity > 1 ? ` × ${o.quantity}` : ""}
                        </span>
                      </div>
                      {remainingOf(o) > 0 ? (
                        <span className="mini-due">{rupees(remainingOf(o))} {t("due")}</span>
                      ) : (
                        <span className="mini-paid">{t("Paid")}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className={"dash-card" + (delayed.length ? " dash-card-alert" : "")}>
              <div className="dash-card-head">
                <h2>{t("Delayed orders")}</h2>
                <Link to="/orders?delivery=delayed" className="dash-link">{t("Open")}</Link>
              </div>
              {delayed.length === 0 ? (
                <p className="dash-empty">{t("Nothing is running late. 🎉")}</p>
              ) : (
                <ul className="mini-list">
                  {delayed.slice(0, 5).map((o) => (
                    <li key={o.id}>
                      <MiniThumb order={o} />
                      <div className="mini-main">
                        <strong>{o.customer_name}</strong>
                        <span>
                          {o.order_code} · was due {formatDay(o.due_date)}
                        </span>
                      </div>
                      <span className="mini-late">{Math.abs(o.days_to_delivery)}d late</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* ---- Design gallery ---- */}
          {gallery.length > 0 && (
            <section className="dash-card" style={{ marginTop: 20 }}>
              <div className="dash-card-head">
                <h2>{t("Recent designs")}</h2>
                <Link to="/orders" className="dash-link">{t("All orders")}</Link>
              </div>
              <div className="gallery">
                {gallery.map((o) => (
                  <Link key={o.id} to={`/customers/${o.customer_id}`} className="gallery-item">
                    <img src={photoUrl(o.design_photo)} alt={`${dressLabel(o.garment_type)} ${t("design")}`} loading="lazy" />
                    <span>{[o.neck_design, o.sleeve_design].filter(Boolean).join(" · ") || dressLabel(o.garment_type)}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* ---- Appointments ---- */}
          <section className="dash-card" style={{ marginTop: 20 }}>
            <div className="dash-card-head">
              <h2>{t("Upcoming appointments")}</h2>
              <Link to="/appointments" className="dash-link">{t("All")}</Link>
            </div>
            {upcoming.length === 0 ? (
              <p className="dash-empty">{t("Nothing scheduled yet. Book a fitting or delivery from a customer's page.")}</p>
            ) : (
              <ul className="mini-list">
                {upcoming.map((a) => (
                  <li key={a.id}>
                    <div className="mini-main">
                      <strong>{a.customer_name}</strong>
                      <span>
                        {t(a.purpose)} · {new Date(a.scheduled_at).toLocaleString(currentLocale())}
                      </span>
                    </div>
                    <span className={`pill ${a.status}`}>{t(a.status)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function MiniThumb({ order }) {
  return order.design_photo ? (
    <img className="mini-thumb" src={photoUrl(order.design_photo)} alt="" loading="lazy" />
  ) : (
    <span className="mini-thumb mini-thumb-empty">{(order.customer_name || "?").charAt(0).toUpperCase()}</span>
  );
}
