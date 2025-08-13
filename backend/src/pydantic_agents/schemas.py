"""
Pydantic Models for Serplexity LLM Operations

This module defines all Pydantic models used for structured output validation
in PydanticAI agents. These models ensure type safety and consistent data
structures across all LLM operations.

Models are organized by domain:
- Sentiment Analysis
- Fanout Query Generation
- Website Enrichment
- Optimization Tasks
- Question Answering

Each model includes:
- Comprehensive field validation
- Clear documentation
- Example data for testing
- Backward compatibility with existing Zod schemas
"""

from pydantic import BaseModel, Field, validator, root_validator, model_validator
from typing import List, Optional, Dict, Any, Union, Literal
from enum import Enum
from datetime import datetime
import re
import uuid

# ===== WEB SEARCH METADATA MODELS =====

class WebSearchQuery(BaseModel):
    """Individual web search query with metadata"""
    query: str = Field(..., description="The search query used")
    provider: str = Field(..., description="Search provider (openai, anthropic, gemini, perplexity)")
    results_count: int = Field(ge=0, description="Number of results returned")
    search_timestamp: datetime = Field(default_factory=datetime.now, description="When the search was performed")

class WebSearchSource(BaseModel):
    """Web search source information"""
    title: str = Field(..., description="Title of the source")
    url: str = Field(..., description="URL of the source")
    domain: str = Field(..., description="Domain of the source")
    snippet: str = Field(..., description="Snippet or description from the source")
    relevance_score: float = Field(ge=0.0, le=1.0, description="Relevance score of the source")

class WebSearchMetadata(BaseModel):
    """Metadata for web search operations"""
    search_enabled: bool = Field(..., description="Whether web search was enabled")
    queries_performed: List[WebSearchQuery] = Field(default_factory=list, description="List of search queries performed")
    sources_found: List[WebSearchSource] = Field(default_factory=list, description="List of sources found")
    total_searches: int = Field(ge=0, description="Total number of searches performed")
    search_duration_ms: float = Field(ge=0.0, description="Total time spent searching in milliseconds")
    provider_used: str = Field(..., description="Primary provider used for search")
    search_session_id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="Unique identifier for this search session")

# ===== SENTIMENT ANALYSIS MODELS =====

class SentimentRating(BaseModel):
    """
    Individual sentiment rating for a specific aspect of a company.

    Attributes:
        quality: Product/service quality rating (1-10)
        priceValue: Price-to-value ratio rating (1-10)
        brandReputation: Brand reputation rating (1-10)
        brandTrust: Brand trustworthiness rating (1-10)
        customerService: Customer service quality rating (1-10)
        summaryDescription: Brief description of the sentiment
    """
    quality: int = Field(
        ...,
        ge=1,
        le=10,
        description="Product/service quality rating from 1 (poor) to 10 (excellent)"
    )
    priceValue: int = Field(
        ...,
        ge=1,
        le=10,
        description="Price-to-value ratio rating from 1 (poor value) to 10 (excellent value)"
    )
    brandReputation: int = Field(
        ...,
        ge=1,
        le=10,
        description="Brand reputation rating from 1 (poor) to 10 (excellent)"
    )
    brandTrust: int = Field(
        ...,
        ge=1,
        le=10,
        description="Brand trustworthiness rating from 1 (poor) to 10 (excellent)"
    )
    customerService: int = Field(
        ...,
        ge=1,
        le=10,
        description="Customer service quality rating from 1 (poor) to 10 (excellent)"
    )
    summaryDescription: str = Field(
        ...,
        min_length=10,
        max_length=1000,
        description="Detailed description of the overall sentiment"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "quality": 8,
                "priceValue": 7,
                "brandReputation": 9,
                "brandTrust": 8,
                "customerService": 6,
                "summaryDescription": "High-quality product with strong brand reputation, though customer service could be improved"
            }
        }

