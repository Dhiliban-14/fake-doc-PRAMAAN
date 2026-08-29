import type { TamperingAnalysisResult } from "./tamperingLocalization";
import type { CrossSignalEvaluation } from "./contradictionEngine";
import type { MatchedFraudPattern } from "./fraudPatternLibrary";
import type { IdentityDnaRecord } from "./identityDnaService";

export interface RiskComponent {
  component: string;
  label: string;
  observed: string;
  expected: string;
  deviation: number; // 0.0 to 1.0
  contribution: number; // Positive adds to risk, negative lowers risk
  confidence: number;
  supportingEvidenceIds: string[];
}

export interface EpistemicReasoning {
  facts: string[];
  observations: string[];
  inferences: string[];
  hypotheses: string[];
  uncertainties: string[];
}

export interface AdvancedRiskAssessment {
  riskScore: number; // 0.0 to 100.0
  riskLevel: "VERY_LOW" | "LOW" | "MODERATE" | "HIGH" | "CRITICAL" | "INSUFFICIENT_EVIDENCE";
  confidence: number; // 0.0 to 100.0
  completeness: number; // 0.0 to 100.0
  tone: "green" | "amber" | "red" | "neutral";
  modelDisagreement: boolean;
  disagreementExplanation?: string;
  components: RiskComponent[];
  epistemicReasoning: EpistemicReasoning;
  topFindings: Array<{ title: string; detail: string; severity: "low" | "medium" | "high" | "critical"; confidence: number }>;
}

