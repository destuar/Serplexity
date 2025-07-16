#!/usr/bin/env python3
"""
Sentiment Analysis Agent

This agent provides structured sentiment analysis using PydanticAI,
replacing the complex manual sentiment analysis in the original LLM service.

Key Features:
- Structured sentiment scoring across multiple dimensions
- Industry-specific analysis
- Comprehensive error handling
- Automatic provider failover
- Detailed logging and monitoring

Usage:
    python sentiment_agent.py < input.json
    
Input Format:
    {
        "company_name": "Apple Inc.",
        "industry": "Technology",
        "text": "Text to analyze for sentiment...",
        "context": "Additional context for analysis"
    }

Output Format:
    {
        "data": {
            "companyName": "Apple Inc.",
            "industry": "Technology",
            "ratings": [...]
        },
        "metadata": {
            "agentId": "sentiment_analyzer",
            "modelUsed": "gpt-4o",
            "tokensUsed": 1250,
            "executionTime": 2340,
            "providerId": "openai",
            "success": true,
            "attemptCount": 1,
            "fallbackUsed": false
        }
    }
"""

import asyncio
import json
import sys
from typing import Dict, Any, Type

from .base_agent import BaseAgent
from .schemas import SentimentScores, SentimentRating

class SentimentAnalysisAgent(BaseAgent):
    """
    PydanticAI agent for sentiment analysis.
    
    This agent analyzes text sentiment across multiple dimensions:
    - Product/service quality
    - Price-value ratio
    - Brand reputation
    - Brand trust
    - Customer service
    
    It provides structured output with validation and comprehensive
    error handling.
    """
    
    def __init__(self):
        super().__init__(
            agent_id="sentiment_analyzer",
            default_model="openai:gpt-4o",
            system_prompt=self._build_system_prompt(),
            temperature=0.3,  # Lower temperature for more consistent analysis
            max_tokens=1500,
            timeout=30000,
            max_retries=3
        )
    
    def _build_system_prompt(self) -> str:
        """Build comprehensive system prompt for sentiment analysis"""
        return """You are a professional sentiment analysis expert specializing in brand perception analysis.

Your task is to analyze text content and provide structured sentiment scores for a specific company across multiple dimensions.

ANALYSIS DIMENSIONS:
1. Quality (1-10): Product/service quality perception
2. Price Value (1-10): Price-to-value ratio perception
3. Brand Reputation (1-10): Overall brand reputation
4. Brand Trust (1-10): Trustworthiness and reliability
5. Customer Service (1-10): Customer service quality perception

SCORING GUIDELINES:
- 1-3: Negative sentiment (poor, disappointing, problematic)
- 4-6: Neutral sentiment (average, mixed, acceptable)
- 7-10: Positive sentiment (good, excellent, outstanding)

ANALYSIS REQUIREMENTS:
- Analyze the text for mentions of the specified company
- Consider industry context for scoring
- Look for explicit and implicit sentiment indicators
- Provide evidence-based ratings
- Include a clear summary description explaining the overall sentiment

IMPORTANT RULES:
- Only analyze sentiment related to the specified company
- If the company is not mentioned, indicate neutral scores (5-6 range)
- Base ratings on actual text content, not assumptions
- Provide honest, unbiased analysis
- Include specific examples from the text when possible

Your response must be in the exact JSON format specified by the SentimentScores schema."""
    
    def get_result_type(self) -> Type[SentimentScores]:
        """Return the result type for this agent"""
        return SentimentScores
    
    async def process_input(self, input_data: Dict[str, Any]) -> str:
        """Process input data and create analysis prompt"""
        company_name = input_data.get('company_name', '')
        industry = input_data.get('industry', '')
        text = input_data.get('text', '')
        context = input_data.get('context', '')
        
        if not company_name:
            raise ValueError("company_name is required")
        if not text:
            raise ValueError("text is required")
        
        # Build analysis prompt
        prompt = f"""Analyze the sentiment for {company_name} in the following text.

COMPANY: {company_name}
INDUSTRY: {industry}
CONTEXT: {context}

TEXT TO ANALYZE:
{text}

Please provide a structured sentiment analysis with ratings for each dimension and a comprehensive summary description.

Focus specifically on mentions and perceptions of {company_name}. If there are multiple mentions or different contexts, create separate ratings for each distinct sentiment pattern.

Ensure your response follows the exact JSON schema format for SentimentScores."""
        
        return prompt
    
    def _validate_company_mention(self, text: str, company_name: str) -> bool:
        """Validate that the company is actually mentioned in the text"""
        text_lower = text.lower()
        company_lower = company_name.lower()
        
        # Check for direct mention
        if company_lower in text_lower:
            return True
        
        # Check for common variations (e.g., "Apple" vs "Apple Inc.")
        company_words = company_lower.split()
        if any(word in text_lower for word in company_words if len(word) > 3):
            return True
        
        return False
    
    async def _post_process_result(self, result: SentimentScores, input_data: Dict[str, Any]) -> SentimentScores:
        """Post-process the result to ensure quality"""
        company_name = input_data.get('company_name', '')
        text = input_data.get('text', '')
        
        # Validate company mention
        if not self._validate_company_mention(text, company_name):
            # If company not mentioned, adjust ratings to neutral
            for rating in result.ratings:
                # Adjust scores to neutral range if they're too extreme
                if rating.quality < 4 or rating.quality > 7:
                    rating.quality = 5
                if rating.priceValue < 4 or rating.priceValue > 7:
                    rating.priceValue = 5
                if rating.brandReputation < 4 or rating.brandReputation > 7:
                    rating.brandReputation = 5
                if rating.brandTrust < 4 or rating.brandTrust > 7:
                    rating.brandTrust = 5
                if rating.customerService < 4 or rating.customerService > 7:
                    rating.customerService = 5
                
                # Update summary to reflect neutral sentiment
                rating.summaryDescription = f"Neutral sentiment for {company_name} - limited or no specific mentions found in the analyzed text"
        
        return result

async def main():
    """Main function for running the sentiment analysis agent"""
    try:
        # Read input from stdin
        input_data = json.loads(sys.stdin.read())
        
        # Create and execute agent
        agent = SentimentAnalysisAgent()
        result = await agent.execute(input_data)
        
        # Output result
        print(json.dumps(result))
        
    except Exception as e:
        # Output error in consistent format
        error_result = {
            "error": str(e),
            "agent_id": "sentiment_analyzer",
            "execution_time": 0,
            "attempt_count": 0
        }
        print(json.dumps(error_result))
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())