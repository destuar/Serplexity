/**
 * @file auditScorer.ts
 * @description Audit scoring and recommendation engine
 *
 * Calculates scores and generates actionable recommendations based on:
 * - Performance analysis results
 * - SEO technical analysis
 * - GEO optimization analysis
 * - Accessibility analysis
 * - Security analysis
 *
 * @dependencies
 * - Analysis result interfaces
 * - Recommendation generation logic
 */

import logger from "../../../utils/logger";
import { PerformanceResults, SEOResults, GEOResults, AccessibilityResults, SecurityResults, Recommendation } from "../webAuditService";

class AuditScorer {
  /**
   * Calculate scores for all analysis categories
   */
  calculateScores(details: {
    performance?: PerformanceResults;
    seo?: SEOResults;
    geo?: GEOResults;
    accessibility?: AccessibilityResults;
    security?: SecurityResults;
  }): {
    performance: number;
    seo: number;
    geo: number;
    accessibility: number;
    security: number;
    overall: number;
  } {
    try {
      const performanceScore = this.calculatePerformanceScore(details.performance);
      const seoScore = this.calculateSEOScore(details.seo);
      const geoScore = this.calculateGEOScore(details.geo);
      const accessibilityScore = this.calculateAccessibilityScore(details.accessibility);
      const securityScore = this.calculateSecurityScore(details.security);

      // Calculate weighted overall score
      const weights = {
        performance: 0.25,  // 25% - Critical for user experience
        seo: 0.25,         // 25% - Critical for discoverability
        geo: 0.20,         // 20% - Important for AI optimization
        accessibility: 0.15, // 15% - Important for inclusivity
        security: 0.15,    // 15% - Important for trust
      };

      const overall = Math.round(
        performanceScore * weights.performance +
        seoScore * weights.seo +
        geoScore * weights.geo +
        accessibilityScore * weights.accessibility +
        securityScore * weights.security
      );

      const scores = {
        performance: performanceScore,
        seo: seoScore,
        geo: geoScore,
        accessibility: accessibilityScore,
        security: securityScore,
        overall,
      };

      logger.info("Audit scores calculated", scores);

      return scores;

    } catch (error) {
      logger.error("Failed to calculate audit scores", {
        error: error instanceof Error ? error.message : String(error),
      });

      // Return default scores on error
      return {
        performance: 0,
        seo: 0,
        geo: 0,
        accessibility: 0,
        security: 0,
        overall: 0,
      };
    }
  }

  /**
   * Calculate performance score (0-100)
   */
  private calculatePerformanceScore(performance?: PerformanceResults): number {
    if (!performance) return 0;

    let score = 0;

    // Core Web Vitals (40 points)
    const lcpScore = this.scoreLCP(performance.coreWebVitals.lcp);
    const fidScore = this.scoreFID(performance.coreWebVitals.fid);
    const clsScore = this.scoreCLS(performance.coreWebVitals.cls);

    score += (lcpScore + fidScore + clsScore) * 40 / 300; // Normalize to 40 points

    // Load time (25 points)
    const loadTimeScore = this.scoreLoadTime(performance.loadTime);
    score += loadTimeScore * 25 / 100;

    // Resource optimization (20 points)
    const resourceScore = this.scoreResourceOptimization(performance.pageSize, performance.resourceCount);
    score += resourceScore * 20 / 100;

    // Mobile performance (15 points)
    score += performance.mobileScore * 15 / 100;

    return Math.round(Math.min(100, Math.max(0, score)));
  }

