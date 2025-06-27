import { PrismaClient, Prisma } from '@prisma/client';
import { performance } from 'perf_hooks';
import { LLM_CONFIG } from '../config/models';

interface StreamedResponse {
  questionId: string;
  answer: string;
  modelId: string;
  engine: string;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
  questionType: 'visibility' | 'benchmark' | 'personal';
}

interface StreamedMention {
  position: number;
  entityId: string;
  isCompany: boolean;
}

interface WriteStats {
  responsesWritten: number;
  mentionsWritten: number;
  batchesProcessed: number;
  totalWriteTime: number;
  avgBatchTime: number;
}

interface StreamWriterConfig {
  maxBatchSize: number;
  flushIntervalMs: number;
  maxConcurrentWrites: number;
  useParallelMentionWrites: boolean;
}

export class StreamingDatabaseWriter {
  private prisma: PrismaClient;
  private runId: string;
  private companyId: string;
  private allEntities: { id: string; name: string }[];
  
  // Buffer management
  private responseBuffer: StreamedResponse[] = [];
  private mentionBuffer: Map<string, StreamedMention[]> = new Map();
  private flushTimer: NodeJS.Timeout | null = null;
  
  // Performance tracking
  private stats: WriteStats = {
    responsesWritten: 0,
    mentionsWritten: 0,
    batchesProcessed: 0,
    totalWriteTime: 0,
    avgBatchTime: 0
  };
  
  // Configuration
  private config: StreamWriterConfig;
  
  // Concurrency control & adaptive batching
  private activeWrites = 0;
  private pendingFlush = false;
  private dynamicBatchSize: number;
  private readonly MENTION_CHUNK = 500;
  
  // Circuit breaker for database failures
  private consecutiveFailures = 0;
  private readonly MAX_CONSECUTIVE_FAILURES = 5;
  private circuitBreakerOpen = false;
  private lastFailureTime = 0;
  private readonly CIRCUIT_BREAKER_TIMEOUT = 30000; // 30 seconds
  
  constructor(
    prisma: PrismaClient,
    runId: string,
    companyId: string,
    allEntities: { id: string; name: string }[],
    config: Partial<StreamWriterConfig> = {}
  ) {
    this.prisma = prisma;
    this.runId = runId;
    this.companyId = companyId;
    this.allEntities = allEntities;
    
    // Default high-performance configuration
    this.config = {
      maxBatchSize: 25, // Reduced batch size to avoid timeouts (was 50)
      flushIntervalMs: 3000, // Increased flush interval to reduce pressure (was 2000)
      maxConcurrentWrites: 1, // Reduced concurrency to avoid deadlocks (was 3)
      useParallelMentionWrites: false, // Disable parallel mentions to reduce complexity (was true)
      ...config
    };
    
    // initialise adaptive batch size with the configured max
    this.dynamicBatchSize = this.config.maxBatchSize;
    
    this.startFlushTimer();
  }
  
  /**
   * Stream a response for immediate processing
   * This is called as soon as each LLM response comes in
   */
  async streamResponse(response: StreamedResponse): Promise<void> {
    this.responseBuffer.push(response);
    
    // Process mentions immediately while response is hot in memory
    const mentions = this.findMentions(response.answer, this.allEntities);
    if (mentions.length > 0) {
      // Use a composite key to avoid overwriting mentions from different models for the same question
      const compositeKey = `${response.questionId}-${response.modelId}`;
      this.mentionBuffer.set(compositeKey, mentions);
    }
    
    // Trigger immediate flush if buffer is full
    if (this.responseBuffer.length >= this.config.maxBatchSize) {
      await this.flush();
    }
  }
  
