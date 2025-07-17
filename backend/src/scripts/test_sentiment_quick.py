#!/usr/bin/env python3
"""
Quick Test Web Search Sentiment Agent
"""

import os
import json
import sys
import asyncio
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv(Path(__file__).parent.parent.parent / '.env')

# Add the parent directory to the path
sys.path.insert(0, str(Path(__file__).parent.parent))

from pydantic_agents.agents.web_search_sentiment_agent import WebSearchSentimentAgent

async def test_one_provider(provider="perplexity"):
    """Test one provider quickly"""
    
    test_input = {
        "company_name": "Slack",
        "industry": "Communication Software", 
        "context": "Team collaboration platform",
        "enable_web_search": True
    }
    
    print(f"🧪 Testing {provider.upper()} Web Search Sentiment Agent")
    print("=" * 50)
    
    try:
        # Create agent for this provider
        agent = WebSearchSentimentAgent(provider=provider, enable_web_search=True)
        print(f"✅ Agent created with model: {agent.model_id}")
        
        # Execute the agent
        print(f"🚀 Executing sentiment analysis...")
        result = await agent.execute(test_input)
        
        if 'error' in result:
            print(f"❌ {provider} failed: {result['error']}")
            return False
        else:
            sentiment_data = result['result']
            execution_time = result.get('execution_time', 0)
            
            # Extract key metrics
            ratings = sentiment_data.ratings[0] if sentiment_data.ratings else None
            web_search_metadata = sentiment_data.webSearchMetadata
            
            citations_count = len(web_search_metadata.sources_found) if web_search_metadata else 0
            search_enabled = web_search_metadata.search_enabled if web_search_metadata else False
            
            print(f"✅ {provider} completed successfully!")
            print(f"   - Execution time: {execution_time:.0f}ms")
            print(f"   - Web search enabled: {search_enabled}")
            print(f"   - Citations found: {citations_count}")
            
            if ratings:
                print(f"   - Quality: {ratings.quality}/10")
                print(f"   - Price Value: {ratings.priceValue}/10")
                print(f"   - Brand Reputation: {ratings.brandReputation}/10")
                print(f"   - Brand Trust: {ratings.brandTrust}/10")
                print(f"   - Customer Service: {ratings.customerService}/10")
                print(f"   - Summary length: {len(ratings.summaryDescription)} chars")
                print(f"   - Summary preview: {ratings.summaryDescription[:200]}...")
                
                # Check for citations in summary
                if "Sources:" in ratings.summaryDescription or "References:" in ratings.summaryDescription:
                    print(f"   ✅ Citations found in summary")
                else:
                    print(f"   ❌ No citations found in summary")
            
            if web_search_metadata:
                print(f"   - Total searches: {web_search_metadata.total_searches}")
                print(f"   - Provider used: {web_search_metadata.provider_used}")
                
                if web_search_metadata.sources_found:
                    print(f"   - Source domains: {[s.domain for s in web_search_metadata.sources_found[:3]]}")
                
            return True
            
    except Exception as e:
        print(f"❌ {provider} failed with exception: {str(e)}")
        import traceback
        print(f"📍 Traceback: {traceback.format_exc()}")
        return False

if __name__ == "__main__":
    # Test just Perplexity as it's the fastest
    provider = sys.argv[1] if len(sys.argv) > 1 else "perplexity"
    asyncio.run(test_one_provider(provider))