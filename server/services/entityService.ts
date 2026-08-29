import { saveEntitiesAndRelationships, getCaseEntitiesGraph } from "../db";
import type { ExtractedClaim } from "./claimExtractor";

export interface NormalizedEntity {
  entityType: string;
  normalizedValue: string;
  displayValue: string;
  strength?: "low" | "medium" | "high" | "inconclusive";
  evidenceReference?: string;
}

export function normalizeEntityFromClaim(claim: ExtractedClaim): NormalizedEntity | null {
  const val = claim.normalizedValue.trim();

  switch (claim.claimType) {
    case "phone": {
      const digits = val.replace(/\D/g, "");
      const normalized = digits.length === 10 ? `+91${digits}` : `+${digits}`;
      const masked = normalized.slice(0, 6) + "••• " + normalized.slice(-4);
      return {
        entityType: "phone",
        normalizedValue: normalized,
        displayValue: masked,
        strength: "medium",
        evidenceReference: claim.claimId,
      };
    }
    case "email": {
      const lower = val.toLowerCase();
      return {
        entityType: "email",
        normalizedValue: lower,
        displayValue: lower,
        strength: "medium",
        evidenceReference: claim.claimId,
      };
    }
    case "upi": {
      const lower = val.toLowerCase();
      return {
        entityType: "upi",
        normalizedValue: lower,
        displayValue: lower,
        strength: "high",
        evidenceReference: claim.claimId,
      };
    }
    case "website": {
      const host = val.toLowerCase().replace(/^https?:\/\//, "").split("/")[0];
      return {
        entityType: "website",
        normalizedValue: host,
        displayValue: host,
        strength: "high",
        evidenceReference: claim.claimId,
      };
    }
    case "organization": {
      const normOrg = val.toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
      return {
        entityType: "organization",
        normalizedValue: normOrg,
        displayValue: val,
        strength: "medium",
        evidenceReference: claim.claimId,
      };
    }
    case "notification_number": {
      return {
        entityType: "notification",
        normalizedValue: val.toUpperCase(),
        displayValue: val.toUpperCase(),
        strength: "high",
        evidenceReference: claim.claimId,
      };
    }
    default:
      return null;
  }
}

export async function processAndStoreEntities(caseId: number, claims: ExtractedClaim[]) {
  const entities: NormalizedEntity[] = [];

  for (const claim of claims) {
    const ent = normalizeEntityFromClaim(claim);
    if (ent) {
      if (!entities.some((e) => e.normalizedValue === ent.normalizedValue)) {
        entities.push(ent);
      }
    }
  }

  if (entities.length > 0) {
    await saveEntitiesAndRelationships(caseId, entities);
  }

  return entities;
}

export async function buildDynamicFraudGraph(caseId: number) {
  return getCaseEntitiesGraph(caseId);
}
