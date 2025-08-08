import React from "react";
import type { AuditResult } from "../../pages/WebAuditPage";
import LiquidGlassCard from "../ui/LiquidGlassCard";
import CategoryExplainer from "./CategoryExplainer";

interface WebAuditCategoryDetailsProps {
  categoryKey: "overall" | "performance" | "seo" | "geo" | "security";
  result: AuditResult;
}

const SectionTitle: React.FC<{ title: string }> = ({ title }) => (
  <h3 className="text-lg font-semibold text-gray-900 mb-3">{title}</h3>
);

const Pill: React.FC<{
  label: string;
  value: string | number;
  tone?: "default" | "success" | "warn" | "danger";
}> = ({ label, value, tone = "default" }) => {
  const toneMap: Record<string, { bg: string; text: string; border: string }> =
    {
      default: {
        bg: "bg-white/60",
        text: "text-gray-800",
        border: "border-white/30",
      },
      success: {
        bg: "bg-green-100",
        text: "text-green-800",
        border: "border-green-200",
      },
      warn: {
        bg: "bg-yellow-100",
        text: "text-yellow-800",
        border: "border-yellow-200",
      },
      danger: {
        bg: "bg-red-100",
        text: "text-red-800",
        border: "border-red-200",
      },
    };
  const t = toneMap[tone];
  return (
    <div
      className={`h-7 px-2 rounded-md text-xs font-semibold inline-flex items-center gap-1 ${t.bg} ${t.text} ${t.border} border`}
    >
      <span className="opacity-70">{label}</span>
      <span>{value}</span>
    </div>
  );
};

function classifyVital(
  name: string,
  value?: number
): "success" | "warn" | "danger" | "default" {
  if (typeof value !== "number" || !Number.isFinite(value)) return "default";
  // thresholds (ms) loosely based on CWV guidance
  const ms = value;
  switch (name) {
    case "LCP":
      return ms <= 2500 ? "success" : ms <= 4000 ? "warn" : "danger";
    case "INP":
      return ms <= 200 ? "success" : ms <= 500 ? "warn" : "danger";
    case "TTFB":
      return ms <= 800 ? "success" : ms <= 1800 ? "warn" : "danger";
    case "CLS":
      // CLS is unitless but often multiplied; assume provided as 0-1
      return ms <= 0.1 ? "success" : ms <= 0.25 ? "warn" : "danger";
    default:
      return "default";
  }
}

type PerformanceDetails = {
  lcp?: number; // ms
  inp?: number; // ms
  cls?: number; // unitless
  ttfb?: number; // ms
  opportunities?: Array<{
    title?: string;
    description?: string;
    savings?: number;
  }>;
};

type SEODetails = {
  technical?: {
    robotsTxt?: { present?: boolean; disallowAll?: boolean };
    sitemap?: { present?: boolean; urlCount?: number };
    canonical?: { present?: boolean };
    robotsMeta?: unknown;
    xRobotsTag?: unknown;
  };
  metaTags?: {
    title?: { content?: string; length?: number };
    description?: { content?: string; length?: number };
  };
  social?: { openGraph?: boolean; twitterCards?: boolean };
  structure?: {
    headings?: { h1Count?: number; properHierarchy?: boolean };
    internalLinks?: number;
  };
  i18n?: { hreflang?: Array<{ lang?: string }> };
  schemaMarkup?: {
    jsonLd?: Array<{ type?: string; valid?: boolean }>;
    microdata?: boolean;
  };
};

const asPerformance = (d: unknown): PerformanceDetails => {
  const v: any = d ?? {};
  return {
    lcp: Number.isFinite(v?.lcp) ? Number(v.lcp) : undefined,
    inp: Number.isFinite(v?.inp) ? Number(v.inp) : undefined,
    cls: Number.isFinite(v?.cls) ? Number(v.cls) : undefined,
    ttfb: Number.isFinite(v?.ttfb) ? Number(v.ttfb) : undefined,
    opportunities: Array.isArray(v?.opportunities)
      ? v.opportunities.map((o: any) => ({
          title: String(o?.title ?? "Optimization Opportunity"),
          description: String(
            o?.description ?? "Consider optimizing this area."
          ),
          savings: Number.isFinite(o?.savings)
            ? Math.round(Number(o.savings))
            : undefined,
        }))
      : [],
  };
};

