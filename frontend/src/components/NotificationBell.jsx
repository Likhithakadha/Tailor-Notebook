import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { useLang, currentLocale, trNotice } from "../i18n";

export default function NotificationBell() {
  const { t } = useLang();
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const containerRef = useRef(null);

  async function load() {
    try {
      const data = await api.listNotifications(token);
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch {
      // silent — notifications are a convenience, not critical path
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000); // poll every 30s
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleMarkAll() {
    await api.markAllNotificationsRead(token);
    load();
  }

  async function handleOpen() {
    setOpen((o) => !o);
  }

  return (
    <div className="notif-wrap" ref={containerRef}>
      <button className="notif-bell" onClick={handleOpen} aria-label={t("Notifications")}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 01-3.46 0" />
        </svg>
        {unreadCount > 0 && <span className="notif-dot">{unreadCount}</span>}
      </button>

      {open && (
        <div className="notif-panel">
          <div className="notif-panel-header">
            <span>{t("Notifications")}</span>
            {unreadCount > 0 && (
              <button className="notif-mark-all" onClick={handleMarkAll}>
                {t("Mark all read")}
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <div className="notif-empty">{t("Nothing yet.")}</div>
          ) : (
            <div className="notif-list">
              {notifications.slice(0, 12).map((n) => (
                <div className={`notif-item ${n.is_read ? "" : "unread"}`} key={n.id}>
                  <p>{trNotice(n.message)}</p>
                  <span>{new Date(n.created_at).toLocaleString(currentLocale())}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
