#!/usr/bin/env python3
"""
Debug Anthropic Sentiment Response Format
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

from pydantic_agents.agents.web_search_sentiment_agent import WebSearchSentimentAgent

async def debug_anthropic_response():
    """Debug what Anthropic actually returns"""
    
    test_input = {
        "company_name": "Asana",
        "industry": "Project Management Software",
        "context": "Team productivity and project management platform",
        "enable_web_search": True
    }
    
    print("🔍 Debugging Anthropic Sentiment Response Format")
    print("=" * 60)
    
    try:
        # Create Anthropic agent
        agent = WebSearchSentimentAgent(provider="anthropic", enable_web_search=True)
        print(f"✅ Agent created with model: {agent.model_id}")
        print(f"🔧 Web search config enabled: {agent.web_search_config.is_enabled()}")
        print(f"🛠️ Web search tools count: {len(agent.web_search_config.get_tools())}")
        
        # Get the prompt that will be sent
        prompt = await agent.process_input(test_input)
        print(f"\n📤 Prompt being sent (first 500 chars):")
        print(f"{prompt[:500]}...")
        
        # Execute the agent but catch the result before final processing
        print(f"\n🚀 Executing agent...")
        result = await agent.execute(test_input)
        
        if 'error' in result:
            print(f"❌ Execution failed: {result['error']}")
            return
            
        # Get the raw result
        sentiment_data = result['result']
        print(f"\n📊 Result type: {type(sentiment_data)}")
        print(f"📊 Company: {sentiment_data.companyName}")
        print(f"📊 Industry: {sentiment_data.industry}")
        print(f"📊 Ratings count: {len(sentiment_data.ratings)}")
        
        if sentiment_data.ratings:
            rating = sentiment_data.ratings[0]
            print(f"\n⭐ Ratings:")
            print(f"   Quality: {rating.quality}/10")
            print(f"   Price Value: {rating.priceValue}/10") 
            print(f"   Brand Reputation: {rating.brandReputation}/10")
            print(f"   Brand Trust: {rating.brandTrust}/10")
            print(f"   Customer Service: {rating.customerService}/10")
            print(f"\n📝 Summary (length: {len(rating.summaryDescription)}):")
            print(f"{rating.summaryDescription}")
            
            # Check for URLs in the summary
            import re
            urls = re.findall(r'https?://[^\s\]\)]+', rating.summaryDescription)
            print(f"\n🔗 URLs found in summary: {len(urls)}")
            for url in urls:
                print(f"   - {url}")
                
            # Check for citation patterns
            citation_patterns = [
                r'\[\d+\]',  # [1], [2], etc.
                r'Source:',
                r'References:',
                r'site:',
                r'According to',
                r'Based on'
            ]
            
            print(f"\n🔍 Citation patterns found:")
            for pattern in citation_patterns:
                matches = re.findall(pattern, rating.summaryDescription, re.IGNORECASE)
                if matches:
                    print(f"   - '{pattern}': {len(matches)} matches")
        
        # Check web search metadata
        if sentiment_data.webSearchMetadata:
            metadata = sentiment_data.webSearchMetadata
            print(f"\n🌐 Web Search Metadata:")
            print(f"   Search enabled: {metadata.search_enabled}")
            print(f"   Total searches: {metadata.total_searches}")
            print(f"   Provider used: {metadata.provider_used}")
            print(f"   Queries performed: {len(metadata.queries_performed)}")
            print(f"   Sources found: {len(metadata.sources_found)}")
            
            if metadata.sources_found:
                print(f"   Source domains: {[s.domain for s in metadata.sources_found]}")
        
    except Exception as e:
        print(f"❌ Debug failed: {str(e)}")
        import traceback
        print(f"📍 Traceback: {traceback.format_exc()}")

if __name__ == "__main__":
    import asyncio
    asyncio.run(debug_anthropic_response())