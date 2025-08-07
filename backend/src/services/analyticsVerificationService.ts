/**
 * @file analyticsVerificationService.ts
 * @description Domain ownership verification service for analytics integrations
 *
 * This service handles:
 * - HTML meta tag verification
 * - DNS TXT record verification  
 * - HTML file upload verification
 * - Verification token generation and validation
 */

import axios from 'axios';
import { randomBytes } from 'crypto';
import * as dns from 'dns';
import { promisify } from 'util';
import logger from '../utils/logger';
import { dbCache } from '../config/dbCache';

const resolveTxt = promisify(dns.resolveTxt);

export interface VerificationResult {
  verified: boolean;
  method: string;
  error?: string;
  details?: any;
}

export interface VerificationToken {
  token: string;
  metaTag: string;
  dnsRecord: string;
  fileName: string;
  fileContent: string;
}

class AnalyticsVerificationService {
  private readonly VERIFICATION_PREFIX = 'serplexity-site-verification';
  private readonly USER_AGENT = 'Serplexity-Bot/1.0 (Analytics Verification)';

  /**
   * Generate verification token and related verification elements
   */
  generateVerificationToken(domain: string): VerificationToken {
    // Generate a unique token
    const token = `${this.VERIFICATION_PREFIX}=${randomBytes(32).toString('hex')}`;
    
    return {
      token,
      metaTag: `<meta name="${this.VERIFICATION_PREFIX}" content="${token.split('=')[1]}" />`,
      dnsRecord: `TXT ${this.VERIFICATION_PREFIX}=${token.split('=')[1]}`,
      fileName: `${this.VERIFICATION_PREFIX}.html`,
      fileContent: `${this.VERIFICATION_PREFIX}=${token.split('=')[1]}`
    };
  }

  /**
   * Verify domain ownership using HTML meta tag method
   */
  async verifyMetaTag(domain: string, expectedToken: string): Promise<VerificationResult> {
    try {
      // Ensure domain has protocol
      const url = domain.startsWith('http') ? domain : `https://${domain}`;
      
      logger.info(`Verifying meta tag for domain: ${url}`);
      
      const response = await axios.get(url, {
        headers: {
          'User-Agent': this.USER_AGENT
        },
        timeout: 10000,
        maxRedirects: 5
      });

      const html = response.data;
      const metaTagRegex = new RegExp(
        `<meta[^>]*name=["']${this.VERIFICATION_PREFIX}["'][^>]*content=["']([^"']+)["'][^>]*>`,
        'i'
      );

      const match = html.match(metaTagRegex);
      
      if (!match) {
        return {
          verified: false,
          method: 'meta_tag',
          error: 'Verification meta tag not found in HTML'
        };
      }

      const foundToken = match[1];
      const verified = foundToken === expectedToken.split('=')[1];

      return {
        verified,
        method: 'meta_tag',
        error: verified ? undefined : 'Meta tag token does not match expected value',
        details: {
          foundToken,
          expectedToken: expectedToken.split('=')[1]
        }
      };
    } catch (error) {
      logger.error('Error verifying meta tag:', error);
      return {
        verified: false,
        method: 'meta_tag',
        error: `Failed to fetch or parse HTML: ${(error as Error).message}`
      };
    }
  }

