import { getToken, clearAuth } from "./auth";

const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:3001";

async function request(path, { method = "GET", body } = {}) {
  const token = getToken();
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }

  if (res.status === 401) clearAuth();
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  login: (email, password) => request("/api/auth/login", { method: "POST", body: { email, password } }),

  adminListWorkers: () => request("/api/admin/workers"),
  adminCreateWorker: (payload) => request("/api/admin/workers", { method: "POST", body: payload }),
  adminUpdateWorker: (id, payload) => request(`/api/admin/workers/${id}`, { method: "PUT", body: payload }),
  adminDeleteWorker: (id) => request(`/api/admin/workers/${id}`, { method: "DELETE" }),
  adminPayroll: (from, to) => {
    const q = new URLSearchParams();
    if (from) q.set("from", from);
    if (to) q.set("to", to);
    return request(`/api/admin/payroll?${q.toString()}`);
  },
  adminAdjustTime: (worker_id, hours, reason) =>
    request("/api/admin/adjustments", { method: "POST", body: { worker_id, hours, reason } }),

  workerMe: () => request("/api/worker/me"),
  workerOpenShift: () => request("/api/worker/open-shift"),
  workerCheckIn: (notes) => request("/api/worker/check-in", { method: "POST", body: { notes } }),
  workerCheckOut: () => request("/api/worker/check-out", { method: "POST" }),
  workerListShifts: (from, to) => {
    const q = new URLSearchParams();
    if (from) q.set("from", from);
    if (to) q.set("to", to);
    return request(`/api/worker/shifts?${q.toString()}`);
  },
  workerSummary: (from, to) => {
    const q = new URLSearchParams();
    if (from) q.set("from", from);
    if (to) q.set("to", to);
    return request(`/api/worker/summary?${q.toString()}`);
  }
};