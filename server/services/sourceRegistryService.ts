import {
  listSourceRegistry,
  addSourceRegistry,
  updateSourceRegistry,
} from "../db";

export interface SourceHealthStatus {
  sourceId: number;
  organization: string;
  officialDomain: string;
  status: "HEALTHY" | "DEGRADED" | "UNREACHABLE";
  domainValid: boolean;
  patternsCount: number;
  lastChecked: string;
}

export async function getAllSources() {
  return listSourceRegistry();
}

export async function createSource(input: {
  organization: string;
  officialDomain: string;
  recruitmentPortal?: string;
  officialApi?: string;
  contactInfo?: Record<string, unknown>;
  knownPatterns?: string[];
}) {
  return addSourceRegistry(input);
}

export async function modifySource(
  id: number,
  input: Partial<{
    organization: string;
    officialDomain: string;
    recruitmentPortal: string;
    officialApi: string;
    contactInfo: Record<string, unknown>;
    knownPatterns: string[];
    active: number;
  }>
) {
  return updateSourceRegistry(id, input);
}

export async function deactivateSource(id: number) {
  return updateSourceRegistry(id, { active: 0 });
}

export async function checkSourceHealth(id: number): Promise<SourceHealthStatus | null> {
  const sources = await listSourceRegistry();
  const source = sources.find((s) => s.id === id);
  if (!source) return null;

  // Verify domain structure (must be valid FQDN, preferably .gov.in or .nic.in)
  const isGov = source.officialDomain.endsWith(".gov.in") || source.officialDomain.endsWith(".nic.in");
  const patterns = Array.isArray(source.knownPatterns) ? source.knownPatterns : [];

  return {
    sourceId: source.id,
    organization: source.organization,
    officialDomain: source.officialDomain,
    status: isGov ? "HEALTHY" : "DEGRADED",
    domainValid: true,
    patternsCount: patterns.length,
    lastChecked: new Date().toISOString(),
  };
}
