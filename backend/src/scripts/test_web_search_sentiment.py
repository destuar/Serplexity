#!/usr/bin/env python3
"""
Test Web Search Sentiment Agent with All Models
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

async def test_sentiment_agent_with_providers():
    """Test the web search sentiment agent with all 4 providers"""
    
    # Test data
    test_input = {
        "company_name": "Slack",
        "industry": "Communication Software",
        "context": "Team collaboration platform",
        "enable_web_search": True
    }
    
    providers = ["openai", "anthropic", "gemini", "perplexity"]
    
    print("🧪 Testing Web Search Sentiment Agent with All Providers")
    print("=" * 60)
    
    results = {}
    
    for provider in providers:
        print(f"\n🤖 Testing {provider.upper()} provider...")
        
        try:
            # Create agent for this provider
            agent = WebSearchSentimentAgent(provider=provider, enable_web_search=True)
            print(f"✅ Agent created with model: {agent.model_id}")
            
            # Execute the agent
            print(f"🚀 Executing sentiment analysis...")
            result = await agent.execute(test_input)
            
            if 'error' in result:
                print(f"❌ {provider} failed: {result['error']}")
                results[provider] = {"status": "failed", "error": result['error']}
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
                    print(f"   - Summary: {ratings.summaryDescription[:100]}...")
                
                results[provider] = {
                    "status": "success",
                    "execution_time": execution_time,
                    "web_search_enabled": search_enabled,
                    "citations_count": citations_count,
                    "ratings": {
                        "quality": ratings.quality if ratings else 0,
                        "priceValue": ratings.priceValue if ratings else 0,
                        "brandReputation": ratings.brandReputation if ratings else 0,
                        "brandTrust": ratings.brandTrust if ratings else 0,
                        "customerService": ratings.customerService if ratings else 0
                    } if ratings else {},
                    "summary_length": len(ratings.summaryDescription) if ratings else 0
                }
                
        except Exception as e:
            print(f"❌ {provider} failed with exception: {str(e)}")
            results[provider] = {"status": "exception", "error": str(e)}
            import traceback
            print(f"📍 Traceback: {traceback.format_exc()}")
    
    # Summary report
    print(f"\n📊 SUMMARY REPORT")
    print("=" * 60)
    
    successful_providers = [p for p, r in results.items() if r.get("status") == "success"]
    failed_providers = [p for p, r in results.items() if r.get("status") != "success"]
    
    print(f"✅ Successful providers: {len(successful_providers)}/{len(providers)}")
    for provider in successful_providers:
        result = results[provider]
        print(f"   - {provider}: {result['execution_time']:.0f}ms, {result['citations_count']} citations")
    
    if failed_providers:
        print(f"❌ Failed providers: {len(failed_providers)}")
        for provider in failed_providers:
            result = results[provider]
            print(f"   - {provider}: {result.get('error', 'Unknown error')}")
    
    print(f"\n🔍 Web Search & Citation Analysis:")
    for provider in successful_providers:
        result = results[provider]
        print(f"   - {provider}: Web search {'enabled' if result['web_search_enabled'] else 'disabled'}, {result['citations_count']} citations")
    
    print(f"\n📈 Sentiment Rating Analysis:")
    for provider in successful_providers:
        result = results[provider]
        ratings = result['ratings']
        avg_rating = sum(ratings.values()) / len(ratings) if ratings else 0
        print(f"   - {provider}: Average rating {avg_rating:.1f}/10 (Quality: {ratings.get('quality', 0)}, Trust: {ratings.get('brandTrust', 0)})")
    
    return results

if __name__ == "__main__":
    asyncio.run(test_sentiment_agent_with_providers())