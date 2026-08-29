import fs from "node:fs";
import path from "node:path";
import { desc, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  cases,
  caseNotes,
  claims,
  documentFingerprints,
  entities,
  entityRelationships,
  evidence,
  forensicResults,
  investigatorFindings,
  ocrResults,
  relatedCases,
  reports,
  sourceRegistry,
  timelineEvents,
  users,
  verificationResults,
  type Case,
  type Evidence,
  type InsertUser,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import {
  evidenceIntegrityHash,
  timelineIntegrityHash,
  verifyEvidenceIntegrity,
  verifyTimelineChain,
} from "./evidence.helpers";

// Local storage path for fallback embedded DB
const DB_FILE = path.resolve(process.cwd(), "data", "pramaan_db.json");

interface LocalDbSchema {
  users: any[];
  cases: any[];
  evidence: any[];
  ocrResults: any[];
  claims: any[];
  sourceRegistry: any[];
  verificationResults: any[];
  forensicResults: any[];
  entities: any[];
  entityRelationships: any[];
  documentFingerprints: any[];
  relatedCases: any[];
  timelineEvents: any[];
  investigatorFindings: any[];
  caseNotes: any[];
  reports: any[];
  tamperingMaps: any[];
  identityDna: any[];
  contradictions: any[];
  riskBreakdowns: any[];
  decisionGuidance: any[];
  fraudPatterns: any[];
  investigatorFeedback: any[];
  counters: Record<string, number>;
}

const DEFAULT_SOURCES = [
  {
    id: 1,
    organization: "XYZ Government Department",
    officialDomain: "xyz.gov.in",
    recruitmentPortal: "recruitment.xyz.gov.in",
    officialApi: "https://api.xyz.gov.in/v1/notices",
    contactInfo: { email: "recruitment@xyz.gov.in", helpline: "1800-11-2026" },
    knownPatterns: ["17/2026", "CIRCULAR-*", "ADV-*"],
    active: 1,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 2,
    organization: "Union Public Service Commission (UPSC)",
    officialDomain: "upsc.gov.in",
    recruitmentPortal: "upsconline.nic.in",
    officialApi: "https://upsc.gov.in/notices/api",
    contactInfo: { email: "feedback-upsc@gov.in", helpline: "011-23098591" },
    knownPatterns: ["UPSC/*", "EXAM-*", "NOTIFICATION-*"],
    active: 1,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 3,
    organization: "Staff Selection Commission (SSC)",
    officialDomain: "ssc.gov.in",
    recruitmentPortal: "ssc.gov.in",
    officialApi: "https://ssc.gov.in/api/v1/exams",
    contactInfo: { email: "enquiry-ssc@nic.in", helpline: "011-24363343" },
    knownPatterns: ["SSC/CGL/*", "SSC/CHSL/*", "NOTICE/*"],
    active: 1,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 4,
    organization: "National Informatics Centre (NIC)",
    officialDomain: "nic.in",
    recruitmentPortal: "india.gov.in",
    officialApi: "https://data.gov.in",
    contactInfo: { email: "servicedesk@nic.in", helpline: "1800-111-555" },
    knownPatterns: ["NIC-*", "GOV-*"],
    active: 1,
    updatedAt: new Date().toISOString(),
  },
];

let localData: LocalDbSchema | null = null;

function loadLocalData(): LocalDbSchema {
  if (!localData) {
    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, "utf-8");
        localData = JSON.parse(raw);
      } catch (err) {
        console.warn("[LocalDB] Parse error, reinitializing:", err);
      }
    }
    if (!localData) {
      localData = {
        users: [
          {
            id: 1,
            openId: "local-investigator",
            name: "Aarav Sharma",
            email: "aarav.sharma@pramaan.gov.in",
            loginMethod: "local",
            role: "admin",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            lastSignedIn: new Date().toISOString(),
          },
        ],
        cases: [],
        evidence: [],
        ocrResults: [],
        claims: [],
        sourceRegistry: [...DEFAULT_SOURCES],
        verificationResults: [],
        forensicResults: [],
        entities: [],
        entityRelationships: [],
        documentFingerprints: [],
        relatedCases: [],
        timelineEvents: [],
        investigatorFindings: [],
        caseNotes: [],
        reports: [],
        tamperingMaps: [],
        identityDna: [],
        contradictions: [],
        riskBreakdowns: [],
        decisionGuidance: [],
        fraudPatterns: [],
        investigatorFeedback: [],
        counters: {
          users: 1,
          cases: 0,
          evidence: 0,
          ocrResults: 0,
          claims: 0,
          sourceRegistry: 4,
          verificationResults: 0,
          forensicResults: 0,
          entities: 0,
          entityRelationships: 0,
          documentFingerprints: 0,
          relatedCases: 0,
          timelineEvents: 0,
          investigatorFindings: 0,
          caseNotes: 0,
          reports: 0,
        },
      };
      saveLocalData();
    }
  }
  if (!localData) {
    throw new Error("Failed to initialize database");
  }
  localData.tamperingMaps = localData.tamperingMaps || [];
  localData.identityDna = localData.identityDna || [];
  localData.contradictions = localData.contradictions || [];
  localData.riskBreakdowns = localData.riskBreakdowns || [];
  localData.decisionGuidance = localData.decisionGuidance || [];
  localData.fraudPatterns = localData.fraudPatterns || [];
  localData.investigatorFeedback = localData.investigatorFeedback || [];
  return localData;
}

