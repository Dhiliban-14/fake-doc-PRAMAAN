import type { Express, Request, Response } from "express";
import {
  listCases,
  getCaseBundle,
  createCaseRecord,
  getCaseIntegrityAudit,
  listSourceRegistry,
  getCaseEntitiesGraph,
  addEvidenceRecord,
} from "./db";
import { generateLivenessChallenges, evaluateLivenessResponse } from "./services/livenessService";
import { compareDocumentVersions } from "./services/evolutionTracker";
import { runAnalysisJob } from "./pipeline/analysisPipeline";
import { storagePut } from "./storage";
import { getLocalEvidencePath } from "./storage.local";
import { safeEvidenceName, sha256Hex, validateEvidenceBytes } from "./evidence.helpers";

export const openApiSpec = {
  openapi: "3.0.0",
  info: {
    title: "PRAMAAN Forensics & Fraud Intelligence API",
    version: "1.0.0",
    description:
      "Production-grade REST and tRPC API for AI-powered document forensics, Error Level Analysis (ELA), cross-signal consistency verification, identity DNA blind indexing, and explainable fraud intelligence.",
    contact: {
      name: "PRAMAAN Digital Forensics Engineering",
      url: "https://github.com/Dhiliban-14/fake-doc-PRAMAAN",
    },
  },
  servers: [
    {
      url: "/",
      description: "Current Host",
    },
  ],
  paths: {
    "/api/v1/cases": {
      get: {
        summary: "List all forensic cases",
        description: "Returns a list of all active investigations, their overall fraud risk assessment, and completion status.",
        responses: {
          200: {
            description: "Array of forensic cases",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "integer", example: 1 },
                      caseId: { type: "string", example: "PRM-2026-000142" },
                      title: { type: "string", example: "Ministry Recruitment Circular" },
                      riskLevel: { type: "string", example: "high" },
                      status: { type: "string", example: "under_review" },
                      createdAt: { type: "string", example: "2026-08-29T10:00:00Z" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        summary: "Create a new investigation case",
        description: "Creates an empty case dossier ready for evidence ingestion.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["title"],
                properties: {
                  title: { type: "string", example: "Cabinet Secretariat Circular 2026" },
                  description: { type: "string", example: "Suspected fake recruitment order received via messaging channel." },
                },
              },
            },
          },
        },
        responses: {
          201: { description: "Case created successfully" },
        },
      },
    },
    "/api/v1/cases/{caseId}": {
      get: {
        summary: "Retrieve complete forensic case bundle",
        description: "Returns all forensic findings: OCR claims, tampering maps, ELA heatmap paths, Identity DNA, cross-signal contradictions, 10-component risk breakdown, and decision guidance.",
        parameters: [
          {
            name: "caseId",
            in: "path",
            required: true,
            schema: { type: "string", example: "PRM-2026-000142" },
          },
        ],
        responses: {
          200: { description: "Full case bundle with deep forensic findings" },
          404: { description: "Case not found" },
        },
      },
    },
    "/api/v1/cases/{caseId}/audit": {
      get: {
        summary: "Verify cryptographic evidence audit trail",
        description: "Audits the SHA-256 integrity of all stored evidence files and checks the hash-chained timeline event sequence.",
        parameters: [
          {
            name: "caseId",
            in: "path",
            required: true,
            schema: { type: "string", example: "PRM-2026-000142" },
          },
        ],
        responses: {
          200: { description: "Cryptographic validation verdict (VALID or CHECK FAILED)" },
        },
      },
    },
    "/api/v1/cases/ingest": {
      post: {
        summary: "Ingest and analyze document evidence",
        description: "Uploads an evidence file (base64 encoded), anchors its SHA-256 digest immutably, and executes the 12-stage analysis pipeline.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["caseId", "originalName", "mimeType", "fileBase64"],
                properties: {
                  caseId: { type: "integer", example: 1 },
                  originalName: { type: "string", example: "recruitment_notice.pdf" },
                  mimeType: { type: "string", example: "application/pdf" },
                  fileBase64: { type: "string", description: "Raw document bytes encoded as base64" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Evidence anchored and analysis completed" },
        },
      },
    },
    "/api/v1/liveness/challenges": {
      get: {
        summary: "Generate active optical liveness challenges",
        description: "Returns randomized optical instructions (head turn left/right, blink twice, smile) to prevent spoofing with static documents or replay attacks.",
        responses: {
          200: {
            description: "List of active challenges",
          },
        },
      },
    },
    "/api/v1/liveness/evaluate": {
      post: {
        summary: "Evaluate video frames for presentation spoofing",
        description: "Calculates motion variance, luminance consistency, and face presentation to classify whether the user is a live person or presenting a static printout.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["framesCount", "faceDetected", "movementVariance", "averageBrightness"],
                properties: {
                  framesCount: { type: "integer", example: 24 },
                  faceDetected: { type: "boolean", example: true },
                  movementVariance: { type: "number", example: 0.045 },
                  averageBrightness: { type: "number", example: 135 },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Anti-spoof verdict (LIVE_PERSON, STATIC_PRINT, or SCREEN_REPLAY)" },
        },
      },
    },
    "/api/v1/registry": {
      get: {
        summary: "List registered authoritative sources",
        description: "Returns health, domain status, and trust ratings for official national registries (.gov.in, .nic.in).",
        responses: {
          200: { description: "List of official sources" },
        },
      },
    },
    "/api/v1/evolution/compare": {
      post: {
        summary: "Compare two document revisions",
        description: "Reconstructs document evolution across versions by diffing extracted claims, visual hashes, and tampering introductions.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["versionA", "versionB"],
                properties: {
                  versionA: { type: "object" },
                  versionB: { type: "object" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Evolution diff analysis" },
        },
      },
    },
  },
};

