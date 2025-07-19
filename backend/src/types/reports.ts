/**
 * @file reports.ts
 * @description This file defines various interfaces related to reports, including `Question` for different types of questions,
 * `MentionDetectionResult` for detailed statistics on brand mentions, `Entity` for entities involved in mention detection,
 * and `MentionDetectionConfig` for configuring the mention detection process. These types are crucial for maintaining data
 * consistency and clarity throughout the report generation and analysis pipeline.
 *
 * @exports
 * - Question: Interface for different types of questions within a report.
 * - MentionDetectionResult: Interface for the result of mention detection, including statistics and entity-specific data.
 * - Entity: Interface for an entity (company or competitor) used in mention detection.
 * - MentionDetectionConfig: Interface for configuring the mention detection process.
 */
export interface Question {
  id: string;
  text: string;
  type: "benchmark" | "fanout";
  fanoutType?: string;
  sourceModel?: string;
}

// Enhanced mention detection result for debugging and analytics
export interface MentionDetectionResult {
  totalMentionsFound: number;
  uniqueEntitiesFound: number;
  confidenceDistribution: {
    high: number; // confidence >= 0.9
    medium: number; // confidence 0.7-0.89
    low: number; // confidence < 0.7
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
