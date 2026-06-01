import { transform } from "sucrase";
import fs from "fs";
import path from "path";
import db from "@/utils/db";
import getPath from "@/utils/getPath";
import runCode from "@/utils/vm";

export function writeCode(id: string | number, tsCode: string) {
  const rootDir = getPath("vendor");
  fs.mkdirSync(rootDir, { recursive: true });
  if (fs.existsSync(path.join(rootDir,  `${id}.ts`))) {
    fs.writeFileSync(path.join(rootDir,  `${id}.ts`), tsCode);
  }
  fs.writeFileSync(path.join(rootDir,  `${id}.ts`), tsCode);
}

export function getCode(id: string): string {
  const rootDir = getPath("vendor");
  const targetFile = path.join(rootDir, `${id}.ts`);
  if (!fs.existsSync(targetFile)) return "";
  return fs.readFileSync(targetFile, "utf-8");
}

function boolFromDb(value: unknown): boolean {
  return value === true || value === 1 || value === "1";
}

function parseModels(value: unknown): Array<any> {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function isModelEnabled(model: Record<string, unknown>): boolean {
  if (boolFromDb(model.disabled)) return false;
  const raw = model.enabled ?? model.enable;
  if (raw === undefined || raw === null || raw === "") return true;
  return boolFromDb(raw);
}

export async function getConfiguredModelList(id: string): Promise<Array<any>> {
  const row = await db("o_vendorConfig").where("id", id).select("models").first();
  return parseModels(row?.models);
}

export async function isVendorEnabled(id: string): Promise<boolean> {
  const row = await db("o_vendorConfig").where("id", id).select("enable").first();
  return boolFromDb(row?.enable);
}

export async function getModelList(id: string): Promise<Array<any>> {
  const models = await db("o_vendorConfig").where("id", id).select("models").first();
  if (!models) return [];
  const configuredModels = parseModels(models.models);
  const code = getCode(id);
  if (!code.trim()) return configuredModels;
  const jsCode = transform(code, { transforms: ["typescript"] }).code;
  const vendorData = runCode(jsCode);
  if (!vendorData || !vendorData.vendor || !vendorData.vendor.models) return configuredModels;
  const combined = [...JSON.parse(JSON.stringify(vendorData.vendor.models)), ...configuredModels];
  const map = new Map<string, any>();
  for (const m of combined) {
    const current = map.get(m.modelName);
    map.set(m.modelName, current ? { ...current, ...m } : m);
  }
  return [...map.values()];
}

export async function getEnabledModelList(id: string): Promise<Array<any>> {
  if (!(await isVendorEnabled(id))) return [];

  const allModels = await getModelList(id);
  return allModels.filter(isModelEnabled);
}

export function getVendor(id: string) {
  const code = getCode(id);
  const jsCode = transform(code, { transforms: ["typescript"] }).code;
  const vendorData = runCode(jsCode);
  return vendorData.vendor;
}
