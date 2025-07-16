#!/usr/bin/env python3
"""
Fanout Query Generation Agent

This agent generates comprehensive fanout queries for companies using PydanticAI,
replacing the complex fanout generation logic in the original LLM service.

Key Features:
- Generates diverse query types (comparison, best_for, versus, etc.)
- Industry-specific query generation
- Priority-based query ranking
- Target audience identification
- Comprehensive error handling and validation

Usage:
    python fanout_agent.py < input.json
    
Input Format:
    {
        "company_name": "Slack",
        "industry": "Communication Software",
        "context": "Team collaboration platform",
        "query_types": ["comparison", "best_for", "versus"],
        "max_queries": 20,
        "target_audiences": ["developers", "managers", "remote teams"]
    }

Output Format:
    {
        "data": {
            "companyName": "Slack",
            "industry": "Communication Software",
            "queries": [...],
            "totalQueries": 20,
            "generationTimestamp": "2024-01-15T10:30:00Z"
        },
        "metadata": {...}
    }
"""

import asyncio
import json
import sys
from typing import Dict, Any, Type, List

from .base_agent import BaseAgent
from .schemas import FanoutQueryGeneration, FanoutQuery, QueryType

class FanoutQueryAgent(BaseAgent):
    """
    PydanticAI agent for generating fanout queries.
    
    This agent creates diverse, high-quality search queries designed to
    trigger AI responses that mention the target company. It considers
    industry context, competitive landscape, and target audiences.
    """
    
    def __init__(self):
        super().__init__(
            agent_id="fanout_query_generator",
            default_model="openai:gpt-4o",
            system_prompt=self._build_system_prompt(),
            temperature=0.8,  # Higher temperature for more diverse queries
            max_tokens=2000,
            timeout=45000,
            max_retries=3
        )
    
    def _build_system_prompt(self) -> str:
        """Build comprehensive system prompt for fanout query generation"""
        return """You are an expert search query strategist specializing in AI-powered search optimization.

Your task is to generate diverse, high-quality search queries that will likely trigger AI responses mentioning a specific company.

QUERY TYPES TO GENERATE:
1. COMPARISON: "What are the differences between X and Y?"
2. BEST_FOR: "What's the best tool for [specific use case]?"
3. VERSUS: "X vs Y: which is better?"
4. FEATURES: "What features does X have?"
5. PRICING: "How much does X cost?"
6. REVIEWS: "What do users say about X?"
7. ALTERNATIVES: "What are alternatives to X?"
8. PROS_CONS: "What are the pros and cons of X?"
9. USE_CASES: "What can you use X for?"
10. GETTING_STARTED: "How do you get started with X?"

QUERY GENERATION PRINCIPLES:
- Create natural, conversational queries that real users would ask
- Include relevant industry terminology and context
- Target specific audiences (developers, managers, small businesses, etc.)
- Consider competitive landscape and positioning
- Vary query length and complexity
- Include both direct and indirect mentions
- Focus on queries likely to appear in AI training data

QUALITY GUIDELINES:
- Each query should be 5-50 words
- Use natural language, not keyword stuffing
- Include specific use cases and contexts
- Consider pain points and decision factors
- Balance broad and specific queries
- Include comparative and evaluative language

PRIORITY SCORING:
- Priority 1: High-value queries likely to generate detailed responses
- Priority 2: Good queries with moderate response likelihood
- Priority 3: Supplementary queries for comprehensive coverage
- Priority 4: Niche queries for specific audiences
- Priority 5: Exploratory queries for edge cases

TARGET AUDIENCE CONSIDERATIONS:
- Developers: Technical capabilities, integration, API
- Managers: ROI, team productivity, enterprise features
- Small businesses: Cost-effectiveness, ease of use, support
- Enterprise: Security, compliance, scalability
- End users: User experience, features, alternatives

Your response must follow the exact JSON format specified by the FanoutQueryGeneration schema."""
    
    def get_result_type(self) -> Type[FanoutQueryGeneration]:
        """Return the result type for this agent"""
        return FanoutQueryGeneration
    
    async def process_input(self, input_data: Dict[str, Any]) -> str:
        """Process input data and create query generation prompt"""
        company_name = input_data.get('company_name', '')
        industry = input_data.get('industry', '')
        context = input_data.get('context', '')
        query_types = input_data.get('query_types', [])
        max_queries = input_data.get('max_queries', 20)
        target_audiences = input_data.get('target_audiences', [])
        
        if not company_name:
            raise ValueError("company_name is required")
        if not industry:
            raise ValueError("industry is required")
        
        # Set default query types if not provided
        if not query_types:
            query_types = [
                "comparison", "best_for", "versus", "features", "pricing",
                "reviews", "alternatives", "pros_cons", "use_cases", "getting_started"
            ]
        
        # Set default target audiences if not provided
        if not target_audiences:
            target_audiences = [
                "developers", "managers", "small businesses", "enterprise teams", "end users"
            ]
        
        # Build generation prompt
        prompt = f"""Generate {max_queries} diverse fanout queries for {company_name}.

COMPANY: {company_name}
INDUSTRY: {industry}
CONTEXT: {context}

QUERY TYPES TO INCLUDE: {', '.join(query_types)}
TARGET AUDIENCES: {', '.join(target_audiences)}

REQUIREMENTS:
- Generate exactly {max_queries} unique queries
- Include queries from all requested types
- Consider all target audiences
- Ensure queries are natural and conversational
- Include both direct and indirect company mentions
- Vary query complexity and length
- Assign appropriate priority levels (1-5)
- Include expected company mentions for each query

EXAMPLES OF GOOD QUERIES:
- "What's the best project management tool for remote teams?"
- "Slack vs Microsoft Teams: which is better for small businesses?"
- "How does Asana compare to other task management platforms?"
- "What are the key features of modern collaboration software?"
- "Which communication tool offers the best value for startups?"

Focus on queries that would naturally appear in AI training data and are likely to generate comprehensive responses that mention {company_name} and its competitors.

Ensure your response follows the exact JSON schema format for FanoutQueryGeneration."""
        
        return prompt
    
    def _validate_query_diversity(self, queries: List[FanoutQuery]) -> bool:
        """Validate that queries are diverse and high-quality"""
        if not queries:
            return False
        
        # Check for minimum variety in query types
        query_types = set(query.type for query in queries)
        if len(query_types) < 3:
            return False
        
        # Check for minimum variety in priorities
        priorities = set(query.priority for query in queries)
        if len(priorities) < 2:
            return False
        
        # Check for unique queries
        query_texts = [query.query.lower() for query in queries]
        if len(set(query_texts)) != len(query_texts):
            return False
        
        return True
    
    async def _post_process_result(self, result: FanoutQueryGeneration, input_data: Dict[str, Any]) -> FanoutQueryGeneration:
        """Post-process the result to ensure quality"""
        company_name = input_data.get('company_name', '')
        max_queries = input_data.get('max_queries', 20)
        
        # Validate query diversity
        if not self._validate_query_diversity(result.queries):
            raise ValueError("Generated queries lack sufficient diversity")
        
        # Ensure we have the right number of queries
        if len(result.queries) != max_queries:
            # Truncate or pad as needed
            if len(result.queries) > max_queries:
                result.queries = result.queries[:max_queries]
            result.totalQueries = len(result.queries)
        
        # Ensure company name is mentioned in expected mentions
        for query in result.queries:
            if company_name not in query.expectedMentions:
                query.expectedMentions.append(company_name)
        
        return result

async def main():
    """Main function for running the fanout query generation agent"""
    try:
        # Read input from stdin
        input_data = json.loads(sys.stdin.read())
        
        # Create and execute agent
        agent = FanoutQueryAgent()
        result = await agent.execute(input_data)
        
        # Output result
        print(json.dumps(result))
        
    except Exception as e:
        # Output error in consistent format
        error_result = {
            "error": str(e),
            "agent_id": "fanout_query_generator",
            "execution_time": 0,
            "attempt_count": 0
        }
        print(json.dumps(error_result))
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())