export function getLocalDb(): LocalDbSchema {
  return loadLocalData();
}

function saveLocalData() {
  if (localData) {
    const dir = path.dirname(DB_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DB_FILE, JSON.stringify(localData, null, 2), "utf-8");
  }
}

function nextId(table: keyof LocalDbSchema["counters"]): number {
  const db = loadLocalData();
  db.counters[table] = (db.counters[table] || 0) + 1;
  return db.counters[table];
}

let _db: ReturnType<typeof drizzle> | null = null;
let _dbAvailable: boolean | null = null;

export async function getDb() {
  if (_dbAvailable === false) return null;
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
      _dbAvailable = true;
    } catch (error) {
      console.warn("[Database] Failed to connect to MySQL, using local embedded DB:", error);
      _db = null;
      _dbAvailable = false;
    }
  }
  return _db;
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now().toString(36).slice(-6)}-${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
}

export async function upsertUser(user: InsertUser): Promise<void> {
  const db = await getDb();
  if (db) {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    for (const field of textFields) {
      if (user[field] !== undefined) {
        values[field] = user[field] ?? null;
        updateSet[field] = user[field] ?? null;
      }
    }
    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (!Object.keys(updateSet).length) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
    return;
  }

  // Local DB
  const local = loadLocalData();
  const existingIndex = local.users.findIndex((u) => u.openId === user.openId);
  const nowStr = new Date().toISOString();
  if (existingIndex >= 0) {
    local.users[existingIndex] = {
      ...local.users[existingIndex],
      ...user,
      updatedAt: nowStr,
      lastSignedIn: nowStr,
    };
  } else {
    local.users.push({
      id: nextId("users"),
      ...user,
      role: user.openId === ENV.ownerOpenId ? "admin" : (user.role ?? "user"),
      createdAt: nowStr,
      updatedAt: nowStr,
      lastSignedIn: nowStr,
    });
  }
  saveLocalData();
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (db) {
    const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
    return result[0];
  }
  const local = loadLocalData();
  return local.users.find((u) => u.openId === openId);
}

