import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

import isPathInside from "is-path-inside";

import u from "@/utils";
import type { OssEntry } from "@/utils/oss";

export type FileEntry = {
  editable: boolean;
  extension: string;
  isSymlink: boolean;
  modifiedAt: string;
  name: string;
  path: string;
  size: number | null;
  type: "directory" | "file";
};

type ReadableFile =
  | {
      absPath: string;
      relPath: string;
      stats: { size: number };
    }
  | {
      buffer: Buffer;
      relPath: string;
      stats: { size: number };
    };

export const MAX_TEXT_FILE_BYTES = 2 * 1024 * 1024;
export const MAX_UPLOAD_BYTES = 60 * 1024 * 1024;
const OSS_ROOT = "oss";

const textExtensions = new Set([
  ".css",
  ".csv",
  ".env",
  ".html",
  ".js",
  ".json",
  ".log",
  ".md",
  ".mjs",
  ".sql",
  ".svg",
  ".toml",
  ".ts",
  ".tsx",
  ".txt",
  ".vue",
  ".xml",
  ".yaml",
  ".yml",
]);

export function normalizeRelativePath(value: string = ""): string {
  const input = value.replace(/\\/g, "/").trim();
  if (!input || input === ".") return "";
  if (path.posix.isAbsolute(input)) throw new Error("无效的路径");

  const normalized = path.posix.normalize(input).replace(/^\/+/, "");
  if (normalized === "." || !normalized) return "";
  if (normalized === ".." || normalized.startsWith("../")) throw new Error("无效的路径");

  return normalized;
}

export function assertSafeName(name: string): string {
  const normalized = name.replace(/\\/g, "/").trim();
  if (!normalized || normalized === "." || normalized === ".." || normalized.includes("/")) {
    throw new Error("文件名不合法");
  }
  return normalized;
}

export function childRelativePath(parentPath: string | undefined, name: string): string {
  const parent = normalizeRelativePath(parentPath);
  const safeName = assertSafeName(name);
  return normalizeRelativePath(parent ? `${parent}/${safeName}` : safeName);
}

function getDataRoot(): string {
  return u.getPath();
}

async function getRealDataRoot(): Promise<string> {
  const dataRoot = getDataRoot();
  await fsp.mkdir(dataRoot, { recursive: true });
  return fsp.realpath(dataRoot);
}

function assertInsideDataRoot(realPath: string, realDataRoot: string) {
  if (realPath !== realDataRoot && !isPathInside(realPath, realDataRoot)) {
    throw new Error("路径逃逸错误，路径必须在数据目录内");
  }
}

export function getDataPath(relPath: string | undefined = "") {
  const normalizedRelPath = normalizeRelativePath(relPath);
  const dataRoot = getDataRoot();
  const absPath = normalizedRelPath ? u.getPath(normalizedRelPath.split("/")) : dataRoot;
  return { absPath, dataRoot, relPath: normalizedRelPath };
}

function isRemoteOssPath(relPath: string): boolean {
  return u.oss.isRemoteEnabled() && (relPath === OSS_ROOT || relPath.startsWith(`${OSS_ROOT}/`));
}

function toOssObjectKey(relPath: string): string {
  const normalizedRelPath = normalizeRelativePath(relPath);
  if (normalizedRelPath === OSS_ROOT) return "";
  if (!normalizedRelPath.startsWith(`${OSS_ROOT}/`)) throw new Error("无效的 OSS 路径");
  return normalizedRelPath.slice(OSS_ROOT.length + 1);
}

function toOssDataPath(objectKey: string): string {
  return objectKey ? `${OSS_ROOT}/${objectKey}` : OSS_ROOT;
}