  /**
   * Calculate SEO score (0-100)
   */
  private calculateSEOScore(seo?: SEOResults): number {
    if (!seo) return 0;

    let score = 0;

    // Technical factors (35 points)
    if (seo.technical.robotsTxt.exists && seo.technical.robotsTxt.accessible) {
      score += 10;
      if (seo.technical.robotsTxt.errors.length === 0) {
        score += 5;
      }
    }

    if (seo.technical.sitemap.exists && seo.technical.sitemap.accessible) {
      score += 15;
      if (seo.technical.sitemap.urlCount > 0) {
        score += 5;
      }
    }

    // Bonus for llms.txt (AI training opt-out)
    if (seo.technical.llmsTxt.exists) {
      score += 3;
    }

    // Meta tags (25 points)
    if (seo.metaTags.title.exists) {
      score += 8;
      if (seo.metaTags.title.optimized) {
        score += 7;
      }
    }

    if (seo.metaTags.description.exists) {
      score += 5;
      if (seo.metaTags.description.optimized) {
        score += 5;
      }
    }

    // Page structure (25 points)
    if (seo.structure.headings.h1Count === 1) {
      score += 10;
    } else if (seo.structure.headings.h1Count > 1) {
      score += 5; // Partial credit
    }

    if (seo.structure.headings.properHierarchy) {
      score += 8;
    }

    if (seo.structure.canonicalTag) {
      score += 4;
    }

    if (seo.structure.internalLinks > 0) {
      score += Math.min(3, seo.structure.internalLinks / 5); // Up to 3 points
    }

    // Content quality (15 points)
    score += 15; // Base content score (would need content analysis for more accurate scoring)

    return Math.round(Math.min(100, Math.max(0, score)));
  }

  /**
   * Calculate GEO score (0-100)
   */
  private calculateGEOScore(geo?: GEOResults): number {
    if (!geo) return 0;

    let score = 0;

    // Schema markup (30 points)
    if (geo.schemaMarkup.totalSchemas > 0) {
      score += 15;

      const validSchemas = geo.schemaMarkup.jsonLd.filter(schema => schema.valid).length;
      const schemaQuality = validSchemas / Math.max(1, geo.schemaMarkup.totalSchemas);
      score += schemaQuality * 15;
    }

    // Content structure (25 points)
    if (geo.contentStructure.faqSections > 0) {
      score += Math.min(10, geo.contentStructure.faqSections * 2);
    }

    if (geo.contentStructure.listStructure > 0) {
      score += Math.min(8, geo.contentStructure.listStructure * 1);
    }

    if (geo.contentStructure.answerReadyContent > 0) {
      score += Math.min(7, geo.contentStructure.answerReadyContent * 0.5);
    }

    // AI optimization (25 points)
    score += geo.aiOptimization.readabilityScore * 15 / 100;

    if (geo.aiOptimization.citationFriendly) {
      score += 5;
    }

    if (geo.aiOptimization.structuredAnswers > 0) {
      score += Math.min(5, geo.aiOptimization.structuredAnswers * 0.5);
    }

    // Content quality bonus (20 points)
    score += 20; // Base score (would need more sophisticated content analysis)

    return Math.round(Math.min(100, Math.max(0, score)));
  }

  /**
   * Calculate accessibility score (0-100)
   */
  private calculateAccessibilityScore(accessibility?: AccessibilityResults): number {
    if (!accessibility) return 0;

    // Use the calculated WCAG score as base
    let score = accessibility.wcagCompliance.score;

    // Apply penalties for critical issues
    const criticalIssues = accessibility.issues.filter(issue => issue.severity === 'critical');
    const criticalPenalty = criticalIssues.reduce((penalty, issue) => penalty + issue.count * 10, 0);

    score -= criticalPenalty;

    // Factor in alt text coverage
    score = score * (accessibility.altText.coverage / 100);

    // Factor in color contrast
    score = score * (accessibility.colorContrast.ratio / 100);

    return Math.round(Math.min(100, Math.max(0, score)));
  }

