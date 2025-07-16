#!/usr/bin/env python3
"""
Generic Agent for PydanticAI
Handles general purpose structured output generation.
"""

import json
import sys
import os
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field
from pydantic_ai import Agent
from pydantic_ai.models import KnownModelName

class GenericInput(BaseModel):
    prompt: str
    output_schema: Optional[Dict[str, Any]] = None
    structured: bool = True

class GenericAgent:
    def __init__(self):
        # Get model configuration from environment
        model_id = os.getenv('PYDANTIC_MODEL_ID', 'openai:gpt-4o')
        
        # Create the agent without a fixed result type
        self.agent = Agent(
            model=model_id,
            system_prompt=self._build_system_prompt()
        )
    
    def _build_system_prompt(self) -> str:
        return """You are a versatile AI assistant capable of handling a wide variety of tasks 
with structured output. Your responses should be:

1. **Accurate**: Provide correct and reliable information
2. **Structured**: Follow the requested output format exactly
3. **Comprehensive**: Address all aspects of the request
4. **Clear**: Use clear, understandable language
5. **Relevant**: Stay focused on the specific request

When given a structured output requirement:
- Follow the schema exactly
- Ensure all required fields are provided
- Use appropriate data types
- Validate your output against the schema

When given a general prompt:
- Provide a helpful, comprehensive response
- Structure your answer logically
- Include relevant examples when appropriate
- Be concise but thorough"""
    
    async def process_generic_request(self, input_data: GenericInput) -> Dict[str, Any]:
        """Process a generic request with optional structured output."""
        
        if input_data.structured and input_data.output_schema:
            # Handle structured output
            prompt = f"""
{input_data.prompt}

Please provide a response that follows this schema structure:
{json.dumps(input_data.output_schema, indent=2)}

Ensure your response is valid JSON that matches the schema exactly.
"""
        else:
            # Handle simple text output
            prompt = input_data.prompt
        
        # Run the agent
        result = await self.agent.run(prompt)
        
        if input_data.structured:
            try:
                # Try to parse as JSON for structured output
                if isinstance(result.data, str):
                    parsed_result = json.loads(result.data)
                else:
                    parsed_result = result.data
                return parsed_result
            except (json.JSONDecodeError, AttributeError):
                # Fallback to string response
                return {"response": str(result.data)}
        else:
            return {"response": str(result.data)}

def main():
    """Main entry point for the generic agent."""
    try:
        # Read input from stdin
        input_data = json.loads(sys.stdin.read())
        
        # Validate input
        generic_input = GenericInput(**input_data)
        
        # Create agent
        agent = GenericAgent()
        
        # Process the generic request
        import asyncio
        result = asyncio.run(agent.process_generic_request(generic_input))
        
        # Prepare output
        output = {
            "data": result,
            "model_used": os.getenv('PYDANTIC_MODEL_ID', 'openai:gpt-4o'),
            "tokens_used": len(str(result)) * 1.2,  # Estimated token usage
            "structured": generic_input.structured
        }
        
        # Output result
        print(json.dumps(output, indent=2))
        
    except Exception as e:
        error_output = {
            "error": str(e),
            "type": "generic_agent_error",
            "model_used": os.getenv('PYDANTIC_MODEL_ID', 'openai:gpt-4o'),
            "tokens_used": 0
        }
        print(json.dumps(error_output, indent=2))
        sys.exit(1)

if __name__ == "__main__":
    main()