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

from pydantic_agents.schemas import AgentExecutionMetadata
from pydantic_agents.config.models import LLM_CONFIG

# Import logfire functions with lazy loading
from pydantic_agents.config.logfire_config import (
    setup_logfire,
    is_initialized,
    track_agent_execution,
    track_model_usage,
    track_error,
    is_logfire_available
)

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
        self.model_id = os.getenv('PYDANTIC_MODEL_ID', default_model)
        self.env_temperature = float(os.getenv('PYDANTIC_TEMPERATURE', str(self.temperature)))
        self.env_max_tokens = int(os.getenv('PYDANTIC_MAX_TOKENS', str(self.max_tokens)))
        self.env_system_prompt = os.getenv('PYDANTIC_SYSTEM_PROMPT', system_prompt)
        self.env_timeout = int(os.getenv('PYDANTIC_TIMEOUT', str(self.timeout)))
        
        # Initialize Logfire if available and not already initialized
        if is_logfire_available() and os.getenv('LOGFIRE_TOKEN') and not is_initialized():
            setup_logfire()
        
        # Initialize agent
        self.agent = self._create_agent()
        
        logger.info(f"Initialized {agent_id} with model {self.model_id}")
    
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
                logger.info(f"Executing {self.agent_id} (attempt {attempt_count}/{self.max_retries})")
                
                # Process input and get prompt
                prompt = await self.process_input(input_data)
                
                # Execute the agent
                result = await self.agent.run(prompt)
                
                # Validate result
                validated_result = self._validate_result(result.data)
                
                # Calculate execution time
                execution_time = (time.time() - start_time) * 1000
                
                # Extract metadata
                metadata = self._extract_metadata(result, execution_time, attempt_count)
                
                logger.info(f"Execution completed successfully for {self.agent_id}", extra={
                    "agent_id": self.agent_id,
                    "execution_time": execution_time,
                    "attempt_count": attempt_count,
                    "tokens_used": metadata.tokensUsed,
                    "model_used": metadata.modelUsed
                })
                
                # Track successful execution with Logfire
                if is_logfire_available() and is_initialized():
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
                
                # Return successful result
                return {
                    "result": validated_result,
                    "metadata": metadata,
                    "execution_time": execution_time,
                    "attempt_count": attempt_count,
                    "agent_id": self.agent_id
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
        
        # Track failed execution with Logfire
        if is_logfire_available() and is_initialized() and last_error:
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
            if hasattr(result, 'usage') and hasattr(result.usage, 'total_tokens'):
                return result.usage.total_tokens
            elif hasattr(result, 'token_usage'):
                return result.token_usage
            else:
                return 0
        except:
            return 0
    
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