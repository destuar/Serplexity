/**
 * @file databaseTransactionService.ts
 * @description Database transaction management service for ensuring atomic operations
 * during report generation and other critical multi-step processes.
 *
 * @dependencies
 * - @prisma/client: Prisma client for database operations
 * - ../config/database: Database connection configuration
 * - ../utils/logger: Application logging
 *
 * @exports
 * - DatabaseTransactionService: Main service class with transaction operations
 * - databaseTransactionService: Singleton instance
 */

import { PrismaClient } from "@prisma/client";
import { getDbClient } from "../config/database";
import logger from "../utils/logger";

export type TransactionClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

export interface TransactionOptions {
  maxWait?: number; // Maximum time to wait for a transaction slot
  timeout?: number; // Maximum time for the transaction to complete
  isolationLevel?:
    | "ReadUncommitted"
    | "ReadCommitted"
    | "RepeatableRead"
    | "Serializable";
}

export class DatabaseTransactionService {
  private prisma: PrismaClient;

  // Default configuration
  private static readonly DEFAULT_MAX_WAIT = 20000; // 20 seconds
  private static readonly DEFAULT_TIMEOUT = 300000; // 5 minutes
  private static readonly DEFAULT_ISOLATION_LEVEL = "ReadCommitted";

  constructor() {
    this.prisma = null as any; // Will be initialized in init()
    this.init();
  }

  private async init() {
    this.prisma = await getDbClient();
  }

