import { Info } from "lucide-react";
import React from "react";
import type { AuditResult } from "../../pages/WebAuditPage";
import LiquidGlassCard from "../ui/LiquidGlassCard";
import StructuredObjectView from "../ui/StructuredObjectView";
import Tooltip from "../ui/Tooltip";
import CategoryExplainer from "./CategoryExplainer";
import { getExplainerContent } from "./explainerContent";

interface WebAuditCategoryDetailsProps {
  categoryKey: "overall" | "performance" | "seo" | "geo" | "security";
  result: AuditResult;
}

const SectionTitle: React.FC<{ title: string }> = ({ title }) => (
  <h3 className="text-sm font-semibold text-gray-900 leading-tight">{title}</h3>
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
  const v = (d ?? {}) as {
    coreWebVitals?: { lcp?: unknown; cls?: unknown };
    lcp?: unknown;
    cls?: unknown;
    inp?: unknown;
    ttfb?: unknown;
    opportunities?: Array<{
      title?: unknown;
      description?: unknown;
      savings?: unknown;
    }>;
  };
  const core = v?.coreWebVitals ?? {};
  const lcp = Number.isFinite(v?.lcp)
    ? Number(v.lcp)
    : Number.isFinite(core?.lcp)
      ? Number(core.lcp)
      : undefined;
  const cls = Number.isFinite(v?.cls)
    ? Number(v.cls)
    : Number.isFinite(core?.cls)
      ? Number(core.cls)
      : undefined;
  // Prefer INP if available; do not fall back to FID silently
  const inp = Number.isFinite(v?.inp) ? Number(v.inp) : undefined;
  const ttfb = Number.isFinite(v?.ttfb) ? Number(v.ttfb) : undefined;

  const opportunities = Array.isArray(v?.opportunities)
    ? v.opportunities.map((o) => ({
        title: String(
          (o as { title?: unknown })?.title ?? "Optimization Opportunity"
        ),
        description: String(
          (o as { description?: unknown })?.description ??
            "Consider optimizing this area."
        ),
        savings: Number.isFinite(
          (o as { savings?: unknown })?.savings as number
        )
          ? Math.round(Number((o as { savings?: unknown }).savings))
          : undefined,
      }))
    : [];

  return { lcp, inp, cls, ttfb, opportunities };
};

