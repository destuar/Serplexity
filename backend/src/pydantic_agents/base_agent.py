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
from pydantic_ai.models import FallbackModel

from .schemas import AgentExecutionMetadata

# Logfire instrumentation
try:
    from .logfire_config import (
        setup_logfire, 
        is_initialized, 
        track_agent_execution,
        track_model_usage,
        track_error
    )
    LOGFIRE_AVAILABLE = True
except ImportError:
    LOGFIRE_AVAILABLE = False

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.StreamHandler(sys.stderr)
    ]
)

logger = logging.getLogger(__name__)

T = TypeVar('T', bound=BaseModel)

class BaseAgentError(Exception):
    """Base exception for agent errors"""
    pass

class ProviderError(BaseAgentError):
    """Error related to LLM provider"""
    pass

class ValidationError(BaseAgentError):
    """Error related to response validation"""
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
        default_model: str = "openai:gpt-4o",
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        timeout: int = 30000,
        max_retries: int = 3
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
        self.temperature = temperature
        self.max_tokens = max_tokens
        self.timeout = timeout
        self.max_retries = max_retries
        
        # Get configuration from environment
        self.provider_id = os.getenv('PYDANTIC_PROVIDER_ID', 'openai')
        self.model_id = os.getenv('PYDANTIC_MODEL_ID', default_model)
        self.env_temperature = float(os.getenv('PYDANTIC_TEMPERATURE', str(temperature)))
        self.env_max_tokens = int(os.getenv('PYDANTIC_MAX_TOKENS', str(max_tokens or 2000)))
        self.env_system_prompt = os.getenv('PYDANTIC_SYSTEM_PROMPT', system_prompt)
        self.env_timeout = int(os.getenv('PYDANTIC_TIMEOUT', str(timeout)))
        
        # Initialize Logfire if available
        if LOGFIRE_AVAILABLE and os.getenv('LOGFIRE_TOKEN'):
            setup_logfire()
        
        # Initialize agent
        self.agent = self._create_agent()
        
        logger.info(f"Initialized {agent_id} with model {self.model_id}")
    
    def _create_agent(self) -> Agent:
        """Create the PydanticAI agent with proper configuration"""
        
        # Create fallback model if multiple providers are available
        fallback_models = self._get_fallback_models()
        
        if len(fallback_models) > 1:
            model = FallbackModel(fallback_models)
        else:
            model = fallback_models[0] if fallback_models else self.model_id
        
        return Agent(
            model=model,
            system_prompt=self.env_system_prompt or self.system_prompt,
            deps_type=None,
            result_type=self.get_result_type()
        )
    
    def _get_fallback_models(self) -> List[str]:
        """Get list of fallback models based on available providers"""
        fallback_models = []
        
        # Primary model
        fallback_models.append(self.model_id)
        
        # Add fallback models based on available API keys
        if os.getenv('OPENAI_API_KEY') and self.provider_id != 'openai':
            fallback_models.append('openai:gpt-4o')
        
        if os.getenv('ANTHROPIC_API_KEY') and self.provider_id != 'anthropic':
            fallback_models.append('anthropic:claude-3-sonnet-20240229')
        
        if os.getenv('GEMINI_API_KEY') and self.provider_id != 'gemini':
            fallback_models.append('gemini:gemini-1.5-pro')
        
        if os.getenv('PERPLEXITY_API_KEY') and self.provider_id != 'perplexity':
            fallback_models.append('perplexity:llama-3.1-sonar-small-128k-online')
        
        return fallback_models
    
    @abstractmethod
    def get_result_type(self) -> Type[T]:
        """Get the result type for this agent"""
        pass
    
    @abstractmethod
    async def process_input(self, input_data: Dict[str, Any]) -> str:
        """Process input data and return prompt"""
        pass
    
    async def execute(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute the agent with comprehensive error handling.
        
        Args:
            input_data: Input data for the agent
            
        Returns:
            Dictionary containing result data and metadata
        """
        start_time = time.time()
        attempt_count = 0
        last_error = None
        
        logger.info(f"Starting execution for {self.agent_id}", extra={
            "agent_id": self.agent_id,
            "input_data": self._sanitize_input(input_data)
        })
        
        for attempt in range(self.max_retries + 1):
            attempt_count += 1
            try:
                # Process input to create prompt
                prompt = await self.process_input(input_data)
                
                # Execute agent
                result = await self.agent.run(prompt)
                
                # Calculate execution time
                execution_time = int((time.time() - start_time) * 1000)
                
                # Create metadata
                metadata = AgentExecutionMetadata(
                    agentId=self.agent_id,
                    modelUsed=self._extract_model_used(result),
                    tokensUsed=self._extract_tokens_used(result),
                    executionTime=execution_time,
                    providerId=self.provider_id,
                    success=True,
                    attemptCount=attempt_count,
                    fallbackUsed=attempt_count > 1
                )
                
                # Validate result
                validated_result = self._validate_result(result.data)
                
                logger.info(f"Execution completed successfully for {self.agent_id}", extra={
                    "agent_id": self.agent_id,
                    "execution_time": execution_time,
                    "attempt_count": attempt_count,
                    "tokens_used": metadata.tokensUsed,
                    "model_used": metadata.modelUsed
                })
                
                # Track successful execution with Logfire
                if LOGFIRE_AVAILABLE and is_initialized():
                    track_agent_execution(
                        agent_name=self.agent_id,
                        operation="execute",
                        duration_ms=float(execution_time),
                        success=True,
                        input_data=self._sanitize_input(input_data),
                        output_data={"type": "success", "result_type": str(type(validated_result).__name__)},
                        metadata={
                            "model_used": metadata.modelUsed,
                            "tokens_used": metadata.tokensUsed,
                            "attempt_count": attempt_count,
                            "fallback_used": metadata.fallbackUsed
                        }
                    )
                    
                    # Track model usage
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
                
                return {
                    "data": validated_result.dict(),
                    "metadata": metadata.dict(),
                    "model_used": metadata.modelUsed,
                    "tokens_used": metadata.tokensUsed
                }
                
            except Exception as e:
                last_error = e
                execution_time = int((time.time() - start_time) * 1000)
                
                logger.warning(f"Attempt {attempt_count} failed for {self.agent_id}: {str(e)}", extra={
                    "agent_id": self.agent_id,
                    "attempt": attempt_count,
                    "error": str(e),
                    "execution_time": execution_time
                })
                
                # If this is the last attempt, break
                if attempt == self.max_retries:
                    break
                
                # Exponential backoff
                if attempt < self.max_retries:
                    delay = 2 ** attempt
                    logger.info(f"Retrying in {delay} seconds...")
                    await asyncio.sleep(delay)
        
        # If we get here, all attempts failed
        execution_time = int((time.time() - start_time) * 1000)
        
        logger.error(f"All attempts failed for {self.agent_id}", extra={
            "agent_id": self.agent_id,
            "attempt_count": attempt_count,
            "execution_time": execution_time,
            "final_error": str(last_error)
        })
        
        # Track failed execution with Logfire
        if LOGFIRE_AVAILABLE and is_initialized() and last_error:
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
            "agent_id": self.agent_id
        }
    
    def _extract_model_used(self, result: Any) -> str:
        """Extract model name from result"""
        try:
            if hasattr(result, 'model_name'):
                return result.model_name
            elif hasattr(result, '_model_name'):
                return result._model_name
            else:
                return self.model_id
        except:
            return self.model_id
    
    def _extract_tokens_used(self, result: Any) -> int:
        """Extract token usage from result"""
        try:
            if hasattr(result, 'usage'):
                if hasattr(result.usage, 'total_tokens'):
                    return result.usage.total_tokens
                elif hasattr(result.usage, 'input_tokens') and hasattr(result.usage, 'output_tokens'):
                    return result.usage.input_tokens + result.usage.output_tokens
            return 0
        except:
            return 0
    
    def _validate_result(self, result: Any) -> T:
        """Validate the result against the expected schema"""
        try:
            result_type = self.get_result_type()
            if isinstance(result, result_type):
                return result
            elif isinstance(result, dict):
                return result_type(**result)
            else:
                raise ValidationError(f"Unexpected result type: {type(result)}")
        except ValidationError as e:
            raise ValidationError(f"Result validation failed: {str(e)}")
    
    def _sanitize_input(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Sanitize input data for logging (remove sensitive information)"""
        sanitized = {}
        for key, value in input_data.items():
            if key.lower() in ['password', 'token', 'secret', 'api_key']:
                sanitized[key] = "[REDACTED]"
            elif isinstance(value, str) and len(value) > 100:
                sanitized[key] = value[:100] + "..."
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