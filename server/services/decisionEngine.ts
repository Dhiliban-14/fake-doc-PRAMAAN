export interface NextBestAction {
  id: string;
  title: string;
  actionType: "request_original" | "verify_qr" | "live_capture" | "compare_version" | "check_registry" | "investigate_upi";
  priority: "IMMEDIATE" | "RECOMMENDED" | "OPTIONAL";
  description: string;
  informationGain: number; // 0 - 100
  riskReduction: number;   // 0 - 100
  cost: "LOW" | "MEDIUM" | "HIGH";
  privacyImpact: "MINIMAL" | "MODERATE" | "HIGH";
  rationale: string;
}

export interface MissingEvidenceItem {
  id: string;
  evidenceName: string;
  status: "MISSING" | "AVAILABLE" | "OPTIONAL";
  importance: "CRITICAL" | "HIGH" | "MEDIUM";
  potentialImpactOnDecision: string;
}

export interface DynamicChecklistEntry {
  id: string;
  task: string;
  category: "INTAKE" | "FORENSICS" | "VERIFICATION" | "DECISION";
  completed: boolean;
  notes?: string;
}

export interface DecisionGuidance {
  recommendedDecision: "PAUSE_RELIANCE" | "CORROBORATE_SOURCE" | "CLEAR_FOR_RELIANCE" | "AWAIT_CRITICAL_EVIDENCE";
  decisionConfidence: number;
  nextActions: NextBestAction[];
  missingEvidence: MissingEvidenceItem[];
  checklist: DynamicChecklistEntry[];
  justification: string;
}

