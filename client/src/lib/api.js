/**
 * API client. The session lives in an httpOnly cookie that the browser sends
 * automatically, so no token is ever stored in JavaScript.
 */

export class ApiError extends Error {
  constructor(message, status, errors = {}) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (handler) => {
  onUnauthorized = handler;
};

async function request(path, { method = "GET", body, signal, quiet401 = false } = {}) {
  let response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      signal,
      credentials: "same-origin",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new ApiError("Can't reach the server. Check your connection and try again.", 0);
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && !quiet401) onUnauthorized();
    throw new ApiError(data.message || `Request failed (${response.status}).`, response.status, data.errors);
  }
  return data;
}

export const toQuery = (params = {}) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") search.set(key, value);
  });
  const text = search.toString();
  return text ? `?${text}` : "";
};

export const api = {
  meta: () => request("/meta"),

  session: () => request("/auth/session"),
  login: (data) => request("/auth/login", { method: "POST", body: data, quiet401: true }),
  register: (data) => request("/auth/register", { method: "POST", body: data }),
  logout: () => request("/auth/logout", { method: "POST" }),
  updateProfile: (data) => request("/auth/me", { method: "PATCH", body: data }),
  changePassword: (data) => request("/auth/password", { method: "PATCH", body: data }),
  deleteAccount: () => request("/auth/me", { method: "DELETE" }),

  transactions: (params, signal) => request(`/transactions${toQuery(params)}`, { signal }),
  createTransaction: (data) => request("/transactions", { method: "POST", body: data }),
  updateTransaction: (id, data) => request(`/transactions/${id}`, { method: "PUT", body: data }),
  deleteTransaction: (id) => request(`/transactions/${id}`, { method: "DELETE" }),
  exportUrl: (params) => `/api/transactions/export${toQuery(params)}`,

  summary: (month, signal) => request(`/reports/summary${toQuery({ month })}`, { signal }),
  trend: (params, signal) => request(`/reports/trend${toQuery(params)}`, { signal }),
  rangeReport: (params, signal) => request(`/reports/range${toQuery(params)}`, { signal }),

  budgets: (month, signal) => request(`/budgets${toQuery({ month })}`, { signal }),
  setBudget: (category, monthlyLimit) => request(`/budgets/${encodeURIComponent(category)}`, { method: "PUT", body: { monthlyLimit } }),
  removeBudget: (category) => request(`/budgets/${encodeURIComponent(category)}`, { method: "DELETE" }),
};
