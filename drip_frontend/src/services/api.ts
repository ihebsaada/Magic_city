import { requestJSON, type RequestOptions } from './request';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
export function apiGet<T>(path: string, options?: RequestOptions): Promise<T> {
  return requestJSON<T>(API_URL + path, {}, options);
}
export function apiPost<T>(path: string, body: unknown, options?: RequestOptions): Promise<T> {
  return requestJSON<T>(API_URL + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }, { timeoutMs: 60_000, ...options });
}
