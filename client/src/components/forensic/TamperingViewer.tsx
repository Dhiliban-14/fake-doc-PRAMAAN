import React, { useState } from "react";
import { ShieldAlert, Info, ZoomIn, ZoomOut, Layers, AlertTriangle } from "lucide-react";

export interface BoundingBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TamperingRegion {
  regionIndex: number;
  anomalyType: string;
  severity: "low" | "medium" | "high" | "critical";
  probability: number;
  confidence: number;
  bbox: BoundingBox;
  whyFlagged: string;
  supportingSignals: string[];
  alternativeExplanations: string[];
  detectorModel: string;
}

interface Props {
  documentImageUrl: string;
  heatmapUrl?: string | null;
  regions?: TamperingRegion[];
  dimensions?: { width: number; height: number };
}

export const TamperingViewer: React.FC<Props> = ({
  documentImageUrl,
  heatmapUrl,
  regions = [],
  dimensions,
}) => {
  const [zoom, setZoom] = useState<number>(1.0);
  const [showOverlay, setShowOverlay] = useState<boolean>(true);
  const [selectedRegion, setSelectedRegion] = useState<TamperingRegion | null>(
    regions.length > 0 ? regions[0] : null
  );

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "#ef4444";
      case "high":
        return "#f97316";
      case "medium":
        return "#eab308";
      default:
        return "#3b82f6";
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-[680px] bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
      {/* Interactive Forensic Canvas */}
      <div className="relative flex-1 bg-black/95 overflow-auto flex items-center justify-center p-4">
        <div
          className="relative transition-transform duration-100 ease-out"
          style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }}
        >
          {/* Base Document Image */}
          <img
            src={documentImageUrl}
            alt="Evidence Document"
            className="max-w-[560px] max-h-[580px] object-contain select-none pointer-events-none rounded shadow-md border border-slate-800"
          />

          {/* ELA / Tampering Residual Heatmap */}
          {showOverlay && heatmapUrl && (
            <img
              src={heatmapUrl}
              alt="Forensic ELA Heatmap"
              className="absolute inset-0 w-full h-full object-contain opacity-55 mix-blend-screen pointer-events-none"
            />
          )}

          {/* SVG Bounding Boxes Overlay */}
          <svg className="absolute inset-0 w-full h-full pointer-events-auto">
            {regions.map((region) => {
              const color = getSeverityColor(region.severity);
              const isSelected = selectedRegion?.regionIndex === region.regionIndex;
              return (
                <rect
                  key={region.regionIndex}
                  x={`${region.bbox.x * 100}%`}
                  y={`${region.bbox.y * 100}%`}
                  width={`${region.bbox.w * 100}%`}
                  height={`${region.bbox.h * 100}%`}
                  fill={isSelected ? `${color}44` : `${color}18`}
                  stroke={color}
                  strokeWidth={isSelected ? 3 : 1.5}
                  strokeDasharray={region.severity === "critical" ? "none" : "4 2"}
                  className="cursor-pointer transition-all duration-150"
                  onClick={() => setSelectedRegion(region)}
                />
              );
            })}
          </svg>
        </div>

        {/* Viewport Control Strip */}
        <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-slate-900/90 backdrop-blur border border-slate-700 px-3 py-1.5 rounded-lg shadow-lg z-10">
          <button
            onClick={() => setZoom((z) => Math.max(0.6, z - 0.2))}
            className="p-1 text-slate-400 hover:text-white"
            title="Zoom Out"
          >
            <ZoomOut size={16} />
          </button>
          <span className="text-xs font-mono text-slate-300 w-12 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom((z) => Math.min(3.0, z + 0.2))}
            className="p-1 text-slate-400 hover:text-white"
            title="Zoom In"
          >
            <ZoomIn size={16} />
          </button>
          <div className="h-4 w-px bg-slate-700 mx-1" />
          <button
            onClick={() => setShowOverlay(!showOverlay)}
            className={`flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded ${
              showOverlay
                ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/40"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Layers size={14} /> ELA Heatmap
          </button>
        </div>

        {regions.length === 0 && (
          <div className="absolute top-4 right-4 bg-emerald-950/80 border border-emerald-800/80 px-3 py-1.5 rounded-lg text-emerald-300 text-xs font-mono flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Substrate compression consistent
          </div>
        )}
      </div>

      {/* Forensic Region Explanation Sidebar */}
      <div className="w-full lg:w-80 bg-slate-900/95 border-t lg:border-t-0 lg:border-l border-slate-800 flex flex-col p-4 overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="text-amber-400" size={18} />
            <h4 className="text-xs font-bold text-slate-100 uppercase tracking-wider">
              Tampering Inspector
            </h4>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            {regions.length} Regions Flagged
          </span>
        </div>

        {selectedRegion ? (
          <div className="space-y-3.5 text-xs">
            <div>
              <span className="text-[10px] text-slate-400 font-mono">ANOMALY CLASSIFICATION</span>
              <h5 className="text-sm font-bold text-white capitalize mt-0.5">
                {selectedRegion.anomalyType.replace(/_/g, " ")}
              </h5>
              <div className="flex items-center gap-2 mt-1.5">
                <span
                  className="px-2 py-0.5 text-[10px] font-bold rounded"
                  style={{
                    backgroundColor: `${getSeverityColor(selectedRegion.severity)}22`,
                    color: getSeverityColor(selectedRegion.severity),
                  }}
                >
                  {selectedRegion.severity.toUpperCase()}
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  Probability: {(selectedRegion.probability * 100).toFixed(0)}%
                </span>
              </div>
            </div>

            <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg">
              <span className="text-[11px] font-semibold text-slate-300 block mb-1">
                Why Region Was Flagged
              </span>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                {selectedRegion.whyFlagged}
              </p>
            </div>

            <div>
              <span className="text-[11px] font-semibold text-slate-400 block mb-1">
                Supporting Signals
              </span>
              <ul className="space-y-1">
                {selectedRegion.supportingSignals.map((sig, idx) => (
                  <li key={idx} className="text-[11px] text-slate-300 flex items-start gap-1.5">
                    <span className="text-emerald-400 font-bold">•</span>
                    <span>{sig}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <span className="text-[11px] font-semibold text-slate-400 block mb-1">
                Plausible Non-Fraud Explanations
              </span>
              <ul className="space-y-1">
                {selectedRegion.alternativeExplanations.map((alt, idx) => (
                  <li key={idx} className="text-[11px] text-slate-400 italic flex items-start gap-1.5">
                    <span>—</span>
                    <span>{alt}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="pt-2 border-t border-slate-800 text-[10px] text-slate-500 font-mono">
              Model: {selectedRegion.detectorModel}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-4 text-slate-500">
            <Info size={28} className="mb-2 text-slate-600" />
            <p className="text-xs">
              No anomalies localized in this document. Compression quantization is uniform across the entire surface.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
