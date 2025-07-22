"""
PydanticAI Agents Package

This package contains Python-based PydanticAI agents that provide structured
output and multi-provider support for the Serplexity application.

Core Agents (aligned with models.ts tasks):
1. WebSearchSentimentAgent - Sentiment scores with web search
2. SentimentSummaryAgent - Sentiment summary generation
3. IntelligentFanoutAgent - Intelligent fanout query generation
4. QuestionAnsweringAgent - Question answering with web search
5. WebsiteEnrichmentAgent - Website enrichment for competitors

Each agent is designed to be:
- Stateless and process-safe
- Type-safe with comprehensive Pydantic models
- Resilient with automatic retries and fallbacks
- Observable with detailed logging and metrics
"""

__version__ = "1.0.0"
__author__ = "Serplexity Team"

# Import minimal exports to avoid circular import issues
# Individual agents can be imported directly when needed

__all__ = []