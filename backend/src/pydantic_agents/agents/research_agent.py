#!/usr/bin/env python3
"""
Company Research Agent for PydanticAI
Simple website research using centralized model configuration for company research.
"""

import json
import sys
import os
import logging
from typing import Optional, List, Dict, Any, TypedDict

from pydantic import BaseModel, Field
from ..base_agent import BaseAgent
from ..config.models import get_default_model_for_task, ModelTask
from pydantic_ai import Agent

# Set up logging
logger = logging.getLogger(__name__)

class CompanyResearch(BaseModel):
    """Simple research findings about what a company offers"""
    company_name: str = Field(..., description="Company name")
    website_url: str = Field(..., description="Company website")
    what_they_offer: str = Field(..., description="Detailed description of what the company offers - products, services, solutions")
    target_customers: str = Field(..., description="Who their target customers are")
    problems_solved: str = Field(..., description="What problems they solve for customers")
    industry_category: str = Field(..., description="What industry/category they operate in")

class CompanyInput(BaseModel):
    company_name: str
    website_url: str
    industry: Optional[str] = None

class CompanyResearchAgent(BaseAgent):

    def __init__(self, provider: str = "perplexity"):
        """Initialize with centralized model configuration for company research"""
        # Use centralized configuration instead of hardcoding sonar
        default_model_config = get_default_model_for_task(ModelTask.COMPANY_RESEARCH)
        default_model = default_model_config.get_pydantic_model_id() if default_model_config else "openai:sonar"
        
        super().__init__(
            agent_id="company_research_agent",
            default_model=default_model,
            system_prompt=self._build_system_prompt(),
            temperature=0.7,
            timeout=60000,  # Longer timeout for web research
            max_retries=2
        )
    
    def _build_system_prompt(self) -> str:
        """Build system prompt for simple website research"""
        return (
            "You are a web research assistant. Your job is to research a company's website "
            "and provide a clear analysis of what they offer.\n\n"
            "CRITICAL: Always use the EXACT company name and website URL provided in the user prompt. "
            "Do not substitute, modify, or confuse them with similar companies.\n\n"
            "Provide a structured analysis including:\n"
            "1. What products/services they offer (be specific and detailed)\n"
            "2. Who their target customers are\n"
            "3. What problems they solve for those customers\n"
            "4. What industry category they operate in\n\n"
            "Be thorough and factual. Focus on understanding their business model, "
            "value proposition, and customer base. Always confirm you are researching "
            "the correct company by double-checking the company name and URL."
        )
    
    def _build_perplexity_prompt(self) -> str:
        """Build system prompt specifically for Perplexity with manual parsing"""
        return (
            "You are a web research assistant. Research the given company's website "
            "and provide a clear analysis in the following format:\n\n"
            "CRITICAL: Always use the EXACT company name and website URL provided in the user prompt. "
            "Do not substitute, modify, or confuse them with similar companies.\n\n"
            "COMPANY: [use the exact company name provided]\n"
            "WEBSITE: [use the exact website URL provided]\n"
            "OFFERINGS: [detailed description of products/services]\n"
            "CUSTOMERS: [target customer description]\n"
            "PROBLEMS: [problems they solve]\n"
            "INDUSTRY: [industry category]\n\n"
            "Be thorough and factual. Use the exact format above for easy parsing. "
            "Always confirm you are researching the correct company by using the exact "
            "company name and URL provided in the prompt."
        )

    def _create_perplexity_model(self):
        """Create Perplexity model with custom OpenAI provider"""
        from pydantic_ai.models.openai import OpenAIModel
        from pydantic_ai.providers.openai import OpenAIProvider
        import os
        
        api_key = os.getenv('PERPLEXITY_API_KEY')
        logger.info(f"🔍 Perplexity API key available: {bool(api_key)}")
        
        return OpenAIModel(
            'sonar',
            provider=OpenAIProvider(
                base_url='https://api.perplexity.ai',
                api_key=api_key,
            ),
        )

    def _create_agent(self) -> Agent:
        """Create the PydanticAI agent with configured model"""
        # If the configured model is sonar, create custom Perplexity provider without structured output
        if isinstance(self.model_id, str) and 'sonar' in self.model_id:
            return Agent(
                model=self._create_perplexity_model(),
                system_prompt=self.env_system_prompt or self.system_prompt,
                deps_type=None,
                # Remove structured output for Perplexity as it doesn't support it
            )
        else:
            # Use standard agent creation for other models
            return super()._create_agent()

    def get_output_type(self):
        return CompanyResearch

    def _parse_perplexity_response(self, raw_output: str, input_data: dict) -> CompanyResearch:
        """Parse unstructured Perplexity response into CompanyResearch model"""
        import re
        
        # Extract structured information using regex
        def extract_field(pattern: str, default: str = "Information not available") -> str:
            match = re.search(pattern, raw_output, re.IGNORECASE | re.MULTILINE)
            return match.group(1).strip() if match else default
        
        # Parse the structured response - always use the original input data as fallback
        company_name = extract_field(r"COMPANY:\s*(.+)", input_data.get('company_name', ''))
        website_url = extract_field(r"WEBSITE:\s*(.+)", input_data.get('website_url', ''))
        
        # Ensure we always use the exact company name and URL from input
        if not company_name or company_name == "Information not available":
            company_name = input_data.get('company_name', '')
        if not website_url or website_url == "Information not available":
            website_url = input_data.get('website_url', '')
        what_they_offer = extract_field(r"OFFERINGS:\s*(.+)", "Business offerings not clearly specified")
        target_customers = extract_field(r"CUSTOMERS:\s*(.+)", "Target customers not specified") 
        problems_solved = extract_field(r"PROBLEMS:\s*(.+)", "Problems solved not specified")
        industry_category = extract_field(r"INDUSTRY:\s*(.+)", input_data.get('industry', 'General'))
        
        # If structured parsing fails, try to extract from free-form text
        if what_they_offer == "Business offerings not clearly specified":
            # Fallback: use the first few sentences as offerings description
            sentences = raw_output.split('.')[:3]
            what_they_offer = '. '.join(sentences).strip() + '.'
        
        return CompanyResearch(
            company_name=company_name,
            website_url=website_url,
            what_they_offer=what_they_offer,
            target_customers=target_customers,
            problems_solved=problems_solved,
            industry_category=industry_category
        )

    async def process_input(self, input_data: dict) -> str:
        """Create simple research prompt"""
        company_name = input_data.get('company_name', '')
        website_url = input_data.get('website_url', '')

        return (f"Research the company '{company_name}' at website '{website_url}'. "
                f"IMPORTANT: Focus specifically on {company_name} at {website_url} - "
                f"do not confuse this with any other similar company names or websites. "
                f"What does {company_name} offer based on their website {website_url}?")

    async def execute(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Execute simple website research"""
        import time
        start_time = time.time()

        try:
            # Create agent for company research
            if isinstance(self.model_id, str) and 'sonar' in self.model_id:
                # Use unstructured agent for Perplexity
                agent = Agent(
                    model=self._create_perplexity_model(),
                    system_prompt=self._build_perplexity_prompt(),
                    deps_type=None,
                    # No output_type for Perplexity - we'll parse manually
                )
            else:
                agent = self.agent

            prompt = await self.process_input(input_data)
            
            # Add timeout protection
            import asyncio
            try:
                result = await asyncio.wait_for(agent.run(prompt), timeout=45.0)
            except asyncio.TimeoutError:
                raise Exception("Research agent timed out after 45 seconds")

            # Extract and parse data from PydanticAI result
            if hasattr(result, 'output'):
                raw_output = str(result.output)
                # Parse Perplexity unstructured response if using sonar model
                if isinstance(self.model_id, str) and 'sonar' in self.model_id:
                    research_data = self._parse_perplexity_response(raw_output, input_data)
                else:
                    research_data = result.output
            elif hasattr(result, 'data'):
                research_data = result.data
            else:
                research_data = result

            execution_time = (time.time() - start_time) * 1000
            
            # Ensure research_data is serializable for JSON output
            if hasattr(research_data, 'model_dump'):
                research_data = research_data.model_dump()
            elif hasattr(research_data, '__dict__'):
                research_data = research_data.__dict__
            
            return {
                "result": research_data,
                "execution_time": execution_time,
                "attempt_count": 1,
                "agent_id": self.agent_id,
                "model_used": str(self.model_id),
                "tokens_used": 0,
                "modelUsed": str(self.model_id),
                "tokensUsed": 0
            }
        except Exception as e:
            execution_time = (time.time() - start_time) * 1000
            return {
                "error": f"Company research failed: {str(e)}",
                "execution_time": execution_time,
                "attempt_count": 1,
                "agent_id": self.agent_id
            }


async def main():
    """Main entry point for the company research agent."""
    import logging
    import traceback
    
    # Set up logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[logging.StreamHandler(sys.stderr)]
    )
    logger = logging.getLogger(__name__)
    
    try:
        logger.info("🚀 Starting Company Research Agent")
        
        # Read input from stdin
        input_data = json.loads(sys.stdin.read())
        logger.info(f"📥 Received input: {json.dumps(input_data, indent=2)}")
        
        # Create agent
        logger.info("🔨 Creating CompanyResearchAgent...")
        agent = CompanyResearchAgent()
        logger.info(f"✅ Agent created with model: {agent.model_id}")
        
        # Execute the agent
        logger.info("🚀 Executing agent...")
        result = await agent.execute(input_data)
        logger.info("✅ Agent execution completed")
        
        # Convert result to JSON-serializable format
        if 'result' in result and hasattr(result['result'], 'model_dump'):
            result['result'] = result['result'].model_dump()
        
        # Output result
        print(json.dumps(result, indent=2, default=str))
        logger.info("✅ Response sent successfully")
        
    except json.JSONDecodeError as e:
        logger.error(f"❌ JSON decode error: {e}")
        error_output = {
            "error": f"Invalid JSON input: {str(e)}",
            "type": "json_decode_error",
            "agent_id": "company_research_agent"
        }
        print(json.dumps(error_output, indent=2))
        sys.exit(1)
        
    except Exception as e:
        logger.error(f"❌ Unexpected error: {e}")
        logger.error(f"📍 Traceback: {traceback.format_exc()}")
        
        error_output = {
            "error": str(e),
            "type": "company_research_error",
            "agent_id": "company_research_agent",
            "traceback": traceback.format_exc()
        }
        print(json.dumps(error_output, indent=2))
        sys.exit(1)

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())