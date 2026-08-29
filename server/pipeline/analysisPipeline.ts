import {
  addTimelineEvent,
  saveOcrResult,
  saveClaims,
  saveVerificationResults,
  saveForensicResults,
  updateCaseRiskAndStatus,
  updateEvidenceQuality,
  saveTamperingMap,
  saveIdentityDna,
  saveContradictions,
  saveRiskBreakdown,
  saveDecisionGuidance,
  saveFraudPatterns,
} from "../db";
import { performOcr } from "../services/ocrService";
import { extractClaimsFromText } from "../services/claimExtractor";
import { verifyClaimsAgainstSources } from "../services/claimVerifier";
import { runForensicAnalysis } from "../services/forensicService";
import { generateDocumentDna } from "../services/dnaService";
import { processAndStoreEntities } from "../services/entityService";
import { computeRiskAssessment } from "../services/riskEngine";
import { generateInvestigatorReasoning } from "../services/investigatorService";
import { runTamperingLocalization } from "../services/tamperingLocalization";
import { extractAndBuildIdentityDna } from "../services/identityDnaService";
import { evaluateCrossSignalAgreement } from "../services/contradictionEngine";
import { matchFraudPatterns } from "../services/fraudPatternLibrary";
import { computeExplainableRisk } from "../services/explainableRiskEngine";
import { evaluateDecisionGuidance } from "../services/decisionEngine";

export interface AnalysisJobInput {
  caseId: number;
  evidenceId: number;
  evidenceRecordId: string;
  filePath: string;
  mimeType: string;
  originalName: string;
}

