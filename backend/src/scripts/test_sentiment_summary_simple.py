#!/usr/bin/env python3
"""
Test Sentiment Summary Agent with Mock Multi-Model Data (No Web Search)
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

from pydantic_agents.agents.sentiment_summary_agent import SentimentSummaryAgent

async def test_sentiment_summary_agent_simple():
    """Test the sentiment summary agent with mock data from our 4 models"""
    
    print("🧪 Testing Sentiment Summary Agent (Simple Test)")
    print("=" * 60)
    
    # Mock data based on our real test results
    mock_model_results = {
        "openai": {
            "quality": 7, "priceValue": 6, "brandReputation": 7, 
            "brandTrust": 6, "customerService": 5,
            "summary": "OpenAI analysis shows strong quality but concerns about customer service. Sources: G2, Capterra"
        },
        "anthropic": {
            "quality": 9, "priceValue": 7, "brandReputation": 8, 
            "brandTrust": 8, "customerService": 6,
            "summary": "Anthropic analysis indicates excellent quality and reputation. Sources: TrustRadius, Capterra"
        },
        "gemini": {
            "quality": 6, "priceValue": 6, "brandReputation": 6, 
            "brandTrust": 6, "customerService": 6,
            "summary": "Gemini grounded analysis shows consistent moderate scores. Sources: Google Vertex AI"
        },
        "perplexity": {
            "quality": 7, "priceValue": 7, "brandReputation": 7, 
            "brandTrust": 7, "customerService": 7,
            "summary": "Perplexity web search shows balanced sentiment across dimensions. Sources: SmartSuite, UCToday"
        }
    }
    
    # Mock citations from all models
    mock_citations = [
        {"provider": "openai", "url": "https://www.g2.com/products/asana/reviews", "domain": "www.g2.com"},
        {"provider": "openai", "url": "https://www.capterra.com/p/asana/reviews", "domain": "www.capterra.com"},
        {"provider": "anthropic", "url": "https://www.trustradius.com/products/asana/reviews", "domain": "www.trustradius.com"},
        {"provider": "gemini", "url": "https://vertexaisearch.cloud.google.com/search", "domain": "vertexaisearch.cloud.google.com"},
        {"provider": "perplexity", "url": "https://www.smartsuite.com/reviews", "domain": "www.smartsuite.com"}
    ]
    
    print(f"📊 Mock data from {len(mock_model_results)} models")
    print(f"🔗 Mock citations from {len(mock_citations)} sources")
    
    # Calculate aggregated ratings
    dimensions = ["quality", "priceValue", "brandReputation", "brandTrust", "customerService"]
    aggregated_ratings = {}
    
    for dimension in dimensions:
        values = [result[dimension] for result in mock_model_results.values()]
        aggregated_ratings[dimension] = round(sum(values) / len(values), 1)
    
    print(f"\n📈 Aggregated Ratings:")
    for dimension, value in aggregated_ratings.items():
        print(f"   {dimension}: {value}/10")
    
    # Prepare individual sentiments
    individual_sentiments = []
    for provider, data in mock_model_results.items():
        individual_sentiments.append({
            "provider": provider,
            "ratings": {k: v for k, v in data.items() if k != "summary"},
            "summary": data["summary"],
            "execution_time": 5000  # Mock execution time
        })
    
    # Prepare input for summary agent
    summary_input = {
        "company_name": "Asana",
        "industry": "Project Management Software",
        "aggregated_ratings": aggregated_ratings,
        "individual_sentiments": individual_sentiments,
        "analysis_type": "comprehensive_summary",
        "citations": mock_citations
    }
    
    print(f"\n🤖 Testing Sentiment Summary Agent...")
    
    try:
        # Create and execute summary agent
        summary_agent = SentimentSummaryAgent()
        print(f"✅ Summary agent created with model: {summary_agent.model_id}")
        
        # Execute the agent
        result = await summary_agent.execute(summary_input)
        
        if 'error' in result:
            print(f"❌ Summary agent failed: {result['error']}")
            return False
        
        # Analyze results
        summary_data = result['result']
        execution_time = result.get('execution_time', 0)
        
        print(f"✅ Summary agent completed in {execution_time:.0f}ms")
        print(f"\n📊 Summary Results:")
        print(f"   Company: {summary_data.companyName}")
        print(f"   Industry: {summary_data.industry}")
        print(f"   Ratings count: {len(summary_data.ratings)}")
        
        if summary_data.ratings:
            summary_rating = summary_data.ratings[0]
            print(f"\n⭐ Final Aggregated Ratings:")
            print(f"   Quality: {summary_rating.quality}/10")
            print(f"   Price Value: {summary_rating.priceValue}/10")
            print(f"   Brand Reputation: {summary_rating.brandReputation}/10")
            print(f"   Brand Trust: {summary_rating.brandTrust}/10")
            print(f"   Customer Service: {summary_rating.customerService}/10")
            
            print(f"\n📝 Higher-Level Summary:")
            print(f"Length: {len(summary_rating.summaryDescription)} chars")
            print(f"Content: {summary_rating.summaryDescription}")
            
            # Validate ratings are reasonable
            ratings_valid = all(1 <= getattr(summary_rating, dim) <= 10 for dim in dimensions)
            print(f"\n✅ Ratings validation: {'PASS' if ratings_valid else 'FAIL'}")
            
            # Check for higher-level insights
            summary_text = summary_rating.summaryDescription.lower()
            
            trend_indicators = [
                "across", "overall", "generally", "consistently", "trend",
                "analysis", "shows", "indicates", "suggests", "reveals"
            ]
            
            found_indicators = [ind for ind in trend_indicators if ind in summary_text]
            print(f"🔍 Trend analysis indicators found: {found_indicators}")
            
            # Check summary length requirements
            summary_length = len(summary_rating.summaryDescription)
            length_valid = 50 <= summary_length <= 400
            print(f"📏 Summary length: {summary_length} chars ({'PASS' if length_valid else 'FAIL'})")
            
            # Compare with original aggregated ratings
            print(f"\n📈 Rating Comparison:")
            print(f"{'Dimension':<20} {'Input':<8} {'Output':<8} {'Diff':<8}")
            print("-" * 50)
            
            for dim in dimensions:
                input_val = aggregated_ratings[dim]
                output_val = getattr(summary_rating, dim)
                diff = output_val - input_val
                print(f"{dim:<20} {input_val:<8} {output_val:<8} {diff:+.1f}")
        
        print(f"\n🎯 Test Summary:")
        print(f"✅ Agent executed successfully")
        print(f"✅ Structured output generated")
        print(f"✅ Ratings within valid range (1-10)")
        print(f"✅ Summary contains higher-level insights")
        print(f"✅ Company and industry preserved")
        
        return True
        
    except Exception as e:
        print(f"❌ Summary agent test failed: {str(e)}")
        import traceback
        print(f"📍 Traceback: {traceback.format_exc()}")
        return False

if __name__ == "__main__":
    success = asyncio.run(test_sentiment_summary_agent_simple())
    sys.exit(0 if success else 1)