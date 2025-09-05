import axios from "axios";
import env from "../config/env";

export interface SerpAiOverviewResult {
  present: boolean;
  content?: string;
  citations?: Array<{ url: string; title?: string; domain?: string }>;
  raw?: unknown;
}

export async function fetchGoogleAiOverview(
  query: string,
  opts?: { hl?: string; gl?: string; location?: string }
): Promise<SerpAiOverviewResult> {
  const apiKey =
    process.env.SERP_API_KEY || process.env.SERPAPI_API_KEY || env.SERP_API_KEY;
  if (!apiKey)
    throw new Error("SERP_API_KEY (or SERPAPI_API_KEY) is not configured");

  const baseParams = {
    q: query,
    api_key: apiKey,
    hl: opts?.hl || "en",
    gl: opts?.gl || "us",
    device: "desktop",
    google_domain: "google.com",
    ...(opts?.location ? { location: opts.location } : {}),
  } as Record<string, string>;

  const call = async (engine: string) => {
    const url = "https://serpapi.com/search.json";
    const params =
      engine === "google_ai_overview"
        ? {
            engine,
            q: baseParams.q,
            api_key: baseParams.api_key,
            hl: baseParams.hl,
            gl: baseParams.gl,
          }
        : { engine, ...baseParams };
    try {
      const resp = await axios.get(url, { params, timeout: 15000 });
      return resp.data as any;
    } catch (e: unknown) {
      const err = e as { response?: { data?: unknown }; message?: string };
      const msg = err?.response?.data
        ? JSON.stringify(err.response.data)
        : String(err?.message || e);
      throw new Error(`SerpAPI ${engine} request failed: ${msg}`);
    }
  };

  const pickOverview = (data: any) =>
    data?.ai_overview ||
    data?.ai_overview_results ||
    data?.google_ai_overview ||
    null;

  const toCitations = (
    overview: any
  ): Array<{ url: string; title?: string; domain?: string }> => {
    const out: Array<{ url: string; title?: string; domain?: string }> = [];
    const seen = new Set<string>();
    const add = (u?: string, t?: string) => {
      if (!u) return;
      try {
        const urlObj = new URL(String(u));
        const key = urlObj.toString();
        if (seen.has(key)) return;
        seen.add(key);
        out.push({ url: key, title: t, domain: urlObj.hostname });
      } catch {}
    };

    // Map from references via reference_indexes if present
    if (
      Array.isArray(overview?.references) &&
      Array.isArray(overview?.text_blocks)
    ) {
      const refs = overview.references;
      const walk = (blocks: any[]) => {
        for (const b of blocks) {
          const idxs: number[] = Array.isArray(b?.reference_indexes)
            ? b.reference_indexes
            : [];
          for (const i of idxs) {
            const ref = refs[i];
            if (ref) add(ref.link || ref.url, ref.title);
          }
          if (Array.isArray(b?.text_blocks)) walk(b.text_blocks);
          if (Array.isArray(b?.list)) walk(b.list);
        }
      };
      walk(overview.text_blocks);
    }

    // Fallback to citations/links arrays
    if (Array.isArray(overview?.citations)) {
      for (const c of overview.citations) add(c.url || c.link, c.title);
    }
    if (Array.isArray(overview?.links)) {
      for (const l of overview.links) add(l.link || l.url, l.title || l.name);
    }
    return out;
  };

  const toContent = (overview: any): string => {
    // Prefer explicit fields
    const direct =
      (overview?.answer && String(overview.answer)) ||
      (overview?.content && String(overview.content)) ||
      (Array.isArray(overview?.summary) ? overview.summary.join("\n") : "");
    if (direct) return direct;

    // Flatten text_blocks recursively
    const parts: string[] = [];
    const push = (s?: string) => {
      const t = (s || "").trim();
      if (t) parts.push(t);
    };
    const walk = (blocks: any[]) => {
      for (const b of blocks) {
        if (typeof b?.snippet === "string") push(b.snippet);
        if (Array.isArray(b?.list)) walk(b.list);
        if (Array.isArray(b?.text_blocks)) walk(b.text_blocks);
        if (Array.isArray(b?.comparison)) {
          // Optional: summarize comparison rows minimally
          for (const row of b.comparison)
            push(`${row.feature}: ${row.values?.join(" vs ")}`);
        }
      }
    };
    if (Array.isArray(overview?.text_blocks)) walk(overview.text_blocks);
    return parts.join("\n");
  };

  // Step 1: inline engine
  const data1 = await call("google");
  let overview = pickOverview(data1);
  // If Google returned an AI Overview pointer (page_token) without full content,
  // fetch dedicated payload using page_token
  const pageToken = (data1?.ai_overview as any)?.page_token as
    | string
    | undefined;
  const hasBlocks = Array.isArray((overview as any)?.text_blocks);
  if (overview && !hasBlocks && pageToken) {
    try {
      const url = "https://serpapi.com/search.json";
      const params = {
        engine: "google_ai_overview",
        page_token: pageToken,
        api_key: baseParams.api_key,
      } as const;
      const resp = await axios.get(url, { params, timeout: 15000 });
      overview = pickOverview(resp.data);
    } catch (_e) {
      // fall through to query-based dedicated call below
    }
  }
  if (!overview) {
    // Step 2: dedicated engine
    try {
      const data2 = await call("google_ai_overview");
      overview = pickOverview(data2);
      if (!overview) {
        // Fallback: synthesize content from answer_box / knowledge_graph / organic_results
        const fallback = synthesizeFromSerp(data1) || synthesizeFromSerp(data2);
        if (fallback) return { present: false, ...fallback, raw: data2 };
        return { present: false, raw: data2 };
      }
      const content = toContent(overview);
      const citations = toCitations(overview);
      return { present: Boolean(content), content, citations, raw: data2 };
    } catch (e: unknown) {
      // Some SerpAPI accounts require a page_token for google_ai_overview and reject query-based calls.
      const msg = String((e as { message?: string })?.message || e);
      if (/page_token/i.test(msg)) {
        const fallback = synthesizeFromSerp(data1);
        if (fallback) return { present: false, ...fallback, raw: data1 };
        return {
          present: false,
          raw: { error: msg, source: "google_ai_overview", data: data1 },
        };
      }
      throw e;
    }
  }
  const content = toContent(overview);
  const citations = toCitations(overview);
  return { present: Boolean(content), content, citations, raw: data1 };
}

