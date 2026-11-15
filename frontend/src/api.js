export const API_BASE = (
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000"
).replace(/\/$/, "");

export async function publicRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    cache: "no-store",
    signal: options.signal || AbortSignal.timeout(20000),
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  const result = await response.json();
  if (!response.ok) {
    const message = Array.isArray(result.detail)
      ? result.detail.map((row) => row.msg).join(" ")
      : result.detail;
    throw new Error(
      typeof message === "string" ? message : "Request could not be completed.",
    );
  }
  return result;
}