export async function runAnalysisJob(input: AnalysisJobInput): Promise<void> {
  const { caseId, evidenceId, evidenceRecordId, filePath, mimeType, originalName } = input;

  try {
    // Stage 1: Quality Assessment
    const ocr = await performOcr(filePath, mimeType);
    await updateEvidenceQuality(evidenceId, {
      quality: ocr.quality,
      ocrReliability: ocr.reliability,
    });
    await addTimelineEvent({
      caseId,
      eventType: "quality_assessed",
      detail: `Evidence intake quality evaluated: ${ocr.quality.toUpperCase()}; average confidence ${ocr.averageConfidence}%.`,
      evidenceReference: evidenceRecordId,
    });

    // Stage 2: OCR Completed
    await saveOcrResult({
      evidenceId,
      fullText: ocr.fullText,
      blocks: ocr.blocks,
      headings: ocr.headings,
      tables: ocr.tables,
      averageConfidence: ocr.averageConfidence,
    });
    await addTimelineEvent({
      caseId,
      eventType: "ocr_completed",
      detail: `Extracted ${ocr.blocks.length} text blocks; detected language: ${ocr.detectedLanguage}.`,
      evidenceReference: evidenceRecordId,
    });

    // Stage 3: Claim Extraction
    const claims = extractClaimsFromText(ocr.fullText, ocr.averageConfidence, ocr.blocks);
    const savedClaims = await saveClaims(
      claims.map((c) => ({
        claimId: c.claimId,
        evidenceId,
        claimType: c.claimType,
        rawText: c.rawText,
        normalizedValue: c.normalizedValue,
        sourceLocation: c.sourceLocation,
        ocrConfidence: c.ocrConfidence,
      }))
    );
    await addTimelineEvent({
      caseId,
      eventType: "claims_extracted",
      detail: `Extracted ${claims.length} structured claims (organization, notification number, dates, URLs, payment IDs).`,
      evidenceReference: evidenceRecordId,
    });

    // Stage 4: Source Verification
    const verifications = await verifyClaimsAgainstSources(savedClaims || []);
    await saveVerificationResults(verifications);
    const contradictionsCount = verifications.filter((v) => v.status === "contradicted").length;
    const verifiedCount = verifications.filter((v) => v.status === "verified").length;
    await addTimelineEvent({
      caseId,
      eventType: "source_verified",
      detail: `Claim verification complete: ${verifiedCount} verified, ${contradictionsCount} contradicted against authoritative registry.`,
      evidenceReference: evidenceRecordId,
    });

    // Stage 5: Modular Forensics & Spatial Tampering Localization
    const [forensicFindings, tamperingAnalysis] = await Promise.all([
      runForensicAnalysis(filePath, mimeType, evidenceRecordId),
      runTamperingLocalization(filePath),
    ]);

    await saveForensicResults(
      forensicFindings.map((f) => ({
        evidenceId,
        detector: f.detector,
        finding: f.finding,
        strength: f.strength,
        confidence: f.confidence,
        reliability: f.reliability,
        limitations: f.limitations,
      }))
    );

    await saveTamperingMap(caseId, evidenceId, tamperingAnalysis);

    await addTimelineEvent({
      caseId,
      eventType: "forensics_completed",
      detail: `Forensic suite completed (ELA heatmap rendered, ${tamperingAnalysis.tamperingRegions.length} tampering region(s) localized).`,
      evidenceReference: evidenceRecordId,
    });

    // Stage 6: Document DNA & Fingerprinting
    const entitiesList = claims.map((c) => c.normalizedValue);
    const dnaResult = await generateDocumentDna(
      caseId,
      evidenceId,
      evidenceRecordId,
      filePath,
      ocr.fullText,
      ocr.blocks,
      entitiesList
    );
    await addTimelineEvent({
      caseId,
      eventType: "dna_generated",
      detail: `Document DNA synthesized (SHA-256 anchored, pHash ${dnaResult.visualDna}, Template ${dnaResult.templateDna}). Found ${dnaResult.similarityMatches.length} related cases.`,
      evidenceReference: evidenceRecordId,
    });

    // Stage 7: Privacy-Preserving Identity DNA & Recurring Relationships
    const identityDna = extractAndBuildIdentityDna(caseId, claims);
    await saveIdentityDna(caseId, identityDna);

    const entitiesProcessed = await processAndStoreEntities(caseId, claims);
    await addTimelineEvent({
      caseId,
      eventType: "relationships_detected",
      detail: `Intelligence graph updated with ${entitiesProcessed.length} normalized entities and tokenized Identity DNA.`,
      evidenceReference: evidenceRecordId,
    });

    // Stage 8: Cross-Signal Agreement & Contradiction Detection
    const crossSignal = evaluateCrossSignalAgreement({
      claims,
      qrPayload: tamperingAnalysis.securityFeatures?.qr?.payload || null,
      tamperingRegions: tamperingAnalysis.tamperingRegions,
    });
    await saveContradictions(caseId, crossSignal);

    // Stage 9: Fraud Pattern Library Matching
    const matchedPatterns = matchFraudPatterns({
      claims,
      tamperingRegions: tamperingAnalysis.tamperingRegions,
      contradictions: crossSignal.contradictions,
      identityDna,
    });
    await saveFraudPatterns(caseId, matchedPatterns);

    // Stage 10: Explainable 10-Component Risk Synthesis
    const explainableRisk = computeExplainableRisk({
      tamperingResult: tamperingAnalysis,
      crossSignal,
      matchedPatterns,
      identityDna,
      claimsCount: claims.length,
      verificationsCount: verifications.length,
      verifiedCount,
      contradictedCount: contradictionsCount,
    });
    await saveRiskBreakdown(caseId, explainableRisk);

    // Legacy risk compatibility
    const risk = computeRiskAssessment(verifications, forensicFindings, dnaResult.similarityMatches);
    await updateCaseRiskAndStatus(caseId, {
      riskLevel: explainableRisk.riskLevel.toLowerCase() as any,
      riskScore: explainableRisk.riskScore,
      confidence: explainableRisk.confidence,
      completeness: explainableRisk.completeness,
      status: "in_review",
    });

    await addTimelineEvent({
      caseId,
      eventType: "risk_assessed",
      detail: `Explainable 10-component risk calculated: ${explainableRisk.riskLevel} (${explainableRisk.riskScore}/100, confidence ${explainableRisk.confidence}%).`,
      evidenceReference: evidenceRecordId,
    });

    // Stage 11: Next-Best-Action & Missing Evidence Guidance
    const decisionGuidance = evaluateDecisionGuidance({
      riskScore: explainableRisk.riskScore,
      riskLevel: explainableRisk.riskLevel,
      hasCriticalContradictions: crossSignal.hasCriticalContradictions,
      hasUpiFraud: matchedPatterns.some((p) => p.patternId === "PAT-001"),
      hasQr: Boolean(tamperingAnalysis.securityFeatures?.qr?.detected),
      hasOcr: ocr.blocks.length > 0,
      hasElaAnomaly: tamperingAnalysis.tamperingRegions.length > 0,
      isLiveCaptureDone: false,
      isVersionCompareDone: false,
    });
    await saveDecisionGuidance(caseId, decisionGuidance);

    // Stage 12: AI Investigator Synthesis
    await generateInvestigatorReasoning(
      caseId,
      evidenceRecordId,
      risk,
      claims,
      verifications,
      forensicFindings
    );
    await addTimelineEvent({
      caseId,
      eventType: "investigator_completed",
      detail: `Evidence-bound findings synthesis compiled with formal citations and operational limitations.`,
      evidenceReference: evidenceRecordId,
    });

    // Final Stage: Report Ready
    await addTimelineEvent({
      caseId,
      eventType: "report_generated",
      detail: `Comprehensive forensic audit report ready for export.`,
      evidenceReference: evidenceRecordId,
    });
  } catch (err) {
    console.error("[AnalysisPipeline] Execution failed:", err);
    await addTimelineEvent({
      caseId,
      eventType: "analysis_error",
      detail: `Analysis pipeline encountered a non-fatal error: ${String(err)}`,
      evidenceReference: evidenceRecordId,
    });
  }
}
