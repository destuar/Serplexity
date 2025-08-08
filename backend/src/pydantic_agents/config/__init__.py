"""
PydanticAI Agent Configuration

This package contains configuration modules for the agents.
"""

from .telemetry import (
    track_agent_execution,
    track_model_usage,
    track_error,
)

from .web_search_config import (
    WebSearchConfig,
    get_sentiment_web_search_config,
    get_qa_web_search_config,
    get_website_enrichment_web_search_config
)

__all__ = [
    'track_agent_execution',
    'track_model_usage',
    'track_error',
    'WebSearchConfig',
    'get_sentiment_web_search_config',
    'get_qa_web_search_config',
    'get_website_enrichment_web_search_config'
]