export async function createCaseRecord(input: {
  title: string;
  ownerId?: number;
  riskLevel?: Case["riskLevel"];
  riskScore?: number;
  confidence?: number;
  completeness?: number;
}) {
  const caseId = `PRM-${new Date().getUTCFullYear()}-${Math.floor(100000 + Math.random() * 899999)}`;
  const db = await getDb();
  if (db) {
    const result = await db.insert(cases).values({
      caseId,
      title: input.title,
      ownerId: input.ownerId,
      riskLevel: input.riskLevel ?? "inconclusive",
      riskScore: input.riskScore ?? 0,
      confidence: input.confidence ?? 0,
      completeness: input.completeness ?? 0,
    });
    const created = await db.select().from(cases).where(eq(cases.id, result[0].insertId)).limit(1);
    return created[0];
  }

  // Local DB
  const local = loadLocalData();
  const id = nextId("cases");
  const now = new Date().toISOString();
  const newCase = {
    id,
    caseId,
    title: input.title,
    status: "open",
    riskLevel: input.riskLevel ?? "inconclusive",
    riskScore: input.riskScore ?? 0,
    confidence: input.confidence ?? 0,
    completeness: input.completeness ?? 0,
    ownerId: input.ownerId ?? 1,
    createdAt: now,
    updatedAt: now,
  };
  local.cases.unshift(newCase);
  saveLocalData();
  return newCase;
}

export async function addEvidenceRecord(input: {
  caseId: number;
  originalName: string;
  storageKey: string;
  mimeType: string;
  sha256: string;
  fileSize: number;
  width?: number;
  height?: number;
  pageCount?: number;
}) {
  const evidenceId = makeId("EV");
  const recordHash = evidenceIntegrityHash({ evidenceId, ...input });

  const db = await getDb();
  if (db) {
    const result = await db.insert(evidence).values({
      evidenceId,
      caseId: input.caseId,
      originalName: input.originalName,
      storageKey: input.storageKey,
      mimeType: input.mimeType,
      sha256: input.sha256,
      recordHash,
      fileSize: input.fileSize,
      width: input.width,
      height: input.height,
      pageCount: input.pageCount,
      quality: "inconclusive",
      ocrReliability: "inconclusive",
      forensicReliability: "inconclusive",
    });
    const created = await db.select().from(evidence).where(eq(evidence.id, result[0].insertId)).limit(1);
    return created[0];
  }

  // Local DB
  const local = loadLocalData();
  const id = nextId("evidence");
  const now = new Date().toISOString();
  const newEvidence = {
    id,
    evidenceId,
    caseId: input.caseId,
    originalName: input.originalName,
    storageKey: input.storageKey,
    mimeType: input.mimeType,
    sha256: input.sha256,
    recordHash,
    fileSize: input.fileSize,
    width: input.width ?? null,
    height: input.height ?? null,
    pageCount: input.pageCount ?? null,
    quality: "inconclusive",
    ocrReliability: "inconclusive",
    forensicReliability: "inconclusive",
    uploadedAt: now,
    immutableAt: now,
  };
  local.evidence.push(newEvidence);
  saveLocalData();
  return newEvidence;
}

export async function addTimelineEvent(input: {
  caseId: number;
  eventType: string;
  detail: string;
  evidenceReference?: string;
}) {
  const db = await getDb();
  if (db) {
    const latest = await db
      .select({ recordHash: timelineEvents.recordHash })
      .from(timelineEvents)
      .where(eq(timelineEvents.caseId, input.caseId))
      .orderBy(desc(timelineEvents.id))
      .limit(1);
    const previousHash = latest[0]?.recordHash ?? null;
    const recordHash = timelineIntegrityHash({ ...input, previousHash });
    const result = await db.insert(timelineEvents).values({
      caseId: input.caseId,
      eventType: input.eventType,
      detail: input.detail,
      evidenceReference: input.evidenceReference,
      previousHash,
      recordHash,
    });
    const created = await db.select().from(timelineEvents).where(eq(timelineEvents.id, result[0].insertId)).limit(1);
    return created[0];
  }

  // Local DB
  const local = loadLocalData();
  const caseEvents = local.timelineEvents.filter((e) => e.caseId === input.caseId);
  const latest = caseEvents[caseEvents.length - 1];
  const previousHash = latest?.recordHash ?? null;
  const recordHash = timelineIntegrityHash({ ...input, previousHash });
  const id = nextId("timelineEvents");
  const now = new Date().toISOString();
  const newEvent = {
    id,
    caseId: input.caseId,
    eventType: input.eventType,
    detail: input.detail,
    evidenceReference: input.evidenceReference ?? null,
    previousHash,
    recordHash,
    occurredAt: now,
    immutableAt: now,
  };
  local.timelineEvents.push(newEvent);
  saveLocalData();
  return newEvent;
}

