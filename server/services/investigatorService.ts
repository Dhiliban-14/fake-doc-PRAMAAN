import { saveInvestigatorFindings } from "../db";
import type { RiskAssessmentResult } from "./riskEngine";

export interface InvestigatorExplanation {
  summary: string;
  keyFindings: string[];
  contradictions: string[];
  supportingEvidence: string[];
  uncertainty: string;
  recommendedAction: string;
  limitations: string;
}

export async function generateInvestigatorReasoning(
  caseId: number,
  evidenceId: string,
  risk: RiskAssessmentResult,
  claims: Array<{ claimId: string; claimType: string; normalizedValue: string }>,
  verifications: Array<{ claimId: number; status: string; reason: string; evidenceReference?: string }>,
  forensics: Array<{ detector: string; finding: string; strength: string; limitations: string }>
): Promise<InvestigatorExplanation> {
  const contradictions: string[] = [];
  const keyFindings: string[] = [];
  const supportingEvidence: string[] = [evidenceId];

  // Map claim contradictions
  for (const v of verifications) {
    if (v.status === "contradicted") {
      contradictions.push(`[${v.evidenceReference || evidenceId}] ${v.reason}`);
      if (v.evidenceReference && !supportingEvidence.includes(v.evidenceReference)) {
        supportingEvidence.push(v.evidenceReference);
      }
    }
  }

  // Key findings from signals
  for (const s of risk.signals) {
    keyFindings.push(`[${s.evidenceReference}] ${s.signal} (Severity: ${s.severity})`);
    if (s.evidenceReference && !supportingEvidence.includes(s.evidenceReference)) {
      supportingEvidence.push(s.evidenceReference);
    }
  }

  // Add forensic notes
  for (const f of forensics) {
    if (f.strength === "high" || f.strength === "medium") {
      keyFindings.push(`[${evidenceId}] ${f.detector}: ${f.finding}`);
    }
  }

  let recommendedAction = "";
  if (risk.riskLevel === "high") {
    recommendedAction =
      "Cease reliance on the document immediately. Issue advisory regarding fraudulent recruitment circular and report personal UPI/domain destinations to cyber cell.";
  } else if (risk.riskLevel === "medium") {
    recommendedAction =
      "Withhold administrative action until direct manual confirmation is received from the issuing department's registered recruitment desk.";
  } else {
    recommendedAction =
      "Retain original document file in case repository. Corroborate candidate identity parameters against primary registration records.";
  }

  const limitations =
    "This assessment is evidence-backed based on extracted claims, metadata, and authoritative registry comparison. It is an investigatory tool and does not constitute a judicial certificate of authenticity.";

  const uncertainty =
    risk.riskLevel === "inconclusive"
      ? "High uncertainty: OCR text density was insufficient for full linguistic and registry validation."
      : "Low to moderate uncertainty: Critical claims were corroborated against active official endpoints.";

  // Persist findings in DB
  await saveInvestigatorFindings({
    caseId,
    summary: risk.summary,
    evidenceReferences: supportingEvidence,
    limitations,
    recommendedAction,
  });

  return {
    summary: risk.summary,
    keyFindings,
    contradictions,
    supportingEvidence,
    uncertainty,
    recommendedAction,
    limitations,
  };
}
