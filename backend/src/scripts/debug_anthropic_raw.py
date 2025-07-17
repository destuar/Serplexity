#!/usr/bin/env python3
"""
Debug Anthropic Raw Response
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

from pydantic_agents.config.web_search_config import WebSearchConfig
from pydantic_ai import Agent
from pydantic_agents.schemas import SentimentScores

async def debug_anthropic_raw():
    """Debug raw Anthropic response to see if web search is working"""
    
    print("🔍 Debugging Anthropic Web Search Raw Response")
    print("=" * 60)
    
    # Test web search config
    config = WebSearchConfig.for_task("sentiment", "anthropic")
    print(f"✅ Web search config created")
    print(f"   - Enabled: {config.is_enabled()}")
    print(f"   - Tools count: {len(config.get_tools())}")
    print(f"   - Provider available: {config._provider_available()}")
    
    if config.get_tools():
        tool = config.get_tools()[0]
        print(f"   - Tool name: {tool.name}")
        print(f"   - Tool description: {tool.description}")
    
    # Create a simple agent with web search
    try:
        agent = Agent(
            model="anthropic:claude-3-5-haiku-20241022",
            system_prompt="""You are a sentiment analysis expert with web search capabilities. 
            When you use web search, include the URLs in your response text.
            
            Search for information about the company and provide sentiment scores (1-10) for:
            - Quality
            - Price Value  
            - Brand Reputation
            - Brand Trust
            - Customer Service
            
            Include URLs from your searches in the response text.""",
            tools=config.get_tools() if config.get_tools() else []
        )
        
        print(f"\n✅ Agent created with {len(config.get_tools())} tools")
        
        # Test prompt
        test_prompt = """Analyze sentiment for Slack (team communication software). 
        Use web search to find current reviews, pricing feedback, and brand reputation information.
        
        Provide scores 1-10 for each dimension with examples from your search results.
        Include the source URLs in your response text."""
        
        print(f"\n📤 Sending test prompt...")
        print(f"Prompt: {test_prompt[:200]}...")
        
        # Execute
        result = await agent.run(test_prompt)
        
        print(f"\n📥 Raw result type: {type(result)}")
        
        if hasattr(result, 'data'):
            print(f"📥 Result data: {result.data}")
        
        # Try to get text content
        result_text = ""
        if hasattr(result, 'data') and hasattr(result.data, 'summaryDescription'):
            result_text = result.data.summaryDescription
        elif hasattr(result, 'text'):
            result_text = result.text
        elif hasattr(result, 'content'):
            result_text = result.content
        else:
            result_text = str(result)
        
        print(f"\n📝 Result text (length: {len(result_text)}):")
        print(f"{result_text}")
        
        # Check for URLs
        import re
        urls = re.findall(r'https?://[^\s\]\)]+', result_text)
        print(f"\n🔗 URLs found: {len(urls)}")
        for url in urls:
            print(f"   - {url}")
        
        # Check for web search indicators
        search_indicators = [
            "search", "found", "according to", "based on", 
            "reviews show", "data indicates", "sources indicate"
        ]
        
        found_indicators = []
        for indicator in search_indicators:
            if indicator.lower() in result_text.lower():
                found_indicators.append(indicator)
        
        print(f"\n🔍 Web search indicators found: {found_indicators}")
        
    except Exception as e:
        print(f"❌ Debug failed: {str(e)}")
        import traceback
        print(f"📍 Traceback: {traceback.format_exc()}")

if __name__ == "__main__":
    import asyncio
    asyncio.run(debug_anthropic_raw())