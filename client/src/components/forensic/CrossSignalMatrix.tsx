import React from "react";
import { AlertOctagon, CheckCircle2, AlertTriangle, ShieldCheck } from "lucide-react";

export interface Contradiction {
  id: string;
  field: string;
  sourceA: { label: string; value: string };
  sourceB: { label: string; value: string };
  severity: "critical" | "concerning" | "minor";
  explanation: string;
  confidence: number;
  potentialNonFraudExplanations: string[];
}

export interface FieldAgreementEntry {
  field: string;
  ocrValue: string;
  qrValue: string;
  registryValue: string;
  status: "AGREE" | "PARTIAL_AGREE" | "CONTRADICTION" | "INSUFFICIENT";
  confidence: number;
}

interface Props {
  contradictions?: Contradiction[];
  agreementMatrix?: FieldAgreementEntry[];
  summary?: string;
}

export const CrossSignalMatrix: React.FC<Props> = ({
  contradictions = [],
  agreementMatrix = [],
  summary,
}) => {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "AGREE":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-800">
            <CheckCircle2 size={12} /> CONCORDANT
          </span>
        );
      case "CONTRADICTION":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-red-950/80 text-red-300 border border-red-800">
            <AlertOctagon size={12} /> CONTRADICTION
          </span>
        );
      case "PARTIAL_AGREE":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-950/80 text-amber-300 border border-amber-800">
            <AlertTriangle size={12} /> PARTIAL
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
            INSUFFICIENT
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Overview Banner */}
      {summary && (
        <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-lg text-xs text-slate-300 flex items-start gap-2.5">
          <ShieldCheck className="text-cyan-400 mt-0.5 flex-shrink-0" size={16} />
          <p className="leading-relaxed">{summary}</p>
        </div>
      )}

      {/* Contradiction Cards (if any) */}
      {contradictions.length > 0 && (
        <div className="space-y-2.5">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            Material Signal Contradictions ({contradictions.length})
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {contradictions.map((c) => (
              <div
                key={c.id}
                className="p-3.5 bg-red-950/20 border border-red-900/60 rounded-xl space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-red-400 uppercase tracking-wide">
                    {c.field.replace(/_/g, " ")}
                  </span>
                  <span className="px-1.5 py-0.5 bg-red-900/50 text-red-200 text-[10px] font-mono rounded">
                    {c.severity.toUpperCase()}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-950/60 p-2 rounded border border-red-900/40 font-mono">
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase">
                      {c.sourceA.label}
                    </span>
                    <span className="text-slate-200 break-words">{c.sourceA.value}</span>
                  </div>
                  <div className="border-l border-slate-800 pl-2">
                    <span className="text-slate-400 block text-[9px] uppercase">
                      {c.sourceB.label}
                    </span>
                    <span className="text-red-300 break-words">{c.sourceB.value}</span>
                  </div>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">{c.explanation}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cross-Signal Comparison Table */}
      <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/40">
        <div className="px-4 py-2.5 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between">
          <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
            Cross-Signal Agreement Matrix
          </h4>
          <span className="text-[11px] font-mono text-slate-400">
            {agreementMatrix.length} Channels Evaluated
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 font-mono text-[11px]">
              <tr>
                <th className="p-3">Field / Signal</th>
                <th className="p-3">Visible OCR Text</th>
                <th className="p-3">2D Barcode (QR)</th>
                <th className="p-3">Authoritative Registry</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {agreementMatrix.length > 0 ? (
                agreementMatrix.map((entry, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                    <td className="p-3 font-medium text-slate-200">{entry.field}</td>
                    <td className="p-3 font-mono text-[11px]">{entry.ocrValue}</td>
                    <td className="p-3 font-mono text-[11px] text-slate-400">{entry.qrValue}</td>
                    <td className="p-3 font-mono text-[11px] text-cyan-400/90">{entry.registryValue}</td>
                    <td className="p-3">{getStatusBadge(entry.status)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-slate-500 italic">
                    No signals registered for cross-comparison.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
