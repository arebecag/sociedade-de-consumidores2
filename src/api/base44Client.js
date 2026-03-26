const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000").replace(/\/$/, "");

const getToken = () => localStorage.getItem("auth_token");
const getRefreshToken = () => localStorage.getItem("refresh_token");
const setTokens = (accessToken, refreshToken) => {
  if (accessToken) localStorage.setItem("auth_token", accessToken);
  if (refreshToken) localStorage.setItem("refresh_token", refreshToken);
};
const clearTokens = () => {
  localStorage.removeItem("auth_token");
  localStorage.removeItem("refresh_token");
};

async function request(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    body: options.body && typeof options.body !== "string" ? JSON.stringify(options.body) : options.body,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const error = new Error(data?.error || data?.message || "Request failed");
    error.response = { data, status: response.status };
    throw error;
  }
  return data;
}

const entityApi = (entityName) => ({
  async get(id) {
    return request(`/api/compat/entities/${entityName}/${id}`);
  },
  async list(sort = null, limit = null) {
    const query = new URLSearchParams();
    if (sort) query.set("sort", sort);
    if (limit) query.set("limit", String(limit));
    return request(`/api/compat/entities/${entityName}${query.toString() ? `?${query}` : ""}`);
  },
  async filter(filters = {}, sort = null, limit = null) {
    return request(`/api/compat/entities/${entityName}/filter`, {
      method: "POST",
      body: { filters, sort, limit },
    });
  },
  async create(payload) {
    return request(`/api/compat/entities/${entityName}`, { method: "POST", body: payload });
  },
  async update(id, payload) {
    return request(`/api/compat/entities/${entityName}/${id}`, { method: "PUT", body: payload });
  },
  async delete(id) {
    return request(`/api/compat/entities/${entityName}/${id}`, { method: "DELETE" });
  },
});

const entities = new Proxy({}, { get: (_, entityName) => entityApi(entityName) });

export const base44 = {
  entities,
  functions: {
    async invoke(name, payload) {
      const data = await request(`/api/compat/functions/${name}`, { method: "POST", body: payload || {} });
      if (data?.token) setTokens(data.token, data.refresh_token);
      return { data };
    },
  },
  auth: {
    async me() {
      const token = getToken();
      if (!token) throw new Error("Not authenticated");
      const data = await request(`/api/auth/me`, { method: "POST", body: { token } });
      return data.user;
    },
    logout() {
      const refreshToken = getRefreshToken();
      clearTokens();
      if (refreshToken) {
        request(`/api/auth/logout`, { method: "POST", body: { refresh_token: refreshToken } }).catch(() => {});
      }
    },
    redirectToLogin(returnUrl) {
      clearTokens();
      window.location.href = returnUrl ? `/Register?returnUrl=${encodeURIComponent(returnUrl)}` : "/Register";
    },
  },
  appLogs: {
    async logUserInApp(pageName) {
      return Promise.resolve({ ok: true, pageName });
    },
  },
};

export { setTokens, clearTokens, getToken, getRefreshToken };
