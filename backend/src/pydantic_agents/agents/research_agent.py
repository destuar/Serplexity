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

    def __init__(self):
        """Initialize with centralized model configuration for research"""
        # Use centralized configuration instead of hardcoded model
        default_model_config = get_default_model_for_task(ModelTask.COMPANY_RESEARCH)
        default_model = default_model_config.get_pydantic_model_id() if default_model_config else "openai:gpt-4.1-mini"

        super().__init__(
            agent_id="company_research_agent",
            default_model=default_model,
            system_prompt=self._build_system_prompt(),
            temperature=0.7,
            timeout=60000,  # Longer timeout for web research
            max_retries=2
        )
    
    def _build_system_prompt(self) -> str:
        """Build system prompt for web search research"""
        return (
            "You are a web research assistant. Your job is to research a company "
            "and provide a clear analysis of what they offer.\n\n"
            "CRITICAL: Always use the EXACT company name provided. "
            "Do not substitute, modify, or confuse them with similar companies.\n\n"
            "Use web search to find information about the company and provide a structured analysis including:\n"
            "1. What products/services they offer (be specific and detailed)\n"
            "2. Who their target customers are\n"
            "3. What problems they solve for those customers\n"
            "4. What industry category they operate in\n\n"
            "Be thorough and factual. Focus on understanding their business model, "
            "value proposition, and customer base. Use only web search, never attempt "
            "to access websites directly."
        )
    
    def _create_agent(self) -> Agent:
        """Create the PydanticAI agent with configured model"""
        return super()._create_agent()

    def get_output_type(self):
        return CompanyResearch

    async def process_input(self, input_data: dict) -> str:
        """Create simple research prompt using only web search"""
        company_name = input_data.get('company_name', '')
        industry = input_data.get('industry', 'General')

        return (f"Research the company '{company_name}' in the {industry} industry. "
                f"Use web search to find information about {company_name}. "
                f"IMPORTANT: Focus specifically on {company_name} - "
                f"do not confuse this with any other similar company names. "
                f"What products and services does {company_name} offer? "
                f"Use only web search, do not attempt to access any websites directly.")

    async def execute(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Execute simple website research"""
        import time
        start_time = time.time()

        try:
            # Use standard agent for all research (no more Perplexity custom logic)
            agent = self.agent

            prompt = await self.process_input(input_data)
            
            # Add timeout protection
            import asyncio
            try:
                result = await asyncio.wait_for(agent.run(prompt), timeout=45.0)
            except asyncio.TimeoutError:
                raise Exception("Research agent timed out after 45 seconds")

            # Extract and parse data from PydanticAI result (standard structured output)
            if hasattr(result, 'data'):
                research_data = result.data
            elif hasattr(result, 'output'):
                research_data = result.output
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