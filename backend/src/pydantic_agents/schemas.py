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

from pydantic import BaseModel, Field, validator, root_validator
from typing import List, Optional, Dict, Any, Union, Literal
from enum import Enum
from datetime import datetime
import re

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
        max_length=500,
        description="Brief description of the overall sentiment"
    )

    class Config:
        schema_extra = {
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
    Complete sentiment analysis for a company.
    
    Attributes:
        companyName: Name of the company being analyzed
        industry: Industry sector of the company
        ratings: List of sentiment ratings from different sources
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
        schema_extra = {
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
    COMPARISON = "comparison"
    BEST_FOR = "best_for"
    VERSUS = "versus"
    FEATURES = "features"
    PRICING = "pricing"
    REVIEWS = "reviews"
    ALTERNATIVES = "alternatives"
    PROS_CONS = "pros_cons"
    USE_CASES = "use_cases"
    GETTING_STARTED = "getting_started"

class FanoutQuery(BaseModel):
    """
    Individual query for fanout generation.
    
    Attributes:
        query: The actual query text
        type: Type of query (comparison, best_for, etc.)
        priority: Priority level (1-5, where 1 is highest)
        targetAudience: Target audience for the query
        expectedMentions: Expected company mentions in responses
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
    priority: int = Field(
        ..., 
        ge=1, 
        le=5,
        description="Priority level (1=highest, 5=lowest)"
    )
    targetAudience: str = Field(
        ..., 
        min_length=5, 
        max_length=100,
        description="Target audience for the query"
    )
    expectedMentions: List[str] = Field(
        default=[], 
        max_items=10,
        description="Expected company mentions in responses"
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
        schema_extra = {
            "example": {
                "query": "What are the best project management tools for remote teams?",
                "type": "best_for",
                "priority": 1,
                "targetAudience": "Remote team managers",
                "expectedMentions": ["Asana", "Trello", "Monday.com"]
            }
        }

class FanoutQueryGeneration(BaseModel):
    """
    Complete fanout query generation result.
    
    Attributes:
        companyName: Name of the company
        industry: Industry context
        queries: Generated queries organized by type
        totalQueries: Total number of queries generated
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
    queries: List[FanoutQuery] = Field(
        ..., 
        min_items=1, 
        max_items=100,
        description="Generated queries organized by type"
    )
    totalQueries: int = Field(
        ..., 
        ge=1,
        description="Total number of queries generated"
    )
    generationTimestamp: datetime = Field(
        default_factory=datetime.now,
        description="When the queries were generated"
    )

    @root_validator
    def validate_total_queries(cls, values):
        """Validate that totalQueries matches actual query count"""
        queries = values.get('queries', [])
        total = values.get('totalQueries', 0)
        if len(queries) != total:
            values['totalQueries'] = len(queries)
        return values

    class Config:
        schema_extra = {
            "example": {
                "companyName": "Slack",
                "industry": "Communication Software",
                "queries": [
                    {
                        "query": "What are the best team communication tools?",
                        "type": "best_for",
                        "priority": 1,
                        "targetAudience": "Team managers",
                        "expectedMentions": ["Slack", "Microsoft Teams", "Discord"]
                    }
                ],
                "totalQueries": 1,
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
        regex=r'^https?://[^\s/$.?#].[^\s]*$',
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
        schema_extra = {
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

    @root_validator
    def validate_counts(cls, values):
        """Validate that counts are consistent"""
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
    Individual optimization task.
    
    Attributes:
        title: Task title
        description: Detailed task description
        category: Task category
        priority: Priority level (1-5)
        estimatedEffort: Estimated effort in hours
        expectedImpact: Expected impact description
        actionItems: List of specific action items
    """
    title: str = Field(
        ..., 
        min_length=5, 
        max_length=100,
        description="Task title"
    )
    description: str = Field(
        ..., 
        min_length=10, 
        max_length=1000,
        description="Detailed task description"
    )
    category: OptimizationTaskCategory = Field(
        ..., 
        description="Task category"
    )
    priority: int = Field(
        ..., 
        ge=1, 
        le=5,
        description="Priority level (1=highest, 5=lowest)"
    )
    estimatedEffort: int = Field(
        ..., 
        ge=1, 
        le=160,
        description="Estimated effort in hours"
    )
    expectedImpact: str = Field(
        ..., 
        min_length=10, 
        max_length=300,
        description="Expected impact description"
    )
    actionItems: List[str] = Field(
        ..., 
        min_items=1, 
        max_items=10,
        description="List of specific action items"
    )

    class Config:
        schema_extra = {
            "example": {
                "title": "Improve brand mention sentiment",
                "description": "Analyze current brand sentiment and develop strategies to improve positive mentions",
                "category": "brand",
                "priority": 2,
                "estimatedEffort": 8,
                "expectedImpact": "Increase positive brand sentiment by 15% within 3 months",
                "actionItems": [
                    "Conduct sentiment analysis audit",
                    "Identify key improvement areas",
                    "Develop content strategy",
                    "Implement monitoring system"
                ]
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

    @root_validator
    def validate_total_tasks(cls, values):
        """Validate that totalTasks matches actual task count"""
        tasks = values.get('tasks', [])
        total = values.get('totalTasks', 0)
        if len(tasks) != total:
            values['totalTasks'] = len(tasks)
        return values

# ===== QUESTION ANSWERING MODELS =====

class QuestionResponse(BaseModel):
    """
    Response to a question with metadata.
    
    Attributes:
        question: Original question
        answer: Generated answer
        confidence: Confidence score (0-1)
        sources: List of sources used
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
        max_length=2000,
        description="Generated answer"
    )
    confidence: float = Field(
        ..., 
        ge=0.0, 
        le=1.0,
        description="Confidence score for the answer"
    )
    sources: List[str] = Field(
        default=[], 
        max_items=10,
        description="List of sources used"
    )
    timestamp: datetime = Field(
        default_factory=datetime.now,
        description="When the response was generated"
    )

    class Config:
        schema_extra = {
            "example": {
                "question": "What are the key benefits of using project management software?",
                "answer": "Project management software provides several key benefits including improved team collaboration, better task tracking, enhanced visibility into project progress, and more efficient resource allocation.",
                "confidence": 0.92,
                "sources": ["Industry research", "User surveys", "Product documentation"],
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
        schema_extra = {
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