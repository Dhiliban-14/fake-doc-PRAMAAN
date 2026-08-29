import { describe, expect, it, vi } from "vitest";
import { evidenceIntegrityHash, timelineIntegrityHash, verifyEvidenceIntegrity, verifyTimelineChain } from "./evidence.helpers";

vi.mock("./db", () => ({
  addCaseNote: vi.fn(),
  addEvidenceRecord: vi.fn(),
  addTimelineEvent: vi.fn(),
  createCaseRecord: vi.fn(),
  getCaseBundle: vi.fn(),
  listCases: vi.fn(),
  listSourceRegistry: vi.fn(),
  getCaseIntegrityAudit: vi.fn(async (caseId: string) => caseId === "PRM-2026-000007" ? {
    caseId,
    evidence: [{ evidenceId: "EV-AUDIT-1", valid: true }],
    timelineValid: true,
    valid: true,
    checkedAt: new Date("2026-08-28T12:00:00.000Z"),
  } : null),
}));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createAuditContext(): TrpcContext {
  const now = new Date();
  return {
    user: { id: 1, openId: "audit-test-user", name: "Audit Test", email: "audit@example.com", loginMethod: "test", role: "user", createdAt: now, updatedAt: now, lastSignedIn: now },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("cases.audit integrity contract", () => {
  it("invokes the actual router path for an existing case and returns evidence, timeline, and overall validity", async () => {
    const caller = appRouter.createCaller(createAuditContext());
    await expect(caller.cases.audit({ caseId: "PRM-2026-000007" })).resolves.toMatchObject({ evidence: [{ evidenceId: "EV-AUDIT-1", valid: true }], timelineValid: true, valid: true });
  });

  it("invokes the actual router path for a missing case without inventing an audit result", async () => {
    const caller = appRouter.createCaller(createAuditContext());
    await expect(caller.cases.audit({ caseId: "PRM-2099-999999" })).resolves.toBeNull();
  });
  it("returns valid evidence and timeline checks for untampered records", () => {
    const evidenceRecord = {
      evidenceId: "EV-AUDIT-1",
      caseId: 7,
      originalName: "notice.pdf",
      storageKey: "evidence/7/notice.pdf",
      mimeType: "application/pdf",
      sha256: "sha256-of-original",
      fileSize: 2048,
      recordHash: "",
    };
    const withHash = { ...evidenceRecord, recordHash: evidenceIntegrityHash(evidenceRecord) };
    const firstHash = timelineIntegrityHash({ caseId: 7, eventType: "uploaded", detail: "Original preserved" });
    const timeline = [{ id: 1, caseId: 7, eventType: "uploaded", detail: "Original preserved", previousHash: null, recordHash: firstHash }];
    const audit = {
      caseId: "PRM-2026-000007",
      evidence: [{ evidenceId: withHash.evidenceId, valid: verifyEvidenceIntegrity(withHash) }],
      timelineValid: verifyTimelineChain(timeline),
    };
    expect(audit).toEqual({ caseId: "PRM-2026-000007", evidence: [{ evidenceId: "EV-AUDIT-1", valid: true }], timelineValid: true });
  });
});
