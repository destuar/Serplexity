"""
Model Configuration for PydanticAI Agents

This module provides Python equivalents of the TypeScript models.ts configuration,
ensuring consistency between frontend and backend model configurations.
This serves as the single source of truth for model-to-task mappings.
"""

from enum import Enum
from typing import Dict, List, Optional
from dataclasses import dataclass

class ModelEngine(Enum):
    """Model engines/providers"""
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    GOOGLE = "gemini"
    PERPLEXITY = "perplexity"

class ModelTask(Enum):
    """Tasks that models can perform"""
    SENTIMENT = "sentiment"
    FANOUT_GENERATION = "fanout_generation"
    SENTIMENT_SUMMARY = "sentiment_summary"
    QUESTION_ANSWERING = "question_answering"
    WEBSITE_ENRICHMENT = "website_enrichment"
    OPTIMIZATION_TASKS = "optimization_tasks"
    COMPANY_RESEARCH = "company_research"
    QUESTION_GENERATION = "question_generation"
    MENTION_DETECTION = "mention_detection"

@dataclass
class Model:
    """Model configuration"""
    id: str
    engine: ModelEngine
    tasks: List[ModelTask]

    def get_pydantic_model_id(self) -> str:
        """Get the full model ID for PydanticAI"""
        # Special handling for models that don't need provider prefix
        if self.engine == ModelEngine.GOOGLE:
            return self.id  # gemini-2.5-flash
        elif self.engine == ModelEngine.PERPLEXITY:
            # Return raw model id. Python agents build a proper ChatModel with OpenAIProvider(base_url).
            # Returning an openai: prefix causes the provider to hit api.openai.com and 404.
            return self.id  # e.g., 'sonar'
        else:
            return f"{self.engine.value}:{self.id}"

    def can_perform_task(self, task: ModelTask) -> bool:
        """Check if this model can perform a specific task"""
        return task in self.tasks

# Central model configuration - mirrors TypeScript models.ts
# Updated based on actual PydanticAI agent implementations and usage patterns.
MODELS: Dict[str, Model] = {
    "gpt-4.1-mini": Model(
        id="gpt-4.1-mini",
        engine=ModelEngine.OPENAI,
        tasks=[
            ModelTask.SENTIMENT,  # ✅ WebSearchSentimentAgent (multi-provider)
            ModelTask.FANOUT_GENERATION,  # ✅ IntelligentFanoutAgent (primary default)
            ModelTask.QUESTION_ANSWERING,  # ✅ QuestionAnsweringAgent (multi-provider)
            ModelTask.SENTIMENT_SUMMARY,  # ✅ SentimentSummaryAgent (ONLY gpt-4.1-mini)
            ModelTask.OPTIMIZATION_TASKS,  # ✅ OptimizationTaskService (default model)
            ModelTask.QUESTION_GENERATION,  # ✅ GenQuestionAgent (ONLY gpt-4.1-mini)
            ModelTask.MENTION_DETECTION,  # ✅ MentionAgent (default model)
        ]
    ),
    "claude-3-5-haiku-20241022": Model(
        id="claude-3-5-haiku-20241022",
        engine=ModelEngine.ANTHROPIC,
        tasks=[
            ModelTask.SENTIMENT,  # ✅ WebSearchSentimentAgent (multi-provider)
            ModelTask.FANOUT_GENERATION,  # ✅ IntelligentFanoutAgent (available alternative)
            ModelTask.QUESTION_ANSWERING,  # ✅ QuestionAnsweringAgent (multi-provider)
        ]
    ),
    "gemini-2.5-flash": Model(
        id="gemini-2.5-flash",
        engine=ModelEngine.GOOGLE,
        tasks=[
            ModelTask.SENTIMENT,  # ✅ WebSearchSentimentAgent (multi-provider)
            ModelTask.FANOUT_GENERATION,  # ✅ IntelligentFanoutAgent (available alternative)
            ModelTask.QUESTION_ANSWERING,  # ✅ QuestionAnsweringAgent (multi-provider)
        ]
    ),
    "sonar": Model(
        id="sonar",
        engine=ModelEngine.PERPLEXITY,
        tasks=[
            ModelTask.SENTIMENT,  # ✅ WebSearchSentimentAgent (has built-in web search)
            ModelTask.FANOUT_GENERATION,  # ✅ IntelligentFanoutAgent (available alternative)
            ModelTask.QUESTION_ANSWERING,  # ✅ QuestionAnsweringAgent (has built-in web search)
            ModelTask.WEBSITE_ENRICHMENT,  # ✅ WebsiteEnrichmentAgent (web search enabled)
        ]
    ),
}

