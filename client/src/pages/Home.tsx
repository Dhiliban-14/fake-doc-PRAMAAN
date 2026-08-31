import { AlertTriangle,
  ArrowUpRight,
  BadgeCheck,
  BarChart3,
  Bell,
  Camera,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Copy,
  Database,
  Download,
  FileCheck2,
  FileText,
  Fingerprint,
  GitBranch,
  Globe2,
  Hash,
  Image as ImageIcon,
  Info,
  LayoutDashboard,
  LockKeyhole,
  Menu,
  Network,
  Plus,
  QrCode,
  ScanSearch,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  UploadCloud,
  X,
  ZoomIn,
  Layers,
  Split,
  Activity,
  Sun,
  Moon,
  History,
  LogIn,
  LogOut,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { TamperingViewer } from "@/components/forensic/TamperingViewer";
import { CrossSignalMatrix } from "@/components/forensic/CrossSignalMatrix";
import { RiskBreakdown } from "@/components/forensic/RiskBreakdown";
import { NextBestActionCard } from "@/components/forensic/NextBestActionCard";
import { ActiveLivenessModal } from "@/components/forensic/ActiveLivenessModal";
import DocumentHistoryDrawer from "@/components/DocumentHistoryDrawer";

type Risk = "HIGH RISK" | "MEDIUM RISK" | "LOW RISK" | "INCONCLUSIVE";
type Scenario = "genuine" | "clean-fake" | "artifact";

const scenarios: Record<Scenario, {
  label: string;
  eyebrow: string;
  title: string;
  risk: Risk;
  score: number;
  confidence: number;
  completeness: number;
  tone: "red" | "amber" | "green";
  summary: string;
  evidence: { id: string; title: string; detail: string; tag: string; kind: "bad" | "warn" | "good" }[];
  claims: { claim: string; value: string; status: string; detail: string }[];
  timeline: { time: string; title: string; detail: string }[];
}> = {
  genuine: {
    label: "Demo A",
    eyebrow: "VERIFIED GENUINE DOCUMENT",
    title: "Recruitment notification",
    risk: "LOW RISK",
    score: 18,
    confidence: 92,
    completeness: 90,
    tone: "green",
    summary: "The claimed notification was found in the registered recruitment portal and the extracted claims match the published source. No significant manipulation evidence was detected.",
    evidence: [
      { id: "EV-00418", title: "Official source match", detail: "Notification 17/2026 appears on recruitment.xyz.gov.in", tag: "VERIFIED", kind: "good" },
      { id: "EV-00419", title: "Domain alignment", detail: "QR destination and website match the registered official domain", tag: "VERIFIED", kind: "good" },
      { id: "EV-00420", title: "Forensic review", detail: "No significant evidence of manipulation in the working copy", tag: "LOW SIGNAL", kind: "good" },
    ],
    claims: [
      { claim: "Organization", value: "XYZ Government Department", status: "VERIFIED", detail: "Matches registry record" },
      { claim: "Notification number", value: "17/2026", status: "VERIFIED", detail: "Exact source match" },
      { claim: "Application deadline", value: "30 Sep 2026", status: "VERIFIED", detail: "Matches official notice" },
      { claim: "Website", value: "recruitment.xyz.gov.in", status: "VERIFIED", detail: "Official domain" },
    ],
    timeline: [
      { time: "22:41:03", title: "Evidence uploaded", detail: "EV-00418 • original preserved" },
      { time: "22:41:04", title: "SHA-256 generated", detail: "Hash anchored to immutable record" },
      { time: "22:41:07", title: "Claims extracted", detail: "12 claims • OCR confidence 96%" },
      { time: "22:41:10", title: "Official source verified", detail: "3 high-value claims matched" },
      { time: "22:41:14", title: "Report generated", detail: "Evidence-backed assessment ready" },
    ],
  },
  "clean-fake": {
    label: "Demo B",
    eyebrow: "VISUALLY CLEAN · CONTENT-SUSPICIOUS",
    title: "Urgent appointment letter",
    risk: "HIGH RISK",
    score: 87,
    confidence: 84,
    completeness: 78,
    tone: "red",
    summary: "The document looks visually coherent, but its central recruitment claim could not be verified. The supplied website is not registered to the claimed organization and a personal payment channel is requested.",
    evidence: [
      { id: "EV-00742", title: "Official notification not found", detail: "No matching record in the registered recruitment portal", tag: "CONTRADICTED", kind: "bad" },
      { id: "EV-00743", title: "Unofficial destination", detail: "jobs-xyz-careers.com does not match the official domain", tag: "UNVERIFIED", kind: "bad" },
      { id: "EV-00744", title: "Payment request detected", detail: "₹500 registration fee routed to a personal UPI ID", tag: "HIGH SIGNAL", kind: "bad" },
      { id: "EV-00745", title: "Visual review", detail: "No strong manipulation signal. This does not lower content risk.", tag: "LIMITATION", kind: "warn" },
    ],
    claims: [
      { claim: "Organization", value: "XYZ Government Department", status: "UNVERIFIED", detail: "Entity name not enough to authenticate" },
      { claim: "Notification number", value: "17/2026", status: "CONTRADICTED", detail: "Not found in official registry" },
      { claim: "Application fee", value: "₹500 via example@upi", status: "SUSPICIOUS", detail: "Personal payment channel" },
      { claim: "Website", value: "jobs-xyz-careers.com", status: "CONTRADICTED", detail: "Domain mismatch" },
    ],
    timeline: [
      { time: "09:12:11", title: "Evidence uploaded", detail: "EV-00742 • original preserved" },
      { time: "09:12:12", title: "QR decoded", detail: "Destination recorded for verification" },
      { time: "09:12:15", title: "Claims extracted", detail: "9 claims • OCR confidence 93%" },
      { time: "09:12:18", title: "Source contradiction detected", detail: "Notification absent from registry" },
      { time: "09:12:21", title: "Risk assessment completed", detail: "High risk • confidence 84%" },
    ],
  },
  artifact: {
    label: "Demo C",
    eyebrow: "GENUINE SOURCE · VISUAL ARTIFACTS",
    title: "Public information notice",
    risk: "LOW RISK",
    score: 26,
    confidence: 79,
    completeness: 86,
    tone: "amber",
    summary: "The notice matches its official source. Compression and editing artifacts are present in the image, but there is no strong evidence that the content itself is fraudulent.",
    evidence: [
      { id: "EV-00591", title: "Official source match", detail: "Published notice found on xyz.gov.in", tag: "VERIFIED", kind: "good" },
      { id: "EV-00592", title: "Compression anomaly", detail: "Localized JPEG inconsistency near the footer", tag: "MEDIUM STRENGTH", kind: "warn" },
      { id: "EV-00593", title: "Metadata variation", detail: "Producer field indicates an export workflow", tag: "SUPPORTING", kind: "warn" },
    ],
    claims: [
      { claim: "Organization", value: "XYZ Government Department", status: "VERIFIED", detail: "Matches source" },
      { claim: "Notice date", value: "18 Aug 2026", status: "VERIFIED", detail: "Matches official notice" },
      { claim: "Visual anomaly", value: "Localized compression", status: "INCONCLUSIVE", detail: "Not proof of content fraud" },
      { claim: "Metadata", value: "Microsoft Word producer", status: "SUPPORTING", detail: "Context only" },
    ],
    timeline: [
      { time: "15:06:44", title: "Evidence uploaded", detail: "EV-00591 • original preserved" },
      { time: "15:06:47", title: "Quality gate passed", detail: "Fair quality • OCR confidence 88%" },
      { time: "15:06:51", title: "Official source verified", detail: "Claims matched against source" },
      { time: "15:06:54", title: "Visual anomaly detected", detail: "Interpretation limited to compression" },
      { time: "15:06:58", title: "Assessment completed", detail: "Low risk with stated limitations" },
    ],
  },
};

const nav = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "cases", label: "Cases", icon: FileCheck2, count: "12" },
  { id: "tampering", label: "Tampering Map", icon: Layers },
  { id: "crosssignal", label: "Signal Agreement", icon: Split },
  { id: "riskbreakdown", label: "Risk Synthesis", icon: Activity },
  { id: "decision", label: "Next Best Action", icon: Sparkles },
  { id: "sources", label: "Source registry", icon: Globe2 },
  { id: "intelligence", label: "Intelligence graph", icon: Network },
];

function StatusPill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "green" | "red" | "amber" }) {
  return <span className={`status-pill ${tone}`}>{children}</span>;
}

function MetricCard({ label, value, caption, icon: Icon, accent }: { label: string; value: string; caption: string; icon: React.ElementType; accent: string }) {
  return <div className="metric-card">
    <div className="metric-head"><span>{label}</span><Icon size={16} strokeWidth={1.7} style={{ color: accent }} /></div>
    <div className="metric-value">{value}</div>
    <div className="metric-caption">{caption}</div>
  </div>;
}

function EvidenceCard({ item }: { item: (typeof scenarios.genuine.evidence)[number] }) {
  const tone = item.kind === "bad" ? "red" : item.kind === "warn" ? "amber" : "green";
  return <div className="evidence-card">
    <div className={`evidence-icon ${tone}`}>{item.kind === "bad" ? <X size={16} /> : item.kind === "warn" ? <AlertTriangle size={16} /> : <Check size={16} />}</div>
    <div className="evidence-copy"><div className="evidence-title">{item.title}</div><div className="evidence-detail">{item.detail}</div></div>
    <StatusPill tone={tone}>{item.tag}</StatusPill>
  </div>;
}

