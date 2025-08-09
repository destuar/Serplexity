/**
 * @file geoAnalyzer.ts
 * @description GEO (Generative Engine Optimization) analysis
 *
 * Analyzes website optimization for AI search engines including:
 * - Schema markup detection and validation
 * - AI-readable content structure
 * - Answer-ready content format
 * - Citation-friendly content structure
 *
 * @dependencies
 * - axios for HTTP requests
 * - cheerio for DOM parsing
 * - JSON-LD schema validation
 */

import axios from "axios";
import * as cheerio from "cheerio";
import logger from "../../../utils/logger";
import { GEOResults } from "../webAuditService";

interface SchemaMarkup {
  type: string;
  valid: boolean;
  data?: any;
}

class GEOAnalyzer {
  private readonly timeout = 10000; // 10 second timeout
  private readonly userAgent =
    "Serplexity-WebAudit/1.0 (+https://serplexity.com)";

  /**
   * Analyze GEO optimization factors
   */
  async analyze(url: string): Promise<GEOResults> {
    const startTime = Date.now();

    try {
      logger.info("Starting GEO analysis", { url });

      // Fetch and parse the page
      const response = await axios.get(url, {
        timeout: this.timeout,
        headers: { "User-Agent": this.userAgent },
        maxRedirects: 5,
      });

      const html = response.data;
      const $ = cheerio.load(html);

      // Analyze schema markup
      const schemaMarkup = this.analyzeSchemaMarkup($);

      // Analyze content structure
      const contentStructure = this.analyzeContentStructure($);

      // Analyze AI optimization factors
      const aiOptimization = this.analyzeAIOptimization($);

      const result: GEOResults = {
        schemaMarkup,
        contentStructure,
        aiOptimization,
      };

      const analysisTime = Date.now() - startTime;

      logger.info("GEO analysis completed", {
        url,
        analysisTime,
        schemasFound: schemaMarkup.totalSchemas,
        faqSections: contentStructure.faqSections,
        readabilityScore: aiOptimization.readabilityScore,
        structuredAnswers: aiOptimization.structuredAnswers,
      });

      return result;
    } catch (error) {
      const analysisTime = Date.now() - startTime;

      logger.error("GEO analysis failed", {
        url,
        analysisTime,
        error: error instanceof Error ? error.message : String(error),
      });

      // Return default results on failure
      return this.getDefaultGEOResults();
    }
  }

  /**
   * Analyze schema markup (JSON-LD, Microdata)
   */
  private analyzeSchemaMarkup(
    $: cheerio.CheerioAPI
  ): GEOResults["schemaMarkup"] {
    const schemas: SchemaMarkup[] = [];

    // Analyze JSON-LD schemas
    $('script[type="application/ld+json"]').each((_, element) => {
      try {
        const jsonText = $(element).html() || "";
        const jsonData = JSON.parse(jsonText);

        if (
          jsonData["@type"] ||
          (Array.isArray(jsonData) && jsonData[0]?.["@type"])
        ) {
          const schemaType = jsonData["@type"] || jsonData[0]?.["@type"];
          schemas.push({
            type: schemaType,
            valid: this.validateSchema(jsonData),
            data: jsonData,
          });
        }
      } catch (error) {
        // Invalid JSON-LD, mark as invalid
        schemas.push({
          type: "Unknown",
          valid: false,
        });
      }
    });

    // Check for microdata
    const microdataElements = $("[itemscope]");
    const hasMicrodata = microdataElements.length > 0;

    return {
      jsonLd: schemas,
      microdata: hasMicrodata,
      totalSchemas: schemas.length + (hasMicrodata ? 1 : 0),
    };
  }

  /**
   * Analyze content structure for AI readability
   */
  private analyzeContentStructure(
    $: cheerio.CheerioAPI
  ): GEOResults["contentStructure"] {
    // FAQ sections detection
    const faqSections = this.detectFAQSections($);

    // List structure analysis
    const lists = $("ul, ol");
    const listStructure = lists.length;

    // Table structure analysis
    const tables = $("table");
    const tableStructure = tables.length;

    // Answer-ready content detection
    const answerReadyContent = this.detectAnswerReadyContent($);

    return {
      faqSections,
      listStructure,
      tableStructure,
      answerReadyContent,
    };
  }

