/**
 * @file performanceAnalyzer.ts
 * @description Performance analysis using Google PageSpeed Insights API
 *
 * Analyzes website performance including:
 * - Core Web Vitals (LCP, FID, CLS)
 * - Page load speed metrics
 * - Resource optimization opportunities
 * - Mobile vs Desktop performance
 *
 * @dependencies
 * - Google PageSpeed Insights API
 * - Direct performance measurement
 */

import axios from "axios";
import logger from "../../../utils/logger";
import { PerformanceResults } from "../webAuditService";

interface PageSpeedResponse {
  lighthouseResult: {
    audits: {
      [key: string]: {
        score: number | null;
        numericValue?: number;
        displayValue?: string;
        details?: Record<string, unknown>;
      };
    };
    categories: {
      performance: {
        score: number;
      };
    };
  };
  loadingExperience?: {
    metrics: {
      [key: string]: {
        percentile: number;
        category: string;
      };
    };
  };
}

class PerformanceAnalyzer {
  private readonly apiKey: string;
  private readonly baseUrl =
    "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

  constructor() {
    this.apiKey = process.env.GOOGLE_PAGESPEED_API_KEY || "";
    if (!this.apiKey) {
      logger.warn("Google PageSpeed API key not configured");
    }
  }

  /**
   * Analyze website performance
   */
  async analyze(url: string): Promise<PerformanceResults> {
    const startTime = Date.now();

    try {
      logger.info("Starting performance analysis", { url });

      // Run both mobile and desktop analysis in parallel
      const [mobileResult, desktopResult] = await Promise.allSettled([
        this.analyzeWithPageSpeed(url, "mobile"),
        this.analyzeWithPageSpeed(url, "desktop"),
      ]);

      // Extract mobile results
      let mobileData: PageSpeedResponse | null = null;
      if (mobileResult.status === "fulfilled") {
        mobileData = mobileResult.value;
      } else {
        logger.warn("Mobile PageSpeed analysis failed", {
          url,
          error: mobileResult.reason,
        });
      }

      // Extract desktop results
      let desktopData: PageSpeedResponse | null = null;
      if (desktopResult.status === "fulfilled") {
        desktopData = desktopResult.value;
      } else {
        logger.warn("Desktop PageSpeed analysis failed", {
          url,
          error: desktopResult.reason,
        });
      }

      // Use mobile data as primary (Google's mobile-first approach)
      const primaryData = mobileData || desktopData;

      if (!primaryData) {
        throw new Error("Both mobile and desktop PageSpeed analysis failed");
      }

      // Extract Core Web Vitals
      const coreWebVitals = this.extractCoreWebVitals(primaryData);

      // Extract performance metrics
      const performanceMetrics = this.extractPerformanceMetrics(primaryData);

      // Extract optimization opportunities
      const opportunities = this.extractOpportunities(primaryData);

      // Calculate scores
      const mobileScore = mobileData?.lighthouseResult.categories.performance
        .score
        ? Math.round(
            mobileData.lighthouseResult.categories.performance.score * 100
          )
        : 0;

      const desktopScore = desktopData?.lighthouseResult.categories.performance
        .score
        ? Math.round(
            desktopData.lighthouseResult.categories.performance.score * 100
          )
        : 0;

      const result: PerformanceResults = {
        coreWebVitals,
        loadTime: performanceMetrics.loadTime,
        pageSize: performanceMetrics.pageSize,
        resourceCount: performanceMetrics.resourceCount,
        mobileScore,
        desktopScore,
        ...(typeof performanceMetrics.ttfb === "number"
          ? { ttfb: Math.round(performanceMetrics.ttfb) }
          : {}),
        ...(typeof performanceMetrics.inp === "number"
          ? { inp: Math.round(performanceMetrics.inp) }
          : {}),
        opportunities,
      };

      const analysisTime = Date.now() - startTime;

      logger.info("Performance analysis completed", {
        url,
        analysisTime,
        mobileScore,
        desktopScore,
        coreWebVitals,
        opportunityCount: opportunities.length,
      });

      return result;
    } catch (error) {
      const analysisTime = Date.now() - startTime;

      logger.error("Performance analysis failed", {
        url,
        analysisTime,
        error: error instanceof Error ? error.message : String(error),
      });

      // Return default/fallback results
      return {
        coreWebVitals: { lcp: 0, fid: 0, cls: 0 },
        loadTime: 0,
        pageSize: 0,
        resourceCount: 0,
        mobileScore: 0,
        desktopScore: 0,
        opportunities: [
          {
            title: "Analysis Failed",
            description: `Performance analysis could not be completed: ${error instanceof Error ? error.message : String(error)}`,
            savings: 0,
          },
        ],
      };
    }
  }

