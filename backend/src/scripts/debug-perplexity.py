#!/usr/bin/env python3
"""
Debug Perplexity Response Format
"""

import os
import json
import sys
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv(Path(__file__).parent.parent.parent / '.env')

# Add the parent directory to the path
sys.path.insert(0, str(Path(__file__).parent.parent))

from pydantic_ai.models.openai import OpenAIModel
from pydantic_ai.providers.openai import OpenAIProvider
from pydantic_ai import Agent
from pydantic_agents.schemas import QuestionResponse

async def test_perplexity_response():
    # Create Perplexity model
    model = OpenAIModel(
        'sonar',
        provider=OpenAIProvider(
            base_url='https://api.perplexity.ai',
            api_key=os.getenv('PERPLEXITY_API_KEY'),
        ),
    )
    
    # Create agent
    agent = Agent(
        model=model,
        system_prompt="You are a helpful assistant.",
    )
    
    # Test simple response first
    print("🔍 Testing simple response...")
    try:
        simple_result = await agent.run("What is 2+2?")
        print(f"✅ Simple response: {simple_result}")
        print(f"📊 Response type: {type(simple_result)}")
    except Exception as e:
        print(f"❌ Simple response failed: {e}")
    
    # Test with structured output
    print("\n🔍 Testing structured output...")
    try:
        structured_agent = Agent(
            model=model,
            system_prompt="You are a helpful assistant that provides structured responses.",
            output_type=QuestionResponse
        )
        
        # Test with a simple question
        test_input = "What are the benefits of project management software?"
        print(f"📤 Input: {test_input}")
        
        structured_result = await structured_agent.run(test_input)
        print(f"✅ Structured response: {structured_result}")
        print(f"📊 Response type: {type(structured_result)}")
        
        if hasattr(structured_result, 'model_dump'):
            print(f"🔍 Response data: {json.dumps(structured_result.model_dump(), indent=2, default=str)}")
            
    except Exception as e:
        print(f"❌ Structured response failed: {e}")
        import traceback
        print(f"📍 Traceback: {traceback.format_exc()}")
    
    # Test with enhanced prompt (like our agent uses)
    print("\n🔍 Testing enhanced prompt...")
    try:
        enhanced_prompt = """What are the key differences between Asana and Trello for project management?

IMPORTANT: Use your built-in web search capabilities to find current information. Include the source URLs in your response text for citation extraction.

Example format: "The key difference is...[1]. [1]https://example.com/article"

Please include actual URLs from your searches in the response text.

Please provide a comprehensive answer that includes:
1. A clear, direct response to the question
2. Relevant supporting information with <brand> tags for all company mentions
3. Examples or explanations where appropriate
4. Detailed citations for any web sources used
5. Proper <brand> tagging for ALL company, and service names

Remember: Every company, brand, or service name MUST be wrapped in <brand> tags."""
        
        print(f"📤 Enhanced input: {enhanced_prompt[:200]}...")
        
        enhanced_result = await structured_agent.run(enhanced_prompt)
        print(f"✅ Enhanced response: {enhanced_result}")
        
        if hasattr(enhanced_result, 'model_dump'):
            print(f"🔍 Enhanced response data: {json.dumps(enhanced_result.model_dump(), indent=2, default=str)}")
            
    except Exception as e:
        print(f"❌ Enhanced response failed: {e}")
        import traceback
        print(f"📍 Traceback: {traceback.format_exc()}")

if __name__ == "__main__":
    import asyncio
    asyncio.run(test_perplexity_response())