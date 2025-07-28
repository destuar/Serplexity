#!/usr/bin/env python3
"""
Website Enrichment Agent for PydanticAI
Enriches competitor information with canonical website data and brand deduplication.
"""

import json
import sys
import os
import re
from typing import List, Optional, Dict, Set
from urllib.parse import urlparse, urljoin
from pydantic import BaseModel, Field, validator
from pydantic_ai import Agent
from pydantic_ai.models import KnownModelName
from ..base_agent import BaseAgent
from ..config.models import get_default_model_for_task, ModelTask

class CompetitorInfo(BaseModel):
    name: str = Field(min_length=1, description="Canonical company name")
    website: str = Field(description="Canonical company website URL")
    confidence: float = Field(ge=0.0, le=1.0, description="Confidence score for website accuracy")
    
    @validator('website')
    def normalize_website(cls, v):
        """Normalize and validate website URL"""
        if not v:
            return v
        
        # Ensure proper URL format
        if not v.startswith(('http://', 'https://')):
            v = f"https://{v}"
        
        try:
            parsed = urlparse(v)
            # Normalize to canonical domain (remove paths, params, etc.)
            normalized = f"{parsed.scheme}://{parsed.netloc.lower()}"
            
            # Remove 'www.' for consistency unless it's specifically needed
            if normalized.startswith('https://www.'):
                base_domain = normalized[12:]  # Remove 'https://www.'
                # Keep www. only for domains that specifically require it
                if not any(base_domain.startswith(tld) for tld in ['gov.', 'edu.', 'org.']):
                    normalized = f"https://{base_domain}"
            
            return normalized
        except Exception:
            return v

class WebsiteEnrichmentInput(BaseModel):
    competitor_names: List[str]
    context: Optional[str] = None
    search_depth: str = "standard"

class WebsiteEnrichmentResult(BaseModel):
    competitors: List[CompetitorInfo] = Field(description="List of unique competitors with canonical websites")