  /**
   * Analyze AI optimization factors
   */
  private analyzeAIOptimization(
    $: cheerio.CheerioAPI
  ): GEOResults["aiOptimization"] {
    // Content readability score
    const readabilityScore = this.calculateReadabilityScore($);

    // Citation-friendly content detection
    const citationFriendly = this.detectCitationFriendlyContent($);

    // Structured answers detection
    const structuredAnswers = this.detectStructuredAnswers($);

    // Additional deterministic metrics
    const freshnessScore = this.scoreFreshness($);
    const chunkabilityScore = this.scoreChunkability($);
    const anchorCoverage = this.scoreAnchorCoverage($);
    const mainContentRatio = this.scoreMainContentRatio($);
    const questionHeadingCoverage = this.scoreQuestionHeadingCoverage($);
    const schemaCompletenessScore = this.scoreSchemaCompleteness($);
    const tldrPresent = this.detectTLDR($);

    return {
      readabilityScore,
      citationFriendly,
      structuredAnswers,
      freshnessScore,
      chunkabilityScore,
      anchorCoverage,
      mainContentRatio,
      questionHeadingCoverage,
      schemaCompletenessScore,
      tldrPresent,
    };
  }

  /**
   * Detect FAQ sections
   */
  private detectFAQSections($: cheerio.CheerioAPI): number {
    let faqCount = 0;

    // Look for FAQ schema markup
    $('script[type="application/ld+json"]').each((_, element) => {
      try {
        const jsonText = $(element).html() || "";
        const jsonData = JSON.parse(jsonText);

        if (
          jsonData["@type"] === "FAQPage" ||
          (Array.isArray(jsonData) &&
            jsonData.some((item: any) => item["@type"] === "FAQPage"))
        ) {
          faqCount++;
        }
      } catch (error) {
        // Ignore parsing errors
      }
    });

    // Look for FAQ-like patterns in content
    const faqPatterns = [
      /\bFAQ\b/gi,
      /frequently\s+asked\s+questions/gi,
      /questions?\s+and\s+answers?/gi,
      /Q&A/gi,
    ];

    const bodyText = $("body").text();

    for (const pattern of faqPatterns) {
      const matches = bodyText.match(pattern);
      if (matches) {
        faqCount += matches.length;
      }
    }

    // Look for question-answer patterns
    const questionElements = $(
      'h1, h2, h3, h4, h5, h6, dt, .question, [class*="question"]'
    );
    let questionAnswerPairs = 0;

    questionElements.each((_, element) => {
      const text = $(element).text().toLowerCase();
      if (
        text.includes("?") ||
        text.match(/^(what|how|why|when|where|who|which)/)
      ) {
        questionAnswerPairs++;
      }
    });

    faqCount += Math.floor(questionAnswerPairs / 2); // Assume pairs

    return Math.min(faqCount, 20); // Cap at reasonable number
  }

  /**
   * Detect answer-ready content
   */
  private detectAnswerReadyContent($: cheerio.CheerioAPI): number {
    let answerReadyCount = 0;

    // Look for numbered/bulleted lists (step-by-step guides)
    const orderedLists = $("ol");
    answerReadyCount += orderedLists.length;

    // Look for definition lists
    const definitionLists = $("dl");
    answerReadyCount += definitionLists.length;

    // Look for highlighted text or call-out boxes
    const highlightElements = $(
      ".highlight, .callout, .note, .tip, .important, blockquote"
    );
    answerReadyCount += highlightElements.length;

    // Look for short, direct sentences (good for AI extraction)
    const paragraphs = $("p");
    let shortParagraphs = 0;

    paragraphs.each((_, element) => {
      const text = $(element).text().trim();
      const wordCount = text.split(/\s+/).length;

      // Short, concise paragraphs (10-50 words) are good for AI extraction
      if (wordCount >= 10 && wordCount <= 50) {
        shortParagraphs++;
      }
    });

    answerReadyCount += Math.floor(shortParagraphs / 3); // Every 3 short paragraphs count as 1

    return Math.min(answerReadyCount, 50); // Cap at reasonable number
  }

  /**
   * Calculate content readability score for AI
   */
  private calculateReadabilityScore($: cheerio.CheerioAPI): number {
    const bodyText = $("body").text();
    const words = bodyText.split(/\s+/).filter((word) => word.length > 0);
    const sentences = bodyText
      .split(/[.!?]+/)
      .filter((sentence) => sentence.trim().length > 0);

    if (words.length === 0 || sentences.length === 0) {
      return 0;
    }

    // Calculate average words per sentence
    const avgWordsPerSentence = words.length / sentences.length;

    // Calculate average characters per word
    const totalChars = words.join("").length;
    const avgCharsPerWord = totalChars / words.length;

    // Simple readability score (inspired by Flesch-Kincaid)
    // Lower score = easier to read (better for AI)
    const readabilityIndex =
      0.39 * avgWordsPerSentence + 11.8 * avgCharsPerWord - 15.59;

    // Convert to 0-100 scale (100 = most readable for AI)
    let score = Math.max(0, 100 - readabilityIndex);

    // Bonus points for structured content
    const headings = $("h1, h2, h3, h4, h5, h6").length;
    const lists = $("ul, ol").length;
    const tables = $("table").length;

    const structureBonus = Math.min(10, (headings + lists + tables) * 0.5);
    score += structureBonus;

    return Math.min(100, Math.round(score));
  }

