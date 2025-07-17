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
from pydantic_agents.base_agent import BaseAgent
from pydantic_agents.config.models import get_default_model_for_task, ModelTask

class CompetitorInfo(BaseModel):
    name: str = Field(min_length=1, description="Company name")
    website: str = Field(description="Company website URL")

class WebsiteEnrichmentInput(BaseModel):
    competitor_names: List[str]
    context: Optional[str] = None
    search_depth: str = "standard"

class WebsiteEnrichmentResult(BaseModel):
    competitors: List[CompetitorInfo] = Field(description="List of competitors with their websites")

class WebsiteEnrichmentAgent(BaseAgent):
    def __init__(self):
        # Get default model for website enrichment task (only gemini can do this)
        default_model_config = get_default_model_for_task(ModelTask.WEBSITE_ENRICHMENT)
        if default_model_config:
            model_id = default_model_config.get_pydantic_model_id()
        else:
            model_id = os.getenv('PYDANTIC_MODEL_ID', 'gemini:gemini-2.5-flash')
        
        super().__init__(
            agent_id="website_enrichment_agent",
            default_model=model_id,
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
    
    def get_output_type(self):
        return WebsiteEnrichmentResult
    
    async def process_input(self, input_data: dict) -> str:
        """Process input data and create website enrichment prompt"""
        # Handle both dict and WebsiteEnrichmentInput
        if isinstance(input_data, dict):
            competitor_names = input_data.get('competitor_names', [])
            context = input_data.get('context', '')
            search_depth = input_data.get('search_depth', 'standard')
        else:
            competitor_names = input_data.competitor_names
            context = input_data.context
            search_depth = input_data.search_depth
        
        # Build the prompt
        prompt_parts = []
        
        # Add context if provided
        if context:
            prompt_parts.append(f"Context: {context}")
        
        # Add search depth information
        depth_instructions = {
            "standard": "Provide main corporate websites for each competitor",
            "comprehensive": "Include main websites and relevant subsidiary sites",
            "basic": "Focus only on the most well-known, established competitors"
        }
        
        prompt_parts.append(f"Search Depth: {depth_instructions.get(search_depth, 'standard')}")
        
        # Add competitor names
        competitor_list = "\n".join([f"- {name}" for name in competitor_names])
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
        
        return "\n\n".join(prompt_parts)

async def main():
    """Main entry point for the website enrichment agent."""
    try:
        # Read input from stdin
        input_data = json.loads(sys.stdin.read())
        
        # Create agent
        agent = WebsiteEnrichmentAgent()
        
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
            "type": "website_enrichment_error",
            "agent_id": "website_enrichment_agent"
        }
        print(json.dumps(error_output, indent=2))
        sys.exit(1)

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())