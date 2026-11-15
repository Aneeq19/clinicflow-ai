const API_BASE = (
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000"
).replace(/\/$/, "");
export async function adminRequest(path, token, options = {}) {
  const response = await fetch(`${API_BASE}/admin${path}`, {
    ...options,
    cache: "no-store",
    signal: options.signal || AbortSignal.timeout(15000),
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const result = await response.json();
  if (!response.ok) {
    const message = Array.isArray(result.detail)
      ? result.detail.map((row) => row.msg).join(" ")
      : typeof result.detail === "string"
        ? result.detail
        : "Please check the entered details.";
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return result;
}