  /**
   * Analyze with PageSpeed Insights API
   */
  private async analyzeWithPageSpeed(
    url: string,
    strategy: "mobile" | "desktop"
  ): Promise<PageSpeedResponse> {
    if (!this.apiKey) {
      throw new Error("Google PageSpeed API key not configured");
    }

    const params = new URLSearchParams({
      url: url,
      key: this.apiKey,
      strategy: strategy,
      category: "performance",
      locale: "en_US",
    });

    const response = await axios.get(`${this.baseUrl}?${params}`, {
      timeout: 30000, // 30 second timeout
      headers: {
        "User-Agent": "Serplexity-WebAudit/1.0",
      },
    });

    if (response.status !== 200) {
      throw new Error(`PageSpeed API returned status ${response.status}`);
    }

    return response.data;
  }

  /**
   * Extract Core Web Vitals from PageSpeed results
   */
  private extractCoreWebVitals(data: PageSpeedResponse): {
    lcp: number;
    fid: number;
    cls: number;
  } {
    const audits = data.lighthouseResult.audits;

    // Largest Contentful Paint (LCP) - target: < 2.5s
    const lcp = audits["largest-contentful-paint"]?.numericValue || 0;

    // First Input Delay (legacy) and INP (modern)
    const fid = audits["max-potential-fid"]?.numericValue || 0;

    // Cumulative Layout Shift (CLS) - target: < 0.1
    const cls = audits["cumulative-layout-shift"]?.numericValue || 0;

    return {
      lcp: Math.round(lcp),
      fid: Math.round(fid),
      cls: Math.round(cls * 1000) / 1000, // Keep 3 decimal places for CLS
    };
  }

  /**
   * Extract general performance metrics
   */
  private extractPerformanceMetrics(data: PageSpeedResponse): {
    loadTime: number;
    pageSize: number;
    resourceCount: number;
    ttfb?: number;
    inp?: number;
  } {
    const audits = data.lighthouseResult.audits;

    // Load time metrics
    const firstContentfulPaint =
      audits["first-contentful-paint"]?.numericValue || 0;
    const speedIndex = audits["speed-index"]?.numericValue || 0;
    const interactive = audits["interactive"]?.numericValue || 0;

    // Use Speed Index as primary load time metric
    const loadTime = Math.round(speedIndex);

    // Time To First Byte (server-response-time)
    const ttfb =
      audits["server-response-time"]?.numericValue ||
      audits["time-to-first-byte"]?.numericValue ||
      0;

    // Interaction to Next Paint (INP) if available
    const inp =
      audits["experimental-interaction-to-next-paint"]?.numericValue ||
      audits["interaction-to-next-paint"]?.numericValue ||
      0;

    // Resource metrics
    const networkRequests = audits["network-requests"]?.details?.items || [];
    const resourceCount = networkRequests.length;

    // Calculate total page size
    const pageSize = networkRequests.reduce(
      (total: number, item: { transferSize?: number }) => {
        return total + (item.transferSize || 0);
      },
      0
    );

    return {
      loadTime,
      pageSize: Math.round(pageSize / 1024), // Convert to KB
      resourceCount,
      ttfb: Math.round(ttfb),
      inp: Math.round(inp),
    };
  }

