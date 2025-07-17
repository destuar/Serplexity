#!/usr/bin/env python3
"""
Final Test: All 4 Providers Web Search Sentiment Agent
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

async def test_provider(provider):
    """Test one provider"""
    test_input = {
        "company_name": "Asana",
        "industry": "Project Management Software",
        "context": "Team productivity and project management platform",
        "enable_web_search": True
    }
    
    try:
        agent = WebSearchSentimentAgent(provider=provider, enable_web_search=True)
        result = await agent.execute(test_input)
        
        if 'error' in result:
            return {"status": "error", "error": result['error']}
        
        sentiment_data = result['result']
        ratings = sentiment_data.ratings[0] if sentiment_data.ratings else None
        web_search_metadata = sentiment_data.webSearchMetadata
        
        return {
            "status": "success",
            "execution_time": result.get('execution_time', 0),
            "citations_count": len(web_search_metadata.sources_found) if web_search_metadata else 0,
            "search_enabled": web_search_metadata.search_enabled if web_search_metadata else False,
            "ratings": {
                "quality": ratings.quality if ratings else 0,
                "priceValue": ratings.priceValue if ratings else 0,
                "brandReputation": ratings.brandReputation if ratings else 0,
                "brandTrust": ratings.brandTrust if ratings else 0,
                "customerService": ratings.customerService if ratings else 0
            } if ratings else {},
            "summary_has_citations": "Sources:" in ratings.summaryDescription if ratings else False,
            "summary_preview": ratings.summaryDescription[:150] if ratings else "",
            "source_domains": [s.domain for s in web_search_metadata.sources_found[:3]] if web_search_metadata else []
        }
        
    except Exception as e:
        return {"status": "exception", "error": str(e)}

async def test_all_providers():
    """Test all 4 providers"""
    providers = ["openai", "anthropic", "gemini", "perplexity"]
    
    print("🧪 FINAL TEST: Web Search Sentiment Agent - All 4 Providers")
    print("=" * 70)
    print("Testing company: Asana (Project Management Software)")
    print()
    
    results = {}
    
    for provider in providers:
        print(f"🤖 Testing {provider.upper()}...")
        result = await test_provider(provider)
        results[provider] = result
        
        if result["status"] == "success":
            print(f"✅ {provider}: {result['execution_time']:.0f}ms, {result['citations_count']} citations, Search: {result['search_enabled']}")
            if result['citations_count'] > 0:
                print(f"   📄 Sources: {', '.join(result['source_domains'])}")
            avg_rating = sum(result['ratings'].values()) / len(result['ratings']) if result['ratings'] else 0
            print(f"   📊 Avg rating: {avg_rating:.1f}/10, Citations in summary: {'✅' if result['summary_has_citations'] else '❌'}")
        else:
            print(f"❌ {provider}: {result['error']}")
        print()
    
    # Final summary
    successful = [p for p, r in results.items() if r["status"] == "success"]
    with_citations = [p for p, r in results.items() if r.get("citations_count", 0) > 0]
    
    print("📊 FINAL SUMMARY")
    print("=" * 70)
    print(f"✅ Successful providers: {len(successful)}/4 ({', '.join(successful)})")
    print(f"🔍 With citations: {len(with_citations)}/4 ({', '.join(with_citations)})")
    print()
    
    for provider in successful:
        result = results[provider]
        print(f"{provider.upper():12} | {result['execution_time']:6.0f}ms | {result['citations_count']:2d} citations | {result['search_enabled']:5} | {result['source_domains']}")
    
    return results

if __name__ == "__main__":
    asyncio.run(test_all_providers())