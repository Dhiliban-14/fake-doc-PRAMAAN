import crypto from "node:crypto";
import { getLocalDb } from "../db";

const IDENTITY_SALT = process.env.IDENTITY_SALT || "VERITAS_FORENSIC_SECURE_SALT_2026_FIPS";

export interface IdentityDnaRecord {
  caseId: number;
  tokenizedName: string;
  tokenizedDob: string;
  tokenizedIdNumber: string;
  tokenizedPhone: string | null;
  tokenizedUpi: string | null;
  maskedName: string;
  maskedIdNumber: string;
  maskedPhone: string | null;
  maskedUpi: string | null;
  recurrentAssociations: Array<{
    field: string;
    occurrencesCount: number;
    relatedCaseIds: number[];
  }>;
}

export function blindHmac(value: string): string {
  if (!value || value.trim().length === 0) return "BLIND_TOKEN_NONE";
  const normalized = value.trim().toLowerCase().replace(/\s+/g, " ");
  return crypto.createHmac("sha256", IDENTITY_SALT).update(normalized).digest("hex");
}

export function maskString(value: string): string {
  if (!value) return "NOT_AVAILABLE";
  const trimmed = value.trim();
  if (trimmed.length <= 3) return "***";
  if (trimmed.includes("@")) {
    const parts = trimmed.split("@");
    const namePart = parts[0];
    const visible = namePart.slice(0, Math.min(3, Math.floor(namePart.length / 2)));
    return `${visible}***@${parts[1]}`;
  }
  if (/^\+?\d+$/.test(trimmed)) {
    // Phone
    return trimmed.slice(0, 5) + "••• " + trimmed.slice(-4);
  }
  // Name / ID
  const words = trimmed.split(" ");
  return words
    .map((w) => (w.length > 2 ? `${w[0]}***${w[w.length - 1]}` : `${w[0]}*`))
    .join(" ");
}

export function extractAndBuildIdentityDna(
  caseId: number,
  claims: Array<{ claimType: string; rawText: string; normalizedValue: string }>
): IdentityDnaRecord {
  const nameClaim = claims.find((c) => c.claimType === "person_name" || c.claimType === "candidate_name");
  const dobClaim = claims.find((c) => c.claimType === "dob" || c.claimType === "birth_date");
  const idClaim = claims.find((c) => c.claimType === "id_number" || c.claimType === "roll_number" || c.claimType === "notif_number");
  const phoneClaim = claims.find((c) => c.claimType === "phone");
  const upiClaim = claims.find((c) => c.claimType === "upi");

  const rawName = nameClaim?.normalizedValue || "UNSPECIFIED";
  const rawDob = dobClaim?.normalizedValue || "UNSPECIFIED";
  const rawId = idClaim?.normalizedValue || "UNSPECIFIED";
  const rawPhone = phoneClaim?.normalizedValue || null;
  const rawUpi = upiClaim?.normalizedValue || null;

  const tokenizedName = blindHmac(rawName);
  const tokenizedDob = blindHmac(rawDob);
  const tokenizedIdNumber = blindHmac(rawId);
  const tokenizedPhone = rawPhone ? blindHmac(rawPhone) : null;
  const tokenizedUpi = rawUpi ? blindHmac(rawUpi) : null;

  // Cross-case recurrence query against DB
  const db = getLocalDb();
  const recurrent: Array<{ field: string; occurrencesCount: number; relatedCaseIds: number[] }> = [];

  if (rawUpi && db?.entities) {
    const existingUpi = db.entities.filter((e: any) => e.entityType === "upi" && e.normalizedValue.toLowerCase() === rawUpi.toLowerCase());
    if (existingUpi.length > 0) {
      recurrent.push({
        field: "upi",
        occurrencesCount: existingUpi.length + 1,
        relatedCaseIds: db.cases.slice(0, 3).map((c: any) => c.id).filter((id: number) => id !== caseId),
      });
    }
  }

  if (rawPhone && db?.entities) {
    const existingPhone = db.entities.filter((e: any) => e.entityType === "phone" && e.normalizedValue === rawPhone);
    if (existingPhone.length > 0) {
      recurrent.push({
        field: "phone",
        occurrencesCount: existingPhone.length + 1,
        relatedCaseIds: db.cases.slice(0, 3).map((c: any) => c.id).filter((id: number) => id !== caseId),
      });
    }
  }

  return {
    caseId,
    tokenizedName,
    tokenizedDob,
    tokenizedIdNumber,
    tokenizedPhone,
    tokenizedUpi,
    maskedName: maskString(rawName),
    maskedIdNumber: maskString(rawId),
    maskedPhone: rawPhone ? maskString(rawPhone) : null,
    maskedUpi: rawUpi ? maskString(rawUpi) : null,
    recurrentAssociations: recurrent,
  };
}
