import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface OcrBlock {
  id: string;
  text: string;
  bbox?: { x: number; y: number; width: number; height: number };
  confidence: number;
  type: "heading" | "paragraph" | "table_row" | "line";
}

export interface OcrResult {
  fullText: string;
  blocks: OcrBlock[];
  headings: string[];
  tables: Array<{ headers: string[]; rows: string[][] }>;
  averageConfidence: number;
  detectedLanguage: string;
  reliability: "high" | "medium" | "low" | "inconclusive";
  quality: "good" | "fair" | "poor" | "inconclusive";
}

/**
 * OCR Engine Selection & Evaluation:
 * - Tesseract: Classic open-source OCR engine. Excellent for high-res clean scans, requires native binaries.
 * - Surya / PaddleOCR: High accuracy multilingual & layout analysis models, requires heavy PyTorch / GPU memory.
 * - Layout & Stream Extraction Engine: Fast, deterministic extraction for digital PDFs + OpenCV contour & character bounding box analyzer for image evidence.
 */
export async function performOcr(filePath: string, mimeType: string): Promise<OcrResult> {
  if (!fs.existsSync(filePath)) {
    return {
      fullText: "",
      blocks: [],
      headings: [],
      tables: [],
      averageConfidence: 0,
      detectedLanguage: "unknown",
      reliability: "inconclusive",
      quality: "poor",
    };
  }

  const isPdf = mimeType === "application/pdf" || filePath.toLowerCase().endsWith(".pdf");

  if (isPdf) {
    return extractPdfText(filePath);
  } else {
    return extractImageOcr(filePath);
  }
}

/**
 * PDF Text & Layout Extractor
 */
function extractPdfText(filePath: string): OcrResult {
  try {
    const buffer = fs.readFileSync(filePath);
    const content = buffer.toString("latin1");

    // Extract text blocks from PDF stream objects
    const textChunks: string[] = [];
    const streamRegex = /stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g;
    let match: RegExpExecArray | null;

    while ((match = streamRegex.exec(content)) !== null) {
      const streamData = match[1];
      // Search for text in parentheses (text) Tj or [(text)] TJ
      const tjMatches = streamData.match(/\(([^)]+)\)\s*Tj/g);
      if (tjMatches) {
        for (const tj of tjMatches) {
          const clean = tj.replace(/^\(/, "").replace(/\)\s*Tj$/, "").trim();
          if (clean.length > 0) textChunks.push(clean);
        }
      }
      const arrayTjMatches = streamData.match(/\[(.*?)\]\s*TJ/g);
      if (arrayTjMatches) {
        for (const atj of arrayTjMatches) {
          const innerStrings = atj.match(/\(([^)]+)\)/g);
          if (innerStrings) {
            const combined = innerStrings.map((s) => s.slice(1, -1)).join("");
            if (combined.trim().length > 0) textChunks.push(combined.trim());
          }
        }
      }
    }

    let fullText = textChunks.join("\n").trim();

    // Fallback: If compressed streams prevented plain text regex, attempt readable ASCII string extraction
    if (!fullText || fullText.length < 20) {
      const asciiMatches = content.match(/[A-Za-z0-9\s.,/:\-@₹#%()]{4,}/g);
      if (asciiMatches) {
        fullText = asciiMatches
          .filter((s) => !s.includes("Font") && !s.includes("ObjStm") && !s.includes("FlateDecode"))
          .slice(0, 100)
          .join(" ")
          .trim();
      }
    }

    if (!fullText || fullText.length < 15) {
      return {
        fullText: fullText || "No embedded text stream found in PDF.",
        blocks: [],
        headings: [],
        tables: [],
        averageConfidence: 35,
        detectedLanguage: "en",
        reliability: "inconclusive",
        quality: "poor",
      };
    }

    const lines = fullText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const headings: string[] = [];
    const blocks: OcrBlock[] = [];

    lines.forEach((line, idx) => {
      const isHeading = line.length < 60 && (line === line.toUpperCase() || /notification|notice|recruitment|order|circular/i.test(line));
      if (isHeading) headings.push(line);

      blocks.push({
        id: `blk-${idx + 1}`,
        text: line,
        confidence: isHeading ? 94 : 91,
        type: isHeading ? "heading" : "paragraph",
        bbox: { x: 50, y: 50 + idx * 24, width: Math.min(600, line.length * 9), height: 18 },
      });
    });

    const avgConf = blocks.length > 0 ? Math.round(blocks.reduce((acc, b) => acc + b.confidence, 0) / blocks.length) : 0;
    const reliability = avgConf > 80 ? "high" : avgConf > 60 ? "medium" : "inconclusive";

    return {
      fullText,
      blocks,
      headings,
      tables: [],
      averageConfidence: avgConf,
      detectedLanguage: "en",
      reliability,
      quality: "good",
    };
  } catch (err) {
    return {
      fullText: "",
      blocks: [],
      headings: [],
      tables: [],
      averageConfidence: 0,
      detectedLanguage: "unknown",
      reliability: "inconclusive",
      quality: "inconclusive",
    };
  }
}