const asSEO = (d: unknown): SEODetails => {
  const v: any = d ?? {};
  return {
    technical: {
      robotsTxt: {
        present: Boolean(
          v?.technical?.robotsTxt?.present ?? v?.technical?.robotsTxt
        ),
        disallowAll: Boolean(v?.technical?.robotsTxt?.disallowAll),
      },
      sitemap: {
        present: Boolean(
          v?.technical?.sitemap?.present ?? v?.technical?.sitemap
        ),
        urlCount: Number(v?.technical?.sitemap?.urlCount ?? 0),
      },
      canonical: {
        present: Boolean(
          v?.technical?.canonical?.present ?? v?.technical?.canonical
        ),
      },
      robotsMeta: v?.technical?.robotsMeta,
      xRobotsTag: v?.technical?.xRobotsTag,
    },
    metaTags: {
      title: {
        content: String(
          v?.metaTags?.title?.content ?? v?.metaTags?.title ?? ""
        ),
        length: Number(
          v?.metaTags?.title?.length ??
            (v?.metaTags?.title ? String(v.metaTags.title).length : 0)
        ),
      },
      description: {
        content: String(
          v?.metaTags?.description?.content ?? v?.metaTags?.description ?? ""
        ),
        length: Number(
          v?.metaTags?.description?.length ??
            (v?.metaTags?.description
              ? String(v.metaTags.description).length
              : 0)
        ),
      },
    },
    social: {
      openGraph: Boolean(v?.social?.openGraph),
      twitterCards: Boolean(v?.social?.twitterCards),
    },
    structure: {
      headings: {
        h1Count: Number(v?.structure?.headings?.h1Count ?? 0),
        properHierarchy: Boolean(
          v?.structure?.headings?.properHierarchy ?? false
        ),
      },
      internalLinks: Number(v?.structure?.internalLinks ?? 0),
    },
    i18n: { hreflang: Array.isArray(v?.i18n?.hreflang) ? v.i18n.hreflang : [] },
    schemaMarkup: {
      jsonLd: Array.isArray(v?.schemaMarkup?.jsonLd)
        ? v.schemaMarkup.jsonLd
        : [],
      microdata: Boolean(v?.schemaMarkup?.microdata ?? false),
    },
  };
};

const SectionCard: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <div className="bg-white/70 backdrop-blur-sm border border-white/30 rounded-xl p-3">
    <h4 className="text-sm font-semibold text-gray-900 mb-2">{title}</h4>
    {children}
  </div>
);