  /**
   * Detect citation-friendly content
   */
  private detectCitationFriendlyContent($: cheerio.CheerioAPI): boolean {
    let citationScore = 0;

    // Check for author information
    const authorElements = $(
      '[rel="author"], .author, .byline, [class*="author"]'
    );
    if (authorElements.length > 0) {
      citationScore += 20;
    }

    // Check for publication date
    const dateElements = $(
      'time, .date, .published, [datetime], [class*="date"]'
    );
    if (dateElements.length > 0) {
      citationScore += 15;
    }

    // Check for article/blog schema
    $('script[type="application/ld+json"]').each((_, element) => {
      try {
        const jsonText = $(element).html() || "";
        const jsonData = JSON.parse(jsonText);

        if (
          jsonData["@type"] === "Article" ||
          jsonData["@type"] === "BlogPosting"
        ) {
          citationScore += 25;
        }
      } catch (error) {
        // Ignore parsing errors
      }
    });

    // Check for references/sources
    const referenceElements = $(
      '.references, .sources, .citations, [class*="reference"]'
    );
    if (referenceElements.length > 0) {
      citationScore += 20;
    }

    // Check for clear headings and structure
    const headings = $("h1, h2, h3").length;
    if (headings >= 3) {
      citationScore += 10;
    }

    // Check for external links (indicates sourced content)
    const externalLinks = $('a[href^="http"]').length;
    if (externalLinks >= 5) {
      citationScore += 10;
    }

    return citationScore >= 50; // Threshold for citation-friendly
  }

  /**
   * Detect structured answers
   */
  private detectStructuredAnswers($: cheerio.CheerioAPI): number {
    let structuredCount = 0;

    // Look for Question schema markup
    $('script[type="application/ld+json"]').each((_, element) => {
      try {
        const jsonText = $(element).html() || "";
        const jsonData = JSON.parse(jsonText);

        if (
          jsonData["@type"] === "Question" ||
          (Array.isArray(jsonData) &&
            jsonData.some((item: any) => item["@type"] === "Question"))
        ) {
          structuredCount++;
        }
      } catch (error) {
        // Ignore parsing errors
      }
    });

    // Look for answer patterns in content
    const answerPatterns = [
      /the answer is/gi,
      /in summary/gi,
      /to conclude/gi,
      /in conclusion/gi,
      /the solution/gi,
      /here's how/gi,
      /step \d+/gi,
      /first,? .+ second,? .+ third/gi,
    ];

    const bodyText = $("body").text();

    for (const pattern of answerPatterns) {
      const matches = bodyText.match(pattern);
      if (matches) {
        structuredCount += matches.length;
      }
    }

    // Look for numbered procedures or steps
    const procedures = $('ol li, .step, [class*="step"]');
    if (procedures.length >= 3) {
      structuredCount += Math.floor(procedures.length / 3);
    }

    return Math.min(structuredCount, 15); // Cap at reasonable number
  }

  /**
   * Validate schema markup
   */
  private validateSchema(schema: any): boolean {
    try {
      // Basic validation - check for required properties
      if (!schema["@context"] && !schema[0]?.["@context"]) {
        return false;
      }

      if (!schema["@type"] && !schema[0]?.["@type"]) {
        return false;
      }

      // Additional validation based on schema type
      const schemaType = schema["@type"] || schema[0]?.["@type"];

      switch (schemaType) {
        case "Organization":
          return !!(schema.name || schema[0]?.name);
        case "Article":
        case "BlogPosting":
          return !!(schema.headline || schema[0]?.headline);
        case "FAQPage":
          return !!(schema.mainEntity || schema[0]?.mainEntity);
        case "Question":
          return !!(schema.acceptedAnswer || schema[0]?.acceptedAnswer);
        default:
          return true; // Basic validation passed
      }
    } catch (error) {
      return false;
    }
  }

  // ---------- Deterministic metric helpers ----------

