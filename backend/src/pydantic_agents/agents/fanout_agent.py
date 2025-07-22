#!/usr/bin/env python3
"""
Intelligent Fanout Query Generation Agent

This agent generates 3-5 strategically selected fanout queries based on:
- Company profile and industry context
- Original benchmark question intent
- Query type relevance analysis

Key Features:
- Selects 3-5 most relevant query types from 10 available types
- Generates one high-quality query per selected type
- Provides rationale for query type selection
- Focuses on queries likely to trigger AI responses mentioning the company

Query Types Available:
- paraphrase: Lexical rewrites of the base query that keep intent
- comparison: Explicit A-vs-B or "compare ..." formulations  
- temporal: Add or imply date/period ("2025", "latest", "history of ...")
- topical: Semantically related sub-topics (co-occurrence/facet)
- entity_broader: Swap head entity for broader category (super-class)
- entity_narrower: Swap head entity for child/sibling entity
- session_context: Repeat or blend immediately-preceding user query
- user_profile: Tailor to user profile or geo (price tier, location, etc.)
- vertical: Direct search toward another index (images, PDF, video, Shopping, Scholar, etc.)
- safety_probe: Hidden policy probes for medical/financial/YMYL sensitivity

Usage:
    python fanout_agent.py < input.json
    
Input Format:
    {
        "company_name": "Slack",
        "industry": "Communication Software", 
        "base_question": "What are the best team communication tools?",
        "context": "Enterprise messaging platform for remote teams",
        "competitors": ["Microsoft Teams", "Discord", "Zoom Chat"]
    }

Output Format:
    {
        "data": {
            "companyName": "Slack",
            "industry": "Communication Software",
            "baseQuestion": "What are the best team communication tools?",
            "selectedQueryTypes": [...],
            "queries": [...],
            "totalQueries": 4,
            "generationTimestamp": "2024-01-15T10:30:00Z"
        },
        "metadata": {...}
    }
"""

import asyncio
import json
import sys
from typing import Dict, Any, Type, List

from ..base_agent import BaseAgent
from ..schemas import FanoutQueryGeneration, FanoutQuery, QueryType, QueryTypeSelection, PurchaseIntent
from ..config.models import get_default_model_for_task, ModelTask

