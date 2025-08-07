/**
 * @file securityAnalyzer.ts
 * @description Security analysis for web applications
 * 
 * Analyzes website security including:
 * - HTTPS implementation and SSL certificate validation
 * - Security headers analysis
 * - Common vulnerability detection
 * - Cookie security settings
 * 
 * @dependencies
 * - axios for HTTP requests
 * - TLS/SSL certificate inspection
 * - Security header validation
 */

import axios from "axios";
import https from "https";
import { URL } from "url";
import logger from "../../../utils/logger";
import { SecurityResults } from "../webAuditService";

interface SecurityVulnerability {
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
}

class SecurityAnalyzer {
  private readonly timeout = 10000; // 10 second timeout
  private readonly userAgent = 'Serplexity-WebAudit/1.0 (+https://serplexity.com)';

  /**
   * Analyze security factors
   */
  async analyze(url: string): Promise<SecurityResults> {
    const startTime = Date.now();

    try {
      logger.info("Starting security analysis", { url });

      const parsedUrl = new URL(url);

      // Analyze different security aspects
      const httpsAnalysis = await this.analyzeHTTPS(parsedUrl);
      const headersAnalysis = await this.analyzeSecurityHeaders(url);
      const vulnerabilities = await this.detectVulnerabilities(url, headersAnalysis);

      const result: SecurityResults = {
        https: httpsAnalysis,
        headers: headersAnalysis,
        vulnerabilities,
      };

      const analysisTime = Date.now() - startTime;

      logger.info("Security analysis completed", {
        url,
        analysisTime,
        httpsEnabled: httpsAnalysis.enabled,
        certificateValid: httpsAnalysis.certificateValid,
        vulnerabilityCount: vulnerabilities.length,
        criticalVulnerabilities: vulnerabilities.filter(v => v.severity === 'critical').length,
      });

      return result;

    } catch (error) {
      const analysisTime = Date.now() - startTime;
      
      logger.error("Security analysis failed", {
        url,
        analysisTime,
        error: error instanceof Error ? error.message : String(error),
      });

      // Return default results on failure
      return this.getDefaultSecurityResults();
    }
  }

  /**
   * Analyze HTTPS implementation and SSL certificate
   */
  private async analyzeHTTPS(parsedUrl: URL): Promise<SecurityResults['https']> {
    const isHttps = parsedUrl.protocol === 'https:';
    
    if (!isHttps) {
      return {
        enabled: false,
        certificateValid: false,
        hsts: false,
      };
    }

    try {
      // Check SSL certificate validity
      const certificateValid = await this.validateSSLCertificate(parsedUrl.hostname, parsedUrl.port || '443');

      // Check for HSTS by making a request
      const response = await axios.get(parsedUrl.toString(), {
        timeout: this.timeout,
        headers: { 'User-Agent': this.userAgent },
        maxRedirects: 0,
        validateStatus: () => true, // Don't throw on any status
      });

      const hstsHeader = response.headers['strict-transport-security'];
      const hasHSTS = !!hstsHeader;

      return {
        enabled: true,
        certificateValid,
        hsts: hasHSTS,
      };

    } catch (error) {
      return {
        enabled: true,
        certificateValid: false,
        hsts: false,
      };
    }
  }

  /**
   * Validate SSL certificate
   */
  private async validateSSLCertificate(hostname: string, port: string): Promise<boolean> {
    return new Promise((resolve) => {
      const options = {
        hostname,
        port: parseInt(port),
        method: 'HEAD',
        timeout: this.timeout,
      };

      const req = https.request(options, (res) => {
        // If we get a response, the certificate is valid
        resolve(true);
        res.destroy();
      });

      req.on('error', (error) => {
        // Certificate validation failed
        resolve(false);
      });

      req.on('timeout', () => {
        resolve(false);
        req.destroy();
      });

      req.end();
    });
  }

