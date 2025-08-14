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

// The helper functions below remain in this file and are used by getExplainerContent implementation.

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

function _platformStepsPerformanceAlias() {
  return {
    wordpress: [
      {
        title: "Install and configure a performance suite",
        notes: [
          "Choose one: WP Rocket (simple), or Autoptimize + a caching plugin (W3 Total Cache/Cache Enabler).",
          "Enable page caching, browser caching, and GZIP/Brotli (host-level).",
          "In WP Rocket: enable Delay JS, Remove Unused CSS (or Optimize CSS Delivery), Preload Fonts for your primary webfont.",
        ],
      },
      {
        title: "Optimize images",
        notes: [
          "Install ShortPixel/Imagify/Smush; convert to WebP; set width/height for all images.",
          "Lazy-load below-the-fold media; avoid huge hero images (>200–300KB).",
          "Serve responsive srcset sizes (e.g., 320/640/1024/1600w) and prefer AVIF where possible.",
        ],
      },
      {
        title: "Reduce render-blocking and long tasks",
        notes: [
          "Inline critical CSS (plugin option) and defer non-critical CSS/JS.",
          "Delay third-party scripts (analytics, chat) and remove unused plugins.",
          "Use Chrome DevTools → Performance to identify >50ms long tasks; split heavy JS and defer non-essential widgets.",
        ],
      },
      {
        title: "Enable a CDN",
        notes: [
          "Use Cloudflare or your host’s CDN; verify TTFB improvement.",
          "Cache HTML where safe; add image resizing/optimization at the edge if available.",
        ],
      },
    ],
    squarespace: [
      {
        title: "Compress and resize media",
        notes: ["Upload WebP where possible; keep total page ≤ 1–2 MB."],
      },
      {
        title: "Limit heavy sections",
        notes: [
          "Reduce animations/video backgrounds; fewer blocks per page.",
          "Avoid third‑party embeds above the fold; move non‑critical blocks lower on the page.",
        ],
      },
      {
        title: "Use built-in caching/CDN",
        notes: [
          "Publish changes; test again to see cache effect.",
          "Under Site Availability/Performance, enable HTTP/2 and any image CDN options.",
        ],
      },
    ],
    webflow: [
      {
        title: "Enable minification",
        notes: ["Project Settings → Hosting → Minify JS/CSS; Enable SSL."],
      },
      {
        title: "Reduce interactions",
        notes: [
          "Limit complex animations; remove unused components.",
          "Audit → Interactions: remove continuous animations on large elements; prefer simpler effects.",
        ],
      },
      {
        title: "CDN publish",
        notes: [
          "Publish to Webflow hosting for their global CDN.",
          "Preload hero image/font via Custom Code (before </head>) and ensure images have explicit dimensions.",
        ],
      },
    ],
    shopify: [
      {
        title: "Trim apps & scripts",
        notes: [
          "Remove unused apps; they inject JS/CSS.",
          "Use Theme → App embeds to disable unneeded scripts; measure before/after in DevTools.",
        ],
      },
      {
        title: "Optimize images",
        notes: [
          "Use apps or local tools to compress; prefer WebP.",
          "Use Shopify’s img_url / image_size filters to serve responsive sizes.",
        ],
      },
      {
        title: "Defer non-critical JS",
        notes: [
          "Use theme settings or developer help to add defer/async.",
          "In theme.liquid, move non‑critical scripts to the footer and add defer; load sections async where possible.",
        ],
      },
    ],
    custom: [
      {
        title: "Server & CDN",
        notes: [
          "Use HTTP/2/3; enable CDN; add caching headers; compress (Brotli).",
          "Set Cache‑Control for static assets (≥ 1 year) and HTML (short TTL if dynamic).",
        ],
      },
      {
        title: "Critical path",
        notes: [
          "Inline critical CSS; defer non-critical JS; preload key fonts/assets.",
          "Split bundles; lazy‑load below‑the‑fold components; avoid render‑blocking third‑party tags.",
        ],
      },
      {
        title: "Image pipeline",
        notes: ["Convert to AVIF/WebP; resize server-side; lazy-load."],
      },
    ],
  } as const;
}

