import { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { downloadBlob } from "../utils/download";
import BrandMark from "./BrandMark";
import NotificationBell from "./NotificationBell";
import LanguageSwitcher from "./LanguageSwitcher";
import { useLang } from "../i18n";

const NAV_ITEMS = [
  { to: "/", label: "Overview", end: true },
  { to: "/customers", label: "Customers" },
  { to: "/measurements", label: "Measurements" },
  { to: "/orders", label: "Orders" },
  { to: "/appointments", label: "Appointments" },
  { to: "/catalog", label: "Fabric & Design Catalog" },
];

export default function Layout({ children }) {
  const { t } = useLang();
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  // Each page gets its own background theme (see [data-page] rules in styles.css)
  const page = pathname === "/" ? "dashboard" : pathname.startsWith("/customers/") ? "customer-detail" : pathname.split("/")[1] || "dashboard";
  const [exporting, setExporting] = useState(false);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  async function handleExportBackup() {
    setExporting(true);
    try {
      const blob = await api.downloadBackup(token);
      downloadBlob(blob, "tailor-notebook-backup.json");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <BrandMark />
          <div>
            <div className="brand-name">Tailor Notebook</div>
            <div className="brand-sub">{t("Order & measurement ledger")}</div>
          </div>
        </div>

        <ul className="nav-list">
          {NAV_ITEMS.map((item) => (
            <li className="nav-item" key={item.to}>
              <NavLink to={item.to} end={item.end}>
                {t(item.label)}
              </NavLink>
            </li>
          ))}
        </ul>

        <div className="sidebar-footer">
          <div className="shop-name">{user?.shopName || user?.name}</div>
          <button className="logout-btn" onClick={handleExportBackup} disabled={exporting} style={{ marginBottom: 6 }}>
            {exporting ? t("Exporting…") : t("Export backup")}
          </button>
          <button className="logout-btn" onClick={handleLogout}>
            {t("Sign out")}
          </button>
        </div>
      </aside>

      <div className="main-area" data-page={page}>
        <div className="topbar">
          <LanguageSwitcher variant="topbar" />
          <NotificationBell />
        </div>
        <div className="main-inner">{children}</div>
      </div>
    </div>
  );
}
