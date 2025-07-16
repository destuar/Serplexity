#!/usr/bin/env python3
"""
Sentiment Summary Agent for PydanticAI
Generates comprehensive sentiment summaries from aggregated rating data.
"""

import json
import sys
import os
from typing import Dict, List, Any, Optional
from pydantic import BaseModel, Field
from pydantic_ai import Agent
from pydantic_ai.models import KnownModelName

# Add the parent directory to the path to import schemas
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from pydantic_agents.schemas import SentimentRating, SentimentAnalysisResult
except ImportError:
    # Fallback schema definitions if import fails
    class SentimentRating(BaseModel):
        quality: int = Field(ge=1, le=10)
        priceValue: int = Field(ge=1, le=10)
        brandReputation: int = Field(ge=1, le=10)
        brandTrust: int = Field(ge=1, le=10)
        customerService: int = Field(ge=1, le=10)
        summaryDescription: str = Field(min_length=10, max_length=500)

    class SentimentAnalysisResult(BaseModel):
        companyName: str
        industry: str
        ratings: List[SentimentRating]

class SentimentSummaryInput(BaseModel):
    company_name: str
    industry: str
    aggregated_ratings: Dict[str, int]
    individual_sentiments: List[Dict[str, Any]]
    analysis_type: str = "summary"

class SentimentSummaryAgent:
    def __init__(self):
        # Get model configuration from environment
        model_id = os.getenv('PYDANTIC_MODEL_ID', 'openai:gpt-4o')
        
        # Create the agent
        self.agent = Agent(
            model=model_id,
            result_type=SentimentAnalysisResult,
            system_prompt=self._build_system_prompt()
        )
    
    def _build_system_prompt(self) -> str:
        return """You are a sentiment analysis expert specializing in creating comprehensive summaries 
from aggregated sentiment data. Your task is to analyze multiple sentiment ratings and create 
a unified, insightful summary that captures the overall sentiment landscape.

Key requirements:
1. Analyze the aggregated ratings to understand overall sentiment trends
2. Create a comprehensive summary that reflects the collective sentiment
3. Use the provided average ratings as a baseline but add nuanced insights
4. Ensure the summary is between 50-400 characters
5. Focus on key strengths, weaknesses, and overall market position
6. Maintain objectivity while being insightful

Output format:
- Return a SentimentAnalysisResult with the company name, industry, and a single rating entry
- The rating should use the aggregated averages with a comprehensive summary description
- Ensure all ratings are between 1-10
- Make the summary actionable and insightful"""
    
    async def analyze_sentiment_summary(self, input_data: SentimentSummaryInput) -> SentimentAnalysisResult:
        """Generate a comprehensive sentiment summary from aggregated data."""
        
        # Prepare context for the agent
        context = f"""
Company: {input_data.company_name}
Industry: {input_data.industry}
Analysis Type: {input_data.analysis_type}

Aggregated Ratings:
- Quality: {input_data.aggregated_ratings.get('quality', 5)}/10
- Price Value: {input_data.aggregated_ratings.get('priceValue', 5)}/10
- Brand Reputation: {input_data.aggregated_ratings.get('brandReputation', 5)}/10
- Brand Trust: {input_data.aggregated_ratings.get('brandTrust', 5)}/10
- Customer Service: {input_data.aggregated_ratings.get('customerService', 5)}/10

Individual Sentiment Count: {len(input_data.individual_sentiments)}

Please create a comprehensive sentiment summary that:
1. Uses the aggregated ratings as the baseline scores
2. Provides a detailed summary description that captures the overall sentiment
3. Identifies key strengths and areas for improvement
4. Reflects the collective voice of the sentiment analysis
"""
        
        # Run the agent
        result = await self.agent.run(context)
        
        # Ensure the result uses aggregated ratings
        if result.data.ratings:
            # Update the first rating with aggregated values
            rating = result.data.ratings[0]
            rating.quality = input_data.aggregated_ratings.get('quality', rating.quality)
            rating.priceValue = input_data.aggregated_ratings.get('priceValue', rating.priceValue)
            rating.brandReputation = input_data.aggregated_ratings.get('brandReputation', rating.brandReputation)
            rating.brandTrust = input_data.aggregated_ratings.get('brandTrust', rating.brandTrust)
            rating.customerService = input_data.aggregated_ratings.get('customerService', rating.customerService)
        
        return result.data

def main():
    """Main entry point for the sentiment summary agent."""
    try:
        # Read input from stdin
        input_data = json.loads(sys.stdin.read())
        
        # Validate input
        summary_input = SentimentSummaryInput(**input_data)
        
        # Create agent
        agent = SentimentSummaryAgent()
        
        # Process the sentiment summary
        import asyncio
        result = asyncio.run(agent.analyze_sentiment_summary(summary_input))
        
        # Prepare output
        output = {
            "data": result.model_dump(),
            "model_used": os.getenv('PYDANTIC_MODEL_ID', 'openai:gpt-4o'),
            "tokens_used": 800,  # Estimated token usage
            "analysis_type": summary_input.analysis_type,
            "sentiment_count": len(summary_input.individual_sentiments)
        }
        
        # Output result
        print(json.dumps(output, indent=2))
        
    except Exception as e:
        error_output = {
            "error": str(e),
            "type": "sentiment_summary_error",
            "model_used": os.getenv('PYDANTIC_MODEL_ID', 'openai:gpt-4o'),
            "tokens_used": 0
        }
        print(json.dumps(error_output, indent=2))
        sys.exit(1)

if __name__ == "__main__":
    main()