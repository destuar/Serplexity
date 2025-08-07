/**
 * @file accessibilityAnalyzer.ts
 * @description Accessibility analysis for WCAG compliance
 * 
 * Analyzes website accessibility including:
 * - Alt text coverage for images
 * - Color contrast analysis
 * - ARIA labels and roles
 * - Semantic HTML usage
 * - Keyboard navigation support
 * 
 * @dependencies
 * - axios for HTTP requests
 * - cheerio for DOM parsing
 * - Color contrast calculations
 */

import axios from "axios";
import * as cheerio from "cheerio";
import logger from "../../../utils/logger";
import { AccessibilityResults } from "../webAuditService";

interface AccessibilityIssue {
  type: string;
  severity: 'critical' | 'serious' | 'moderate' | 'minor';
  count: number;
  description: string;
}

class AccessibilityAnalyzer {
  private readonly timeout = 10000; // 10 second timeout
  private readonly userAgent = 'Serplexity-WebAudit/1.0 (+https://serplexity.com)';

  /**
   * Analyze accessibility factors
   */
  async analyze(url: string): Promise<AccessibilityResults> {
    const startTime = Date.now();

    try {
      logger.info("Starting accessibility analysis", { url });

      // Fetch and parse the page
      const response = await axios.get(url, {
        timeout: this.timeout,
        headers: { 'User-Agent': this.userAgent },
        maxRedirects: 5,
      });

      const html = response.data;
      const $ = cheerio.load(html);

      // Analyze different accessibility aspects
      const altTextAnalysis = this.analyzeAltText($);
      const colorContrastAnalysis = this.analyzeColorContrast($);
      const issues = this.detectAccessibilityIssues($);

      // Calculate WCAG compliance level
      const wcagCompliance = this.calculateWCAGCompliance(issues, altTextAnalysis, colorContrastAnalysis);

      const result: AccessibilityResults = {
        wcagCompliance,
        issues,
        altText: altTextAnalysis,
        colorContrast: colorContrastAnalysis,
      };

      const analysisTime = Date.now() - startTime;

      logger.info("Accessibility analysis completed", {
        url,
        analysisTime,
        wcagLevel: wcagCompliance.level,
        wcagScore: wcagCompliance.score,
        totalIssues: issues.reduce((sum, issue) => sum + issue.count, 0),
        altTextCoverage: altTextAnalysis.coverage,
      });

      return result;

    } catch (error) {
      const analysisTime = Date.now() - startTime;
      
      logger.error("Accessibility analysis failed", {
        url,
        analysisTime,
        error: error instanceof Error ? error.message : String(error),
      });

      // Return default results on failure
      return this.getDefaultAccessibilityResults();
    }
  }

  /**
   * Analyze alt text coverage for images
   */
  private analyzeAltText($: cheerio.CheerioAPI): AccessibilityResults['altText'] {
    const images = $('img');
    const totalImages = images.length;
    let missingAlt = 0;

    images.each((_, element) => {
      const alt = $(element).attr('alt');
      
      // Missing alt attribute or empty alt for non-decorative images
      if (alt === undefined || (alt === '' && !this.isDecorativeImage($(element)))) {
        missingAlt++;
      }
    });

    const coverage = totalImages > 0 ? Math.round(((totalImages - missingAlt) / totalImages) * 100) : 100;

    return {
      coverage,
      totalImages,
      missingAlt,
    };
  }

  /**
   * Analyze color contrast (basic analysis)
   */
  private analyzeColorContrast($: cheerio.CheerioAPI): AccessibilityResults['colorContrast'] {
    // This is a simplified analysis - full color contrast requires actual CSS computation
    // In a real implementation, you'd need to:
    // 1. Extract computed styles
    // 2. Calculate contrast ratios
    // 3. Check against WCAG standards (4.5:1 for normal text, 3:1 for large text)

    const textElements = $('p, h1, h2, h3, h4, h5, h6, span, div, a, li, td, th');
    let passed = 0;
    let failed = 0;

    // Basic heuristic check - look for potential contrast issues
    textElements.each((_, element) => {
      const text = $(element).text().trim();
      if (text.length === 0) return;

      // Check for inline styles that might indicate contrast issues
      const style = $(element).attr('style') || '';
      const className = $(element).attr('class') || '';

      // Look for common patterns that might indicate low contrast
      const hasLightText = style.includes('color: white') || 
                          style.includes('color: #fff') ||
                          className.includes('light') ||
                          className.includes('white');

      const hasLightBackground = style.includes('background: white') ||
                                style.includes('background-color: white') ||
                                style.includes('background: #fff') ||
                                className.includes('light-bg');

      // Very basic check - white text on white background = bad contrast
      if (hasLightText && hasLightBackground) {
        failed++;
      } else {
        passed++;
      }
    });

    const total = passed + failed;
    const ratio = total > 0 ? (passed / total) * 100 : 100;

    return {
      passed,
      failed,
      ratio: Math.round(ratio),
    };
  }