const WebAuditCategoryDetails: React.FC<WebAuditCategoryDetailsProps> = ({
  categoryKey,
  result,
}) => {
  const details = result.details[categoryKey];

  const score = result.scores[categoryKey] ?? "—";

  const renderPerformance = (d: unknown) => {
    const perf = asPerformance(d);
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <SectionCard title="LCP">
            <Pill
              label="LCP"
              value={perf.lcp ?? "—"}
              tone={classifyVital("LCP", perf.lcp)}
            />
            <p className="text-[11px] text-gray-500 mt-1">
              Largest Contentful Paint (ms)
            </p>
          </SectionCard>
          <SectionCard title="INP">
            <Pill
              label="INP"
              value={perf.inp ?? "—"}
              tone={classifyVital("INP", perf.inp)}
            />
            <p className="text-[11px] text-gray-500 mt-1">
              Interaction to Next Paint (ms)
            </p>
          </SectionCard>
          <SectionCard title="CLS">
            <Pill
              label="CLS"
              value={perf.cls ?? "—"}
              tone={classifyVital("CLS", perf.cls)}
            />
            <p className="text-[11px] text-gray-500 mt-1">
              Cumulative Layout Shift
            </p>
          </SectionCard>
          <SectionCard title="TTFB">
            <Pill
              label="TTFB"
              value={perf.ttfb ?? "—"}
              tone={classifyVital("TTFB", perf.ttfb)}
            />
            <p className="text-[11px] text-gray-500 mt-1">
              Time To First Byte (ms)
            </p>
          </SectionCard>
        </div>
        {perf.opportunities && perf.opportunities.length > 0 && (
          <SectionCard title="Opportunities">
            <ul className="space-y-2">
              {perf.opportunities.slice(0, 10).map((op, idx) => (
                <li
                  key={idx}
                  className="flex items-start justify-between gap-3"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {op.title}
                    </p>
                    <p className="text-xs text-gray-600">{op.description}</p>
                  </div>
                  {typeof op.savings === "number" && (
                    <Pill
                      label="Savings"
                      value={`${op.savings} ms`}
                      tone="warn"
                    />
                  )}
                </li>
              ))}
            </ul>
          </SectionCard>
        )}
      </div>
    );
  };

  const renderSEO = (d: unknown) => {
    const seo = asSEO(d);
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <SectionCard title="Indexability">
            <div className="flex flex-wrap gap-2 items-center">
              <Pill
                label="robots.txt"
                value={
                  seo.technical?.robotsTxt?.present ? "present" : "missing"
                }
                tone={seo.technical?.robotsTxt?.present ? "success" : "danger"}
              />
              <Pill
                label="sitemap"
                value={seo.technical?.sitemap?.present ? "present" : "missing"}
                tone={seo.technical?.sitemap?.present ? "success" : "danger"}
              />
              {!!seo.technical?.sitemap?.urlCount && (
                <Pill label="URLs" value={seo.technical.sitemap.urlCount} />
              )}
              <Pill
                label="canonical"
                value={seo.technical?.canonical?.present ? "set" : "none"}
                tone={seo.technical?.canonical?.present ? "success" : "warn"}
              />
            </div>
          </SectionCard>
          <SectionCard title="Meta">
            <div className="flex flex-wrap gap-2 items-center">
              <Pill
                label="title"
                value={`${seo.metaTags?.title?.length ?? 0} ch`}
              />
              <Pill
                label="description"
                value={`${seo.metaTags?.description?.length ?? 0} ch`}
              />
              <Pill
                label="OG"
                value={seo.social?.openGraph ? "yes" : "no"}
                tone={seo.social?.openGraph ? "success" : "warn"}
              />
              <Pill
                label="Twitter"
                value={seo.social?.twitterCards ? "yes" : "no"}
                tone={seo.social?.twitterCards ? "success" : "warn"}
              />
            </div>
          </SectionCard>
          <SectionCard title="Structure">
            <div className="flex flex-wrap gap-2 items-center">
              <Pill
                label="H1s"
                value={seo.structure?.headings?.h1Count ?? 0}
                tone={seo.structure?.headings?.h1Count ? "success" : "warn"}
              />
              <Pill
                label="Hierarchy"
                value={
                  seo.structure?.headings?.properHierarchy ? "ok" : "check"
                }
                tone={
                  seo.structure?.headings?.properHierarchy ? "success" : "warn"
                }
              />
              <Pill
                label="Internal links"
                value={seo.structure?.internalLinks ?? 0}
              />
            </div>
          </SectionCard>
          <SectionCard title="Internationalization">
            <div className="flex flex-wrap gap-2 items-center">
              <Pill
                label="hreflang"
                value={`${seo.i18n?.hreflang?.length ?? 0} langs`}
              />
            </div>
          </SectionCard>
        </div>
        {seo.schemaMarkup?.jsonLd && seo.schemaMarkup.jsonLd.length > 0 && (
          <SectionCard title="Structured Data (JSON-LD)">
            <div className="flex flex-wrap gap-2">
              {seo.schemaMarkup.jsonLd.map((s, i) => (
                <Pill
                  key={`${s?.type}-${i}`}
                  label={String(s?.type ?? "Schema")}
                  value={s?.valid ? "valid" : "check"}
                  tone={s?.valid ? "success" : "warn"}
                />
              ))}
            </div>
          </SectionCard>
        )}
      </div>
    );
  };

  return (
    <LiquidGlassCard className="h-full">
      <div className="px-3 py-2 mb-2 flex items-center justify-between">
        <SectionTitle
          title={`${categoryKey === "seo" ? "SEO" : categoryKey === "geo" ? "AI Search" : categoryKey[0].toUpperCase() + categoryKey.slice(1)} Details`}
        />
        <div className="h-7 px-2 bg-white/60 backdrop-blur-sm border border-white/30 rounded-md text-xs font-semibold flex items-center text-gray-800">
          Score: {score}
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
        {/* Main audit info first */}
        {categoryKey === "performance" && renderPerformance(details)}
        {categoryKey === "seo" && renderSEO(details)}
        {categoryKey !== "performance" &&
          categoryKey !== "seo" &&
          (details ? (
            <pre className="bg-white/60 border border-white/30 rounded-lg p-3 overflow-auto text-xs text-gray-800">
              {JSON.stringify(details, null, 2)}
            </pre>
          ) : (
            <p className="text-sm text-gray-600">No details available.</p>
          ))}

        {/* Supplementary explainers below */}
        {categoryKey !== "overall" && (
          <CategoryExplainer categoryKey={categoryKey} />
        )}
      </div>
    </LiquidGlassCard>
  );
};

export default WebAuditCategoryDetails;