class IntelligentFanoutAgent(BaseAgent):
    """
    Intelligent fanout query generation agent that selects the most relevant
    query types based on company, industry, and benchmark question analysis.
    """
    
    def __init__(self):
        # Get default model for fanout generation task
        default_model_config = get_default_model_for_task(ModelTask.FANOUT_GENERATION)
        default_model = default_model_config.get_pydantic_model_id() if default_model_config else "openai:gpt-4.1-mini"
        
        super().__init__(
            agent_id="intelligent_fanout_agent",
            default_model=default_model,
            system_prompt=self._build_system_prompt(),
            temperature=0.7,  # Moderate temperature for strategic selection
            timeout=45000,
            max_retries=3
        )
    
    def _build_system_prompt(self) -> str:
        """Build comprehensive system prompt for intelligent fanout generation"""
        return """You are an expert AI search strategist specializing in intelligent query fanout generation.

Your task is to analyze a company, industry, and benchmark question, then select the 3-5 most strategically relevant query types and generate one high-quality query for each type.

AVAILABLE QUERY TYPES AND DESCRIPTIONS:

1. PARAPHRASE - Lexical rewrites of the base query that keep intent
   - Use when: Base question has potential for different phrasings users might search
   - Example: "Best CRM tools" → "Top customer relationship management software"

2. COMPARISON - Explicit A-vs-B or "compare ..." formulations
   - Use when: Users often compare solutions in this space
   - Example: "Salesforce vs HubSpot vs Pipedrive for small businesses"

3. TEMPORAL - Add or imply date/period ("2025", "latest", "history of ...")
   - Use when: Industry evolves rapidly or seasonal considerations matter
   - Example: "Best project management tools in 2025 for remote teams"

4. TOPICAL - Semantically related sub-topics (co-occurrence/facet)
   - Use when: Base question relates to broader topics or specific use cases
   - Example: "Team collaboration tools for software development workflows"

5. ENTITY_BROADER - Swap head entity for broader category (super-class)
   - Use when: Company operates in multiple related categories
   - Example: "Communication tools" → "Business productivity software"

6. ENTITY_NARROWER - Swap head entity for child/sibling entity
   - Use when: Company has specific market segments or specializations
   - Example: "Marketing tools" → "Email marketing automation platforms"

7. SESSION_CONTEXT - Repeat or blend immediately-preceding user query
   - Use when: Users often ask follow-up questions or have ongoing research
   - Example: "After choosing Slack, what integrations work best?"

8. USER_PROFILE - Tailor to user profile or geo (price tier, location, etc.)
   - Use when: Company serves distinct user segments or geographic markets
   - Example: "Affordable CRM solutions for startups under $50/month"

9. VERTICAL - Direct search toward another index (images, PDF, video, Shopping, Scholar, etc.)
   - Use when: Visual content, documentation, or specific media types are relevant
   - Example: "Slack tutorial videos" or "site:youtube.com Slack vs Teams comparison"

10. SAFETY_PROBE - Hidden policy probes for medical/financial/YMYL sensitivity
    - Use when: Company operates in regulated industries or sensitive domains
    - Example: "HIPAA-compliant communication tools for healthcare"

SELECTION STRATEGY:

1. ANALYZE the base question intent and user context
2. CONSIDER the company's competitive landscape and positioning  
3. EVALUATE which query types would generate AI responses likely to mention the company
4. SELECT 3-5 most strategic query types based on:
   - Relevance to the company's market position
   - Likelihood of triggering comprehensive AI responses
   - Diversity of user search patterns
   - Coverage of key decision-making scenarios

QUALITY REQUIREMENTS:

- Each query should be natural and conversational (5-50 words)
- Queries should feel like real user searches, not artificial constructs
- Include relevant industry terminology and context
- Ensure queries would likely appear in AI training data
- Balance direct and indirect company mentions

PURCHASE INTENT CLASSIFICATION:

Each query must be classified by purchase intent:

1. AWARENESS - User is learning about solutions or problems
   - Examples: "What is CRM?", "Types of project management tools"
   - Intent: Educational, discovering options

2. CONSIDERATION - User is comparing options and evaluating
   - Examples: "Slack vs Teams comparison", "Best CRM for small business"
   - Intent: Researching, comparing alternatives

3. PURCHASE - User is ready to make a decision or already decided
   - Examples: "Slack pricing plans", "How to get started with Asana"
   - Intent: Ready to buy, implementation-focused

INTENT ASSIGNMENT GUIDELINES:
- Awareness: Broad educational queries, problem identification
- Consideration: Comparison queries, evaluation criteria, "best" questions
- Purchase: Pricing, implementation, getting started, specific features

Your response must follow the exact JSON format specified by the FanoutQueryGeneration schema, including:
- Rationale for each selected query type
- One strategically crafted query per selected type  
- Appropriate purchase intent classification for each query"""
    
    def get_output_type(self) -> Type[FanoutQueryGeneration]:
        """Return the output type for this agent"""
        return FanoutQueryGeneration
    
    async def process_input(self, input_data: Dict[str, Any]) -> str:
        """Process input data and create intelligent query generation prompt"""
        company_name = input_data.get('company_name', '')
        industry = input_data.get('industry', '')
        base_question = input_data.get('base_question', '')
        context = input_data.get('context', '')
        competitors = input_data.get('competitors', [])
        
        if not company_name:
            raise ValueError("company_name is required")
        if not industry:
            raise ValueError("industry is required")
        if not base_question:
            raise ValueError("base_question is required")
        
        # Build analysis prompt
        prompt = f"""Analyze the following company and benchmark question to generate an intelligent fanout strategy:

COMPANY PROFILE:
- Name: {company_name}
- Industry: {industry}
- Context: {context}
- Key Competitors: {', '.join(competitors) if competitors else 'Not specified'}

BENCHMARK QUESTION TO ANALYZE:
"{base_question}"

TASK: Select the 3-5 most strategically relevant query types and generate one high-quality query for each.

ANALYSIS CONSIDERATIONS:
1. What is the user intent behind the benchmark question?
2. What query types would most likely trigger AI responses mentioning {company_name}?
3. How does {company_name}'s competitive position influence query selection?
4. What search patterns do users typically follow in the {industry} space?
5. Which query types provide the best coverage of decision-making scenarios?

SELECTION REQUIREMENTS:
- Choose exactly 3-5 query types (no more, no less)
- Provide clear rationale for each selection
- Generate natural, conversational queries that real users would search
- Assign appropriate purchase intent (awareness/consideration/purchase) to each query
- Ensure coverage across different intent levels when strategic

EXAMPLE GOOD SELECTIONS:
- If base question is about "best tools", consider: paraphrase, comparison, temporal
- If company is in competitive market, prioritize: comparison, entity_narrower, user_profile  
- If industry evolves rapidly, include: temporal
- If company has specific use cases, consider: topical, entity_narrower

Generate strategic queries that maximize the likelihood of {company_name} being mentioned in AI responses while providing genuine value to users searching in the {industry} space.

Ensure your response follows the exact JSON schema format for FanoutQueryGeneration."""
        
        return prompt
    
    def _validate_selection_quality(self, result: FanoutQueryGeneration) -> bool:
        """Validate that query type selection is strategic and diverse"""
        if not result.selectedQueryTypes or len(result.selectedQueryTypes) < 3 or len(result.selectedQueryTypes) > 5:
            return False
        
        if not result.queries or len(result.queries) != len(result.selectedQueryTypes):
            return False
        
        # Check for strategic diversity - should not have too many similar types
        query_types = [selection.query_type for selection in result.selectedQueryTypes]
        if len(set(query_types)) != len(query_types):
            return False  # No duplicates allowed
        
        # Validate that queries match selected types
        for i, query in enumerate(result.queries):
            if i < len(result.selectedQueryTypes):
                if query.type != result.selectedQueryTypes[i].query_type.value:
                    return False
        
        return True
    
    async def _post_process_result(self, result: FanoutQueryGeneration, input_data: Dict[str, Any]) -> FanoutQueryGeneration:
        """Post-process the result to ensure quality and consistency"""
        
        # Validate selection quality
        if not self._validate_selection_quality(result):
            raise ValueError("Generated query selection lacks strategic quality or consistency")
        
        # Ensure totalQueries matches actual count
        result.totalQueries = len(result.queries)
        
        # Validate rationale quality (basic check)
        for selection in result.selectedQueryTypes:
            if len(selection.rationale.split()) < 5:
                raise ValueError(f"Rationale for {selection.query_type} is too brief")
        
        # Validate purchase intent is assigned
        for query in result.queries:
            if not hasattr(query, 'intent') or query.intent not in [PurchaseIntent.AWARENESS, PurchaseIntent.CONSIDERATION, PurchaseIntent.PURCHASE]:
                raise ValueError(f"Query missing valid purchase intent: {query.query}")
        
        return result

