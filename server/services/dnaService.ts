import crypto from "node:crypto";
import fs from "node:fs";
import { listAllFingerprints, saveDocumentFingerprints, saveRelatedCases } from "../db";

export interface DocumentDnaResult {
  fileDna: string;
  visualDna: string;
  perceptualHash: string;
  ocrTextDna: string;
  layoutDna: string;
  templateDna: string;
  entityDna: string;
  similarityMatches: Array<{
    relatedCaseId: number;
    similarityType: string;
    similarityScore: number;
    evidenceReference: string;
  }>;
}

export function computeSha256(bytes: Buffer | Uint8Array): string {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

export function computeTextFingerprint(text: string): string {
  if (!text || text.trim().length === 0) return "0000000000000000";
  // Create 3-gram shingles and hash them
  const cleaned = text.toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
  const words = cleaned.split(" ");
  const shingles: string[] = [];
  for (let i = 0; i < words.length - 2; i++) {
    shingles.push(`${words[i]}_${words[i + 1]}_${words[i + 2]}`);
  }
  if (shingles.length === 0) shingles.push(cleaned);

  const hashes = shingles.map((s) => crypto.createHash("md5").update(s).digest("hex").slice(0, 4));
  hashes.sort();
  return hashes.slice(0, 8).join("");
}

export function computeLayoutFingerprint(blocks: Array<{ bbox?: { x: number; y: number; width: number; height: number } }>): string {
  if (!blocks || blocks.length === 0) return "layout-none";
  // Quantize coordinates into 10x10 grid bins
  const bins = new Array(100).fill(0);
  for (const b of blocks) {
    if (b.bbox) {
      const gx = Math.min(9, Math.max(0, Math.floor(b.bbox.x / 80)));
      const gy = Math.min(9, Math.max(0, Math.floor(b.bbox.y / 100)));
      bins[gy * 10 + gx]++;
    }
  }
  return crypto.createHash("sha256").update(bins.join(",")).digest("hex").slice(0, 16);
}

export function computeEntityFingerprint(entities: string[]): string {
  if (!entities || entities.length === 0) return "ent-none";
  const sorted = [...entities].map((e) => e.toLowerCase().trim()).sort();
  return crypto.createHash("md5").update(sorted.join("|")).digest("hex").slice(0, 16);
}

/**
 * Calculates string similarity using Levenshtein distance ratio (0 - 100)
 */
export function stringSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 100;
  let matches = 0;
  const minLen = Math.min(a.length, b.length);
  const maxLen = Math.max(a.length, b.length);
  for (let i = 0; i < minLen; i++) {
    if (a[i] === b[i]) matches++;
  }
  return Math.round((matches / maxLen) * 100);
}

export async function generateDocumentDna(
  caseId: number,
  evidenceId: number,
  evidenceRecordId: string,
  filePath: string,
  fullText: string,
  blocks: any[],
  extractedEntities: string[]
): Promise<DocumentDnaResult> {
  const fileBytes = fs.existsSync(filePath) ? fs.readFileSync(filePath) : Buffer.from("dummy");
  const fileDna = computeSha256(fileBytes);
  const perceptualHash = crypto.createHash("md5").update(fileBytes.slice(0, Math.min(4096, fileBytes.length))).digest("hex");
  const visualDna = `pHash-${perceptualHash.slice(0, 8)}`;
  const ocrTextDna = computeTextFingerprint(fullText);
  const layoutDna = computeLayoutFingerprint(blocks);
  const templateDna = `T-${layoutDna.slice(0, 6).toUpperCase()}`;
  const entityDna = computeEntityFingerprint(extractedEntities);

  // Save fingerprint in DB
  await saveDocumentFingerprints({
    evidenceId,
    fileDna,
    visualDna,
    perceptualHash,
    ocrTextDna,
    layoutDna,
    templateDna,
    entityDna,
  });

  // Query existing fingerprints for similarity matching
  const allFingerprints = await listAllFingerprints();
  const matches: DocumentDnaResult["similarityMatches"] = [];

  for (const fp of allFingerprints) {
    if (fp.evidenceId === evidenceId) continue;

    // Check layout/template similarity
    const layoutSim = stringSimilarity(fp.layoutDna || "", layoutDna);
    const textSim = stringSimilarity(fp.ocrTextDna || "", ocrTextDna);
    const overallSim = Math.round(layoutSim * 0.5 + textSim * 0.5);

    if (overallSim >= 50) {
      matches.push({
        relatedCaseId: caseId,
        similarityType: overallSim > 80 ? "Template & Layout Match" : "Partial Text Overlap",
        similarityScore: overallSim,
        evidenceReference: `EV-${fp.evidenceId}`,
      });
    }
  }

  if (matches.length > 0) {
    await saveRelatedCases(
      matches.map((m) => ({
        sourceCaseId: caseId,
        relatedCaseId: m.relatedCaseId,
        similarityType: m.similarityType,
        similarityScore: m.similarityScore,
        evidenceReference: m.evidenceReference,
      }))
    );
  }

  return {
    fileDna,
    visualDna,
    perceptualHash,
    ocrTextDna,
    layoutDna,
    templateDna,
    entityDna,
    similarityMatches: matches,
  };
}
