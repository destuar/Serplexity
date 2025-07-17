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
            return f"openai:{self.id}"  # openai:sonar (Perplexity uses OpenAI format)
        else:
            return f"{self.engine.value}:{self.id}"
    
    def can_perform_task(self, task: ModelTask) -> bool:
        """Check if this model can perform a specific task"""
        return task in self.tasks

# Central model configuration - mirrors TypeScript models.ts
MODELS: Dict[str, Model] = {
    "gpt-4.1-mini": Model(
        id="gpt-4.1-mini",
        engine=ModelEngine.OPENAI,
        tasks=[
            ModelTask.SENTIMENT,
            ModelTask.FANOUT_GENERATION,
            ModelTask.QUESTION_ANSWERING,
            ModelTask.SENTIMENT_SUMMARY,  # Only gpt-4.1-mini does sentiment summary
            ModelTask.OPTIMIZATION_TASKS,  # Add optimization tasks to gpt-4.1-mini
        ]
    ),
    "claude-3-5-haiku-20241022": Model(
        id="claude-3-5-haiku-20241022",
        engine=ModelEngine.ANTHROPIC,
        tasks=[
            ModelTask.SENTIMENT,
            ModelTask.FANOUT_GENERATION,
            ModelTask.QUESTION_ANSWERING,
        ]
    ),
    "gemini-2.5-flash": Model(
        id="gemini-2.5-flash",
        engine=ModelEngine.GOOGLE,
        tasks=[
            ModelTask.SENTIMENT,
            ModelTask.FANOUT_GENERATION,
            ModelTask.QUESTION_ANSWERING,
            ModelTask.WEBSITE_ENRICHMENT,  # Only gemini does website enrichment
            ModelTask.OPTIMIZATION_TASKS,  # Only gemini does optimization tasks
        ]
    ),
    "sonar": Model(
        id="sonar",
        engine=ModelEngine.PERPLEXITY,
        tasks=[
            ModelTask.SENTIMENT,
            ModelTask.FANOUT_GENERATION,
            ModelTask.QUESTION_ANSWERING,
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
    
    # Task-specific defaults
    if task == ModelTask.SENTIMENT_SUMMARY:
        return get_model_by_id("gpt-4.1-mini")  # Only gpt-4.1-mini
    elif task == ModelTask.WEBSITE_ENRICHMENT:
        return get_model_by_id("gemini-2.5-flash")  # Only gemini
    elif task == ModelTask.OPTIMIZATION_TASKS:
        return get_model_by_id("gpt-4.1-mini")  # Use gpt-4.1-mini for optimization tasks
    else:
        # Default to gpt-4.1-mini for other tasks
        return get_model_by_id("gpt-4.1-mini")

def get_provider_models(provider: str) -> List[Model]:
    """Get all models for a specific provider"""
    try:
        engine = ModelEngine(provider)
        return [model for model in MODELS.values() if model.engine == engine]
    except ValueError:
        return []

def validate_model_for_task(model_id: str, task: ModelTask) -> bool:
    """Validate that a model can perform a specific task"""
    model = get_model_by_id(model_id)
    if not model:
        return False
    return model.can_perform_task(task)

# Agent-specific model selection
def get_agent_models() -> Dict[str, str]:
    """Get default models for each agent type"""
    return {
        "web_search_sentiment": "gpt-4.1-mini",
        "sentiment_summary": "gpt-4.1-mini",
        "fanout": "gpt-4.1-mini", 
        "question_answering": "gpt-4.1-mini",
        "website_enrichment": "gemini-2.5-flash",
        "optimization": "gpt-4.1-mini"
    }

# Configuration constants
LLM_CONFIG = {
    "MAX_TOKENS": 8192,
    "DEFAULT_TEMPERATURE": 0.7,
    "DEFAULT_TIMEOUT": 30000,
    "MAX_RETRIES": 3,
    "RETRY_BACKOFF_BASE": 1000,
}