class SentimentScores(BaseModel):
    """
    Complete sentiment analysis for a company with web search metadata.

    Attributes:
        companyName: Name of the company being analyzed
        industry: Industry sector of the company
        ratings: List of sentiment ratings from different sources
        webSearchMetadata: Metadata about web search operations performed
    """
    companyName: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Name of the company being analyzed"
    )
    industry: str = Field(
        ...,
        min_length=1,
        max_length=50,
        description="Industry sector of the company"
    )
    ratings: List[SentimentRating] = Field(
        ...,
        min_items=1,
        max_items=50,
        description="List of sentiment ratings from different sources"
    )
    webSearchMetadata: Optional[WebSearchMetadata] = Field(
        default=None,
        description="Metadata about web search operations performed during analysis"
    )

    @validator('companyName')
    def validate_company_name(cls, v):
        """Validate company name format"""
        if not v.strip():
            raise ValueError('Company name cannot be empty')
        return v.strip()

    @validator('industry')
    def validate_industry(cls, v):
        """Validate industry format"""
        if not v.strip():
            raise ValueError('Industry cannot be empty')
        return v.strip().title()

    class Config:
        json_schema_extra = {
            "example": {
                "companyName": "Apple Inc.",
                "industry": "Technology",
                "ratings": [
                    {
                        "quality": 9,
                        "priceValue": 6,
                        "brandReputation": 10,
                        "brandTrust": 9,
                        "customerService": 7,
                        "summaryDescription": "Premium products with excellent design and strong brand loyalty"
                    }
                ]
            }
        }

# ===== FANOUT QUERY GENERATION MODELS =====

class QueryType(str, Enum):
    """Types of queries for fanout generation"""
    PARAPHRASE = "paraphrase"
    COMPARISON = "comparison"
    TEMPORAL = "temporal"
    TOPICAL = "topical"
    ENTITY_BROADER = "entity_broader"
    ENTITY_NARROWER = "entity_narrower"
    SESSION_CONTEXT = "session_context"
    USER_PROFILE = "user_profile"
    VERTICAL = "vertical"
    SAFETY_PROBE = "safety_probe"

class PurchaseIntent(str, Enum):
    """Purchase intent levels for queries"""
    AWARENESS = "awareness"
    CONSIDERATION = "consideration"
    PURCHASE = "purchase"

class FanoutQuery(BaseModel):
    """
    Individual query for fanout generation.

    Attributes:
        query: The actual query text
        type: Type of query (paraphrase, comparison, etc.)
        intent: Purchase intent level (awareness, consideration, purchase)
    """
    query: str = Field(
        ...,
        min_length=5,
        max_length=200,
        description="The actual query text"
    )
    type: QueryType = Field(
        ...,
        description="Type of query for categorization"
    )
    intent: PurchaseIntent = Field(
        ...,
        description="Purchase intent level of the query"
    )

    @validator('query')
    def validate_query(cls, v):
        """Validate query format"""
        v = v.strip()
        if not v:
            raise ValueError('Query cannot be empty')
        # Ensure query ends with question mark or is a statement
        if not (v.endswith('?') or any(word in v.lower() for word in ['best', 'compare', 'vs', 'versus', 'alternative'])):
            v += '?'
        return v

    class Config:
        json_schema_extra = {
            "example": {
                "query": "What are the best project management tools for remote teams?",
                "type": "paraphrase",
                "intent": "consideration"
            }
        }

class QueryTypeSelection(BaseModel):
    """Query type with rationale for why it was selected"""
    query_type: QueryType = Field(..., description="Selected query type")
    rationale: str = Field(..., min_length=10, max_length=200, description="Why this query type is relevant")
    priority: int = Field(..., ge=1, le=5, description="Priority for this query type")