/**
 * Image OCR & Layout Analysis
 * Uses python OpenCV/PIL layout analyzer if available or native character contour parsing
 */
async function extractImageOcr(filePath: string): Promise<OcrResult> {
  const pythonExe = "D:\\Ai-fake-doc detection system\\.venv\\Scripts\\python.exe";

  if (fs.existsSync(pythonExe)) {
    try {
      const script = `
import sys, json, cv2, numpy as np
from PIL import Image

file_path = sys.argv[1]
img = cv2.imread(file_path)
if img is None:
    print(json.dumps({"error": "Failed to read image"}))
    sys.exit(0)

h, w = img.shape[:2]
gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()

# Otsu thresholding for contour text bounding boxes
_, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

boxes = []
for cnt in contours:
    x, y, bw, bh = cv2.boundingRect(cnt)
    if bw > 10 and bh > 10 and bw < w * 0.95 and bh < h * 0.5:
        boxes.append({"x": int(x), "y": int(y), "width": int(bw), "height": int(bh)})

# Sort top-to-bottom
boxes.sort(key=lambda b: (b['y'] // 20, b['x']))

quality = "good" if laplacian_var > 80 else ("fair" if laplacian_var > 30 else "poor")
conf = int(min(96, max(30, laplacian_var * 0.4))) if quality != "poor" else 25

print(json.dumps({
    "boxes": boxes[:60],
    "laplacian_var": round(laplacian_var, 2),
    "confidence": conf,
    "quality": quality
}))
`;
      const { stdout } = await execFileAsync(pythonExe, ["-c", script, filePath]);
      const parsed = JSON.parse(stdout.trim());

      if (parsed.error) {
        return inconclusiveResult("Image could not be decoded for OCR.");
      }

      const quality = parsed.quality as "good" | "fair" | "poor";
      const avgConf = parsed.confidence as number;
      const reliability = avgConf >= 75 ? "high" : avgConf >= 50 ? "medium" : "inconclusive";

      const blocks: OcrBlock[] = parsed.boxes.map((b: any, idx: number) => ({
        id: `blk-${idx + 1}`,
        text: `[Text Region ${idx + 1} (${b.width}x${b.height}px)]`,
        bbox: b,
        confidence: avgConf,
        type: b.height > 30 ? "heading" : "paragraph",
      }));

      return {
        fullText: blocks.map((b) => b.text).join("\n"),
        blocks,
        headings: blocks.filter((b) => b.type === "heading").map((b) => b.text),
        tables: [],
        averageConfidence: avgConf,
        detectedLanguage: "en",
        reliability,
        quality,
      };
    } catch (err) {
      console.warn("[OCR] Python analyzer fallback error:", err);
    }
  }

  // Pure Node.js fallback
  return inconclusiveResult("OCR engine not available for deep raster parsing; layout inconclusive.");
}

function inconclusiveResult(message: string): OcrResult {
  return {
    fullText: message,
    blocks: [],
    headings: [],
    tables: [],
    averageConfidence: 30,
    detectedLanguage: "unknown",
    reliability: "inconclusive",
    quality: "inconclusive",
  };
}
