import { describe, expect, it } from "vitest";
import { extractClaimsFromText } from "./services/claimExtractor";
import { verifyClaimsAgainstSources } from "./services/claimVerifier";
import { computeRiskAssessment } from "./services/riskEngine";
import { computeSha256, computeTextFingerprint, stringSimilarity } from "./services/dnaService";
import { runForensicAnalysis } from "./services/forensicService";
import { verifyTimelineChain, timelineIntegrityHash } from "./evidence.helpers";

describe("Phase 18 - Forensic Pipeline Realistic Scenarios and Robustness", () => {
  it("Scenario 1: Genuine recruitment notice matches official source and yields LOW RISK", async () => {
    const genuineText = `
      GOVERNMENT OF INDIA
      DEPARTMENT OF PUBLIC RECRUITMENT
      Notification Number: 17/2026
      Website: recruitment.xyz.gov.in
      Portal: https://xyz.gov.in/careers
      Applications are invited for administrative positions.
      Last Date: 30 Sep 2026
      Application fee: Nil / Official challan only
      Contact: 011-23381234
    `;

    const rawClaims = extractClaimsFromText(genuineText);
    expect(rawClaims.length).toBeGreaterThan(0);

    const dbClaims = rawClaims.map((c, i) => ({
      id: i + 1,
      claimId: `CLM-${i + 1}`,
      claimType: c.claimType,
      rawText: c.rawText,
      normalizedValue: c.normalizedValue,
      ocrConfidence: c.ocrConfidence,
    }));

    const verifications = await verifyClaimsAgainstSources(dbClaims);
    expect(verifications.some(v => v.status === "verified")).toBe(true);
    expect(verifications.some(v => v.status === "contradicted")).toBe(false);

    const forensics = await runForensicAnalysis("dummy-path.pdf", "application/pdf");

    const riskAssessment = computeRiskAssessment(verifications, forensics, []);

    expect(riskAssessment.riskLevel).toBe("low");
    expect(riskAssessment.riskScore).toBeLessThanOrEqual(35);
    expect(riskAssessment.confidence).toBeGreaterThan(50);
  });

  it("Scenario 2: Clean fake notice fails content verification (personal UPI, commercial domain) and yields HIGH RISK", async () => {
    const fakeText = `
      GOVERNMENT OF INDIA RECRUITMENT NOTICE
      Urgent Appointment Letter
      Notification Number: NOTIF-9999/FAKE
      Portal: http://jobs-xyz-careers.com
      Registration Fee: Send Rs 500 to payment desk via UPI: collector.office@okhdfcbank
      Contact: +91 9876543210
    `;

    const rawClaims = extractClaimsFromText(fakeText);
    expect(rawClaims.some(c => c.claimType === "upi")).toBe(true);
    expect(rawClaims.some(c => c.claimType === "website")).toBe(true);

    const dbClaims = rawClaims.map((c, i) => ({
      id: i + 1,
      claimId: `CLM-${i + 1}`,
      claimType: c.claimType,
      rawText: c.rawText,
      normalizedValue: c.normalizedValue,
      ocrConfidence: c.ocrConfidence,
    }));

    const verifications = await verifyClaimsAgainstSources(dbClaims);
    expect(verifications.some(v => v.status === "contradicted")).toBe(true);

    const forensics = await runForensicAnalysis("dummy-fake.pdf", "application/pdf");

    const riskAssessment = computeRiskAssessment(verifications, forensics, []);

    expect(riskAssessment.riskLevel).toBe("high");
    expect(riskAssessment.riskScore).toBeGreaterThanOrEqual(70);
    expect(riskAssessment.signals.some(s => s.category === "payment")).toBe(true);
  });

  it("Scenario 3: Genuine notice with compression artifacts maintains LOW RISK with stated limitations", async () => {
    const noticeText = `
      OFFICIAL GAZETTE OF INDIA
      Notification 17/2026
      Website: xyz.gov.in
      Published under authority.
    `;

    const rawClaims = extractClaimsFromText(noticeText);
    const dbClaims = rawClaims.map((c, i) => ({
      id: i + 1,
      claimId: `CLM-${i + 1}`,
      claimType: c.claimType,
      rawText: c.rawText,
      normalizedValue: c.normalizedValue,
      ocrConfidence: c.ocrConfidence,
    }));
    const verifications = await verifyClaimsAgainstSources(dbClaims);

    const simulatedForensics = [
      {
        detector: "jpeg_compression_ela",
        finding: "Localized compression inconsistency observed near document footer.",
        strength: "medium" as const,
        confidence: 70,
        reliability: "medium" as const,
        limitations: "Compression artifacts are common in resaved documents and do not independently prove fraudulent intent.",
      },
    ];

    const riskAssessment = computeRiskAssessment(verifications, simulatedForensics, []);

    expect(riskAssessment.riskLevel).toBe("low");
    expect(riskAssessment.riskScore).toBeLessThanOrEqual(40);
  });

  it("handles missing fields, empty inputs, and inconclusive states without crashing", async () => {
    const emptyClaims = extractClaimsFromText("");
    expect(emptyClaims).toEqual([]);

    const emptyVerifications = await verifyClaimsAgainstSources([]);
    expect(emptyVerifications).toEqual([]);

    const riskAssessment = computeRiskAssessment([], [], []);

    expect(riskAssessment.riskLevel).toBe("inconclusive");
    expect(riskAssessment.riskScore).toBeLessThanOrEqual(25);
    expect(riskAssessment.confidence).toBe(50);
  });

  it("validates intact timeline hash-chains and rejects tampered event records", () => {
    const h1 = timelineIntegrityHash({ caseId: 1, eventType: "ingested", detail: "File uploaded", previousHash: null });
    const h2 = timelineIntegrityHash({ caseId: 1, eventType: "claims_extracted", detail: "Claims parsed", previousHash: h1 });
    const h3 = timelineIntegrityHash({ caseId: 1, eventType: "risk_calculated", detail: "Risk evaluated", previousHash: h2 });

    const intactTimeline = [
      { id: 1, caseId: 1, eventType: "ingested", detail: "File uploaded", previousHash: null, recordHash: h1 },
      { id: 2, caseId: 1, eventType: "claims_extracted", detail: "Claims parsed", previousHash: h1, recordHash: h2 },
      { id: 3, caseId: 1, eventType: "risk_calculated", detail: "Risk evaluated", previousHash: h2, recordHash: h3 },
    ];

    expect(verifyTimelineChain(intactTimeline)).toBe(true);

    const tamperedTimeline = [
      intactTimeline[0],
      { ...intactTimeline[1], detail: "TAMPERED DETAILS TO CORRUPT AUDIT" },
      intactTimeline[2],
    ];

    expect(verifyTimelineChain(tamperedTimeline)).toBe(false);
  });

  it("computes Document DNA and identifies structural recurrence", () => {
    const sha1 = computeSha256(Buffer.from("Document Sample A"));
    const sha2 = computeSha256(Buffer.from("Document Sample B"));
    expect(sha1).not.toBe(sha2);

    const text1 = computeTextFingerprint("Government Notification 17/2026 New Delhi Official Portal");
    const text2 = computeTextFingerprint("Government Notification 17/2026 New Delhi Department");
    const similarity = stringSimilarity(text1, text2);
    expect(similarity).toBeGreaterThan(0);
  });
});