class FanoutQueryGeneration(BaseModel):
    """
    Complete fanout query generation result.

    Attributes:
        companyName: Name of the company
        industry: Industry context
        baseQuestion: Original benchmark question that informed generation
        selectedQueryTypes: The 3-5 most relevant query types selected
        queries: Generated queries (one per selected type)
        totalQueries: Total number of queries generated (3-5)
        generationTimestamp: When the queries were generated
    """
    companyName: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Name of the company"
    )
    industry: str = Field(
        ...,
        min_length=1,
        max_length=50,
        description="Industry context for query generation"
    )
    baseQuestion: str = Field(
        ...,
        min_length=5,
        max_length=500,
        description="Original benchmark question that informed generation"
    )
    selectedQueryTypes: List[QueryTypeSelection] = Field(
        ...,
        min_items=3,
        max_items=5,
        description="The 3-5 most relevant query types selected with rationale"
    )
    queries: List[FanoutQuery] = Field(
        ...,
        min_items=3,
        max_items=5,
        description="Generated queries (one per selected type)"
    )
    totalQueries: int = Field(
        ...,
        ge=3,
        le=5,
        description="Total number of queries generated (3-5)"
    )
    generationTimestamp: datetime = Field(
        default_factory=datetime.now,
        description="When the queries were generated"
    )

    @model_validator(mode='before')
    def validate_total_queries(cls, values):
        """Validate that totalQueries matches actual query count"""
        if isinstance(values, dict):
            queries = values.get('queries', [])
            total = values.get('totalQueries', 0)
            if len(queries) != total:
                values['totalQueries'] = len(queries)
        return values

    class Config:
        json_schema_extra = {
            "example": {
                "companyName": "Slack",
                "industry": "Communication Software",
                "baseQuestion": "What are the best team communication tools for remote work?",
                "selectedQueryTypes": [
                    {
                        "query_type": "paraphrase",
                        "rationale": "Rewording the base question to capture different phrasing variations",
                        "priority": 1
                    },
                    {
                        "query_type": "comparison",
                        "rationale": "Users often compare communication tools when making decisions",
                        "priority": 1
                    },
                    {
                        "query_type": "temporal",
                        "rationale": "Current/latest tools are relevant for remote work trends",
                        "priority": 2
                    }
                ],
                "queries": [
                    {
                        "query": "Which team messaging platforms work best for distributed teams?",
                        "type": "paraphrase",
                        "intent": "awareness"
                    },
                    {
                        "query": "Slack vs Microsoft Teams vs Discord for business communication",
                        "type": "comparison",
                        "intent": "consideration"
                    },
                    {
                        "query": "Best team communication tools in 2025 for hybrid work",
                        "type": "temporal",
                        "intent": "consideration"
                    }
                ],
                "totalQueries": 3,
                "generationTimestamp": "2024-01-15T10:30:00Z"
            }
        }

# ===== WEBSITE ENRICHMENT MODELS =====

class CompetitorInfo(BaseModel):
    """
    Competitor information with website details.

    Attributes:
        name: Company name
        website: Website URL
        description: Brief company description
        industry: Industry classification
        confidence: Confidence score for the information (0-1)
    """
    name: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Company name"
    )
    website: str = Field(
        ...,
        pattern=r'^https?://[^\s/$.?#].[^\s]*$',
        description="Website URL"
    )
    description: Optional[str] = Field(
        None,
        max_length=500,
        description="Brief company description"
    )
    industry: Optional[str] = Field(
        None,
        max_length=50,
        description="Industry classification"
    )
    confidence: float = Field(
        default=1.0,
        ge=0.0,
        le=1.0,
        description="Confidence score for the information"
    )

    @validator('website')
    def validate_website(cls, v):
        """Validate website URL format"""
        if not v.startswith(('http://', 'https://')):
            v = f'https://{v}'
        return v

    @validator('name')
    def validate_name(cls, v):
        """Validate company name"""
        return v.strip()

    class Config:
        json_schema_extra = {
            "example": {
                "name": "Asana",
                "website": "https://asana.com",
                "description": "Team collaboration and project management platform",
                "industry": "Project Management Software",
                "confidence": 0.95
            }
        }

