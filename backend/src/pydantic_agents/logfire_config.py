"""
@file logfire_config.py
@description Logfire instrumentation configuration for PydanticAI agents

This module provides comprehensive observability for Serplexity's PydanticAI agents through
Logfire integration. It automatically instruments all agent executions, tool calls, and
LLM interactions with detailed tracing and performance monitoring.

@features
- Automatic PydanticAI agent instrumentation
- Multi-provider LLM monitoring and cost tracking
- Tool execution tracing with input/output capture
- Error tracking and debugging information
- Performance metrics and latency monitoring
- Custom business event tracking

@dependencies
- logfire: Main observability SDK for Python
- pydantic-ai: Agent framework
- os: Environment variable access

@exports
- setup_logfire: Initialize Logfire for PydanticAI
- LogfireConfig: Configuration dataclass
- get_logfire_instance: Get configured Logfire instance
- track_agent_execution: Custom agent execution tracking
- track_model_usage: Track LLM provider usage and costs
"""

import os
import logging
from typing import Optional, Dict, Any, Union
from dataclasses import dataclass
from datetime import datetime

try:
    import logfire
    LOGFIRE_AVAILABLE = True
except ImportError:
    LOGFIRE_AVAILABLE = False
    logfire = None

from pydantic_ai import Agent

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class LogfireConfig:
    """Configuration for Logfire instrumentation"""
    project_name: str = "serplexity-pydantic-agents"
    service_name: str = "serplexity-python-agents"
    service_version: str = "1.0.0"
    environment: str = "development"
    enable_agent_instrumentation: bool = True
    enable_model_instrumentation: bool = True
    enable_tool_instrumentation: bool = True
    enable_custom_metrics: bool = True
    enable_error_tracking: bool = True
    debug_mode: bool = False
    sampling_rate: float = 1.0

# Global configuration instance
_config: Optional[LogfireConfig] = None
_initialized: bool = False

def setup_logfire(config: Optional[LogfireConfig] = None) -> bool:
    """
    Initialize Logfire for PydanticAI agents with comprehensive instrumentation.
    
    Args:
        config: Optional LogfireConfig instance. If None, uses default config.
        
    Returns:
        bool: True if initialization was successful, False otherwise.
    """
    global _config, _initialized
    
    if _initialized:
        logger.warning("Logfire already initialized, skipping...")
        return True
    
    if not LOGFIRE_AVAILABLE:
        logger.warning("Logfire not available, skipping instrumentation")
        return False
    
    try:
        # Use provided config or create default
        _config = config or LogfireConfig()
        
        # Set environment from environment variable
        _config.environment = os.getenv('NODE_ENV', 'development')
        _config.debug_mode = _config.environment == 'development'
        
        logger.info(f"Initializing Logfire for PydanticAI agents", extra={
            'service_name': _config.service_name,
            'environment': _config.environment,
            'project_name': _config.project_name
        })
        
        # Validate Logfire token
        logfire_token = os.getenv('LOGFIRE_TOKEN')
        if not logfire_token:
            logger.error("LOGFIRE_TOKEN environment variable is required")
            return False
        
        # Configure Logfire
        logfire.configure(
            service_name=_config.service_name,
            service_version=_config.service_version,
            send_to_logfire=True,
            console=_config.debug_mode,
            pydantic_plugin={
                'record': 'all'
            }
        )
        
        # Enable comprehensive instrumentation
        if _config.enable_agent_instrumentation:
            # PydanticAI instrumentation
            logfire.instrument_pydantic_ai()
            logger.info("PydanticAI instrumentation enabled")
        
        if _config.enable_model_instrumentation:
            # Model provider instrumentation
            logfire.instrument_openai()
            logfire.instrument_anthropic()
            logger.info("LLM provider instrumentation enabled")
        
        # HTTP instrumentation for external API calls
        logfire.instrument_httpx()
        logfire.instrument_requests()
        
        # Python logging integration
        logfire.instrument_logging()
        
        _initialized = True
        
        logger.info("Logfire initialization completed successfully", extra={
            'project_name': _config.project_name,
            'agent_instrumentation': _config.enable_agent_instrumentation,
            'model_instrumentation': _config.enable_model_instrumentation
        })
        
        return True
        
    except Exception as e:
        logger.error(f"Failed to initialize Logfire: {str(e)}", extra={
            'error': str(e),
            'error_type': type(e).__name__
        })
        return False

def get_logfire_instance():
    """Get the configured Logfire instance"""
    if not LOGFIRE_AVAILABLE:
        return None
    return logfire if _initialized else None

def get_config() -> Optional[LogfireConfig]:
    """Get the current Logfire configuration"""
    return _config

def is_initialized() -> bool:
    """Check if Logfire is properly initialized"""
    return _initialized and LOGFIRE_AVAILABLE