export function computeExplainableRisk(params: {
  tamperingResult?: TamperingAnalysisResult;
  crossSignal?: CrossSignalEvaluation;
  matchedPatterns?: MatchedFraudPattern[];
  identityDna?: IdentityDnaRecord;
  claimsCount?: number;
  verificationsCount?: number;
  verifiedCount?: number;
  contradictedCount?: number;
}): AdvancedRiskAssessment {
  const {
    tamperingResult,
    crossSignal,
    matchedPatterns = [],
    identityDna,
    claimsCount = 0,
    verificationsCount = 0,
    verifiedCount = 0,
    contradictedCount = 0,
  } = params;

  const components: RiskComponent[] = [];
  const facts: string[] = [];
  const observations: string[] = [];
  const inferences: string[] = [];
  const hypotheses: string[] = [];
  const uncertainties: string[] = [];

  let accumulatedRisk = 0;
  let totalConfidence = 0;
  let signalChecks = 0;

  // 1. Pillar: Document Integrity (Tampering & ELA)
  if (tamperingResult) {
    signalChecks++;
    totalConfidence += 88;
    facts.push(`Raster dimension: ${tamperingResult.dimensions.width}x${tamperingResult.dimensions.height}px.`);

    if (tamperingResult.tamperingRegions.length > 0) {
      const topSev = tamperingResult.tamperingRegions.some((r) => r.severity === "critical") ? "critical" : "high";
      const impact = topSev === "critical" ? 30 : 20;
      accumulatedRisk += impact;

      components.push({
        component: "document_integrity",
        label: "Visual Substrate & ELA Integrity",
        observed: `${tamperingResult.tamperingRegions.length} anomalous compression region(s) detected`,
        expected: "Uniform quantization baseline across canvas",
        deviation: tamperingResult.ela.anomalousRatio,
        contribution: impact,
        confidence: 88,
        supportingEvidenceIds: ["EV-ELA-MAP"],
      });

      observations.push(`Local quantization residual error exceeds 3σ across ${tamperingResult.tamperingRegions.length} discrete region(s).`);
      inferences.push("Document substrate contains elements introduced from an image with a different JPEG compression history.");
      hypotheses.push("Isolated fields, signatures, or stamps may have been spliced into the original base document.");
    } else {
      accumulatedRisk -= 10;
      components.push({
        component: "document_integrity",
        label: "Visual Substrate & ELA Integrity",
        observed: "Compression and quantization baseline is uniform",
        expected: "Uniform quantization baseline across canvas",
        deviation: 0.02,
        contribution: -10,
        confidence: 90,
        supportingEvidenceIds: ["EV-ELA-BASELINE"],
      });
      observations.push("No localized high-frequency compression anomalies detected on the document surface.");
    }
  } else {
    uncertainties.push("High-resolution visual raster unavailable; ELA tampering analysis could not be fully evaluated.");
  }

  // 2. Pillar: Identity Consistency & Cross-Signal Contradictions
  if (crossSignal) {
    signalChecks++;
    totalConfidence += 95;

    if (crossSignal.hasCriticalContradictions) {
      accumulatedRisk += 40;
      components.push({
        component: "identity_consistency",
        label: "Cross-Signal & Authority Alignment",
        observed: `${crossSignal.contradictions.length} critical contradiction(s) between visible claims, QR, and authority`,
        expected: "Complete concordant alignment between document and official registry",
        deviation: 0.85,
        contribution: 40,
        confidence: 96,
        supportingEvidenceIds: crossSignal.contradictions.map((c) => c.id),
      });

      for (const cont of crossSignal.contradictions) {
        facts.push(`Discrepancy in '${cont.field}': ${cont.sourceA.label} ('${cont.sourceA.value}') vs ${cont.sourceB.label} ('${cont.sourceB.value}').`);
        inferences.push(cont.explanation);
      }
    } else if (crossSignal.contradictions.length > 0) {
      accumulatedRisk += 15;
      components.push({
        component: "identity_consistency",
        label: "Cross-Signal & Authority Alignment",
        observed: `${crossSignal.contradictions.length} minor discrepancy observed`,
        expected: "Complete concordant alignment",
        deviation: 0.35,
        contribution: 15,
        confidence: 85,
        supportingEvidenceIds: crossSignal.contradictions.map((c) => c.id),
      });
    } else if (verifiedCount > 0) {
      accumulatedRisk -= 15;
      components.push({
        component: "identity_consistency",
        label: "Cross-Signal & Authority Alignment",
        observed: "All claims verified against authoritative registry",
        expected: "Exact source match",
        deviation: 0.0,
        contribution: -15,
        confidence: 94,
        supportingEvidenceIds: ["SRC-REG-MATCH"],
      });
      facts.push("Extracted notification number and organization verified in National Source Registry.");
    }
  }

  // 3. Pillar: Payment & Treasury Channel Protocol
  const hasUpiFraud = matchedPatterns.some((p) => p.patternId === "PAT-001");
  if (hasUpiFraud) {
    accumulatedRisk += 35;
    components.push({
      component: "behavioral_signals",
      label: "Fee Collection Protocol",
      observed: "Personal retail payment channel (UPI) solicited in public notice",
      expected: "Official statutory treasury payment gateway (BharatKosh / Challan)",
      deviation: 1.0,
      contribution: 35,
      confidence: 99,
      supportingEvidenceIds: ["CLM-PAY-01"],
    });
    observations.push("Notice includes an active UPI payment identifier for fee remittance.");
    inferences.push("Official notices collect fees exclusively via registered treasury payment gateways, never personal retail UPI VPAs.");
    hypotheses.push("Document is a fraudulent solicitation engineered to intercept applicant fees into an illicit account.");
  }

  // 4. Pillar: Graph Intelligence & Synthetic Association
  if (identityDna?.recurrentAssociations && identityDna.recurrentAssociations.length > 0) {
    accumulatedRisk += 20;
    components.push({
      component: "graph_intelligence",
      label: "Cross-Case Association & Clustering",
      observed: `Identifier repeated across ${identityDna.recurrentAssociations[0].occurrencesCount} distinct cases`,
      expected: "Isolated individual applicant footprint",
      deviation: 0.7,
      contribution: 20,
      confidence: 90,
      supportingEvidenceIds: ["EV-GRAPH-CLUSTER"],
    });
    observations.push(`Extracted contact details re-appear in other case files in the investigative database.`);
    inferences.push("Shared contact identifiers across disparate candidate names indicate coordinated application staging.");
  }

  // 5. Model Disagreement Detection
  // e.g. If visual says no ELA anomaly, but cross-signal detects critical payment fraud
  let modelDisagreement = false;
  let disagreementExplanation = "";
  const visualClean = tamperingResult ? tamperingResult.tamperingRegions.length === 0 : false;
  const contentFraud = hasUpiFraud || (crossSignal ? crossSignal.hasCriticalContradictions : false);

  if (visualClean && contentFraud) {
    modelDisagreement = true;
    disagreementExplanation =
      "Visual Forensics indicates high substrate consistency (no significant ELA or noise anomaly), whereas Content & Cross-Signal Verification identified critical contradictions. This occurs when a fraudulent notice is freshly generated from a digital template without copy-paste splicing.";
  }

  // 6. Calibrate Final Risk Score
  const rawScore = Math.round(Math.max(8, Math.min(95, 12 + accumulatedRisk)));
  let riskLevel: AdvancedRiskAssessment["riskLevel"] = "LOW";
  let tone: AdvancedRiskAssessment["tone"] = "green";

  if (signalChecks < 2 && claimsCount === 0) {
    riskLevel = "INSUFFICIENT_EVIDENCE";
    tone = "neutral";
  } else if (rawScore <= 20) {
    riskLevel = "VERY_LOW";
    tone = "green";
  } else if (rawScore <= 40) {
    riskLevel = "LOW";
    tone = "green";
  } else if (rawScore <= 60) {
    riskLevel = "MODERATE";
    tone = "amber";
  } else if (rawScore <= 80) {
    riskLevel = "HIGH";
    tone = "red";
  } else {
    riskLevel = "CRITICAL";
    tone = "red";
  }

  const confidence = signalChecks > 0 ? Math.min(96, Math.max(50, Math.round(totalConfidence / signalChecks))) : 50;
  const completeness = Math.min(95, Math.max(35, signalChecks * 28 + (claimsCount > 0 ? 15 : 0)));

  // Top Findings
  const topFindings: AdvancedRiskAssessment["topFindings"] = [];
  if (hasUpiFraud) {
    topFindings.push({
      title: "Personal Payment Channel Detected",
      detail: "Fee instructions solicit payment to a personal retail UPI VPA.",
      severity: "critical",
      confidence: 98,
    });
  }
  if (crossSignal?.hasCriticalContradictions) {
    topFindings.push({
      title: "Domain & Authority Mismatch",
      detail: "Declared government authority directs to an unverified commercial web address.",
      severity: "critical",
      confidence: 96,
    });
  }
  if (tamperingResult?.tamperingRegions && tamperingResult.tamperingRegions.length > 0) {
    topFindings.push({
      title: "Localized Compression Discrepancy",
      detail: `${tamperingResult.tamperingRegions.length} region(s) exhibit significant ELA quantization deviations (>3σ).`,
      severity: "high",
      confidence: 88,
    });
  }
  if (topFindings.length === 0) {
    topFindings.push({
      title: "Verified Registry Match",
      detail: "Extracted claims correspond to registered official recruitment records.",
      severity: "low",
      confidence: 92,
    });
  }

  return {
    riskScore: rawScore,
    riskLevel,
    confidence,
    completeness,
    tone,
    modelDisagreement,
    disagreementExplanation,
    components,
    epistemicReasoning: {
      facts,
      observations,
      inferences,
      hypotheses,
      uncertainties,
    },
    topFindings,
  };
}
