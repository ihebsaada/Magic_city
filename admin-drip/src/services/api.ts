const BASE_API_URL =
  import.meta.env.VITE_BASE_API_URL || "http://localhost:4000/api";

export { BASE_API_URL };

function getToken() {
  return localStorage.getItem("admin_token");
}

async function handle<T>(res: Response, path: string): Promise<T> {
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const msg = data?.error
      ? `${data.error}`
      : `${res.status} ${res.statusText}`;
    throw new Error(`${res.status} Unauthorized - ${JSON.stringify(data)}`);
  }

  return data as T;
}

function makeHeaders(extra?: Record<string, string>) {
  const token = getToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(extra ?? {}),
  };
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_API_URL}${path}`, {
    headers: makeHeaders(),
  });
  return handle<T>(res, path);
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_API_URL}${path}`, {
    method: "POST",
    headers: makeHeaders(),
    body: JSON.stringify(body),
  });
  return handle<T>(res, path);
}

export async function apiPut<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_API_URL}${path}`, {
    method: "PUT",
    headers: makeHeaders(),
    body: JSON.stringify(body),
  });
  return handle<T>(res, path);
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_API_URL}${path}`, {
    method: "PATCH",
    headers: makeHeaders(),
    body: JSON.stringify(body),
  });
  return handle<T>(res, path);
}

export async function apiDelete<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_API_URL}${path}`, {
    method: "DELETE",
    headers: makeHeaders(),
  });
  // certains endpoints renvoient 204 sans body
  if (res.status === 204) return null as T;
  return handle<T>(res, path);
}