  /**
   * Force flush all pending data - called at the end of processing
   */
  async finalize(): Promise<WriteStats> {
    this.stopFlushTimer();

    // Final flush of any remaining data with timeout protection
    const maxRetries = 10;
    let retryCount = 0;
    
    while (this.responseBuffer.length > 0 && retryCount < maxRetries) {
      const bufferLengthBefore = this.responseBuffer.length;
      
      try {
        // Attempt to flush a batch
        await this.flush();
        
        // If flush is blocked by concurrency, wait a moment before trying again
        if (this.activeWrites >= this.config.maxConcurrentWrites && this.responseBuffer.length > 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // Check if we're making progress
        if (this.responseBuffer.length === bufferLengthBefore) {
          retryCount++;
          console.warn(`[StreamingDatabaseWriter] No progress in finalize, retry ${retryCount}/${maxRetries}`);
          
          // Wait longer if no progress is being made
          await new Promise(resolve => setTimeout(resolve, 500 * retryCount));
        } else {
          retryCount = 0; // Reset retry count if we made progress
        }
      } catch (error) {
        console.error(`[StreamingDatabaseWriter] Error during finalize flush:`, error);
        retryCount++;
        
        if (retryCount >= maxRetries) {
          console.error(`[StreamingDatabaseWriter] Max retries reached, abandoning ${this.responseBuffer.length} responses`);
          break;
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
      }
    }

    // Wait for the last batch(es) to finish writing with timeout
    const maxWaitTime = 60000; // 60 seconds max wait
    const startWait = Date.now();
    
    while (this.activeWrites > 0) {
      if (Date.now() - startWait > maxWaitTime) {
        console.error(`[StreamingDatabaseWriter] Timeout waiting for active writes to complete. ${this.activeWrites} writes still active.`);
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (this.responseBuffer.length > 0) {
      console.warn(`[StreamingDatabaseWriter] Finalize completed with ${this.responseBuffer.length} responses remaining in buffer`);
    }

    return this.stats;
  }
  
  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      if (this.responseBuffer.length > 0 && !this.pendingFlush) {
        this.flush().catch(error => {
          console.error('[StreamingDatabaseWriter] Timer flush failed:', error);
        });
      }
    }, this.config.flushIntervalMs);
  }
  
  private stopFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }
  
  private async flush(): Promise<void> {
    if (this.pendingFlush || this.responseBuffer.length === 0) {
      return;
    }
    
    if (this.activeWrites >= this.config.maxConcurrentWrites) {
      return; // Wait for some writes to complete
    }
    
    // Check circuit breaker
    if (this.circuitBreakerOpen) {
      if (Date.now() - this.lastFailureTime > this.CIRCUIT_BREAKER_TIMEOUT) {
        console.log('[StreamingDatabaseWriter] Circuit breaker timeout expired, attempting to reset');
        this.circuitBreakerOpen = false;
        this.consecutiveFailures = 0;
      } else {
        console.warn('[StreamingDatabaseWriter] Circuit breaker is open, skipping flush');
        return;
      }
    }
    
    this.pendingFlush = true;
    this.activeWrites++;
    
    // pick size based on adaptive algorithm
    const batchSize = Math.min(this.dynamicBatchSize, this.responseBuffer.length);
    const batchToProcess = this.responseBuffer.splice(0, batchSize);
    const batchStartTime = performance.now();
    
    try {
      await this.processBatch(batchToProcess);
      
      const batchTime = performance.now() - batchStartTime;
      this.stats.batchesProcessed++;
      this.stats.totalWriteTime += batchTime;
      this.stats.avgBatchTime = this.stats.totalWriteTime / this.stats.batchesProcessed;
      
      // Reset circuit breaker on success
      this.consecutiveFailures = 0;
      this.circuitBreakerOpen = false;
      
      // --- adaptive batch tuning ---
      const TARGET_MS = 3000; // Increased target to 3s per batch (was 1.5s)
      if (batchTime > TARGET_MS * 1.5 && this.dynamicBatchSize > 5) {
        this.dynamicBatchSize = Math.max(5, this.dynamicBatchSize - 5); // Smaller adjustments
      } else if (batchTime < TARGET_MS * 0.5 && this.dynamicBatchSize < 50) {
        this.dynamicBatchSize += 5; // Smaller adjustments
      }
      
      console.log(`[StreamingDatabaseWriter] Batch ${this.stats.batchesProcessed} completed in ${batchTime.toFixed(2)}ms (${batchToProcess.length} responses) - Dynamic batch size: ${this.dynamicBatchSize}`);
      
    } catch (error) {
      console.error('[StreamingDatabaseWriter] Batch processing failed:', error);
      
      // Increment failure counter
      this.consecutiveFailures++;
      this.lastFailureTime = Date.now();
      
      // Open circuit breaker if too many consecutive failures
      if (this.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
        this.circuitBreakerOpen = true;
        console.error(`[StreamingDatabaseWriter] Circuit breaker opened after ${this.consecutiveFailures} consecutive failures`);
      }
      
      // Add detailed error logging
      if (error instanceof Error) {
        console.error(`[StreamingDatabaseWriter] Error details: ${error.name}: ${error.message}`);
        if (error.stack) {
          console.error(`[StreamingDatabaseWriter] Stack trace: ${error.stack.split('\n').slice(0, 5).join('\n')}`);
        }
      }
      
      // Put failed responses back in buffer for retry (only if circuit breaker is not open)
      if (!this.circuitBreakerOpen) {
        this.responseBuffer.unshift(...batchToProcess);
      } else {
        console.warn(`[StreamingDatabaseWriter] Circuit breaker open, dropping ${batchToProcess.length} responses`);
      }
      
      // Adaptive batch size reduction on errors
      if (this.dynamicBatchSize > 5) {
        this.dynamicBatchSize = Math.max(5, Math.floor(this.dynamicBatchSize * 0.7));
        console.warn(`[StreamingDatabaseWriter] Error encountered, reducing batch size to ${this.dynamicBatchSize}`);
      }
      
    } finally {
      this.activeWrites--;
      this.pendingFlush = false;
    }
  }
  
