#!/usr/bin/env python3
"""
Test Sentiment Summary Agent with Real Multi-Model Data
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
from pydantic_agents.agents.sentiment_summary_agent import SentimentSummaryAgent

async def collect_multi_model_sentiment_data(company="Asana", industry="Project Management Software"):
    """Collect sentiment data from all 4 models"""
    
    test_input = {
        "company_name": company,
        "industry": industry,
        "context": "Team productivity and project management platform",
        "enable_web_search": True
    }
    
    providers = ["openai", "anthropic", "gemini", "perplexity"]
    
    print(f"🔄 Collecting sentiment data for {company} from all 4 models...")
    print("=" * 60)
    
    model_results = {}
    individual_sentiments = []
    all_citations = []
    
    for provider in providers:
        print(f"🤖 Collecting from {provider.upper()}...")
        
        try:
            # Create agent for this provider
            agent = WebSearchSentimentAgent(provider=provider, enable_web_search=True)
            
            # Execute the agent
            result = await agent.execute(test_input)
            
            if 'error' in result:
                print(f"❌ {provider} failed: {result['error']}")
                continue
            
            sentiment_data = result['result']
            
            # Extract ratings
            if sentiment_data.ratings:
                rating = sentiment_data.ratings[0]
                model_results[provider] = {
                    "quality": rating.quality,
                    "priceValue": rating.priceValue,
                    "brandReputation": rating.brandReputation,
                    "brandTrust": rating.brandTrust,
                    "customerService": rating.customerService,
                    "summary": rating.summaryDescription
                }
                
                # Collect individual sentiment for summary agent
                individual_sentiments.append({
                    "provider": provider,
                    "ratings": {
                        "quality": rating.quality,
                        "priceValue": rating.priceValue,
                        "brandReputation": rating.brandReputation,
                        "brandTrust": rating.brandTrust,
                        "customerService": rating.customerService
                    },
                    "summary": rating.summaryDescription,
                    "execution_time": result.get('execution_time', 0)
                })
                
                print(f"✅ {provider}: Q:{rating.quality} PV:{rating.priceValue} BR:{rating.brandReputation} BT:{rating.brandTrust} CS:{rating.customerService}")
            
            # Collect citations
            if sentiment_data.webSearchMetadata and sentiment_data.webSearchMetadata.sources_found:
                for source in sentiment_data.webSearchMetadata.sources_found:
                    all_citations.append({
                        "provider": provider,
                        "url": source.url,
                        "domain": source.domain,
                        "title": source.title
                    })
                print(f"   📄 Citations: {len(sentiment_data.webSearchMetadata.sources_found)}")
            
        except Exception as e:
            print(f"❌ {provider} failed with exception: {str(e)}")
            continue
    
    return model_results, individual_sentiments, all_citations

def calculate_aggregated_ratings(model_results):
    """Calculate aggregated ratings across all models"""
    
    if not model_results:
        return {}
    
    # Calculate averages
    dimensions = ["quality", "priceValue", "brandReputation", "brandTrust", "customerService"]
    aggregated = {}
    
    for dimension in dimensions:
        values = [result[dimension] for result in model_results.values() if dimension in result]
        if values:
            aggregated[dimension] = round(sum(values) / len(values), 1)
        else:
            aggregated[dimension] = 5  # Default
    
    return aggregated

async def test_sentiment_summary_agent():
    """Test the sentiment summary agent with real multi-model data"""
    
    print("🧪 Testing Sentiment Summary Agent with Multi-Model Data")
    print("=" * 70)
    
    # Step 1: Collect data from all models
    model_results, individual_sentiments, all_citations = await collect_multi_model_sentiment_data()
    
    if not model_results:
        print("❌ No model results collected. Cannot test summary agent.")
        return
    
    print(f"\n📊 Collected data from {len(model_results)} models")
    print(f"📋 Individual sentiments: {len(individual_sentiments)}")
    print(f"🔗 Total citations: {len(all_citations)}")
    
    # Step 2: Calculate aggregated ratings
    aggregated_ratings = calculate_aggregated_ratings(model_results)
    
    print(f"\n📈 Aggregated Ratings:")
    for dimension, value in aggregated_ratings.items():
        print(f"   {dimension}: {value}/10")
    
    # Step 3: Prepare input for summary agent
    summary_input = {
        "company_name": "Asana",
        "industry": "Project Management Software",
        "aggregated_ratings": aggregated_ratings,
        "individual_sentiments": individual_sentiments,
        "analysis_type": "comprehensive_summary",
        "citations": all_citations  # Add citations to input
    }
    
    print(f"\n🤖 Testing Sentiment Summary Agent...")
    
    try:
        # Create and execute summary agent
        summary_agent = SentimentSummaryAgent()
        print(f"✅ Summary agent created with model: {summary_agent.model_id}")
        
        result = await summary_agent.execute(summary_input)
        
        if 'error' in result:
            print(f"❌ Summary agent failed: {result['error']}")
            return
        
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
            print(f"{summary_rating.summaryDescription}")
            
            # Check if summary includes insights from multiple models
            summary_text = summary_rating.summaryDescription.lower()
            insights_found = []
            
            insight_indicators = [
                "across", "overall", "generally", "consistently", "trend", 
                "analysis shows", "data indicates", "findings suggest"
            ]
            
            for indicator in insight_indicators:
                if indicator in summary_text:
                    insights_found.append(indicator)
            
            print(f"\n🔍 Analysis Indicators Found: {insights_found}")
            
            # Check for citation references
            citation_indicators = ["source", "according to", "based on", "data from"]
            citation_refs = [ind for ind in citation_indicators if ind in summary_text]
            
            if citation_refs:
                print(f"✅ Citation references found: {citation_refs}")
            else:
                print(f"❌ No citation references found in summary")
        
        # Compare with individual model results
        print(f"\n📈 Comparison with Individual Models:")
        for provider, ratings in model_results.items():
            avg_rating = sum(ratings[k] for k in ["quality", "priceValue", "brandReputation", "brandTrust", "customerService"]) / 5
            print(f"   {provider:12}: {avg_rating:.1f}/10")
        
        if summary_data.ratings:
            summary_avg = sum([summary_rating.quality, summary_rating.priceValue, 
                             summary_rating.brandReputation, summary_rating.brandTrust, 
                             summary_rating.customerService]) / 5
            print(f"   {'SUMMARY':12}: {summary_avg:.1f}/10")
        
        print(f"\n🎯 Citations Available for Reference:")
        unique_domains = list(set([c["domain"] for c in all_citations]))
        print(f"   Unique domains: {len(unique_domains)}")
        print(f"   Domains: {', '.join(unique_domains[:5])}")
        
        return True
        
    except Exception as e:
        print(f"❌ Summary agent test failed: {str(e)}")
        import traceback
        print(f"📍 Traceback: {traceback.format_exc()}")
        return False

if __name__ == "__main__":
    asyncio.run(test_sentiment_summary_agent())