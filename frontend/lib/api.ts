import { supabase } from "./supabase";

const API_BASE = process.env.NEXT_PUBLIC_PRODUCTION_URL ?? process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

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
  data_source: "live" | "mock" | "pending" | "database";
  indicator_summary: Record<string, { severity: Severity; pct_change: number | null }>;
}

export interface IndicatorDetail {
  sdg: string;
  label: string;
  index_used: string;
  before_value: number | null;
  after_value: number | null;
  change_value: number | null;
  pct_change: number | null;
  severity: Severity;
  verdict: string;
}

export interface DistrictDetail extends Omit<DistrictSummary, "indicator_summary"> {
  indicators: Record<string, IndicatorDetail>;
  images: { before: string | null; after: string | null; aoi_bounds?: { minLon: number; maxLon: number; minLat: number; maxLat: number } };
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    return { Authorization: `Bearer ${session.access_token}` };
  }
  return {};
}

export async function fetchDistricts(): Promise<DistrictSummary[]> {
  // Bypass backend API for initial load - query Supabase directly
  if (process.env.NODE_ENV === "development") {
    console.log("[GeoJSON] Executing fetch: /districts.geojson");
    console.log("[Supabase] Executing query: SELECT district_id, indicators FROM indicator_comparisons WHERE period_before='2017' AND period_after='2024'");
  }

  const [districtsGeoJson, cacheRes] = await Promise.all([
    fetch("/districts.geojson").then(r => r.json()),
    supabase.from("indicator_comparisons").select("district_id, indicators").eq("period_before", "2017").eq("period_after", "2024")
  ]);

  if (cacheRes.error) throw new Error("Failed to fetch cache from Supabase: " + cacheRes.error.message);

  const cacheLookup = new Map(cacheRes.data.map((row: any) => [row.district_id, row.indicators]));
  
  const uniqueDistricts = new Map();
  districtsGeoJson.features.forEach((f: any) => {
    const p = f.properties;
    if (p && p.id && typeof p.lat === 'number' && typeof p.lon === 'number') {
      uniqueDistricts.set(p.id, p);
    }
  });
  const rawDistricts = Array.from(uniqueDistricts.values());

  return rawDistricts.map((d: any) => {
    const rawIndicators = cacheLookup.get(d.id);
    let overallSeverity: Severity = "pending";
    let dataSource: "live" | "mock" | "pending" | "database" = "pending";
    let summary: Record<string, any> = {};

    if (rawIndicators) {
      dataSource = "database";
      
      const severities = Object.values(rawIndicators).map((v: any) => v.severity);
      if (severities.includes("bad")) overallSeverity = "bad";
      else if (severities.includes("warn")) overallSeverity = "warn";
      else if (severities.every((s) => s === "pending")) overallSeverity = "pending";
      else overallSeverity = "good";

      for (const [key, val] of Object.entries(rawIndicators)) {
        summary[key] = {
          severity: (val as any).severity,
          pct_change: (val as any).pct_change
        };
      }
    } else {
      const pendingKeys = ["water", "green_cover", "urban_heat", "climate_action"];
      for (const k of pendingKeys) {
        summary[k] = { severity: "pending", pct_change: null };
      }
    }

    return {
      id: d.id,
      name: d.name,
      state: d.state,
      lat: d.latitude || d.lat,
      lon: d.longitude || d.lon,
      period_before: "2017",
      period_after: "2024",
      overall_severity: overallSeverity,
      data_source: dataSource,
      indicator_summary: summary,
    };
  });
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

export async function fetchDistrictImages(id: string, yearBefore?: number, yearAfter?: number): Promise<{ before: string | null; after: string | null; aoi_bounds?: { minLon: number; maxLon: number; minLat: number; maxLat: number } }> {
  const params = new URLSearchParams();
  if (yearBefore) params.append("year_before", yearBefore.toString());
  if (yearAfter) params.append("year_after", yearAfter.toString());
  
  const headers = await getAuthHeaders();
  const url = `${API_BASE}/api/districts/${id}/images${params.toString() ? '?' + params.toString() : ''}`;
  
  // Abort after 8 seconds so the UI doesn't hang when GEE is unavailable
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  
  try {
    const res = await fetch(url, { cache: "no-store", headers, signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) throw new Error("Failed to fetch images");
    return res.json();
  } catch (err) {
    clearTimeout(timeout);
    // Return null images so the UI shows the placeholder state
    return { before: null, after: null };
  }
}