function ossEntryToFileEntry(entry: OssEntry): FileEntry {
  const relPath = toOssDataPath(entry.key);
  const extension = entry.type === "file" ? path.extname(entry.key).slice(1).toLowerCase() : "";
  const size = entry.type === "file" ? (entry.size ?? 0) : null;

  return {
    editable: entry.type === "file" && isTextFile(entry.key, size ?? 0),
    extension,
    isSymlink: false,
    modifiedAt: entry.lastModified,
    name: entry.key ? path.posix.basename(entry.key) : OSS_ROOT,
    path: relPath,
    size,
    type: entry.type,
  };
}

function createOssFileEntry(relPath: string, size: number, modifiedAt: string = new Date().toISOString()): FileEntry {
  const objectKey = toOssObjectKey(relPath);
  return {
    editable: isTextFile(objectKey, size),
    extension: path.extname(objectKey).slice(1).toLowerCase(),
    isSymlink: false,
    modifiedAt,
    name: path.posix.basename(objectKey),
    path: relPath,
    size,
    type: "file",
  };
}

function createOssDirectoryEntry(relPath: string): FileEntry {
  const objectKey = toOssObjectKey(relPath);
  return {
    editable: false,
    extension: "",
    isSymlink: false,
    modifiedAt: "",
    name: objectKey ? path.posix.basename(objectKey) : OSS_ROOT,
    path: relPath,
    size: null,
    type: "directory",
  };
}

export async function resolveExistingDataPath(relPath: string | undefined = "") {
  const resolved = getDataPath(relPath);
  const realDataRoot = await getRealDataRoot();
  const realPath = await fsp.realpath(resolved.absPath);
  assertInsideDataRoot(realPath, realDataRoot);
  return { ...resolved, realDataRoot, realPath };
}

export async function resolveWritableDataPath(relPath: string) {
  const resolved = getDataPath(relPath);
  const realDataRoot = await getRealDataRoot();
  const parentPath = path.dirname(resolved.absPath);
  const realParentPath = await fsp.realpath(parentPath);
  assertInsideDataRoot(realParentPath, realDataRoot);
  return { ...resolved, realDataRoot };
}

export function isTextFile(filePath: string, size: number): boolean {
  if (size > MAX_TEXT_FILE_BYTES) return false;
  return textExtensions.has(path.extname(filePath).toLowerCase());
}

export async function toFileEntry(absPath: string, relPath: string): Promise<FileEntry> {
  const stats = await fsp.lstat(absPath);
  const type = stats.isDirectory() ? "directory" : "file";
  const extension = type === "file" ? path.extname(absPath).slice(1).toLowerCase() : "";

  return {
    editable: type === "file" && !stats.isSymbolicLink() && isTextFile(absPath, stats.size),
    extension,
    isSymlink: stats.isSymbolicLink(),
    modifiedAt: stats.mtime.toISOString(),
    name: relPath ? path.basename(relPath) : "data",
    path: relPath,
    size: type === "file" ? stats.size : null,
    type,
  };
}

export async function listDirectory(relPath: string | undefined = ""): Promise<FileEntry[]> {
  const normalizedRelPath = normalizeRelativePath(relPath);
  if (isRemoteOssPath(normalizedRelPath)) {
    const entries = await u.oss.listDirectory(toOssObjectKey(normalizedRelPath));
    return entries.map(ossEntryToFileEntry);
  }

  const { absPath, relPath: resolvedRelPath } = await resolveExistingDataPath(normalizedRelPath);
  const stats = await fsp.lstat(absPath);
  if (!stats.isDirectory()) throw new Error("路径不是目录");

  const entries = await fsp.readdir(absPath, { withFileTypes: true });
  const result = await Promise.all(
    entries.map(async (entry) => {
      const childRelPath = resolvedRelPath ? `${resolvedRelPath}/${entry.name}` : entry.name;
      return toFileEntry(path.join(absPath, entry.name), childRelPath);
    }),
  );

  return result.sort((a, b) => {
    if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name, "zh-Hans-CN");
  });
}