  /**
   * Calculate security score (0-100)
   */
  private calculateSecurityScore(security?: SecurityResults): number {
    if (!security) return 0;

    let score = 0;

    // HTTPS implementation (35 points)
    if (security.https.enabled) {
      score += 20;

      if (security.https.certificateValid) {
        score += 10;
      }

      if (security.https.hsts) {
        score += 5;
      }
    }

    // Security headers (40 points)
    if (security.headers.contentSecurityPolicy) score += 15;
    if (security.headers.xFrameOptions) score += 8;
    if (security.headers.xContentTypeOptions) score += 6;
    if (security.headers.referrerPolicy) score += 6;
    if (security.headers.permissionsPolicy) score += 5;

    // Vulnerability penalties (25 points base, minus penalties)
    let vulnerabilityPenalty = 0;

    for (const vuln of security.vulnerabilities) {
      switch (vuln.severity) {
        case 'critical':
          vulnerabilityPenalty += 15;
          break;
        case 'high':
          vulnerabilityPenalty += 10;
          break;
        case 'medium':
          vulnerabilityPenalty += 5;
          break;
        case 'low':
          vulnerabilityPenalty += 2;
          break;
      }
    }

    score += Math.max(0, 25 - vulnerabilityPenalty);

    return Math.round(Math.min(100, Math.max(0, score)));
  }

  /**
   * Generate actionable recommendations
   */
  generateRecommendations(
    details: {
      performance?: PerformanceResults;
      seo?: SEOResults;
      geo?: GEOResults;
      accessibility?: AccessibilityResults;
      security?: SecurityResults;
    },
    scores: {
      performance: number;
      seo: number;
      geo: number;
      accessibility: number;
      security: number;
      overall: number;
    }
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];

