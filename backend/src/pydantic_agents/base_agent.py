"""
Base Agent for PydanticAI Operations

This module provides the foundational agent class that all PydanticAI agents
inherit from. It handles common functionality like provider management,
error handling, logging, and response validation.

Key Features:
- Automatic provider failover
- Comprehensive error handling
- Structured logging
- Response validation
- Performance monitoring
- Token usage tracking
"""

import asyncio
import json
import logging
import os
import sys
import time
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional, Type, TypeVar, Union

from pydantic import BaseModel, ValidationError
from pydantic_ai import Agent

from .schemas import AgentExecutionMetadata
from .config.models import LLM_CONFIG

# Telemetry no-ops to keep call sites stable without vendor dependency
from .config.telemetry import (
    track_agent_execution,
    track_model_usage,
    track_error,
)

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stderr)
    ]
)

logger = logging.getLogger(__name__)

T = TypeVar('T', bound=BaseModel)

class BaseAgentError(Exception):
    """Base exception for agent errors"""
    pass

class AgentValidationError(BaseAgentError):
    """Raised when agent response validation fails"""
    pass

class AgentExecutionError(BaseAgentError):
    """Raised when agent execution fails"""
    pass

class BaseAgent(ABC):
    """
    Base class for all PydanticAI agents.

    This class provides common functionality for:
    - Provider management and failover
    - Error handling and retry logic
    - Response validation
    - Performance monitoring
    - Logging and observability
    """

    def __init__(
        self,
        agent_id: str,
        default_model: str = "openai:gpt-4.1-mini",
        system_prompt: Optional[str] = None,
        temperature: float = None,
        max_tokens: Optional[int] = None,
        timeout: int = None,
        max_retries: int = None
    ):
        """
        Initialize the base agent.

        Args:
            agent_id: Unique identifier for the agent
            default_model: Default model to use
            system_prompt: System prompt for the agent
            temperature: Temperature for generation
            max_tokens: Maximum tokens to generate
            timeout: Request timeout in milliseconds
            max_retries: Maximum number of retries
        """
        self.agent_id = agent_id
        self.default_model = default_model
        self.system_prompt = system_prompt

        # Use centralized configuration with fallbacks
        self.temperature = temperature if temperature is not None else LLM_CONFIG["DEFAULT_TEMPERATURE"]
        self.max_tokens = max_tokens if max_tokens is not None else LLM_CONFIG["MAX_TOKENS"]
        self.timeout = timeout if timeout is not None else LLM_CONFIG["DEFAULT_TIMEOUT"]
        self.max_retries = max_retries if max_retries is not None else LLM_CONFIG["MAX_RETRIES"]

        # Get configuration from environment with centralized fallbacks
        self.provider_id = os.getenv('PYDANTIC_PROVIDER_ID', 'openai')

        # Handle model ID - ALWAYS honor environment override when provided
        env_model_id = os.getenv('PYDANTIC_MODEL_ID')

        if env_model_id and isinstance(env_model_id, str) and env_model_id.strip():
            # If the env value is a simple model id (e.g., 'gpt-4.1-mini'), map it to a proper provider-prefixed id
            if ':' not in env_model_id and not env_model_id.startswith('gemini'):
                try:
                    from .config.models import get_model_by_id
                    model_config = get_model_by_id(env_model_id)
                    if model_config:
                        self.model_id = model_config.get_pydantic_model_id()
                    else:
                        # Fallback to the raw env value if not found in config
                        self.model_id = env_model_id
                except Exception:
                    self.model_id = env_model_id
            else:
                # Already provider-qualified or special-case engine id
                self.model_id = env_model_id
        else:
            # No override provided → use the agent's default model (string or model object)
            if isinstance(default_model, str):
                if ':' in default_model or default_model.startswith('gemini'):
                    self.model_id = default_model
                else:
                    try:
                        from .config.models import get_model_by_id
                        model_config = get_model_by_id(default_model)
                        self.model_id = (
                            model_config.get_pydantic_model_id() if model_config else default_model
                        )
                    except Exception:
                        self.model_id = default_model
            else:
                # For custom model objects (like Perplexity OpenAIModel), preserve them
                self.model_id = default_model

        self.env_temperature = float(os.getenv('PYDANTIC_TEMPERATURE', str(self.temperature)))
        self.env_max_tokens = int(os.getenv('PYDANTIC_MAX_TOKENS', str(self.max_tokens)))
        self.env_system_prompt = os.getenv('PYDANTIC_SYSTEM_PROMPT', system_prompt)
        self.env_timeout = int(os.getenv('PYDANTIC_TIMEOUT', str(self.timeout)))

        # No vendor telemetry initialization required

        # Initialize agent
        self.agent = self._create_agent()

        logger.debug(f"Initialized {agent_id} with model {self.model_id}")

    def _create_agent(self) -> Agent:
        """Create the PydanticAI agent with proper configuration"""
        return Agent(
            model=self.model_id,
            system_prompt=self.env_system_prompt or self.system_prompt,
            deps_type=None,
            output_type=self.get_output_type()
        )


    @abstractmethod
    def get_output_type(self) -> Type[T]:
        """Get the output type for this agent"""
        pass

    @abstractmethod
    async def process_input(self, input_data: Dict[str, Any]) -> str:
        """Process input data and return prompt"""
        pass

    async def execute(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute the agent with the provided input data.

        Args:
            input_data: Input data for the agent

        Returns:
            Dict containing the execution result or error information
        """
        start_time = time.time()
        attempt_count = 0
        last_error = None

        while attempt_count < self.max_retries:
            attempt_count += 1

            try:
                logger.debug(f"Executing {self.agent_id} (attempt {attempt_count}/{self.max_retries})")

                # Process input and get prompt
                prompt = await self.process_input(input_data)

                # Execute the agent
                result = await self.agent.run(prompt)

                # Debug: Log the raw result from PydanticAI
                logger.info(f"🔍 Raw PydanticAI result: {result}")
                logger.info(f"🔍 Result type: {type(result)}")
                if hasattr(result, 'data'):
                    logger.info(f"🔍 Result.data: {result.data}")
                    logger.info(f"🔍 Result.data type: {type(result.data)}")
                else:
                    logger.warning(f"⚠️ Result has no 'data' attribute")

                # Check if result.data is None or empty
                if not result.data:
                    logger.error(f"❌ PydanticAI returned empty result.data for {self.agent_id}")
                    logger.error(f"❌ Full result object: {vars(result) if hasattr(result, '__dict__') else result}")
                    # Try to extract any error information
                    if hasattr(result, 'error'):
                        logger.error(f"❌ Result error: {result.error}")
                    raise RuntimeError(f"PydanticAI agent {self.agent_id} returned empty result.data")

                # Validate result
                validated_result = self._validate_result(result.data)

                # Calculate execution time
                execution_time = (time.time() - start_time) * 1000

                # Extract metadata
                metadata = self._extract_metadata(result, execution_time, attempt_count)

                # Extract detailed usage for precise accounting (if available)
                usage_details = self._extract_usage_dict(result)

                logger.info(f"Execution completed successfully for {self.agent_id}", extra={
                    "agent_id": self.agent_id,
                    "execution_time": execution_time,
                    "attempt_count": attempt_count,
                    "tokens_used": metadata.tokensUsed,
                    "model_used": metadata.modelUsed
                })

                # Track successful execution (no-op)
                track_agent_execution(
                    agent_name=self.agent_id,
                    operation="execute",
                    duration_ms=float(execution_time),
                    success=True,
                    input_data=self._sanitize_input(input_data),
                    output_data={"type": "success", "output_type": str(type(validated_result).__name__)},
                    metadata={
                        "model_used": metadata.modelUsed,
                        "tokens_used": metadata.tokensUsed,
                        "attempt_count": attempt_count,
                        "fallback_used": metadata.fallbackUsed
                    }
                )

                track_model_usage(
                    provider=self.provider_id,
                    model_id=metadata.modelUsed,
                    operation="agent_execution",
                    tokens_used=metadata.tokensUsed,
                    duration_ms=float(execution_time),
                    success=True,
                    metadata={
                        "agent_id": self.agent_id,
                        "attempt_count": attempt_count
                    }
                )

                # Return successful result
                return {
                    "result": validated_result,
                    "metadata": metadata,
                    "usage": usage_details,
                    "execution_time": execution_time,
                    "attempt_count": attempt_count,
                    "agent_id": self.agent_id,
                    # TypeScript compatibility fields
                    "model_used": metadata.modelUsed,
                    "tokens_used": metadata.tokensUsed,
                    "modelUsed": metadata.modelUsed,
                    "tokensUsed": metadata.tokensUsed
                }

            except ValidationError as e:
                last_error = AgentValidationError(f"Response validation failed: {str(e)}")
                logger.error(f"Validation error for {self.agent_id}: {str(e)}")
            except Exception as e:
                last_error = AgentExecutionError(f"Agent execution failed: {str(e)}")
                logger.error(f"Execution error for {self.agent_id}: {str(e)}")

                # If it's a critical error, don't retry
                if "authentication" in str(e).lower() or "api_key" in str(e).lower():
                    break

            if attempt_count < self.max_retries:
                wait_time = 2 ** attempt_count  # Exponential backoff
                logger.info(f"Retrying {self.agent_id} in {wait_time} seconds...")
                await asyncio.sleep(wait_time)

        # Calculate final execution time
        execution_time = (time.time() - start_time) * 1000

        logger.error(f"All attempts failed for {self.agent_id}: {str(last_error)}")

        # Track failed execution (no-op)
        if last_error:
            track_error(
                error=last_error,
                context=f"Agent execution failed after {attempt_count} attempts",
                agent_name=self.agent_id,
                operation="execute",
                metadata={
                    "execution_time": execution_time,
                    "attempt_count": attempt_count,
                    "input_data": self._sanitize_input(input_data)
                }
            )
            track_agent_execution(
                agent_name=self.agent_id,
                operation="execute",
                duration_ms=float(execution_time),
                success=False,
                input_data=self._sanitize_input(input_data),
                output_data={"type": "error", "error": str(last_error)},
                metadata={
                    "attempt_count": attempt_count,
                    "final_error": str(last_error)
                }
            )

        # Return error response
        return {
            "error": str(last_error),
            "execution_time": execution_time,
            "attempt_count": attempt_count,
            "agent_id": self.agent_id,
            # TypeScript compatibility fields for error cases
            "model_used": self._extract_model_used(None),
            "tokens_used": 0,
            "modelUsed": self._extract_model_used(None),
            "tokensUsed": 0
        }

    def _extract_model_used(self, result: Any) -> str:
        """Extract model name from configured model or ChatModel object.

        - If model_id is a provider-qualified string like 'openai:gpt-4.1-mini', return 'gpt-4.1-mini'.
        - If model_id is a ChatModel object (e.g., Perplexity via OpenAIProvider), prefer a tag '_serplexity_model_id'.
        - Fallback to common attributes (model, name) or the string representation.
        """
        try:
            # String case: provider-qualified
            if isinstance(self.model_id, str):
                return self.model_id.split(':', 1)[1] if ':' in self.model_id else self.model_id

            # Object case (e.g., PydanticAI ChatModel)
            obj = self.model_id
            # Prefer explicit tag we add when constructing Perplexity ChatModel
            tagged = getattr(obj, '_serplexity_model_id', None)
            if isinstance(tagged, str) and tagged:
                return tagged

            # Inspect provider details to identify Perplexity
            provider_obj = getattr(obj, 'provider', None)
            if provider_obj is not None:
                # Direct base_url attribute
                base_url = getattr(provider_obj, 'base_url', None)
                if isinstance(base_url, str) and 'api.perplexity.ai' in base_url:
                    return 'sonar'
                # Nested client with base_url
                client = getattr(provider_obj, 'client', None)
                nested_base_url = getattr(client, 'base_url', None)
                if isinstance(nested_base_url, str) and 'api.perplexity.ai' in nested_base_url:
                    return 'sonar'
                # As a last resort, check repr
                prov_repr = repr(provider_obj)
                if 'api.perplexity.ai' in prov_repr or 'Perplexity' in prov_repr:
                    return 'sonar'

            # Try common attributes on ChatModel
            for attr in ('model', 'name', 'id'):
                val = getattr(obj, attr, None)
                if isinstance(val, str) and val:
                    return val

            # Fallback: clean repr
            obj_repr = repr(obj)
            if 'api.perplexity.ai' in obj_repr or 'Perplexity' in obj_repr or 'OpenAIProvider' in obj_repr:
                return 'sonar'
            return str(obj)
        except Exception:
            # Final fallback
            return str(self.model_id)

    def _extract_tokens_used(self, result: Any) -> int:
        """Extract token usage from PydanticAI result"""
        try:
            # PydanticAI result structure: result.usage() method returns usage info
            if hasattr(result, 'usage'):
                if callable(result.usage):
                    # usage is a method, call it to get usage info
                    usage = result.usage()
                    if usage and hasattr(usage, 'total_tokens') and usage.total_tokens is not None:
                        return int(usage.total_tokens)
                    elif usage and hasattr(usage, 'request_tokens') and hasattr(usage, 'response_tokens'):
                        req_tokens = getattr(usage, 'request_tokens', 0) or 0
                        resp_tokens = getattr(usage, 'response_tokens', 0) or 0
                        return int(req_tokens + resp_tokens)
                else:
                    # usage is a property
                    usage = result.usage
                    if usage and hasattr(usage, 'total_tokens') and usage.total_tokens is not None:
                        return int(usage.total_tokens)
                    elif usage and hasattr(usage, 'request_tokens') and hasattr(usage, 'response_tokens'):
                        req_tokens = getattr(usage, 'request_tokens', 0) or 0
                        resp_tokens = getattr(usage, 'response_tokens', 0) or 0
                        return int(req_tokens + resp_tokens)

            # Fallback: try direct token_usage attribute
            if hasattr(result, 'token_usage') and result.token_usage is not None:
                return int(result.token_usage)

            # If no token usage found, return 0 (this is acceptable for tests)
            return 0
        except Exception:
            # On any unexpected structure, default to 0 tokens
            return 0

    def _extract_usage_dict(self, result: Any) -> Optional[Dict[str, int]]:
        """Extract detailed token usage if available from provider result"""
        try:
            usage_obj = None
            if hasattr(result, 'usage'):
                usage_attr = getattr(result, 'usage')
                usage_obj = usage_attr() if callable(usage_attr) else usage_attr

            if not usage_obj:
                return None

            # Normalize common fields across providers
            prompt_tokens = (
                getattr(usage_obj, 'prompt_tokens', None)
                or getattr(usage_obj, 'request_tokens', None)
                or getattr(usage_obj, 'input_tokens', None)
            )
            completion_tokens = (
                getattr(usage_obj, 'completion_tokens', None)
                or getattr(usage_obj, 'response_tokens', None)
                or getattr(usage_obj, 'output_tokens', None)
            )
            total_tokens = getattr(usage_obj, 'total_tokens', None)

            usage: Dict[str, int] = {}
            if prompt_tokens is not None:
                usage['prompt_tokens'] = int(prompt_tokens)  # type: ignore[arg-type]
            if completion_tokens is not None:
                usage['completion_tokens'] = int(completion_tokens)  # type: ignore[arg-type]
            if total_tokens is not None:
                usage['total_tokens'] = int(total_tokens)  # type: ignore[arg-type]

            # Optional extras if present
            if hasattr(usage_obj, 'cache_read_tokens'):
                try:
                    usage['cache_read_tokens'] = int(getattr(usage_obj, 'cache_read_tokens') or 0)
                except Exception:
                    pass
            if hasattr(usage_obj, 'cache_write_tokens'):
                try:
                    usage['cache_write_tokens'] = int(getattr(usage_obj, 'cache_write_tokens') or 0)
                except Exception:
                    pass

            # Some providers expose 'reasoning_tokens' or similar fields
            if hasattr(usage_obj, 'reasoning_tokens'):
                try:
                    usage['thinking_tokens'] = int(getattr(usage_obj, 'reasoning_tokens') or 0)
                except Exception:
                    pass

            return usage or None
        except (ValueError, TypeError, AttributeError) as e:
            logger.error(f"Error extracting tokens from result: {e}")
            return None
        except Exception:
            return None

    def _extract_fallback_used(self, result: Any) -> bool:
        """Check if fallback model was used - always False since we removed fallbacks"""
        return False

    def _extract_metadata(self, result: Any, execution_time: float, attempt_count: int) -> AgentExecutionMetadata:
        """Extract metadata from agent execution result"""
        return AgentExecutionMetadata(
            agentId=self.agent_id,
            modelUsed=self._extract_model_used(result),
            tokensUsed=self._extract_tokens_used(result),
            executionTime=int(execution_time),  # Convert to int for milliseconds
            providerId=self.provider_id,
            attemptCount=attempt_count,
            fallbackUsed=self._extract_fallback_used(result),
            success=True
        )

    def _validate_result(self, result: Any) -> T:
        """Validate agent result against expected type"""
        expected_type = self.get_output_type()

        if isinstance(result, expected_type):
            return result
        elif isinstance(result, dict):
            # Try to create instance from dict
            try:
                return expected_type(**result)
            except Exception as e:
                raise ValidationError(f"Could not validate result as {expected_type.__name__}: {e}")
        else:
            raise ValidationError(f"Expected {expected_type.__name__}, got {type(result).__name__}")

    def _sanitize_input(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Sanitize input data for logging"""
        sanitized = {}
        for key, value in input_data.items():
            if any(sensitive in key.lower() for sensitive in ['password', 'token', 'key', 'secret']):
                sanitized[key] = "[REDACTED]"
            elif isinstance(value, str) and len(value) > 500:
                sanitized[key] = value[:500] + "... [truncated]"
            else:
                sanitized[key] = value
        return sanitized

async def main():
    """Main function for running agents from command line"""
    try:
        # Read input from stdin
        input_data = json.loads(sys.stdin.read())

        # Get agent class name from command line argument or environment
        agent_class_name = sys.argv[1] if len(sys.argv) > 1 else os.getenv('PYDANTIC_AGENT_CLASS')

        if not agent_class_name:
            raise ValueError("Agent class name not provided")

        # This will be overridden by specific agent implementations
        logger.error("BaseAgent cannot be run directly. Use specific agent implementations.")
        sys.exit(1)

    except Exception as e:
        logger.error(f"Agent execution failed: {str(e)}")
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