  private async processBatch(responses: StreamedResponse[]): Promise<void> {
    // Group responses by type for optimal batching
    const visibilityResponses = responses.filter(r => r.questionType === 'visibility');
    const benchmarkResponses = responses.filter(r => r.questionType === 'benchmark');
    const personalResponses = responses.filter(r => r.questionType === 'personal');
    
    // Process each type in parallel using separate transactions
    const writePromises: Promise<void>[] = [];
    
    if (visibilityResponses.length > 0) {
      writePromises.push(this.writeVisibilityResponses(visibilityResponses));
    }
    
    if (benchmarkResponses.length > 0) {
      writePromises.push(this.writeBenchmarkResponses(benchmarkResponses));
    }
    
    if (personalResponses.length > 0) {
      writePromises.push(this.writePersonalResponses(personalResponses));
    }
    
    await Promise.all(writePromises);
    this.stats.responsesWritten += responses.length;
  }
  
  private async writeVisibilityResponses(responses: StreamedResponse[]): Promise<void> {
    // ---------------- Simplified single tx approach ----------------
    const responseData = responses.map(r => ({
      visibilityQuestionId: r.questionId,
      engine: r.engine,
      model: r.modelId,
      content: r.answer,
      runId: this.runId
    }));

    await this.prisma.$transaction(async tx => {
      // Set conservative timeouts to prevent hanging
      await tx.$executeRawUnsafe("SET LOCAL statement_timeout = 60000"); // 60 seconds
      await tx.$executeRawUnsafe("SET LOCAL deadlock_timeout = '5s'");
      await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '10s'");

      // Insert responses first
      const createdResponses = await tx.visibilityResponse.createManyAndReturn({ 
        data: responseData 
      });

      // Then insert mentions sequentially to avoid complexity
      for (let i = 0; i < createdResponses.length; i++) {
        const response = createdResponses[i];
        const originalResponse = responses[i];
        const compositeKey = `${originalResponse.questionId}-${originalResponse.modelId}`;
        const mentions = this.mentionBuffer.get(compositeKey) || [];
        
        if (mentions.length > 0) {
          // Process mentions in smaller chunks to avoid large transactions
          for (let j = 0; j < mentions.length; j += this.MENTION_CHUNK) {
            const mentionChunk = mentions.slice(j, j + this.MENTION_CHUNK);
            const mentionData = mentionChunk.map(mention => ({
              visibilityResponseId: response.id,
              position: mention.position,
              ...(mention.isCompany ? { companyId: mention.entityId } : { competitorId: mention.entityId })
            }));
            
            await tx.visibilityMention.createMany({ data: mentionData });
          }
          this.stats.mentionsWritten += mentions.length;
        }
      }
    }, {
      maxWait: LLM_CONFIG.TIMEOUTS.STREAMING_BATCH_MAX_WAIT,
      timeout: LLM_CONFIG.TIMEOUTS.STREAMING_BATCH_TIMEOUT,
      isolationLevel: 'ReadCommitted' // Use less strict isolation to reduce deadlocks
    });
  }
  
  private async writeBenchmarkResponses(responses: StreamedResponse[]): Promise<void> {
    const responseData = responses.map(r => ({
      benchmarkQuestionId: r.questionId,
      engine: r.engine,
      model: r.modelId,
      content: r.answer,
      runId: this.runId
    }));

    await this.prisma.$transaction(async tx => {
      // Set conservative timeouts to prevent hanging
      await tx.$executeRawUnsafe("SET LOCAL statement_timeout = 60000"); // 60 seconds
      await tx.$executeRawUnsafe("SET LOCAL deadlock_timeout = '5s'");
      await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '10s'");

      // Insert responses first
      const createdResponses = await tx.benchmarkResponse.createManyAndReturn({ 
        data: responseData 
      });

      // Then insert mentions sequentially
      for (let i = 0; i < createdResponses.length; i++) {
        const response = createdResponses[i];
        const originalResponse = responses[i];
        const compositeKey = `${originalResponse.questionId}-${originalResponse.modelId}`;
        const mentions = this.mentionBuffer.get(compositeKey) || [];
        
        if (mentions.length > 0) {
          for (let j = 0; j < mentions.length; j += this.MENTION_CHUNK) {
            const mentionChunk = mentions.slice(j, j + this.MENTION_CHUNK);
            const mentionData = mentionChunk.map(mention => ({
              benchmarkResponseId: response.id,
              position: mention.position,
              ...(mention.isCompany ? { companyId: mention.entityId } : { competitorId: mention.entityId })
            }));
            
            await tx.benchmarkMention.createMany({ data: mentionData });
          }
          this.stats.mentionsWritten += mentions.length;
        }
      }
    }, {
      maxWait: LLM_CONFIG.TIMEOUTS.STREAMING_BATCH_MAX_WAIT,
      timeout: LLM_CONFIG.TIMEOUTS.STREAMING_BATCH_TIMEOUT,
      isolationLevel: 'ReadCommitted'
    });
  }
  