  /**
   * Verify domain ownership using DNS TXT record method
   */
  async verifyDnsRecord(domain: string, expectedToken: string): Promise<VerificationResult> {
    try {
      // Remove protocol and www prefix for DNS lookup
      const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '');
      
      logger.info(`Verifying DNS TXT record for domain: ${cleanDomain}`);
      
      const txtRecords = await resolveTxt(cleanDomain);
      const flattenedRecords = txtRecords.flat();
      
      const verificationRecord = flattenedRecords.find(record => 
        record.startsWith(this.VERIFICATION_PREFIX)
      );

      if (!verificationRecord) {
        return {
          verified: false,
          method: 'dns_record',
          error: `No ${this.VERIFICATION_PREFIX} TXT record found`
        };
      }

      const foundToken = verificationRecord.split('=')[1];
      const expectedValue = expectedToken.split('=')[1];
      const verified = foundToken === expectedValue;

      return {
        verified,
        method: 'dns_record',
        error: verified ? undefined : 'DNS TXT record token does not match expected value',
        details: {
          foundToken,
          expectedToken: expectedValue,
          allTxtRecords: flattenedRecords
        }
      };
    } catch (error) {
      logger.error('Error verifying DNS record:', error);
      return {
        verified: false,
        method: 'dns_record',
        error: `DNS lookup failed: ${(error as Error).message}`
      };
    }
  }

  /**
   * Verify domain ownership using HTML file upload method
   */
  async verifyHtmlFile(domain: string, expectedToken: string): Promise<VerificationResult> {
    try {
      // Ensure domain has protocol
      const baseUrl = domain.startsWith('http') ? domain : `https://${domain}`;
      const fileUrl = `${baseUrl}/${this.VERIFICATION_PREFIX}.html`;
      
      logger.info(`Verifying HTML file at: ${fileUrl}`);
      
      const response = await axios.get(fileUrl, {
        headers: {
          'User-Agent': this.USER_AGENT
        },
        timeout: 10000,
        maxRedirects: 5
      });

      const fileContent = response.data.trim();
      const expectedContent = expectedToken;
      const verified = fileContent === expectedContent;

      return {
        verified,
        method: 'file_upload',
        error: verified ? undefined : 'File content does not match expected value',
        details: {
          foundContent: fileContent,
          expectedContent
        }
      };
    } catch (error) {
      logger.error('Error verifying HTML file:', error);
      return {
        verified: false,
        method: 'file_upload',
        error: `Failed to fetch verification file: ${(error as Error).message}`
      };
    }
  }

  /**
   * Perform verification using the specified method
   */
  async verifyDomain(
    domain: string, 
    verificationToken: string, 
    method: 'meta_tag' | 'dns_record' | 'file_upload'
  ): Promise<VerificationResult> {
    switch (method) {
      case 'meta_tag':
        return this.verifyMetaTag(domain, verificationToken);
      case 'dns_record':
        return this.verifyDnsRecord(domain, verificationToken);
      case 'file_upload':
        return this.verifyHtmlFile(domain, verificationToken);
      default:
        return {
          verified: false,
          method,
          error: 'Unknown verification method'
        };
    }
  }

  /**
   * Update integration status based on verification result
   */
  async updateIntegrationStatus(
    integrationId: string, 
    verificationResult: VerificationResult
  ): Promise<void> {
    try {
      const prisma = await dbCache.getPrimaryClient();
      
      const status = verificationResult.verified ? 'verified' : 'failed';
      
      await prisma.analyticsIntegration.update({
        where: { id: integrationId },
        data: {
          status,
          updatedAt: new Date()
        }
      });

      logger.info(`Updated integration ${integrationId} status to: ${status}`);
    } catch (error) {
      logger.error('Error updating integration status:', error);
      throw error;
    }
  }

  /**
   * Verify integration and update status
   */
  async verifyIntegration(integrationId: string): Promise<VerificationResult> {
    try {
      const prisma = await dbCache.getPrimaryClient();
      
      const integration = await prisma.analyticsIntegration.findUnique({
        where: { id: integrationId },
        include: { company: true }
      });

      if (!integration) {
        throw new Error('Integration not found');
      }

      if (!integration.verificationToken || !integration.verificationMethod) {
        throw new Error('Missing verification token or method');
      }

      const domain = integration.company.website;
      const result = await this.verifyDomain(
        domain,
        integration.verificationToken,
        integration.verificationMethod as 'meta_tag' | 'dns_record' | 'file_upload'
      );

      // Update integration status
      await this.updateIntegrationStatus(integrationId, result);

      return result;
    } catch (error) {
      logger.error(`Error verifying integration ${integrationId}:`, error);
      throw error;
    }
  }

  /**
   * Re-verify all pending integrations (for background job)
   */
  async reVerifyPendingIntegrations(): Promise<void> {
    try {
      const prisma = await dbCache.getPrimaryClient();
      
      const pendingIntegrations = await prisma.analyticsIntegration.findMany({
        where: {
          status: 'pending',
          verificationMethod: {
            in: ['meta_tag', 'dns_record', 'file_upload']
          }
        },
        include: { company: true }
      });

      logger.info(`Found ${pendingIntegrations.length} pending integrations to re-verify`);

      for (const integration of pendingIntegrations) {
        try {
          await this.verifyIntegration(integration.id);
          // Add small delay to avoid overwhelming target servers
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          logger.error(`Failed to re-verify integration ${integration.id}:`, error);
        }
      }
    } catch (error) {
      logger.error('Error re-verifying pending integrations:', error);
      throw error;
    }
  }

  /**
   * Check if domain is accessible for verification
   */
  async checkDomainAccessibility(domain: string): Promise<{
    accessible: boolean;
    httpStatus?: number;
    error?: string;
  }> {
    try {
      const url = domain.startsWith('http') ? domain : `https://${domain}`;
      
      const response = await axios.head(url, {
        headers: {
          'User-Agent': this.USER_AGENT
        },
        timeout: 10000,
        maxRedirects: 5
      });

      return {
        accessible: true,
        httpStatus: response.status
      };
    } catch (error: any) {
      return {
        accessible: false,
        httpStatus: error.response?.status,
        error: error.message
      };
    }
  }
}

export const analyticsVerificationService = new AnalyticsVerificationService();
export default analyticsVerificationService;