export async function listCases() {
  const db = await getDb();
  if (db) {
    return db.select().from(cases).orderBy(desc(cases.updatedAt));
  }
  const local = loadLocalData();
  return [...local.cases].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

/**
 * Phase 17 Security Fix:
 * All child records are strictly scoped to this case's evidence and case ID.
 * Zero cross-case data leakage!
 */
export async function getCaseBundle(caseId: string) {
  const db = await getDb();
  if (db) {
    const found = await db.select().from(cases).where(eq(cases.caseId, caseId)).limit(1);
    const current = found[0];
    if (!current) return null;

    const caseEvidence = await db.select().from(evidence).where(eq(evidence.caseId, current.id));
    const caseTimeline = await db
      .select()
      .from(timelineEvents)
      .where(eq(timelineEvents.caseId, current.id))
      .orderBy(desc(timelineEvents.occurredAt));

    const evidenceIds = caseEvidence.map((e) => e.id);
    let caseClaims: any[] = [];
    let caseVerification: any[] = [];
    let caseForensics: any[] = [];
    let caseDna: any[] = [];

    if (evidenceIds.length > 0) {
      caseClaims = await db.select().from(claims).where(inArray(claims.evidenceId, evidenceIds));
      const claimIds = caseClaims.map((c) => c.id);

      if (claimIds.length > 0) {
        caseVerification = await db
          .select()
          .from(verificationResults)
          .where(inArray(verificationResults.claimId, claimIds));
      }

      caseForensics = await db
        .select()
        .from(forensicResults)
        .where(inArray(forensicResults.evidenceId, evidenceIds));

      caseDna = await db
        .select()
        .from(documentFingerprints)
        .where(inArray(documentFingerprints.evidenceId, evidenceIds));
    }

    const [caseFindings, caseRels, caseRelated] = await Promise.all([
      db.select().from(investigatorFindings).where(eq(investigatorFindings.caseId, current.id)),
      db.select().from(entityRelationships).where(eq(entityRelationships.caseId, current.id)),
      db.select().from(relatedCases).where(eq(relatedCases.sourceCaseId, current.id)),
    ]);

    return {
      case: current,
      evidence: caseEvidence,
      timeline: caseTimeline,
      claims: caseClaims,
      verification: caseVerification,
      forensics: caseForensics,
      findings: caseFindings,
      dna: caseDna,
      relationships: caseRels,
      relatedCases: caseRelated,
    };
  }

  // Local DB
  const local = loadLocalData();
  const current = local.cases.find((c) => c.caseId === caseId);
  if (!current) return null;

  const caseEvidence = local.evidence.filter((e) => e.caseId === current.id);
  const caseTimeline = local.timelineEvents
    .filter((e) => e.caseId === current.id)
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());

  const evidenceIds = new Set(caseEvidence.map((e) => e.id));
  const caseClaims = local.claims.filter((c) => evidenceIds.has(c.evidenceId));
  const claimIds = new Set(caseClaims.map((c) => c.id));
  const caseVerification = local.verificationResults.filter((v) => claimIds.has(v.claimId));
  const caseForensics = local.forensicResults.filter((f) => evidenceIds.has(f.evidenceId));
  const caseDna = local.documentFingerprints.filter((d) => evidenceIds.has(d.evidenceId));
  const caseFindings = local.investigatorFindings.filter((f) => f.caseId === current.id);
  const caseRels = local.entityRelationships.filter((r) => r.caseId === current.id);
  const caseRelated = local.relatedCases.filter((r) => r.sourceCaseId === current.id);

  return {
    case: current,
    evidence: caseEvidence,
    timeline: caseTimeline,
    claims: caseClaims,
    verification: caseVerification,
    forensics: caseForensics,
    findings: caseFindings,
    dna: caseDna,
    relationships: caseRels,
    relatedCases: caseRelated,
    tamperingMap: local.tamperingMaps?.find((m: any) => m.caseId === current.id) || null,
    identityDna: local.identityDna?.find((d: any) => d.caseId === current.id) || null,
    crossSignals: local.contradictions?.find((c: any) => c.caseId === current.id) || null,
    riskBreakdown: local.riskBreakdowns?.find((r: any) => r.caseId === current.id) || null,
    decisionGuidance: local.decisionGuidance?.find((d: any) => d.caseId === current.id) || null,
    fraudPatterns: local.fraudPatterns?.filter((p: any) => p.caseId === current.id) || [],
    feedback: local.investigatorFeedback?.filter((f: any) => f.caseId === current.id) || [],
  };
}