function generalStepsSEO() {
  return [
    {
      title: "Allow discovery & indexing",
      notes: [
        "Open /robots.txt; ensure important paths aren’t disallowed.",
        "Generate/submit sitemap.xml; confirm 200 status and coverage in GSC.",
      ],
    },
    {
      title: "Canonical & duplicates",
      notes: [
        "On templates that produce similar URLs, add rel=canonical to the primary URL.",
        "Verify there’s a single canonical per page in the rendered HTML.",
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

function _platformStepsSEOAlias() {
  return {
    wordpress: [
      {
        title: "Install Yoast or RankMath",
        notes: [
          "Enable XML sitemap; set site representation (Organization).",
          "In Search Appearance, configure titles/metadata; enable breadcrumbs if used.",
        ],
      },
      {
        title: "Check robots and canonical",
        notes: [
          "Yoast → Tools → File editor or create robots.txt; ensure no unintended Disallow.",
          "For paginated/category archives, ensure canonical points to the preferred page.",
        ],
      },
      {
        title: "Titles, meta, headings",
        notes: [
          "Unique H1; concise titles/descriptions; clear H2/H3 structure.",
          "Add Open Graph/Twitter tags (plugin can manage); ensure image dimensions for rich previews.",
        ],
      },
      {
        title: "Submit sitemap",
        notes: [
          "Google Search Console → Sitemaps; monitor Coverage and Page indexing reports.",
        ],
      },
    ],
    squarespace: [
      {
        title: "Set page SEO",
        notes: [
          "Page Settings → SEO → Title & Description; clean slugs.",
          "Hide non‑indexable pages from navigation and set noindex where appropriate.",
        ],
      },
      {
        title: "Sitemap & robots",
        notes: [
          "/sitemap.xml is auto; ensure pages are public; no ‘noindex’ unless intended.",
          "Verify Squarespace’s Search Engine Visibility is enabled for the site.",
        ],
      },
      {
        title: "Headings & nav",
        notes: [
          "One H1 per page; meaningful internal links.",
          "Use Summary Blocks for internal linking to key content hubs.",
        ],
      },
    ],
    webflow: [
      {
        title: "Per-page SEO settings",
        notes: [
          "Set title/description; canonical if templates generate duplicates.",
          "Define Open Graph images per template; ensure alt text on images.",
        ],
      },
      {
        title: "Auto sitemap",
        notes: [
          "Enable in Project Settings → SEO; publish.",
          "Exclude utility pages (e.g., 404, search) from sitemap.",
        ],
      },
      {
        title: "Semantic structure",
        notes: [
          "Proper H1/H2; aria-labels where relevant.",
          "Use Collections for structured content; add internal links within Rich Text fields.",
        ],
      },
    ],
    shopify: [
      {
        title: "Product/collection SEO",
        notes: [
          "Unique titles/descriptions; avoid duplicate content.",
          "Add alt text for product images; ensure collection descriptions are unique.",
        ],
      },
      {
        title: "Sitemap & robots",
        notes: [
          "Auto-generated; ensure important pages aren’t blocked.",
          "If needed, customize robots.txt via theme (robots.txt.liquid) to allow key paths.",
        ],
      },
      {
        title: "Canonical links",
        notes: [
          "Shopify themes include them; verify with View Source.",
          "For variants generating distinct URLs, ensure canonical to the main product URL.",
        ],
      },
    ],
    custom: [
      {
        title: "Sitemap & robots",
        notes: [
          "Generate sitemap; expose /robots.txt; ensure 200 status.",
          "Group disallows carefully; avoid blocking assets needed for rendering.",
        ],
      },
      {
        title: "Meta & canonical",
        notes: [
          "Add <title>, meta description, and rel=canonical on duplicates.",
          "Set Open Graph/Twitter cards; add alt text on images.",
        ],
      },
      {
        title: "Heading hierarchy",
        notes: [
          "Single H1; logical H2/H3; internal linking.",
          "Create content hubs with topic clusters and link between related pages.",
        ],
      },
    ],
  } as const;
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

function _platformStepsGEOAlias() {
  return {
    wordpress: [
      {
        title: "Add FAQ & Organization schema",
        notes: [
          "Use Yoast/RankMath schema; fill organization details.",
          "Add FAQ blocks on relevant pages; ensure answers are concise (2–4 sentences).",
        ],
      },
      {
        title: "Create Q&A content",
        notes: [
          "Write FAQ blocks answering real questions; cite trustworthy sources.",
          "Use internal links to supporting detail pages; keep one answer per question.",
        ],
      },
      {
        title: "Brand descriptor for AI",
        notes: [
          "Create an /about or /llms.txt with a one-sentence brand description.",
          "Repeat core descriptor on homepage/footer for consistency.",
        ],
      },
    ],
    squarespace: [
      {
        title: "FAQ sections",
        notes: [
          "Add FAQ blocks; ensure pages are indexed (Public).",
          "Use Summary/Accordion blocks to present answers cleanly.",
        ],
      },
      {
        title: "Brand summary",
        notes: [
          "Concise description on About/Home; consistent across pages.",
          "Use Site Title/Tagline fields to reinforce phrasing where appropriate.",
        ],
      },
      {
        title: "JSON-LD injection (optional)",
        notes: [
          "Add Organization/FAQ JSON-LD in Code Injection if comfortable.",
          "Validate with Rich Results Test; keep data in sync with on-page content.",
        ],
      },
    ],
    webflow: [
      {
        title: "CMS for FAQs",
        notes: [
          "Create a FAQ collection; ensure structured layout and linking.",
          "Create a Q&A template with question/answer fields; surface related answers via references.",
        ],
      },
      {
        title: "JSON-LD embeds",
        notes: [
          "Add Organization/FAQ JSON-LD via Custom Code.",
          "Populate from CMS fields to avoid drift between schema and content.",
        ],
      },
    ],
    shopify: [
      {
        title: "FAQ template/app",
        notes: [
          "Use an FAQ app or template; ensure content addresses common queries.",
          "Place FAQs on product/category pages where contextually relevant.",
        ],
      },
      {
        title: "Product data accuracy",
        notes: [
          "Keep product titles/specs consistent; add Product schema via app.",
          "Avoid conflicting specs across pages; cite sources where appropriate.",
        ],
      },
    ],
    custom: [
      {
        title: "Schema at scale",
        notes: [
          "Add JSON-LD (Organization/Product/FAQ). Validate regularly.",
          "Automate schema generation from your CMS to ensure parity with content.",
        ],
      },
      {
        title: "Authoritative content",
        notes: [
          "Create Q&A and how-to content; include citations and internal links.",
          "Write clear one‑sentence summaries at the top of key pages for easy quoting.",
        ],
      },
    ],
  } as const;
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

function _platformStepsSecurityAlias() {
  return {
    wordpress: [
      {
        title: "Enforce HTTPS & HSTS",
        notes: [
          "Use Really Simple SSL; set HSTS at host; redirect HTTP→HTTPS.",
          "Confirm certificate auto‑renewal; test HSTS preload readiness before submitting.",
        ],
      },
      {
        title: "Security headers",
        notes: [
          "If host allows, add CSP, X-Frame-Options: DENY, X-Content-Type-Options: nosniff, Referrer-Policy.",
          "Use a headers plugin or .htaccess/nginx config; start CSP in Report‑Only.",
        ],
      },
      {
        title: "Harden admin",
        notes: [
          "Enable 2FA; limit login attempts; keep core/plugins updated.",
          "Disable XML‑RPC if unused; restrict /wp-admin with IP allowlists where possible.",
        ],
      },
    ],
    squarespace: [
      {
        title: "Enable SSL",
        notes: ["Settings → Advanced → SSL; prefer Secure."],
      },
      {
        title: "Minimize third-party embeds",
        notes: [
          "Less external JS reduces risk.",
          "Avoid inline scripts in Code Injection; host assets on trusted domains only.",
        ],
      },
    ],
    webflow: [
      {
        title: "Enable SSL & headers",
        notes: [
          "Hosting settings; add headers via hosting/CDN if available.",
          "If deploying to Netlify/Vercel/Cloudflare, configure security headers in the platform.",
        ],
      },
    ],
    shopify: [
      {
        title: "SSL & app hygiene",
        notes: [
          "Ensure SSL; remove unnecessary apps and revoke unused access.",
          "Use staff accounts with least privilege; enable 2FA for all admins.",
        ],
      },
    ],
    custom: [
      {
        title: "TLS & HSTS",
        notes: [
          "Strong ciphers; HSTS with includeSubDomains and preload if suitable.",
          "Automate certificate renewal; consider OCSP stapling.",
        ],
      },
      {
        title: "CSP",
        notes: [
          "Start with report-only; tighten gradually (script-src 'self' cdn.whitelist).",
          "Add Subresource Integrity (SRI) to third‑party scripts; eliminate inline scripts.",
        ],
      },
    ],
  } as const;
}
