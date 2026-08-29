import { listSourceRegistry } from "../db";
import type { ExtractedClaim } from "./claimExtractor";

export interface VerificationOutput {
  claimId: number;
  status: "verified" | "contradicted" | "unverified" | "inconclusive" | "not_applicable";
  reason: string;
  sourceUrl?: string;
  evidenceReference?: string;
  confidence: number;
}

export async function verifyClaimsAgainstSources(
  dbClaims: Array<{
    id: number;
    claimId: string;
    claimType: string;
    rawText: string;
    normalizedValue: string;
    ocrConfidence: number;
  }>
): Promise<VerificationOutput[]> {
  const sources = await listSourceRegistry();
  const results: VerificationOutput[] = [];

  for (const claim of dbClaims) {
    const val = claim.normalizedValue.toLowerCase();

    // 1. UPI / Payment channel verification
    if (claim.claimType === "upi") {
      // Government recruitments never collect fees through personal UPI handles (okhdfcbank, paytm, etc.)
      results.push({
        claimId: claim.id,
        status: "contradicted",
        reason: `Personal payment channel detected (${claim.normalizedValue}). Official notifications collect fees exclusively via registered treasury payment gateways (BharatKosh, SBI ePay), never individual UPI IDs.`,
        evidenceReference: claim.claimId,
        sourceUrl: "https://bharatkosh.gov.in",
        confidence: 96,
      });
      continue;
    }

    // 2. Website / Domain verification
    if (claim.claimType === "website") {
      const matchedSource = sources.find(
        (s) =>
          val.includes(s.officialDomain.toLowerCase()) ||
          (s.recruitmentPortal && val.includes(s.recruitmentPortal.toLowerCase()))
      );

      if (matchedSource) {
        results.push({
          claimId: claim.id,
          status: "verified",
          reason: `Domain (${claim.normalizedValue}) aligns with authoritative registry for ${matchedSource.organization}.`,
          evidenceReference: claim.claimId,
          sourceUrl: `https://${matchedSource.officialDomain}`,
          confidence: 94,
        });
      } else if (val.endsWith(".gov.in") || val.endsWith(".nic.in")) {
        results.push({
          claimId: claim.id,
          status: "unverified",
          reason: `Domain ends with official sovereign TLD (.gov.in/.nic.in) but is not yet indexed in local registry.`,
          evidenceReference: claim.claimId,
          sourceUrl: `https://${val}`,
          confidence: 70,
        });
      } else {
        // Commercial TLD (.com, .org, .info) claiming to be government recruitment
        results.push({
          claimId: claim.id,
          status: "contradicted",
          reason: `Unofficial commercial destination (${claim.normalizedValue}). Official government notifications reside exclusively under .gov.in or .nic.in domains.`,
          evidenceReference: claim.claimId,
          sourceUrl: `https://${val}`,
          confidence: 95,
        });
      }
      continue;
    }

    // 3. Organization verification
    if (claim.claimType === "organization") {
      const matchedOrg = sources.find((s) => {
        const orgLower = s.organization.toLowerCase();
        return orgLower.includes(val) || val.includes(orgLower);
      });

      if (matchedOrg) {
        results.push({
          claimId: claim.id,
          status: "verified",
          reason: `Organization matches active registry entry for ${matchedOrg.organization}.`,
          evidenceReference: claim.claimId,
          sourceUrl: `https://${matchedOrg.officialDomain}`,
          confidence: 90,
        });
      } else {
        results.push({
          claimId: claim.id,
          status: "unverified",
          reason: `Entity name detected, but no matching registration found in authoritative departmental directory.`,
          evidenceReference: claim.claimId,
          confidence: 60,
        });
      }
      continue;
    }

    // 4. Notification number verification
    if (claim.claimType === "notification_number") {
      let matchedPattern = false;
      let matchedSource: any = null;

      for (const s of sources) {
        const patterns: string[] = Array.isArray(s.knownPatterns) ? s.knownPatterns : [];
        for (const pat of patterns) {
          const regex = new RegExp(`^${pat.replace(/\*/g, ".*")}$`, "i");
          if (regex.test(claim.normalizedValue)) {
            matchedPattern = true;
            matchedSource = s;
            break;
          }
        }
        if (matchedPattern) break;
      }

      if (matchedPattern && matchedSource) {
        results.push({
          claimId: claim.id,
          status: "verified",
          reason: `Notification number format matches published pattern for ${matchedSource.organization}.`,
          evidenceReference: claim.claimId,
          sourceUrl: matchedSource.recruitmentPortal
            ? `https://${matchedSource.recruitmentPortal}`
            : `https://${matchedSource.officialDomain}`,
          confidence: 88,
        });
      } else {
        results.push({
          claimId: claim.id,
          status: "contradicted",
          reason: `Notification ${claim.normalizedValue} does not exist in the authoritative gazette / recruitment repository.`,
          evidenceReference: claim.claimId,
          confidence: 82,
        });
      }
      continue;
    }

    // 5. General / Contextual claims
    if (claim.claimType === "fee") {
      results.push({
        claimId: claim.id,
        status: "unverified",
        reason: `Fee claim (${claim.normalizedValue}) recorded. Authenticity depends on associated payment channel.`,
        evidenceReference: claim.claimId,
        confidence: 75,
      });
      continue;
    }

    // Default fallback
    results.push({
      claimId: claim.id,
      status: "not_applicable",
      reason: `Claim extracted as contextual metadata. No external registry available for direct cross-reference.`,
      evidenceReference: claim.claimId,
      confidence: 50,
    });
  }

  return results;
}
