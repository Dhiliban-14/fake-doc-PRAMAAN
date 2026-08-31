import React, { useState, useMemo } from "react";
import {
  X,
  History,
  Search,
  FileText,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Calendar,
  Hash,
  ArrowUpRight,
  Plus,
  Filter,
} from "lucide-react";

export interface DocumentHistoryItem {
  id: number;
  caseId: string;
  title: string;
  status: string;
  riskLevel: "low" | "medium" | "high" | "inconclusive" | string;
  riskScore: number;
  confidence: number;
  createdAt: string | Date;
  updatedAt: string | Date;
  evidenceCount?: number;
  storageKey?: string;
  sha256?: string;
}

interface DocumentHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cases: DocumentHistoryItem[];
  selectedCaseId: string | null;
  onSelectCase: (caseId: string) => void;
  onUploadNew: () => void;
}

export default function DocumentHistoryDrawer({
  isOpen,
  onClose,
  cases,
  selectedCaseId,
  onSelectCase,
  onUploadNew,
}: DocumentHistoryDrawerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<"all" | "high" | "low" | "inconclusive">("all");

  const filteredCases = useMemo(() => {
    return cases.filter((item) => {
      const matchesSearch =
        item.caseId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.title.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (filterCategory === "high") return item.riskLevel === "high";
      if (filterCategory === "low") return item.riskLevel === "low" || item.riskLevel === "very_low";
      if (filterCategory === "inconclusive")
        return item.riskLevel === "inconclusive" || item.riskLevel === "medium";

      return true;
    });
  }, [cases, searchQuery, filterCategory]);

  if (!isOpen) return null;

  return (
    <div className="history-drawer-backdrop" onClick={onClose}>
      <div
        className="history-drawer"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Document History"
      >
        <div className="history-drawer-header">
          <div className="history-header-title">
            <div className="history-icon-badge">
              <History size={18} />
            </div>
            <div>
              <h2>Document Verification History</h2>
              <p>Persisted audit dossier of all ingested evidence and real-time records.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="icon-button bordered"
            aria-label="Close history drawer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="history-drawer-toolbar">
          <div className="search-field history-search">
            <Search size={15} />
            <input
              type="text"
              placeholder="Search by case ID or document title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="text-button"
                style={{ fontSize: "11px" }}
              >
                Clear
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              onClose();
              onUploadNew();
            }}
            className="primary-button history-upload-btn"
          >
            <Plus size={15} />
            <span>New Ingestion</span>
          </button>
        </div>

        <div className="history-category-tabs">
          <button
            type="button"
            className={`cat-tab ${filterCategory === "all" ? "active" : ""}`}
            onClick={() => setFilterCategory("all")}
          >
            All ({cases.length})
          </button>
          <button
            type="button"
            className={`cat-tab ${filterCategory === "high" ? "active" : ""}`}
            onClick={() => setFilterCategory("high")}
          >
            High Risk ({cases.filter((c) => c.riskLevel === "high").length})
          </button>
          <button
            type="button"
            className={`cat-tab ${filterCategory === "low" ? "active" : ""}`}
            onClick={() => setFilterCategory("low")}
          >
            Verified ({cases.filter((c) => c.riskLevel === "low" || c.riskLevel === "very_low").length})
          </button>
          <button
            type="button"
            className={`cat-tab ${filterCategory === "inconclusive" ? "active" : ""}`}
            onClick={() => setFilterCategory("inconclusive")}
          >
            Inconclusive ({cases.filter((c) => c.riskLevel === "inconclusive" || c.riskLevel === "medium").length})
          </button>
        </div>

        <div className="history-list-scroll">
          {filteredCases.length === 0 ? (
            <div className="history-empty">
              <FileText size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
              <strong>No matching documents found</strong>
              <span>Try adjusting your search filters or ingest a new document.</span>
            </div>
          ) : (
            filteredCases.map((item) => {
              const isSelected = selectedCaseId === item.caseId;
              const dateStr = new Date(item.updatedAt || item.createdAt).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              });
              const timeStr = new Date(item.updatedAt || item.createdAt).toLocaleTimeString(undefined, {
                hour: "2-digit",
                minute: "2-digit",
              });

              return (
                <div
                  key={item.caseId}
                  className={`history-card ${isSelected ? "selected" : ""}`}
                  onClick={() => {
                    onSelectCase(item.caseId);
                    onClose();
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      onSelectCase(item.caseId);
                      onClose();
                    }
                  }}
                >
                  <div className="history-card-top">
                    <div className="history-doc-info">
                      <div className="history-file-icon">
                        <FileText size={16} />
                      </div>
                      <div>
                        <div className="history-title-row">
                          <strong className="history-title">{item.title}</strong>
                          {isSelected && <span className="active-badge">ACTIVE</span>}
                        </div>
                        <span className="mono history-case-id">{item.caseId}</span>
                      </div>
                    </div>

                    <div className="history-risk-pill">
                      {item.riskLevel === "high" ? (
                        <span className="status-pill red">
                          <AlertTriangle size={11} style={{ marginRight: 3 }} />
                          HIGH RISK ({item.riskScore}/100)
                        </span>
                      ) : item.riskLevel === "low" || item.riskLevel === "very_low" ? (
                        <span className="status-pill green">
                          <CheckCircle2 size={11} style={{ marginRight: 3 }} />
                          VERIFIED
                        </span>
                      ) : (
                        <span className="status-pill amber">
                          <HelpCircle size={11} style={{ marginRight: 3 }} />
                          INCONCLUSIVE
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="history-card-meta">
                    <div className="meta-item">
                      <Calendar size={12} />
                      <span>{dateStr} at {timeStr}</span>
                    </div>

                    <div className="meta-item meta-action">
                      <span>Switch to this dossier</span>
                      <ArrowUpRight size={13} />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="history-drawer-footer">
          <span>{cases.length} documents indexed in immutable cloud storage</span>
          <button
            type="button"
            className="text-button"
            onClick={() => {
              onClose();
              onUploadNew();
            }}
          >
            + Upload Another Document
          </button>
        </div>
      </div>
    </div>
  );
}