  /**
   * Detect various accessibility issues
   */
  private detectAccessibilityIssues($: cheerio.CheerioAPI): AccessibilityIssue[] {
    const issues: AccessibilityIssue[] = [];

    // Missing page title
    const title = $('title').text().trim();
    if (!title) {
      issues.push({
        type: 'missing-title',
        severity: 'critical',
        count: 1,
        description: 'Page is missing a title element',
      });
    }

    // Missing language attribute
    const lang = $('html').attr('lang');
    if (!lang) {
      issues.push({
        type: 'missing-lang',
        severity: 'serious',
        count: 1,
        description: 'HTML element is missing lang attribute',
      });
    }

    // Missing heading structure
    const h1Count = $('h1').length;
    if (h1Count === 0) {
      issues.push({
        type: 'missing-h1',
        severity: 'serious',
        count: 1,
        description: 'Page is missing h1 heading',
      });
    } else if (h1Count > 1) {
      issues.push({
        type: 'multiple-h1',
        severity: 'moderate',
        count: h1Count - 1,
        description: 'Page has multiple h1 headings',
      });
    }

    // Check for proper heading hierarchy
    const headingHierarchyIssues = this.checkHeadingHierarchy($);
    if (headingHierarchyIssues > 0) {
      issues.push({
        type: 'heading-hierarchy',
        severity: 'moderate',
        count: headingHierarchyIssues,
        description: 'Heading hierarchy is not logical',
      });
    }

    // Links without text or accessible names
    const emptyLinks = $('a').filter((_, element) => {
      const text = $(element).text().trim();
      const ariaLabel = $(element).attr('aria-label');
      const title = $(element).attr('title');
      
      return !text && !ariaLabel && !title;
    }).length;

    if (emptyLinks > 0) {
      issues.push({
        type: 'empty-links',
        severity: 'critical',
        count: emptyLinks,
        description: 'Links without accessible text or labels',
      });
    }

    // Form inputs without labels
    const unlabeledInputs = this.findUnlabeledInputs($);
    if (unlabeledInputs > 0) {
      issues.push({
        type: 'unlabeled-inputs',
        severity: 'critical',
        count: unlabeledInputs,
        description: 'Form inputs without proper labels',
      });
    }

    // Images without alt text (already covered in altText analysis, but important for overall score)
    const imagesWithoutAlt = $('img').filter((_, element) => {
      const alt = $(element).attr('alt');
      return alt === undefined;
    }).length;

    if (imagesWithoutAlt > 0) {
      issues.push({
        type: 'missing-alt',
        severity: 'serious',
        count: imagesWithoutAlt,
        description: 'Images without alt attributes',
      });
    }

    // Tables without proper structure
    const tablesWithoutHeaders = $('table').filter((_, element) => {
      const hasThElements = $(element).find('th').length > 0;
      const hasScope = $(element).find('[scope]').length > 0;
      const hasHeaders = $(element).find('[headers]').length > 0;
      
      return !hasThElements && !hasScope && !hasHeaders;
    }).length;

    if (tablesWithoutHeaders > 0) {
      issues.push({
        type: 'table-headers',
        severity: 'moderate',
        count: tablesWithoutHeaders,
        description: 'Tables without proper header structure',
      });
    }

    // Skip links for keyboard navigation
    const skipLinks = $('a[href^="#"]').filter((_, element) => {
      const text = $(element).text().toLowerCase();
      return text.includes('skip') || text.includes('jump');
    }).length;

    if (skipLinks === 0) {
      issues.push({
        type: 'missing-skip-links',
        severity: 'minor',
        count: 1,
        description: 'No skip links found for keyboard navigation',
      });
    }

    // ARIA usage issues
    const ariaIssues = this.checkARIAUsage($);
    if (ariaIssues > 0) {
      issues.push({
        type: 'aria-issues',
        severity: 'moderate',
        count: ariaIssues,
        description: 'Improper ARIA attribute usage',
      });
    }

    return issues;
  }

  /**
   * Check heading hierarchy
   */
  private checkHeadingHierarchy($: cheerio.CheerioAPI): number {
    const headings = $('h1, h2, h3, h4, h5, h6').map((_, element) => {
      return parseInt($(element).prop('tagName').replace('H', ''));
    }).get();

    let issues = 0;
    let previousLevel = 0;

    for (const level of headings) {
      if (previousLevel > 0 && level > previousLevel + 1) {
        issues++; // Skipped a heading level
      }
      previousLevel = level;
    }

    return issues;
  }