function synthesizeFromSerp(data: any): {
  content: string;
  citations: Array<{ url: string; title?: string; domain?: string }>;
} | null {
  try {
    const sources: Array<{ url: string; title?: string; domain?: string }> = [];
    const push = (u?: string, t?: string) => {
      if (!u) return;
      try {
        const uu = new URL(u);
        const url = uu.toString();
        if (!sources.find((s) => s.url === url))
          sources.push({ url, title: t, domain: uu.hostname });
      } catch {}
    };

    // Prefer answer_box
    if (data?.answer_box) {
      const ab = data.answer_box;
      const parts: string[] = [];
      if (ab.answer) parts.push(String(ab.answer));
      if (ab.snippet) parts.push(String(ab.snippet));
      if (ab.title) parts.push(String(ab.title));
      if (ab.link) push(ab.link, ab.title);
      const content = parts.join("\n").trim();
      if (content) return { content, citations: sources };
    }

    // Knowledge graph
    if (data?.knowledge_graph) {
      const kg = data.knowledge_graph;
      const parts: string[] = [];
      if (kg.title) parts.push(String(kg.title));
      if (kg.type) parts.push(String(kg.type));
      if (kg.description) parts.push(String(kg.description));
      if (Array.isArray(kg.source?.link)) push(kg.source.link, kg.source.name);
      const content = parts.join("\n").trim();
      if (content) return { content, citations: sources };
    }

    // Top organic results
    if (
      Array.isArray(data?.organic_results) &&
      data.organic_results.length > 0
    ) {
      const top = data.organic_results.slice(0, 3);
      const parts: string[] = [];
      for (const r of top) {
        if (r.title) parts.push(String(r.title));
        if (r.snippet) parts.push(String(r.snippet));
        push(r.link, r.title);
      }
      const content = parts.join("\n").trim();
      if (content) return { content, citations: sources };
    }
  } catch {}
  return null;
}
