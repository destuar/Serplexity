#!/usr/bin/env python3
"""
Text Agent for PydanticAI
Handles simple text generation tasks.
"""

import json
import sys
import os
from typing import Optional
from pydantic import BaseModel, Field
from pydantic_ai import Agent
from pydantic_ai.models import KnownModelName

class TextInput(BaseModel):
    prompt: str
    structured: bool = False

class TextResponse(BaseModel):
    response: str = Field(min_length=1, description="The generated text response")

class TextAgent:
    def __init__(self):
        # Get model configuration from environment
        model_id = os.getenv('PYDANTIC_MODEL_ID', 'openai:gpt-4o')
        
        # Create the agent
        self.agent = Agent(
            model=model_id,
            result_type=TextResponse,
            system_prompt=self._build_system_prompt()
        )
    
    def _build_system_prompt(self) -> str:
        return """You are a helpful AI assistant focused on generating clear, 
accurate, and useful text responses. Your responses should be:

1. **Relevant**: Directly address the user's request
2. **Clear**: Use clear, understandable language
3. **Helpful**: Provide useful information and insights
4. **Appropriate**: Match the tone and style to the context
5. **Complete**: Provide comprehensive answers when needed

Guidelines:
- Answer questions directly and thoroughly
- Provide examples when helpful
- Structure longer responses with clear organization
- Be concise but comprehensive
- Maintain a helpful and professional tone

Always strive to be helpful while providing accurate information."""
    
    async def generate_text(self, input_data: TextInput) -> TextResponse:
        """Generate a text response to the provided prompt."""
        
        # Run the agent with the prompt
        result = await self.agent.run(input_data.prompt)
        
        return result.data

def main():
    """Main entry point for the text agent."""
    try:
        # Read input from stdin
        input_data = json.loads(sys.stdin.read())
        
        # Validate input
        text_input = TextInput(**input_data)
        
        # Create agent
        agent = TextAgent()
        
        # Process the text generation
        import asyncio
        result = asyncio.run(agent.generate_text(text_input))
        
        # Prepare output
        output = {
            "data": result.model_dump(),
            "model_used": os.getenv('PYDANTIC_MODEL_ID', 'openai:gpt-4o'),
            "tokens_used": len(result.response.split()) * 1.3,  # Estimated token usage
            "structured": text_input.structured
        }
        
        # Output result
        print(json.dumps(output, indent=2))
        
    except Exception as e:
        error_output = {
            "error": str(e),
            "type": "text_generation_error",
            "model_used": os.getenv('PYDANTIC_MODEL_ID', 'openai:gpt-4o'),
            "tokens_used": 0
        }
        print(json.dumps(error_output, indent=2))
        sys.exit(1)

if __name__ == "__main__":
    main()