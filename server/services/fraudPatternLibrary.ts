export interface FraudPatternDefinition {
  id: string;
  name: string;
  category: "payment_fraud" | "identity_forgery" | "tampering" | "synthetic_cluster" | "metadata_spoof";
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  description: string;
  indicators: string[];
  detectionLogic: string;
  confidence: number;
  recommendedActions: string[];
}

export interface MatchedFraudPattern {
  patternId: string;
  name: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  confidence: number;
  matchedIndicators: string[];
  evidenceReferences: string[];
  explanation: string;
  recommendedAction: string;
}

export const FRAUD_PATTERN_CATALOG: FraudPatternDefinition[] = [
  {
    id: "PAT-001",
    name: "Personal Treasury Siphoning",
    category: "payment_fraud",
    severity: "CRITICAL",
    description: "An official government appointment or recruitment notice directs application fees into a retail personal UPI handle.",
    indicators: ["UPI ID in document", "Retail bank VPA (@okhdfc, @paytm)", "Absence of BharatKosh/treasury portal"],
    detectionLogic: "Extracted claimType == 'upi' and normalizedValue matches retail banking suffixes in a recruitment circular context.",
    confidence: 98,
    recommendedActions: [
      "Freeze reliance on document immediately.",
      "Submit UPI VPA to cybercrime nodal authority for account freeze.",
      "Verify with issuing department's vigilance officer.",
    ],
  },
  {
    id: "PAT-002",
    name: "Commercial Domain Mimicry",
    category: "identity_forgery",
    severity: "CRITICAL",
    description: "A document purporting to be issued by a sovereign authority directs users to an unverified commercial domain (.com/.org/.xyz).",
    indicators: ["Absence of .gov.in/.nic.in", "Domain registration via commercial registrar", "Visual spoofing of official emblems"],
    detectionLogic: "Extracted claimType == 'website' and not ending with registered sovereign TLD (.gov.in, .nic.in).",
    confidence: 96,
    recommendedActions: [
      "Perform WHOIS investigation on registration date and registrar.",
      "Verify whether issuing agency operates authorized private vendor portals.",
    ],
  },
  {
    id: "PAT-003",
    name: "Barcode Identity Discrepancy",
    category: "identity_forgery",
    severity: "CRITICAL",
    description: "The 2D QR matrix contains identity credentials or URLs belonging to a different entity or expired case.",
    indicators: ["Decoded QR text does not match candidate/recipient name", "QR points to external target"],
    detectionLogic: "Normalized QR payload differs from visible recipient OCR fields.",
    confidence: 94,
    recommendedActions: [
      "Inspect original source barcode generation database.",
      "Request live capture of physical credential.",
    ],
  },
  {
    id: "PAT-004",
    name: "Localized Quantization Splicing",
    category: "tampering",
    severity: "HIGH",
    description: "A discrete region (such as date, grade, or name) exhibits an Error Level Analysis (ELA) residual >3σ higher than the background canvas.",
    indicators: ["Discrete rectangular ELA discrepancy", "High-frequency DCT variance", "Baseline boundary shift"],
    detectionLogic: "Local ELA variance exceeding background mean by 3 standard deviations within isolated contour.",
    confidence: 88,
    recommendedActions: [
      "Examine high-resolution RAW scan.",
      "Inspect text alignment under 8x magnification.",
    ],
  },
  {
    id: "PAT-005",
    name: "Desktop Graphics Suite Stamp",
    category: "metadata_spoof",
    severity: "MEDIUM",
    description: "PDF producer or EXIF software metadata indicates creation in consumer graphics editors (Canva, Photoshop, Photopea).",
    indicators: ["PDF Producer == Canva / Photoshop", "Multiple XMP modification timestamps"],
    detectionLogic: "Metadata parsing matches known consumer design tools for formal public administrative notices.",
    confidence: 82,
    recommendedActions: [
      "Check whether document was exported as a social media announcement.",
      "Request original PDF with digital cryptographic signature intact.",
    ],
  },
  {
    id: "PAT-006",
    name: "Synthetic Contact Recurrence",
    category: "synthetic_cluster",
    severity: "HIGH",
    description: "The same phone number or payment handle appears associated across multiple unrelated cases and disparate names.",
    indicators: ["Phone or UPI associated with >2 distinct case IDs", "Different applicant names sharing single device/contact"],
    detectionLogic: "Graph entity recurrence count > 1 across independent case partitions.",
    confidence: 91,
    recommendedActions: [
      "Surface entity relationship cluster in Fraud Graph.",
      "Audit all historical cases connected to the shared identifier.",
    ],
  },
  {
    id: "PAT-007",
    name: "Cloned Seal Keypoint Duplication",
    category: "tampering",
    severity: "HIGH",
    description: "Keypoint descriptor matching locates identical visual features duplicated at a spatial distance >40 pixels within the same image.",
    indicators: ["SIFT / ORB feature descriptor cluster duplication", "Identical edge gradients on separated stamps"],
    detectionLogic: "K-NN descriptor matches with spatial displacement > 45px clustering in stamp region.",
    confidence: 86,
    recommendedActions: [
      "Verify authenticity of rubber stamp imprint with issuing office.",
    ],
  },
];

