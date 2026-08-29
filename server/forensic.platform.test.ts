import { describe, expect, it } from "vitest";
import { evaluateCrossSignalAgreement } from "./services/contradictionEngine";
import { matchFraudPatterns } from "./services/fraudPatternLibrary";
import { computeExplainableRisk } from "./services/explainableRiskEngine";
import { evaluateDecisionGuidance } from "./services/decisionEngine";
import { compareDocumentVersions } from "./services/evolutionTracker";
import { generateLivenessChallenges, evaluateLivenessResponse } from "./services/livenessService";
import { extractAndBuildIdentityDna } from "./services/identityDnaService";

describe("AI Document Forensics Platform - Advanced Module Suite", () => {
  it("Cross-Signal Agreement: flags commercial domain and personal UPI contradiction", () => {
    const claims = [
      { claimType: "org", rawText: "Ministry of Personnel", normalizedValue: "Ministry of Personnel" },
      { claimType: "website", rawText: "Portal: fake-careers-portal.com", normalizedValue: "fake-careers-portal.com" },
      { claimType: "upi", rawText: "Fee to UPI: recruit.desk@okhdfcbank", normalizedValue: "recruit.desk@okhdfcbank" },
    ];

    const evalResult = evaluateCrossSignalAgreement({
      claims,
      qrPayload: "http://malicious-redirect-link.xyz/pay",
      metadata: { producer: "Canva Pro Export" },
    });

    expect(evalResult.hasCriticalContradictions).toBe(true);
    expect(evalResult.contradictions.length).toBeGreaterThanOrEqual(2);
    expect(evalResult.contradictions.some((c) => c.field === "fee_collection_channel")).toBe(true);
    expect(evalResult.contradictions.some((c) => c.field === "issuing_domain")).toBe(true);
  });

  it("Fraud Pattern Library: recognizes Treasury Siphoning and Domain Mimicry", () => {
    const claims = [
      { claimType: "website", rawText: "fake-jobs.com", normalizedValue: "fake-jobs.com" },
      { claimType: "upi", rawText: "collector@okhdfcbank", normalizedValue: "collector@okhdfcbank" },
    ];

    const matched = matchFraudPatterns({
      claims,
      tamperingRegions: [{ anomalyType: "ela_compression_anomaly", severity: "high" }],
    });

    expect(matched.some((p) => p.patternId === "PAT-001")).toBe(true);
    expect(matched.some((p) => p.patternId === "PAT-002")).toBe(true);
    expect(matched.some((p) => p.patternId === "PAT-004")).toBe(true);
  });

  it("Explainable Risk Engine: synthesizes 10-component risk and isolates model disagreement", () => {
    const crossSignal = evaluateCrossSignalAgreement({
      claims: [{ claimType: "upi", rawText: "pay@okhdfcbank", normalizedValue: "pay@okhdfcbank" }],
      qrPayload: null,
    });

    const patterns = matchFraudPatterns({
      claims: [{ claimType: "upi", rawText: "pay@okhdfcbank", normalizedValue: "pay@okhdfcbank" }],
    });

    // Substrate visually clean (0 tampering regions), but content has critical payment fraud
    const risk = computeExplainableRisk({
      tamperingResult: {
        success: true,
        dimensions: { width: 800, height: 600 },
        quality: { laplacianBlurScore: 180, isBlurry: false, glareRatio: 0.0, overallQuality: "good" },
        ela: { meanError: 2.1, stdError: 1.0, anomalousRatio: 0.001, isCompressionConsistent: true, heatmapPath: null },
        tamperingRegions: [],
        noiseAnalysis: { anomalousPatchCount: 0, isNoiseUniform: true },
        copyMove: { clonedClusters: 0, clonedPairs: [] },
        fontAlignment: { baselineShiftCount: 0, isAlignmentConsistent: true },
        securityFeatures: { qr: { detected: false, payload: null, points: null } },
      },
      crossSignal,
      matchedPatterns: patterns,
      claimsCount: 2,
    });

    expect(["HIGH", "CRITICAL"]).toContain(risk.riskLevel);
    expect(risk.riskScore).toBeGreaterThanOrEqual(75);
    expect(risk.modelDisagreement).toBe(true);
    expect(risk.epistemicReasoning.facts.length).toBeGreaterThan(0);
    expect(risk.epistemicReasoning.inferences.length).toBeGreaterThan(0);
  });

  it("Decision Engine: generates prioritized Next-Best-Actions and detects missing evidence", () => {
    const guidance = evaluateDecisionGuidance({
      riskScore: 85,
      riskLevel: "CRITICAL",
      hasCriticalContradictions: true,
      hasUpiFraud: true,
      hasQr: false,
      hasOcr: true,
      hasElaAnomaly: true,
      isLiveCaptureDone: false,
      isVersionCompareDone: false,
    });

    expect(guidance.recommendedDecision).toBe("PAUSE_RELIANCE");
    expect(guidance.nextActions.some((a) => a.actionType === "investigate_upi")).toBe(true);
    expect(guidance.missingEvidence.some((m) => m.evidenceName.includes("Camera Capture"))).toBe(true);
    expect(guidance.checklist.length).toBeGreaterThanOrEqual(6);
  });

  it("Document Evolution Tracker: detects altered fields and tampering introduction across revisions", () => {
    const v1 = {
      version: 1,
      sha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      claims: [
        { claimType: "org", normalizedValue: "Ministry of Rail" },
        { claimType: "website", normalizedValue: "railways.gov.in" },
      ],
      hasTampering: false,
    };

    const v2 = {
      version: 2,
      sha256: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      claims: [
        { claimType: "org", normalizedValue: "Ministry of Rail" },
        { claimType: "website", normalizedValue: "railways-commercial-apply.com" },
        { claimType: "upi", normalizedValue: "clerk.rail@okhdfcbank" },
      ],
      hasTampering: true,
    };

    const diff = compareDocumentVersions(v1, v2);

    expect(diff.changedFields.length).toBe(2);
    expect(diff.changedFields.some((f) => f.field === "website" && f.isSuspicious)).toBe(true);
    expect(diff.changedFields.some((f) => f.field === "upi" && f.isSuspicious)).toBe(true);
    expect(diff.tamperingStatusChange).toContain("TAMPERING_INTRODUCED");
  });

  it("Active Liveness: generates challenges and rejects static optical replay", () => {
    const challenges = generateLivenessChallenges();
    expect(challenges.length).toBe(3);
    expect(challenges[0].timeLimitSeconds).toBe(6);

    // Static presentation (0 motion variance)
    const staticReplay = evaluateLivenessResponse({
      framesCount: 20,
      faceDetected: true,
      averageBrightness: 120,
      movementVariance: 0.002,
    });
    expect(staticReplay.passed).toBe(false);
    expect(staticReplay.antiSpoofVerdict).toBe("STATIC_PRINT_PRESENTATION");

    // Genuine live presentation (sufficient motion variance)
    const livePerson = evaluateLivenessResponse({
      framesCount: 24,
      faceDetected: true,
      averageBrightness: 140,
      movementVariance: 0.05,
    });
    expect(livePerson.passed).toBe(true);
    expect(livePerson.antiSpoofVerdict).toBe("LIVE_PERSON");
  });

  it("Identity DNA: creates privacy-preserving HMAC tokens and masked display values", () => {
    const claims = [
      { claimType: "person_name", rawText: "Candidate: Rajesh Kumar Sharma", normalizedValue: "Rajesh Kumar Sharma" },
      { claimType: "upi", rawText: "UPI: desk.payment@okhdfcbank", normalizedValue: "desk.payment@okhdfcbank" },
      { claimType: "phone", rawText: "Mobile: +919876543210", normalizedValue: "+919876543210" },
    ];

    const dna = extractAndBuildIdentityDna(101, claims);

    expect(dna.tokenizedName).not.toBe("Rajesh Kumar Sharma");
    expect(dna.tokenizedName.length).toBe(64); // SHA-256 length
    expect(dna.maskedName).toContain("***");
    expect(dna.maskedPhone).toContain("•••");
    expect(dna.maskedUpi).toContain("***@okhdfcbank");
  });
});