class WebsiteEnrichmentResult(BaseModel):
    """
    Result of website enrichment for competitors.

    Attributes:
        competitors: List of enriched competitor information
        processedCount: Number of competitors processed
        successCount: Number of successful enrichments
        failedCount: Number of failed enrichments
        processingTimestamp: When the enrichment was performed
    """
    competitors: List[CompetitorInfo] = Field(
        ...,
        min_items=1,
        description="List of enriched competitor information"
    )
    processedCount: int = Field(
        ...,
        ge=0,
        description="Number of competitors processed"
    )
    successCount: int = Field(
        ...,
        ge=0,
        description="Number of successful enrichments"
    )
    failedCount: int = Field(
        ...,
        ge=0,
        description="Number of failed enrichments"
    )
    processingTimestamp: datetime = Field(
        default_factory=datetime.now,
        description="When the enrichment was performed"
    )

    @model_validator(mode='before')
    def validate_counts(cls, values):
        """Validate that counts are consistent"""
        if isinstance(values, dict):
            competitors = values.get('competitors', [])
            processed = values.get('processedCount', 0)
            success = values.get('successCount', 0)
            failed = values.get('failedCount', 0)

            if processed != success + failed:
                values['processedCount'] = success + failed

        return values

# ===== OPTIMIZATION TASKS MODELS =====

class OptimizationTaskCategory(str, Enum):
    """Categories for optimization tasks"""
    CONTENT = "content"
    TECHNICAL = "technical"
    BRAND = "brand"
    VISIBILITY = "visibility"
    PERFORMANCE = "performance"

class OptimizationTask(BaseModel):
    """
    Individual optimization task that matches the database schema.

    Attributes:
        taskId: Unique identifier for the task
        title: Task title
        description: Detailed task description
        category: Task category
        priority: Priority level as string (HIGH, MEDIUM, LOW)
        impactMetric: Expected impact description
        dependencies: Additional task metadata as JSON
    """
    taskId: str = Field(
        ...,
        min_length=1,
        max_length=50,
        description="Unique identifier for the task"
    )
    title: str = Field(
        ...,
        min_length=5,
        max_length=200,
        description="Task title"
    )
    description: str = Field(
        ...,
        min_length=10,
        max_length=2000,
        description="Detailed task description"
    )
    category: OptimizationTaskCategory = Field(
        ...,
        description="Task category"
    )
    priority: str = Field(
        ...,
        description="Priority level (HIGH, MEDIUM, LOW)"
    )
    impactMetric: str = Field(
        ...,
        min_length=10,
        max_length=500,
        description="Expected impact description with metrics"
    )
    dependencies: Dict[str, Any] = Field(
        default_factory=dict,
        description="Additional task metadata, action items, and dependencies as JSON"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "taskId": "brand_sentiment_improvement",
                "title": "Improve brand mention sentiment",
                "description": "Analyze current brand sentiment and develop comprehensive strategies to improve positive mentions across AI platforms",
                "category": "brand",
                "priority": "HIGH",
                "impactMetric": "Increase positive brand sentiment by 15% within 3 months and reduce negative mentions by 10%",
                "dependencies": {
                    "actionItems": [
                        "Conduct sentiment analysis audit",
                        "Identify key improvement areas",
                        "Develop content strategy",
                        "Implement monitoring system"
                    ],
                    "estimatedEffort": 8,
                    "successMetrics": ["Sentiment score improvement", "Mention volume increase"],
                    "prerequisites": []
                }
            }
        }

