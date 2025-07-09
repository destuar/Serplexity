export interface Question {
    id: string;
    text: string;
    type: 'benchmark' | 'fanout';
    fanoutType?: string;
    sourceModel?: string;
}

// Enhanced mention detection result for debugging and analytics
export interface MentionDetectionResult {
    totalMentionsFound: number;
    uniqueEntitiesFound: number;
    confidenceDistribution: {
        high: number;    // confidence >= 0.9
        medium: number;  // confidence 0.7-0.89
        low: number;     // confidence < 0.7
    };
    patternMatches: {
        wordBoundary: number;
        punctuation: number;
        quoted: number;
        contextual: number;
    };
    entitiesByMentionCount: Array<{
        entityId: string;
        entityName: string;
        mentionCount: number;
        averagePosition: number;
        averageConfidence: number;
    }>;
}

// Enhanced entity for mention detection
export interface Entity {
    id: string;
    name: string;
    variations?: string[];
    isCompany?: boolean;
}

// Mention detection configuration
export interface MentionDetectionConfig {
    enableContextualPatterns: boolean;
    enableAcronymGeneration: boolean;
    enableCorporateSuffixRemoval: boolean;
    minConfidenceThreshold: number;
    maxVariationsPerEntity: number;
    debugMode: boolean;
} 