async def main():
    """Main function for running the intelligent fanout generation agent"""
    import logging
    import traceback
    
    # Set up logging to stderr so it doesn't interfere with JSON output
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[logging.StreamHandler(sys.stderr)]
    )
    logger = logging.getLogger(__name__)
    
    try:
        logger.info("🧠 Starting Intelligent Fanout Query Generation Agent")
        
        # Read input from stdin
        input_data = json.loads(sys.stdin.read())
        logger.info(f"📥 Received input: {json.dumps(input_data, indent=2)}")
        
        # Create and execute agent
        logger.info("🔨 Creating IntelligentFanoutAgent...")
        agent = IntelligentFanoutAgent()
        logger.info(f"✅ Agent created with model: {agent.model_id}")
        
        logger.info("🚀 Executing intelligent analysis...")
        result = await agent.execute(input_data)
        logger.info("✅ Agent execution completed")
        
        # Log analysis of the result
        if 'result' in result and result['result']:
            data = result['result']
            if hasattr(data, 'selectedQueryTypes') and hasattr(data, 'queries'):
                logger.info(f"📊 Intelligence Analysis Results:")
                logger.info(f"   - Selected query types: {len(data.selectedQueryTypes)}")
                logger.info(f"   - Generated queries: {len(data.queries)}")
                
                # Log selected types with rationale
                for i, selection in enumerate(data.selectedQueryTypes):
                    query_type = getattr(selection, 'query_type', 'unknown')
                    priority = getattr(selection, 'priority', 'unknown')
                    logger.info(f"   - Type {i+1}: {query_type} (priority {priority})")
        
        # Convert result to JSON-serializable format
        if 'result' in result and hasattr(result['result'], 'model_dump'):
            result['result'] = result['result'].model_dump()
        
        # Output result
        print(json.dumps(result, default=str))
        logger.info("✅ Response sent successfully")
        
    except json.JSONDecodeError as e:
        logger.error(f"❌ JSON decode error: {e}")
        error_result = {
            "error": f"Invalid JSON input: {str(e)}",
            "type": "json_decode_error",
            "agent_id": "intelligent_fanout_agent"
        }
        print(json.dumps(error_result))
        sys.exit(1)
        
    except Exception as e:
        logger.error(f"❌ Unexpected error: {e}")
        logger.error(f"📍 Traceback: {traceback.format_exc()}")
        
        # Output error in consistent format
        error_result = {
            "error": str(e),
            "type": "fanout_generation_error",
            "agent_id": "intelligent_fanout_agent",
            "traceback": traceback.format_exc()
        }
        print(json.dumps(error_result))
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())