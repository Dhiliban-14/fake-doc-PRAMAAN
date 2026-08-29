import { createHash } from "node:crypto";

export const SUPPORTED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;
export const MAX_EVIDENCE_BYTES = 25 * 1024 * 1024;

export function isSupportedEvidenceMimeType(mimeType: string): boolean {
  return (SUPPORTED_MIME_TYPES as readonly string[]).includes(mimeType);
}

export function validateEvidenceBytes(bytes: Uint8Array): void {
  if (bytes.byteLength === 0) throw new Error("Evidence file is empty");
  if (bytes.byteLength > MAX_EVIDENCE_BYTES) throw new Error("Evidence exceeds the 25 MB limit");
}

export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function safeEvidenceName(originalName: string): string {
  return originalName.trim().replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 180) || "evidence";
}

export function evidenceIntegrityHash(input: { evidenceId: string; caseId: number; originalName: string; storageKey: string; mimeType: string; sha256: string; fileSize: number; width?: number; height?: number; pageCount?: number }): string {
  return sha256Hex(new TextEncoder().encode(JSON.stringify({ evidenceId: input.evidenceId, caseId: input.caseId, originalName: input.originalName, storageKey: input.storageKey, mimeType: input.mimeType, sha256: input.sha256, fileSize: input.fileSize, width: input.width ?? null, height: input.height ?? null, pageCount: input.pageCount ?? null })));
}

export function timelineIntegrityHash(input: { caseId: number; eventType: string; detail: string; evidenceReference?: string; previousHash?: string | null }): string {
  return sha256Hex(new TextEncoder().encode(JSON.stringify({ caseId: input.caseId, eventType: input.eventType, detail: input.detail, evidenceReference: input.evidenceReference ?? null, previousHash: input.previousHash ?? null })));
}

export function verifyEvidenceIntegrity(record: { evidenceId: string; caseId: number; originalName: string; storageKey: string; mimeType: string; sha256: string; recordHash: string; fileSize: number; width?: number | null; height?: number | null; pageCount?: number | null }): boolean {
  return evidenceIntegrityHash({ ...record, width: record.width ?? undefined, height: record.height ?? undefined, pageCount: record.pageCount ?? undefined }) === record.recordHash;
}

export function verifyTimelineChain(events: Array<{ id: number; caseId: number; eventType: string; detail: string; evidenceReference?: string | null; previousHash?: string | null; recordHash: string }>): boolean {
  const ordered = [...events].sort((left, right) => left.id - right.id);
  let previousHash: string | null = null;
  for (const event of ordered) {
    if ((event.previousHash ?? null) !== previousHash) return false;
    if (timelineIntegrityHash({ caseId: event.caseId, eventType: event.eventType, detail: event.detail, evidenceReference: event.evidenceReference ?? undefined, previousHash }) !== event.recordHash) return false;
    previousHash = event.recordHash;
  }
  return true;
}

export function rejectMutableEvidenceOperation(operation: "update" | "delete"): never {
  throw new Error(`Evidence records are immutable; ${operation} is not permitted`);
}

export function rejectMutableTimelineOperation(operation: "update" | "delete"): never {
  throw new Error(`Forensic timeline records are immutable; ${operation} is not permitted`);
}
