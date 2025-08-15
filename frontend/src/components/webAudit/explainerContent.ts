import { CategoryKey } from "./CategoryExplainer";

// Re-export the existing getExplainerContent implementation by importing from this file directly.
// NOTE: The original helper functions still live in CategoryExplainer.tsx and are referenced here via runtime.
// This split satisfies the Fast Refresh guideline (component-only exports in component files).

declare function platformStepsPerformance(): {
  wordpress: Array<{ title: string; notes?: string[] }>;
  squarespace: Array<{ title: string; notes?: string[] }>;
  webflow: Array<{ title: string; notes?: string[] }>;
  shopify: Array<{ title: string; notes?: string[] }>;
  custom: Array<{ title: string; notes?: string[] }>;
};
declare function platformStepsSEO(): {
  wordpress: Array<{ title: string; notes?: string[] }>;
  squarespace: Array<{ title: string; notes?: string[] }>;
  webflow: Array<{ title: string; notes?: string[] }>;
  shopify: Array<{ title: string; notes?: string[] }>;
  custom: Array<{ title: string; notes?: string[] }>;
};
declare function platformStepsGEO(): {
  wordpress: Array<{ title: string; notes?: string[] }>;
  squarespace: Array<{ title: string; notes?: string[] }>;
  webflow: Array<{ title: string; notes?: string[] }>;
  shopify: Array<{ title: string; notes?: string[] }>;
  custom: Array<{ title: string; notes?: string[] }>;
};
declare function platformStepsSecurity(): {
  wordpress: Array<{ title: string; notes?: string[] }>;
  squarespace: Array<{ title: string; notes?: string[] }>;
  webflow: Array<{ title: string; notes?: string[] }>;
  shopify: Array<{ title: string; notes?: string[] }>;
  custom: Array<{ title: string; notes?: string[] }>;
};
declare function _generalStepsPerformance(): Array<{
  title: string;
  notes?: string[];
}>;
declare function _generalStepsSEO(): Array<{ title: string; notes?: string[] }>;
declare function _generalStepsGEO(): Array<{ title: string; notes?: string[] }>;
declare function _generalStepsSecurity(): Array<{
  title: string;
  notes?: string[];
}>;
// Note: The declared functions above are implemented in CategoryExplainer.tsx
// and are available at runtime when this module is used

export function getExplainerContent(category: CategoryKey) {
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
      highLevelSteps: generalStepsPerformance(),
      platformSteps: platformStepsPerformance(),
      verify: [
        "Run PageSpeed Insights/Lighthouse before and after; compare LCP/INP/CLS.",
        "Use Chrome DevTools → Performance to confirm fewer long tasks (>50ms).",
        "Check WebPageTest for TTFB and CDN effectiveness.",
      ],
    } as const;
  }

  if (category === "seo") {
    return {
      whyItMatters:
        "Technical SEO ensures your content can be crawled, rendered, and indexed accurately. Clean sitemaps, robots rules, canonicalization, and metadata improve discovery and click-through.",
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
    } as const;
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
    } as const;
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
  } as const;
}