export async function assertFileReadable(relPath: string): Promise<ReadableFile> {
  const normalizedRelPath = normalizeRelativePath(relPath);
  if (isRemoteOssPath(normalizedRelPath)) {
    const buffer = await u.oss.getFile(toOssObjectKey(normalizedRelPath));
    return { buffer, relPath: normalizedRelPath, stats: { size: buffer.byteLength } };
  }

  const resolved = await resolveExistingDataPath(normalizedRelPath);
  const stats = await fsp.lstat(resolved.absPath);
  if (!stats.isFile()) throw new Error("路径不是文件");
  return { ...resolved, stats };
}

export async function readTextFile(relPath: string): Promise<string> {
  const result = await assertFileReadable(relPath);
  const targetPath = "absPath" in result ? result.absPath : toOssObjectKey(result.relPath);
  if (!isTextFile(targetPath, result.stats.size)) {
    throw new Error(`仅支持预览 ${MAX_TEXT_FILE_BYTES / 1024 / 1024}MB 以内的文本文件`);
  }
  if ("buffer" in result) return result.buffer.toString("utf8");
  return fsp.readFile(result.absPath, "utf8");
}

export async function getFileEntry(relPath: string): Promise<FileEntry> {
  const result = await assertFileReadable(relPath);
  if ("buffer" in result) return createOssFileEntry(result.relPath, result.buffer.byteLength);
  return toFileEntry(result.absPath, result.relPath);
}

export async function writeTextFile(relPath: string, content: string): Promise<FileEntry> {
  const normalizedRelPath = normalizeRelativePath(relPath);
  if (!normalizedRelPath) throw new Error("不能覆盖 data 根目录");
  if (isRemoteOssPath(normalizedRelPath)) {
    const buffer = Buffer.from(content, "utf8");
    await u.oss.writeFile(toOssObjectKey(normalizedRelPath), buffer);
    return createOssFileEntry(normalizedRelPath, buffer.byteLength);
  }

  const { absPath } = await resolveWritableDataPath(normalizedRelPath);
  await fsp.writeFile(absPath, content, "utf8");
  return toFileEntry(absPath, normalizedRelPath);
}

export async function createFile(currentPath: string | undefined, name: string, content: string = ""): Promise<FileEntry> {
  const relPath = childRelativePath(currentPath, name);
  if (isRemoteOssPath(relPath)) {
    const objectKey = toOssObjectKey(relPath);
    if (await u.oss.fileExists(objectKey)) throw new Error("文件已存在");
    const buffer = Buffer.from(content, "utf8");
    await u.oss.writeFile(objectKey, buffer);
    return createOssFileEntry(relPath, buffer.byteLength);
  }

  const { absPath } = await resolveWritableDataPath(relPath);
  await fsp.writeFile(absPath, content, { encoding: "utf8", flag: "wx" });
  return toFileEntry(absPath, relPath);
}

export async function createFolder(currentPath: string | undefined, name: string): Promise<FileEntry> {
  const relPath = childRelativePath(currentPath, name);
  if (isRemoteOssPath(relPath)) {
    await u.oss.writeFile(`${toOssObjectKey(relPath).replace(/\/+$/, "")}/.keep`, Buffer.alloc(0));
    return createOssDirectoryEntry(relPath);
  }

  const { absPath } = await resolveWritableDataPath(relPath);
  await fsp.mkdir(absPath);
  return toFileEntry(absPath, relPath);
}

export async function deleteEntry(relPath: string): Promise<void> {
  const normalizedRelPath = normalizeRelativePath(relPath);
  if (!normalizedRelPath) throw new Error("不能删除 data 根目录");
  if (isRemoteOssPath(normalizedRelPath)) {
    if (normalizedRelPath === OSS_ROOT) throw new Error("不能删除 OSS 根目录");
    const objectKey = toOssObjectKey(normalizedRelPath);
    await u.oss.deleteDirectory(objectKey);
    await u.oss.deleteFile(objectKey);
    return;
  }

  const { absPath } = await resolveExistingDataPath(normalizedRelPath);
  await fsp.rm(absPath, { recursive: true });
}

