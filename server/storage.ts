import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { storagePutLocal, storageGetLocal } from "./storage.local";
import crypto from "node:crypto";

function getR2Client(): { client: S3Client; bucket: string; publicUrl?: string } | null {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    return null;
  }

  const client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  return {
    client,
    bucket,
    publicUrl: process.env.R2_PUBLIC_URL?.replace(/\/+$/, ""),
  };
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  // Always cache locally for low-latency OCR & tampering analysis
  const localResult = await storagePutLocal(relKey, data, contentType);
  const key = localResult.key;

  const r2 = getR2Client();
  if (r2) {
    const buffer = Buffer.isBuffer(data)
      ? data
      : typeof data === "string"
      ? Buffer.from(data)
      : Buffer.from(data);

    await r2.client.send(
      new PutObjectCommand({
        Bucket: r2.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      })
    );

    const publicUrl = r2.publicUrl
      ? `${r2.publicUrl}/${key}`
      : await getSignedUrl(r2.client, new GetObjectCommand({ Bucket: r2.bucket, Key: key }), {
          expiresIn: 604800, // 7 days
        });

    return { key, url: publicUrl };
  }

  return { key, url: localResult.url };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  const r2 = getR2Client();

  if (r2) {
    const publicUrl = r2.publicUrl
      ? `${r2.publicUrl}/${key}`
      : await getSignedUrl(r2.client, new GetObjectCommand({ Bucket: r2.bucket, Key: key }), {
          expiresIn: 604800,
        });
    return { key, url: publicUrl };
  }

  return storageGetLocal(relKey);
}

export async function storageGetSignedUrl(relKey: string): Promise<string> {
  const key = normalizeKey(relKey);
  const r2 = getR2Client();

  if (r2) {
    return r2.publicUrl
      ? `${r2.publicUrl}/${key}`
      : await getSignedUrl(r2.client, new GetObjectCommand({ Bucket: r2.bucket, Key: key }), {
          expiresIn: 604800,
        });
  }

  return `/uploads/${key}`;
}
