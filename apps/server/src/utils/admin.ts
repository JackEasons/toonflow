import type { Request } from "express";

type TokenUser = {
  id?: number | string;
  name?: null | string;
  role?: null | string;
};

export const USER_ROLE_ADMIN = "admin";
export const USER_ROLE_MEMBER = "member";

function isLegacyAdminUser(user?: TokenUser | null) {
  return Number(user?.id) === 1 || user?.name === "admin";
}

export function normalizeUserRole(user?: TokenUser | null) {
  const role = String(user?.role || "").trim().toLowerCase();
  if (role) return role;
  return isLegacyAdminUser(user) ? USER_ROLE_ADMIN : USER_ROLE_MEMBER;
}

export function isAdminUser(user?: TokenUser | null) {
  const role = String(user?.role || "").trim().toLowerCase();
  if (role) return role === USER_ROLE_ADMIN;
  return isLegacyAdminUser(user);
}

export function isAdminRequest(req: Request) {
  return isAdminUser((req as any).user);
}
