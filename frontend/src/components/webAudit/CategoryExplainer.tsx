import React from "react";
import { Accordion } from "../ui/Accordion";
import LiquidGlassCard from "../ui/LiquidGlassCard";

type CategoryKey = "performance" | "seo" | "geo" | "security";

interface CategoryExplainerProps {
  categoryKey: CategoryKey;
}

const bullets = (items: Array<string>) => (
  <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
    {items.map((t, i) => (
      <li key={i}>{t}</li>
    ))}
  </ul>
);

const numbered = (
  items: Array<{ title: string; notes?: string[] }>,
  opts?: { start?: number }
) => (
  <ol
    className="list-decimal pl-5 space-y-2 text-sm text-gray-800"
    start={opts?.start ?? 1}
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
      <LiquidGlassCard className="p-3 bg-white/80 backdrop-blur-sm border border-white/20 rounded-xl shadow-md">
        <h4 className="text-sm font-semibold text-gray-900 mb-1">
          What this means
        </h4>
        <p className="text-sm text-gray-700">{content.whyItMatters}</p>
      </LiquidGlassCard>

      <LiquidGlassCard className="p-3 bg-white/80 backdrop-blur-sm border border-white/20 rounded-xl shadow-md">
        <h4 className="text-sm font-semibold text-gray-900 mb-2">
          Key terms and abbreviations
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {content.keyTerms.map((term, i) => (
            <div key={i} className="text-sm">
              <div className="font-semibold text-gray-900">{term.term}</div>
              <div className="text-xs text-gray-700">{term.def}</div>
            </div>
          ))}
        </div>
      </LiquidGlassCard>

      <LiquidGlassCard className="p-3 bg-white/80 backdrop-blur-sm border border-white/20 rounded-xl shadow-md">
        <h4 className="text-sm font-semibold text-gray-900 mb-2">
          How to improve (high-level)
        </h4>
        {numbered(content.highLevelSteps.map((s) => ({ title: s })))}
      </LiquidGlassCard>

      <div>
        <h4 className="text-sm font-semibold text-gray-900 mb-2">
          Step-by-step by platform
        </h4>
        <Accordion
          items={[
            {
              question: "WordPress",
              answer: numbered(content.platformSteps.wordpress),
            },
            {
              question: "Squarespace",
              answer: numbered(content.platformSteps.squarespace),
            },
            {
              question: "Webflow",
              answer: numbered(content.platformSteps.webflow),
            },
            {
              question: "Shopify",
              answer: numbered(content.platformSteps.shopify),
            },
            {
              question: "Custom code / Developers",
              answer: numbered(content.platformSteps.custom),
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

function getExplainerContent(category: CategoryKey) {
  if (category === "performance") {
    return {
      whyItMatters:
        "Performance affects user experience, conversion rates, and search visibility. Faster sites reduce bounce rates and are favored by search engines and AI systems when selecting sources.",
      keyTerms: [
        {
          term: "LCP (Largest Contentful Paint)",
          def: "Time to render the largest content element in the viewport. Aim for ≤ 2.5s.",
        },
        {
          term: "INP (Interaction to Next Paint)",
          def: "Responsiveness to user input. Aim for ≤ 200ms.",
        },
        {
          term: "CLS (Cumulative Layout Shift)",
          def: "Visual stability during load. Aim for ≤ 0.1.",
        },
        {
          term: "TTFB (Time to First Byte)",
          def: "Server response time to first byte. Aim for ≤ 800ms.",
        },
        {
          term: "Render-blocking",
          def: "Assets (CSS/JS) that delay initial paint. Should be deferred or inlined appropriately.",
        },
      ],
      highLevelSteps: [
        "Compress and correctly size images (WebP/AVIF).",
        "Defer non-critical JavaScript; remove unused scripts and plugins.",
        "Inline critical CSS; load the rest asynchronously.",
        "Use a CDN and enable server-side caching; optimize TTFB.",
        "Minimize layout shifts with fixed dimensions for images/ads/fonts.",
      ],
      platformSteps: platformStepsPerformance(),
      verify: [
        "Run PageSpeed Insights/Lighthouse before and after; compare LCP/INP/CLS.",
        "Use Chrome DevTools → Performance to confirm fewer long tasks (>50ms).",
        "Check WebPageTest for TTFB and CDN effectiveness.",
      ],
    };
  }

  if (category === "seo") {
    return {
      whyItMatters:
        "SEO ensures your content can be discovered and indexed accurately. Proper technical SEO and metadata improve ranking, click-through, and how AI models summarize your brand.",
      keyTerms: [
        {
          term: "Indexability",
          def: "Whether search engines are allowed and able to index your pages (robots.txt, robots meta).",
        },
        {
          term: "Sitemap",
          def: "XML file listing pages to help discovery. Keep it updated.",
        },
        {
          term: "Canonical",
          def: "Tag that signals the primary version of a page to avoid duplicates.",
        },
        {
          term: "OG/Twitter cards",
          def: "Social meta tags controlling link previews across platforms.",
        },
        {
          term: "Hreflang",
          def: "Annotation indicating language/region versions of pages.",
        },
      ],
      highLevelSteps: [
        "Ensure robots.txt allows important sections and a sitemap is submitted.",
        "Set canonical tags on pages with similar content.",
        "Complete title and meta description with clear, concise copy.",
        "Add Open Graph and Twitter card tags for better sharing and AI context.",
        "Maintain clean heading hierarchy (H1 → H2 → H3) and internal linking.",
      ],
      platformSteps: platformStepsSEO(),
      verify: [
        "Open /robots.txt in a browser; ensure no accidental Disallow on key paths.",
        "Fetch sitemap.xml; verify it lists important pages and returns 200.",
        "Use Google Search Console: URL Inspection → Test Live URL to confirm indexability.",
        "Validate JSON-LD via schema.org validator or Rich Results Test.",
      ],
    };
  }

  if (category === "geo") {
    return {
      whyItMatters:
        "AI Search (GEO) is about how AI assistants and overviews reference your brand. Clear structure, schema, and authoritative content improve inclusion in generated answers.",
      keyTerms: [
        {
          term: "GEO (Generative Engine Optimization)",
          def: "Optimizing content to be cited and represented accurately by AI systems.",
        },
        {
          term: "Schema (JSON-LD)",
          def: "Structured data describing organizations, products, FAQs, etc., helping machines understand your site.",
        },
        {
          term: "Citations",
          def: "Clear sourcing and references that AI can attribute and trust.",
        },
        {
          term: "Q&A Content",
          def: "FAQ-style, concise answers aligned with user questions that AI often aggregates.",
        },
      ],
      highLevelSteps: [
        "Add Organization/Product/FAQ schema with accurate fields.",
        "Create authoritative Q&A and how-to content; include citations and brand mentions.",
        "Strengthen internal linking and ensure pages are indexable.",
        "Publish consistent brand descriptors that AIs can quote (e.g., in llms.txt/about pages).",
      ],
      platformSteps: platformStepsGEO(),
      verify: [
        "Use AI Overviews/ChatGPT/Perplexity to ask brand queries; note if your content appears or is cited.",
        "Check that Organization/Product/FAQ schema validates without errors.",
        "Monitor inclusion in your Visibility dashboard over 2–4 weeks.",
      ],
    };
  }

  // security
  return {
    whyItMatters:
      "Security safeguards users and brand trust. Browsers and AI systems deprioritize or warn against insecure sites. Proper headers and TLS protect data and reduce risks.",
    keyTerms: [
      {
        term: "HTTPS/TLS",
        def: "Encrypted transport; all pages should be served over HTTPS with valid certificates.",
      },
      {
        term: "HSTS",
        def: "Forces HTTPS; protects against protocol downgrade attacks.",
      },
      {
        term: "CSP (Content-Security-Policy)",
        def: "Mitigates XSS by restricting allowed sources of scripts, styles, etc.",
      },
      { term: "X-Content-Type-Options", def: "Prevents MIME-type sniffing." },
      {
        term: "Referrer-Policy",
        def: "Controls how much referrer info is sent.",
      },
      {
        term: "Permissions-Policy",
        def: "Opt-in to browser features (camera, geolocation, etc.).",
      },
    ],
    highLevelSteps: [
      "Enable HTTPS across your domain; redirect HTTP→HTTPS.",
      "Add HSTS header (include subdomains if applicable).",
      "Set baseline security headers (CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy).",
      "Keep core, themes/plugins, and dependencies updated.",
    ],
    platformSteps: platformStepsSecurity(),
    verify: [
      "Visit your site over https:// and confirm no mixed content in browser console.",
      "Run securityheaders.com; aim for at least A rating and iterate on CSP.",
      "Confirm HSTS preload where appropriate; verify via hstspreload.org.",
    ],
  };
}

function platformStepsPerformance() {
  return {
    wordpress: [
      {
        title: "Install and configure a performance suite",
        notes: [
          "Choose one: WP Rocket (simple), or Autoptimize + a caching plugin (W3 Total Cache/Cache Enabler).",
          "Enable page caching, browser caching, and GZIP/Brotli (host-level).",
        ],
      },
      {
        title: "Optimize images",
        notes: [
          "Install ShortPixel/Imagify/Smush; convert to WebP; set width/height for all images.",
          "Lazy-load below-the-fold media; avoid huge hero images (>200–300KB).",
        ],
      },
      {
        title: "Reduce render-blocking",
        notes: [
          "Inline critical CSS (plugin option) and defer non-critical CSS/JS.",
          "Delay third-party scripts (analytics, chat) and remove unused plugins.",
        ],
      },
      {
        title: "Enable a CDN",
        notes: ["Use Cloudflare or your host’s CDN; verify TTFB improvement."],
      },
    ],
    squarespace: [
      {
        title: "Compress and resize media",
        notes: ["Upload WebP where possible; keep total page ≤ 1–2 MB."],
      },
      {
        title: "Limit heavy sections",
        notes: ["Reduce animations/video backgrounds; fewer blocks per page."],
      },
      {
        title: "Use built-in caching/CDN",
        notes: ["Publish changes; test again to see cache effect."],
      },
    ],
    webflow: [
      {
        title: "Enable minification",
        notes: ["Project Settings → Hosting → Minify JS/CSS; Enable SSL."],
      },
      {
        title: "Reduce interactions",
        notes: ["Limit complex animations; remove unused components."],
      },
      {
        title: "CDN publish",
        notes: ["Publish to Webflow hosting for their global CDN."],
      },
    ],
    shopify: [
      {
        title: "Trim apps & scripts",
        notes: ["Remove unused apps; they inject JS/CSS."],
      },
      {
        title: "Optimize images",
        notes: ["Use apps or local tools to compress; prefer WebP."],
      },
      {
        title: "Defer non-critical JS",
        notes: ["Use theme settings or developer help to add defer/async."],
      },
    ],
    custom: [
      {
        title: "Server & CDN",
        notes: [
          "Use HTTP/2/3; enable CDN; add caching headers; compress (Brotli).",
        ],
      },
      {
        title: "Critical path",
        notes: [
          "Inline critical CSS; defer non-critical JS; preload key fonts/assets.",
        ],
      },
      {
        title: "Image pipeline",
        notes: ["Convert to AVIF/WebP; resize server-side; lazy-load."],
      },
    ],
  } as const;
}

function platformStepsSEO() {
  return {
    wordpress: [
      {
        title: "Install Yoast or RankMath",
        notes: ["Enable XML sitemap; set site representation (Organization)."],
      },
      {
        title: "Check robots and canonical",
        notes: [
          "Yoast → Tools → File editor or create robots.txt; ensure no unintended Disallow.",
        ],
      },
      {
        title: "Titles, meta, headings",
        notes: [
          "Unique H1; concise titles/descriptions; clear H2/H3 structure.",
        ],
      },
      {
        title: "Submit sitemap",
        notes: ["Google Search Console → Sitemaps; monitor Coverage errors."],
      },
    ],
    squarespace: [
      {
        title: "Set page SEO",
        notes: ["Page Settings → SEO → Title & Description; clean slugs."],
      },
      {
        title: "Sitemap & robots",
        notes: [
          "/sitemap.xml is auto; ensure pages are public; no ‘noindex’ unless intended.",
        ],
      },
      {
        title: "Headings & nav",
        notes: ["One H1 per page; meaningful internal links."],
      },
    ],
    webflow: [
      {
        title: "Per-page SEO settings",
        notes: [
          "Set title/description; canonical if templates generate duplicates.",
        ],
      },
      {
        title: "Auto sitemap",
        notes: ["Enable in Project Settings → SEO; publish."],
      },
      {
        title: "Semantic structure",
        notes: ["Proper H1/H2; aria-labels where relevant."],
      },
    ],
    shopify: [
      {
        title: "Product/collection SEO",
        notes: ["Unique titles/descriptions; avoid duplicate content."],
      },
      {
        title: "Sitemap & robots",
        notes: ["Auto-generated; ensure important pages aren’t blocked."],
      },
      {
        title: "Canonical links",
        notes: ["Shopify themes include them; verify with View Source."],
      },
    ],
    custom: [
      {
        title: "Sitemap & robots",
        notes: ["Generate sitemap; expose /robots.txt; ensure 200 status."],
      },
      {
        title: "Meta & canonical",
        notes: [
          "Add <title>, meta description, and rel=canonical on duplicates.",
        ],
      },
      {
        title: "Heading hierarchy",
        notes: ["Single H1; logical H2/H3; internal linking."],
      },
    ],
  } as const;
}

function platformStepsGEO() {
  return {
    wordpress: [
      {
        title: "Add FAQ & Organization schema",
        notes: ["Use Yoast/RankMath schema; fill organization details."],
      },
      {
        title: "Create Q&A content",
        notes: [
          "Write FAQ blocks answering real questions; cite trustworthy sources.",
        ],
      },
      {
        title: "Brand descriptor for AI",
        notes: [
          "Create an /about or /llms.txt with a one-sentence brand description.",
        ],
      },
    ],
    squarespace: [
      {
        title: "FAQ sections",
        notes: ["Add FAQ blocks; ensure pages are indexed (Public)."],
      },
      {
        title: "Brand summary",
        notes: ["Concise description on About/Home; consistent across pages."],
      },
      {
        title: "JSON-LD injection (optional)",
        notes: [
          "Add Organization/FAQ JSON-LD in Code Injection if comfortable.",
        ],
      },
    ],
    webflow: [
      {
        title: "CMS for FAQs",
        notes: [
          "Create a FAQ collection; ensure structured layout and linking.",
        ],
      },
      {
        title: "JSON-LD embeds",
        notes: ["Add Organization/FAQ JSON-LD via Custom Code."],
      },
    ],
    shopify: [
      {
        title: "FAQ template/app",
        notes: [
          "Use an FAQ app or template; ensure content addresses common queries.",
        ],
      },
      {
        title: "Product data accuracy",
        notes: [
          "Keep product titles/specs consistent; add Product schema via app.",
        ],
      },
    ],
    custom: [
      {
        title: "Schema at scale",
        notes: ["Add JSON-LD (Organization/Product/FAQ). Validate regularly."],
      },
      {
        title: "Authoritative content",
        notes: [
          "Create Q&A and how-to content; include citations and internal links.",
        ],
      },
    ],
  } as const;
}

function platformStepsSecurity() {
  return {
    wordpress: [
      {
        title: "Enforce HTTPS & HSTS",
        notes: [
          "Use Really Simple SSL; set HSTS at host; redirect HTTP→HTTPS.",
        ],
      },
      {
        title: "Security headers",
        notes: [
          "If host allows, add CSP, X-Frame-Options: DENY, X-Content-Type-Options: nosniff, Referrer-Policy.",
        ],
      },
      {
        title: "Harden admin",
        notes: ["Enable 2FA; limit login attempts; keep core/plugins updated."],
      },
    ],
    squarespace: [
      {
        title: "Enable SSL",
        notes: ["Settings → Advanced → SSL; prefer Secure."],
      },
      {
        title: "Minimize third-party embeds",
        notes: ["Less external JS reduces risk."],
      },
    ],
    webflow: [
      {
        title: "Enable SSL & headers",
        notes: ["Hosting settings; add headers via hosting/CDN if available."],
      },
    ],
    shopify: [
      {
        title: "SSL & app hygiene",
        notes: [
          "Ensure SSL; remove unnecessary apps and revoke unused access.",
        ],
      },
    ],
    custom: [
      {
        title: "TLS & HSTS",
        notes: [
          "Strong ciphers; HSTS with includeSubDomains and preload if suitable.",
        ],
      },
      {
        title: "CSP",
        notes: [
          "Start with report-only; tighten gradually (script-src 'self' cdn.whitelist).",
        ],
      },
    ],
  } as const;
}

export default CategoryExplainer;