class OptimizationTaskGeneration(BaseModel):
    """
    Complete optimization task generation result.

    Attributes:
        companyName: Name of the company
        industry: Industry context
        tasks: Generated optimization tasks
        totalTasks: Total number of tasks generated
        generationTimestamp: When the tasks were generated
    """
    companyName: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Name of the company"
    )
    industry: str = Field(
        ...,
        min_length=1,
        max_length=50,
        description="Industry context"
    )
    tasks: List[OptimizationTask] = Field(
        ...,
        min_items=1,
        max_items=50,
        description="Generated optimization tasks"
    )
    totalTasks: int = Field(
        ...,
        ge=1,
        description="Total number of tasks generated"
    )
    generationTimestamp: datetime = Field(
        default_factory=datetime.now,
        description="When the tasks were generated"
    )

    @model_validator(mode='before')
    def validate_total_tasks(cls, values):
        """Validate that totalTasks matches actual task count"""
        if isinstance(values, dict):
            tasks = values.get('tasks', [])
            total = values.get('totalTasks', 0)
            if len(tasks) != total:
                values['totalTasks'] = len(tasks)
        return values

# ===== QUESTION ANSWERING MODELS =====

class CitationSource(BaseModel):
    """A citation source with detailed information"""
    url: str = Field(..., description="URL of the source")
    title: str = Field(..., description="Title of the source")
    domain: str = Field(..., description="Domain of the source")
    accessed_at: datetime = Field(default_factory=datetime.now, description="When the source was accessed")

class QuestionResponse(BaseModel):
    """
    Response to a question with brand mentions and citations.

    Attributes:
        question: Original question
        answer: Generated answer with <brand> tags for mentions
        confidence: Confidence score (0-1)
        citations: List of web sources used to generate the answer
        brand_mentions_count: Number of <brand> tags in the response
        has_web_search: Whether web search was used to generate the answer
        timestamp: When the response was generated
    """
    question: str = Field(
        ...,
        min_length=5,
        max_length=500,
        description="Original question"
    )
    answer: str = Field(
        ...,
        min_length=10,
        max_length=10000,
        description="Generated answer with <brand> tags for company mentions"
    )
    confidence: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Confidence score for the answer"
    )
    citations: List[CitationSource] = Field(
        default_factory=list,
        description="List of web sources used to generate the answer"
    )
    brand_mentions_count: int = Field(
        default=0,
        ge=0,
        description="Number of <brand> tags in the response"
    )
    has_web_search: bool = Field(
        default=False,
        description="Whether web search was used to generate the answer"
    )
    timestamp: datetime = Field(
        default_factory=datetime.now,
        description="When the response was generated"
    )

    @model_validator(mode='after')
    def count_brand_mentions(self):
        """Count <brand> tags in the answer"""
        import re
        brand_tags = re.findall(r'<brand>(.*?)</brand>', self.answer, re.IGNORECASE)
        self.brand_mentions_count = len(brand_tags)
        return self

    class Config:
        json_schema_extra = {
            "example": {
                "question": "What are the key benefits of using project management software?",
                "answer": "Project management software provides several key benefits including improved team collaboration, better task tracking, enhanced visibility into project progress, and more efficient resource allocation. Companies like <brand>Asana</brand> and <brand>Trello</brand> are popular choices.",
                "confidence": 0.92,
                "citations": [
                    {
                        "url": "https://example.com/pm-benefits",
                        "title": "Benefits of Project Management Software",
                        "domain": "example.com",
                        "accessed_at": "2024-01-15T10:30:00Z"
                    }
                ],
                "brand_mentions_count": 2,
                "has_web_search": True,
                "timestamp": "2024-01-15T10:30:00Z"
            }
        }

# ===== COMMON RESPONSE MODELS =====