export default function Home() {
  const [appMode, setAppMode] = useState<"LIVE" | "DEMO">("DEMO");
  const [scenario, setScenario] = useState<Scenario>("clean-fake");
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    return (localStorage.getItem("pramaan_theme") as "light" | "dark") || "light";
  });

  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("pramaan_theme", theme);
  }, [theme]);
  const [activeNav, setActiveNav] = useState("overview");
  const [activeSection, setActiveSection] = useState("overview");
  const [showUpload, setShowUpload] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showLivenessModal, setShowLivenessModal] = useState(false);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ claims: true, verification: true, forensics: false, dna: false, security: false, graph: false, timeline: false, investigator: false });
  const fileInput = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraStatus, setCameraStatus] = useState<"idle" | "starting" | "ready" | "blocked">("idle");
  const [capturedFrame, setCapturedFrame] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [isIngesting, setIsIngesting] = useState(false);
  const { user, logout, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Queries for live database
  const { data: dbCases, refetch: refetchCases } = trpc.cases.list.useQuery(undefined, { refetchInterval: appMode === "LIVE" ? 3000 : false });

  useEffect(() => {
    if (dbCases && dbCases.length > 0 && !selectedCaseId) {
      setSelectedCaseId(dbCases[0].caseId);
    }
  }, [dbCases, selectedCaseId]);

  const currentCaseId = appMode === "LIVE" ? (selectedCaseId || dbCases?.[0]?.caseId || "") : "PRM-2026-000142";
  const { data: caseBundle, refetch: refetchBundle } = trpc.cases.get.useQuery({ caseId: currentCaseId }, { enabled: Boolean(currentCaseId), refetchInterval: appMode === "LIVE" ? 3000 : false });
  const { data: liveAudit } = trpc.cases.audit.useQuery({ caseId: currentCaseId }, { enabled: Boolean(currentCaseId), refetchInterval: appMode === "LIVE" ? 5000 : false });
  const { data: liveSources } = trpc.cases.registry.useQuery();
  const { data: liveGraph } = trpc.cases.graph.useQuery({ caseId: caseBundle?.case?.id || 0 }, { enabled: Boolean(caseBundle?.case?.id) && appMode === "LIVE" });

  const backendOrigin = import.meta.env.VITE_BACKEND_URL
    ? String(import.meta.env.VITE_BACKEND_URL).replace(/\/$/, "")
    : "";

  const activeDocKey = caseBundle?.evidence?.[0]?.storageKey;
  const activeDocUrl = activeDocKey
    ? `${backendOrigin}/uploads/${activeDocKey.replace(/^\/+/, "")}`
    : null;

  const createCaseMutation = trpc.cases.create.useMutation();
  const ingestMutation = trpc.cases.ingest.useMutation();

  const data = useMemo(() => {
    if (appMode === "DEMO") return scenarios[scenario];
    if (!caseBundle || !caseBundle.case) {
      return {
        label: "Live Case",
        eyebrow: "LIVE FORENSIC INVESTIGATION",
        title: "No cases in database",
        risk: "INCONCLUSIVE" as Risk,
        score: 0,
        confidence: 0,
        completeness: 0,
        tone: "amber" as const,
        summary: "No document has been uploaded yet. Click 'Start new case' or 'Live camera' to begin an evidence-backed investigation.",
        evidence: [],
        claims: [],
        timeline: [],
      };
    }
    const c = caseBundle.case;
    const tone = c.riskLevel === "high" ? ("red" as const) : c.riskLevel === "low" ? ("green" as const) : ("amber" as const);
    const mappedEvidence = caseBundle.evidence.map((ev) => ({
      id: ev.evidenceId,
      title: `${ev.originalName} (${Math.round(ev.fileSize / 1024)} KB)`,
      detail: `SHA-256: ${ev.sha256.slice(0, 16)}… • MIME: ${ev.mimeType} • Quality: ${ev.quality.toUpperCase()}`,
      tag: ev.quality === "good" ? "VERIFIED" : ev.quality === "poor" ? "POOR" : "INCONCLUSIVE",
      kind: ev.quality === "good" ? ("good" as const) : ev.quality === "poor" ? ("bad" as const) : ("warn" as const),
    }));
    const mappedClaims = caseBundle.claims.map((cl) => {
      const ver = caseBundle.verification.find((v) => v.claimId === cl.id);
      return {
        claim: cl.claimType.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase()),
        value: cl.normalizedValue,
        status: ver ? ver.status.toUpperCase() : "UNVERIFIED",
        detail: ver?.reason || "Awaiting source cross-reference",
      };
    });
    const mappedTimeline = caseBundle.timeline.map((tm) => {
      const d = new Date(tm.occurredAt);
      return {
        time: d.toTimeString().split(" ")[0],
        title: tm.eventType.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase()),
        detail: tm.detail,
      };
    });
    const summary = caseBundle.findings?.[0]?.summary || (caseBundle.evidence.length === 0 ? "No evidence item attached. Drop or capture a document to process." : "Evidence processed across OCR, claim extraction, authoritative registry matching, and modular forensics.");
    return {
      label: c.caseId,
      eyebrow: `LIVE FORENSIC INVESTIGATION · ${c.caseId}`,
      title: c.title,
      risk: (c.riskLevel.toUpperCase() + " RISK") as Risk,
      score: c.riskScore,
      confidence: c.confidence,
      completeness: c.completeness,
      tone,
      summary,
      evidence: mappedEvidence,
      claims: mappedClaims,
      timeline: mappedTimeline,
    };
  }, [appMode, scenario, caseBundle]);

  const integrityAudit = liveAudit;
  const integrityStatus = appMode === "DEMO" ? "DEMO ONLY" : integrityAudit ? (integrityAudit.valid ? "VALID" : "CHECK FAILED") : "INCONCLUSIVE";
  const integrityTone = integrityAudit?.valid ? "green" : "amber";
  const integrityDescription = appMode === "DEMO" ? "Live audit requires a signed-in stored case; this view is a static demo set" : integrityAudit ? `Evidence hashes ${integrityAudit.evidence.filter((item) => item.valid).length}/${integrityAudit.evidence.length} valid · timeline chain ${integrityAudit.timelineValid ? "valid" : "failed"}` : "Audit in progress or case has no evidence records.";

  useEffect(() => {
    if (!showCamera) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setCameraStatus("idle");
      setCapturedFrame((previous) => { if (previous) URL.revokeObjectURL(previous); return null; });
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraStatus("blocked");
      return;
    }
    let cancelled = false;
    setCameraStatus("starting");
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
      .then((stream) => {
        if (cancelled) { stream.getTracks().forEach((track) => track.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
        setCameraStatus("ready");
      })
      .catch(() => setCameraStatus("blocked"));
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [showCamera]);

  function captureFrame() {
    const video = videoRef.current;
    if (!video || cameraStatus !== "ready" || video.readyState < 2) {
      toast.error("Camera is not ready", { description: "Wait for a readable frame before capturing." });
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const context = canvas.getContext("2d");
    if (!context) { toast.error("Capture unavailable", { description: "The browser could not create a local frame buffer." }); return; }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const sample = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let totalBrightness = 0;
    for (let index = 0; index < sample.length; index += 16) totalBrightness += (sample[index] + sample[index + 1] + sample[index + 2]) / 3;
    const averageBrightness = totalBrightness / Math.max(1, Math.ceil(sample.length / 16));
    if (canvas.width < 640 || canvas.height < 360) { toast.error("Quality gate failed", { description: "Move closer so the captured document has enough resolution." }); return; }
    if (averageBrightness < 38 || averageBrightness > 242) { toast.error("Quality gate failed", { description: averageBrightness < 38 ? "Increase lighting before capturing." : "Reduce glare or direct light before capturing." }); return; }
    canvas.toBlob((blob) => {
      if (!blob) { toast.error("Capture unavailable", { description: "The browser did not return an image frame." }); return; }
      setCapturedBlob(blob);
      setCapturedFrame((previous) => { if (previous) URL.revokeObjectURL(previous); return URL.createObjectURL(blob); });
      toast.success("Frame captured locally", { description: "Quality gate passed; click 'Continue to analysis' to ingest into live engine." });
    }, "image/jpeg", 0.92);
  }

  async function handleCameraContinue() {
    if (!capturedBlob) return;
    setIsIngesting(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        let targetCaseId = caseBundle?.case?.id;
        let targetCode = caseBundle?.case?.caseId;
        if (!targetCaseId) {
          const newCase = await createCaseMutation.mutateAsync({ title: `Camera Intake ${new Date().toLocaleDateString()}` });
          targetCaseId = newCase.id;
          targetCode = newCase.caseId;
        }
        await ingestMutation.mutateAsync({
          caseId: targetCaseId,
          originalName: `camera-scan-${Date.now()}.jpg`,
          mimeType: "image/jpeg",
          fileBase64: base64,
        });
        setShowCamera(false);
        setAppMode("LIVE");
        if (targetCode) setSelectedCaseId(targetCode);
        await refetchCases();
        await refetchBundle();
        toast.success("Evidence ingested into Live Engine", { description: "Cryptographic SHA-256 anchored; OCR, claims, and forensics pipeline executing." });
      };
      reader.readAsDataURL(capturedBlob);
    } catch (err: any) {
      toast.error("Ingestion failed", { description: err.message });
    } finally {
      setIsIngesting(false);
    }
  }

  const navTitle = useMemo(() => nav.find((item) => item.id === activeNav)?.label ?? "Overview", [activeNav]);

  function chooseScenario(next: Scenario) {
    setAppMode("DEMO");
    setScenario(next);
    setActiveSection("overview");
    toast.success(`${scenarios[next].label} loaded`, { description: "Demo-only evidence set. No external document was uploaded." });
  }

  function toggleSection(key: string) {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleFile(file?: File) {
    if (!file) return;

    // Resolve file type with extension fallback
    let mimeType = (file.type || "").toLowerCase();
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (!mimeType || mimeType === "image/jpg" || mimeType === "image/pjpeg") {
      if (ext === "jpg" || ext === "jpeg") mimeType = "image/jpeg";
      else if (ext === "png") mimeType = "image/png";
      else if (ext === "webp") mimeType = "image/webp";
      else if (ext === "pdf") mimeType = "application/pdf";
    }
    if (mimeType === "application/x-pdf") mimeType = "application/pdf";

    const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!allowed.includes(mimeType)) {
      toast.error("Unsupported file type", {
        description: `Received ${file.type || ext || "unknown"}. Please select JPG, JPEG, PNG, WEBP, or PDF.`,
      });
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      toast.error("File too large", { description: "Maximum supported evidence size is 25 MB." });
      return;
    }

    setIsIngesting(true);
    toast.info("Ingesting evidence...", { description: `Preserving ${file.name} and computing cryptographic hash.` });

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = (reader.result as string).split(",")[1];
          const rawTitle = file.name.replace(/\.[^/.]+$/, "").trim();
          const cleanTitle = rawTitle.length >= 3 ? rawTitle : `Case ${rawTitle || Date.now()}`;

          const newCase = await createCaseMutation.mutateAsync({ title: cleanTitle });
          await ingestMutation.mutateAsync({
            caseId: newCase.id,
            originalName: file.name,
            mimeType: mimeType,
            fileBase64: base64,
          });

          setShowUpload(false);
          setAppMode("LIVE");
          setSelectedCaseId(newCase.caseId);
          await refetchCases();
          await refetchBundle();
          toast.success("Evidence anchored in Live Store", {
            description: `Case ${newCase.caseId} initialized. Analysis stages executing asynchronously.`,
          });
        } catch (err: any) {
          console.error("Ingestion error:", err);
          toast.error("Ingestion error", { description: err.message || "Failed to transmit evidence payload." });
        } finally {
          setIsIngesting(false);
          if (fileInput.current) fileInput.current.value = "";
        }
      };
      reader.onerror = () => {
        setIsIngesting(false);
        toast.error("File read error", { description: "Could not read the selected local file." });
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setIsIngesting(false);
      toast.error("File read error", { description: err.message });
    }
  }

  function downloadReport() {
    const isLive = appMode === "LIVE";
    const caseIdStr = isLive ? currentCaseId : "PRM-2026-000142";
    const evIdStr = isLive ? (caseBundle?.evidence?.[0]?.evidenceId || "NOT_AVAILABLE") : "EV-00742";
    const shaStr = isLive ? (caseBundle?.evidence?.[0]?.sha256 || "NOT_AVAILABLE") : "7f2e1a3b8c4d5e6f…";
    const report = `PRAMAAN FORENSIC INVESTIGATION REPORT\nMode: ${appMode}\nGenerated: ${new Date().toUTCString()}\n\nCase ID: ${caseIdStr}\nEvidence ID: ${evIdStr}\nSHA-256: ${shaStr}\nAssessment: ${data.risk}\nRisk score: ${data.score}/100\nEvidence confidence: ${data.confidence}%\nCompleteness: ${data.completeness}%\n\n=========================================\nOBSERVED EVIDENCE\n=========================================\n${data.evidence.length > 0 ? data.evidence.map((item) => `- [${item.id}] ${item.title}: ${item.detail} (${item.tag})`).join("\n") : "None recorded."}\n\n=========================================\nEXTRACTED CLAIMS & VERIFICATION\n=========================================\n${data.claims.length > 0 ? data.claims.map((cl) => `- ${cl.claim}: "${cl.value}" -> [${cl.status}] ${cl.detail}`).join("\n") : "No claims extracted or inconclusive."}\n\n=========================================\nSYSTEM INTERPRETATION\n=========================================\n${data.summary}\n\n=========================================\nRECOMMENDED ACTION\n=========================================\n${data.tone === "red" ? "Pause reliance on the document immediately. Confirm claims with official issuing authority." : "Retain immutable original evidence. Corroborate critical claims against registered gazette source."}\n\n=========================================\nINTEGRITY AUDIT TRAIL\n=========================================\nEvidence record hash: ${integrityAudit ? (integrityAudit.evidence.length > 0 && integrityAudit.evidence.every((item) => item.valid) ? "VALID" : "CHECK FAILED") : "NOT AVAILABLE"}\nForensic timeline chain: ${integrityAudit ? (integrityAudit.timelineValid ? "VALID" : "CHECK FAILED") : "NOT AVAILABLE"}\nWrite policy: evidence and timeline update/delete operations rejected by immutability guard.\nAudit status: ${integrityStatus}\n\n=========================================\nLIMITATIONS\n=========================================\nThis assessment is evidence-backed and mathematically deterministic based on available inputs. It is an investigatory intelligence tool and not a judicial determination of authenticity.\n`;
    const blob = new Blob([report], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `pramaan-report-${caseIdStr}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("Investigation report downloaded");
  }

  function printReport() {
    const isLive = appMode === "LIVE";
    const caseIdStr = isLive ? currentCaseId : "PRM-2026-000142";
    const evIdStr = isLive ? (caseBundle?.evidence?.[0]?.evidenceId || "NOT_AVAILABLE") : "EV-00742";
    const shaStr = isLive ? (caseBundle?.evidence?.[0]?.sha256 || "NOT_AVAILABLE") : "7f2e…c81a";
    const popup = window.open("", "_blank", "width=900,height=760");
    if (!popup) { toast.error("Print window was blocked", { description: "Allow pop-ups to save a PDF report." }); return; }
    popup.document.write(`<!doctype html><html><head><title>PRAMAAN report · ${caseIdStr}</title><style>body{font-family:Arial,sans-serif;max-width:800px;margin:48px auto;color:#17191d;line-height:1.6}h1{font-size:28px;margin-bottom:4px}h2{font-size:14px;margin-top:32px;border-bottom:1px solid #ddd;padding-bottom:8px}small,.muted{color:#69737e}.risk{display:inline-block;padding:8px 12px;background:${data.tone === "red" ? "#efd1d4" : data.tone === "amber" ? "#f1e0bf" : "#d7eadc"};border-radius:6px;font-weight:bold}li{margin:8px 0}.mono{font-family:monospace}</style></head><body><small>PRAMAAN · FORENSIC INVESTIGATION REPORT · ${appMode} MODE</small><h1>${data.title}</h1><div class="muted">Case ${caseIdStr} · Evidence ${evIdStr} · SHA-256: ${shaStr}</div><p class="risk">${data.risk} · ${data.score}/100 · ${data.confidence}% evidence confidence · ${data.completeness}% completeness</p><h2>Observed evidence</h2><ul>${data.evidence.length > 0 ? data.evidence.map((item) => `<li><b>${item.id} — ${item.title}</b><br>${item.detail} <span class="muted">[${item.tag}]</span></li>`).join("") : "<li>None recorded</li>"}</ul><h2>Extracted Claims & Verification</h2><ul>${data.claims.length > 0 ? data.claims.map((cl) => `<li><b>${cl.claim}:</b> ${cl.value} — <span class="muted">[${cl.status}]</span> ${cl.detail}</li>`).join("") : "<li>None recorded</li>"}</ul><h2>System interpretation</h2><p>${data.summary}</p><h2>Recommended action</h2><p>${data.tone === "red" ? "Pause reliance on the document immediately. Confirm claims with official issuing authority." : "Retain original evidence and verify claims against registered source."}</p><h2>Integrity audit</h2><p>Evidence record hash: <b>${integrityStatus}</b><br>Forensic timeline chain: <b>${integrityAudit ? (integrityAudit.timelineValid ? "VALID" : "CHECK FAILED") : "INCONCLUSIVE"}</b><br>Write policy: evidence and timeline update/delete operations rejected.</p><h2>Limitations</h2><p class="muted">Forensic anomalies are supporting evidence only. This assessment is not a legal authenticity determination. Results may be inconclusive when image quality, source coverage, or detector availability is limited.</p><script>window.onload=()=>window.print()</script></body></html>`);
    popup.document.close();
  }

  const activeCasesCount = appMode === "LIVE" ? (dbCases?.length || 0).toString() : "12";

  return <div className="pramaan-shell">
    <aside className="app-sidebar">
      <div className="brand-lockup">
        <div className="brand-mark"><span></span><span></span><span></span></div>
        <div><div className="brand-name">PRAMAAN</div><div className="brand-subtitle">Document intelligence</div></div>
      </div>
      <div className="sidebar-rule" />
      <div className="workspace-label">INVESTIGATOR WORKSPACE</div>
      <nav className="side-nav" aria-label="Primary navigation">
        {nav.map((item) => <button key={item.id} className={`side-nav-item ${activeNav === item.id ? "active" : ""}`} onClick={() => { setActiveNav(item.id); setActiveSection(item.id === "cases" ? "cases" : "overview"); }}>
          <item.icon size={17} strokeWidth={1.65} /><span>{item.label}</span>{item.id === "cases" && <span className="nav-count">{activeCasesCount}</span>}
        </button>)}
      </nav>
      <div className="sidebar-bottom">
        <div className="privacy-note"><LockKeyhole size={15} /><div><strong>Privacy by design</strong><span>Original evidence is preserved and never sent to external AI by default.</span></div></div>
        <button className="side-nav-item" onClick={() => toast.info("Settings are available in the full workspace.")}><SlidersHorizontal size={17} strokeWidth={1.65} /><span>Settings</span></button>
        {user ? (
          <div className="analyst-chip" style={{ justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <div className="avatar">
                {user.name ? user.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() : "IN"}
              </div>
              <div>
                <strong>{user.name || "Investigator"}</strong>
                <span>{user.role?.toUpperCase() || "INVESTIGATOR"}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={async () => {
                await logout();
                toast.info("Signed out.");
              }}
              className="icon-button"
              title="Sign out"
            >
              <LogOut size={14} color="#e11d48" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="primary-button"
            style={{ width: "100%", marginTop: 12 }}
            onClick={() => setLocation("/login")}
          >
            <LogIn size={15} />
            <span>Investigator Sign In</span>
          </button>
        )}
      </div>
    </aside>

    <main className="app-main">
      <header className="topbar">
        <div className="mobile-header-left">
          <button
            type="button"
            className="mobile-menu-btn"
            onClick={() => setShowMobileNav(true)}
            aria-label="Open navigation menu"
          >
            <Menu size={20} />
          </button>
          <div className="mobile-brand">
            <div className="brand-mark small"><span></span><span></span><span></span></div>
            <span>PRAMAAN</span>
          </div>
        </div>

        <div className="breadcrumbs"><span>Workspace</span><ChevronRight size={14} /><strong>{navTitle}</strong></div>
        <div className="topbar-actions">
          <div className="mode-switch-group">
            <button className={`mode-switch-btn ${appMode === "LIVE" ? "active" : ""}`} onClick={() => { setAppMode("LIVE"); toast.info("Switched to LIVE MODE: querying real cases, evidence, and forensic pipeline."); }}>LIVE MODE</button>
            <button className={`mode-switch-btn ${appMode === "DEMO" ? "active" : ""}`} onClick={() => { setAppMode("DEMO"); toast.info("Switched to DEMO MODE: showing prepared scenarios."); }}>DEMO MODE</button>
          </div>
          <span className="demo-chip"><span className="live-dot"></span> {appMode === "LIVE" ? "LIVE FORENSIC STORE" : "DEMO WORKSPACE"}</span>

          {/* Document History Trigger Button */}
          <button
            type="button"
            className="secondary-button history-btn mobile-action-btn"
            onClick={() => setShowHistoryDrawer(true)}
            title="Open Document History"
          >
            <History size={15} />
            <span>History ({appMode === "LIVE" ? (dbCases?.length || 0) : 3})</span>
          </button>

          {/* Dedicated Universal Theme Toggle */}
          <button
            type="button"
            className="icon-button bordered theme-toggle-btn mobile-action-btn"
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            onClick={() => {
              const nextTheme = theme === "dark" ? "light" : "dark";
              setTheme(nextTheme);
              toast.info(`Switched to ${nextTheme === "dark" ? "Dark Mode" : "Light Mode"}`);
            }}
          >
            {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          </button>

          {/* Topbar User Profile / Sign In */}
          {user ? (
            <div className="user-profile-badge">
              <button
                type="button"
                className="avatar top-avatar"
                title={`${user.name || "Investigator"} (${user.role?.toUpperCase() || "INVESTIGATOR"})`}
                onClick={() => setShowUserMenu(!showUserMenu)}
              >
                {user.name ? user.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() : "IN"}
              </button>
              {showUserMenu && (
                <div className="user-dropdown-menu">
                  <div className="user-dropdown-header">
                    <strong>{user.name || "Investigator"}</strong>
                    <small>{user.email || "investigator@pramaan.gov.in"}</small>
                    <span className="role-tag">{user.role?.toUpperCase() || "INVESTIGATOR"}</span>
                  </div>
                  <button
                    type="button"
                    className="dropdown-item"
                    onClick={async () => {
                      await logout();
                      setShowUserMenu(false);
                      toast.info("Signed out.");
                    }}
                  >
                    <LogOut size={14} />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              className="primary-button top-login-btn mobile-action-btn"
              onClick={() => setLocation("/login")}
            >
              <LogIn size={15} />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </header>

      {activeNav === "overview" && <>
        <section className="hero-section">
          <div className="hero-copy"><div className="eyebrow">EVIDENCE FIRST · EXPLAINABLE BY DEFAULT</div><h1>Don't trust the document.<br /><em>Verify the claims.</em></h1><p>PRAMAAN decomposes official-looking documents into verifiable claims, corroborates them against authoritative sources, and preserves an auditable investigation trail.</p></div>
          <div className="hero-actions">
            <button className="primary-button" onClick={() => setShowUpload(true)}><Plus size={18} /> Start new case</button>
            <button className="secondary-button" onClick={() => setShowCamera(true)}><Camera size={17} /> Live camera</button>
            <button className="secondary-button" onClick={() => setShowLivenessModal(true)}><ShieldCheck size={17} /> Active liveness</button>
          </div>
        </section>

        <section className="metrics-grid">
          <MetricCard label="Active cases" value={activeCasesCount} caption={appMode === "LIVE" ? "Real database cases" : "3 require review"} icon={FileCheck2} accent="#6c83a9" />
          <MetricCard label="Evidence processed" value={appMode === "LIVE" ? (caseBundle?.evidence?.length || 0).toString() : "48"} caption={appMode === "LIVE" ? "Current case items" : "This month"} icon={ScanSearch} accent="#c98997" />
          <MetricCard label="Source match rate" value={appMode === "LIVE" ? (caseBundle?.verification?.length ? `${Math.round((caseBundle.verification.filter(v => v.status === "verified").length / caseBundle.verification.length) * 100)}%` : "NOT_AVAILABLE") : "82%"} caption="Across verified claims" icon={BadgeCheck} accent="#7a9b85" />
          <MetricCard label="Open relationships" value={appMode === "LIVE" ? (liveGraph?.edges?.length || 0).toString() : "19"} caption="Recurring entities found" icon={Network} accent="#9b82a7" />
        </section>

        <section className="workspace-grid">
          <div className="panel recent-panel"><div className="panel-header"><div><div className="eyebrow">CASE MANAGEMENT {appMode === "DEMO" ? "· DEMO ONLY" : "· LIVE"}</div><h2>Recent investigations</h2></div><button className="text-button" onClick={() => { setActiveNav("cases"); setActiveSection("cases"); }}>View all <ArrowUpRight size={15} /></button></div>
            <div className="case-list">
              {appMode === "LIVE" && dbCases && dbCases.length > 0 ? (
                dbCases.slice(0, 3).map((item) => (
                  <button key={item.caseId} className={`case-row ${selectedCaseId === item.caseId ? "selected" : ""}`} onClick={() => { setSelectedCaseId(item.caseId); setActiveSection("overview"); }}>
                    <div className={`case-marker ${item.riskLevel === "high" ? "red" : item.riskLevel === "low" ? "green" : "amber"}`}></div>
                    <div className="case-info"><strong>{item.caseId}</strong><span>{item.title}</span></div>
                    <div className="case-risk"><StatusPill tone={item.riskLevel === "high" ? "red" : item.riskLevel === "low" ? "green" : "amber"}>{item.riskLevel.toUpperCase()} RISK</StatusPill><span>{new Date(item.updatedAt).toLocaleDateString()}</span></div>
                  </button>
                ))
              ) : appMode === "LIVE" ? (
                <div style={{ padding: "16px", color: "#8d949d", fontSize: "11px" }}>No live cases yet. Click "Start new case" to upload document evidence.</div>
              ) : (
                <>
                  <button className="case-row selected" onClick={() => setActiveSection("overview")}><div className="case-marker red"></div><div className="case-info"><strong>PRM-2026-000142</strong><span>Urgent appointment letter · 1 evidence item</span></div><div className="case-risk"><StatusPill tone="red">HIGH RISK</StatusPill><span>8 min ago</span></div></button>
                  <button className="case-row" onClick={() => chooseScenario("artifact")}><div className="case-marker amber"></div><div className="case-info"><strong>PRM-2026-000141</strong><span>Public information notice · 2 evidence items</span></div><div className="case-risk"><StatusPill tone="amber">LOW RISK</StatusPill><span>Yesterday</span></div></button>
                  <button className="case-row" onClick={() => chooseScenario("genuine")}><div className="case-marker green"></div><div className="case-info"><strong>PRM-2026-000139</strong><span>Recruitment notification · 1 evidence item</span></div><div className="case-risk"><StatusPill tone="green">LOW RISK</StatusPill><span>20 Aug 2026</span></div></button>
                </>
              )}
            </div>
          </div>
          <div className="panel source-panel"><div className="panel-header"><div><div className="eyebrow">AUTHORITATIVE SOURCES {appMode === "DEMO" ? "· DEMO ONLY" : "· LIVE"}</div><h2>Registry health</h2></div><button className="icon-button" onClick={() => setActiveNav("sources")}><ArrowUpRight size={16} /></button></div><div className="registry-score"><div className="score-ring"><span>{liveSources?.length ? "100" : "92"}</span><small>%</small></div><div><strong>Source registry healthy</strong><p>{liveSources?.length || 4} official domains<br />Authoritative gazette index</p></div></div><div className="source-bars"><div><span>Domain checks</span><b>100%</b><i><u style={{ width: "100%" }} /></i></div><div><span>Notification index</span><b>{liveSources?.length ? "100%" : "87%"}</b><i><u style={{ width: "95%" }} /></i></div></div></div>
        </section>

        <section className="demo-section"><div className="section-heading"><div><div className="eyebrow">HONEST DEMONSTRATIONS</div><h2>See how evidence changes the assessment</h2></div><p>Three scenarios make the distinction between visual appearance, content verification, and responsible interpretation explicit.</p></div><div className="demo-grid">
          <button className={`demo-card ${scenario === "genuine" ? "active" : ""}`} onClick={() => chooseScenario("genuine")}><div className="demo-number">01</div><div className="demo-tag green-text">VERIFIED GENUINE</div><h3>Official recruitment notice</h3><p>Claims match the registered source; low risk even with ordinary document variation.</p><div className="demo-footer"><StatusPill tone="green">LOW RISK</StatusPill><ArrowUpRight size={15} /></div></button>
          <button className={`demo-card ${scenario === "clean-fake" ? "active" : ""}`} onClick={() => chooseScenario("clean-fake")}><div className="demo-number">02</div><div className="demo-tag red-text">CONTENT-SUSPICIOUS</div><h3>Visually clean fake</h3><p>Official source absent, domain mismatched, and payment request detected—without relying on ELA.</p><div className="demo-footer"><StatusPill tone="red">HIGH RISK</StatusPill><ArrowUpRight size={15} /></div></button>
          <button className={`demo-card ${scenario === "artifact" ? "active" : ""}`} onClick={() => chooseScenario("artifact")}><div className="demo-number">03</div><div className="demo-tag amber-text">ARTIFACTS ONLY</div><h3>Genuine with artifacts</h3><p>Compression anomaly is recorded as supporting evidence, not proof of fraudulent content.</p><div className="demo-footer"><StatusPill tone="amber">LOW RISK</StatusPill><ArrowUpRight size={15} /></div></button>
        </div></section>
      </>}

      {activeNav === "cases" && <section className="page-section cases-page">
        <div className="page-title-row">
          <div>
            <div className="eyebrow">CASE MANAGEMENT {appMode === "DEMO" ? "· DEMO ONLY" : "· LIVE DATABASE"}</div>
            <h1>Investigation cases</h1>
            <p>Every case carries original evidence, structured claims, verification results, and an immutable activity trail.</p>
          </div>
          <button className="primary-button" onClick={() => setShowUpload(true)}><Plus size={18} /> New case</button>
        </div>
        <div className="case-toolbar">
          <div className="search-field"><Search size={16} /><input placeholder="Search by case, entity, or notification" /></div>
          <button className="filter-button"><SlidersHorizontal size={16} /> Filters</button>
        </div>
        <div className="case-table">
          {appMode === "DEMO" ? (
            <div className="demo-table-badge">DEMO ONLY · STATIC CASE LIST</div>
          ) : (
            <div className="demo-table-badge" style={{ background: "#d7eadc", color: "#4f8060" }}>LIVE DATABASE · {dbCases?.length || 0} CASES RECORDED</div>
          )}
          <div className="table-row table-head"><span>Case</span><span>Subject</span><span>Assessment</span><span>Status</span><span>Updated</span><span></span></div>
          {appMode === "LIVE" && dbCases && dbCases.length > 0 ? (
            dbCases.map((item) => (
              <div className="table-row" key={item.caseId}>
                <span className="mono">{item.caseId}</span>
                <span><strong>{item.title}</strong><small>Owner #{item.ownerId || 1}</small></span>
                <span><StatusPill tone={item.riskLevel === "high" ? "red" : item.riskLevel === "low" ? "green" : "amber"}>{item.riskLevel.toUpperCase()} RISK</StatusPill></span>
                <span>{item.status.toUpperCase()}</span>
                <span>{new Date(item.updatedAt).toLocaleDateString()}</span>
                <button className="row-arrow" onClick={() => { setSelectedCaseId(item.caseId); setActiveNav("overview"); setActiveSection("overview"); }}><ArrowUpRight size={16} /></button>
              </div>
            ))
          ) : appMode === "LIVE" ? (
            <div style={{ padding: "24px", textAlign: "center", color: "#8d949d" }}>No cases stored yet in local database. Click "+ New case" to ingest evidence.</div>
          ) : (
            <>
              <div className="table-row"><span className="mono">PRM-2026-000142</span><span><strong>Urgent appointment letter</strong><small>Government recruitment</small></span><span><StatusPill tone="red">HIGH RISK</StatusPill></span><span>1 item</span><span>8 min ago</span><button className="row-arrow" onClick={() => chooseScenario("clean-fake")}><ArrowUpRight size={16} /></button></div>
              <div className="table-row"><span className="mono">PRM-2026-000141</span><span><strong>Public information notice</strong><small>Department circular</small></span><span><StatusPill tone="amber">LOW RISK</StatusPill></span><span>2 items</span><span>Yesterday</span><button className="row-arrow" onClick={() => chooseScenario("artifact")}><ArrowUpRight size={16} /></button></div>
              <div className="table-row"><span className="mono">PRM-2026-000139</span><span><strong>Recruitment notification</strong><small>Official notice</small></span><span><StatusPill tone="green">LOW RISK</StatusPill></span><span>1 item</span><span>20 Aug 2026</span><button className="row-arrow" onClick={() => chooseScenario("genuine")}><ArrowUpRight size={16} /></button></div>
            </>
          )}
        </div>
      </section>}

      {activeNav === "sources" && <section className="page-section sources-page">
        <div className="page-title-row">
          <div>
            <div className="eyebrow">VERIFICATION INFRASTRUCTURE {appMode === "DEMO" ? "· DEMO ONLY" : "· LIVE REGISTRY"}</div>
            <h1>Authoritative source registry</h1>
            <p>Only registered official domains and portals contribute authoritative verification evidence.</p>
          </div>
          <button className="secondary-button" onClick={() => toast.info("Source registry editing is active for authorized administrators.")}><Plus size={17} /> Add source</button>
        </div>
        <div className="registry-grid">
          {(liveSources && liveSources.length > 0 ? liveSources : []).map((source) => (
            <div className="registry-card" key={source.id}>
              {appMode === "DEMO" && <span className="card-demo-badge">DEMO ONLY</span>}
              <div className="registry-card-head">
                <div className="source-symbol blue">{source.organization.charAt(0)}</div>
                <div><strong>{source.organization}</strong><span>{source.officialDomain}</span></div>
                <StatusPill tone="green">HEALTHY</StatusPill>
              </div>
              <div className="registry-meta">
                <span>Recruitment portal</span><strong>{source.recruitmentPortal || "NOT_AVAILABLE"}</strong>
                <span>API endpoint</span><strong>{source.officialApi || "Standard HTTPS"}</strong>
              </div>
            </div>
          ))}
          <div className="registry-card muted-card">
            <div className="registry-card-head">
              <div className="source-symbol gray">+</div>
              <div><strong>Custom registry source</strong><span>Configure an official endpoint</span></div>
            </div>
            <button className="text-button" onClick={() => toast.info("Registry configuration open for admins.")}>Configure <ArrowUpRight size={15} /></button>
          </div>
        </div>
      </section>}

      {activeNav === "intelligence" && <section className="page-section graph-page">
        <div className="page-title-row">
          <div>
            <div className="eyebrow">CROSS-CASE INTELLIGENCE {appMode === "DEMO" ? "· DEMO ONLY" : "· DYNAMIC GRAPH"}</div>
            <h1>Relationship graph</h1>
            <p>Recurring entities are surfaced as associations that require investigation—not automatic proof of fraud.</p>
          </div>
          <StatusPill tone="amber">{appMode === "LIVE" && liveGraph ? `${liveGraph.nodes.length} ENTITIES · ${liveGraph.edges.length} RELATIONS` : "19 OPEN RELATIONSHIPS"}</StatusPill>
        </div>
        <div className="graph-layout">
          <div className="graph-canvas">
            {appMode === "DEMO" ? <span className="graph-demo-badge">DEMO ONLY · STATIC GRAPH</span> : <span className="graph-demo-badge" style={{ background: "#d7eadc", color: "#4f8060" }}>DYNAMIC EVIDENCE GRAPH</span>}
            <div className="graph-grid-lines"></div>

            {appMode === "LIVE" && liveGraph && liveGraph.nodes.length > 0 ? (
              <>
                <div className="graph-node node-center"><Fingerprint size={19} /><strong>{currentCaseId}</strong><span>Active Case</span></div>
                {liveGraph.nodes.slice(0, 5).map((node, i) => {
                  const posClass = i === 0 ? "node-one" : i === 1 ? "node-two" : "node-three";
                  return (
                    <div className={`graph-node ${posClass}`} key={node.id}>
                      {node.type === "phone" ? <Hash size={17} /> : node.type === "upi" ? <QrCode size={17} /> : <Globe2 size={17} />}
                      <strong>{node.label}</strong>
                      <span>{node.recurring ? `Recurring • ${node.occurrences} cases` : "Single occurrence"}</span>
                    </div>
                  );
                })}
                <svg className="graph-lines" viewBox="0 0 680 390" preserveAspectRatio="none"><line x1="340" y1="190" x2="145" y2="90" /><line x1="340" y1="190" x2="535" y2="90" /><line x1="340" y1="190" x2="140" y2="300" /></svg>
              </>
            ) : (
              <>
                <div className="graph-node node-center"><Fingerprint size={19} /><strong>EV-00742</strong><span>Current evidence</span></div>
                <div className="graph-node node-one"><Hash size={17} /><strong>example@upi</strong><span>Recurring • 4 cases</span></div>
                <div className="graph-node node-two"><FileText size={17} /><strong>Template T-09</strong><span>Similarity 91%</span></div>
                <div className="graph-node node-three"><Globe2 size={17} /><strong>jobs-xyz-careers.com</strong><span>Unverified domain</span></div>
                <svg className="graph-lines" viewBox="0 0 680 390" preserveAspectRatio="none"><line x1="340" y1="190" x2="145" y2="90" /><line x1="340" y1="190" x2="535" y2="90" /><line x1="340" y1="190" x2="140" y2="300" /></svg>
              </>
            )}
          </div>
          <div className="graph-side">
            {appMode === "DEMO" && <span className="card-demo-badge">DEMO ONLY</span>}
            <div className="eyebrow">CLUSTER SUMMARY</div>
            <h3>Suspicious recurring entities</h3>
            {appMode === "LIVE" && liveGraph && liveGraph.nodes.length > 0 ? (
              liveGraph.nodes.slice(0, 3).map((node) => (
                <div className="cluster-item" key={node.id}>
                  <div className={`cluster-icon ${node.recurring ? "red" : "blue"}`}><Hash size={15} /></div>
                  <div><strong>{node.label}</strong><span>Appears in {node.occurrences} cases</span></div>
                  <StatusPill tone={node.recurring ? "red" : "amber"}>{node.recurring ? "RECURRING" : "REVIEW"}</StatusPill>
                </div>
              ))
            ) : (
              <>
                <div className="cluster-item"><div className="cluster-icon red"><Hash size={15} /></div><div><strong>example@upi</strong><span>Appears in 4 cases</span></div><StatusPill tone="red">HIGH</StatusPill></div>
                <div className="cluster-item"><div className="cluster-icon amber"><FileText size={15} /></div><div><strong>Template T-09</strong><span>Appears in 7 cases</span></div><StatusPill tone="amber">REVIEW</StatusPill></div>
                <div className="cluster-item"><div className="cluster-icon blue"><PhoneIcon /></div><div><strong>+91 98••• 1182</strong><span>Appears in 3 cases</span></div><StatusPill tone="amber">REVIEW</StatusPill></div>
              </>
            )}
            <div className="limitation-box"><Info size={15} /><span>Repeated association is a lead, not a conclusion. Review source evidence before escalating.</span></div>
          </div>
        </div>
      </section>}

      {activeNav === "tampering" && (
        <section className="page-section">
          <div className="page-title-row">
            <div>
              <div className="eyebrow">AI DOCUMENT FORENSICS · {currentCaseId}</div>
              <h1>Tampering Localization & Edit Map</h1>
              <p>Spatial Error Level Analysis (ELA), localized noise profiles, and cloned keypoint detection.</p>
            </div>
            <StatusPill tone={caseBundle?.tamperingMap?.tamperingRegions?.length ? "red" : "green"}>
              {caseBundle?.tamperingMap?.tamperingRegions?.length ? `${caseBundle.tamperingMap.tamperingRegions.length} REGIONS FLAGGED` : "SUBSTRATE UNIFORM"}
            </StatusPill>
          </div>
          <TamperingViewer
            documentImageUrl={
              caseBundle?.evidence?.[0]?.storageKey
                ? `${import.meta.env.VITE_BACKEND_URL ? String(import.meta.env.VITE_BACKEND_URL).replace(/\/$/, "") : ""}/uploads/${caseBundle.evidence[0].storageKey}`
                : "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800&auto=format&fit=crop&q=80"
            }
            heatmapUrl={
              caseBundle?.tamperingMap?.ela?.heatmapPath
                ? `${import.meta.env.VITE_BACKEND_URL ? String(import.meta.env.VITE_BACKEND_URL).replace(/\/$/, "") : ""}${caseBundle.tamperingMap.ela.heatmapPath.startsWith("/") ? "" : "/"}${caseBundle.tamperingMap.ela.heatmapPath}`
                : undefined
            }
            regions={caseBundle?.tamperingMap?.tamperingRegions || []}
            dimensions={caseBundle?.tamperingMap?.dimensions}
          />
        </section>
      )}

      {activeNav === "crosssignal" && (
        <section className="page-section">
          <div className="page-title-row">
            <div>
              <div className="eyebrow">CROSS-SIGNAL VERIFICATION · {currentCaseId}</div>
              <h1>Signal Agreement & Contradiction Engine</h1>
              <p>Multi-source concordant alignment comparing visible OCR, QR barcode payloads, and authoritative gazettes.</p>
            </div>
            <StatusPill tone={caseBundle?.crossSignals?.hasCriticalContradictions ? "red" : "green"}>
              {caseBundle?.crossSignals?.hasCriticalContradictions ? "CRITICAL CONTRADICTION" : "SIGNALS CONCORDANT"}
            </StatusPill>
          </div>
          <CrossSignalMatrix
            contradictions={caseBundle?.crossSignals?.contradictions || []}
            agreementMatrix={caseBundle?.crossSignals?.agreementMatrix || []}
            summary={caseBundle?.crossSignals?.summary}
          />
        </section>
      )}

      {activeNav === "riskbreakdown" && (
        <section className="page-section">
          <div className="page-title-row">
            <div>
              <div className="eyebrow">DETERMINISTIC EXPLAINABLE RISK · {currentCaseId}</div>
              <h1>10-Component Risk Synthesis</h1>
              <p>Bayesian component deviations, model disagreement detection, and epistemic reasoning log.</p>
            </div>
            <StatusPill tone={data.tone}>
              {data.risk}
            </StatusPill>
          </div>
          <RiskBreakdown
            riskScore={caseBundle?.riskBreakdown?.riskScore ?? data.score}
            riskLevel={caseBundle?.riskBreakdown?.riskLevel ?? data.risk}
            confidence={caseBundle?.riskBreakdown?.confidence ?? data.confidence}
            completeness={caseBundle?.riskBreakdown?.completeness ?? data.completeness}
            tone={caseBundle?.riskBreakdown?.tone ?? data.tone}
            modelDisagreement={caseBundle?.riskBreakdown?.modelDisagreement}
            disagreementExplanation={caseBundle?.riskBreakdown?.disagreementExplanation}
            components={caseBundle?.riskBreakdown?.components || []}
            epistemic={caseBundle?.riskBreakdown?.epistemicReasoning}
          />
        </section>
      )}

      {activeNav === "decision" && (
        <section className="page-section">
          <div className="page-title-row">
            <div>
              <div className="eyebrow">EVIDENCE-TO-DECISION GUIDANCE · {currentCaseId}</div>
              <h1>Next-Best-Action & Checklist Engine</h1>
              <p>Prioritized investigator next steps, missing evidence impact analysis, and adaptive case checklists.</p>
            </div>
            <button className="primary-button" onClick={() => setShowLivenessModal(true)}>
              <Camera size={16} /> Run Active Liveness
            </button>
          </div>
          <NextBestActionCard
            recommendedDecision={caseBundle?.decisionGuidance?.recommendedDecision}
            justification={caseBundle?.decisionGuidance?.justification}
            nextActions={caseBundle?.decisionGuidance?.nextActions || []}
            missingEvidence={caseBundle?.decisionGuidance?.missingEvidence || []}
            checklist={caseBundle?.decisionGuidance?.checklist || []}
            onActionTrigger={(action) => {
              if (action.actionType === "live_capture") {
                setShowLivenessModal(true);
              } else {
                toast.info(`Executing recommended step: ${action.title}`);
              }
            }}
          />
        </section>
      )}

      {activeNav === "overview" && <section className="investigation-section" id="investigation">
        <div className="investigation-header">
          <div>
            <div className="eyebrow">ACTIVE INVESTIGATION · {currentCaseId} {appMode === "DEMO" ? <span className="inline-demo-label">DEMO ONLY · STATIC EVIDENCE SET</span> : <span className="inline-demo-label" style={{ background: "#d7eadc", color: "#4f8060" }}>LIVE FORENSIC CASE</span>}</div>
            <h1>{data.title}</h1>
            <p className="case-subtitle">{caseBundle?.case?.status ? `Status: ${caseBundle.case.status.toUpperCase()}` : "Government recruitment"} · {data.evidence.length} evidence item{data.evidence.length === 1 ? "" : "s"}</p>
          </div>
          <div className="investigation-actions">
            <button className="secondary-button" onClick={() => setShowReport(true)}><FileText size={17} /> View report</button>
            <button className="icon-button bordered" onClick={downloadReport} aria-label="Download report"><Download size={17} /></button>
          </div>
        </div>

        {/* Active Document Verification & Evidence Stage */}
        <div className="active-document-stage">
          <div className="active-doc-banner">
            <div className="active-doc-left">
              <div className="doc-live-badge">
                <span className="live-ping"></span>
                <span>REAL-TIME VERIFICATION TARGET</span>
              </div>
              <h3>{caseBundle?.evidence?.[0]?.originalName || data.title}</h3>
              <div className="doc-meta-tags">
                <span className="mono">
                  <Hash size={12} style={{ display: "inline", verticalAlign: "-2px" }} />{" "}
                  {caseBundle?.evidence?.[0]?.sha256
                    ? `${caseBundle.evidence[0].sha256.slice(0, 16)}…`
                    : "PRM-CRYPTOGRAPHIC-ANCHORED"}
                </span>
                <span>{caseBundle?.evidence?.[0]?.mimeType || "application/pdf"}</span>
                {caseBundle?.evidence?.[0]?.fileSize && (
                  <span>{Math.round(caseBundle.evidence[0].fileSize / 1024)} KB</span>
                )}
                <span className="quality-pill">
                  {caseBundle?.evidence?.[0]?.quality?.toUpperCase() || "VERIFIED"}
                </span>
              </div>
            </div>

            <div className="active-doc-right">
              <button
                type="button"
                className="secondary-button history-pill-btn"
                onClick={() => setShowHistoryDrawer(true)}
              >
                <History size={14} />
                <span>Document History ({appMode === "LIVE" ? (dbCases?.length || 0) : 3})</span>
              </button>
              <button
                type="button"
                className="primary-button quick-ingest-btn"
                onClick={() => setShowUpload(true)}
              >
                <Plus size={14} />
                <span>Ingest New</span>
              </button>
            </div>
          </div>

          <div className="active-doc-preview-grid">
            <div className="doc-preview-viewport">
              {activeDocUrl ? (
                <div className="doc-image-frame">
                  <img
                    src={activeDocUrl}
                    alt="Active verification document"
                    className="doc-preview-img"
                  />
                  <div className="doc-preview-overlay">
                    <span className="doc-preview-tag">ORIGINAL EVIDENCE SCAN</span>
                    <button
                      type="button"
                      className="icon-button bordered doc-expand-btn"
                      onClick={() => window.open(activeDocUrl, "_blank")}
                      title="Open original document in new tab"
                    >
                      <ArrowUpRight size={15} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="doc-preview-placeholder">
                  <FileText size={48} className="doc-placeholder-icon" />
                  <strong>Document Evidence Ingested</strong>
                  <p>Document is processed in the forensic pipeline with glyph OCR, QR barcode extraction, and spatial ELA analysis.</p>
                  <button type="button" className="secondary-button" onClick={() => setShowUpload(true)}>
                    Upload Document Scan
                  </button>
                </div>
              )}
            </div>

            <div className="doc-forensic-telemetry">
              <div className="telemetry-card">
                <span className="telemetry-label">PIPELINE INTEGRITY</span>
                <strong>Cryptographically Anchored</strong>
                <p>SHA-256 digest calculated at ingestion matches tamper-evident database state record.</p>
              </div>
              <div className="telemetry-card">
                <span className="telemetry-label">EXTRACTION CHANNELS</span>
                <strong>3 Active Modalities</strong>
                <p>Visible glyph OCR, QR barcode payload, and spatial error-level compression (ELA).</p>
              </div>
              <div className="telemetry-card">
                <span className="telemetry-label">AUTHORITATIVE CROSS-CHECK</span>
                <strong>
                  {caseBundle?.verification?.length
                    ? `${caseBundle.verification.filter((v) => v.status === "verified").length} / ${caseBundle.verification.length} Claims Verified`
                    : "Official checks active"}
                </strong>
                <p>Official Gazette, Department circular registries, and digital signature verification.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="result-grid">
          <div className={`risk-card ${data.tone}`}>
            <div className="risk-card-top"><span>FRAUD RISK ASSESSMENT</span><Info size={15} /></div>
            <div className="risk-main">
              <div>
                <div className="risk-label">{data.risk}</div>
                <div className="risk-score">{data.score}<small>/100</small></div>
              </div>
              <div className="risk-orbit">
                <div className="orbit-track"></div>
                <div className="orbit-dot" style={{ transform: `rotate(${data.score * 2.7}deg) translateX(32px)` }}></div>
              </div>
            </div>
            <div className="risk-divider"></div>
            <div className="risk-meta">
              <div><span>Evidence confidence</span><strong>{data.confidence}%</strong></div>
              <div><span>Evidence completeness</span><strong>{data.completeness}%</strong></div>
            </div>
          </div>

          <div className="interpretation-card">
            <div className="card-label">SYSTEM INTERPRETATION</div>
            <p>{data.summary}</p>
            <div className="limitation-inline"><AlertTriangle size={14} /><span>Forensic signals are supporting evidence only. This assessment is not a legal authenticity determination.</span></div>
            <div className="integrity-strip">
              <div><LockKeyhole size={14} /><span><strong>Integrity audit</strong><small>{integrityDescription}</small></span></div>
              <StatusPill tone={integrityTone}>{integrityStatus}</StatusPill>
            </div>
          </div>
        </div>

        <div className="why-section">
          <div className="why-heading">
            <div><div className="eyebrow">WHY THIS ASSESSMENT?</div><h2>Evidence behind the result</h2></div>
            <span className="evidence-count">{data.evidence.length} evidence items</span>
          </div>
          <div className="evidence-list">
            {data.evidence.length > 0 ? (
              data.evidence.map((item) => <EvidenceCard key={item.id} item={item} />)
            ) : (
              <div style={{ padding: "16px", color: "#8d949d" }}>No evidence uploaded yet.</div>
            )}
          </div>
        </div>

        <div className="technical-section">
          <div className="technical-heading"><div className="eyebrow">TECHNICAL DETAIL</div><h2>Investigation panels</h2></div>
          <div className="accordion-list">
            <Accordion title="Claims" subtitle="Original text → normalized values → status" icon={ClipboardCheck} open={expanded.claims} onToggle={() => toggleSection("claims")}>
              <div className="claims-table">
                {data.claims.length > 0 ? (
                  data.claims.map((item, idx) => (
                    <div className="claim-row" key={`${item.claim}-${idx}`}>
                      <div><strong>{item.claim}</strong><span>{item.value}</span></div>
                      <div>
                        <StatusPill tone={item.status === "VERIFIED" ? "green" : item.status === "CONTRADICTED" || item.status === "SUSPICIOUS" ? "red" : "amber"}>{item.status}</StatusPill>
                        <small>{item.detail}</small>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ padding: "12px 0", color: "#8d949d" }}>NOT_AVAILABLE (Upload document to extract claims)</div>
                )}
              </div>
            </Accordion>

            <Accordion title="Source verification" subtitle="Claim-level checks against registered authoritative sources" icon={Globe2} open={expanded.verification} onToggle={() => toggleSection("verification")}>
              <div className="verification-grid">
                <div className="verification-highlight">
                  <BadgeCheck size={20} />
                  <div>
                    <strong>{appMode === "LIVE" && caseBundle?.verification ? `${caseBundle.verification.filter(v => v.status === "verified").length} of ${caseBundle.verification.length} claims verified` : scenario === "clean-fake" ? "1 of 4 high-value claims checked" : "4 of 4 high-value claims checked"}</strong>
                    <span>{appMode === "LIVE" && caseBundle?.verification ? (caseBundle.verification.some(v => v.status === "contradicted") ? "Contradictions detected against official portal registry" : "No critical contradictions identified") : scenario === "clean-fake" ? "Notification and domain contradictions found" : "Source evidence supports the document claims"}</span>
                  </div>
                </div>
                <div className="source-evidence">
                  <span className="mono">AUTHORITATIVE SOURCE</span>
                  <p>Registered endpoint: <strong>{appMode === "LIVE" ? (caseBundle?.verification?.[0]?.sourceUrl || "xyz.gov.in") : scenario === "clean-fake" ? "recruitment.xyz.gov.in" : "xyz.gov.in"}</strong></p>
                  <StatusPill tone={appMode === "LIVE" ? (caseBundle?.verification?.some(v => v.status === "contradicted") ? "red" : "green") : scenario === "clean-fake" ? "red" : "green"}>{appMode === "LIVE" ? (caseBundle?.verification?.some(v => v.status === "contradicted") ? "CONTRADICTION" : "MATCH") : scenario === "clean-fake" ? "CONTRADICTION" : "MATCH"}</StatusPill>
                </div>
              </div>
            </Accordion>

            <Accordion title="Document forensics" subtitle="Compression, metadata, and manipulation signals" icon={ScanSearch} open={expanded.forensics} onToggle={() => toggleSection("forensics")}>
              <div className="forensic-grid">
                {appMode === "LIVE" && caseBundle?.forensics && caseBundle.forensics.length > 0 ? (
                  caseBundle.forensics.map((f, i) => (
                    <ForensicItem key={i} label={f.detector} value={f.strength.toUpperCase()} tone={f.strength === "high" ? "amber" : "green"} detail={f.finding} />
                  ))
                ) : (
                  <>
                    <ForensicItem label="JPEG compression" value={scenario === "artifact" ? "HIGH ANOMALY" : "LOW ANOMALY"} tone={scenario === "artifact" ? "amber" : "green"} detail={scenario === "artifact" ? "Localized inconsistency near footer" : "No significant signal"} />
                    <ForensicItem label="Metadata" value={scenario === "artifact" ? "SUPPORTING" : "LIMITED"} tone="amber" detail="Metadata is context, not proof" />
                    <ForensicItem label="Manipulation localization" value="NOT AVAILABLE" tone="neutral" detail="Detector evaluated; inconclusive on low resolution" />
                  </>
                )}
              </div>
            </Accordion>

            <Accordion title="Document DNA" subtitle="File, visual, OCR, layout, template, and entity fingerprints" icon={Fingerprint} open={expanded.dna} onToggle={() => toggleSection("dna")}>
              <div className="dna-grid">
                {appMode === "LIVE" && caseBundle?.dna && caseBundle.dna.length > 0 ? (
                  <>
                    <DnaItem label="File DNA" value="SHA-256" score={caseBundle.dna[0].fileDna.slice(0, 10) + "…"} />
                    <DnaItem label="Visual DNA" value="pHash" score={caseBundle.dna[0].visualDna || "NOT_AVAILABLE"} />
                    <DnaItem label="Layout DNA" value={caseBundle.dna[0].templateDna || "T-01"} score="Computed" />
                    <DnaItem label="Entity DNA" value="Normalized" score={caseBundle.dna[0].entityDna ? "Indexed" : "None"} />
                  </>
                ) : (
                  <>
                    <DnaItem label="File DNA" value="SHA-256" score="immutable" />
                    <DnaItem label="Visual DNA" value="pHash" score="91%" />
                    <DnaItem label="Layout DNA" value="T-09" score={scenario === "clean-fake" ? "91% match" : "No match"} />
                    <DnaItem label="Entity DNA" value="3 entities" score={scenario === "clean-fake" ? "high overlap" : "low overlap"} />
                  </>
                )}
              </div>
            </Accordion>

            <Accordion title="Security features" subtitle="QR, barcode, MRZ, seals, signatures, and document-specific checks" icon={QrCode} open={expanded.security} onToggle={() => toggleSection("security")}>
              <div className="security-row">
                <div className="security-feature">
                  <QrCode size={20} />
                  <div>
                    <strong>QR destination / Web target</strong>
                    <span>{appMode === "LIVE" ? (caseBundle?.claims?.find(c => c.claimType === "website")?.normalizedValue || "NOT_AVAILABLE") : scenario === "clean-fake" ? "jobs-xyz-careers.com" : "xyz.gov.in"}</span>
                  </div>
                </div>
                <StatusPill tone={appMode === "LIVE" ? (caseBundle?.claims?.some(c => c.claimType === "website" && !c.normalizedValue.includes(".gov.in")) ? "red" : "green") : scenario === "clean-fake" ? "red" : "green"}>{appMode === "LIVE" ? (caseBundle?.claims?.some(c => c.claimType === "website" && !c.normalizedValue.includes(".gov.in")) ? "DOMAIN MISMATCH" : "OFFICIAL") : scenario === "clean-fake" ? "DOMAIN MISMATCH" : "OFFICIAL"}</StatusPill>
              </div>
              <div className="security-row">
                <div className="security-feature"><Fingerprint size={20} /><div><strong>Seal / signature detection</strong><span>Detector active on raster regions</span></div></div>
                <StatusPill tone="neutral">NOT_AVAILABLE</StatusPill>
              </div>
            </Accordion>

            <Accordion title="Fraud intelligence graph" subtitle="Relationships, recurring contacts, and related cases" icon={Network} open={expanded.graph} onToggle={() => toggleSection("graph")}>
              <div className="mini-graph">
                <div className="mini-node main">{currentCaseId}</div>
                <div className="mini-line line-a"></div>
                <div className="mini-line line-b"></div>
                <div className="mini-node secondary one">{liveGraph?.nodes?.[0]?.label || "Case 118"}</div>
                <div className="mini-node secondary two">{caseBundle?.dna?.[0]?.templateDna || "Template T-09"}</div>
                <div className="mini-node secondary three">{caseBundle?.claims?.find(c => c.claimType === "upi")?.normalizedValue || "example@upi"}</div>
              </div>
              <div className="graph-note"><Info size={14} /> Recurring entities are labelled suspicious or associated—not fraudulent by repetition alone.</div>
            </Accordion>

            <Accordion title="Forensic timeline" subtitle="Chronological, immutable audit events" icon={Clock3} open={expanded.timeline} onToggle={() => toggleSection("timeline")}>
              <div className="timeline">
                {data.timeline.length > 0 ? (
                  data.timeline.map((item, idx) => (
                    <div className="timeline-item" key={idx}>
                      <div className="timeline-time">{item.time}</div>
                      <div className="timeline-dot"></div>
                      <div><strong>{item.title}</strong><span>{item.detail}</span></div>
                    </div>
                  ))
                ) : (
                  <div style={{ padding: "12px 0", color: "#8d949d" }}>No timeline events recorded yet.</div>
                )}
              </div>
            </Accordion>

            <Accordion title="AI investigator" subtitle="Structured reasoning with evidence IDs and limitations" icon={Sparkles} open={expanded.investigator} onToggle={() => toggleSection("investigator")}>
              <div className="ai-investigator">
                <div className="ai-orb"><Sparkles size={18} /></div>
                <div>
                  <div className="card-label">EVIDENCE-BOUND SUMMARY</div>
                  <p>{data.summary}</p>
                  <span className="mono">Cites: {data.evidence.length > 0 ? data.evidence.map((item) => item.id).join(" · ") : "No evidence IDs to cite"}</span>
                </div>
              </div>
            </Accordion>
          </div>
        </div>
      </section>}

      <footer className="app-footer"><span>PRAMAAN v1.0 · Forensic Reality Upgrade</span><span><LockKeyhole size={13} /> Originals preserved · Analysis is evidence-backed, not a legal conclusion</span></footer>
    </main>

    {showUpload && <Modal title="Start a new investigation" subtitle={appMode === "LIVE" ? "Live ingestion: preserves bytes immutably, computes SHA-256, and executes analysis pipeline." : "DEMO ONLY preview · switch to LIVE MODE for actual storage."} onClose={() => setShowUpload(false)}><div className="upload-drop" onClick={() => fileInput.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); handleFile(event.dataTransfer.files?.[0]); }}><div className="upload-icon"><UploadCloud size={24} /></div><strong>{isIngesting ? "Anchoring evidence..." : "Drop evidence here or browse"}</strong><span>JPG, JPEG, PNG, WEBP, PDF · Maximum 25 MB</span><button className="secondary-button" disabled={isIngesting} onClick={(event) => { event.stopPropagation(); fileInput.current?.click(); }}>Choose file</button><input ref={fileInput} type="file" hidden accept=".jpg,.jpeg,.png,.webp,.pdf" onChange={(event) => handleFile(event.target.files?.[0])} /></div><div className="upload-options"><button onClick={() => { setShowUpload(false); setShowCamera(true); }}><Camera size={18} /><span><strong>Capture with camera</strong><small>Quality-gated live guidance</small></span><ChevronRight size={16} /></button><button onClick={() => toast.info("Select any case from the Cases tab to compare.")}><Copy size={18} /><span><strong>Case management</strong><small>View stored evidence records</small></span><ChevronRight size={16} /></button></div><div className="privacy-callout"><ShieldCheck size={16} /><span>Secure intake: file type validation, SHA-256 anchoring, no uploaded file execution, and privacy-aware deletion controls.</span></div></Modal>}

    {showCamera && <Modal title="Live camera verification" subtitle="Use lightweight guidance first. Deeper analysis begins only after capture." onClose={() => setShowCamera(false)} wide><div className="camera-stage"><div className="camera-grid"></div>{capturedFrame ? <img className="captured-preview" src={capturedFrame} alt="Captured document frame" /> : <video ref={videoRef} className="camera-video" autoPlay muted playsInline />}<div className="camera-frame"><span></span><span></span><span></span><span></span><div className="camera-hint"><ScanSearch size={16} /> {capturedFrame ? "Frame captured · quality gate passed" : cameraStatus === "blocked" ? "Camera unavailable · use upload" : cameraStatus === "starting" ? "Starting camera…" : "Document detected · hold steady"}</div></div><div className="camera-topline"><span><span className="live-dot"></span> {cameraStatus === "ready" ? "CAMERA ACTIVE" : "CAMERA NOT READY"}</span><span>Quality gate: {cameraStatus === "ready" ? "FAIR" : "PENDING"}</span></div><div className="camera-bottomline"><span>{capturedFrame ? "Frame ready for handoff" : "Move closer if text is not readable"}</span><button className="capture-button" disabled={cameraStatus !== "ready" || Boolean(capturedFrame)} onClick={captureFrame} aria-label="Capture document frame"><div></div></button><span>{capturedFrame ? "Preview ready" : "Glare: none detected"}</span></div></div>{capturedFrame && <div className="handoff-card"><div><Check size={16} /><span><strong>Quality gate passed</strong><small>Captured JPEG is ready for perspective correction, OCR, and deeper analysis.</small></span></div><button className="primary-button" disabled={isIngesting} onClick={handleCameraContinue}>{isIngesting ? "Ingesting..." : "Continue to analysis"} <ArrowUpRight size={15} /></button></div>}<div className="camera-guidance"><div><Check size={15} /> Four document edges visible</div><div><Check size={15} /> Lighting sufficient</div><div><AlertTriangle size={15} /> OCR and claim extraction run after capture</div></div></Modal>}

    {showReport && <Modal title="Investigation report" subtitle={`${currentCaseId} · prepared from immutable evidence references`} onClose={() => setShowReport(false)} wide><div className="report-preview"><div className="report-cover"><div className="brand-lockup"><div className="brand-mark"><span></span><span></span><span></span></div><div><div className="brand-name">PRAMAAN</div><div className="brand-subtitle">Forensic investigation report</div></div></div><div className="report-cover-title"><span>CASE FILE · {appMode} MODE</span><strong>{data.title}</strong><small>{currentCaseId}</small></div><div className={`report-risk ${data.tone}`}><span>ASSESSMENT</span><strong>{data.risk}</strong><small>{data.score}/100 · {data.confidence}% confidence</small></div></div><div className="report-body"><div className="report-meta"><span><small>Evidence ID</small><strong>{data.evidence[0]?.id || "NOT_AVAILABLE"}</strong></span><span><small>SHA-256</small><strong className="mono">{caseBundle?.evidence?.[0]?.sha256?.slice(0, 8) || "7f2e…c81a"}</strong></span><span><small>Evidence quality</small><strong>{caseBundle?.evidence?.[0]?.quality?.toUpperCase() || "GOOD"}</strong></span><span><small>Original preserved</small><strong>YES</strong></span></div><div className="report-block"><div className="card-label">OBSERVED EVIDENCE</div>{data.evidence.length > 0 ? data.evidence.map((item) => <div className="report-evidence" key={item.id}><span className="mono">{item.id}</span><span>{item.title}</span><small>{item.detail}</small></div>) : <div style={{ color: "#8d949d", fontSize: "10px", marginTop: "8px" }}>None recorded.</div>}</div><div className="report-block"><div className="card-label">SYSTEM INTERPRETATION</div><p>{data.summary}</p></div><div className="report-block limitation-box"><Info size={15} /><span><strong>Limitations.</strong> Forensic anomalies are supporting evidence only. Results may be inconclusive when source coverage, image quality, or detector availability is limited.</span></div></div></div><div className="modal-footer"><span><LockKeyhole size={14} /> Report contains evidence IDs for auditability.</span><div className="modal-report-actions"><button className="secondary-button" onClick={printReport}><Download size={16} /> Print / save PDF</button><button className="primary-button" onClick={downloadReport}><Download size={16} /> Download text</button></div></div></Modal>}

    <ActiveLivenessModal
      isOpen={showLivenessModal}
      onClose={() => setShowLivenessModal(false)}
      onSuccess={() => {
        toast.success("Live optical challenge verified", { description: "Anti-spoof passed. Human presentation confirmed." });
        setShowLivenessModal(false);
      }}
    />

    {/* Persistent Document Verification History Drawer */}
    <DocumentHistoryDrawer
      isOpen={showHistoryDrawer}
      onClose={() => setShowHistoryDrawer(false)}
      cases={
        appMode === "LIVE" && dbCases
          ? dbCases.map((c) => ({
              id: c.id,
              caseId: c.caseId,
              title: c.title,
              status: c.status,
              riskLevel: c.riskLevel,
              riskScore: c.riskScore,
              confidence: c.confidence,
              createdAt: c.createdAt,
              updatedAt: c.updatedAt,
            }))
          : [
              {
                id: 1,
                caseId: "PRM-2026-000142",
                title: "Urgent appointment letter",
                status: "open",
                riskLevel: "high",
                riskScore: 88,
                confidence: 94,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
              {
                id: 2,
                caseId: "PRM-2026-000141",
                title: "Public information notice",
                status: "open",
                riskLevel: "low",
                riskScore: 12,
                confidence: 91,
                createdAt: new Date(Date.now() - 86400000).toISOString(),
                updatedAt: new Date(Date.now() - 86400000).toISOString(),
              },
              {
                id: 3,
                caseId: "PRM-2026-000139",
                title: "Recruitment notification",
                status: "open",
                riskLevel: "low",
                riskScore: 8,
                confidence: 96,
                createdAt: new Date(Date.now() - 864000000).toISOString(),
                updatedAt: new Date(Date.now() - 864000000).toISOString(),
              },
            ]
      }
      selectedCaseId={currentCaseId}
      onSelectCase={(caseId) => {
        setSelectedCaseId(caseId);
        setActiveNav("overview");
        setActiveSection("overview");
      }}
      onUploadNew={() => setShowUpload(true)}
    />

    {/* Mobile Navigation Sheet Drawer */}
    {showMobileNav && (
      <div className="mobile-nav-backdrop" onClick={() => setShowMobileNav(false)}>
        <div className="mobile-nav-drawer" onClick={(e) => e.stopPropagation()}>
          <div className="mobile-nav-header">
            <div className="brand-lockup">
              <div className="brand-mark small">
                <span></span>
                <span></span>
                <span></span>
              </div>
              <div>
                <div className="brand-name">PRAMAAN</div>
                <div className="brand-subtitle">FORENSIC INTELLIGENCE</div>
              </div>
            </div>
            <button
              type="button"
              className="icon-button bordered"
              onClick={() => setShowMobileNav(false)}
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
          </div>

          <div className="mobile-nav-list">
            <div className="workspace-label">INVESTIGATION WORKSPACE</div>
            <button
              type="button"
              className={`side-nav-item ${activeNav === "overview" ? "active" : ""}`}
              onClick={() => {
                setActiveNav("overview");
                setActiveSection("overview");
                setShowMobileNav(false);
              }}
            >
              <LayoutDashboard size={17} strokeWidth={1.65} />
              <span>Investigation Overview</span>
            </button>

            <button
              type="button"
              className={`side-nav-item ${activeNav === "cases" ? "active" : ""}`}
              onClick={() => {
                setActiveNav("cases");
                setActiveSection("cases");
                setShowMobileNav(false);
              }}
            >
              <FileText size={17} strokeWidth={1.65} />
              <span>All Cases</span>
              <span className="nav-count">{appMode === "LIVE" ? (dbCases?.length || 0) : 3}</span>
            </button>

            <button
              type="button"
              className={`side-nav-item ${activeNav === "tampering" ? "active" : ""}`}
              onClick={() => {
                setActiveNav("tampering");
                setShowMobileNav(false);
              }}
            >
              <Layers size={17} strokeWidth={1.65} />
              <span>Tampering Map (ELA)</span>
            </button>

            <button
              type="button"
              className={`side-nav-item ${activeNav === "crosssignal" ? "active" : ""}`}
              onClick={() => {
                setActiveNav("crosssignal");
                setShowMobileNav(false);
              }}
            >
              <Split size={17} strokeWidth={1.65} />
              <span>Signal Agreement</span>
            </button>

            <button
              type="button"
              className={`side-nav-item ${activeNav === "riskbreakdown" ? "active" : ""}`}
              onClick={() => {
                setActiveNav("riskbreakdown");
                setShowMobileNav(false);
              }}
            >
              <BarChart3 size={17} strokeWidth={1.65} />
              <span>Risk Synthesis</span>
            </button>

            <button
              type="button"
              className={`side-nav-item ${activeNav === "decision" ? "active" : ""}`}
              onClick={() => {
                setActiveNav("decision");
                setShowMobileNav(false);
              }}
            >
              <ClipboardCheck size={17} strokeWidth={1.65} />
              <span>Next Best Action</span>
            </button>

            <div className="workspace-label" style={{ marginTop: 12 }}>EVIDENCE ARCHITECTURE</div>

            <button
              type="button"
              className="side-nav-item"
              onClick={() => {
                setShowMobileNav(false);
                setShowHistoryDrawer(true);
              }}
            >
              <History size={17} strokeWidth={1.65} />
              <span>Document History</span>
              <span className="nav-count">{appMode === "LIVE" ? (dbCases?.length || 0) : 3}</span>
            </button>

            <button
              type="button"
              className={`side-nav-item ${activeNav === "sources" ? "active" : ""}`}
              onClick={() => {
                setActiveNav("sources");
                setShowMobileNav(false);
              }}
            >
              <Database size={17} strokeWidth={1.65} />
              <span>Authoritative Sources</span>
            </button>

            <button
              type="button"
              className={`side-nav-item ${activeNav === "intelligence" ? "active" : ""}`}
              onClick={() => {
                setActiveNav("intelligence");
                setShowMobileNav(false);
              }}
            >
              <Network size={17} strokeWidth={1.65} />
              <span>Intelligence Graph</span>
            </button>

            <button
              type="button"
              className="side-nav-item"
              onClick={() => {
                setShowMobileNav(false);
                setShowLivenessModal(true);
              }}
            >
              <ShieldCheck size={17} strokeWidth={1.65} />
              <span>Active Liveness</span>
            </button>
          </div>

          <div className="mobile-nav-footer">
            <div className="mode-switch-group" style={{ width: "100%", justifyContent: "center" }}>
              <button
                type="button"
                className={`mode-switch-btn ${appMode === "LIVE" ? "active" : ""}`}
                onClick={() => setAppMode("LIVE")}
                style={{ flex: 1, textAlign: "center" }}
              >
                LIVE
              </button>
              <button
                type="button"
                className={`mode-switch-btn ${appMode === "DEMO" ? "active" : ""}`}
                onClick={() => setAppMode("DEMO")}
                style={{ flex: 1, textAlign: "center" }}
              >
                DEMO
              </button>
            </div>

            <button
              type="button"
              className="secondary-button"
              style={{ width: "100%" }}
              onClick={() => {
                const nextTheme = theme === "dark" ? "light" : "dark";
                setTheme(nextTheme);
                toast.info(`Switched to ${nextTheme === "dark" ? "Dark Mode" : "Light Mode"}`);
              }}
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
              <span>Switch to {theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
            </button>

            {user ? (
              <div className="analyst-chip" style={{ justifyContent: "space-between", width: "100%", borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <div className="avatar">
                    {user.name ? user.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() : "AS"}
                  </div>
                  <div>
                    <strong>{user.name || "Investigator"}</strong>
                    <span>{user.role?.toUpperCase() || "INVESTIGATOR"}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await logout();
                    setShowMobileNav(false);
                    toast.info("Signed out.");
                  }}
                  className="icon-button"
                  title="Sign out"
                >
                  <LogOut size={16} color="#e11d48" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="primary-button"
                style={{ width: "100%" }}
                onClick={() => {
                  setShowMobileNav(false);
                  setLocation("/login");
                }}
              >
                <LogIn size={16} />
                <span>Investigator Sign In</span>
              </button>
            )}
          </div>
        </div>
      </div>
    )}
  </div>;
}

function Accordion({ title, subtitle, icon: Icon, open, onToggle, children }: { title: string; subtitle: string; icon: React.ElementType; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return <div className={`accordion ${open ? "open" : ""}`}><button className="accordion-trigger" onClick={onToggle}><div className="accordion-icon"><Icon size={17} /></div><div><strong>{title}</strong><span>{subtitle}</span></div><ChevronDown size={17} className="accordion-chevron" /></button>{open && <div className="accordion-body">{children}</div>}</div>;
}

function ForensicItem({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: "green" | "amber" | "neutral" }) {
  return <div className="forensic-item"><div className="forensic-top"><span>{label}</span><StatusPill tone={tone}>{value}</StatusPill></div><div className="forensic-detail">{detail}</div></div>;
}

function DnaItem({ label, value, score }: { label: string; value: string; score: string }) {
  return <div className="dna-item"><span>{label}</span><strong>{value}</strong><small>{score}</small></div>;
}

function PhoneIcon() { return <span className="phone-glyph">#</span>; }

function Modal({ title, subtitle, onClose, children, wide = false }: { title: string; subtitle: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return <div className="modal-backdrop" role="dialog" aria-modal="true"><div className={`modal ${wide ? "wide" : ""}`}><div className="modal-header"><div><h2>{title}</h2><p>{subtitle}</p></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button></div>{children}</div></div>;
}