export async function getCaseIntegrityAudit(caseId: string) {
  const bundle = await getCaseBundle(caseId);
  if (!bundle) return null;

  const evidenceChecks = bundle.evidence.map((item) => ({
    evidenceId: item.evidenceId,
    valid: verifyEvidenceIntegrity(item),
  }));
  const timelineValid = verifyTimelineChain(bundle.timeline);

  return {
    caseId,
    evidence: evidenceChecks,
    timelineValid,
    valid: evidenceChecks.every((item) => item.valid) && timelineValid,
    checkedAt: new Date(),
  };
}

export async function addCaseNote(input: { caseId: number; authorId?: number; note: string }) {
  const db = await getDb();
  if (db) {
    const result = await db.insert(caseNotes).values(input);
    return result[0].insertId;
  }
  const local = loadLocalData();
  const id = nextId("caseNotes");
  local.caseNotes.push({ id, ...input, createdAt: new Date().toISOString() });
  saveLocalData();
  return id;
}

export async function listSourceRegistry() {
  const db = await getDb();
  if (db) {
    return db.select().from(sourceRegistry).where(eq(sourceRegistry.active, 1));
  }
  const local = loadLocalData();
  return local.sourceRegistry.filter((s) => s.active === 1);
}

export async function addSourceRegistry(input: {
  organization: string;
  officialDomain: string;
  recruitmentPortal?: string;
  officialApi?: string;
  contactInfo?: Record<string, unknown>;
  knownPatterns?: string[];
}) {
  const db = await getDb();
  if (db) {
    const result = await db.insert(sourceRegistry).values({
      organization: input.organization,
      officialDomain: input.officialDomain,
      recruitmentPortal: input.recruitmentPortal,
      officialApi: input.officialApi,
      contactInfo: input.contactInfo,
      knownPatterns: input.knownPatterns,
      active: 1,
    });
    const created = await db.select().from(sourceRegistry).where(eq(sourceRegistry.id, result[0].insertId)).limit(1);
    return created[0];
  }
  const local = loadLocalData();
  const id = nextId("sourceRegistry");
  const now = new Date().toISOString();
  const newSource = {
    id,
    ...input,
    active: 1,
    updatedAt: now,
  };
  local.sourceRegistry.push(newSource);
  saveLocalData();
  return newSource;
}

export async function updateSourceRegistry(
  id: number,
  input: Partial<{
    organization: string;
    officialDomain: string;
    recruitmentPortal: string;
    officialApi: string;
    contactInfo: Record<string, unknown>;
    knownPatterns: string[];
    active: number;
  }>
) {
  const db = await getDb();
  if (db) {
    await db.update(sourceRegistry).set(input).where(eq(sourceRegistry.id, id));
    const updated = await db.select().from(sourceRegistry).where(eq(sourceRegistry.id, id)).limit(1);
    return updated[0];
  }
  const local = loadLocalData();
  const idx = local.sourceRegistry.findIndex((s) => s.id === id);
  if (idx >= 0) {
    local.sourceRegistry[idx] = {
      ...local.sourceRegistry[idx],
      ...input,
      updatedAt: new Date().toISOString(),
    };
    saveLocalData();
    return local.sourceRegistry[idx];
  }
  return null;
}

export async function saveOcrResult(input: {
  evidenceId: number;
  fullText: string;
  blocks?: unknown;
  tables?: unknown;
  headings?: unknown;
  averageConfidence: number;
}) {
  const db = await getDb();
  if (db) {
    const result = await db.insert(ocrResults).values(input);
    const created = await db.select().from(ocrResults).where(eq(ocrResults.id, result[0].insertId)).limit(1);
    return created[0];
  }
  const local = loadLocalData();
  const id = nextId("ocrResults");
  const newResult = { id, ...input, createdAt: new Date().toISOString() };
  local.ocrResults.push(newResult);
  saveLocalData();
  return newResult;
}