export function evaluateDecisionGuidance(params: {
  riskScore: number;
  riskLevel: string;
  hasCriticalContradictions: boolean;
  hasUpiFraud: boolean;
  hasQr: boolean;
  hasOcr: boolean;
  hasElaAnomaly: boolean;
  isLiveCaptureDone: boolean;
  isVersionCompareDone: boolean;
}): DecisionGuidance {
  const {
    riskScore,
    riskLevel,
    hasCriticalContradictions,
    hasUpiFraud,
    hasQr,
    hasOcr,
    hasElaAnomaly,
    isLiveCaptureDone,
    isVersionCompareDone,
  } = params;

  const nextActions: NextBestAction[] = [];
  const missingEvidence: MissingEvidenceItem[] = [];
  const checklist: DynamicChecklistEntry[] = [
    { id: "CHK-01", task: "Immutable Byte Storage & SHA-256 Anchoring", category: "INTAKE", completed: true },
    { id: "CHK-02", task: "Multi-Scale Error Level Analysis (ELA)", category: "FORENSICS", completed: true },
    { id: "CHK-03", task: "OCR & Semantic Claim Decomposition", category: "VERIFICATION", completed: hasOcr },
    { id: "CHK-04", task: "2D Barcode (QR) Extraction & Cross-Check", category: "VERIFICATION", completed: hasQr },
    { id: "CHK-05", task: "Authoritative Sovereign Registry Lookup", category: "VERIFICATION", completed: true },
    { id: "CHK-06", task: "Document Evolution & Historical Comparison", category: "FORENSICS", completed: isVersionCompareDone },
    { id: "CHK-07", task: "Active Challenge Liveness Verification", category: "DECISION", completed: isLiveCaptureDone },
    { id: "CHK-08", task: "Final Supervisory Review & Court Dossier Sign-Off", category: "DECISION", completed: false },
  ];

  // Missing Evidence Analysis
  if (!isLiveCaptureDone) {
    missingEvidence.push({
      id: "MISS-01",
      evidenceName: "Live Document Camera Capture",
      status: "MISSING",
      importance: "HIGH",
      potentialImpactOnDecision: "Eliminates pre-rendered digital spoofing and confirms physical possession of credentials.",
    });
  }

  if (!hasQr) {
    missingEvidence.push({
      id: "MISS-02",
      evidenceName: "Cryptographic QR Barcode Payload",
      status: "MISSING",
      importance: "MEDIUM",
      potentialImpactOnDecision: "Provides direct tamper-proof payload check against visible printed document fields.",
    });
  }

  if (!isVersionCompareDone) {
    missingEvidence.push({
      id: "MISS-03",
      evidenceName: "Prior Document Revisions",
      status: "MISSING",
      importance: "MEDIUM",
      potentialImpactOnDecision: "Allows automated differential tracing of altered names, dates, or stamps.",
    });
  }

  // Next-Best-Action Engine Ranking
  if (hasUpiFraud) {
    nextActions.push({
      id: "ACT-01",
      title: "Freeze Reliance & Report UPI Handle to Cybercrime Portal",
      actionType: "investigate_upi",
      priority: "IMMEDIATE",
      description: "Submit extracted retail payment handle to the National Cybercrime Reporting Portal to freeze illicit accounts.",
      informationGain: 85,
      riskReduction: 95,
      cost: "LOW",
      privacyImpact: "MINIMAL",
      rationale: "Direct financial fraud identified; immediate notification protects potential victims from unrecoverable wire loss.",
    });
  }

  if (hasCriticalContradictions) {
    nextActions.push({
      id: "ACT-02",
      title: "Verify Domain & Notice Directly with Gazette Registry",
      actionType: "check_registry",
      priority: "IMMEDIATE",
      description: "Contact the National Informatics Centre (NIC) or official department nodal officer to corroborate notice publication.",
      informationGain: 95,
      riskReduction: 90,
      cost: "LOW",
      privacyImpact: "MINIMAL",
      rationale: "Resolves contradiction between sovereign authority claim and commercial application destination.",
    });
  }

  if (hasElaAnomaly) {
    nextActions.push({
      id: "ACT-03",
      title: "Request Original High-Resolution Uncompressed Document (TIFF/PDF)",
      actionType: "request_original",
      priority: "RECOMMENDED",
      description: "Obtain original raster direct from the scanner or native digital PDF with embedded XMP font tables.",
      informationGain: 80,
      riskReduction: 75,
      cost: "LOW",
      privacyImpact: "MINIMAL",
      rationale: "Resolves whether compression discrepancies stem from repeated resaving or intentional localized text splicing.",
    });
  }

  if (!isLiveCaptureDone) {
    nextActions.push({
      id: "ACT-04",
      title: "Initiate Active Challenge Live Capture",
      actionType: "live_capture",
      priority: "RECOMMENDED",
      description: "Prompt applicant to present the physical document under randomized optical guidance in the camera stage.",
      informationGain: 75,
      riskReduction: 70,
      cost: "LOW",
      privacyImpact: "MODERATE",
      rationale: "Differentiates genuine physical documents from digital screen presentations or printed cutouts.",
    });
  }

  // Default Action
  if (nextActions.length === 0) {
    nextActions.push({
      id: "ACT-05",
      title: "Export Final Forensic Dossier for Legal Records",
      actionType: "check_registry",
      priority: "RECOMMENDED",
      description: "Generate court-admissible PDF/A dossier containing cryptographic evidence hashes and chain of custody.",
      informationGain: 40,
      riskReduction: 50,
      cost: "LOW",
      privacyImpact: "MINIMAL",
      rationale: "Case signals demonstrate high concordance; archive immutable investigation trail.",
    });
  }

  // Recommended Decision
  let recommendedDecision: DecisionGuidance["recommendedDecision"] = "CLEAR_FOR_RELIANCE";
  let justification = "";

  if (riskLevel === "CRITICAL" || riskLevel === "HIGH") {
    recommendedDecision = "PAUSE_RELIANCE";
    justification = "Multiple critical contradictions and fraud indicators observed. Document reliance should be halted immediately.";
  } else if (riskLevel === "MODERATE") {
    recommendedDecision = "CORROBORATE_SOURCE";
    justification = "Supporting anomalies detected. Investigator must corroborate material claims before formal reliance.";
  } else if (riskLevel === "INSUFFICIENT_EVIDENCE") {
    recommendedDecision = "AWAIT_CRITICAL_EVIDENCE";
    justification = "Core forensic perception channels could not extract sufficient signal; decision deferred until evidence is supplemented.";
  } else {
    recommendedDecision = "CLEAR_FOR_RELIANCE";
    justification = "All observable claims align with registered official sources and visual substrate is uniform.";
  }

  return {
    recommendedDecision,
    decisionConfidence: Math.min(95, Math.max(50, riskScore > 60 ? 92 : 88)),
    nextActions: nextActions.sort((a, b) => b.informationGain - a.informationGain),
    missingEvidence,
    checklist,
    justification,
  };
}
