import React from "react";
import { Accordion } from "../ui/Accordion";
import LiquidGlassCard from "../ui/LiquidGlassCard";
import { getExplainerContent } from "./explainerContent";

export type CategoryKey = "performance" | "seo" | "geo" | "security";

interface CategoryExplainerProps {
  categoryKey: CategoryKey;
}

const Numbered: React.FC<{
  items: Array<{ title: string; notes?: string[] }>;
  start?: number;
}> = ({ items, start }) => (
  <ol
    className="list-decimal pl-5 space-y-2 text-sm text-gray-800"
    start={start ?? 1}
  >
    {items.map((it, idx) => (
      <li key={idx}>
        <span className="font-medium text-gray-900">{it.title}</span>
        {it.notes && it.notes.length > 0 && (
          <ul className="list-disc pl-4 mt-1 space-y-1 text-gray-700">
            {it.notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        )}
      </li>
    ))}
  </ol>
);

const CategoryExplainer: React.FC<CategoryExplainerProps> = ({
  categoryKey,
}) => {
  const content = getExplainerContent(categoryKey);

  return (
    <div className="space-y-3">
      {/* "What this means" moved to a tooltip next to the page title */}

      {/* Key terms moved to inline tooltips by each metric */}

      <div>
        <h4 className="text-sm font-semibold text-gray-900 mb-2">
          Step-by-step by platform
        </h4>
        <Accordion
          items={[
            {
              question: "General (All Platforms)",
              answer:
                categoryKey === "performance" ? (
                  <Numbered items={generalStepsPerformance()} />
                ) : categoryKey === "seo" ? (
                  <Numbered items={generalStepsSEO()} />
                ) : categoryKey === "geo" ? (
                  <Numbered items={generalStepsGEO()} />
                ) : (
                  <Numbered items={generalStepsSecurity()} />
                ),
            },
            {
              question: "WordPress",
              answer: <Numbered items={content.platformSteps.wordpress} />,
            },
            {
              question: "Squarespace",
              answer: <Numbered items={content.platformSteps.squarespace} />,
            },
            {
              question: "Webflow",
              answer: <Numbered items={content.platformSteps.webflow} />,
            },
            {
              question: "Shopify",
              answer: <Numbered items={content.platformSteps.shopify} />,
            },
            {
              question: "Custom code / Developers",
              answer: <Numbered items={content.platformSteps.custom} />,
            },
          ]}
        />
      </div>

      <LiquidGlassCard className="p-3 bg-white/80 backdrop-blur-sm border border-white/20 rounded-xl shadow-md">
        <h4 className="text-sm font-semibold text-gray-900 mb-2">
          How to verify your changes
        </h4>
        <ul className="list-disc pl-5 space-y-1 text-xs text-gray-700">
          {content.verify.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      </LiquidGlassCard>
    </div>
  );
};

export default CategoryExplainer;

// These functions use the data from explainerContent.ts
function generalStepsPerformance() {
  return [
    {
      title: "Measure your baseline",
      notes: [
        "Run PageSpeed Insights and WebPageTest on your homepage and a key template page.",
        "Record LCP, INP, CLS, and TTFB; take screenshots for before/after.",
      ],
    },
    {
      title: "Fix Largest Contentful Paint (LCP)",
      notes: [
        "Identify the largest element (often hero image or headline).",
        "Compress and resize the hero image; use AVIF/WebP and width/height attributes.",
        "Preload critical hero image and primary webfont; defer non-critical CSS/JS.",
      ],
    },
    {
      title: "Reduce Interaction Latency (INP)",
      notes: [
        "Open DevTools Performance; look for long tasks (>50ms).",
        "Defer third‑party scripts (chat, analytics) and remove unused ones.",
        "Chunk heavy work with requestIdleCallback or web workers if applicable.",
      ],
    },
    {
      title: "Improve TTFB",
      notes: [
        "Enable server caching and a CDN; verify TTFB from multiple regions.",
        "Cache API responses and enable HTTP/2 or HTTP/3 on hosting.",
      ],
    },
    {
      title: "Prevent layout shifts (CLS)",
      notes: [
        "Set explicit dimensions for images/ads; avoid late‑loading fonts without fallback.",
        "Reserve space for embeds/components that appear after load.",
      ],
    },
    {
      title: "Re‑measure and validate",
      notes: [
        "Re‑run PSI and WebPageTest; confirm improvements in all core metrics.",
      ],
    },
  ];
}

function generalStepsSEO() {
  return [
    {
      title: "Allow discovery & indexing",
      notes: [
        "Open /robots.txt; ensure important paths aren't disallowed.",
        "Generate/submit sitemap.xml; confirm 200 status and coverage in GSC.",
      ],
    },
    {
      title: "Canonical & duplicates",
      notes: [
        "On templates that produce similar URLs, add rel=canonical to the primary URL.",
        "Verify there's a single canonical per page in the rendered HTML.",
      ],
    },
    {
      title: "Titles, descriptions, and social",
      notes: [
        "Add concise <title> (≈50–60 chars) and meta description (≈140–160 chars).",
        "Include Open Graph and Twitter card tags for clean sharing previews.",
      ],
    },
    {
      title: "Content structure",
      notes: [
        "Use a single H1, logical H2/H3 hierarchy, and internal links to related pages.",
        "Add FAQ sections and lists where helpful; ensure headings reflect content.",
      ],
    },
    {
      title: "Structured data",
      notes: [
        "Add JSON‑LD for Organization/Product/FAQ as relevant; validate in Rich Results Test.",
        "Keep schema fields accurate and up to date.",
      ],
    },
  ];
}

function generalStepsGEO() {
  return [
    {
      title: "Create answer‑ready content",
      notes: [
        "Add concise Q&A blocks addressing common queries about your brand/products.",
        "Use bullet lists and tables for specs and comparisons where appropriate.",
      ],
    },
    {
      title: "Be citation‑friendly",
      notes: [
        "State key facts clearly (one‑sentence descriptors); keep consistent across pages.",
        "Include sources or references where possible; maintain up‑to‑date product data.",
      ],
    },
    {
      title: "Schema to reinforce meaning",
      notes: [
        "Add Organization/Product/FAQ JSON‑LD; ensure it matches on‑page content.",
      ],
    },
    {
      title: "Check inclusion",
      notes: [
        "Search in AI Overviews/assistants for brand queries; note whether your content is cited.",
      ],
    },
  ];
}

function generalStepsSecurity() {
  return [
    {
      title: "Enforce HTTPS & HSTS",
      notes: [
        "Install a valid TLS certificate; redirect HTTP→HTTPS.",
        "Enable HSTS (consider includeSubDomains + preload after testing).",
      ],
    },
    {
      title: "Set core headers",
      notes: [
        "X‑Frame‑Options: DENY or SAMEORIGIN to mitigate clickjacking.",
        "X‑Content‑Type‑Options: nosniff to prevent MIME sniffing.",
        "Referrer‑Policy: no‑referrer‑when‑downgrade (or stricter) to limit leakage.",
        "Permissions‑Policy: disable unneeded features (camera, geolocation, etc.).",
      ],
    },
    {
      title: "Introduce CSP safely",
      notes: [
        "Start with Content‑Security‑Policy‑Report‑Only; collect violations.",
        "Iteratively restrict script/style sources; then enforce CSP.",
      ],
    },
    {
      title: "Review third‑party scripts",
      notes: ["Remove unused embeds; pin versions; prefer async/defer."],
    },
  ];
}