export async function saveClaims(
  claimsList: Array<{
    claimId: string;
    evidenceId: number;
    claimType: string;
    rawText: string;
    normalizedValue: string;
    sourceLocation?: unknown;
    ocrConfidence: number;
  }>
) {
  if (claimsList.length === 0) return [];
  const db = await getDb();
  if (db) {
    await db.insert(claims).values(claimsList);
    return db.select().from(claims).where(inArray(claims.claimId, claimsList.map((c) => c.claimId)));
  }
  const local = loadLocalData();
  const saved: any[] = [];
  for (const c of claimsList) {
    const id = nextId("claims");
    const item = { id, ...c, createdAt: new Date().toISOString() };
    local.claims.push(item);
    saved.push(item);
  }
  saveLocalData();
  return saved;
}

export async function saveVerificationResults(
  resultsList: Array<{
    claimId: number;
    status: "verified" | "contradicted" | "unverified" | "inconclusive" | "not_applicable";
    evidenceReference?: string;
    sourceUrl?: string;
    reason: string;
    confidence: number;
  }>
) {
  if (resultsList.length === 0) return [];
  const db = await getDb();
  if (db) {
    await db.insert(verificationResults).values(resultsList);
    return resultsList;
  }
  const local = loadLocalData();
  for (const r of resultsList) {
    const id = nextId("verificationResults");
    local.verificationResults.push({ id, ...r, checkedAt: new Date().toISOString() });
  }
  saveLocalData();
  return resultsList;
}

export async function saveForensicResults(
  resultsList: Array<{
    evidenceId: number;
    detector: string;
    finding: string;
    strength: "low" | "medium" | "high" | "not_available";
    confidence: number;
    reliability: "high" | "medium" | "low" | "inconclusive";
    limitations: string;
  }>
) {
  if (resultsList.length === 0) return [];
  const db = await getDb();
  if (db) {
    await db.insert(forensicResults).values(resultsList);
    return resultsList;
  }
  const local = loadLocalData();
  for (const f of resultsList) {
    const id = nextId("forensicResults");
    local.forensicResults.push({ id, ...f, createdAt: new Date().toISOString() });
  }
  saveLocalData();
  return resultsList;
}

export async function saveDocumentFingerprints(input: {
  evidenceId: number;
  fileDna: string;
  visualDna?: string;
  perceptualHash?: string;
  ocrTextDna?: string;
  layoutDna?: string;
  templateDna?: string;
  entityDna?: string;
}) {
  const db = await getDb();
  if (db) {
    const result = await db.insert(documentFingerprints).values(input);
    const created = await db.select().from(documentFingerprints).where(eq(documentFingerprints.id, result[0].insertId)).limit(1);
    return created[0];
  }
  const local = loadLocalData();
  const id = nextId("documentFingerprints");
  const item = { id, ...input, createdAt: new Date().toISOString() };
  local.documentFingerprints.push(item);
  saveLocalData();
  return item;
}

export async function listAllFingerprints() {
  const db = await getDb();
  if (db) {
    return db.select().from(documentFingerprints);
  }
  const local = loadLocalData();
  return local.documentFingerprints;
}

export async function saveRelatedCases(
  matches: Array<{
    sourceCaseId: number;
    relatedCaseId: number;
    similarityType: string;
    similarityScore: number;
    evidenceReference?: string;
  }>
) {
  if (matches.length === 0) return [];
  const db = await getDb();
  if (db) {
    await db.insert(relatedCases).values(matches);
    return matches;
  }
  const local = loadLocalData();
  for (const m of matches) {
    const id = nextId("relatedCases");
    local.relatedCases.push({ id, ...m, createdAt: new Date().toISOString() });
  }
  saveLocalData();
  return matches;
}