  /**
   * Extract optimization opportunities
   */
  private extractOpportunities(data: PageSpeedResponse): Array<{
    title: string;
    description: string;
    savings: number;
  }> {
    const audits = data.lighthouseResult.audits;
    const opportunities: Array<{
      title: string;
      description: string;
      savings: number;
    }> = [];

    // Key optimization audits to check
    const opportunityAudits = [
      "unused-css-rules",
      "unused-javascript",
      "modern-image-formats",
      "efficiently-encode-images",
      "serve-images-next-gen",
      "compress-images",
      "minify-css",
      "minify-javascript",
      "enable-text-compression",
      "reduce-server-response-time",
      "eliminate-render-blocking-resources",
      "prioritize-lcp-image",
      "largest-contentful-paint-element",
    ];

    for (const auditKey of opportunityAudits) {
      const audit = audits[auditKey];
      if (audit && audit.score !== null && audit.score < 1) {
        // This audit has optimization potential
        const savings = audit.numericValue || 0;
        const title = this.getAuditTitle(auditKey);
        const description = this.getAuditDescription(auditKey, audit);

        opportunities.push({
          title,
          description,
          savings: Math.round(savings),
        });
      }
    }

    // Sort by potential savings (descending)
    opportunities.sort((a, b) => b.savings - a.savings);

    // Limit to top 10 opportunities
    return opportunities.slice(0, 10);
  }

  /**
   * Get human-readable title for audit
   */
  private getAuditTitle(auditKey: string): string {
    const titles: { [key: string]: string } = {
      "unused-css-rules": "Remove Unused CSS",
      "unused-javascript": "Remove Unused JavaScript",
      "modern-image-formats": "Use Modern Image Formats",
      "efficiently-encode-images": "Efficiently Encode Images",
      "serve-images-next-gen": "Serve Images in Next-Gen Formats",
      "compress-images": "Compress Images",
      "minify-css": "Minify CSS",
      "minify-javascript": "Minify JavaScript",
      "enable-text-compression": "Enable Text Compression",
      "reduce-server-response-time": "Reduce Server Response Time",
      "eliminate-render-blocking-resources":
        "Eliminate Render-Blocking Resources",
      "prioritize-lcp-image": "Prioritize LCP Image",
      "largest-contentful-paint-element": "Optimize LCP Element",
    };

    return (
      titles[auditKey] ||
      auditKey.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
    );
  }

  /**
   * Get description for audit
   */
  private getAuditDescription(
    auditKey: string,
    audit: { details?: Record<string, unknown> }
  ): string {
    const descriptions: { [key: string]: string } = {
      "unused-css-rules":
        "Remove unused CSS rules to reduce file sizes and improve load times.",
      "unused-javascript":
        "Remove unused JavaScript code to reduce bundle size and parsing time.",
      "modern-image-formats":
        "Use WebP or AVIF image formats for better compression.",
      "efficiently-encode-images":
        "Optimize image encoding to reduce file sizes.",
      "serve-images-next-gen":
        "Serve images in WebP or AVIF format when supported.",
      "compress-images":
        "Compress images to reduce file sizes without quality loss.",
      "minify-css": "Minify CSS files to reduce download sizes.",
      "minify-javascript":
        "Minify JavaScript files to reduce download and parse times.",
      "enable-text-compression":
        "Enable gzip or brotli compression for text-based resources.",
      "reduce-server-response-time":
        "Optimize server response times for faster initial page loads.",
      "eliminate-render-blocking-resources":
        "Eliminate resources that block page rendering.",
      "prioritize-lcp-image":
        "Prioritize loading of the Largest Contentful Paint image.",
      "largest-contentful-paint-element":
        "Optimize the element that represents the LCP.",
    };

    return (
      descriptions[auditKey] ||
      "Optimize this aspect to improve page performance."
    );
  }

  /**
   * Test API connectivity
   */
  async testConnection(): Promise<boolean> {
    if (!this.apiKey) {
      return false;
    }

    try {
      // Test with a simple, fast-loading page
      await this.analyzeWithPageSpeed("https://example.com", "mobile");
      return true;
    } catch (error) {
      logger.error("PageSpeed API connection test failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }
}

// Export singleton instance
export const performanceAnalyzer = new PerformanceAnalyzer();
