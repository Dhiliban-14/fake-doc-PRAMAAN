import type { VerificationOutput } from "./claimVerifier";
import type { ForensicFinding } from "./forensicService";

export interface RiskSignal {
  signal: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  impactScore: number;
  confidence: number;
  reliability: "high" | "medium" | "low" | "inconclusive";
  evidenceReference: string;
  category: "source_verification" | "forensics" | "metadata" | "entity" | "payment";
}

export interface RiskAssessmentResult {
  riskLevel: "low" | "medium" | "high" | "inconclusive";
  riskScore: number; // 0 - 100
  confidence: number; // 0 - 100
  completeness: number; // 0 - 100
  signals: RiskSignal[];
  summary: string;
  tone: "red" | "amber" | "green";
}

export function computeRiskAssessment(
  verifications: VerificationOutput[],
  forensicFindings: ForensicFinding[],
  dnaMatches: any[] = []
): RiskAssessmentResult {
  const signals: RiskSignal[] = [];

  let accumulatedRisk = 0;
  let totalSignalConfidence = 0;
  let checksCount = 0;

  // 1. Evaluate Source Verifications
  for (const v of verifications) {
    checksCount++;
    totalSignalConfidence += v.confidence;

    if (v.status === "contradicted") {
      const isUpi = v.reason.toLowerCase().includes("payment") || v.reason.toLowerCase().includes("upi");
      const isDomain = v.reason.toLowerCase().includes("domain") || v.reason.toLowerCase().includes("destination");

      if (isUpi) {
        signals.push({
          signal: "Personal payment channel detected in recruitment notice",
          severity: "CRITICAL",
          impactScore: 40,
          confidence: v.confidence,
          reliability: "high",
          evidenceReference: v.evidenceReference || "CLM-PAY",
          category: "payment",
        });
        accumulatedRisk += 40;
      } else if (isDomain) {
        signals.push({
          signal: "Unofficial commercial domain mismatch",
          severity: "HIGH",
          impactScore: 35,
          confidence: v.confidence,
          reliability: "high",
          evidenceReference: v.evidenceReference || "CLM-DOM",
          category: "source_verification",
        });
        accumulatedRisk += 35;
      } else {
        signals.push({
          signal: "Authoritative claim contradiction",
          severity: "HIGH",
          impactScore: 30,
          confidence: v.confidence,
          reliability: "high",
          evidenceReference: v.evidenceReference || "CLM-NOTIF",
          category: "source_verification",
        });
        accumulatedRisk += 30;
      }
    } else if (v.status === "verified") {
      signals.push({
        signal: "Authoritative source claim match",
        severity: "LOW",
        impactScore: -15,
        confidence: v.confidence,
        reliability: "high",
        evidenceReference: v.evidenceReference || "CLM-VER",
        category: "source_verification",
      });
      accumulatedRisk -= 15;
    }
  }

  // 2. Evaluate Forensic Findings
  for (const f of forensicFindings) {
    checksCount++;
    totalSignalConfidence += f.confidence;

    if (f.strength === "high") {
      signals.push({
        signal: `${f.detector}: ${f.finding}`,
        severity: "HIGH",
        impactScore: 25,
        confidence: f.confidence,
        reliability: f.reliability,
        evidenceReference: "EV-FORENSIC",
        category: "forensics",
      });
      accumulatedRisk += 25;
    } else if (f.strength === "medium") {
      signals.push({
        signal: `${f.detector}: ${f.finding}`,
        severity: "MEDIUM",
        impactScore: 15,
        confidence: f.confidence,
        reliability: f.reliability,
        evidenceReference: "EV-FORENSIC",
        category: "forensics",
      });
      accumulatedRisk += 15;
    }
  }

  // 3. DNA / Related Case Overlap
  if (dnaMatches.length > 0) {
    for (const m of dnaMatches) {
      if (m.similarityScore > 80) {
        signals.push({
          signal: `High template similarity (${m.similarityScore}%) with case ${m.relatedCaseId}`,
          severity: "MEDIUM",
          impactScore: 15,
          confidence: 85,
          reliability: "medium",
          evidenceReference: m.evidenceReference,
          category: "entity",
        });
        accumulatedRisk += 15;
      }
    }
  }

  // Bounds & Calibration (Never output 0 or 100)
  const normalizedScore = Math.min(95, Math.max(10, Math.round(accumulatedRisk > 0 ? 15 + accumulatedRisk : 15)));
  const avgConfidence = checksCount > 0 ? Math.min(96, Math.max(40, Math.round(totalSignalConfidence / checksCount))) : 50;

  // Completeness score: Based on coverage of verification + forensics + metadata checks
  const completeness = Math.min(95, Math.max(30, checksCount * 12));

  let riskLevel: RiskAssessmentResult["riskLevel"];
  let tone: RiskAssessmentResult["tone"];
  let summary = "";

  if (completeness < 35 || avgConfidence < 40) {
    riskLevel = "inconclusive";
    tone = "amber";
    summary = "Assessment is inconclusive due to limited document resolution, unextractable text, or incomplete verification coverage.";
  } else if (normalizedScore >= 65) {
    riskLevel = "high";
    tone = "red";
    summary = "Multiple critical contradictions identified against official repositories, including domain discrepancies and unverified payment channels. The document exhibits high likelihood of unauthorized fabrication.";
  } else if (normalizedScore >= 35) {
    riskLevel = "medium";
    tone = "amber";
    summary = "Moderate risk signals detected. Discrepancies exist in metadata or formatting that warrant manual investigator review against gazette sources.";
  } else {
    riskLevel = "low";
    tone = "green";
    summary = "Extracted notification parameters and web endpoints match published authoritative registers. No significant digital tampering or contradictory claims detected.";
  }

  return {
    riskLevel,
    riskScore: normalizedScore,
    confidence: avgConfidence,
    completeness,
    signals,
    summary,
    tone,
  };
}
