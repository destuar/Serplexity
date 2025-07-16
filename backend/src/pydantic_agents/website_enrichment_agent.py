#!/usr/bin/env python3
"""
Website Enrichment Agent for PydanticAI
Enriches competitor information with website data.
"""

import json
import sys
import os
from typing import List, Optional
from pydantic import BaseModel, Field, HttpUrl
from pydantic_ai import Agent
from pydantic_ai.models import KnownModelName

class CompetitorInfo(BaseModel):
    name: str = Field(min_length=1, description="Company name")
    website: str = Field(description="Company website URL")

class WebsiteEnrichmentInput(BaseModel):
    competitor_names: List[str]
    context: Optional[str] = None
    search_depth: str = "standard"

class WebsiteEnrichmentResult(BaseModel):
    competitors: List[CompetitorInfo] = Field(description="List of competitors with their websites")

class WebsiteEnrichmentAgent:
    def __init__(self):
        # Get model configuration from environment
        model_id = os.getenv('PYDANTIC_MODEL_ID', 'openai:gpt-4o')
        
        # Create the agent
        self.agent = Agent(
            model=model_id,
            result_type=WebsiteEnrichmentResult,
            system_prompt=self._build_system_prompt()
        )
    
    def _build_system_prompt(self) -> str:
        return """You are a business intelligence expert specializing in competitor research 
and website identification. Your task is to identify and provide accurate website URLs 
for the given competitor companies.

Key requirements:
1. **Accuracy**: Provide only verified, accurate website URLs
2. **Completeness**: Find websites for as many competitors as possible
3. **Format**: Ensure URLs are properly formatted (include https://)
4. **Relevance**: Focus on main corporate websites, not social media
5. **Verification**: Use your knowledge to verify website authenticity

Guidelines:
- Prefer official company websites over third-party sites
- Include the full URL (e.g., https://www.company.com)
- If unsure about a website, it's better to skip than provide incorrect information
- Focus on the primary business website, not subsidiaries unless specified
- Validate that the website matches the company name and industry

Output format:
- Return a list of CompetitorInfo objects
- Each should have the exact company name and verified website URL
- Only include entries where you're confident about the website accuracy"""
    
    async def enrich_websites(self, input_data: WebsiteEnrichmentInput) -> WebsiteEnrichmentResult:
        """Enrich competitor names with their website information."""
        
        # Build the prompt
        prompt_parts = []
        
        # Add context if provided
        if input_data.context:
            prompt_parts.append(f"Context: {input_data.context}")
        
        # Add search depth information
        depth_instructions = {
            "standard": "Provide main corporate websites for each competitor",
            "comprehensive": "Include main websites and relevant subsidiary sites",
            "basic": "Focus only on the most well-known, established competitors"
        }
        
        prompt_parts.append(f"Search Depth: {depth_instructions.get(input_data.search_depth, 'standard')}")
        
        # Add competitor names
        competitor_list = "\n".join([f"- {name}" for name in input_data.competitor_names])
        prompt_parts.append(f"Competitors to research:\n{competitor_list}")
        
        # Add instructions
        prompt_parts.append("""
Please find and provide the official website URLs for each competitor company.

Requirements:
1. Provide accurate, verified website URLs
2. Use proper URL format (https://www.company.com)
3. Focus on main corporate websites
4. Only include entries where you're confident about accuracy
5. If you cannot find a reliable website for a competitor, skip it

For each competitor, provide:
- Exact company name (as provided)
- Official website URL
""")
        
        prompt = "\n\n".join(prompt_parts)
        
        # Run the agent
        result = await self.agent.run(prompt)
        
        return result.data

def main():
    """Main entry point for the website enrichment agent."""
    try:
        # Read input from stdin
        input_data = json.loads(sys.stdin.read())
        
        # Validate input
        enrichment_input = WebsiteEnrichmentInput(**input_data)
        
        # Create agent
        agent = WebsiteEnrichmentAgent()
        
        # Process the website enrichment
        import asyncio
        result = asyncio.run(agent.enrich_websites(enrichment_input))
        
        # Prepare output
        output = {
            "data": result.model_dump(),
            "model_used": os.getenv('PYDANTIC_MODEL_ID', 'openai:gpt-4o'),
            "tokens_used": len(enrichment_input.competitor_names) * 50,  # Estimated token usage
            "search_depth": enrichment_input.search_depth,
            "found_count": len(result.competitors),
            "requested_count": len(enrichment_input.competitor_names)
        }
        
        # Output result
        print(json.dumps(output, indent=2))
        
    except Exception as e:
        error_output = {
            "error": str(e),
            "type": "website_enrichment_error",
            "model_used": os.getenv('PYDANTIC_MODEL_ID', 'openai:gpt-4o'),
            "tokens_used": 0
        }
        print(json.dumps(error_output, indent=2))
        sys.exit(1)

if __name__ == "__main__":
    main()