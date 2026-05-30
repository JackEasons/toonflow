import type { Request } from "express";

type TokenUser = {
  id?: number | string;
  name?: null | string;
};

export function isAdminUser(user?: TokenUser | null) {
  return Number(user?.id) === 1 || user?.name === "admin";
}

export function isAdminRequest(req: Request) {
  return isAdminUser((req as any).user);
}
