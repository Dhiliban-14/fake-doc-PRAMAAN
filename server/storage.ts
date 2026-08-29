import { storagePutLocal, storageGetLocal } from "./storage.local";
import { getDb } from "./db";
import { evidenceBlobs } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const UPLOAD_ROOT = path.resolve(process.cwd(), "uploads");

function normalizeKey(relKey: string): string {
  return relKey.replace(/^[/\\]+/, "").replace(/\\/g, "/");
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  // 1. Cache to local disk
  const localResult = await storagePutLocal(relKey, data, contentType);
  const key = localResult.key;

  // 2. Persist to TiDB Cloud Storage
  try {
    const db = await getDb();
    if (db) {
      const buffer = Buffer.isBuffer(data)
        ? data
        : typeof data === "string"
        ? Buffer.from(data)
        : Buffer.from(data);

      const base64 = buffer.toString("base64");
      const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");

      await db
        .insert(evidenceBlobs)
        .values({
          storageKey: key,
          mimeType: contentType,
          fileData: base64,
          fileSize: buffer.length,
          sha256,
        })
        .onDuplicateKeyUpdate({
          set: {
            fileData: base64,
            fileSize: buffer.length,
            mimeType: contentType,
          },
        });
    }
  } catch (err) {
    console.warn("[TiDB Storage] Failed to backup file to TiDB:", err);
  }

  return { key, url: localResult.url };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  const localPath = path.join(UPLOAD_ROOT, key);

  // If cached locally, return local URL
  if (fs.existsSync(localPath)) {
    return { key, url: `/uploads/${key}` };
  }

  // Restore from TiDB cloud if missing locally
  try {
    const db = await getDb();
    if (db) {
      const rows = await db
        .select()
        .from(evidenceBlobs)
        .where(eq(evidenceBlobs.storageKey, key))
        .limit(1);

      if (rows.length > 0) {
        const row = rows[0];
        const buffer = Buffer.from(row.fileData, "base64");
        fs.mkdirSync(path.dirname(localPath), { recursive: true });
        fs.writeFileSync(localPath, buffer);
        return { key, url: `/uploads/${key}` };
      }
    }
  } catch (err) {
    console.warn("[TiDB Storage] Failed to restore file from TiDB:", err);
  }

  return storageGetLocal(relKey);
}

export async function storageGetSignedUrl(relKey: string): Promise<string> {
  const res = await storageGet(relKey);
  return res.url;
}