def get_models_by_task(task: ModelTask) -> List[Model]:
    """Get all models that can perform a specific task"""
    return [model for model in MODELS.values() if model.can_perform_task(task)]

def get_model_by_id(model_id: str) -> Optional[Model]:
    """Get a model by its ID"""
    return MODELS.get(model_id)

def get_default_model_for_task(task: ModelTask) -> Optional[Model]:
    """Get the default model for a specific task"""
    models = get_models_by_task(task)
    if not models:
        return None

    # Task-specific defaults based on actual agent implementations
    if task == ModelTask.SENTIMENT_SUMMARY:
        return get_model_by_id("gpt-4.1-mini")  # Only gpt-4.1-mini
    elif task == ModelTask.WEBSITE_ENRICHMENT:
        # Default to gpt-4.1-mini to avoid Perplexity-specific failures; agents may still construct
        # a Perplexity model object explicitly when desired (WebsiteEnrichmentAgent handles this)
        return get_model_by_id("gpt-4.1-mini")
    elif task == ModelTask.COMPANY_RESEARCH:
        # Align with TS defaults and allow override; previously forced Sonar caused 404s
        return get_model_by_id("gpt-4.1-mini")
    elif task == ModelTask.QUESTION_GENERATION:
        return get_model_by_id("gpt-4.1-mini")  # Only gpt-4.1-mini
    elif task == ModelTask.MENTION_DETECTION:
        return get_model_by_id("gpt-4.1-mini")  # Default to gpt-4.1-mini
    elif task == ModelTask.OPTIMIZATION_TASKS:
        return get_model_by_id("gpt-4.1-mini")  # Default to gpt-4.1-mini
    else:
        # Default to gpt-4.1-mini for other tasks
        return get_model_by_id("gpt-4.1-mini")

def get_all_models() -> List[Model]:
    """Get all available models"""
    return list(MODELS.values())

def get_models_by_engine(engine: ModelEngine) -> List[Model]:
    """Get all models for a specific engine"""
    return [model for model in MODELS.values() if model.engine == engine]

# Agent-specific model selection - updated to match actual implementations
def get_agent_models() -> Dict[str, str]:
    """Get default models for each agent type"""
    return {
        "web_search_sentiment": "gpt-4.1-mini",  # Multi-provider but defaults to gpt-4.1-mini
        "sentiment_summary": "gpt-4.1-mini",  # Only gpt-4.1-mini
        "fanout": "gpt-4.1-mini",  # Primary default
        "question_answering": "gpt-4.1-mini",  # Multi-provider but defaults to gpt-4.1-mini
        "website_enrichment": "gpt-4.1-mini",
        "company_research": "gpt-4.1-mini",
        "question_generation": "gpt-4.1-mini",  # Only gpt-4.1-mini
        "mention_detection": "gpt-4.1-mini",  # Default to gpt-4.1-mini
        "optimization": "gpt-4.1-mini"  # Default to gpt-4.1-mini
    }

# Configuration constants
LLM_CONFIG = {
    "MAX_TOKENS": 8192,
    "DEFAULT_TEMPERATURE": 0.7,
    "DEFAULT_TIMEOUT": 30000,
    "MAX_RETRIES": 3,
    "RETRY_BACKOFF_BASE": 1000,
}
