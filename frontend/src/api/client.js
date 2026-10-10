const API_BASE = import.meta.env.VITE_API_URL || "/api";

async function request(path, { method = "GET", body, token } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    const message = data?.error || `Request failed (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

export const api = {
  register: (payload) => request("/auth/register", { method: "POST", body: payload }),
  login: (payload) => request("/auth/login", { method: "POST", body: payload }),
  me: (token) => request("/auth/me", { token }),

  listCustomers: (token, search, gender) => {
    const qs = new URLSearchParams();
    if (search) qs.set("search", search);
    if (gender) qs.set("gender", gender);
    const q = qs.toString();
    return request(`/customers${q ? `?${q}` : ""}`, { token });
  },
  createCustomer: (token, payload) =>
    request("/customers", { method: "POST", body: payload, token }),
  getCustomer: (token, id) => request(`/customers/${id}`, { token }),
  updateCustomer: (token, id, payload) =>
    request(`/customers/${id}`, { method: "PUT", body: payload, token }),
  deleteCustomer: (token, id) => request(`/customers/${id}`, { method: "DELETE", token }),

  addMeasurement: (token, customerId, payload) =>
    request(`/customers/${customerId}/measurements`, { method: "POST", body: payload, token }),
  deleteMeasurement: (token, customerId, measurementId) =>
    request(`/customers/${customerId}/measurements/${measurementId}`, { method: "DELETE", token }),
  renameMeasurementProfile: (token, customerId, payload) =>
    request(`/customers/${customerId}/measurement-profiles`, { method: "PUT", body: payload, token }),
  listMeasurements: (token, params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "")
    ).toString();
    return request(`/measurements${qs ? `?${qs}` : ""}`, { token });
  },

  // Notifications
  listNotifications: (token) => request("/notifications", { token }),
  markNotificationRead: (token, id) =>
    request(`/notifications/${id}/read`, { method: "PATCH", token }),
  markAllNotificationsRead: (token) =>
    request("/notifications/read-all", { method: "PATCH", token }),

  // Catalog
  listCatalog: (token, category) =>
    request(`/catalog${category ? `?category=${category}` : ""}`, { token }),
  createCatalogItem: (token, payload) =>
    request("/catalog", { method: "POST", body: payload, token }),
  updateCatalogItem: (token, id, payload) =>
    request(`/catalog/${id}`, { method: "PUT", body: payload, token }),
  deleteCatalogItem: (token, id) => request(`/catalog/${id}`, { method: "DELETE", token }),

  // Backup — auth-protected, so fetch as a blob rather than a plain link
  downloadBackup: async (token) => {
    const res = await fetch(`${API_BASE}/backup`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Could not generate backup");
    const blob = await res.blob();
    return blob;
  },

  // Order edit/delete
  updateOrder: (token, id, payload) => request(`/orders/${id}`, { method: "PUT", body: payload, token }),
  deleteOrder: (token, id) => request(`/orders/${id}`, { method: "DELETE", token }),

  // Measurement PDF — auth-protected, so fetch as a blob rather than a plain link
  downloadMeasurementPdf: async (token, customerId, measurementId) => {
    const res = await fetch(
      `${API_BASE}/customers/${customerId}/measurements/${measurementId}/pdf`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) throw new Error("Could not generate PDF");
    const blob = await res.blob();
    const disposition = res.headers.get("Content-Disposition") || "";
    const match = disposition.match(/filename="(.+)"/);
    return { blob, filename: match ? match[1] : "measurement.pdf" };
  },

  listOrders: (token, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/orders${qs ? `?${qs}` : ""}`, { token });
  },
  createOrder: (token, payload) => request("/orders", { method: "POST", body: payload, token }),
  updateOrderStatus: (token, id, status) =>
    request(`/orders/${id}/status`, { method: "PATCH", body: { status }, token }),
  addOrderPayment: (token, id, amount) =>
    request(`/orders/${id}/payments`, { method: "POST", body: { amount }, token }),
  ordersSummary: (token) => request("/orders/meta/summary", { token }),

  listAppointments: (token, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/appointments${qs ? `?${qs}` : ""}`, { token });
  },
  createAppointment: (token, payload) =>
    request("/appointments", { method: "POST", body: payload, token }),
  updateAppointmentStatus: (token, id, status) =>
    request(`/appointments/${id}/status`, { method: "PATCH", body: { status }, token }),
};