export function matchFraudPatterns(params: {
  claims: Array<{ claimType: string; rawText: string; normalizedValue: string }>;
  tamperingRegions?: Array<{ anomalyType: string; severity: string }>;
  contradictions?: Array<{ field: string; severity: string }>;
  identityDna?: { recurrentAssociations: Array<{ field: string; occurrencesCount: number }> };
  metadata?: { producer?: string };
}): MatchedFraudPattern[] {
  const matches: MatchedFraudPattern[] = [];
  const { claims, tamperingRegions, contradictions, identityDna, metadata } = params;

  // Check PAT-001: Personal Treasury Siphoning
  const upi = claims.find((c) => c.claimType === "upi");
  if (upi) {
    matches.push({
      patternId: "PAT-001",
      name: "Personal Treasury Siphoning",
      severity: "CRITICAL",
      confidence: 98,
      matchedIndicators: [`Extracted retail UPI VPA: ${upi.normalizedValue}`, "Fee collection routed to individual account"],
      evidenceReferences: ["CLM-PAY-01"],
      explanation: "Document solicits administrative application fees into an individual personal payment handle rather than an official treasury gateway.",
      recommendedAction: "Halt reliance on document and alert cybercrime grievance portal for the specified VPA.",
    });
  }

  // Check PAT-002: Commercial Domain Mimicry
  const website = claims.find((c) => c.claimType === "website");
  if (website) {
    const val = website.normalizedValue.toLowerCase();
    if (!val.includes(".gov.in") && !val.includes(".nic.in") && (val.includes(".com") || val.includes(".xyz"))) {
      matches.push({
        patternId: "PAT-002",
        name: "Commercial Domain Mimicry",
        severity: "CRITICAL",
        confidence: 96,
        matchedIndicators: [`Application portal on commercial domain: ${website.normalizedValue}`, "Missing sovereign government TLD (.gov.in)"],
        evidenceReferences: ["CLM-DOM-01"],
        explanation: "The document claims to originate from a government body but directs recruitment candidates to a commercial website.",
        recommendedAction: "Corroborate whether the agency has officially notified this external portal in the National Gazette.",
      });
    }
  }

  // Check PAT-004: Localized Quantization Splicing
  if (tamperingRegions && tamperingRegions.some((r) => r.severity === "critical" || r.severity === "high")) {
    matches.push({
      patternId: "PAT-004",
      name: "Localized Quantization Splicing",
      severity: "HIGH",
      confidence: 88,
      matchedIndicators: [`${tamperingRegions.length} discrete region(s) exhibit significant ELA compression inconsistency`],
      evidenceReferences: ["EV-ELA-01"],
      explanation: "One or more discrete regions display pixel compression characteristics inconsistent with the background document substrate.",
      recommendedAction: "Examine physical document or request uncompressed TIFF/PDF.",
    });
  }

  // Check PAT-005: Desktop Graphics Suite Stamp
  if (metadata?.producer) {
    const prod = metadata.producer.toLowerCase();
    if (prod.includes("canva") || prod.includes("photoshop") || prod.includes("photopea")) {
      matches.push({
        patternId: "PAT-005",
        name: "Desktop Graphics Suite Stamp",
        severity: "MEDIUM",
        confidence: 82,
        matchedIndicators: [`Producer: ${metadata.producer}`, "Compiled using consumer design software"],
        evidenceReferences: ["EV-META-01"],
        explanation: "The document's binary object stream records compilation in a consumer graphic design tool.",
        recommendedAction: "Check if the file is a marketing graphic or an authentic official administrative circular.",
      });
    }
  }

  // Check PAT-006: Synthetic Contact Recurrence
  if (identityDna?.recurrentAssociations && identityDna.recurrentAssociations.length > 0) {
    matches.push({
      patternId: "PAT-006",
      name: "Synthetic Contact Recurrence",
      severity: "HIGH",
      confidence: 91,
      matchedIndicators: identityDna.recurrentAssociations.map((a) => `${a.field.toUpperCase()} handle appears across ${a.occurrencesCount} cases`),
      evidenceReferences: ["EV-GRAPH-01"],
      explanation: "A contact identifier extracted from this document is linked to multiple disparate case dossiers in the platform.",
      recommendedAction: "Inspect the cross-case relationship cluster in the Fraud Intelligence Graph.",
    });
  }

  return matches;
}
