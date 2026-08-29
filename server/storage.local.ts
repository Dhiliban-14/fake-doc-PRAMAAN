import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const UPLOAD_ROOT = path.resolve(process.cwd(), "uploads");

function ensureDirectoryExists(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^[/\\]+/, "").replace(/\\/g, "/");
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

export function sha256Buffer(data: Buffer | Uint8Array | string): string {
  const buffer = Buffer.isBuffer(data) ? data : typeof data === "string" ? Buffer.from(data) : Buffer.from(data);
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

export async function storagePutLocal(
  relKey: string,
  data: Buffer | Uint8Array | string,
  _contentType = "application/octet-stream"
): Promise<{ key: string; url: string; localPath: string; sha256: string }> {
  const key = appendHashSuffix(normalizeKey(relKey));
  const localPath = path.join(UPLOAD_ROOT, key);
  ensureDirectoryExists(path.dirname(localPath));

  const buffer = Buffer.isBuffer(data) ? data : typeof data === "string" ? Buffer.from(data) : Buffer.from(data);
  fs.writeFileSync(localPath, buffer);
  const sha256 = sha256Buffer(buffer);

  return {
    key,
    url: `/uploads/${key}`,
    localPath,
    sha256,
  };
}

export async function storageGetLocal(relKey: string): Promise<{ key: string; url: string; localPath: string }> {
  const key = normalizeKey(relKey);
  const localPath = path.join(UPLOAD_ROOT, key);
  return {
    key,
    url: `/uploads/${key}`,
    localPath,
  };
}

export function getLocalEvidencePath(storageKey: string): string | null {
  const normalized = normalizeKey(storageKey);
  const localPath = path.join(UPLOAD_ROOT, normalized);
  if (fs.existsSync(localPath)) {
    return localPath;
  }
  return null;
}
