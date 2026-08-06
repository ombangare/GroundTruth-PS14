const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

export type Severity = "good" | "warn" | "bad" | "pending";

export interface DistrictSummary {
  id: string;
  name: string;
  state: string;
  lat: number;
  lon: number;
  period_before: string;
  period_after: string;
  overall_severity: Severity;
  data_source: "live" | "mock" | "pending";
  indicator_summary: Record<string, { severity: Severity; pct_change: number | null }>;
}

export interface IndicatorDetail {
  sdg: string;
  label: string;
  index_used: string;
  before_value: number | null;
  after_value: number | null;
  pct_change: number | null;
  severity: Severity;
  verdict: string;
}

export interface DistrictDetail extends Omit<DistrictSummary, "indicator_summary"> {
  indicators: Record<string, IndicatorDetail>;
  images: { before: string | null; after: string | null };
}

export async function fetchDistricts(): Promise<DistrictSummary[]> {
  const res = await fetch(`${API_BASE}/api/districts/`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch districts");
  return res.json();
}

export async function fetchDistrict(id: string): Promise<DistrictDetail> {
  const res = await fetch(`${API_BASE}/api/districts/${id}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch district ${id}`);
  return res.json();
}
