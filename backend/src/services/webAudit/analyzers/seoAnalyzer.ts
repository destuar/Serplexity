/**
 * @file seoAnalyzer.ts
 * @description Technical SEO analysis through direct URL inspection
 *
 * Analyzes technical SEO factors including:
 * - robots.txt and llms.txt presence and configuration
 * - Meta tags optimization
 * - Header structure and hierarchy
 * - Sitemap presence and validation
 * - Internal linking structure
 *
 * @dependencies
 * - axios for HTTP requests
 * - cheerio for DOM parsing
 * - URL crawler utilities
 */

import axios from "axios";
import * as cheerio from "cheerio";
import { URL } from "url";
import logger from "../../../utils/logger";
import { SEOResults } from "../webAuditService";

class SEOAnalyzer {
  private readonly timeout = 10000; // 10 second timeout
  private readonly userAgent =
    "Serplexity-WebAudit/1.0 (+https://serplexity.com)";

  /**
   * Analyze technical SEO factors
   */
  async analyze(url: string): Promise<SEOResults> {
    const startTime = Date.now();

    try {
      logger.info("Starting SEO analysis", { url });

      // Parse URL for domain extraction
      const parsedUrl = new URL(url);
      const baseUrl = `${parsedUrl.protocol}//${parsedUrl.hostname}`;

      // Run analysis tasks in parallel
      const [pageAnalysis, robotsAnalysis, sitemapAnalysis] =
        await Promise.allSettled([
          this.analyzePage(url),
          this.analyzeRobotsTxt(baseUrl),
          this.analyzeSitemap(baseUrl),
        ]);

      // Extract results
      const pageData =
        pageAnalysis.status === "fulfilled"
          ? pageAnalysis.value
          : this.getDefaultPageData();
      const robotsData =
        robotsAnalysis.status === "fulfilled"
          ? robotsAnalysis.value
          : this.getDefaultRobotsData();
      const sitemapData =
        sitemapAnalysis.status === "fulfilled"
          ? sitemapAnalysis.value
          : this.getDefaultSitemapData();

      // Check for llms.txt
      const llmsTxtData = await this.analyzeLlmsTxt(baseUrl);

      const result: SEOResults = {
        technical: {
          robotsTxt: robotsData,
          llmsTxt: llmsTxtData,
          sitemap: sitemapData,
        },
        metaTags: pageData.metaTags,
        structure: pageData.structure,
      };

      const analysisTime = Date.now() - startTime;

      logger.info("SEO analysis completed", {
        url,
        analysisTime,
        hasRobotsTxt: robotsData.exists,
        hasLlmsTxt: llmsTxtData.exists,
        hasSitemap: sitemapData.exists,
        titleOptimized: pageData.metaTags.title.optimized,
        descriptionOptimized: pageData.metaTags.description.optimized,
      });

      return result;
    } catch (error) {
      const analysisTime = Date.now() - startTime;

      logger.error("SEO analysis failed", {
        url,
        analysisTime,
        error: error instanceof Error ? error.message : String(error),
      });

      // Return default results on failure
      return this.getDefaultSEOResults();
    }
  }

  /**
   * Analyze main page content and structure
   */
  private async analyzePage(url: string): Promise<{
    metaTags: SEOResults["metaTags"];
    structure: SEOResults["structure"];
  }> {
    const response = await axios.get(url, {
      timeout: this.timeout,
      headers: { "User-Agent": this.userAgent },
      maxRedirects: 5,
    });

    const html = response.data;
    const $ = cheerio.load(html);

    // Analyze meta tags
    const metaTags = this.analyzeMetaTags($ as unknown as cheerio.CheerioAPI);

    // Analyze page structure
    const hostname = new URL(url).hostname;
    const structure = this.analyzePageStructure(
      $ as unknown as cheerio.CheerioAPI,
      hostname
    );

    return { metaTags, structure };
  }

  /**
   * Analyze meta tags
   */
  private analyzeMetaTags($: cheerio.CheerioAPI): SEOResults["metaTags"] {
    // Title tag analysis
    const titleElement = $("title").first();
    const titleText = titleElement.text().trim();
    const titleExists = titleText.length > 0;
    const titleLength = titleText.length;
    const titleOptimized = titleLength >= 30 && titleLength <= 60; // Google's recommended range

    // Meta description analysis
    const descriptionElement = $('meta[name="description"]').first();
    const descriptionText = descriptionElement.attr("content") || "";
    const descriptionExists = descriptionText.length > 0;
    const descriptionLength = descriptionText.length;
    const descriptionOptimized =
      descriptionLength >= 120 && descriptionLength <= 160; // Google's recommended range

    // Meta keywords (largely deprecated but still check)
    const keywordsExists = $('meta[name="keywords"]').length > 0;

    return {
      title: {
        exists: titleExists,
        length: titleLength,
        optimized: titleOptimized,
      },
      description: {
        exists: descriptionExists,
        length: descriptionLength,
        optimized: descriptionOptimized,
      },
      keywords: keywordsExists,
    };
  }

