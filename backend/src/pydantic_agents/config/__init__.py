"""
PydanticAI Agent Configuration

This package contains configuration modules for the agents.
"""

from .logfire_config import (
    setup_logfire,
    is_initialized,
    track_agent_execution,
    track_model_usage,
    track_error,
    is_logfire_available,
    LogfireConfig
)

from .web_search_config import (
    WebSearchConfig,
    get_sentiment_web_search_config,
    get_qa_web_search_config,
    get_website_enrichment_web_search_config
)

__all__ = [
    'setup_logfire',
    'is_initialized',
    'track_agent_execution',
    'track_model_usage',
    'track_error',
    'is_logfire_available',
    'LogfireConfig',
    'WebSearchConfig',
    'get_sentiment_web_search_config',
    'get_qa_web_search_config',
    'get_website_enrichment_web_search_config'
]