  /**
   * Analyze security headers
   */
  private async analyzeSecurityHeaders(url: string): Promise<SecurityResults['headers']> {
    try {
      const response = await axios.get(url, {
        timeout: this.timeout,
        headers: { 'User-Agent': this.userAgent },
        maxRedirects: 5,
        validateStatus: () => true, // Don't throw on any status
      });

      const headers = response.headers;

      return {
        contentSecurityPolicy: this.hasSecurityHeader(headers, 'content-security-policy'),
        xFrameOptions: this.hasSecurityHeader(headers, 'x-frame-options'),
        xContentTypeOptions: this.hasSecurityHeader(headers, 'x-content-type-options'),
        referrerPolicy: this.hasSecurityHeader(headers, 'referrer-policy'),
        permissionsPolicy: this.hasSecurityHeader(headers, 'permissions-policy') || 
                          this.hasSecurityHeader(headers, 'feature-policy'), // Legacy name
      };

    } catch (error) {
      // Return all false if we can't analyze headers
      return {
        contentSecurityPolicy: false,
        xFrameOptions: false,
        xContentTypeOptions: false,
        referrerPolicy: false,
        permissionsPolicy: false,
      };
    }
  }

  /**
   * Check if a security header exists and has valid value
   */
  private hasSecurityHeader(headers: any, headerName: string): boolean {
    const headerValue = headers[headerName] || headers[headerName.toLowerCase()];
    
    if (!headerValue) {
      return false;
    }

    // Check for meaningful values (not just empty or generic values)
    const value = headerValue.toString().toLowerCase().trim();
    
    switch (headerName.toLowerCase()) {
      case 'content-security-policy':
        return value.length > 10 && !value.includes('unsafe-inline') && !value.includes('unsafe-eval');
      
      case 'x-frame-options':
        return ['deny', 'sameorigin'].includes(value) || value.startsWith('allow-from');
      
      case 'x-content-type-options':
        return value === 'nosniff';
      
      case 'referrer-policy':
        return ['no-referrer', 'no-referrer-when-downgrade', 'origin', 'origin-when-cross-origin', 
                'same-origin', 'strict-origin', 'strict-origin-when-cross-origin', 'unsafe-url'].includes(value);
      
      case 'permissions-policy':
      case 'feature-policy':
        return value.length > 5; // Has some policy defined
      
      default:
        return value.length > 0;
    }
  }

