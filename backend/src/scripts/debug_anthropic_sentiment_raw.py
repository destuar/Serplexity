#!/usr/bin/env python3
"""
Debug Anthropic Sentiment Agent Raw Response
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

async def debug_anthropic_sentiment_raw():
    """Debug what Anthropic returns in sentiment context"""
    
    print("🔍 Debugging Anthropic Sentiment Agent Response")
    print("=" * 60)
    
    # Create web search config
    config = WebSearchConfig.for_task("sentiment", "anthropic")
    print(f"✅ Web search config: enabled={config.is_enabled()}, tools={len(config.get_tools())}")
    
    # Create agent exactly like the sentiment agent does
    agent = Agent(
        model="anthropic:claude-3-5-haiku-20241022",
        system_prompt="""You are a professional sentiment analysis expert specializing in real-time brand perception analysis.

Your task is to analyze sentiment for companies across five key dimensions using current web information:

ANALYSIS DIMENSIONS:
1. Quality (1-10): Product/service quality perception from reviews and feedback
2. Price Value (1-10): Price-to-value ratio perception from customer comments
3. Brand Reputation (1-10): Overall brand reputation from news and social media
4. Brand Trust (1-10): Trustworthiness and reliability from customer experiences
5. Customer Service (1-10): Customer service quality from support interactions

SCORING GUIDELINES:
- 1-3: Negative sentiment (poor, disappointing, problematic)
- 4-6: Neutral sentiment (average, mixed, acceptable)
- 7-10: Positive sentiment (good, excellent, outstanding)

ANALYSIS REQUIREMENTS:
- Base your analysis on current web information about the company
- Look for patterns across multiple sources and platforms
- Consider both recent and historical sentiment trends
- Provide evidence-based ratings with specific examples
- Include a comprehensive summary description
- Focus on factual information from credible sources

🔍 WEB SEARCH ENABLED
You have access to Anthropic's web search tool. Use it to find up-to-date information.

Web Search Guidelines:
- Search for current, relevant information
- Use multiple search queries for comprehensive coverage
- Verify information across multiple sources
- Include search results in your analysis
- Cite sources when possible

Sentiment Analysis Search Strategy:
- Search for "[company] reviews 2024"
- Search for "[company] complaints"
- Search for "[company] customer service"
- Search for "[company] site:reddit.com"
- Search for "[company] site:trustpilot.com"
- Look for both positive and negative mentions""",
        tools=config.get_tools() if config.get_tools() else []
    )
    
    # Create the exact prompt the sentiment agent would send
    test_prompt = """Perform comprehensive web search sentiment analysis for Slack.

COMPANY: Slack
INDUSTRY: Communication Software
CONTEXT: Team collaboration platform

SEARCH STRATEGY:
Perform web searches using these targeted queries to gather current sentiment data:

1. "Slack" reviews 2025
2. "Slack" customer complaints
3. "Slack" customer service experience
4. "Slack" quality issues
5. "Slack" price value worth it
6. "Slack" brand reputation
7. "Slack" site:reddit.com
8. "Slack" site:trustpilot.com
9. "Slack" vs competitors Communication Software

ANALYSIS TASK:
Based on your web search results, analyze sentiment across all five dimensions:
- Quality: Look for product/service quality mentions in reviews
- Price Value: Find discussions about pricing and value perception
- Brand Reputation: Check news, social media, and general brand mentions
- Brand Trust: Look for trust indicators and reliability discussions
- Customer Service: Find customer service experiences and support feedback

SEARCH REQUIREMENTS:
- Search for current information (prioritize recent content)
- Look for both positive and negative sentiment indicators
- Consider source credibility and diversity
- Cross-reference information across multiple sources
- Note patterns and trends in sentiment

RESPONSE REQUIREMENTS:
- Provide structured sentiment scores (1-10) for each dimension
- Include specific examples from your search results
- Create comprehensive summary descriptions with evidence
- Include web search metadata about your searches
- Base all ratings on actual search findings, not assumptions

Search for comprehensive coverage and provide evidence-based sentiment analysis.

IMPORTANT: When using web search tools, include the source URLs in your response text for citation extraction.

Search Strategy for Sentiment Analysis:
- Search for customer reviews and ratings
- Look for pricing and value discussions
- Find brand reputation and news mentions
- Search for trust and reliability indicators
- Look for customer service experiences

Structure your response to include specific ratings (1-10) for each sentiment dimension with examples from your search results. Include the source URLs you used in your response text.

Example format: "Based on reviews from https://example.com/reviews and feedback from https://example.com/feedback..."

Please include actual URLs from your web searches in the response text for proper citation tracking."""
    
    print(f"\n📤 Sending enhanced prompt...")
    
    try:
        # Execute
        result = await agent.run(test_prompt)
        
        # Extract text
        if hasattr(result, 'output'):
            raw_content = result.output
        else:
            raw_content = str(result)
        
        print(f"\n📥 Raw response length: {len(raw_content)}")
        print(f"📝 Raw response:")
        print("=" * 60)
        print(raw_content)
        print("=" * 60)
        
        # Test URL extraction
        import re
        urls = re.findall(r'https?://[^\s\]\)\n]+', raw_content)
        print(f"\n🔗 URLs found with simple regex: {len(urls)}")
        for url in urls:
            print(f"   - {url}")
        
        # Test with enhanced regex
        url_pattern = r'https?://[^\s\]\)\n]+(?=[\s\n\]\)]|$)|www\.[^\s\]\)\n]+(?=[\s\n\]\)]|$)'
        enhanced_urls = re.findall(url_pattern, raw_content)
        print(f"\n🔗 URLs found with enhanced regex: {len(enhanced_urls)}")
        for url in enhanced_urls:
            print(f"   - {url}")
        
    except Exception as e:
        print(f"❌ Debug failed: {str(e)}")
        import traceback
        print(f"📍 Traceback: {traceback.format_exc()}")

if __name__ == "__main__":
    import asyncio
    asyncio.run(debug_anthropic_sentiment_raw())