import { CategoryKey } from "./CategoryExplainer";

// Re-export the existing getExplainerContent implementation by importing from this file directly.
// NOTE: The original helper functions still live in CategoryExplainer.tsx and are referenced here via runtime.
// This split satisfies the Fast Refresh guideline (component-only exports in component files).

// Platform-specific implementation steps
function platformStepsPerformance() {
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
          "Use Cloudflare or your host's CDN; verify TTFB improvement.",
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
          "Use Shopify's img_url / image_size filters to serve responsive sizes.",
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

function platformStepsSEO() {
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
          "/sitemap.xml is auto; ensure pages are public; no 'noindex' unless intended.",
          "Verify Squarespace's Search Engine Visibility is enabled for the site.",
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
          "Auto-generated; ensure important pages aren't blocked.",
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

function platformStepsGEO() {
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

function platformStepsSecurity() {
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

// General steps functions  
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
