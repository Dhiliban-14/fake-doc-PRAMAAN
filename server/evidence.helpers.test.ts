import { describe, expect, it } from "vitest";
import { evidenceIntegrityHash, isSupportedEvidenceMimeType, MAX_EVIDENCE_BYTES, rejectMutableEvidenceOperation, rejectMutableTimelineOperation, safeEvidenceName, sha256Hex, timelineIntegrityHash, validateEvidenceBytes, verifyEvidenceIntegrity, verifyTimelineChain } from "./evidence.helpers";

describe("evidence intake helpers", () => {
  it("accepts the supported image and PDF MIME types only", () => {
    expect(isSupportedEvidenceMimeType("image/jpeg")).toBe(true);
    expect(isSupportedEvidenceMimeType("image/png")).toBe(true);
    expect(isSupportedEvidenceMimeType("image/webp")).toBe(true);
    expect(isSupportedEvidenceMimeType("application/pdf")).toBe(true);
    expect(isSupportedEvidenceMimeType("text/html")).toBe(false);
  });

  it("rejects empty and over-limit evidence bytes", () => {
    expect(() => validateEvidenceBytes(new Uint8Array())).toThrow("empty");
    expect(() => validateEvidenceBytes(new Uint8Array(MAX_EVIDENCE_BYTES + 1))).toThrow("25 MB");
  });

  it("sanitizes names and produces a stable SHA-256 hash", () => {
    expect(safeEvidenceName(" notice 2026 / final?.pdf ")).toBe("notice_2026___final_.pdf");
    expect(sha256Hex(new TextEncoder().encode("PRAMAAN"))).toBe("06e64bc9f007002bb91576ac443d29ff3a7c2a5562db1e33119a93d80d724f8b");
  });

  it("changes the integrity hash when chained content changes", () => {
    const evidenceInput = { evidenceId: "EV-1", caseId: 1, originalName: "notice.pdf", storageKey: "evidence/1/notice.pdf", mimeType: "application/pdf", sha256: "abc", fileSize: 3 };
    const recordHash = evidenceIntegrityHash(evidenceInput);
    expect(recordHash).toHaveLength(64);
    expect(verifyEvidenceIntegrity({ ...evidenceInput, recordHash })).toBe(true);
    expect(verifyEvidenceIntegrity({ ...evidenceInput, fileSize: 4, recordHash })).toBe(false);
    expect(recordHash).not.toBe(evidenceIntegrityHash({ ...evidenceInput, fileSize: 4 }));
    const first = timelineIntegrityHash({ caseId: 1, eventType: "uploaded", detail: "first" });
    const second = timelineIntegrityHash({ caseId: 1, eventType: "analyzed", detail: "second", previousHash: first });
    expect(second).not.toBe(timelineIntegrityHash({ caseId: 1, eventType: "analyzed", detail: "second" }));
    const firstEvent = { id: 1, caseId: 1, eventType: "uploaded", detail: "first", previousHash: null, recordHash: first };
    const secondEvent = { id: 2, caseId: 1, eventType: "analyzed", detail: "second", previousHash: first, recordHash: second };
    expect(verifyTimelineChain([secondEvent, firstEvent])).toBe(true);
    expect(verifyTimelineChain([{ ...secondEvent, detail: "edited" }, firstEvent])).toBe(false);
  });

  it("rejects update and delete operations for immutable records", () => {
    expect(() => rejectMutableEvidenceOperation("update")).toThrow("immutable");
    expect(() => rejectMutableEvidenceOperation("delete")).toThrow("immutable");
    expect(() => rejectMutableTimelineOperation("update")).toThrow("immutable");
    expect(() => rejectMutableTimelineOperation("delete")).toThrow("immutable");
  });
});
