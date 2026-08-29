import React, { useState } from "react";
import { ShieldCheck, AlertCircle, HelpCircle, Activity, Split } from "lucide-react";

export interface RiskComponent {
  component: string;
  label: string;
  observed: string;
  expected: string;
  deviation: number;
  contribution: number;
  confidence: number;
  supportingEvidenceIds: string[];
}

export interface EpistemicReasoning {
  facts: string[];
  observations: string[];
  inferences: string[];
  hypotheses: string[];
  uncertainties: string[];
}

interface Props {
  riskScore: number;
  riskLevel: string;
  confidence: number;
  completeness: number;
  tone: "green" | "amber" | "red" | "neutral";
  modelDisagreement?: boolean;
  disagreementExplanation?: string;
  components?: RiskComponent[];
  epistemic?: EpistemicReasoning;
}

export const RiskBreakdown: React.FC<Props> = ({
  riskScore,
  riskLevel,
  confidence,
  completeness,
  tone,
  modelDisagreement = false,
  disagreementExplanation,
  components = [],
  epistemic,
}) => {
  const [epistemicTab, setEpistemicTab] = useState<"all" | "facts" | "observations" | "inferences" | "hypotheses">("all");

  const getToneBadge = () => {
    switch (tone) {
      case "red":
        return "bg-red-950/80 text-red-300 border-red-800";
      case "amber":
        return "bg-amber-950/80 text-amber-300 border-amber-800";
      case "green":
        return "bg-emerald-950/80 text-emerald-300 border-emerald-800";
      default:
        return "bg-slate-800 text-slate-300 border-slate-700";
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Level Risk Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block mb-1">
            Aggregate Risk Score
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-white">{riskScore}</span>
            <span className="text-xs text-slate-400">/ 100</span>
          </div>
          <div className="mt-2">
            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${getToneBadge()}`}>
              {riskLevel.replace(/_/g, " ")}
            </span>
          </div>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block mb-1">
            Signal Confidence
          </span>
          <div className="text-2xl font-bold font-mono text-cyan-400">{confidence}%</div>
          <span className="text-[11px] text-slate-400 mt-2 block">
            Independent sensor reliability
          </span>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block mb-1">
            Evidence Completeness
          </span>
          <div className="text-2xl font-bold font-mono text-purple-400">{completeness}%</div>
          <span className="text-[11px] text-slate-400 mt-2 block">
            Coverage of required channels
          </span>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block mb-1">
            Model Consensus
          </span>
          <div className="text-base font-bold text-slate-200 mt-1 flex items-center gap-1.5">
            {modelDisagreement ? (
              <>
                <Split className="text-amber-400" size={16} />
                <span className="text-amber-400 text-xs">Models Disagree</span>
              </>
            ) : (
              <>
                <ShieldCheck className="text-emerald-400" size={16} />
                <span className="text-emerald-400 text-xs">Unified Consensus</span>
              </>
            )}
          </div>
          <span className="text-[11px] text-slate-400 mt-2 block">
            Cross-module perception check
          </span>
        </div>
      </div>

      {/* Model Disagreement Callout */}
      {modelDisagreement && disagreementExplanation && (
        <div className="p-3.5 bg-amber-950/30 border border-amber-900/60 rounded-xl flex items-start gap-3 text-xs text-amber-200">
          <AlertCircle className="text-amber-400 mt-0.5 flex-shrink-0" size={16} />
          <div>
            <span className="font-bold block mb-0.5">Perception Disagreement Detected</span>
            <p className="leading-relaxed text-slate-300">{disagreementExplanation}</p>
          </div>
        </div>
      )}

      {/* 10-Component Explainable Breakdown */}
      <div className="border border-slate-800 rounded-xl p-4 bg-slate-900/60 space-y-3">
        <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
          Explainable Component Risk Contributions
        </h4>
        <div className="space-y-3">
          {components.map((comp, idx) => (
            <div key={idx} className="space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-200">{comp.label}</span>
                <span
                  className={`font-mono font-bold ${
                    comp.contribution > 0 ? "text-red-400" : "text-emerald-400"
                  }`}
                >
                  {comp.contribution > 0 ? `+${comp.contribution}` : comp.contribution} pts
                </span>
              </div>
              <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                <div
                  className={`h-full transition-all duration-300 ${
                    comp.contribution > 20
                      ? "bg-red-500"
                      : comp.contribution > 0
                      ? "bg-amber-500"
                      : "bg-emerald-500"
                  }`}
                  style={{ width: `${Math.min(100, Math.abs(comp.contribution) * 2.5)}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                <span>Observed: {comp.observed}</span>
                <span>Conf: {comp.confidence}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Epistemic Reasoning Log */}
      {epistemic && (
        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/40">
          <div className="p-3 border-b border-slate-800 bg-slate-900 flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Epistemic Reasoning Log
            </h4>
            <div className="flex items-center gap-1">
              {(["all", "facts", "observations", "inferences", "hypotheses"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setEpistemicTab(tab)}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono capitalize ${
                    epistemicTab === tab
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 space-y-3 text-xs">
            {(epistemicTab === "all" || epistemicTab === "facts") && epistemic.facts.length > 0 && (
              <div>
                <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase tracking-wider block mb-1">
                  Verified Facts ({epistemic.facts.length})
                </span>
                <ul className="space-y-1">
                  {epistemic.facts.map((f, i) => (
                    <li key={i} className="text-slate-300 flex items-start gap-2">
                      <span className="text-emerald-400 font-bold">•</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {(epistemicTab === "all" || epistemicTab === "observations") &&
              epistemic.observations.length > 0 && (
                <div>
                  <span className="text-[10px] font-mono text-cyan-400 font-bold uppercase tracking-wider block mb-1">
                    Sensor Observations ({epistemic.observations.length})
                  </span>
                  <ul className="space-y-1">
                    {epistemic.observations.map((o, i) => (
                      <li key={i} className="text-slate-300 flex items-start gap-2">
                        <span className="text-cyan-400 font-bold">•</span>
                        <span>{o}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

            {(epistemicTab === "all" || epistemicTab === "inferences") &&
              epistemic.inferences.length > 0 && (
                <div>
                  <span className="text-[10px] font-mono text-amber-400 font-bold uppercase tracking-wider block mb-1">
                    Algorithmic Inferences ({epistemic.inferences.length})
                  </span>
                  <ul className="space-y-1">
                    {epistemic.inferences.map((inf, i) => (
                      <li key={i} className="text-slate-300 flex items-start gap-2">
                        <span className="text-amber-400 font-bold">•</span>
                        <span>{inf}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

            {(epistemicTab === "all" || epistemicTab === "hypotheses") &&
              epistemic.hypotheses.length > 0 && (
                <div>
                  <span className="text-[10px] font-mono text-purple-400 font-bold uppercase tracking-wider block mb-1">
                    Working Hypotheses ({epistemic.hypotheses.length})
                  </span>
                  <ul className="space-y-1">
                    {epistemic.hypotheses.map((h, i) => (
                      <li key={i} className="text-slate-300 italic flex items-start gap-2">
                        <span className="text-purple-400 font-bold">—</span>
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

            {epistemic.uncertainties.length > 0 && (
              <div className="pt-2 border-t border-slate-800/80">
                <span className="text-[10px] font-mono text-slate-400 font-bold uppercase tracking-wider block mb-1 flex items-center gap-1">
                  <HelpCircle size={12} /> Quantified Uncertainties ({epistemic.uncertainties.length})
                </span>
                <ul className="space-y-1">
                  {epistemic.uncertainties.map((u, i) => (
                    <li key={i} className="text-slate-400 text-[11px] flex items-start gap-2">
                      <span>?</span>
                      <span>{u}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
