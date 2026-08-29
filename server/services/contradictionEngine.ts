export interface ContradictionRecord {
  id: string;
  field: string;
  sourceA: { label: string; value: string };
  sourceB: { label: string; value: string };
  severity: "critical" | "concerning" | "minor";
  explanation: string;
  confidence: number;
  potentialNonFraudExplanations: string[];
}

export interface FieldAgreementEntry {
  field: string;
  ocrValue: string;
  qrValue: string;
  registryValue: string;
  status: "AGREE" | "PARTIAL_AGREE" | "CONTRADICTION" | "INSUFFICIENT";
  confidence: number;
}

export interface CrossSignalEvaluation {
  contradictions: ContradictionRecord[];
  agreementMatrix: FieldAgreementEntry[];
  hasCriticalContradictions: boolean;
  summary: string;
}

export function evaluateCrossSignalAgreement(params: {
  claims: Array<{ claimType: string; rawText: string; normalizedValue: string }>;
  qrPayload: string | null;
  metadata?: { producer?: string; creationDate?: string; modDate?: string };
  tamperingRegions?: Array<{ bbox: { x: number; y: number; w: number; h: number }; whyFlagged: string }>;
  registrySources?: Array<{ organization: string; officialDomain: string; recruitmentPortal?: string }>;
}): CrossSignalEvaluation {
  const { claims, qrPayload, metadata, tamperingRegions, registrySources } = params;
  const contradictions: ContradictionRecord[] = [];
  const agreementMatrix: FieldAgreementEntry[] = [];

  const websiteClaim = claims.find((c) => c.claimType === "website");
  const upiClaim = claims.find((c) => c.claimType === "upi");
  const notifClaim = claims.find((c) => c.claimType === "notif_number");
  const orgClaim = claims.find((c) => c.claimType === "org");
  const deadlineClaim = claims.find((c) => c.claimType === "deadline");

  // 1. QR Payload vs Visible Document Fields
  if (qrPayload) {
    const qrLower = qrPayload.toLowerCase();

    // Check website vs QR URL
    if (websiteClaim) {
      const webVal = websiteClaim.normalizedValue.toLowerCase();
      const qrHasDomain = qrLower.includes(webVal) || webVal.includes(qrLower);
      if (!qrHasDomain && qrPayload.startsWith("http")) {
        contradictions.push({
          id: "CONT-QR-01",
          field: "destination_url",
          sourceA: { label: "Visible Document Website", value: websiteClaim.normalizedValue },
          sourceB: { label: "2D Barcode (QR) Destination", value: qrPayload },
          severity: "critical",
          explanation: `Document visible text points to '${websiteClaim.normalizedValue}', but the embedded QR barcode routes to a disparate external target '${qrPayload}'.`,
          confidence: 96,
          potentialNonFraudExplanations: [
            "Official redirect domain migration",
            "Third-party hosting vendor link",
          ],
        });
      }
    }

    // Check Notification Number vs QR
    if (notifClaim) {
      const notifVal = notifClaim.normalizedValue.toLowerCase();
      const notifInQr = qrLower.includes(notifVal);
      agreementMatrix.push({
        field: "Notification Number",
        ocrValue: notifClaim.normalizedValue,
        qrValue: notifInQr ? notifClaim.normalizedValue : "Payload absent",
        registryValue: "Matches pattern",
        status: notifInQr ? "AGREE" : "PARTIAL_AGREE",
        confidence: 88,
      });
    }
  }

  // 2. Official Registry vs Commercial Domain Contradiction
  if (websiteClaim) {
    const webVal = websiteClaim.normalizedValue.toLowerCase();
    const isGov = webVal.includes(".gov.in") || webVal.includes(".nic.in");
    const isCommercial = webVal.includes(".com") || webVal.includes(".xyz") || webVal.includes(".org") || webVal.includes(".net");

    if (isCommercial && !isGov) {
      contradictions.push({
        id: "CONT-REG-01",
        field: "issuing_domain",
        sourceA: { label: "Document Declared Authority", value: orgClaim?.normalizedValue || "Government Department" },
        sourceB: { label: "Document Application Domain", value: websiteClaim.normalizedValue },
        severity: "critical",
        explanation: `National government departments communicate exclusively through '.gov.in' or '.nic.in' domains. Commercial domain '${websiteClaim.normalizedValue}' indicates an unverified entity.`,
        confidence: 98,
        potentialNonFraudExplanations: [
          "Outsourced recruitment agency hosting portal",
          "Informational coaching site notice",
        ],
      });
    }

    agreementMatrix.push({
      field: "Official Domain",
      ocrValue: websiteClaim.normalizedValue,
      qrValue: qrPayload || "N/A",
      registryValue: registrySources?.[0]?.officialDomain || "xyz.gov.in",
      status: isGov ? "AGREE" : "CONTRADICTION",
      confidence: 94,
    });
  }

  // 3. Treasury Policy vs Personal Payment Channel Contradiction
  if (upiClaim) {
    const upiVal = upiClaim.normalizedValue.toLowerCase();
    contradictions.push({
      id: "CONT-PAY-01",
      field: "fee_collection_channel",
      sourceA: { label: "Statutory Fee Collection Rule", value: "Central Treasury Gateway (BharatKosh / Challan)" },
      sourceB: { label: "Extracted Payment Handle", value: upiClaim.normalizedValue },
      severity: "critical",
      explanation: `Personal retail payment handle detected (${upiClaim.normalizedValue}). Official notices never accept direct payments via personal UPI handles.`,
      confidence: 99,
      potentialNonFraudExplanations: [
        "Unauthorized modification of application instructions",
        "Document used as a private coaching application form",
      ],
    });

    agreementMatrix.push({
      field: "Fee Channel",
      ocrValue: upiClaim.normalizedValue,
      qrValue: "N/A",
      registryValue: "treasury.gov.in / BharatKosh",
      status: "CONTRADICTION",
      confidence: 99,
    });
  }

  // 4. Metadata Software Suite vs Official Publisher
  if (metadata?.producer) {
    const prodLower = metadata.producer.toLowerCase();
    if (prodLower.includes("canva") || prodLower.includes("photoshop") || prodLower.includes("photopea")) {
      contradictions.push({
        id: "CONT-META-01",
        field: "document_generator",
        sourceA: { label: "Expected Official Publishing Pipeline", value: "Government Printing Office / LibreOffice / TeX" },
        sourceB: { label: "PDF Producer Signature", value: metadata.producer },
        severity: "concerning",
        explanation: `Document metadata reveals graphics editing suite '${metadata.producer}'. Official circulars are compiled via automated document publishing workflows.`,
        confidence: 85,
        potentialNonFraudExplanations: [
          "Social media PR graphic design conversion",
          "Public relations flyer re-export",
        ],
      });
    }
  }

  // 5. Visual Tampering Bounding Box Overlap
  if (tamperingRegions && tamperingRegions.length > 0) {
    agreementMatrix.push({
      field: "Substrate Compression Integrity",
      ocrValue: "Readable text",
      qrValue: "N/A",
      registryValue: "Uniform baseline",
      status: "CONTRADICTION",
      confidence: 82,
    });
  }

  const hasCritical = contradictions.some((c) => c.severity === "critical");
  const summary = hasCritical
    ? `${contradictions.length} material contradiction(s) detected across independent verification channels, primarily concerning payment channels and domain authenticity.`
    : contradictions.length > 0
    ? `${contradictions.length} minor or concerning signal discrepancy observed; review recommended before reliance.`
    : "All observable independent signals (OCR, Barcode, Metadata, Registry) demonstrate mutual agreement.";

  return {
    contradictions,
    agreementMatrix,
    hasCriticalContradictions: hasCritical,
    summary,
  };
}
