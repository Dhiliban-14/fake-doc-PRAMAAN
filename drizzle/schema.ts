import { int, json, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const cases = mysqlTable("cases", {
  id: int("id").autoincrement().primaryKey(),
  caseId: varchar("caseId", { length: 32 }).notNull().unique(),
  title: varchar("title", { length: 255 }).notNull(),
  status: mysqlEnum("status", ["open", "in_review", "closed"]).default("open").notNull(),
  riskLevel: mysqlEnum("riskLevel", ["low", "medium", "high", "inconclusive"]).default("inconclusive").notNull(),
  riskScore: int("riskScore").default(0).notNull(),
  confidence: int("confidence").default(0).notNull(),
  completeness: int("completeness").default(0).notNull(),
  ownerId: int("ownerId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const evidence = mysqlTable("evidence", {
  id: int("id").autoincrement().primaryKey(),
  evidenceId: varchar("evidenceId", { length: 32 }).notNull().unique(),
  caseId: int("caseId").notNull(),
  originalName: varchar("originalName", { length: 255 }).notNull(),
  storageKey: varchar("storageKey", { length: 512 }).notNull(),
  mimeType: varchar("mimeType", { length: 128 }).notNull(),
  sha256: varchar("sha256", { length: 64 }).notNull(),
  recordHash: varchar("recordHash", { length: 64 }).notNull(),
  fileSize: int("fileSize").notNull(),
  width: int("width"),
  height: int("height"),
  pageCount: int("pageCount"),
  quality: mysqlEnum("quality", ["good", "fair", "poor", "inconclusive"]).default("inconclusive").notNull(),
  ocrReliability: mysqlEnum("ocrReliability", ["high", "medium", "low", "inconclusive"]).default("inconclusive").notNull(),
  forensicReliability: mysqlEnum("forensicReliability", ["high", "medium", "low", "inconclusive"]).default("inconclusive").notNull(),
  uploadedAt: timestamp("uploadedAt").defaultNow().notNull(),
  immutableAt: timestamp("immutableAt").defaultNow().notNull(),
});

export const ocrResults = mysqlTable("ocrResults", {
  id: int("id").autoincrement().primaryKey(),
  evidenceId: int("evidenceId").notNull(),
  fullText: text("fullText").notNull(),
  blocks: json("blocks"),
  tables: json("tables"),
  headings: json("headings"),
  averageConfidence: int("averageConfidence").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const claims = mysqlTable("claims", {
  id: int("id").autoincrement().primaryKey(),
  claimId: varchar("claimId", { length: 32 }).notNull().unique(),
  evidenceId: int("evidenceId").notNull(),
  claimType: varchar("claimType", { length: 80 }).notNull(),
  rawText: text("rawText").notNull(),
  normalizedValue: text("normalizedValue").notNull(),
  sourceLocation: json("sourceLocation"),
  ocrConfidence: int("ocrConfidence").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const sourceRegistry = mysqlTable("sourceRegistry", {
  id: int("id").autoincrement().primaryKey(),
  organization: varchar("organization", { length: 255 }).notNull(),
  officialDomain: varchar("officialDomain", { length: 255 }).notNull(),
  recruitmentPortal: varchar("recruitmentPortal", { length: 255 }),
  officialApi: varchar("officialApi", { length: 512 }),
  contactInfo: json("contactInfo"),
  knownPatterns: json("knownPatterns"),
  active: int("active").default(1).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const verificationResults = mysqlTable("verificationResults", {
  id: int("id").autoincrement().primaryKey(),
  claimId: int("claimId").notNull(),
  status: mysqlEnum("status", ["verified", "contradicted", "unverified", "inconclusive", "not_applicable"]).notNull(),
  evidenceReference: text("evidenceReference"),
  sourceUrl: varchar("sourceUrl", { length: 512 }),
  reason: text("reason").notNull(),
  confidence: int("confidence").default(0).notNull(),
  checkedAt: timestamp("checkedAt").defaultNow().notNull(),
});

export const forensicResults = mysqlTable("forensicResults", {
  id: int("id").autoincrement().primaryKey(),
  evidenceId: int("evidenceId").notNull(),
  detector: varchar("detector", { length: 100 }).notNull(),
  finding: text("finding").notNull(),
  strength: mysqlEnum("strength", ["low", "medium", "high", "not_available"]).notNull(),
  confidence: int("confidence").default(0).notNull(),
  reliability: mysqlEnum("reliability", ["high", "medium", "low", "inconclusive"]).notNull(),
  limitations: text("limitations").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const entities = mysqlTable("entities", {
  id: int("id").autoincrement().primaryKey(),
  entityType: varchar("entityType", { length: 80 }).notNull(),
  normalizedValue: varchar("normalizedValue", { length: 512 }).notNull(),
  displayValue: varchar("displayValue", { length: 512 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const entityRelationships = mysqlTable("entityRelationships", {
  id: int("id").autoincrement().primaryKey(),
  caseId: int("caseId").notNull(),
  entityId: int("entityId").notNull(),
  relationshipType: varchar("relationshipType", { length: 100 }).notNull(),
  evidenceReference: varchar("evidenceReference", { length: 64 }),
  strength: mysqlEnum("strength", ["low", "medium", "high", "inconclusive"]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const documentFingerprints = mysqlTable("documentFingerprints", {
  id: int("id").autoincrement().primaryKey(),
  evidenceId: int("evidenceId").notNull(),
  fileDna: varchar("fileDna", { length: 128 }).notNull(),
  visualDna: varchar("visualDna", { length: 128 }),
  perceptualHash: varchar("perceptualHash", { length: 128 }),
  ocrTextDna: varchar("ocrTextDna", { length: 128 }),
  layoutDna: varchar("layoutDna", { length: 128 }),
  templateDna: varchar("templateDna", { length: 128 }),
  entityDna: varchar("entityDna", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const relatedCases = mysqlTable("relatedCases", {
  id: int("id").autoincrement().primaryKey(),
  sourceCaseId: int("sourceCaseId").notNull(),
  relatedCaseId: int("relatedCaseId").notNull(),
  similarityType: varchar("similarityType", { length: 100 }).notNull(),
  similarityScore: int("similarityScore").notNull(),
  evidenceReference: varchar("evidenceReference", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const timelineEvents = mysqlTable("timelineEvents", {
  id: int("id").autoincrement().primaryKey(),
  caseId: int("caseId").notNull(),
  eventType: varchar("eventType", { length: 100 }).notNull(),
  detail: text("detail").notNull(),
  evidenceReference: varchar("evidenceReference", { length: 64 }),
  previousHash: varchar("previousHash", { length: 64 }),
  recordHash: varchar("recordHash", { length: 64 }).notNull(),
  occurredAt: timestamp("occurredAt").defaultNow().notNull(),
  immutableAt: timestamp("immutableAt").defaultNow().notNull(),
});

export const investigatorFindings = mysqlTable("investigatorFindings", {
  id: int("id").autoincrement().primaryKey(),
  caseId: int("caseId").notNull(),
  summary: text("summary").notNull(),
  evidenceReferences: json("evidenceReferences"),
  limitations: text("limitations").notNull(),
  recommendedAction: text("recommendedAction").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const caseNotes = mysqlTable("caseNotes", {
  id: int("id").autoincrement().primaryKey(),
  caseId: int("caseId").notNull(),
  authorId: int("authorId"),
  note: text("note").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const reports = mysqlTable("reports", {
  id: int("id").autoincrement().primaryKey(),
  caseId: int("caseId").notNull(),
  reportKey: varchar("reportKey", { length: 512 }),
  format: varchar("format", { length: 20 }).default("pdf").notNull(),
  generatedAt: timestamp("generatedAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Case = typeof cases.$inferSelect;
export type Evidence = typeof evidence.$inferSelect;