  /**
   * Analyze page structure
   */
  private analyzePageStructure(
    $: cheerio.CheerioAPI,
    hostname: string
  ): SEOResults["structure"] {
    // Heading analysis
    const h1Elements = $("h1");
    const h1Count = h1Elements.length;

    // Check heading hierarchy
    const headings = ["h1", "h2", "h3", "h4", "h5", "h6"];
    let properHierarchy = true;
    let lastLevel = 0;

    for (const heading of headings) {
      const elements = $(heading);
      if (elements.length > 0) {
        const currentLevel = parseInt(heading.replace("h", ""));
        if (lastLevel > 0 && currentLevel > lastLevel + 1) {
          properHierarchy = false;
          break;
        }
        lastLevel = currentLevel;
      }
    }

    // Internal links analysis (server-side safe; avoid window)
    const internalLinks = $("a[href]").filter((_, element) => {
      const href = ($(element).attr("href") || "").toLowerCase();
      const host = (hostname || "").toLowerCase();
      if (!href) return false;
      return (
        href.startsWith("/") ||
        href.startsWith("#") ||
        (host !== "" && href.includes(host))
      );
    });
    const internalLinksCount = internalLinks.length;

    // Canonical tag analysis
    const canonicalTag = $('link[rel="canonical"]').length > 0;

    return {
      headings: {
        h1Count,
        properHierarchy,
      },
      internalLinks: internalLinksCount,
      canonicalTag,
    };
  }

  /**
   * Analyze robots.txt file
   */
  private async analyzeRobotsTxt(
    baseUrl: string
  ): Promise<SEOResults["technical"]["robotsTxt"]> {
    const robotsUrl = `${baseUrl}/robots.txt`;

    try {
      const response = await axios.get(robotsUrl, {
        timeout: this.timeout,
        headers: { "User-Agent": this.userAgent },
        validateStatus: (status) => status < 500, // Don't throw on 4xx errors
      });

      if (response.status === 200) {
        const content = response.data;
        const errors = this.validateRobotsTxt(content);

        return {
          exists: true,
          accessible: true,
          errors,
        };
      } else {
        return {
          exists: false,
          accessible: false,
          errors: [`robots.txt returned status ${response.status}`],
        };
      }
    } catch (error) {
      return {
        exists: false,
        accessible: false,
        errors: [
          `Failed to fetch robots.txt: ${error instanceof Error ? error.message : String(error)}`,
        ],
      };
    }
  }

  /**
   * Analyze llms.txt file (AI training opt-out)
   */
  private async analyzeLlmsTxt(
    baseUrl: string
  ): Promise<SEOResults["technical"]["llmsTxt"]> {
    const llmsUrl = `${baseUrl}/llms.txt`;

    try {
      const response = await axios.get(llmsUrl, {
        timeout: this.timeout,
        headers: { "User-Agent": this.userAgent },
        validateStatus: (status) => status < 500,
      });

      return {
        exists: response.status === 200,
        accessible: response.status === 200,
      };
    } catch (error) {
      return {
        exists: false,
        accessible: false,
      };
    }
  }

  /**
   * Analyze XML sitemap
   */
  private async analyzeSitemap(
    baseUrl: string
  ): Promise<SEOResults["technical"]["sitemap"]> {
    // Common sitemap locations
    const sitemapUrls = [
      `${baseUrl}/sitemap.xml`,
      `${baseUrl}/sitemap_index.xml`,
      `${baseUrl}/sitemap.php`,
      `${baseUrl}/sitemaps.xml`,
    ];

    for (const sitemapUrl of sitemapUrls) {
      try {
        const response = await axios.get(sitemapUrl, {
          timeout: this.timeout,
          headers: { "User-Agent": this.userAgent },
          validateStatus: (status) => status < 500,
        });

        if (response.status === 200) {
          const urlCount = this.parseSitemapUrlCount(response.data);

          return {
            exists: true,
            accessible: true,
            urlCount,
          };
        }
      } catch (error) {
        // Continue to next sitemap URL
        continue;
      }
    }

    // Check robots.txt for sitemap reference
    try {
      const robotsResponse = await axios.get(`${baseUrl}/robots.txt`, {
        timeout: this.timeout,
        headers: { "User-Agent": this.userAgent },
        validateStatus: (status) => status < 500,
      });

      if (robotsResponse.status === 200) {
        const robotsContent = robotsResponse.data;
        const sitemapMatch = robotsContent.match(/Sitemap:\s*(.+)/i);

        if (sitemapMatch) {
          const sitemapUrl = sitemapMatch[1].trim();
          try {
            const response = await axios.get(sitemapUrl, {
              timeout: this.timeout,
              headers: { "User-Agent": this.userAgent },
            });

            const urlCount = this.parseSitemapUrlCount(response.data);

            return {
              exists: true,
              accessible: true,
              urlCount,
            };
          } catch (error) {
            // Sitemap referenced but not accessible
            return {
              exists: true,
              accessible: false,
              urlCount: 0,
            };
          }
        }
      }
    } catch (error) {
      // Ignore errors when checking robots.txt
    }

    return {
      exists: false,
      accessible: false,
      urlCount: 0,
    };
  }

