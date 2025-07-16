#!/usr/bin/env python3
"""
Question Answering Agent for PydanticAI
Handles comprehensive question answering with structured output.
"""

import json
import sys
import os
from typing import Optional, List
from pydantic import BaseModel, Field
from pydantic_ai import Agent
from pydantic_ai.models import KnownModelName

class QuestionInput(BaseModel):
    question: str
    system_prompt: Optional[str] = None
    context: Optional[str] = None
    question_id: Optional[str] = None

class QuestionResponse(BaseModel):
    response: str = Field(min_length=1, description="The answer to the question")
    confidence: Optional[float] = Field(ge=0.0, le=1.0, description="Confidence score for the response")
    sources: Optional[List[str]] = Field(default=None, description="Sources or references used")

class QuestionAnsweringAgent:
    def __init__(self):
        # Get model configuration from environment
        model_id = os.getenv('PYDANTIC_MODEL_ID', 'openai:gpt-4o')
        
        # Create the agent
        self.agent = Agent(
            model=model_id,
            result_type=QuestionResponse,
            system_prompt=self._build_system_prompt()
        )
    
    def _build_system_prompt(self) -> str:
        return """You are a knowledgeable and helpful assistant that provides comprehensive, 
accurate answers to questions. Your responses should be:

1. **Accurate and Informative**: Provide correct, up-to-date information
2. **Well-structured**: Organize your response clearly with proper formatting
3. **Comprehensive**: Cover all relevant aspects of the question
4. **Professional**: Maintain a professional and helpful tone
5. **Contextual**: Use any provided context to enhance your response
6. **Honest**: If you're uncertain, acknowledge limitations

Response guidelines:
- Provide direct answers to the question asked
- Include relevant details and examples when helpful
- Structure longer responses with clear sections
- Cite sources when specific facts are mentioned
- Indicate confidence level in your response

Always strive to be helpful while maintaining accuracy and professionalism."""
    
    async def answer_question(self, input_data: QuestionInput) -> QuestionResponse:
        """Generate a comprehensive answer to the provided question."""
        
        # Build the prompt with context
        prompt_parts = []
        
        # Add system prompt override if provided
        if input_data.system_prompt:
            prompt_parts.append(f"System Instructions: {input_data.system_prompt}")
        
        # Add context if provided
        if input_data.context:
            prompt_parts.append(f"Context: {input_data.context}")
        
        # Add the main question
        prompt_parts.append(f"Question: {input_data.question}")
        
        # Additional instructions for structured output
        prompt_parts.append("""
Please provide a comprehensive answer that includes:
1. A clear, direct response to the question
2. Relevant supporting information
3. Examples or explanations where appropriate
4. A confidence score (0.0-1.0) for your response
5. Any relevant sources or references if applicable
""")
        
        prompt = "\n\n".join(prompt_parts)
        
        # Run the agent
        result = await self.agent.run(prompt)
        
        return result.data

def main():
    """Main entry point for the question answering agent."""
    try:
        # Read input from stdin
        input_data = json.loads(sys.stdin.read())
        
        # Validate input
        question_input = QuestionInput(**input_data)
        
        # Create agent
        agent = QuestionAnsweringAgent()
        
        # Process the question
        import asyncio
        result = asyncio.run(agent.answer_question(question_input))
        
        # Prepare output
        output = {
            "data": result.model_dump(),
            "model_used": os.getenv('PYDANTIC_MODEL_ID', 'openai:gpt-4o'),
            "tokens_used": len(result.response.split()) * 1.3,  # Estimated token usage
            "question_id": question_input.question_id,
            "confidence": result.confidence or 0.8
        }
        
        # Output result
        print(json.dumps(output, indent=2))
        
    except Exception as e:
        error_output = {
            "error": str(e),
            "type": "question_answering_error",
            "model_used": os.getenv('PYDANTIC_MODEL_ID', 'openai:gpt-4o'),
            "tokens_used": 0
        }
        print(json.dumps(error_output, indent=2))
        sys.exit(1)

if __name__ == "__main__":
    main()