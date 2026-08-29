import React, { useState } from "react";
import { ArrowRight, CheckSquare, Square, AlertCircle, Sparkles, ShieldAlert, FileSearch } from "lucide-react";

export interface NextBestAction {
  id: string;
  title: string;
  actionType: string;
  priority: "IMMEDIATE" | "RECOMMENDED" | "OPTIONAL";
  description: string;
  informationGain: number;
  riskReduction: number;
  cost: "LOW" | "MEDIUM" | "HIGH";
  privacyImpact: "MINIMAL" | "MODERATE" | "HIGH";
  rationale: string;
}

export interface MissingEvidenceItem {
  id: string;
  evidenceName: string;
  status: string;
  importance: "CRITICAL" | "HIGH" | "MEDIUM";
  potentialImpactOnDecision: string;
}

export interface DynamicChecklistEntry {
  id: string;
  task: string;
  category: string;
  completed: boolean;
}

interface Props {
  recommendedDecision?: string;
  justification?: string;
  nextActions?: NextBestAction[];
  missingEvidence?: MissingEvidenceItem[];
  checklist?: DynamicChecklistEntry[];
  onActionTrigger?: (action: NextBestAction) => void;
}

export const NextBestActionCard: React.FC<Props> = ({
  recommendedDecision = "CLEAR_FOR_RELIANCE",
  justification,
  nextActions = [],
  missingEvidence = [],
  checklist: initialChecklist = [],
  onActionTrigger,
}) => {
  const [checklist, setChecklist] = useState<DynamicChecklistEntry[]>(initialChecklist);

  const toggleCheck = (id: string) => {
    setChecklist((prev) =>
      prev.map((item) => (item.id === id ? { ...item, completed: !item.completed } : item))
    );
  };

  const getDecisionBadge = () => {
    switch (recommendedDecision) {
      case "PAUSE_RELIANCE":
        return { text: "HALT RELIANCE", class: "bg-red-950 text-red-300 border-red-800" };
      case "CORROBORATE_SOURCE":
        return { text: "CORROBORATE WITH AUTHORITY", class: "bg-amber-950 text-amber-300 border-amber-800" };
      case "AWAIT_CRITICAL_EVIDENCE":
        return { text: "AWAIT EVIDENCE", class: "bg-slate-800 text-slate-300 border-slate-700" };
      default:
        return { text: "CLEAR FOR RELIANCE", class: "bg-emerald-950 text-emerald-300 border-emerald-800" };
    }
  };

  const badge = getDecisionBadge();

  return (
    <div className="space-y-4">
      {/* Recommended Decision Header */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block mb-1">
            Recommended Operational Decision
          </span>
          <div className="flex items-center gap-2.5">
            <span className={`px-2.5 py-1 rounded text-xs font-bold font-mono border ${badge.class}`}>
              {badge.text}
            </span>
            <span className="text-xs text-slate-300">{justification}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Next Best Actions */}
        <div className="border border-slate-800 rounded-xl p-4 bg-slate-900/60 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-200 uppercase tracking-wider">
            <Sparkles className="text-cyan-400" size={16} />
            <h4>Investigator Next-Best-Actions (Ranked)</h4>
          </div>
          <div className="space-y-2.5">
            {nextActions.map((action) => (
              <div
                key={action.id}
                className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-2 hover:border-slate-700 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-100">{action.title}</span>
                  <span
                    className={`px-1.5 py-0.5 text-[9px] font-mono font-bold rounded ${
                      action.priority === "IMMEDIATE"
                        ? "bg-red-950 text-red-300 border border-red-800"
                        : "bg-cyan-950 text-cyan-300 border border-cyan-800"
                    }`}
                  >
                    {action.priority}
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">{action.description}</p>
                <div className="flex items-center justify-between pt-2 border-t border-slate-900 text-[10px] font-mono text-slate-400">
                  <div className="flex items-center gap-3">
                    <span>Gain: <b className="text-cyan-400">+{action.informationGain}%</b></span>
                    <span>Risk Reduction: <b className="text-emerald-400">-{action.riskReduction}%</b></span>
                  </div>
                  {onActionTrigger && (
                    <button
                      onClick={() => onActionTrigger(action)}
                      className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-sans text-xs"
                    >
                      Execute <ArrowRight size={12} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Missing Evidence & Dynamic Checklist */}
        <div className="space-y-4">
          {/* Missing Evidence */}
          {missingEvidence.length > 0 && (
            <div className="border border-slate-800 rounded-xl p-4 bg-slate-900/60 space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-200 uppercase tracking-wider">
                <FileSearch className="text-amber-400" size={16} />
                <h4>Missing Evidence Impact</h4>
              </div>
              <div className="space-y-2">
                {missingEvidence.map((item) => (
                  <div
                    key={item.id}
                    className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-200">{item.evidenceName}</span>
                      <span className="text-[10px] font-mono text-amber-400 uppercase">
                        {item.importance} IMPACT
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">{item.potentialImpactOnDecision}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Dynamic Adaptive Checklist */}
          <div className="border border-slate-800 rounded-xl p-4 bg-slate-900/60 space-y-2.5">
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Dynamic Investigation Checklist
            </h4>
            <div className="space-y-1.5 text-xs">
              {checklist.map((item) => (
                <div
                  key={item.id}
                  onClick={() => toggleCheck(item.id)}
                  className="flex items-center gap-2.5 p-2 rounded hover:bg-slate-800/40 cursor-pointer transition-colors select-none"
                >
                  {item.completed ? (
                    <CheckSquare size={16} className="text-emerald-400 flex-shrink-0" />
                  ) : (
                    <Square size={16} className="text-slate-600 flex-shrink-0" />
                  )}
                  <span
                    className={`${
                      item.completed ? "line-through text-slate-500" : "text-slate-200"
                    }`}
                  >
                    {item.task}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