export function registerSwagger(app: Express) {
  // Serve raw OpenAPI JSON
  app.get("/openapi.json", (_req: Request, res: Response) => {
    res.json(openApiSpec);
  });

  // Serve interactive Swagger UI HTML page
  app.get(["/docs", "/swagger"], (_req: Request, res: Response) => {
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PRAMAAN Forensics API · Swagger UI</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui.min.css" />
  <link rel="icon" type="image/png" href="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/favicon-32x32.png" />
  <style>
    body { margin: 0; background: #0f1117; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    .header-banner { background: #17191d; color: #fff; padding: 16px 28px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #282c38; }
    .header-banner h1 { margin: 0; font-size: 19px; font-weight: 800; letter-spacing: 0.1em; }
    .header-banner p { margin: 4px 0 0; color: #8c95a6; font-size: 11px; }
    .header-banner a { display: inline-flex; align-items: center; gap: 6px; padding: 7px 14px; background: #262c3b; color: #d0d7e5; border-radius: 7px; text-decoration: none; font-size: 11px; font-weight: 700; }
    .header-banner a:hover { background: #353d50; color: #fff; }
    .swagger-ui .topbar { display: none !important; }
    .swagger-ui { background: #fff; padding: 18px 24px 60px; min-height: 85vh; }
  </style>
</head>
<body>
  <div class="header-banner">
    <div>
      <h1>PRAMAAN FORENSICS API CONSOLE</h1>
      <p>Interactive OpenAPI 3.0 Testing Workbench · VERITAS-ID Engine</p>
    </div>
    <a href="/" target="_blank">← Open Investigator App</a>
  </div>
  <div id="swagger-ui"></div>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui-bundle.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = () => {
      SwaggerUIBundle({
        url: '/openapi.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        layout: "BaseLayout"
      });
    };
  </script>
</body>
</html>`);
  });

  // REST API Endpoints for Swagger "Try it out"
  app.get("/api/v1/cases", async (_req: Request, res: Response) => {
    try {
      const cases = await listCases();
      res.json(cases);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/v1/cases", async (req: Request, res: Response) => {
    try {
      const { title } = req.body;
      const created = await createCaseRecord({ title, ownerId: 1 });
      res.status(201).json(created);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/v1/cases/:caseId", async (req: Request, res: Response) => {
    try {
      const bundle = await getCaseBundle(req.params.caseId);
      if (!bundle || !bundle.case) {
        return res.status(404).json({ error: "Case not found" });
      }
      res.json(bundle);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/v1/cases/:caseId/audit", async (req: Request, res: Response) => {
    try {
      const bundle = await getCaseBundle(req.params.caseId);
      if (!bundle || !bundle.case) {
        return res.status(404).json({ error: "Case not found" });
      }
      const audit = await getCaseIntegrityAudit(bundle.case.id);
      res.json(audit);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/v1/cases/ingest", async (req: Request, res: Response) => {
    try {
      const { caseId, originalName, mimeType, fileBase64 } = req.body;
      const buffer = Buffer.from(fileBase64, "base64");
      validateEvidenceBytes(buffer);
      const cleanName = safeEvidenceName(originalName);
      const sha256 = sha256Hex(buffer);
      const storageKey = `evidence/${caseId}/${Date.now()}-${cleanName}`;
      const stored = await storagePut(storageKey, buffer, mimeType);

      const item = await addEvidenceRecord({
        caseId: Number(caseId),
        originalName: cleanName,
        storageKey: stored.key,
        mimeType,
        sha256,
        fileSize: buffer.length,
      });

      if (item) {
        const localPath = getLocalEvidencePath(stored.key);
        if (localPath) {
          void runAnalysisJob({
            caseId: Number(caseId),
            evidenceId: item.id,
            evidenceRecordId: item.evidenceId,
            filePath: localPath,
            mimeType,
            originalName: cleanName,
          });
        }
      }

      res.json({
        success: true,
        message: "Evidence ingested and queued for 12-stage forensic analysis",
        sha256,
        evidenceId: item?.evidenceId,
        storageKey: stored.key,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/v1/registry", async (_req: Request, res: Response) => {
    try {
      const sources = await listSourceRegistry();
      res.json(sources);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/v1/liveness/challenges", (_req: Request, res: Response) => {
    const challenges = generateLivenessChallenges();
    res.json(challenges);
  });

  app.post("/api/v1/liveness/evaluate", (req: Request, res: Response) => {
    try {
      const verdict = evaluateLivenessResponse(req.body);
      res.json(verdict);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/v1/evolution/compare", (req: Request, res: Response) => {
    try {
      const { versionA, versionB } = req.body;
      const diff = compareDocumentVersions(versionA, versionB);
      res.json(diff);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
}