export async function saveEntitiesAndRelationships(
  caseId: number,
  extractedEntities: Array<{ entityType: string; normalizedValue: string; displayValue: string; strength?: "low" | "medium" | "high" | "inconclusive"; evidenceReference?: string }>
) {
  const local = loadLocalData();
  const db = await getDb();

  const savedRels: any[] = [];

  for (const ent of extractedEntities) {
    let entityRecord: any = null;

    if (db) {
      const existing = await db.select().from(entities).where(eq(entities.normalizedValue, ent.normalizedValue)).limit(1);
      if (existing[0]) {
        entityRecord = existing[0];
      } else {
        const res = await db.insert(entities).values({
          entityType: ent.entityType,
          normalizedValue: ent.normalizedValue,
          displayValue: ent.displayValue,
        });
        const created = await db.select().from(entities).where(eq(entities.id, res[0].insertId)).limit(1);
        entityRecord = created[0];
      }

      // Check recurring cases
      const otherRels = await db.select().from(entityRelationships).where(eq(entityRelationships.entityId, entityRecord.id));
      const isRecurring = otherRels.length > 0;
      const relationshipType = isRecurring ? "RECURRING ENTITY" : "ASSOCIATED ENTITY";

      const relRes = await db.insert(entityRelationships).values({
        caseId,
        entityId: entityRecord.id,
        relationshipType,
        evidenceReference: ent.evidenceReference,
        strength: ent.strength ?? "medium",
      });
      savedRels.push({ caseId, entityId: entityRecord.id, relationshipType });
    } else {
      let existing = local.entities.find((e) => e.normalizedValue === ent.normalizedValue);
      if (!existing) {
        existing = {
          id: nextId("entities"),
          entityType: ent.entityType,
          normalizedValue: ent.normalizedValue,
          displayValue: ent.displayValue,
          createdAt: new Date().toISOString(),
        };
        local.entities.push(existing);
      }
      entityRecord = existing;

      const otherRels = local.entityRelationships.filter((r) => r.entityId === entityRecord.id && r.caseId !== caseId);
      const isRecurring = otherRels.length > 0;
      const relationshipType = isRecurring ? "RECURRING ENTITY" : "ASSOCIATED ENTITY";

      const rel = {
        id: nextId("entityRelationships"),
        caseId,
        entityId: entityRecord.id,
        relationshipType,
        evidenceReference: ent.evidenceReference ?? null,
        strength: ent.strength ?? "medium",
        createdAt: new Date().toISOString(),
      };
      local.entityRelationships.push(rel);
      savedRels.push(rel);
    }
  }

  if (!db) saveLocalData();
  return savedRels;
}

export async function saveInvestigatorFindings(input: {
  caseId: number;
  summary: string;
  evidenceReferences?: unknown;
  limitations: string;
  recommendedAction: string;
}) {
  const db = await getDb();
  if (db) {
    const result = await db.insert(investigatorFindings).values(input);
    const created = await db.select().from(investigatorFindings).where(eq(investigatorFindings.id, result[0].insertId)).limit(1);
    return created[0];
  }
  const local = loadLocalData();
  const id = nextId("investigatorFindings");
  const item = { id, ...input, createdAt: new Date().toISOString() };
  local.investigatorFindings.push(item);
  saveLocalData();
  return item;
}

export async function updateCaseRiskAndStatus(
  caseId: number,
  data: {
    riskLevel: Case["riskLevel"];
    riskScore: number;
    confidence: number;
    completeness: number;
    status?: Case["status"];
  }
) {
  const db = await getDb();
  if (db) {
    await db.update(cases).set({ ...data, updatedAt: new Date() }).where(eq(cases.id, caseId));
    return;
  }
  const local = loadLocalData();
  const c = local.cases.find((item) => item.id === caseId);
  if (c) {
    Object.assign(c, data, { updatedAt: new Date().toISOString() });
    saveLocalData();
  }
}