export async function renameEntry(relPath: string, nextName: string): Promise<FileEntry> {
  const normalizedRelPath = normalizeRelativePath(relPath);
  if (!normalizedRelPath) throw new Error("不能重命名 data 根目录");

  const safeName = assertSafeName(nextName);
  const parentRelPath = normalizeRelativePath(path.posix.dirname(normalizedRelPath) === "." ? "" : path.posix.dirname(normalizedRelPath));
  const nextRelPath = childRelativePath(parentRelPath, safeName);
  if (isRemoteOssPath(normalizedRelPath)) {
    if (normalizedRelPath === OSS_ROOT) throw new Error("不能重命名 OSS 根目录");
    const oldObjectKey = toOssObjectKey(normalizedRelPath);
    const nextObjectKey = toOssObjectKey(nextRelPath);
    if (await remoteOssPathExists(nextObjectKey)) throw new Error("目标名称已存在");

    if (await u.oss.fileExists(oldObjectKey)) {
      const buffer = await u.oss.getFile(oldObjectKey);
      await u.oss.writeFile(nextObjectKey, buffer);
      await u.oss.deleteFile(oldObjectKey);
      return createOssFileEntry(nextRelPath, buffer.byteLength);
    }

    const prefix = oldObjectKey.endsWith("/") ? oldObjectKey : `${oldObjectKey}/`;
    const nextPrefix = nextObjectKey.endsWith("/") ? nextObjectKey : `${nextObjectKey}/`;
    const allEntries = await collectOssFiles(prefix);
    for (const entry of allEntries) {
      const buffer = await u.oss.getFile(entry.key);
      await u.oss.writeFile(`${nextPrefix}${entry.key.slice(prefix.length)}`, buffer);
    }
    await u.oss.writeFile(`${nextPrefix}.keep`, Buffer.alloc(0));
    await u.oss.deleteDirectory(oldObjectKey);
    return createOssDirectoryEntry(nextRelPath);
  }

  const { absPath } = await resolveExistingDataPath(normalizedRelPath);
  const { absPath: nextAbsPath } = await resolveWritableDataPath(nextRelPath);

  if (fs.existsSync(nextAbsPath)) throw new Error("目标名称已存在");
  await fsp.rename(absPath, nextAbsPath);
  return toFileEntry(nextAbsPath, nextRelPath);
}

export async function uploadFile(currentPath: string | undefined, filename: string, contentBase64: string): Promise<FileEntry> {
  const relPath = childRelativePath(currentPath, filename);
  const buffer = Buffer.from(contentBase64, "base64");
  if (buffer.byteLength > MAX_UPLOAD_BYTES) {
    throw new Error(`单个文件不能超过 ${MAX_UPLOAD_BYTES / 1024 / 1024}MB`);
  }

  if (isRemoteOssPath(relPath)) {
    await u.oss.writeFile(toOssObjectKey(relPath), buffer);
    return createOssFileEntry(relPath, buffer.byteLength);
  }

  const { absPath } = await resolveWritableDataPath(relPath);
  await fsp.writeFile(absPath, buffer);
  return toFileEntry(absPath, relPath);
}

async function collectOssFiles(prefix: string): Promise<OssEntry[]> {
  const directEntries = await u.oss.listDirectory(prefix);
  const files: OssEntry[] = [];
  for (const entry of directEntries) {
    if (entry.type === "file") {
      files.push(entry);
    } else {
      files.push(...(await collectOssFiles(entry.key)));
    }
  }
  return files;
}

async function remoteOssPathExists(objectKey: string): Promise<boolean> {
  if (await u.oss.fileExists(objectKey)) return true;
  if (await u.oss.fileExists(`${objectKey.replace(/\/+$/, "")}/.keep`)) return true;
  return (await u.oss.listDirectory(objectKey)).length > 0;
}