class AgentExecutionMetadata(BaseModel):
    """
    Metadata for agent execution.

    Attributes:
        agentId: Identifier for the agent
        modelUsed: Model that was used
        tokensUsed: Number of tokens consumed
        executionTime: Execution time in milliseconds
        providerId: Provider that was used
        success: Whether execution was successful
        attemptCount: Number of attempts made
        fallbackUsed: Whether fallback was used
    """
    agentId: str = Field(..., description="Identifier for the agent")
    modelUsed: str = Field(..., description="Model that was used")
    tokensUsed: int = Field(..., ge=0, description="Number of tokens consumed")
    executionTime: int = Field(..., ge=0, description="Execution time in milliseconds")
    providerId: str = Field(..., description="Provider that was used")
    success: bool = Field(..., description="Whether execution was successful")
    attemptCount: int = Field(..., ge=1, description="Number of attempts made")
    fallbackUsed: bool = Field(..., description="Whether fallback was used")

    class Config:
        json_schema_extra = {
            "example": {
                "agentId": "sentiment_analyzer",
                "modelUsed": "gpt-4o",
                "tokensUsed": 1250,
                "executionTime": 2340,
                "providerId": "openai",
                "success": True,
                "attemptCount": 1,
                "fallbackUsed": False
            }
        }

# ===== QUESTION ANSWERING MODELS =====

class SimpleQuestionResponse(BaseModel):
    """
    Simple question response model for natural question answering.

    Attributes:
        answer: The comprehensive answer to the question
        confidence: Confidence score of the answer (0.0 to 1.0)
        has_web_search: Whether web search was used
        brand_mentions_count: Number of brand mentions found in the answer
        sources_count: Number of sources used
    """
    answer: str = Field(
        ...,
        min_length=10,
        max_length=5000,
        description="Comprehensive answer to the question"
    )
    confidence: float = Field(
        ge=0.0,
        le=1.0,
        default=0.8,
        description="Confidence score of the answer"
    )
    has_web_search: bool = Field(
        default=False,
        description="Whether web search was used to generate the answer"
    )
    brand_mentions_count: int = Field(
        ge=0,
        default=0,
        description="Number of brand mentions found in the answer"
    )
    sources_count: int = Field(
        ge=0,
        default=0,
        description="Number of sources used to generate the answer"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "answer": "The best team communication tools for remote work include Slack for instant messaging, Zoom for video conferences, and Microsoft Teams for integrated collaboration.",
                "confidence": 0.95,
                "has_web_search": True,
                "brand_mentions_count": 3,
                "sources_count": 5
            }
        }

# ===== AI OVERVIEW (SERP) MODELS =====

class AiOverviewInput(BaseModel):
    """Input for AI Overview agent (Google SERP)."""
    query: str = Field(..., min_length=3, max_length=300, description="Search query to run on Google")
    hl: Optional[str] = Field(default="en", description="Interface language (hl)")
    gl: Optional[str] = Field(default="us", description="Geolocation (gl)")
    tbs: Optional[str] = Field(default=None, description="Time bound or filter params (tbs)")
    timeoutMs: Optional[int] = Field(default=15000, ge=1000, le=60000, description="Max time to wait for SERP")
    userAgent: Optional[str] = Field(default=None, description="Custom user agent string")
    proxyUrl: Optional[str] = Field(default=None, description="HTTP(S) proxy URL if required")

class AiOverviewResult(BaseModel):
    """Structured result of an AI Overview detection and extraction."""
    present: bool = Field(..., description="Whether AI Overview was detected on the SERP")
    query: str = Field(..., description="Original query")
    serpUrl: str = Field(..., description="Final SERP URL after navigation")
    answerText: Optional[str] = Field(default=None, description="Extracted AI Overview text content")
    htmlSnippet: Optional[str] = Field(default=None, description="Trimmed HTML snippet of the AI Overview region")
    citations: List[CitationSource] = Field(default_factory=list, description="Links found within AI Overview")
    detectedSelectors: List[str] = Field(default_factory=list, description="Selectors that matched AI Overview region")
    userAgent: Optional[str] = Field(default=None, description="User agent used for navigation")
    locale: Optional[str] = Field(default=None, description="Derived locale (hl-gl)")
    timingMs: int = Field(..., ge=0, description="Total execution time in milliseconds")
    error: Optional[str] = Field(default=None, description="Error message if detection failed or blocked")