  private scoreFreshness($: cheerio.CheerioAPI): number {
    const dateTexts: string[] = [];
    $(
      'time, [datetime], .date, .published, [class*="date"], meta[property="article:published_time"], meta[property="article:modified_time"]'
    ).each((_, el) => {
      const dt =
        $(el).attr("datetime") || $(el).attr("content") || $(el).text();
      if (dt) dateTexts.push(dt.trim());
    });
    let best: Date | null = null;
    for (const txt of dateTexts) {
      const d = new Date(txt);
      if (!isNaN(d.getTime())) best = best ? (d > best ? d : best) : d;
    }
    if (!best) return 30; // unknown freshness baseline
    const days = (Date.now() - best.getTime()) / (1000 * 60 * 60 * 24);
    if (days <= 30) return 100;
    if (days <= 90) return 80;
    if (days <= 180) return 60;
    return 40;
  }

  private scoreChunkability($: cheerio.CheerioAPI): number {
    // Evaluate section sizes between headings and overall heading depth
    const headings = $("h1, h2, h3");
    if (headings.length === 0) return 40;
    const text = $("body").text();
    const totalWords = text.split(/\s+/).filter(Boolean).length;
    const sections = headings.length;
    const avgSectionWords = totalWords / Math.max(1, sections);
    // Ideal avg section ~200 words
    let score = 100 - Math.min(100, Math.abs(avgSectionWords - 200) / 2);
    // Penalize deep nesting beyond h3
    const deeper = $("h4, h5, h6").length;
    if (deeper > 0) score -= 10;
    return Math.max(0, Math.round(score));
  }

  private scoreAnchorCoverage($: cheerio.CheerioAPI): number {
    const headings = $("h1, h2, h3");
    if (headings.length === 0) return 0;
    let anchored = 0;
    headings.each((_, el) => {
      const id = $(el).attr("id");
      if (id && id.trim().length > 0) anchored++;
    });
    return Math.round((anchored / headings.length) * 100);
  }

  private scoreMainContentRatio($: cheerio.CheerioAPI): number {
    const mainText = $("article, main, #content").text();
    const totalText = $("body").text();
    const mainWords = mainText.split(/\s+/).filter(Boolean).length;
    const totalWords = totalText.split(/\s+/).filter(Boolean).length;
    if (totalWords === 0) return 0;
    return Math.round(Math.min(100, (mainWords / totalWords) * 100));
  }

  private scoreQuestionHeadingCoverage($: cheerio.CheerioAPI): number {
    const hs = $("h2, h3");
    if (hs.length === 0) return 0;
    let qlike = 0;
    hs.each((_, el) => {
      const t = ($(el).text() || "").trim();
      if (/\?$/.test(t) || /^(What|How|Why|When|Where|Who|Which)\b/i.test(t))
        qlike++;
    });
    return Math.round((qlike / hs.length) * 100);
  }

  private scoreSchemaCompleteness($: cheerio.CheerioAPI): number {
    let scores: number[] = [];
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const jsonText = $(el).html() || "";
        const jsonData = JSON.parse(jsonText);
        const items = Array.isArray(jsonData) ? jsonData : [jsonData];
        for (const item of items) {
          const type = item["@type"];
          if (!type) continue;
          let required = 0;
          let present = 0;
          const reqFieldsByType: Record<string, string[]> = {
            Article: ["headline", "author", "datePublished"],
            BlogPosting: ["headline", "author", "datePublished"],
            FAQPage: ["mainEntity"],
            Question: ["name", "acceptedAnswer"],
            HowTo: ["name", "step"],
          };
          const req = reqFieldsByType[type] || [];
          required = req.length;
          present = req.filter(
            (f) => item[f] !== undefined && item[f] !== null
          ).length;
          if (required > 0) {
            scores.push((present / required) * 100);
          }
        }
      } catch {}
    });
    if (scores.length === 0) return 0;
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    return Math.round(avg);
  }

  private detectTLDR($: cheerio.CheerioAPI): boolean {
    const selectors = [
      ':contains("TL;DR")',
      ':contains("Key takeaways")',
      ':contains("Summary")',
      ':contains("In summary")',
    ];
    for (const sel of selectors) {
      const section = $("h1, h2, h3, h4").filter(sel).first();
      if (section.length > 0) {
        const bullets = section.nextUntil("h1, h2, h3, h4").find("li");
        if (bullets.length >= 2 && bullets.length <= 8) return true;
      }
    }
    return false;
  }

  /**
   * Get default GEO results for error cases
   */
  private getDefaultGEOResults(): GEOResults {
    return {
      schemaMarkup: {
        jsonLd: [],
        microdata: false,
        totalSchemas: 0,
      },
      contentStructure: {
        faqSections: 0,
        listStructure: 0,
        tableStructure: 0,
        answerReadyContent: 0,
      },
      aiOptimization: {
        readabilityScore: 0,
        citationFriendly: false,
        structuredAnswers: 0,
      },
    };
  }
}

// Export singleton instance
export const geoAnalyzer = new GEOAnalyzer();