  /**
   * Executes a function within a database transaction
   * @param fn - Function to execute within the transaction
   * @param options - Transaction configuration options
   * @returns Promise<T> - Result of the transaction function
   */
  public async executeInTransaction<T>(
    fn: (tx: TransactionClient) => Promise<T>,
    options: TransactionOptions = {}
  ): Promise<T> {
    const {
      maxWait = DatabaseTransactionService.DEFAULT_MAX_WAIT,
      timeout = DatabaseTransactionService.DEFAULT_TIMEOUT,
      isolationLevel = DatabaseTransactionService.DEFAULT_ISOLATION_LEVEL,
    } = options;

    const transactionId = this.generateTransactionId();

    logger.debug(`[Transaction] Starting transaction: ${transactionId}`);
    const startTime = Date.now();

    try {
      const result = await this.prisma.$transaction(
        async (tx) => {
          logger.debug(
            `[Transaction] Executing function in transaction: ${transactionId}`
          );
          return await fn(tx);
        },
        {
          maxWait,
          timeout,
          isolationLevel,
        }
      );

      const duration = Date.now() - startTime;
      logger.info(
        `[Transaction] Completed successfully: ${transactionId} (${duration}ms)`
      );

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`[Transaction] Failed: ${transactionId} (${duration}ms)`, {
        error: error instanceof Error ? error.message : error,
        transactionId,
        duration,
      });

      throw error;
    }
  }

  /**
   * Wraps question generation and company update in a transaction
   */
  public async createQuestionsTransaction(
    companyId: string,
    questionsData: Array<{
      query: string;
      type: string;
      intent?: string;
      isActive: boolean;
      source: string;
      companyId: string;
    }>
  ): Promise<{ questions: any[]; company: any }> {
    return this.executeInTransaction(async (tx) => {
      logger.info(
        `[Transaction] Creating ${questionsData.length} questions for company ${companyId}`
      );

      // Create questions
      await tx.question.createMany({
        data: questionsData,
      });

      // Update company questions status
      const company = await tx.company.update({
        where: { id: companyId },
        data: { questionsReady: true },
      });

      // Fetch the newly created questions
      const questions = await tx.question.findMany({
        where: {
          companyId,
          isActive: true,
        },
        orderBy: { createdAt: "asc" },
      });

      return { questions, company };
    });
  }

  /**
   * Wraps response and citations creation in a transaction
   */
  public async createResponseWithCitationsTransaction(
    responseData: {
      content: string;
      usage: any;
      model: string;
      engine: string;
      cost: number;
      questionId: string;
      runId: string;
    },
    citationsData: Array<{
      title: string;
      url: string;
      domain: string;
      position: number;
      accessedAt: Date;
      responseId: string;
    }>
  ): Promise<{ response: any; citations: any[] }> {
    return this.executeInTransaction(async (tx) => {
      logger.debug(
        `[Transaction] Creating response with ${citationsData.length} citations`
      );

      // Create the response record
      const response = await tx.response.create({
        data: responseData,
      });

      // Create citations with the response ID
      const citations = [];
      for (const citationData of citationsData) {
        const citation = await tx.citation.create({
          data: {
            title: citationData.title,
            url: citationData.url,
            domain: citationData.domain,
            position: citationData.position,
            accessedAt: citationData.accessedAt,
            responseId: response.id,
          },
        });
        citations.push(citation);
      }

      return { response, citations };
    });
  }

  /**
   * Wraps mention and competitor creation in a transaction
   */
  public async createMentionWithCompetitorTransaction(
    mentionData: {
      content: string;
      sentiment: string;
      confidence: number;
      position: number;
      responseId: string;
    },
    competitorData: {
      name: string;
      website: string;
      companyId: string;
    }
  ): Promise<{ mention: any; competitor: any }> {
    return this.executeInTransaction(async (tx) => {
      logger.debug(
        `[Transaction] Creating mention with competitor: ${competitorData.name}`
      );

      // Find or create competitor
      let competitor = await tx.competitor.findFirst({
        where: {
          name: competitorData.name,
          website: competitorData.website,
          companyId: competitorData.companyId,
        },
      });

      if (!competitor) {
        competitor = await tx.competitor.create({
          data: competitorData,
        });
      } else {
        // Update existing competitor if needed
        competitor = await tx.competitor.findFirst({
          where: {
            name: competitorData.name,
            companyId: competitorData.companyId,
          },
        });
      }

      // Create the mention
      const mention = await tx.mention.create({
        data: {
          position: mentionData.position,
          responseId: mentionData.responseId,
          competitorId: competitor!.id,
          companyId: competitorData.companyId,
        },
      });

      return { mention, competitor: competitor! };
    });
  }

  /**
   * Wraps sentiment score creation in a transaction
   */
  public async createSentimentScoresTransaction(
    sentimentScoresData: Array<{
      name: string;
      value: any;
      runId: string;
      engine?: string;
    }>
  ): Promise<any[]> {
    return this.executeInTransaction(async (tx) => {
      logger.debug(
        `[Transaction] Creating ${sentimentScoresData.length} sentiment scores`
      );

      const sentimentScores = [];
      for (const scoreData of sentimentScoresData) {
        const score = await tx.sentimentScore.create({
          data: scoreData,
        });
        sentimentScores.push(score);
      }

      return sentimentScores;
    });
  }

  /**
   * Wraps competitor data updates in a transaction
   */
  public async updateCompetitorsTransaction(
    competitorUpdates: Array<{
      id: string;
      data: {
        website?: string;
        description?: string;
        traffic?: string;
        socialMedia?: any;
        updatedAt: Date;
      };
    }>
  ): Promise<any[]> {
    return this.executeInTransaction(async (tx) => {
      logger.debug(
        `[Transaction] Updating ${competitorUpdates.length} competitors`
      );

      const updatedCompetitors = [];
      for (const update of competitorUpdates) {
        const competitor = await tx.competitor.update({
          where: { id: update.id },
          data: update.data,
        });
        updatedCompetitors.push(competitor);
      }

      return updatedCompetitors;
    });
  }

  /**
   * Wraps final report completion in a transaction
   */
  public async completeReportTransaction(
    runId: string,
    updateData: {
      status: "COMPLETED" | "FAILED";
      stepStatus: string;
      tokensUsed?: number;
      usdCost?: number;
      error?: string;
    },
    metricsData?: {
      companyId: string;
      metrics: any;
    }
  ): Promise<{ reportRun: any; metricsUpdated?: boolean }> {
    return this.executeInTransaction(async (tx) => {
      logger.info(
        `[Transaction] Completing report ${runId} with status: ${updateData.status}`
      );

      // Update the report run
      // Prisma schema does not support completedAt on reportRun; rely on updatedAt
      const { /* completedAt: _ignored, */ ...safeUpdate } =
        updateData as Record<string, unknown>;
      const reportRun = await tx.reportRun.update({
        where: { id: runId },
        data: safeUpdate,
      });

      let metricsUpdated = false;

      // If metrics data is provided and status is COMPLETED, update metrics
      if (metricsData && updateData.status === "COMPLETED") {
        try {
          // Note: computeAndPersistMetrics is called outside transaction as it's a complex operation
          // We'll just mark that metrics need to be updated
          metricsUpdated = true;
        } catch (error) {
          logger.warn(
            `[Transaction] Failed to update metrics in transaction for company ${metricsData.companyId}:`,
            error
          );
          // Don't fail the transaction for metrics issues
        }
      }

      return { reportRun, metricsUpdated };
    });
  }

  /**
   * Wraps critical report status updates in a transaction with retry logic
   */
  public async updateReportStatusTransaction(
    runId: string,
    updateData: {
      status?: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
      stepStatus?: string;
      progress?: number;
      error?: string;
      tokensUsed?: number;
      usdCost?: number;
      completedAt?: Date;
    },
    maxRetries: number = 3
  ): Promise<any> {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.executeInTransaction(async (tx) => {
          return await tx.reportRun.update({
            where: { id: runId },
            data: updateData,
          });
        });
      } catch (error) {
        lastError = error;
        logger.warn(
          `[Transaction] Report status update attempt ${attempt}/${maxRetries} failed for run ${runId}:`,
          error
        );

        if (attempt < maxRetries) {
          // Wait before retrying (exponential backoff)
          await new Promise((resolve) =>
            setTimeout(resolve, 1000 * Math.pow(2, attempt - 1))
          );
        }
      }
    }

    logger.error(
      `[Transaction] All ${maxRetries} attempts failed for report status update ${runId}:`,
      lastError
    );
    throw lastError;
  }

  private generateTransactionId(): string {
    return `tx_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }

  /**
   * Health check for transaction service
   */
  public async healthCheck(): Promise<{ status: string; details?: any }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: "healthy" };
    } catch (error) {
      return {
        status: "unhealthy",
        details: {
          error: error instanceof Error ? error.message : error,
        },
      };
    }
  }
}

// Export singleton instance
export const databaseTransactionService = new DatabaseTransactionService();
