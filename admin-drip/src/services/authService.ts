// src/services/authService.ts
import { request } from "./api";

export type AdminUser = { id: string; email: string };

export async function adminLogin(email: string, password: string) {
  return request<{ token: string; user: AdminUser }>(
    "/admin/auth/login",
    "POST",
    {
      email,
      password,
    },
    false,
  );
}
