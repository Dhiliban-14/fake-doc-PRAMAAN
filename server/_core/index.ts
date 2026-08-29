import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import express from "express";
import { createServer } from "http";
import net from "net";
import { eq } from "drizzle-orm";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { registerSwagger } from "../swagger";
import { getDb } from "../db";
import { evidenceBlobs } from "../../drizzle/schema";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Enable CORS for cross-origin requests (e.g. Vercel frontend calling Render backend)
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      res.header("Access-Control-Allow-Origin", origin);
    } else {
      res.header("Access-Control-Allow-Origin", "*");
    }
    res.header("Access-Control-Allow-Credentials", "true");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, x-trpc-source");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  // Static uploads with auto-restore from TiDB Cloud Storage
  app.use("/uploads", async (req, res, next) => {
    const relKey = req.path.replace(/^\/+/, "");
    const localPath = path.resolve(process.cwd(), "uploads", relKey);

    if (fs.existsSync(localPath)) {
      return res.sendFile(localPath);
    }

    try {
      const db = await getDb();
      if (db) {
        const rows = await db
          .select()
          .from(evidenceBlobs)
          .where(eq(evidenceBlobs.storageKey, relKey))
          .limit(1);

        if (rows.length > 0) {
          const blob = rows[0];
          const buffer = Buffer.from(blob.fileData, "base64");
          fs.mkdirSync(path.dirname(localPath), { recursive: true });
          fs.writeFileSync(localPath, buffer);
          res.type(blob.mimeType);
          return res.send(buffer);
        }
      }
    } catch (e) {
      console.warn("[Uploads] TiDB restore error:", e);
    }

    next();
  });
  app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads")));
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  registerSwagger(app);
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
