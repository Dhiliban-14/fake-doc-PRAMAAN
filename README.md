# PRAMAAN — AI Document Forensics & Identity Fraud Intelligence Platform (VERITAS-ID)

[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://reactjs.org/)
[![Express](https://img.shields.io/badge/Express-4.21-green.svg)](https://expressjs.com/)
[![tRPC](https://img.shields.io/badge/tRPC-11.6-blueviolet.svg)](https://trpc.io/)
[![OpenCV](https://img.shields.io/badge/OpenCV-5.0-red.svg)](https://opencv.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **"Don't trust the document. Verify the claims."**  
> An investigator-grade forensic intelligence workstation for detecting document tampering, validating credentials against official gazettes, identifying fraud rings, and synthesizing evidence-backed decisions.

---

## 🔍 Overview

**PRAMAAN** moves beyond simple OCR or classification by decomposing official documents into verifiable claims and correlating evidence across multiple independent signals:
1. **Multi-Scale Spatial Forensics**: Error Level Analysis (ELA at Q=90), noise residual variance analysis, cloned keypoint matching (SIFT), and text baseline alignment.
2. **Cross-Signal Agreement & Contradiction Engine**: Validates visible claims against embedded 2D barcodes (QR), metadata, and registered official government sources (`.gov.in`, `.nic.in`).
3. **Privacy-Preserving Identity DNA**: Blind indexing via HMAC-SHA256 with salting to discover recurring fraud syndicates across cases without exposing plaintext PII.
4. **10-Component Explainable Risk Engine**: Deterministic Bayesian-inspired score (0–100) that categorizes reasoning into `FACTS`, `OBSERVATIONS`, `INFERENCES`, `HYPOTHESES`, and `UNCERTAINTIES` while highlighting module disagreements.
5. **Next-Best-Action & Decision Guidance**: Prioritized investigator workflows, missing evidence gap detection, and dynamic checklists.
6. **Active Optical Liveness**: Webcam challenge protocol (head turns, blinks, smiles) with anti-spoof presentation detection (motion variance, luminance analysis).

---

## 🏛️ System Architecture

```
                    ┌────────────────────────────────────────────────────────┐
                    │          EVIDENCE INTAKE & PRESERVATION                │
                    │  - Local Filesystem Storage Adapter (storage.local.ts) │
                    │  - SHA-256 Cryptographic Anchoring                     │
                    │  - Zero-Trust Byte Immutability                        │
                    └──────────────────────────┬─────────────────────────────┘
                                               │
                    ┌──────────────────────────▼─────────────────────────────┐
                    │           MULTI-SCALE FORENSIC ENGINE                  │
                    │  - Python OpenCV / Pillow Bridge (forensic_vision_engine)│
                    │  - Multi-Q Error Level Analysis (ELA Heatmap)          │
                    │  - Localized 32x32 Noise Residual Variance             │
                    │  - SIFT Copy-Move Cloned Keypoint Detection            │
                    │  - Connected-Component Font Baseline Shift Checker     │
                    │  - 2D QR Barcode Decoder Matrix                        │
                    └──────────────────────────┬─────────────────────────────┘
                                               │
                    ┌──────────────────────────▼─────────────────────────────┐
                    │          CROSS-SIGNAL & IDENTITY REASONING             │
                    │  - Privacy-Preserving Identity DNA (HMAC Blind Index)  │
                    │  - Cross-Signal Agreement & Contradiction Engine       │
                    │  - 12+ Pattern Fraud Catalog Matcher                   │
                    │  - Document Evolution Tracker (Version Diffing)        │
                    │  - Active Randomized Challenge Liveness Verifier       │
                    └──────────────────────────┬─────────────────────────────┘
                                               │
                    ┌──────────────────────────▼─────────────────────────────┐
                    │            EXPLAINABLE DECISION SYSTEM                 │
                    │  - 10-Component Deterministic Risk Engine (0-100)      │
                    │  - Epistemic Reasoning Log (Facts/Obs/Inf/Hyp/Unc)     │
                    │  - Model Disagreement Detector (Visual vs Content)     │
                    │  - Next-Best-Action Engine & Dynamic Checklist         │
                    │  - Court-Admissible Forensic Dossier Exporter          │
                    └────────────────────────────────────────────────────────┘
```

---

## 🚀 Getting Started

### Prerequisites
* **Node.js** (v18.x or v20.x+)
* **Python** (v3.10+ recommended for OpenCV vision engine)
* **npm** or **pnpm**

### Installation

```bash
# Clone the repository
git clone https://github.com/Dhiliban-14/fake-doc-PRAMAAN.git
cd fake-doc-PRAMAAN

# Install Node dependencies
npm install

# (Optional) Install Python dependencies for the vision engine
pip install opencv-python pillow numpy pypdf2 scipy
```

---

## 🖥️ Running the Application

### Option A: Development Mode (Hot Reloading)
```bash
npx tsx server/_core/index.ts
```
* Starts Express backend and Vite frontend with Instant Hot Module Replacement (HMR).
* Open: **`http://localhost:3000`**

### Option B: Production Mode
```bash
# Build the production bundle
npm run build

# Start the optimized production server
npm run start
```
* Open: **`http://localhost:3000`**

---

## 🧪 Testing

The codebase includes an extensive Vitest automated test suite covering cryptographic anchoring, router audit paths, scenario pipelines, and forensic algorithms.

```bash
# Run all unit and integration tests
npx vitest run

# Run TypeScript typecheck
npm run check
```

---

## 📂 Project Structure

```text
├── client/                      # Frontend Application
│   ├── src/
│   │   ├── components/forensic/ # Forensic Workstation Components
│   │   │   ├── TamperingViewer.tsx     # ELA heatmap & interactive polygon overlay
│   │   │   ├── CrossSignalMatrix.tsx   # Concordance table & contradiction cards
│   │   │   ├── RiskBreakdown.tsx       # 10-component risk & epistemic reasoning log
│   │   │   ├── NextBestActionCard.tsx  # Next-best-actions & dynamic checklist
│   │   │   └── ActiveLivenessModal.tsx # Webcam optical challenge anti-spoof modal
│   │   ├── pages/
│   │   │   └── Home.tsx                # Main Investigator Workspace
│   │   ├── index.css                   # Full Light & Dark Mode palette
│   │   └── App.tsx
├── server/                      # Backend Architecture
│   ├── _core/                   # Express, OAuth & Vite integration
│   ├── pipeline/                # 12-Stage Asynchronous Analysis Pipeline
│   ├── services/                # Specialized Forensic & Intelligence Services
│   │   ├── tamperingLocalization.ts   # Node bridge to Python vision engine
│   │   ├── contradictionEngine.ts     # Multi-channel signal consistency validator
│   │   ├── fraudPatternLibrary.ts     # Catalog of 12+ fraud patterns
│   │   ├── explainableRiskEngine.ts   # 10-component risk & epistemic logic
│   │   ├── identityDnaService.ts      # Blind HMAC-SHA256 tokenization & masking
│   │   ├── decisionEngine.ts          # Prioritized actions & missing evidence
│   │   ├── evolutionTracker.ts        # Document revision diffing
│   │   └── livenessService.ts         # Active optical challenge generator
│   ├── routers.ts               # tRPC Endpoints
│   └── db.ts                    # Persistence layer & audit verification
├── scripts/                     # Python Multi-Scale Vision Engine
│   └── forensic_vision_engine.py      # ELA, SIFT copy-move, noise variance, QR
└── data/                        # Local case storage & immutable audit records
```

---

## 🔒 Security & Privacy by Design

* **Zero-Trust Preservation**: Documents are hashed immediately upon intake using SHA-256 and stored immutably.
* **Pseudonymization**: Candidate names, document numbers, phone numbers, and payment handles are blind-indexed with HMAC-SHA256 and salted, preventing raw PII exposure in logs and cross-case graphs.
* **Audit Trail**: Every analysis step is cryptographically linked in a tamper-evident timeline chain.

---

## 📜 License
This project is licensed under the MIT License.