  /**
   * Detect common security vulnerabilities
   */
  private async detectVulnerabilities(url: string, headers: SecurityResults['headers']): Promise<SecurityVulnerability[]> {
    const vulnerabilities: SecurityVulnerability[] = [];

    try {
      const response = await axios.get(url, {
        timeout: this.timeout,
        headers: { 'User-Agent': this.userAgent },
        maxRedirects: 5,
        validateStatus: () => true,
      });

      const responseHeaders = response.headers;
      const body = response.data || '';

      // Missing security headers
      if (!headers.contentSecurityPolicy) {
        vulnerabilities.push({
          type: 'missing-csp',
          severity: 'high',
          description: 'Content Security Policy (CSP) header is missing, making the site vulnerable to XSS attacks',
        });
      }

      if (!headers.xFrameOptions) {
        vulnerabilities.push({
          type: 'missing-x-frame-options',
          severity: 'medium',
          description: 'X-Frame-Options header is missing, site may be vulnerable to clickjacking attacks',
        });
      }

      if (!headers.xContentTypeOptions) {
        vulnerabilities.push({
          type: 'missing-x-content-type-options',
          severity: 'medium',
          description: 'X-Content-Type-Options header is missing, site may be vulnerable to MIME-type confusion attacks',
        });
      }

      // Server information disclosure
      const serverHeader = responseHeaders.server;
      if (serverHeader && serverHeader.toString().includes('/')) {
        vulnerabilities.push({
          type: 'server-version-disclosure',
          severity: 'low',
          description: 'Server header reveals version information that could aid attackers',
        });
      }

      // X-Powered-By header disclosure
      const poweredByHeader = responseHeaders['x-powered-by'];
      if (poweredByHeader) {
        vulnerabilities.push({
          type: 'powered-by-disclosure',
          severity: 'low',
          description: 'X-Powered-By header reveals technology stack information',
        });
      }

      // Check for mixed content (HTTP resources on HTTPS page)
      if (url.startsWith('https://') && typeof body === 'string') {
        const httpResourcePattern = /src\s*=\s*["']http:\/\/[^"']+["']/gi;
        const mixedContentMatches = body.match(httpResourcePattern);
        
        if (mixedContentMatches && mixedContentMatches.length > 0) {
          vulnerabilities.push({
            type: 'mixed-content',
            severity: 'medium',
            description: `Found ${mixedContentMatches.length} HTTP resources on HTTPS page, causing mixed content warnings`,
          });
        }
      }

      // Check for inline JavaScript (potential XSS risk)
      if (typeof body === 'string') {
        const inlineScriptPattern = /<script[^>]*>(?![\s]*<\/script>)/gi;
        const inlineScripts = body.match(inlineScriptPattern);
        
        if (inlineScripts && inlineScripts.length > 0) {
          vulnerabilities.push({
            type: 'inline-scripts',
            severity: 'medium',
            description: `Found ${inlineScripts.length} inline script tags, which can be vulnerable to XSS if CSP is not properly configured`,
          });
        }
      }

      // Check for weak cipher suites (basic check)
      const parsedUrl = new URL(url);
      if (parsedUrl.protocol === 'https:') {
        // This is a simplified check - in practice, you'd need more sophisticated SSL/TLS analysis
        const tlsVersion = responseHeaders['tls-version'] || responseHeaders['ssl-version'];
        if (tlsVersion && (tlsVersion.includes('1.0') || tlsVersion.includes('1.1'))) {
          vulnerabilities.push({
            type: 'weak-tls',
            severity: 'high',
            description: 'Site uses outdated TLS version (1.0 or 1.1), which is vulnerable to attacks',
          });
        }
      }

      // Check for sensitive information in HTML comments
      if (typeof body === 'string') {
        const commentPattern = /<!--[\s\S]*?-->/g;
        const comments = body.match(commentPattern) || [];
        
        const sensitivePatterns = [
          /password/i,
          /api[_-]?key/i,
          /secret/i,
          /token/i,
          /credential/i,
          /database/i,
          /config/i,
        ];

        for (const comment of comments) {
          for (const pattern of sensitivePatterns) {
            if (pattern.test(comment)) {
              vulnerabilities.push({
                type: 'sensitive-data-in-comments',
                severity: 'medium',
                description: 'HTML comments may contain sensitive information',
              });
              break;
            }
          }
        }
      }

      // Check cookie security
      const setCookieHeaders = responseHeaders['set-cookie'];
      if (setCookieHeaders) {
        const cookies = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
        
        for (const cookie of cookies) {
          const cookieStr = cookie.toString().toLowerCase();
          
          if (!cookieStr.includes('secure') && url.startsWith('https://')) {
            vulnerabilities.push({
              type: 'insecure-cookie',
              severity: 'medium',
              description: 'Cookies are not marked as Secure on HTTPS site',
            });
            break;
          }
          
          if (!cookieStr.includes('httponly')) {
            vulnerabilities.push({
              type: 'cookie-without-httponly',
              severity: 'medium',
              description: 'Cookies are not marked as HttpOnly, making them vulnerable to XSS',
            });
            break;
          }
        }
      }

    } catch (error) {
      vulnerabilities.push({
        type: 'analysis-error',
        severity: 'low',
        description: `Security analysis encountered an error: ${error instanceof Error ? error.message : String(error)}`,
      });
    }

    return vulnerabilities;
  }

  /**
   * Get default security results for error cases
   */
  private getDefaultSecurityResults(): SecurityResults {
    return {
      https: {
        enabled: false,
        certificateValid: false,
        hsts: false,
      },
      headers: {
        contentSecurityPolicy: false,
        xFrameOptions: false,
        xContentTypeOptions: false,
        referrerPolicy: false,
        permissionsPolicy: false,
      },
      vulnerabilities: [{
        type: 'analysis-failed',
        severity: 'critical',
        description: 'Security analysis could not be completed',
      }],
    };
  }
}

// Export singleton instance
export const securityAnalyzer = new SecurityAnalyzer();