export async function updateEvidenceQuality(
  evidenceId: number,
  data: {
    quality?: Evidence["quality"];
    ocrReliability?: Evidence["ocrReliability"];
    forensicReliability?: Evidence["forensicReliability"];
  }
) {
  const db = await getDb();
  if (db) {
    await db.update(evidence).set(data).where(eq(evidence.id, evidenceId));
    return;
  }
  const local = loadLocalData();
  const ev = local.evidence.find((e) => e.id === evidenceId);
  if (ev) {
    Object.assign(ev, data);
    saveLocalData();
  }
}

export async function getCaseEntitiesGraph(caseId: number) {
  const local = loadLocalData();
  const db = await getDb();

  let caseRels: any[] = [];
  let allEntities: any[] = [];

  if (db) {
    caseRels = await db.select().from(entityRelationships).where(eq(entityRelationships.caseId, caseId));
    const entIds = caseRels.map((r) => r.entityId);
    if (entIds.length > 0) {
      allEntities = await db.select().from(entities).where(inArray(entities.id, entIds));
    }
  } else {
    caseRels = local.entityRelationships.filter((r) => r.caseId === caseId);
    const entIds = new Set(caseRels.map((r) => r.entityId));
    allEntities = local.entities.filter((e) => entIds.has(e.id));
  }

  const nodes = allEntities.map((ent) => {
    // Count how many cases this entity appears in
    const totalOccurrences = local.entityRelationships.filter((r) => r.entityId === ent.id).length;
    return {
      id: `entity-${ent.id}`,
      label: ent.displayValue,
      type: ent.entityType,
      normalized: ent.normalizedValue,
      occurrences: Math.max(1, totalOccurrences),
      recurring: totalOccurrences > 1,
    };
  });

  const edges = caseRels.map((rel) => ({
    from: `case-${caseId}`,
    to: `entity-${rel.entityId}`,
    relationship: rel.relationshipType,
    strength: rel.strength,
  }));

  return { nodes, edges };
}

export async function saveTamperingMap(caseId: number, evidenceId: number, data: any) {
  const local = loadLocalData();
  local.tamperingMaps = (local.tamperingMaps || []).filter((m: any) => m.caseId !== caseId);
  local.tamperingMaps.push({ caseId, evidenceId, ...data, savedAt: new Date().toISOString() });
  saveLocalData();
}

export async function saveIdentityDna(caseId: number, data: any) {
  const local = loadLocalData();
  local.identityDna = (local.identityDna || []).filter((d: any) => d.caseId !== caseId);
  local.identityDna.push({ caseId, ...data, savedAt: new Date().toISOString() });
  saveLocalData();
}

export async function saveContradictions(caseId: number, data: any) {
  const local = loadLocalData();
  local.contradictions = (local.contradictions || []).filter((c: any) => c.caseId !== caseId);
  local.contradictions.push({ caseId, ...data, savedAt: new Date().toISOString() });
  saveLocalData();
}

export async function saveRiskBreakdown(caseId: number, data: any) {
  const local = loadLocalData();
  local.riskBreakdowns = (local.riskBreakdowns || []).filter((r: any) => r.caseId !== caseId);
  local.riskBreakdowns.push({ caseId, ...data, savedAt: new Date().toISOString() });
  saveLocalData();
}

export async function saveDecisionGuidance(caseId: number, data: any) {
  const local = loadLocalData();
  local.decisionGuidance = (local.decisionGuidance || []).filter((d: any) => d.caseId !== caseId);
  local.decisionGuidance.push({ caseId, ...data, savedAt: new Date().toISOString() });
  saveLocalData();
}

export async function saveFraudPatterns(caseId: number, patterns: any[]) {
  const local = loadLocalData();
  local.fraudPatterns = (local.fraudPatterns || []).filter((p: any) => p.caseId !== caseId);
  local.fraudPatterns.push(...patterns.map((p) => ({ caseId, ...p, savedAt: new Date().toISOString() })));
  saveLocalData();
}

export async function addInvestigatorFeedback(data: { caseId: number; tag: string; comment: string; findingId?: string }) {
  const local = loadLocalData();
  const id = nextId("investigatorFindings");
  local.investigatorFeedback = local.investigatorFeedback || [];
  local.investigatorFeedback.push({ id, ...data, createdAt: new Date().toISOString() });
  saveLocalData();
  return id;
}

