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
  
  // Concurrency control
  private activeWrites = 0;
  private pendingFlush = false;
  
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
      maxBatchSize: 50, // Optimal batch size to avoid timeouts
      flushIntervalMs: 2000, // Flush every 2 seconds
      maxConcurrentWrites: 3, // Multiple concurrent transactions
      useParallelMentionWrites: true, // Parallel mention processing
      ...config
    };
    
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

    // Final flush of any remaining data
    while (this.responseBuffer.length > 0) {
      // Attempt to flush a batch
      await this.flush();

      // If flush is blocked by concurrency, wait a moment before trying again
      if (this.activeWrites >= this.config.maxConcurrentWrites && this.responseBuffer.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    // Wait for the last batch(es) to finish writing
    while (this.activeWrites > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
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
    
    this.pendingFlush = true;
    this.activeWrites++;
    
    const batchToProcess = this.responseBuffer.splice(0, this.config.maxBatchSize);
    const batchStartTime = performance.now();
    
    try {
      await this.processBatch(batchToProcess);
      
      const batchTime = performance.now() - batchStartTime;
      this.stats.batchesProcessed++;
      this.stats.totalWriteTime += batchTime;
      this.stats.avgBatchTime = this.stats.totalWriteTime / this.stats.batchesProcessed;
      
      console.log(`[StreamingDatabaseWriter] Batch ${this.stats.batchesProcessed} completed in ${batchTime.toFixed(2)}ms (${batchToProcess.length} responses)`);
      
    } catch (error) {
      console.error('[StreamingDatabaseWriter] Batch processing failed:', error);
      // Put failed responses back in buffer for retry
      this.responseBuffer.unshift(...batchToProcess);
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
    const transaction = async (tx: Prisma.TransactionClient) => {
      // Prepare bulk data for createMany
      const responseData = responses.map(r => ({
        visibilityQuestionId: r.questionId,
        engine: r.engine,
        model: r.modelId,
        content: r.answer,
        runId: this.runId
      }));
      
      // Single bulk insert for all responses
      const createdResponses = await tx.visibilityResponse.createManyAndReturn({
        data: responseData
      });
      
      // Process mentions in parallel if enabled
      if (this.config.useParallelMentionWrites) {
        await this.writeVisibilityMentionsParallel(tx, createdResponses, responses);
      } else {
        await this.writeVisibilityMentionsSequential(tx, createdResponses, responses);
      }
    };
    
    await this.prisma.$transaction(transaction, {
      maxWait: LLM_CONFIG.TIMEOUTS.STREAMING_BATCH_MAX_WAIT,
      timeout: LLM_CONFIG.TIMEOUTS.STREAMING_BATCH_TIMEOUT,
    });
  }
  
  private async writeBenchmarkResponses(responses: StreamedResponse[]): Promise<void> {
    const transaction = async (tx: Prisma.TransactionClient) => {
      const responseData = responses.map(r => ({
        benchmarkQuestionId: r.questionId,
        engine: r.engine,
        model: r.modelId,
        content: r.answer,
        runId: this.runId
      }));
      
      const createdResponses = await tx.benchmarkResponse.createManyAndReturn({
        data: responseData
      });
      
      if (this.config.useParallelMentionWrites) {
        await this.writeBenchmarkMentionsParallel(tx, createdResponses, responses);
      } else {
        await this.writeBenchmarkMentionsSequential(tx, createdResponses, responses);
      }
    };
    
    await this.prisma.$transaction(transaction, {
      maxWait: LLM_CONFIG.TIMEOUTS.STREAMING_BATCH_MAX_WAIT,
      timeout: LLM_CONFIG.TIMEOUTS.STREAMING_BATCH_TIMEOUT,
    });
  }
  
  private async writePersonalResponses(responses: StreamedResponse[]): Promise<void> {
    const transaction = async (tx: Prisma.TransactionClient) => {
      const responseData = responses.map(r => ({
        personalQuestionId: r.questionId,
        engine: r.engine,
        model: r.modelId,
        content: r.answer,
        runId: this.runId
      }));
      
      const createdResponses = await tx.personalResponse.createManyAndReturn({
        data: responseData
      });
      
      if (this.config.useParallelMentionWrites) {
        await this.writePersonalMentionsParallel(tx, createdResponses, responses);
      } else {
        await this.writePersonalMentionsSequential(tx, createdResponses, responses);
      }
    };
    
    await this.prisma.$transaction(transaction, {
      maxWait: LLM_CONFIG.TIMEOUTS.STREAMING_BATCH_MAX_WAIT,
      timeout: LLM_CONFIG.TIMEOUTS.STREAMING_BATCH_TIMEOUT,
    });
  }
  
  private async writeVisibilityMentionsParallel(
    tx: Prisma.TransactionClient, 
    createdResponses: any[], 
    originalResponses: StreamedResponse[]
  ): Promise<void> {
    const mentionPromises = createdResponses.map(async (response, index) => {
      const originalResponse = originalResponses[index];
      const compositeKey = `${originalResponse.questionId}-${originalResponse.modelId}`;
      const mentions = this.mentionBuffer.get(compositeKey) || [];
      if (mentions.length === 0) return;
      
      const mentionData = mentions.map(mention => ({
        visibilityResponseId: response.id,
        position: mention.position,
        ...(mention.isCompany 
          ? { companyId: mention.entityId } 
          : { competitorId: mention.entityId })
      }));
      
      await tx.visibilityMention.createMany({ data: mentionData });
      this.stats.mentionsWritten += mentionData.length;
    });
    
    await Promise.all(mentionPromises);
  }
  
  private async writeBenchmarkMentionsParallel(
    tx: Prisma.TransactionClient, 
    createdResponses: any[], 
    originalResponses: StreamedResponse[]
  ): Promise<void> {
    const mentionPromises = createdResponses.map(async (response, index) => {
      const originalResponse = originalResponses[index];
      const compositeKey = `${originalResponse.questionId}-${originalResponse.modelId}`;
      const mentions = this.mentionBuffer.get(compositeKey) || [];
      if (mentions.length === 0) return;
      
      const mentionData = mentions.map(mention => ({
        benchmarkResponseId: response.id,
        position: mention.position,
        ...(mention.isCompany 
          ? { companyId: mention.entityId } 
          : { competitorId: mention.entityId })
      }));
      
      await tx.benchmarkMention.createMany({ data: mentionData });
      this.stats.mentionsWritten += mentionData.length;
    });
    
    await Promise.all(mentionPromises);
  }
  
  private async writePersonalMentionsParallel(
    tx: Prisma.TransactionClient, 
    createdResponses: any[], 
    originalResponses: StreamedResponse[]
  ): Promise<void> {
    const mentionPromises = createdResponses.map(async (response, index) => {
      const originalResponse = originalResponses[index];
      const compositeKey = `${originalResponse.questionId}-${originalResponse.modelId}`;
      const mentions = this.mentionBuffer.get(compositeKey) || [];
      if (mentions.length === 0) return;
      
      const mentionData = mentions.map(mention => ({
        personalResponseId: response.id,
        position: mention.position,
        ...(mention.isCompany 
          ? { companyId: mention.entityId } 
          : { competitorId: mention.entityId })
      }));
      
      await tx.personalMention.createMany({ data: mentionData });
      this.stats.mentionsWritten += mentionData.length;
    });
    
    await Promise.all(mentionPromises);
  }
  
  private async writeVisibilityMentionsSequential(
    tx: Prisma.TransactionClient, 
    createdResponses: any[], 
    originalResponses: StreamedResponse[]
  ): Promise<void> {
    for (let i = 0; i < createdResponses.length; i++) {
      const response = createdResponses[i];
      const originalResponse = originalResponses[i];
      const compositeKey = `${originalResponse.questionId}-${originalResponse.modelId}`;
      const mentions = this.mentionBuffer.get(compositeKey) || [];
      if (mentions.length === 0) continue;
      
      const mentionData = mentions.map(mention => ({
        visibilityResponseId: response.id,
        position: mention.position,
        ...(mention.isCompany 
          ? { companyId: mention.entityId } 
          : { competitorId: mention.entityId })
      }));
      
      await tx.visibilityMention.createMany({ data: mentionData });
      this.stats.mentionsWritten += mentionData.length;
    }
  }
  
  private async writeBenchmarkMentionsSequential(
    tx: Prisma.TransactionClient, 
    createdResponses: any[], 
    originalResponses: StreamedResponse[]
  ): Promise<void> {
    for (let i = 0; i < createdResponses.length; i++) {
      const response = createdResponses[i];
      const originalResponse = originalResponses[i];
      const compositeKey = `${originalResponse.questionId}-${originalResponse.modelId}`;
      const mentions = this.mentionBuffer.get(compositeKey) || [];
      if (mentions.length === 0) continue;
      
      const mentionData = mentions.map(mention => ({
        benchmarkResponseId: response.id,
        position: mention.position,
        ...(mention.isCompany 
          ? { companyId: mention.entityId } 
          : { competitorId: mention.entityId })
      }));
      
      await tx.benchmarkMention.createMany({ data: mentionData });
      this.stats.mentionsWritten += mentionData.length;
    }
  }
  
  private async writePersonalMentionsSequential(
    tx: Prisma.TransactionClient, 
    createdResponses: any[], 
    originalResponses: StreamedResponse[]
  ): Promise<void> {
    for (let i = 0; i < createdResponses.length; i++) {
      const response = createdResponses[i];
      const originalResponse = originalResponses[i];
      const compositeKey = `${originalResponse.questionId}-${originalResponse.modelId}`;
      const mentions = this.mentionBuffer.get(compositeKey) || [];
      if (mentions.length === 0) continue;
      
      const mentionData = mentions.map(mention => ({
        personalResponseId: response.id,
        position: mention.position,
        ...(mention.isCompany 
          ? { companyId: mention.entityId } 
          : { competitorId: mention.entityId })
      }));
      
      await tx.personalMention.createMany({ data: mentionData });
      this.stats.mentionsWritten += mentionData.length;
    }
  }
  
  /**
   * Enhanced mention extraction with comprehensive entity recognition
   * Prioritizes <brand> tags and falls back to regex-based detection if they are not present.
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

    // --- Strategy 2: Fallback to Regex if no valid <brand> tags were found ---
    // This provides backward compatibility and a safety net for non-compliant LLM responses.
    console.warn(`[StreamingDatabaseWriter] No valid <brand> tags found in response. Falling back to regex-based mention detection. RunID: ${this.runId}`);

    // Step 1: Find all potential mentions with their exact positions
    const allPossibleMentions: {
      id: string;
      originalName: string;
      matchedName: string;
      index: number;
      endIndex: number;
      variation: string;
      confidence: number;
    }[] = [];

    for (const entity of entities) {
      if (!entity.name || entity.name.length < 2) continue;

      const variations = this.generateComprehensiveNameVariations(entity.name);

      for (const variation of variations) {
        const trimmedVariation = variation.trim();
        if (trimmedVariation.length < 2) continue;

        try {
          // Enhanced regex patterns for different contexts
          const patterns = [
            // Standard word boundaries (highest confidence)
            { pattern: `\\b${this.escapeRegex(trimmedVariation)}\\b`, confidence: 1.0 },
            // Followed by punctuation (high confidence)
            { pattern: `${this.escapeRegex(trimmedVariation)}(?=[.,;:!?\\s])`, confidence: 0.9 },
            // In quotes or parentheses (medium-high confidence)
            { pattern: `["\\"\\(]\\s*${this.escapeRegex(trimmedVariation)}\\s*["\\"\\)]`, confidence: 0.8 },
            // After "like" or "such as" (medium confidence)
            { pattern: `(?:like|such as|including)\\s+${this.escapeRegex(trimmedVariation)}`, confidence: 0.7 }
          ];

          for (const { pattern, confidence } of patterns) {
            const regex = new RegExp(pattern, 'gi');
            let match;
            while ((match = regex.exec(text))) {
              if (match !== null) {
                allPossibleMentions.push({
                  id: entity.id,
                  originalName: entity.name,
                  matchedName: match[0],
                  index: match.index,
                  endIndex: match.index + match[0].length,
                  variation: trimmedVariation,
                  confidence
                });
              }
            }
          }
        } catch (e) {
          console.error(`Error creating regex for variation: "${variation}"`, e);
        }
      }
    }

    // Step 2: Resolve overlapping mentions using advanced logic
    const resolvedMentions: {
      id: string;
      name: string;
      index: number;
      endIndex: number;
      confidence: number;
    }[] = [];

    // Group mentions by overlapping positions
    const mentionsByLocation = new Map<string, typeof allPossibleMentions>();
    for (const mention of allPossibleMentions) {
      // Create a more precise key that captures overlaps
      const key = `${mention.index}-${mention.endIndex}`;
      if (!mentionsByLocation.has(key)) {
        mentionsByLocation.set(key, []);
      }
      mentionsByLocation.get(key)!.push(mention);
    }

    // Resolve conflicts within exact same positions
    for (const candidates of mentionsByLocation.values()) {
      if (candidates.length === 1) {
        const mention = candidates[0];
        resolvedMentions.push({
          id: mention.id,
          name: mention.matchedName,
          index: mention.index,
          endIndex: mention.endIndex,
          confidence: mention.confidence
        });
      } else {
        // Multiple candidates at same position - choose best one
        candidates.sort((a, b) => {
          // Prioritize: confidence > original name length > matched name length
          if (a.confidence !== b.confidence) return b.confidence - a.confidence;
          if (a.originalName.length !== b.originalName.length) return b.originalName.length - a.originalName.length;
          return b.matchedName.length - a.matchedName.length;
        });
        
        const bestMatch = candidates[0];
        resolvedMentions.push({
          id: bestMatch.id,
          name: bestMatch.matchedName,
          index: bestMatch.index,
          endIndex: bestMatch.endIndex,
          confidence: bestMatch.confidence
        });
      }
    }

    // Step 3: Remove overlapping mentions (prefer longer, higher confidence)
    resolvedMentions.sort((a, b) => {
      // Sort by confidence first, then by length
      if (a.confidence !== b.confidence) return b.confidence - a.confidence;
      return b.name.length - a.name.length;
    });

    const finalMentions: typeof resolvedMentions = [];
    for (const mention of resolvedMentions) {
      const isOverlapped = finalMentions.some(final => 
        // Check for any overlap
        !(mention.endIndex <= final.index || mention.index >= final.endIndex)
      );
      
      if (!isOverlapped) {
        finalMentions.push(mention);
      }
    }

    // Step 4: Sort by position and assign ranking positions
    finalMentions.sort((a, b) => a.index - b.index);

    // Step 5: Create unique mentions with proper position ranking
    const uniqueMentions: StreamedMention[] = [];
    const seenEntities = new Set<string>();

    let currentPosition = 1;
    for (const mention of finalMentions) {
      if (!seenEntities.has(mention.id)) {
        uniqueMentions.push({
          position: currentPosition++,
          entityId: mention.id,
          isCompany: mention.id === this.companyId
        });
        seenEntities.add(mention.id);
      }
    }

    return uniqueMentions;
  }
  
  /**
   * Generate comprehensive name variations for robust entity matching
   * Handles corporate suffixes, common abbreviations, brands, and acronyms
   */
  private generateComprehensiveNameVariations(name: string): Set<string> {
    const variations = new Set<string>();
    variations.add(name);
    
    const lowerCaseName = name.toLowerCase();

    // 1. Remove corporate suffixes (more comprehensive)
    const corporateSuffixes = [
      'llc', 'inc', 'corp', 'corporation', 'company', 'co', 'ltd', 'limited',
      'enterprises', 'group', 'holdings', 'international', 'worldwide', 'global',
      'solutions', 'systems', 'technologies', 'tech', 'labs', 'laboratory',
      'stores', 'store', 'shops', 'shop', 'retail', 'mart', 'market', 'depot'
    ];
    
    for (const suffix of corporateSuffixes) {
      const patterns = [
        new RegExp(`\\s*,?\\s*${suffix}\\.?$`, 'i'),
        new RegExp(`\\s+${suffix}\\.?$`, 'i')
      ];
      
      for (const pattern of patterns) {
        if (pattern.test(name)) {
          const withoutSuffix = name.replace(pattern, '').trim();
          if (withoutSuffix && withoutSuffix !== name) {
            variations.add(withoutSuffix);
          }
        }
      }
    }

    // 2. Handle location-based names ("Company of Location")
    if (lowerCaseName.includes(' of ')) {
      const parts = name.split(/\s+of\s+/i);
      if (parts.length > 1) {
        variations.add(parts[0].trim());
      }
    }

    // 3. Symbol and punctuation variations
    const baseVariations = Array.from(variations);
    for (const base of baseVariations) {
      // Replace & with "and" and vice versa
      if (base.includes('&')) {
        variations.add(base.replace(/&/g, 'and'));
        variations.add(base.replace(/\s*&\s*/g, ' and '));
      }
      if (base.includes(' and ')) {
        variations.add(base.replace(/\s+and\s+/g, ' & '));
      }
      
      // Remove dots, hyphens, and other punctuation
      if (/[.\-''""]/.test(base)) {
        variations.add(base.replace(/[.\-''""/]/g, ''));
        variations.add(base.replace(/[.\-]/g, ' '));
      }
    }

    // 4. Generate acronyms for multi-word companies
    const words = name.split(/\s+/).filter(word => 
      word.length > 1 && 
      !corporateSuffixes.includes(word.toLowerCase().replace(/[.,]/g, ''))
    );
    
    if (words.length >= 2 && words.length <= 5) {
      const acronym = words.map(word => word[0]).join('').toUpperCase();
      if (acronym.length >= 2) {
        variations.add(acronym);
        // Also add with dots (e.g., "I.B.M.")
        variations.add(acronym.split('').join('.'));
      }
    }

    // 5. Handle common business name patterns
    const commonPatterns = [
      // "The Company Name" -> "Company Name"
      /^the\s+/i,
      // "Company Name Inc" -> "Company Name"
      /\s+(inc|llc|corp)\.?$/i
    ];
    
    const currentVariations = Array.from(variations);
    for (const variation of currentVariations) {
      for (const pattern of commonPatterns) {
        if (pattern.test(variation)) {
          const cleaned = variation.replace(pattern, '').trim();
          if (cleaned && cleaned !== variation) {
            variations.add(cleaned);
          }
        }
      }
    }

    // 6. Filter out variations that are too short or common words
    const commonWords = new Set(['the', 'and', 'or', 'of', 'for', 'in', 'on', 'at', 'to', 'a', 'an', 'ross', 'gap', 'target', 'best', 'old', 'new']);
    const filteredVariations = new Set<string>();
    
    for (const variation of variations) {
      const trimmed = variation.trim();
      // Increase minimum length to 4 for variations without corporate suffixes
      // This prevents matching very short words like "Ross", "Gap", etc.
      const minLength = variation === name ? 2 : 4; // Keep original name even if short
      if (trimmed.length >= minLength && !commonWords.has(trimmed.toLowerCase())) {
        filteredVariations.add(trimmed);
      }
    }

    return filteredVariations;
  }
  
  private escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
} 