def track_agent_execution(
    agent_name: str,
    operation: str,
    duration_ms: Optional[float] = None,
    success: bool = True,
    input_data: Optional[Dict[str, Any]] = None,
    output_data: Optional[Dict[str, Any]] = None,
    metadata: Optional[Dict[str, Any]] = None
) -> None:
    """
    Track custom agent execution metrics
    
    Args:
        agent_name: Name of the agent
        operation: Operation being performed
        duration_ms: Execution duration in milliseconds
        success: Whether the operation was successful
        input_data: Input data (will be sanitized)
        output_data: Output data (will be sanitized)
        metadata: Additional metadata
    """
    if not is_initialized():
        return
    
    # Sanitize input/output data to avoid sending sensitive information
    sanitized_input = _sanitize_data(input_data) if input_data else None
    sanitized_output = _sanitize_data(output_data) if output_data else None
    
    logfire.info('Agent Execution Tracked', 
        agent_name=agent_name,
        operation=operation,
        duration_ms=duration_ms,
        success=success,
        input_length=len(str(sanitized_input)) if sanitized_input else 0,
        output_length=len(str(sanitized_output)) if sanitized_output else 0,
        metadata=metadata or {},
        timestamp=datetime.now().isoformat()
    )

def track_model_usage(
    provider: str,
    model_id: str,
    operation: str,
    tokens_used: int,
    cost_estimate: Optional[float] = None,
    duration_ms: Optional[float] = None,
    success: bool = True,
    error_message: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None
) -> None:
    """
    Track LLM model usage and costs
    
    Args:
        provider: LLM provider name (openai, anthropic, etc.)
        model_id: Specific model identifier
        operation: Type of operation (completion, chat, etc.)
        tokens_used: Number of tokens consumed
        cost_estimate: Estimated cost in USD
        duration_ms: Request duration in milliseconds
        success: Whether the request was successful
        error_message: Error message if the request failed
        metadata: Additional metadata
    """
    if not is_initialized():
        return
    
    logfire.info('Model Usage Tracked',
        provider=provider,
        model_id=model_id,
        operation=operation,
        tokens_used=tokens_used,
        cost_estimate=cost_estimate,
        duration_ms=duration_ms,
        success=success,
        error_message=error_message,
        metadata=metadata or {},
        timestamp=datetime.now().isoformat()
    )

def track_tool_execution(
    tool_name: str,
    agent_name: str,
    duration_ms: Optional[float] = None,
    success: bool = True,
    input_args: Optional[Dict[str, Any]] = None,
    output_result: Optional[Any] = None,
    error_message: Optional[str] = None
) -> None:
    """
    Track tool execution within agents
    
    Args:
        tool_name: Name of the tool being executed
        agent_name: Name of the parent agent
        duration_ms: Execution duration in milliseconds
        success: Whether the tool execution was successful
        input_args: Tool input arguments (will be sanitized)
        output_result: Tool output result (will be sanitized)
        error_message: Error message if the tool failed
    """
    if not is_initialized():
        return
    
    # Sanitize data
    sanitized_input = _sanitize_data(input_args) if input_args else None
    sanitized_output = _sanitize_data(output_result) if output_result else None
    
    logfire.info('Tool Execution Tracked',
        tool_name=tool_name,
        agent_name=agent_name,
        duration_ms=duration_ms,
        success=success,
        input_length=len(str(sanitized_input)) if sanitized_input else 0,
        output_length=len(str(sanitized_output)) if sanitized_output else 0,
        error_message=error_message,
        timestamp=datetime.now().isoformat()
    )

def track_error(
    error: Exception,
    context: str,
    agent_name: Optional[str] = None,
    operation: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None
) -> None:
    """
    Track errors with enhanced context
    
    Args:
        error: The exception that occurred
        context: Context where the error occurred
        agent_name: Name of the agent if applicable
        operation: Operation that was being performed
        metadata: Additional metadata
    """
    if not is_initialized():
        return
    
    logfire.error('Agent Error Tracked',
        error_message=str(error),
        error_type=type(error).__name__,
        context=context,
        agent_name=agent_name,
        operation=operation,
        metadata=metadata or {},
        timestamp=datetime.now().isoformat()
    )

def _sanitize_data(data: Any, max_length: int = 1000) -> Any:
    """
    Sanitize data to avoid sending sensitive information or overly large payloads
    
    Args:
        data: Data to sanitize
        max_length: Maximum string length to keep
        
    Returns:
        Sanitized data
    """
    if data is None:
        return None
    
    if isinstance(data, str):
        if len(data) > max_length:
            return data[:max_length] + "... [truncated]"
        return data
    
    if isinstance(data, dict):
        sanitized = {}
        for key, value in data.items():
            # Skip sensitive keys
            if any(sensitive in key.lower() for sensitive in ['password', 'token', 'key', 'secret']):
                sanitized[key] = "[REDACTED]"
            else:
                sanitized[key] = _sanitize_data(value, max_length)
        return sanitized
    
    if isinstance(data, (list, tuple)):
        return [_sanitize_data(item, max_length) for item in data[:10]]  # Limit to first 10 items
    
    # For other types, convert to string and truncate if needed
    str_data = str(data)
    if len(str_data) > max_length:
        return str_data[:max_length] + "... [truncated]"
    
    return str_data

# Auto-initialize if LOGFIRE_TOKEN is available
if os.getenv('LOGFIRE_TOKEN') and not _initialized:
    setup_logfire() 