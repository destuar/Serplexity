#!/usr/bin/env python3
"""
Test Anthropic Citation Extraction Directly
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv(Path(__file__).parent.parent.parent / '.env')

# Add the parent directory to the path
sys.path.insert(0, str(Path(__file__).parent.parent))

from pydantic_agents.agents.web_search_sentiment_agent import WebSearchSentimentAgent

# Test the citation extraction function directly
def test_citation_extraction():
    """Test the _extract_citations_from_text method directly"""
    
    # Create agent
    agent = WebSearchSentimentAgent(provider="anthropic", enable_web_search=True)
    
    # Sample text with URLs (from our debug output)
    sample_text = """Based on the comprehensive web search results, I'll provide sentiment scores for Slack:

1. Quality: 9/10
- Exceptional user interface
- Robust communication features
- Reliable performance across desktop and mobile platforms
- Continuous innovation with features like "huddles"

2. Price Value: 8/10
- Competitive pricing for small to medium businesses
- Free tier available with basic features
- Paid plans offer advanced integrations
- Slight deduction for premium features being costly for large teams

3. Brand Reputation: 9/10
- Widely recognized as a leader in team communication software
- Trusted by businesses globally
- Acquired by Salesforce, adding credibility
- Positive reviews across multiple platforms

4. Brand Trust: 9/10
- Strong data security measures
- Transparent communication about updates
- Consistent product improvements
- Reliable customer support

5. Customer Service: 9/10
- Responsive support team
- Extensive online documentation
- Community forums for troubleshooting
- Multiple support channels (email, chat, knowledge base)

Sources:
- https://www.trustradius.com/products/slack/reviews
- https://research.com/software/reviews/slack
- https://www.g2.com/products/slack/reviews
- https://www.capterra.com/p/135003/Slack/reviews/
- https://www.getapp.com/collaboration-software/a/slack/reviews/

The high scores reflect Slack's strong market position as a leading team communication platform, with robust features, user-friendly design, and consistent positive user experiences."""

    print("🧪 Testing Citation Extraction Function")
    print("=" * 50)
    
    # Test extraction
    citations = agent._extract_citations_from_text(sample_text)
    
    print(f"📊 Text length: {len(sample_text)}")
    print(f"🔗 Citations extracted: {len(citations)}")
    
    for i, citation in enumerate(citations, 1):
        print(f"   {i}. {citation.domain} - {citation.url}")
    
    # Test the parsing function
    ratings = agent._parse_sentiment_ratings(sample_text, "Slack", citations)
    
    print(f"\n📊 Ratings parsed: {len(ratings)}")
    if ratings:
        rating = ratings[0]
        print(f"   Quality: {rating.quality}/10")
        print(f"   Price Value: {rating.priceValue}/10")
        print(f"   Brand Reputation: {rating.brandReputation}/10")
        print(f"   Brand Trust: {rating.brandTrust}/10") 
        print(f"   Customer Service: {rating.customerService}/10")
        print(f"   Summary length: {len(rating.summaryDescription)}")
        print(f"   Summary preview: {rating.summaryDescription[:200]}...")
        
        # Check if summary has citations
        if "Sources:" in rating.summaryDescription or "References:" in rating.summaryDescription:
            print(f"   ✅ Citations found in summary")
        else:
            print(f"   ❌ No citations found in summary")

if __name__ == "__main__":
    test_citation_extraction()