  private async writePersonalResponses(responses: StreamedResponse[]): Promise<void> {
    const responseData = responses.map(r => ({
      personalQuestionId: r.questionId,
      engine: r.engine,
      model: r.modelId,
      content: r.answer,
      runId: this.runId
    }));

    await this.prisma.$transaction(async tx => {
      // Set conservative timeouts to prevent hanging
      await tx.$executeRawUnsafe("SET LOCAL statement_timeout = 60000"); // 60 seconds
      await tx.$executeRawUnsafe("SET LOCAL deadlock_timeout = '5s'");
      await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '10s'");

      // Insert responses first
      const createdResponses = await tx.personalResponse.createManyAndReturn({ 
        data: responseData 
      });

      // Then insert mentions sequentially
      for (let i = 0; i < createdResponses.length; i++) {
        const response = createdResponses[i];
        const originalResponse = responses[i];
        const compositeKey = `${originalResponse.questionId}-${originalResponse.modelId}`;
        const mentions = this.mentionBuffer.get(compositeKey) || [];
        
        if (mentions.length > 0) {
          for (let j = 0; j < mentions.length; j += this.MENTION_CHUNK) {
            const mentionChunk = mentions.slice(j, j + this.MENTION_CHUNK);
            const mentionData = mentionChunk.map(mention => ({
              personalResponseId: response.id,
              position: mention.position,
              ...(mention.isCompany ? { companyId: mention.entityId } : { competitorId: mention.entityId })
            }));
            
            await tx.personalMention.createMany({ data: mentionData });
          }
          this.stats.mentionsWritten += mentions.length;
        }
      }
    }, {
      maxWait: LLM_CONFIG.TIMEOUTS.STREAMING_BATCH_MAX_WAIT,
      timeout: LLM_CONFIG.TIMEOUTS.STREAMING_BATCH_TIMEOUT,
      isolationLevel: 'ReadCommitted'
    });
  }
  
  /**
   * Extract mentions based solely on explicit <brand> tags.
   * If no valid <brand> tags are present, no mentions are recorded.
   */
  private findMentions(text: string, entities: { id: string; name: string }[]): StreamedMention[] {
    const brandTagRegex = /<brand>(.*?)<\/brand>/gi;
    const taggedMentions: { name: string, index: number }[] = [];
    let match;

    while ((match = brandTagRegex.exec(text)) !== null) {
      taggedMentions.push({ name: match[1].trim(), index: match.index });
    }

    // --- Strategy 1: Use <brand> tags if they exist ---
    if (taggedMentions.length > 0) {
      const uniqueMentions = new Map<string, StreamedMention>();
      let position = 1;

      // Sort tagged mentions by their appearance order
      taggedMentions.sort((a, b) => a.index - b.index);

      // Create a map of normalized entity names to their IDs
      const entityMap = new Map<string, string>();
      for (const entity of entities) {
        // This simple normalization should be sufficient as we rely on the LLM's spelling.
        entityMap.set(entity.name.toLowerCase().trim(), entity.id);
      }
      
      for (const tagged of taggedMentions) {
        const taggedNameLower = tagged.name.toLowerCase().trim();
        const entityId = entityMap.get(taggedNameLower);

        if (entityId && !uniqueMentions.has(entityId)) {
          uniqueMentions.set(entityId, {
            position: position++,
            entityId: entityId,
            isCompany: entityId === this.companyId
          });
        }
      }
      
      // If we found valid, known entities in the tags, return them.
      if (uniqueMentions.size > 0) {
        return Array.from(uniqueMentions.values());
      }
    }

    // No <brand> tags found or no matching entities identified; skip mention detection.
    return [];
  }
  
  private escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
} 