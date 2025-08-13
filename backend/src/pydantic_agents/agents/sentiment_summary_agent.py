#!/usr/bin/env python3
"""
Sentiment Summary Agent for PydanticAI
Generates sentiment summaries from aggregated rating data.
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

from ..base_agent import BaseAgent
from ..schemas import SentimentRating, SentimentScores
from ..config.models import get_default_model_for_task, ModelTask

class SentimentSummaryInput(BaseModel):
    company_name: str
    industry: str
    aggregated_ratings: Dict[str, int]
    individual_sentiments: List[Dict[str, Any]]
    analysis_type: str = "summary"

class SentimentSummaryAgent(BaseAgent):
    def __init__(self):
        # Get the default model for sentiment summary task (only gpt-4.1-mini can do this)
        default_model_config = get_default_model_for_task(ModelTask.SENTIMENT_SUMMARY)
        default_model = default_model_config.get_pydantic_model_id() if default_model_config else "openai:gpt-4.1-mini"

        super().__init__(
            agent_id="sentiment_summary_agent",
            default_model=default_model,
            system_prompt="""You are a sentiment strategy analyst. Produce an actionable, source-backed summary
from aggregated sentiment data across multiple models.

Key requirements:
1. Use the provided average ratings as baseline and synthesize WHY the pattern exists.
2. Provide 2-3 concrete examples with source domains (e.g., Trustpilot, Reddit, TechCrunch) using inline markers [1], [2], [3].
3. Highlight strengths (scores 7+) and specific improvement opportunities (scores <6) with clear next steps.
4. Avoid restating scores; focus on decision-grade insights a VP of Marketing would use.
5. Keep it concise but substantive (150-300 words).
6. Maintain objectivity and avoid generic phrasing.

Summary format:
- One concise paragraph on strengths and their drivers
- One concise paragraph on weaknesses and practical recommendations
- End with “Sources: [1], [2], [3]” if citations provided
- Ensure all ratings are between 1-10""",
            temperature=0.4
        )

    def get_output_type(self):
        return SentimentScores

    async def process_input(self, input_data: Dict[str, Any]) -> str:
        """Process input data and return prompt for sentiment summary generation."""

        # Extract data from input
        company_name = input_data.get('company_name', '')
        industry = input_data.get('industry', '')
        analysis_type = input_data.get('analysis_type', 'summary')
        aggregated_ratings = input_data.get('aggregated_ratings', {})
        individual_sentiments = input_data.get('individual_sentiments', [])
        citations = input_data.get('citations', [])

        # Analyze individual sentiment variations for trend insights
        trend_analysis = self._analyze_sentiment_trends(individual_sentiments)
        citation_summary = self._summarize_citations(citations)

        # Prepare context for the agent
        context = f"""
Company: {company_name}
Industry: {industry}
Analysis Type: {analysis_type}

AGGREGATED RATINGS (from {len(individual_sentiments)} models):
- Quality: {aggregated_ratings.get('quality', 5)}/10
- Price Value: {aggregated_ratings.get('priceValue', 5)}/10
- Brand Reputation: {aggregated_ratings.get('brandReputation', 5)}/10
- Brand Trust: {aggregated_ratings.get('brandTrust', 5)}/10
- Customer Service: {aggregated_ratings.get('customerService', 5)}/10

SENTIMENT TRENDS & INSIGHTS:
{trend_analysis}

CITATION SOURCES:
{citation_summary}

INDIVIDUAL MODEL SUMMARIES:
{self._format_individual_summaries(individual_sentiments)}

Please create a comprehensive sentiment summary that:
1. Uses the aggregated ratings as baseline scores (with minor adjustments if justified)
2. Identifies and highlights key STRENGTHS where the company excels (scores 7+)
3. Pinpoints specific IMPROVEMENT OPPORTUNITIES for scores below 6
4. Explains WHY these patterns exist based on the diverse source analysis
5. Provides strategic RECOMMENDATIONS for addressing weak areas
6. References the diversity of sources analyzed when relevant
7. Focuses on actionable business insights rather than restating numerical scores
8. Synthesizes consensus findings from multiple AI model perspectives

