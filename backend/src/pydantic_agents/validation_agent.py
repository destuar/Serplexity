#!/usr/bin/env python3
"""
Validation Agent for PydanticAI
Handles data generation with validation and transformation.
"""

import json
import sys
import os
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field
from pydantic_ai import Agent
from pydantic_ai.models import KnownModelName

class ValidationInput(BaseModel):
    prompt: str
    task: str
    validation_schema: Optional[Dict[str, Any]] = None
    transform_enabled: bool = False
    rescue_enabled: bool = False

class ValidationAgent:
    def __init__(self):
        # Get model configuration from environment
        model_id = os.getenv('PYDANTIC_MODEL_ID', 'openai:gpt-4o')
        
        # Create the agent
        self.agent = Agent(
            model=model_id,
            system_prompt=self._build_system_prompt()
        )
    
    def _build_system_prompt(self) -> str:
        return """You are a data validation and generation expert. Your task is to 
generate accurate, well-structured data that meets specific validation requirements.

Key responsibilities:
1. **Accuracy**: Generate correct and reliable data
2. **Validation**: Ensure output meets schema requirements
3. **Consistency**: Maintain data consistency across fields
4. **Completeness**: Provide all required fields and information
5. **Quality**: Focus on high-quality, meaningful data

When generating data:
- Follow schema constraints exactly
- Ensure data types are correct
- Validate ranges and constraints
- Use realistic, meaningful values
- Maintain logical relationships between fields

For validation tasks:
- Parse and validate input data
- Apply transformation rules when specified
- Handle edge cases gracefully
- Provide clear error messages for invalid data

Always prioritize data quality and schema compliance."""
    
    async def validate_and_generate(self, input_data: ValidationInput) -> Dict[str, Any]:
        """Generate and validate data according to the provided schema."""
        
        # Build the prompt
        prompt_parts = [
            f"Task: {input_data.task}",
            f"Request: {input_data.prompt}"
        ]
        
        if input_data.validation_schema:
            prompt_parts.append(f"Schema Requirements: {json.dumps(input_data.validation_schema, indent=2)}")
        
        if input_data.transform_enabled:
            prompt_parts.append("Transformation: Apply any necessary data transformations")
        
        if input_data.rescue_enabled:
            prompt_parts.append("Rescue Mode: Attempt to recover from data inconsistencies")
        
        prompt_parts.append("""
Please generate data that:
1. Meets all schema requirements
2. Is accurate and realistic
3. Follows proper data types and constraints
4. Maintains logical consistency
5. Provides meaningful, useful information

Return the data in JSON format that matches the schema exactly.
""")
        
        prompt = "\n\n".join(prompt_parts)
        
        # Run the agent
        result = await self.agent.run(prompt)
        
        # Parse the result
        try:
            if isinstance(result.data, str):
                parsed_result = json.loads(result.data)
            else:
                parsed_result = result.data
            
            return parsed_result
        except (json.JSONDecodeError, AttributeError):
            # Return a structured error response
            return {
                "error": "Failed to parse agent response",
                "raw_response": str(result.data),
                "task": input_data.task
            }

def main():
    """Main entry point for the validation agent."""
    try:
        # Read input from stdin
        input_data = json.loads(sys.stdin.read())
        
        # Validate input
        validation_input = ValidationInput(**input_data)
        
        # Create agent
        agent = ValidationAgent()
        
        # Process the validation request
        import asyncio
        result = asyncio.run(agent.validate_and_generate(validation_input))
        
        # Prepare output
        output = {
            "data": result,
            "model_used": os.getenv('PYDANTIC_MODEL_ID', 'openai:gpt-4o'),
            "tokens_used": len(str(result)) * 1.2,  # Estimated token usage
            "task": validation_input.task,
            "validation_applied": bool(validation_input.validation_schema),
            "transform_enabled": validation_input.transform_enabled,
            "rescue_enabled": validation_input.rescue_enabled
        }
        
        # Output result
        print(json.dumps(output, indent=2))
        
    except Exception as e:
        error_output = {
            "error": str(e),
            "type": "validation_agent_error",
            "model_used": os.getenv('PYDANTIC_MODEL_ID', 'openai:gpt-4o'),
            "tokens_used": 0
        }
        print(json.dumps(error_output, indent=2))
        sys.exit(1)

if __name__ == "__main__":
    main()