    try {
      // Generate performance recommendations
      if (details.performance) {
        recommendations.push(...this.generatePerformanceRecommendations(details.performance, scores.performance));
      }

      // Generate SEO recommendations
      if (details.seo) {
        recommendations.push(...this.generateSEORecommendations(details.seo, scores.seo));
      }

      // Generate GEO recommendations
      if (details.geo) {
        recommendations.push(...this.generateGEORecommendations(details.geo, scores.geo));
      }

      // Generate accessibility recommendations
      if (details.accessibility) {
        recommendations.push(...this.generateAccessibilityRecommendations(details.accessibility, scores.accessibility));
      }

      // Generate security recommendations
      if (details.security) {
        recommendations.push(...this.generateSecurityRecommendations(details.security, scores.security));
      }

      // Sort by priority and limit
      const sortedRecommendations = recommendations
        .sort((a, b) => this.getPriorityWeight(a.priority) - this.getPriorityWeight(b.priority))
        .slice(0, 20); // Limit to top 20 recommendations

      logger.info("Generated recommendations", {
        totalRecommendations: recommendations.length,
        topRecommendations: sortedRecommendations.length,
        byCategory: {
          performance: recommendations.filter(r => r.category === 'performance').length,
          seo: recommendations.filter(r => r.category === 'seo').length,
          geo: recommendations.filter(r => r.category === 'geo').length,
          accessibility: recommendations.filter(r => r.category === 'accessibility').length,
          security: recommendations.filter(r => r.category === 'security').length,
        },
      });

      return sortedRecommendations;

    } catch (error) {
      logger.error("Failed to generate recommendations", {
        error: error instanceof Error ? error.message : String(error),
      });

      return [{
        category: 'performance',
        priority: 'high',
        title: 'Analysis Error',
        description: 'Unable to generate recommendations due to analysis error',
        impact: 'May miss optimization opportunities',
        effort: 'low',
      }];
    }
  }

  // Helper methods for scoring individual metrics

  private scoreLCP(lcp: number): number {
    if (lcp <= 2500) return 100; // Good
    if (lcp <= 4000) return 75;  // Needs improvement
    return 25; // Poor
  }

  private scoreFID(fid: number): number {
    if (fid <= 100) return 100; // Good
    if (fid <= 300) return 75;  // Needs improvement
    return 25; // Poor
  }

  private scoreCLS(cls: number): number {
    if (cls <= 0.1) return 100; // Good
    if (cls <= 0.25) return 75; // Needs improvement
    return 25; // Poor
  }

  private scoreLoadTime(loadTime: number): number {
    if (loadTime <= 1500) return 100; // Excellent
    if (loadTime <= 3000) return 80;  // Good
    if (loadTime <= 5000) return 60;  // Average
    if (loadTime <= 8000) return 40;  // Poor
    return 20; // Very poor
  }

  private scoreResourceOptimization(pageSize: number, resourceCount: number): number {
    let score = 100;

    // Penalty for large page size (KB)
    if (pageSize > 1000) score -= 20;
    if (pageSize > 2000) score -= 30;
    if (pageSize > 5000) score -= 50;

    // Penalty for too many resources
    if (resourceCount > 50) score -= 10;
    if (resourceCount > 100) score -= 20;
    if (resourceCount > 200) score -= 30;

    return Math.max(0, score);
  }

  private getPriorityWeight(priority: 'critical' | 'high' | 'medium' | 'low'): number {
    switch (priority) {
      case 'critical': return 1;
      case 'high': return 2;
      case 'medium': return 3;
      case 'low': return 4;
      default: return 5;
    }
  }

  // Recommendation generation methods would be implemented here
  // (Performance, SEO, GEO, Accessibility, Security recommendations)

  private generatePerformanceRecommendations(performance: PerformanceResults, score: number): Recommendation[] {
    const recommendations: Recommendation[] = [];

    if (performance.coreWebVitals.lcp > 2500) {
      recommendations.push({
        category: 'performance',
        priority: 'critical',
        title: 'Improve Largest Contentful Paint (LCP)',
        description: `Your LCP is ${performance.coreWebVitals.lcp}ms. Optimize main content loading to under 2.5 seconds.`,
        impact: 'Significantly improves user experience and SEO ranking',
        effort: 'medium',
        resources: ['https://web.dev/lcp/', 'https://developers.google.com/speed/docs/insights/LCP'],
      });
    }

    if (performance.mobileScore < 50) {
      recommendations.push({
        category: 'performance',
        priority: 'high',
        title: 'Optimize Mobile Performance',
        description: `Mobile performance score is ${performance.mobileScore}/100. Focus on mobile-specific optimizations.`,
        impact: 'Critical for mobile users and mobile-first indexing',
        effort: 'high',
      });
    }

    // Add opportunities as recommendations
    for (const opportunity of performance.opportunities.slice(0, 3)) {
      if (opportunity.savings > 500) { // Only significant savings
        recommendations.push({
          category: 'performance',
          priority: opportunity.savings > 2000 ? 'high' : 'medium',
          title: opportunity.title,
          description: opportunity.description,
          impact: `Potential savings: ${Math.round(opportunity.savings / 1000)}s load time`,
          effort: 'medium',
        });
      }
    }

    return recommendations;
  }

  private generateSEORecommendations(seo: SEOResults, score: number): Recommendation[] {
    const recommendations: Recommendation[] = [];

    if (!seo.technical.robotsTxt.exists) {
      recommendations.push({
        category: 'seo',
        priority: 'high',
        title: 'Create robots.txt File',
        description: 'Add a robots.txt file to guide search engine crawlers',
        impact: 'Improves crawl efficiency and SEO visibility',
        effort: 'low',
      });
    }

    if (!seo.technical.llmsTxt.exists) {
      recommendations.push({
        category: 'seo',
        priority: 'medium',
        title: 'Consider Adding llms.txt',
        description: 'Add llms.txt to control AI training data usage of your content',
        impact: 'Controls how AI models use your content',
        effort: 'low',
      });
    }

    if (!seo.metaTags.title.optimized) {
      recommendations.push({
        category: 'seo',
        priority: 'high',
        title: 'Optimize Page Title',
        description: seo.metaTags.title.exists
          ? `Title length is ${seo.metaTags.title.length} characters. Optimize to 30-60 characters.`
          : 'Add a descriptive page title (30-60 characters)',
        impact: 'Critical for search rankings and click-through rates',
        effort: 'low',
      });
    }

    if (!seo.metaTags.description.optimized) {
      recommendations.push({
        category: 'seo',
        priority: 'high',
        title: 'Optimize Meta Description',
        description: seo.metaTags.description.exists
          ? `Meta description is ${seo.metaTags.description.length} characters. Optimize to 120-160 characters.`
          : 'Add a compelling meta description (120-160 characters)',
        impact: 'Improves click-through rates from search results',
        effort: 'low',
      });
    }

    return recommendations;
  }

  private generateGEORecommendations(geo: GEOResults, score: number): Recommendation[] {
    const recommendations: Recommendation[] = [];

    if (geo.schemaMarkup.totalSchemas === 0) {
      recommendations.push({
        category: 'geo',
        priority: 'high',
        title: 'Add Schema Markup',
        description: 'Implement structured data (JSON-LD) to help AI understand your content',
        impact: 'Significantly improves AI search engine visibility',
        effort: 'medium',
        resources: ['https://schema.org/', 'https://developers.google.com/search/docs/appearance/structured-data'],
      });
    }

    if (geo.contentStructure.faqSections === 0) {
      recommendations.push({
        category: 'geo',
        priority: 'medium',
        title: 'Add FAQ Sections',
        description: 'Create FAQ sections with clear question-answer pairs',
        impact: 'Improves AI-readability and featured snippet chances',
        effort: 'medium',
      });
    }

    if (geo.aiOptimization.readabilityScore < 70) {
      recommendations.push({
        category: 'geo',
        priority: 'medium',
        title: 'Improve Content Readability',
        description: 'Simplify sentence structure and add more headings and lists',
        impact: 'Makes content more accessible to AI parsing',
        effort: 'high',
      });
    }

    return recommendations;
  }

  private generateAccessibilityRecommendations(accessibility: AccessibilityResults, score: number): Recommendation[] {
    const recommendations: Recommendation[] = [];

    if (accessibility.altText.coverage < 90) {
      recommendations.push({
        category: 'accessibility',
        priority: 'critical',
        title: 'Add Missing Alt Text',
        description: `${accessibility.altText.missingAlt} images are missing alt text (${accessibility.altText.coverage}% coverage)`,
        impact: 'Critical for screen readers and SEO',
        effort: 'low',
      });
    }

    for (const issue of accessibility.issues.filter(i => i.severity === 'critical').slice(0, 3)) {
      recommendations.push({
        category: 'accessibility',
        priority: 'critical',
        title: `Fix ${issue.type.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}`,
        description: issue.description,
        impact: 'Critical for WCAG compliance and user accessibility',
        effort: 'low',
      });
    }

    return recommendations;
  }

  private generateSecurityRecommendations(security: SecurityResults, score: number): Recommendation[] {
    const recommendations: Recommendation[] = [];

    if (!security.https.enabled) {
      recommendations.push({
        category: 'security',
        priority: 'critical',
        title: 'Enable HTTPS',
        description: 'Implement SSL/TLS encryption for secure data transmission',
        impact: 'Critical for security, SEO, and user trust',
        effort: 'medium',
      });
    }

    if (!security.headers.contentSecurityPolicy) {
      recommendations.push({
        category: 'security',
        priority: 'high',
        title: 'Implement Content Security Policy',
        description: 'Add CSP header to prevent XSS and injection attacks',
        impact: 'Significantly improves security against common attacks',
        effort: 'medium',
      });
    }

    for (const vuln of security.vulnerabilities.filter(v => v.severity === 'critical').slice(0, 2)) {
      recommendations.push({
        category: 'security',
        priority: 'critical',
        title: `Fix ${vuln.type.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}`,
        description: vuln.description,
        impact: 'Critical security vulnerability',
        effort: 'medium',
      });
    }

    return recommendations;
  }
}

// Export singleton instance
export const auditScorer = new AuditScorer();