DO NOT simply list "Quality: X/10, Price: Y/10" - instead create strategic narrative insights that help business decision-making. Example: "Company demonstrates strong performance in product quality and brand trust, with key improvement opportunities in customer service responsiveness and pricing competitiveness."
"""

        return context

    async def execute(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Override to avoid pydantic_ai Union instantiation bug by using simple agent and coercion."""
        import time, json
        start_time = time.time()
        try:
            from pydantic_ai import Agent as SimpleAgent
            prompt = await self.process_input(input_data)
            agent = SimpleAgent(
                model=self.model_id,
                system_prompt=self.env_system_prompt or self.system_prompt,
            )
            raw = await agent.run(prompt)
            text = raw.output if hasattr(raw, 'output') else str(raw)

            # Try to coerce minimally structured ratings from free-form text
            # Fallback to provided aggregated ratings
            def clamp(n: int) -> int:
                return max(1, min(10, int(n)))

            agg = input_data.get('aggregated_ratings', {}) or {}
            company = input_data.get('company_name', 'Unknown')
            industry = input_data.get('industry', 'Unknown')

            summary = SentimentScores(
                companyName=company,
                industry=industry,
                ratings=[
                    SentimentRating(
                        quality=clamp(agg.get('quality', 8)),
                        priceValue=clamp(agg.get('priceValue', 7)),
                        brandReputation=clamp(agg.get('brandReputation', 9)),
                        brandTrust=clamp(agg.get('brandTrust', 8)),
                        customerService=clamp(agg.get('customerService', 8)),
                        summaryDescription=text[:900] if text else "Generated summary"
                    )
                ],
                webSearchMetadata=None,
            )

            execution_time = (time.time() - start_time) * 1000
            return {
                'result': summary,
                'execution_time': execution_time,
                'attempt_count': 1,
                'agent_id': self.agent_id,
                'model_used': self.model_id,
                'tokens_used': 0,
                'modelUsed': self.model_id,
                'tokensUsed': 0,
            }
        except Exception as e:
            execution_time = (time.time() - start_time) * 1000
            return {
                'error': f'Agent execution failed: {str(e)}',
                'execution_time': execution_time,
                'attempt_count': 1,
                'agent_id': self.agent_id,
            }

    def _analyze_sentiment_trends(self, individual_sentiments: List[Dict]) -> str:
        """Analyze trends and variations across individual sentiment models"""
        if not individual_sentiments:
            return "No individual sentiment data available for trend analysis."

        # Calculate standard deviations to identify consensus vs disagreement
        dimensions = ["quality", "priceValue", "brandReputation", "brandTrust", "customerService"]
        trends = []

        for dim in dimensions:
            values = [s["ratings"][dim] for s in individual_sentiments if "ratings" in s and dim in s["ratings"]]
            if values:
                avg = sum(values) / len(values)
                std_dev = (sum((x - avg) ** 2 for x in values) / len(values)) ** 0.5

                if std_dev < 0.5:
                    trends.append(f"- {dim}: Strong consensus (σ={std_dev:.1f}) around {avg:.1f}/10")
                elif std_dev > 1.5:
                    trends.append(f"- {dim}: Divergent views (σ={std_dev:.1f}) ranging {min(values)}-{max(values)}/10")
                else:
                    trends.append(f"- {dim}: Moderate agreement (σ={std_dev:.1f}) averaging {avg:.1f}/10")

        return "\n".join(trends) if trends else "Unable to calculate trend variations."

    def _summarize_citations(self, citations: List[Dict]) -> str:
        """Summarize the citation sources across all models"""
        if not citations:
            return "No citations available from model analyses."

        # Group by domain
        domains = {}
        for citation in citations:
            domain = citation.get('domain', 'unknown')
            if domain not in domains:
                domains[domain] = []
            domains[domain].append(citation.get('provider', 'unknown'))

        # Create summary
        domain_list = list(domains.keys())[:5]  # Top 5 domains
        provider_count = len(set(c.get('provider', '') for c in citations))

        summary_parts = [
            f"Analysis draws from {len(citations)} sources across {len(domain_list)} domains",
            f"Key sources: {', '.join(domain_list[:3])}{'...' if len(domain_list) > 3 else ''}",
            f"Data collected by {provider_count} different AI models with web search capabilities"
        ]

        return ". ".join(summary_parts)

    def _format_individual_summaries(self, individual_sentiments: List[Dict]) -> str:
        """Format individual model summaries for context"""
        if not individual_sentiments:
            return "No individual summaries available."

        formatted = []
        for sentiment in individual_sentiments[:4]:  # Limit to 4 models
            provider = sentiment.get('provider', 'unknown').upper()
            summary = sentiment.get('summary', '')[:100] + "..." if len(sentiment.get('summary', '')) > 100 else sentiment.get('summary', '')
            formatted.append(f"- {provider}: {summary}")

        return "\n".join(formatted)

async def main():
    """Main entry point for the sentiment summary agent."""
    try:
        # Read input from stdin
        input_data = json.loads(sys.stdin.read())

        # Create agent
        agent = SentimentSummaryAgent()

        # Execute the agent using BaseAgent pattern
        result = await agent.execute(input_data)

        # Convert result to JSON-serializable format
        if 'result' in result and hasattr(result['result'], 'model_dump'):
            result['result'] = result['result'].model_dump()

        # Output result
        print(json.dumps(result, indent=2, default=str))

    except Exception as e:
        error_output = {
            "error": str(e),
            "type": "sentiment_summary_error",
            "agent_id": "sentiment_summary_agent"
        }
        print(json.dumps(error_output, indent=2))
        sys.exit(1)

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
