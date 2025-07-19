#!/usr/bin/env python3
"""
Company Research Agent for PydanticAI
Researches companies and generates target market questions using Perplexity Sonar.
"""

import json
import sys
import os
import logging
from typing import Optional, List, Dict, Any

from pydantic import BaseModel, Field
from pydantic_agents.base_agent import BaseAgent
from pydantic_agents.config.models import get_model_by_id
from pydantic_ai import Agent

# Set up logging
logger = logging.getLogger(__name__)

class CompanyResearch(BaseModel):
    """Research findings about a company and its target market"""
    company_name: str = Field(..., description="Company name")
    industry: str = Field(..., description="Company industry")
    target_market: str = Field(..., description="Description of the target market")
    key_services: List[str] = Field(..., description="Key services or products offered")
    target_questions: List[str] = Field(..., min_items=5, max_items=5, description="5 questions target customers might search for")
    research_summary: str = Field(..., description="Summary of research findings")

class CompanyInput(BaseModel):
    company_name: str
    website_url: str
    industry: Optional[str] = None

class CompanyResearchAgent(BaseAgent):
    def __init__(self, provider: str = "perplexity"):
        """Initialize with Perplexity as default for web research"""
        # Force perplexity/sonar for web research capabilities
        model_config = get_model_by_id("sonar")
        default_model = model_config.get_pydantic_model_id() if model_config else "sonar"
        
        super().__init__(
            agent_id="company_research_agent",
            default_model=default_model,
            system_prompt=self._build_system_prompt(),
            temperature=0.7,
            timeout=60000,  # Longer timeout for web research
            max_retries=2
        )
    
    def _build_system_prompt(self) -> str:
        """Build system prompt for company research and question generation"""
        return """You are a market research expert specializing in analyzing companies and their target markets.

Your task is to research a company using their website and industry information, then generate strategic questions that potential customers in their target market might search for online.

Research Process:
1. **Company Analysis**: Research the company's website to understand:
   - Core business model and value proposition
   - Primary products/services offered
   - Target customer segments
   - Market positioning and competitive advantages
   - Industry focus areas

2. **Target Market Identification**: Based on your research, identify:
   - Who are their ideal customers (demographics, firmographics)
   - What problems do they solve for these customers
   - What decision-making process do their customers go through

3. **Question Generation**: Create 5 strategic search questions that:
   - Potential customers would realistically search for
   - Align with the company's value proposition
   - Represent different stages of the customer journey (awareness, consideration, decision)
   - Could help the company rank for relevant, high-intent searches
   - Are specific enough to attract qualified prospects

Question Guidelines:
- Focus on problems the company solves
- Include industry-specific pain points
- Consider both generic and specific search intents
- Think about what prospects search before they know about this company
- Avoid branded terms (they want to be discovered)

Example question types:
- "How to [solve problem the company addresses]"
- "Best [solution category] for [specific use case]"
- "What is [industry term/process] and how does it work"
- "[Industry] challenges and solutions"
- "Compare [solution types] for [specific need]"

Use web search to gather current, accurate information about the company and industry trends."""

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
        """Create the PydanticAI agent with Perplexity model"""
        return Agent(
            model=self._create_perplexity_model(),
            system_prompt=self.env_system_prompt or self.system_prompt,
            deps_type=None,
            output_type=self.get_output_type()
        )

    def get_output_type(self):
        return CompanyResearch

    async def process_input(self, input_data: dict) -> str:
        """Generate research prompt for the company"""
        company_name = input_data.get('company_name', '')
        website_url = input_data.get('website_url', '')
        industry = input_data.get('industry', '')
        
        prompt_parts = [
            f"Research the company: {company_name}",
            f"Website: {website_url}",
        ]
        
        if industry:
            prompt_parts.append(f"Industry: {industry}")
        
        prompt_parts.extend([
            "",
            "Please conduct comprehensive research on this company and provide:",
            "1. Analysis of their target market and customer segments",
            "2. Key services/products they offer",
            "3. Five strategic questions that potential customers might search for that could lead them to discover this company",
            "",
            "The questions should be:",
            "- Relevant to problems the company solves",
            "- Something prospects would search before knowing about this company",
            "- Varied across different customer journey stages",
            "- Industry-appropriate and specific enough to attract qualified leads",
            "- Free of branded terms (generic search intent)",
            "",
            "Use web search to gather current information about the company, industry trends, and competitive landscape."
        ])
        
        return "\n".join(prompt_parts)

    async def execute(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Execute company research with Perplexity"""
        import time
        start_time = time.time()
        
        try:
            # Create a simple agent for raw text handling
            simple_agent = Agent(
                model=self._create_perplexity_model(),
                system_prompt=self.env_system_prompt or self.system_prompt,
            )
            
            # Get the research prompt
            prompt = await self.process_input(input_data)
            
            # Execute with Perplexity
            raw_result = await simple_agent.run(prompt)
            
            logger.info(f"🔍 Perplexity research result type: {type(raw_result)}")
            
            # Extract content
            if hasattr(raw_result, 'output'):
                research_content = raw_result.output
            elif hasattr(raw_result, 'data'):
                research_content = str(raw_result.data)
            else:
                research_content = str(raw_result)
            
            # Parse the research into structured format
            # For now, we'll create a structured response based on the research content
            result = self._parse_research_content(research_content, input_data)
            
            execution_time = (time.time() - start_time) * 1000
            
            return {
                "result": result,
                "execution_time": execution_time,
                "attempt_count": 1,
                "agent_id": self.agent_id,
                "model_used": "sonar",
                "tokens_used": 0,  # Perplexity doesn't always return token counts
                "modelUsed": "sonar",
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

    def _parse_research_content(self, content: str, input_data: Dict[str, Any]) -> CompanyResearch:
        """Parse raw research content into structured format"""
        import re
        
        company_name = input_data.get('company_name', 'Unknown Company')
        industry = input_data.get('industry', 'Technology')
        
        # Extract questions using various patterns
        questions = []
        
        # Look for numbered lists, bullet points, or question patterns
        question_patterns = [
            r'\d+\.\s*([^\n]+\?)',  # "1. Question?"
            r'[-•]\s*([^\n]+\?)',   # "- Question?" or "• Question?"
            r'\n([^.\n]*\?)',       # Lines ending with ?
        ]
        
        for pattern in question_patterns:
            matches = re.findall(pattern, content, re.MULTILINE)
            for match in matches:
                clean_question = match.strip()
                if len(clean_question) > 10 and clean_question not in questions:
                    questions.append(clean_question)
        
        # If we don't have enough questions, generate some based on the content
        while len(questions) < 5:
            if len(questions) == 0:
                questions.append(f"What are the best solutions for {industry.lower()} companies?")
            elif len(questions) == 1:
                questions.append(f"How to choose the right {industry.lower()} service provider?")
            elif len(questions) == 2:
                questions.append(f"What factors to consider when selecting {industry.lower()} tools?")
            elif len(questions) == 3:
                questions.append(f"Common challenges in {industry.lower()} and how to solve them?")
            elif len(questions) == 4:
                questions.append(f"ROI of investing in {industry.lower()} solutions?")
        
        # Take only first 5 questions
        questions = questions[:5]
        
        # Extract key services (look for service/product mentions)
        services = []
        service_patterns = [
            r'(?:offers?|provides?|delivers?|specializes? in)\s+([^.\n]+)',
            r'(?:services?|products?|solutions?):\s*([^.\n]+)',
        ]
        
        for pattern in service_patterns:
            matches = re.findall(pattern, content, re.IGNORECASE)
            for match in matches:
                clean_service = match.strip()
                if len(clean_service) > 5 and len(clean_service) < 100:
                    services.append(clean_service)
        
        if not services:
            services = [f"{industry} solutions", "Consulting services", "Technology implementation"]
        
        # Create target market description
        target_market = f"Businesses in the {industry.lower()} sector looking for innovative solutions to improve their operations and competitive advantage."
        
        return CompanyResearch(
            company_name=company_name,
            industry=industry,
            target_market=target_market,
            key_services=services[:5],  # Limit to 5 services
            target_questions=questions,
            research_summary=content[:500] + "..." if len(content) > 500 else content
        )

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