  /**
   * Find form inputs without proper labels
   */
  private findUnlabeledInputs($: cheerio.CheerioAPI): number {
    let unlabeled = 0;

    $('input, select, textarea').each((_, element) => {
      const id = $(element).attr('id');
      const ariaLabel = $(element).attr('aria-label');
      const ariaLabelledby = $(element).attr('aria-labelledby');
      const title = $(element).attr('title');
      const type = $(element).attr('type');

      // Skip hidden inputs and buttons (they have different labeling requirements)
      if (type === 'hidden' || type === 'submit' || type === 'button') {
        return;
      }

      // Check if input has a proper label
      let hasLabel = false;

      if (id) {
        const label = $(`label[for="${id}"]`);
        if (label.length > 0) {
          hasLabel = true;
        }
      }

      // Check for parent label
      const parentLabel = $(element).closest('label');
      if (parentLabel.length > 0) {
        hasLabel = true;
      }

      // Check for ARIA labeling
      if (ariaLabel || ariaLabelledby || title) {
        hasLabel = true;
      }

      if (!hasLabel) {
        unlabeled++;
      }
    });

    return unlabeled;
  }

  /**
   * Check ARIA attribute usage
   */
  private checkARIAUsage($: cheerio.CheerioAPI): number {
    let issues = 0;

    // Check for empty ARIA labels
    $('[aria-label]').each((_, element) => {
      const ariaLabel = $(element).attr('aria-label');
      if (!ariaLabel || ariaLabel.trim() === '') {
        issues++;
      }
    });

    // Check for invalid ARIA labelledby references
    $('[aria-labelledby]').each((_, element) => {
      const labelledby = $(element).attr('aria-labelledby');
      if (labelledby) {
        const ids = labelledby.split(' ');
        for (const id of ids) {
          if ($(`#${id}`).length === 0) {
            issues++;
          }
        }
      }
    });

    // Check for invalid ARIA describedby references
    $('[aria-describedby]').each((_, element) => {
      const describedby = $(element).attr('aria-describedby');
      if (describedby) {
        const ids = describedby.split(' ');
        for (const id of ids) {
          if ($(`#${id}`).length === 0) {
            issues++;
          }
        }
      }
    });

    return issues;
  }

  /**
   * Check if image is decorative
   */
  private isDecorativeImage($element: cheerio.Cheerio<any>): boolean {
    const role = $element.attr('role');
    const ariaHidden = $element.attr('aria-hidden');
    
    return role === 'presentation' || role === 'none' || ariaHidden === 'true';
  }

  /**
   * Calculate WCAG compliance level and score
   */
  private calculateWCAGCompliance(
    issues: AccessibilityIssue[],
    altText: AccessibilityResults['altText'],
    colorContrast: AccessibilityResults['colorContrast']
  ): AccessibilityResults['wcagCompliance'] {
    // Calculate severity-weighted score
    let totalIssueScore = 0;
    const maxPossibleScore = 100;

    for (const issue of issues) {
      const weight = this.getSeverityWeight(issue.severity);
      totalIssueScore += issue.count * weight;
    }

    // Factor in alt text coverage
    const altTextPenalty = (100 - altText.coverage) * 0.5;
    totalIssueScore += altTextPenalty;

    // Factor in color contrast
    const contrastPenalty = (100 - colorContrast.ratio) * 0.3;
    totalIssueScore += contrastPenalty;

    // Calculate final score (0-100)
    const score = Math.max(0, Math.round(maxPossibleScore - totalIssueScore));

    // Determine WCAG level based on score and critical issues
    let level: 'A' | 'AA' | 'AAA' | 'FAIL';

    const criticalIssues = issues.filter(issue => issue.severity === 'critical');
    const seriousIssues = issues.filter(issue => issue.severity === 'serious');

    if (criticalIssues.length > 0) {
      level = 'FAIL';
    } else if (score >= 90 && seriousIssues.length === 0) {
      level = 'AAA';
    } else if (score >= 75) {
      level = 'AA';
    } else if (score >= 60) {
      level = 'A';
    } else {
      level = 'FAIL';
    }

    return { level, score };
  }

  /**
   * Get severity weight for scoring
   */
  private getSeverityWeight(severity: 'critical' | 'serious' | 'moderate' | 'minor'): number {
    switch (severity) {
      case 'critical': return 20;
      case 'serious': return 10;
      case 'moderate': return 5;
      case 'minor': return 2;
      default: return 1;
    }
  }

  /**
   * Get default accessibility results for error cases
   */
  private getDefaultAccessibilityResults(): AccessibilityResults {
    return {
      wcagCompliance: {
        level: 'FAIL',
        score: 0,
      },
      issues: [{
        type: 'analysis-failed',
        severity: 'critical',
        count: 1,
        description: 'Accessibility analysis could not be completed',
      }],
      altText: {
        coverage: 0,
        totalImages: 0,
        missingAlt: 0,
      },
      colorContrast: {
        passed: 0,
        failed: 0,
        ratio: 0,
      },
    };
  }
}

// Export singleton instance
export const accessibilityAnalyzer = new AccessibilityAnalyzer();