  /**
   * Validate robots.txt content
   */
  private validateRobotsTxt(content: string): string[] {
    const errors: string[] = [];
    const lines = content.split("\n").map((line) => line.trim());

    let hasUserAgent = false;
    let currentUserAgent = "";

    for (const line of lines) {
      if (line.startsWith("#") || line === "") {
        continue; // Skip comments and empty lines
      }

      if (line.toLowerCase().startsWith("user-agent:")) {
        hasUserAgent = true;
        currentUserAgent = line.substring(11).trim();

        if (!currentUserAgent) {
          errors.push("Empty User-agent directive found");
        }
      } else if (line.toLowerCase().startsWith("disallow:")) {
        if (!hasUserAgent) {
          errors.push("Disallow directive without preceding User-agent");
        }
      } else if (line.toLowerCase().startsWith("allow:")) {
        if (!hasUserAgent) {
          errors.push("Allow directive without preceding User-agent");
        }
      } else if (line.toLowerCase().startsWith("sitemap:")) {
        // Sitemap can appear anywhere
        const sitemapUrl = line.substring(8).trim();
        if (!sitemapUrl.startsWith("http")) {
          errors.push("Invalid sitemap URL format");
        }
      } else if (line.toLowerCase().startsWith("crawl-delay:")) {
        if (!hasUserAgent) {
          errors.push("Crawl-delay directive without preceding User-agent");
        }
        const delay = line.substring(12).trim();
        if (isNaN(Number(delay))) {
          errors.push("Invalid crawl-delay value");
        }
      } else {
        // Unknown directive
        errors.push(`Unknown directive: ${line.split(":")[0]}`);
      }
    }

    if (!hasUserAgent) {
      errors.push("No User-agent directive found");
    }

    return errors;
  }

  /**
   * Parse sitemap XML to count URLs
   */
  private parseSitemapUrlCount(xmlContent: string): number {
    try {
      const $ = cheerio.load(xmlContent, { xmlMode: true });

      // Count <url> elements in regular sitemap
      const urlCount = $("url").length;

      if (urlCount > 0) {
        return urlCount;
      }

      // Count <sitemap> elements in sitemap index
      const sitemapCount = $("sitemap").length;

      return sitemapCount; // Approximate count for sitemap index
    } catch (error) {
      logger.warn("Failed to parse sitemap XML", {
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }

  /**
   * Get default page data for error cases
   */
  private getDefaultPageData() {
    return {
      metaTags: {
        title: { exists: false, length: 0, optimized: false },
        description: { exists: false, length: 0, optimized: false },
        keywords: false,
      },
      structure: {
        headings: { h1Count: 0, properHierarchy: false },
        internalLinks: 0,
        canonicalTag: false,
      },
    };
  }

  /**
   * Get default robots.txt data for error cases
   */
  private getDefaultRobotsData() {
    return {
      exists: false,
      accessible: false,
      errors: ["Failed to analyze robots.txt"],
    };
  }

  /**
   * Get default sitemap data for error cases
   */
  private getDefaultSitemapData() {
    return {
      exists: false,
      accessible: false,
      urlCount: 0,
    };
  }

  /**
   * Get default SEO results for complete failure cases
   */
  private getDefaultSEOResults(): SEOResults {
    return {
      technical: {
        robotsTxt: this.getDefaultRobotsData(),
        llmsTxt: { exists: false, accessible: false },
        sitemap: this.getDefaultSitemapData(),
      },
      metaTags: this.getDefaultPageData().metaTags,
      structure: this.getDefaultPageData().structure,
    };
  }
}

// Export singleton instance
export const seoAnalyzer = new SEOAnalyzer();