const asSEO = (d: unknown): SEODetails => {
  type Technical = {
    robotsTxt?: { present?: unknown; disallowAll?: unknown };
    sitemap?: { present?: unknown; urlCount?: unknown };
    canonical?: { present?: unknown };
    robotsMeta?: unknown;
    xRobotsTag?: unknown;
  };
  type MetaTags = {
    title?: { content?: unknown; length?: unknown } | string;
    description?: { content?: unknown; length?: unknown } | string;
  };
  type Social = { openGraph?: unknown; twitterCards?: unknown };
  type Structure = {
    headings?: { h1Count?: unknown; properHierarchy?: unknown };
    internalLinks?: unknown;
  };
  type I18n = { hreflang?: Array<{ lang?: unknown }> };
  type SchemaMarkup = {
    jsonLd?: Array<{ type?: unknown; valid?: unknown }>;
    microdata?: unknown;
  };
  const v = (d ?? {}) as Record<string, unknown> & {
    technical?: Technical;
    metaTags?: MetaTags;
    social?: Social;
    structure?: Structure;
    i18n?: I18n;
    schemaMarkup?: SchemaMarkup;
  };
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

const SectionCard: React.FC<{
  title: string;
  tooltip?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, tooltip, children }) => (
  <div className="bg-white/70 backdrop-blur-sm border border-white/30 rounded-xl p-3">
    <div className="flex items-baseline gap-0.5 mb-2">
      <h4 className="text-sm font-semibold text-gray-900 leading-tight">
        {title}
      </h4>
      {tooltip && (
        <Tooltip content={tooltip}>
          <span
            aria-label="More info"
            className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-white/40 bg-white/70 text-gray-700 align-super -translate-y-0.5 md:-translate-y-1"
          >
            <Info className="h-3 w-3" />
          </span>
        </Tooltip>
      )}
    </div>
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
          <SectionCard
            title="LCP"
            tooltip={
              <span>
                <strong>LCP (Largest Contentful Paint)</strong>: time from
                navigation until the largest content element (image, video
                poster, or block-level text) is rendered within the viewport.
                The browser reports multiple candidates; we use the final LCP
                candidate. Lower is better; good ≤ 2.5s.
              </span>
            }
          >
            <Pill
              label="LCP"
              value={
                typeof perf.lcp === "number"
                  ? `${(perf.lcp / 1000).toFixed(2)} seconds`
                  : "—"
              }
              tone={classifyVital("LCP", perf.lcp)}
            />
            <p className="text-[11px] text-gray-500 mt-1">
              Largest Contentful Paint (seconds)
            </p>
          </SectionCard>
          <SectionCard
            title="INP"
            tooltip={
              <span>
                <strong>INP (Interaction to Next Paint)</strong>: responsiveness
                to user input (click, tap, key). Measured from interaction start
                until the next paint after handlers complete. We summarize
                interaction latency (near worst cases). Lower is better; good ≤
                200ms.
              </span>
            }
          >
            <Pill
              label="INP"
              value={perf.inp ?? "—"}
              tone={classifyVital("INP", perf.inp)}
            />
            <p className="text-[11px] text-gray-500 mt-1">
              Interaction to Next Paint (ms)
            </p>
          </SectionCard>
          <SectionCard
            title="CLS"
            tooltip={
              <span>
                <strong>CLS (Cumulative Layout Shift)</strong>: measures visual
                stability by summing layout shift scores across session windows.
                Each shift score ≈ impact fraction × distance fraction (portion
                of viewport affected and how far it moved). Lower is better;
                good ≤ 0.1.
              </span>
            }
          >
            <Pill
              label="CLS"
              value={perf.cls ?? "—"}
              tone={classifyVital("CLS", perf.cls)}
            />
            <p className="text-[11px] text-gray-500 mt-1">
              Cumulative Layout Shift
            </p>
          </SectionCard>
          <SectionCard
            title="TTFB"
            tooltip={
              <span>
                <strong>TTFB (Time To First Byte)</strong>: time from request
                start until the first byte of the main document is received.
                Captures server processing + network latency. Lower is better;
                good ≤ 800ms.
              </span>
            }
          >
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
    const v = (d ?? {}) as Record<string, unknown> & {
      contentStructure?: {
        faqSections?: unknown;
        listStructure?: unknown;
        tableStructure?: unknown;
        answerReadyContent?: unknown;
      };
    };
    const jsonLdCount = seo.schemaMarkup?.jsonLd?.length ?? 0;
    const microdata = Boolean(seo.schemaMarkup?.microdata);
    const totalSchemas = jsonLdCount + (microdata ? 1 : 0);
    const contentStructure = v?.contentStructure ?? {};
    const faqSections = Number(contentStructure?.faqSections ?? 0);
    const listStructure = Number(contentStructure?.listStructure ?? 0);
    const tableStructure = Number(contentStructure?.tableStructure ?? 0);
    const answerReadyContent = Number(
      contentStructure?.answerReadyContent ?? 0
    );
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <SectionCard
            title="Structured Data Summary"
            tooltip={
              <span>
                Overview of detected structured data. Use JSON‑LD where
                possible. Validate using Rich Results Test.
              </span>
            }
          >
            <div className="flex flex-wrap gap-2 items-center">
              <Pill label="JSON‑LD blocks" value={jsonLdCount} />
              <Pill
                label="Microdata"
                value={microdata ? "present" : "none"}
                tone={microdata ? "success" : "warn"}
              />
              <Pill label="Total schemas" value={totalSchemas} />
            </div>
          </SectionCard>
          <SectionCard
            title="Indexability"
            tooltip={
              <span>
                Can crawlers access and index your pages? Computed from
                <em>robots.txt</em> allow/deny, robots meta/X‑Robots‑Tag (not
                set to "noindex"), and the presence of a submitted sitemap.
                Ensure important sections are allowed and a sitemap is
                submitted.
              </span>
            }
          >
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
          <SectionCard
            title="Content Structure"
            tooltip={
              <span>
                Signals that improve scannability and structured presentation.
                Increasing lists, FAQs, and tables can help both users and
                crawlers understand content.
              </span>
            }
          >
            <div className="flex flex-wrap gap-2 items-center">
              <Pill label="FAQ sections" value={faqSections} />
              <Pill label="Lists" value={listStructure} />
              <Pill label="Tables" value={tableStructure} />
              <Pill label="Answer‑ready blocks" value={answerReadyContent} />
            </div>
          </SectionCard>
          <SectionCard
            title="Meta"
            tooltip={
              <span>
                Title and description tags drive how your result appears. We
                compute title/description <em>presence</em> and
                <em> length</em>, and check Open Graph/Twitter tags. Aim for
                concise titles and compelling descriptions.
              </span>
            }
          >
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
          <SectionCard
            title="Structured Data (JSON-LD)"
            tooltip={
              <span>
                Schema markup helps machines understand your site. We count and
                validate JSON‑LD blocks (e.g., Organization, Product, FAQ). Keep
                them accurate and error‑free.
              </span>
            }
          >
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

  const renderGEO = (d: unknown) => {
    const v = (d ?? {}) as Record<string, unknown> & {
      aiOptimization?: Record<string, unknown>;
      readabilityScore?: unknown;
      structuredAnswers?: unknown;
      contentStructure?: { answerReadyContent?: unknown };
    };
    const ai = v?.aiOptimization ?? {};
    const citationFriendly = Boolean(ai?.citationFriendly);
    const readability = Number(
      ai?.readabilityScore ?? v?.readabilityScore ?? 0
    );
    const structuredAnswers = Number(
      ai?.structuredAnswers ?? v?.structuredAnswers ?? 0
    );
    const contentStructure = v?.contentStructure ?? {};
    const answerReadyContent = Number(
      contentStructure?.answerReadyContent ?? 0
    );
    // New deterministic metrics
    const freshness = Number(ai?.freshnessScore ?? 0);
    const chunkability = Number(ai?.chunkabilityScore ?? 0);
    const anchorCoverage = Number(ai?.anchorCoverage ?? 0);
    const mainContentRatio = Number(ai?.mainContentRatio ?? 0);
    const questionHeadingCoverage = Number(ai?.questionHeadingCoverage ?? 0);
    const schemaCompleteness = Number(ai?.schemaCompletenessScore ?? 0);
    const tldrPresent = Boolean(ai?.tldrPresent);

    const classifyReadability = (score: number) =>
      score >= 60 ? "success" : score >= 40 ? "warn" : "danger";
    const classifyPercent = (score: number) =>
      score >= 70 ? "success" : score >= 40 ? "warn" : "danger";

    return (
      <div className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <SectionCard
            title="Inclusion Signals"
            tooltip={
              <span>
                Heuristics that indicate your content is easy to quote and
                include in generated answers.
              </span>
            }
          >
            <div className="flex flex-wrap gap-2 items-center">
              <Pill
                label="Citation‑friendly"
                value={citationFriendly ? "yes" : "no"}
                tone={citationFriendly ? "success" : "warn"}
              />
              <Pill label="Structured answers" value={structuredAnswers} />
              <Pill label="Answer‑ready blocks" value={answerReadyContent} />
            </div>
          </SectionCard>
          <SectionCard
            title="Readability"
            tooltip={
              <span>
                Higher readability generally improves comprehension. Aim for ≥
                60.
              </span>
            }
          >
            <div className="flex items-center gap-2">
              <Pill
                label="Score"
                value={readability}
                tone={classifyReadability(readability)}
              />
            </div>
          </SectionCard>
        </div>

        {/* Deterministic AI Search signals */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <SectionCard
            title="Freshness & Chunking"
            tooltip={
              <span>
                Fresh content and well‑sized sections improve answerability and
                inclusion in AI snippets.
              </span>
            }
          >
            <div className="flex flex-wrap gap-2 items-center">
              <Pill
                label="Freshness"
                value={`${Math.round(freshness)} / 100`}
                tone={classifyPercent(freshness)}
              />
              <Pill
                label="Chunkability"
                value={`${Math.round(chunkability)} / 100`}
                tone={classifyPercent(chunkability)}
              />
              <Pill
                label="TL;DR"
                value={tldrPresent ? "present" : "none"}
                tone={tldrPresent ? "success" : "warn"}
              />
            </div>
          </SectionCard>

          <SectionCard
            title="Structure & Anchors"
            tooltip={
              <span>
                Anchored headings and question‑like subheads make content easier
                to cite and extract.
              </span>
            }
          >
            <div className="flex flex-wrap gap-2 items-center">
              <Pill
                label="Anchor coverage"
                value={`${Math.round(anchorCoverage)}%`}
                tone={classifyPercent(anchorCoverage)}
              />
              <Pill
                label="Q‑heading coverage"
                value={`${Math.round(questionHeadingCoverage)}%`}
                tone={classifyPercent(questionHeadingCoverage)}
              />
              <Pill
                label="Main content ratio"
                value={`${Math.round(mainContentRatio)}%`}
                tone={classifyPercent(mainContentRatio)}
              />
            </div>
          </SectionCard>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <SectionCard
            title="Schema Completeness"
            tooltip={
              <span>
                Coverage of required fields for common schema types (FAQPage,
                Article, Question, HowTo). Higher is better.
              </span>
            }
          >
            <div className="flex items-center gap-2">
              <Pill
                label="Completeness"
                value={`${Math.round(schemaCompleteness)} / 100`}
                tone={classifyPercent(schemaCompleteness)}
              />
            </div>
          </SectionCard>
        </div>
      </div>
    );
  };

  const renderSecurity = (d: unknown) => {
    const v = (d ?? {}) as Record<string, unknown> & {
      https?: unknown;
      transport?: {
        enabled?: unknown;
        certificateValid?: unknown;
        hsts?: unknown;
      };
      headers?: {
        xFrameOptions?: unknown;
        referrerPolicy?: unknown;
        permissionsPolicy?: unknown;
        xContentTypeOptions?: unknown;
        contentSecurityPolicy?: unknown;
      };
      vulnerabilities?: Array<{
        type?: string;
        severity?: string;
        description?: string;
      }>;
      certificateValid?: unknown;
      enabled?: unknown;
      hsts?: unknown;
    };
    const transport = v?.https ?? v?.transport ?? {};
    const httpsEnabled = Boolean(
      transport?.enabled ??
        (typeof v?.https === "boolean" ? v.https : v?.enabled)
    );
    const certificateValid = Boolean(
      transport?.certificateValid ?? v?.certificateValid
    );
    const hstsEnabled = Boolean(transport?.hsts ?? v?.hsts);

    const headers = v?.headers ?? {};
    const headerStatus = {
      "X-Frame-Options": Boolean(headers?.xFrameOptions),
      "Referrer-Policy": Boolean(headers?.referrerPolicy),
      "Permissions-Policy": Boolean(headers?.permissionsPolicy),
      "X-Content-Type-Options": Boolean(headers?.xContentTypeOptions),
      "Content-Security-Policy": Boolean(headers?.contentSecurityPolicy),
    } as const;
    const missingHeadersCount = Object.values(headerStatus).filter(
      (ok) => !ok
    ).length;

    const vulnerabilities: Array<{
      type?: string;
      severity?: string;
      description?: string;
    }> = Array.isArray(v?.vulnerabilities) ? v.vulnerabilities : [];

    const severityTone = (
      sev?: string
    ): "success" | "warn" | "danger" | "default" => {
      const s = (sev || "").toLowerCase();
      if (s === "critical" || s === "high") return "danger";
      if (s === "medium") return "warn";
      if (s === "low") return "default";
      return "default";
    };

    return (
      <div className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <SectionCard
            title="Transport"
            tooltip={
              <span>
                HTTPS validity and HSTS hardening. Ensure valid certificates and
                enable HSTS to prevent downgrade attacks.
              </span>
            }
          >
            <div className="flex flex-wrap gap-2 items-center">
              <Pill
                label="HTTPS"
                value={httpsEnabled ? "enabled" : "disabled"}
                tone={httpsEnabled ? "success" : "danger"}
              />
              <Pill
                label="Certificate"
                value={certificateValid ? "valid" : "invalid"}
                tone={certificateValid ? "success" : "danger"}
              />
              <Pill
                label="HSTS"
                value={hstsEnabled ? "on" : "off"}
                tone={hstsEnabled ? "success" : "warn"}
              />
            </div>
          </SectionCard>

          <SectionCard
            title="Headers"
            tooltip={
              <span>
                Security headers reduce common risks like clickjacking and XSS.
                Aim to have all recommended headers set.
              </span>
            }
          >
            <div className="flex flex-wrap gap-2 items-center">
              {Object.entries(headerStatus).map(([name, ok]) => (
                <Pill
                  key={name}
                  label={name}
                  value={ok ? "set" : "missing"}
                  tone={ok ? "success" : "warn"}
                />
              ))}
              <Pill
                label="Missing"
                value={missingHeadersCount}
                tone={missingHeadersCount ? "warn" : "success"}
              />
            </div>
          </SectionCard>
        </div>

        <SectionCard
          title="Vulnerabilities"
          tooltip={
            <span>Automatically detected issues with suggested focus.</span>
          }
        >
          {vulnerabilities.length === 0 ? (
            <p className="text-xs text-gray-600">No issues detected.</p>
          ) : (
            <ul className="space-y-2">
              {vulnerabilities.slice(0, 20).map((vuln, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <div className="flex-none">
                    <Pill
                      label={(vuln.severity || "").toUpperCase() || "INFO"}
                      value={vuln.type || "issue"}
                      tone={severityTone(vuln.severity)}
                    />
                  </div>
                  <div className="text-xs text-gray-800 leading-snug">
                    {vuln.description || "Check configuration."}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    );
  };

  // remove stray unused variable
  const categoryLabel =
    categoryKey === "seo"
      ? "SEO"
      : categoryKey === "geo"
        ? "AI Search"
        : categoryKey[0].toUpperCase() + categoryKey.slice(1);

  const explainer =
    categoryKey !== "overall"
      ? getExplainerContent(
          categoryKey as "performance" | "seo" | "geo" | "security"
        )
      : null;

  return (
    <LiquidGlassCard className="h-full">
      <div className="px-3 py-2 mb-2 flex items-center justify-between">
        <div className="flex items-baseline gap-0.5">
          <SectionTitle title={`${categoryLabel} Details`} />
          {explainer?.whyItMatters && (
            <Tooltip
              content={
                <span className="max-w-prose block text-xs md:text-sm">
                  {explainer.whyItMatters}
                </span>
              }
            >
              <span
                aria-label="What this means"
                className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-white/40 bg-white/70 text-gray-700 align-super -translate-y-0.5 md:-translate-y-1"
              >
                <Info className="h-3 w-3" />
              </span>
            </Tooltip>
          )}
          <div className="h-7 px-2.5 bg-white/60 backdrop-blur-sm border border-white/30 rounded-md shadow-inner flex items-center text-gray-800">
            <span className="text-sm font-medium">
              {typeof score === "number" ? `${score}/100` : score}
            </span>
          </div>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
        {/* Main audit info first */}
        {categoryKey === "performance" && renderPerformance(details)}
        {categoryKey === "seo" && renderSEO(details)}
        {categoryKey === "geo" && renderGEO(details)}
        {categoryKey === "security" && renderSecurity(details)}
        {categoryKey !== "performance" &&
          categoryKey !== "seo" &&
          categoryKey !== "geo" &&
          categoryKey !== "security" &&
          (details ? (
            <StructuredObjectView data={details} />
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
