import { supabase } from "./supabase";

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

async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    return { Authorization: `Bearer ${session.access_token}` };
  }
  return {};
}

export async function fetchDistricts(): Promise<DistrictSummary[]> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/districts/`, { cache: "no-store", headers });
  if (!res.ok) throw new Error("Failed to fetch districts");
  return res.json();
}

export async function fetchDistrict(id: string, yearBefore?: number, yearAfter?: number): Promise<DistrictDetail> {
  const params = new URLSearchParams();
  if (yearBefore) params.append("year_before", yearBefore.toString());
  if (yearAfter) params.append("year_after", yearAfter.toString());
  
  const headers = await getAuthHeaders();
  const url = `${API_BASE}/api/districts/${id}${params.toString() ? '?' + params.toString() : ''}`;
  const res = await fetch(url, { cache: "no-store", headers });
  if (!res.ok) {
    let errorMsg = `Failed to fetch district ${id}`;
    try {
      const errData = await res.json();
      if (errData.detail) errorMsg = errData.detail;
    } catch (e) {
      // JSON parsing failed, use default message
    }
    throw new Error(errorMsg);
  }
  return res.json();
}