class WebsiteEnrichmentAgent(BaseAgent):
    def __init__(self):
        # Get default model for website enrichment task
        default_model_config = get_default_model_for_task(ModelTask.WEBSITE_ENRICHMENT)
        if default_model_config:
            model_id = default_model_config.get_pydantic_model_id()
        else:
            model_id = os.getenv('PYDANTIC_MODEL_ID', 'openai:sonar')
        
        super().__init__(
            agent_id="website_enrichment_agent",
            default_model=model_id,
            system_prompt=self._build_system_prompt()
        )
    
    def _normalize_brand_name(self, name: str) -> str:
        """Normalize brand names for deduplication"""
        # Remove common suffixes and variations
        normalized = re.sub(r'\s+(Inc\.?|LLC\.?|Corp\.?|Corporation|Company|Co\.?|Ltd\.?|Limited)$', '', name, flags=re.IGNORECASE)
        normalized = re.sub(r'\s+', ' ', normalized).strip()
        return normalized.lower()
    
    def _extract_root_domain(self, url: str) -> str:
        """Extract root domain from URL for deduplication"""
        try:
            parsed = urlparse(url if url.startswith(('http://', 'https://')) else f"https://{url}")
            domain = parsed.netloc.lower()
            # Remove 'www.' prefix for comparison
            if domain.startswith('www.'):
                domain = domain[4:]
            return domain
        except:
            return url.lower()
    
    def _deduplicate_competitors(self, competitors: List[CompetitorInfo]) -> List[CompetitorInfo]:
        """Remove duplicate brands based on normalized names and domains"""
        seen_names: Set[str] = set()
        seen_domains: Set[str] = set()
        deduplicated = []
        
        # Sort by confidence score (highest first) to keep best entries
        competitors_sorted = sorted(competitors, key=lambda x: x.confidence, reverse=True)
        
        for competitor in competitors_sorted:
            normalized_name = self._normalize_brand_name(competitor.name)
            root_domain = self._extract_root_domain(competitor.website)
            
            # Skip if we've seen this brand name or domain before
            if normalized_name in seen_names or root_domain in seen_domains:
                continue
            
            seen_names.add(normalized_name)
            seen_domains.add(root_domain)
            deduplicated.append(competitor)
        
        return deduplicated
    
    def _build_system_prompt(self) -> str:
        return """You are an expert business intelligence analyst specializing in competitive research 
and canonical website identification with access to real-time web search. Your task is to find the 
official, primary website for each competitor company and eliminate duplicates.

SEARCH STRATEGY:
Use web search to find current, verified company websites. Search for:
- "{company_name}" official website
- "{company_name}" company website

CRITICAL REQUIREMENTS:

1. **CANONICAL DOMAINS ONLY**: Always return the main corporate domain, not subpages or paths
   - ✅ Good: https://cedars-sinai.com
   - ❌ Bad: https://cedars-sinai.com/health/services
   - ❌ Bad: https://careers.cedars-sinai.com

2. **BRAND DEDUPLICATION**: If multiple variations of the same company are mentioned, 
   return only ONE entry with the most recognizable brand name:
   - "Cedars-Sinai", "Cedars Sinai Health", "Cedars-Sinai Medical Center" → Pick ONE
   - Use the most commonly known name

3. **DOMAIN VERIFICATION**: Use web search to ensure websites are legitimate:
   - Verify the domain actually belongs to the company
   - Check for active, current websites
   - Accept any legitimate domain extension (.com, .org, .net, .edu, .gov, etc.)
   - Avoid redirect chains or temporary domains

4. **URL NORMALIZATION**: 
   - Always use https://
   - Remove www. unless specifically required
   - Use lowercase domains
   - No trailing paths, parameters, or anchors

5. **CURRENT INFORMATION**: Use web search to find up-to-date website information:
   - Verify companies are still active/operational
   - Find current business websites

EXAMPLES:
Input: ["Mayo Clinic", "Mayo Clinic Rochester", "Mayo One"]
Output: [{"name": "Mayo Clinic", "website": "https://mayoclinic.org"}]

Input: ["Apple Inc", "Apple Computer", "Apple"]  
Output: [{"name": "Apple", "website": "https://apple.com"}]

Remember: Use web search to verify accuracy. Quality over quantity. Better to return fewer, 
verified entries than many questionable ones."""
    
    def get_output_type(self):
        return WebsiteEnrichmentResult
    
    async def process_input(self, input_data: dict) -> str:
        """Process input data and create website enrichment prompt with deduplication"""
        # Handle both dict and WebsiteEnrichmentInput
        if isinstance(input_data, dict):
            competitor_names = input_data.get('competitor_names', [])
            context = input_data.get('context', '')
            search_depth = input_data.get('search_depth', 'standard')
        else:
            competitor_names = input_data.competitor_names
            context = input_data.context
            search_depth = input_data.search_depth
        
        # Pre-process to remove obvious duplicates at input level
        normalized_names = {}
        unique_names = []
        
        for name in competitor_names:
            normalized = self._normalize_brand_name(name)
            if normalized not in normalized_names:
                normalized_names[normalized] = name
                unique_names.append(name)
        
        # Build the prompt
        prompt_parts = []
        
        # Add context if provided
        if context:
            prompt_parts.append(f"Industry Context: {context}")
        
        # Add search depth information
        depth_instructions = {
            "standard": "Focus on main corporate websites with high confidence",
            "comprehensive": "Include main websites and well-known subsidiaries", 
            "basic": "Only the most established, well-known competitors"
        }
        
        prompt_parts.append(f"Search Approach: {depth_instructions.get(search_depth, 'standard')}")
        
        # Add competitor names with deduplication notice
        competitor_list = "\n".join([f"- {name}" for name in unique_names])
        prompt_parts.append(f"""Companies to Research (after pre-deduplication):
{competitor_list}

IMPORTANT: Some of these may still be the same company with different names. 
Return only ONE entry per actual business entity.""")
        
        # Add final instructions
        prompt_parts.append("""
TASK: Find canonical websites and deduplicate brands

Steps:
1. Identify which companies might be the same entity
2. For each unique business, find their primary official website
3. Use the most recognizable brand name
4. Return canonical domain only (no paths/subpages)
5. Assign appropriate confidence scores
6. Only include entries with confidence ≥ 0.5

Quality Control:
- Verify domain ownership matches the company
- Prefer official corporate domains
- Eliminate obvious duplicates
- Use proper URL formatting
""")
        
        return "\n\n".join(prompt_parts)
    
    async def execute(self, input_data: dict) -> dict:
        """Execute the agent and apply additional deduplication"""
        # Get the base result
        result = await super().execute(input_data)
        
        # Apply additional deduplication to the results
        if 'result' in result and hasattr(result['result'], 'competitors'):
            competitors = result['result'].competitors
            deduplicated = self._deduplicate_competitors(competitors)
            
            # Update the result
            result['result'].competitors = deduplicated
            
            # Log deduplication stats
            original_count = len(competitors)
            final_count = len(deduplicated)
            if original_count != final_count:
                print(f"[DEDUP] Reduced {original_count} → {final_count} competitors", file=sys.stderr)
        
        return result

async def main():
    """Main entry point for the website enrichment agent."""
    try:
        # Read input from stdin
        input_data = json.loads(sys.stdin.read())
        
        # Create agent
        agent = WebsiteEnrichmentAgent()
        
        # Execute the agent with deduplication
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