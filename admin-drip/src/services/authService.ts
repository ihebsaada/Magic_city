// src/services/authService.ts
import { apiPost } from "./api";

export type AdminUser = { id: string; email: string };

export async function adminLogin(email: string, password: string) {
  return apiPost<{ token: string; user: AdminUser }>("/admin/auth/login", {
    email,
    password,
  });
}
