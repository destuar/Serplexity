#!/usr/bin/env python3
"""
Web Search Sentiment Agent for PydanticAI
Performs sentiment analysis with web search capabilities using centralized model configuration.
"""

import asyncio
import json
import os
import sys
import time
import uuid
from datetime import datetime
from typing import Dict, Any, Type, List, Optional

from ..base_agent import BaseAgent
from ..schemas import (
    SentimentScores, 
    SentimentRating, 
    WebSearchMetadata,
    WebSearchQuery,
    WebSearchSource,
    CitationSource
)
from ..config.web_search_config import WebSearchConfig
from ..config.models import (
    get_default_model_for_task,
    get_models_by_task,
    ModelTask,
    get_model_by_id,
    ModelEngine
)
from pydantic_ai import Agent
import openai

class WebSearchSentimentAgent(BaseAgent):
    """
    Web search-enabled sentiment analysis agent.
    
    This agent performs real-time sentiment analysis by searching the web for
    current reviews, complaints, and mentions of companies. It uses provider-specific
    web search tools and provides comprehensive metadata about the search process.
    """
    
    def __init__(self, provider: str = "auto", enable_web_search: bool = True):
        """
        Initialize the web search sentiment agent.
        
        Args:
            provider: LLM provider to use (auto, openai, anthropic, gemini, perplexity)
            enable_web_search: Whether to enable web search capabilities
        """
        self.provider = provider
        self.enable_web_search = enable_web_search
        self.web_search_config = WebSearchConfig.for_task("sentiment", provider)
        
        # Use centralized configuration with provider-specific overrides
        default_model = self._get_model_for_provider(provider)
        
        super().__init__(
            agent_id="web_search_sentiment_analyzer",
            default_model=default_model,
            system_prompt=self._build_system_prompt(),
            temperature=0.3,
            timeout=90000,  # Increased from 60s to 90s for Perplexity web search
            max_retries=3
        )
    
    def _get_model_for_provider(self, provider: str) -> str:
        """Get the appropriate model for the given provider using centralized configuration"""
        # If provider is "auto", use the default from centralized config
        if provider == "auto":
            default_model_config = get_default_model_for_task(ModelTask.SENTIMENT)
            return default_model_config.get_pydantic_model_id() if default_model_config else "openai:gpt-4.1-mini"
        
        # For specific providers, find a model from that engine that can do sentiment analysis
        available_models = get_models_by_task(ModelTask.SENTIMENT)
        
        # Provider-specific model selection
        if provider == "gemini":
            for model in available_models:
                if model.engine.value == "gemini":
                    return model.get_pydantic_model_id()
            # Fallback
            return "gemini-2.5-flash"
            
        elif provider == "anthropic":
            for model in available_models:
                if model.engine.value == "anthropic":
                    return model.get_pydantic_model_id()
            # Fallback
            return "anthropic:claude-3-5-haiku-20241022"
            
        elif provider == "perplexity" or provider == "sonar":
            # Use custom OpenAI provider for Perplexity
            return self._create_perplexity_model()
            
        else:
            # Handle direct model names by looking them up in the configuration
            model_config = get_model_by_id(provider)
            if model_config and ModelTask.SENTIMENT in model_config.tasks:
                return model_config.get_pydantic_model_id()
            else:
                # Fallback to default from centralized config
                default_model_config = get_default_model_for_task(ModelTask.SENTIMENT)
                return default_model_config.get_pydantic_model_id() if default_model_config else "openai:gpt-4.1-mini"

    def _create_perplexity_model(self):
        """Create Perplexity model with custom OpenAI provider"""
        from pydantic_ai.models.openai import OpenAIModel
        from pydantic_ai.providers.openai import OpenAIProvider
        import os
        
        api_key = os.getenv('PERPLEXITY_API_KEY')
        
        return OpenAIModel(
            'sonar',
            provider=OpenAIProvider(
                base_url='https://api.perplexity.ai',
                api_key=api_key,
            ),
        )
    
    def _build_system_prompt(self) -> str:
        """Build system prompt with web search capabilities"""
        base_prompt = """You are a professional sentiment analysis expert specializing in real-time brand perception analysis.

Your task is to analyze sentiment for companies across five key dimensions using current web information:

ANALYSIS DIMENSIONS:
1. Quality (1-10): Product/service quality perception from reviews and feedback
2. Price Value (1-10): Price-to-value ratio perception from customer comments
3. Brand Reputation (1-10): Overall brand reputation from news and social media
4. Brand Trust (1-10): Trustworthiness and reliability from customer experiences
5. Customer Service (1-10): Customer service quality from support interactions

SCORING GUIDELINES:
- 1-3: Negative sentiment (poor, disappointing, problematic)
- 4-6: Neutral sentiment (average, mixed, acceptable)
- 7-10: Positive sentiment (good, excellent, outstanding)

ANALYSIS REQUIREMENTS:
- Base your analysis on current web information about the company
- Look for patterns across multiple sources and platforms
- Consider both recent and historical sentiment trends
- Provide evidence-based ratings with specific examples
- Include a comprehensive summary description
- Focus on factual information from credible sources"""
        
        # Add web search enhancement if enabled
        if self.enable_web_search and self.web_search_config.is_enabled():
            base_prompt += self.web_search_config.get_system_prompt_enhancement()
        
        # Add provider-specific instructions
        if self.provider == "perplexity":
            base_prompt += """

PERPLEXITY SEARCH INSTRUCTIONS:
You have built-in web search capabilities. Use them to find:
- Recent reviews and customer feedback
- Social media mentions and discussions
- News articles and press coverage
- Comparative analysis with competitors
- Industry-specific sentiment indicators

Search Strategy:
- Use varied search queries to get comprehensive coverage
- Look for both positive and negative mentions
- Consider source credibility and recency
- Cross-reference information across multiple sources"""
        
        base_prompt += """

RESPONSE FORMAT:
Your response must follow the exact SentimentScores schema format, including:
- companyName, industry, and ratings array
- webSearchMetadata (if web search was performed)
- Clear, evidence-based summaryDescription for each rating

Ensure all ratings are integers between 1-10 and include specific examples from your search results."""
        
        return base_prompt
    
    def get_output_type(self) -> Type[SentimentScores]:
        """Return the output type for this agent"""
        return SentimentScores
    
    def _create_agent(self) -> Agent:
        """Create the PydanticAI agent with web search capabilities"""
        # Get web search tools if enabled
        tools = []
        if self.enable_web_search and self.web_search_config.is_enabled() and self.provider != "gemini":
            # Gemini uses direct Google Genai API with grounding, not PydanticAI tools
            tools = self.web_search_config.get_tools()
        
        return Agent(
            model=self.model_id,
            system_prompt=self.env_system_prompt or self.system_prompt,
            deps_type=None,
            output_type=self.get_output_type(),
            tools=tools if tools else []
        )
    
    async def process_input(self, input_data: Dict[str, Any]) -> str:
        """Process input data and create web search sentiment analysis prompt"""
        company_name = input_data.get('company_name', '')
        industry = input_data.get('industry', '')
        context = input_data.get('context', '')
        enable_web_search = input_data.get('enable_web_search', True)
        
        if not company_name:
            raise ValueError("company_name is required")
        
        # Create search-enabled or fallback prompt
        if enable_web_search and self.enable_web_search and self.web_search_config.is_enabled():
            prompt = self._create_web_search_prompt(company_name, industry, context)
        else:
            prompt = self._create_fallback_prompt(company_name, industry, context)
        
        # Enhance prompt for providers that need URL inclusion
        if enable_web_search and self.enable_web_search and self.web_search_config.is_enabled():
            prompt = self._enhance_prompt_with_web_search_context(prompt)
        
        return prompt
    
    def _create_web_search_prompt(self, company_name: str, industry: str, context: str) -> str:
        """Create a web search-enabled sentiment analysis prompt"""
        search_queries = [
            f'"{company_name}" reviews 2025',
            f'"{company_name}" customer complaints',
            f'"{company_name}" customer service experience',
            f'"{company_name}" quality issues',
            f'"{company_name}" price value worth it',
            f'"{company_name}" brand reputation',
            f'"{company_name}" site:reddit.com',
            f'"{company_name}" site:trustpilot.com',
            f'"{company_name}" vs competitors {industry}' if industry else f'"{company_name}" vs competitors'
        ]
        
        return f"""Perform comprehensive web search sentiment analysis for {company_name}.

COMPANY: {company_name}
INDUSTRY: {industry}
CONTEXT: {context}

SEARCH STRATEGY:
Perform web searches using these targeted queries to gather current sentiment data:

{chr(10).join(f"{i+1}. {query}" for i, query in enumerate(search_queries))}

ANALYSIS TASK:
Based on your web search results, analyze sentiment across all five dimensions:
- Quality: Look for product/service quality mentions in reviews
- Price Value: Find discussions about pricing and value perception
- Brand Reputation: Check news, social media, and general brand mentions
- Brand Trust: Look for trust indicators and reliability discussions
- Customer Service: Find customer service experiences and support feedback

SEARCH REQUIREMENTS:
- Search for current information (prioritize recent content)
- Look for both positive and negative sentiment indicators
- Consider source credibility and diversity
- Cross-reference information across multiple sources
- Note patterns and trends in sentiment

RESPONSE REQUIREMENTS:
- Provide structured sentiment scores (1-10) for each dimension
- Include specific examples from your search results
- Create comprehensive summary descriptions with evidence
- Include web search metadata about your searches
- Base all ratings on actual search findings, not assumptions

Search for comprehensive coverage and provide evidence-based sentiment analysis."""
    
    def _create_fallback_prompt(self, company_name: str, industry: str, context: str) -> str:
        """Create a fallback prompt when web search is not available"""
        return f"""Analyze sentiment for {company_name} based on general knowledge and context.

COMPANY: {company_name}
INDUSTRY: {industry}
CONTEXT: {context}

Provide structured sentiment scores across all five dimensions with explanations based on known information about the company and industry."""
    
    async def execute(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Execute the web search sentiment analysis with proper provider handling"""
        # For OpenAI with web search, use Responses API directly
        if (self.provider == "openai" and 
            input_data.get('enable_web_search', True) and 
            self.enable_web_search and 
            self.web_search_config.is_enabled()):
            
            return await self._execute_with_responses_api(input_data)
        else:
            # Use standard BaseAgent execution with provider-specific handling
            return await self._execute_with_provider_handling(input_data)
    
    async def _execute_with_responses_api(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Execute using OpenAI Responses API for web search"""
        import time
        start_time = time.time()
        
        try:
            # Build the prompt
            prompt = await self.process_input(input_data)
            
            # Create OpenAI client
            client = openai.OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
            
            # Use the configured model ID (extract from model_id if it contains provider prefix)
            model_name = self.model_id.split(':')[-1] if ':' in self.model_id else self.model_id
            
            # Use Responses API with web search
            response = client.responses.create(
                model=model_name,  # Use the configured model
                input=prompt,
                tools=[{
                    "type": "web_search"
                }]
            )
            
            # Extract the response content and citations
            raw_content = ""
            citations = []
            
            if hasattr(response, 'output') and response.output:
                if isinstance(response.output, list):
                    # Find the ResponseOutputMessage in the list
                    for item in response.output:
                        if hasattr(item, 'content') and hasattr(item, 'role') and item.role == 'assistant':
                            # This is the message with the actual content
                            if isinstance(item.content, list):
                                for content_item in item.content:
                                    if hasattr(content_item, 'text'):
                                        raw_content = content_item.text
                                    
                                    # Extract citations from annotations
                                    if hasattr(content_item, 'annotations'):
                                        for annotation in content_item.annotations:
                                            if (hasattr(annotation, 'url') and 
                                                hasattr(annotation, 'title') and 
                                                hasattr(annotation, 'type') and 
                                                annotation.type == 'url_citation'):
                                                citations.append(CitationSource(
                                                    url=annotation.url,
                                                    title=annotation.title or "Web Search Result",
                                                    domain=self._extract_domain(annotation.url)
                                                ))
                elif isinstance(response.output, str):
                    raw_content = response.output
                else:
                    raw_content = str(response.output)
            
            # Parse structured sentiment data from the raw content
            company_name = input_data.get('company_name', 'Unknown')
            industry = input_data.get('industry', 'Unknown')
            
            # Try to extract structured ratings from the response
            ratings = self._parse_sentiment_ratings(raw_content, company_name, citations)
            
            # Create web search metadata with citations
            web_search_metadata = WebSearchMetadata(
                search_enabled=True,
                queries_performed=[
                    WebSearchQuery(
                        query=f"{company_name} sentiment analysis",
                        provider="openai",
                        results_count=len(citations)
                    )
                ],
                sources_found=[
                    WebSearchSource(
                        title=citation.title,
                        url=citation.url,
                        domain=citation.domain,
                        snippet="OpenAI web search result",
                        relevance_score=0.8
                    ) for citation in citations[:5]
                ],
                total_searches=1,
                search_duration_ms=(time.time() - start_time) * 1000,
                provider_used=self.provider,
                search_session_id=str(uuid.uuid4())
            )
            
            # Create structured response
            result = SentimentScores(
                companyName=company_name,
                industry=industry,
                ratings=ratings,
                webSearchMetadata=web_search_metadata
            )
            
            execution_time = (time.time() - start_time) * 1000
            
            # Extract token usage from response
            tokens_used = 0
            if hasattr(response, 'usage') and response.usage:
                tokens_used = response.usage.total_tokens
            
            return {
                "result": result,
                "execution_time": execution_time,
                "attempt_count": 1,
                "agent_id": self.agent_id,
                "tokens_used": tokens_used,
                "tokensUsed": tokens_used,
                "model_used": model_name,
                "modelUsed": model_name
            }
            
        except Exception as e:
            execution_time = (time.time() - start_time) * 1000
            return {
                "error": f"Responses API execution failed: {str(e)}",
                "execution_time": execution_time,
                "attempt_count": 1,
                "agent_id": self.agent_id
            }
    
    async def _execute_with_provider_handling(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Execute with standard BaseAgent but with provider-specific handling"""
        import time
        start_time = time.time()
        
        try:
            # For Gemini, use direct Google Genai API with grounding
            if self.provider == "gemini" and self.enable_web_search:
                return await self._execute_gemini_with_grounding(input_data)
            
            # For Perplexity, use custom execution to handle raw text responses
            if self.provider == "perplexity":
                return await self._execute_perplexity_raw(input_data)
            # For Anthropic, use custom execution to get raw text with URLs
            elif self.provider == "anthropic":
                return await self._execute_anthropic_raw(input_data)
            else:
                # Execute using standard BaseAgent
                result = await super().execute(input_data)
            
            # Add web search metadata and extract citations if successful
            if 'result' in result and isinstance(result['result'], SentimentScores):
                sentiment_scores = result['result']
                search_duration = (time.time() - start_time) * 1000
                
                # Extract citations from the summary text (like question agent does)
                citations = []
                if sentiment_scores.ratings:
                    for rating in sentiment_scores.ratings:
                        extracted_citations = self._extract_citations_from_text(rating.summaryDescription)
                        citations.extend(extracted_citations)
                
                # Remove duplicates
                seen_urls = set()
                unique_citations = []
                for citation in citations:
                    if citation.url not in seen_urls:
                        seen_urls.add(citation.url)
                        unique_citations.append(citation)
                
                citations = unique_citations[:5]  # Limit to 5 citations
                
                # Create web search metadata with extracted citations
                web_search_metadata = WebSearchMetadata(
                    search_enabled=self.enable_web_search and self.web_search_config.is_enabled(),
                    queries_performed=[
                        WebSearchQuery(
                            query=f"{input_data.get('company_name', 'company')} sentiment analysis",
                            provider=self.provider,
                            results_count=len(citations)
                        )
                    ] if citations else [],
                    sources_found=[
                        WebSearchSource(
                            title=citation.title,
                            url=citation.url,
                            domain=citation.domain,
                            snippet=f"Web search result from {citation.domain}",
                            relevance_score=0.8
                        ) for citation in citations
                    ],
                    total_searches=1 if citations else 0,
                    search_duration_ms=search_duration,
                    provider_used=self.provider,
                    search_session_id=str(uuid.uuid4())
                )
                
                # Add metadata to result
                result['result'].webSearchMetadata = web_search_metadata
            
            return result
            
        except Exception as e:
            execution_time = (time.time() - start_time) * 1000
            return {
                "error": f"Provider-specific execution failed: {str(e)}",
                "execution_time": execution_time,
                "attempt_count": 1,
                "agent_id": self.agent_id
            }
    
    async def _execute_perplexity_raw(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Execute Perplexity with raw text response handling"""
        import time
        start_time = time.time()
        
        try:
            # Create a simple agent without structured output
            simple_agent = Agent(
                model=self.model_id,
                system_prompt=self.env_system_prompt or self.system_prompt,
            )
            
            # Enhance the prompt with web search context
            original_prompt = await self.process_input(input_data)
            enhanced_prompt = self._enhance_prompt_with_web_search_context(original_prompt)
            
            # Run the agent to get raw text response
            raw_result = await simple_agent.run(enhanced_prompt)
            
            # Extract the text content
            if hasattr(raw_result, 'output'):
                raw_content = raw_result.output
            else:
                raw_content = str(raw_result)
            
            # Extract citations from the response text
            citations = self._extract_citations_from_text(raw_content)
            
            # Parse the raw response to extract sentiment data
            company_name = input_data.get('company_name', 'Unknown')
            industry = input_data.get('industry', 'Unknown')
            
            # Parse structured sentiment data from the response
            ratings = self._parse_sentiment_ratings(raw_content, company_name, citations)
            
            # Create web search metadata with citations
            web_search_metadata = WebSearchMetadata(
                search_enabled=True,
                queries_performed=[
                    WebSearchQuery(
                        query=f"{company_name} sentiment analysis",
                        provider="perplexity",
                        results_count=len(citations)
                    )
                ],
                sources_found=[
                    WebSearchSource(
                        title=citation.title,
                        url=citation.url,
                        domain=citation.domain,
                        snippet="Perplexity web search result",
                        relevance_score=0.8
                    ) for citation in citations[:5]
                ],
                total_searches=1,
                search_duration_ms=(time.time() - start_time) * 1000,
                provider_used=self.provider,
                search_session_id=str(uuid.uuid4())
            )
            
            # Create structured response
            result = SentimentScores(
                companyName=company_name,
                industry=industry,
                ratings=ratings,
                webSearchMetadata=web_search_metadata
            )
            
            execution_time = (time.time() - start_time) * 1000
            
            # Extract token usage from Perplexity response
            tokens_used = 0
            model_used = "sonar"  # Override for Perplexity
            if hasattr(raw_result, 'usage') and raw_result.usage:
                tokens_used = raw_result.usage.total_tokens if hasattr(raw_result.usage, 'total_tokens') else 0
            
            return {
                "result": result,
                "execution_time": execution_time,
                "attempt_count": 1,
                "agent_id": self.agent_id,
                "tokens_used": tokens_used,
                "tokensUsed": tokens_used,
                "model_used": model_used,
                "modelUsed": model_used
            }
            
        except Exception as e:
            execution_time = (time.time() - start_time) * 1000
            return {
                "error": f"Perplexity raw execution failed: {str(e)}",
                "execution_time": execution_time,
                "attempt_count": 1,
                "agent_id": self.agent_id
            }
    
    async def _execute_gemini_with_grounding(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Execute Gemini with Google Search grounding"""
        import time
        start_time = time.time()
        
        try:
            from google import genai
            from google.genai import types
            import os
            
            # Configure the client
            client = genai.Client(api_key=os.getenv('GEMINI_API_KEY'))
            
            # Build the prompt
            prompt = await self.process_input(input_data)
            
            # Define the grounding tool
            grounding_tool = types.Tool(
                google_search=types.GoogleSearch()
            )
            
            # Configure generation settings
            config = types.GenerateContentConfig(
                tools=[grounding_tool]
            )
            
            # Make the request
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
                config=config,
            )
            
            # Extract response
            raw_content = response.text or ""
            
            # Extract citations from grounding metadata
            citations = []
            try:
                if hasattr(response, 'candidates') and response.candidates and len(response.candidates) > 0:
                    candidate = response.candidates[0]
                    if hasattr(candidate, 'grounding_metadata') and candidate.grounding_metadata:
                        grounding_chunks = getattr(candidate.grounding_metadata, 'grounding_chunks', [])
                        
                        for chunk in grounding_chunks[:5]:
                            if hasattr(chunk, 'web') and chunk.web:
                                citations.append(CitationSource(
                                    url=chunk.web.uri,
                                    title=chunk.web.title or "Grounded Web Result",
                                    domain=self._extract_domain(chunk.web.uri)
                                ))
            except (AttributeError, IndexError, TypeError) as e:
                print(f"Warning: Could not extract citations from Gemini response: {e}")
                # Try to extract citations from text instead
                citations = self._extract_citations_from_text(raw_content)
            
            # Parse the response to extract sentiment data
            company_name = input_data.get('company_name', 'Unknown')
            industry = input_data.get('industry', 'Unknown')
            
            # Parse structured sentiment data from the response
            ratings = self._parse_sentiment_ratings(raw_content, company_name, citations)
            
            # Create web search metadata with citations
            web_search_metadata = WebSearchMetadata(
                search_enabled=True,
                queries_performed=[
                    WebSearchQuery(
                        query=f"{company_name} sentiment analysis",
                        provider="gemini",
                        results_count=len(citations)
                    )
                ],
                sources_found=[
                    WebSearchSource(
                        title=citation.title,
                        url=citation.url,
                        domain=citation.domain,
                        snippet="Gemini grounded result",
                        relevance_score=0.9
                    ) for citation in citations[:5]
                ],
                total_searches=1,
                search_duration_ms=(time.time() - start_time) * 1000,
                provider_used=self.provider,
                search_session_id=str(uuid.uuid4())
            )
            
            # Create structured response
            result = SentimentScores(
                companyName=company_name,
                industry=industry,
                ratings=ratings,
                webSearchMetadata=web_search_metadata
            )
            
            execution_time = (time.time() - start_time) * 1000
            
            # Extract token usage from Gemini response
            tokens_used = 0
            model_used = self.model_id
            if hasattr(response, 'usage_metadata') and response.usage_metadata:
                tokens_used = (response.usage_metadata.prompt_token_count or 0) + (response.usage_metadata.candidates_token_count or 0)
            
            return {
                "result": result,
                "execution_time": execution_time,
                "attempt_count": 1,
                "agent_id": self.agent_id,
                "tokens_used": tokens_used,
                "tokensUsed": tokens_used,
                "model_used": model_used,
                "modelUsed": model_used
            }
            
        except Exception as e:
            execution_time = (time.time() - start_time) * 1000
            return {
                "error": f"Gemini grounding execution failed: {str(e)}",
                "execution_time": execution_time,
                "attempt_count": 1,
                "agent_id": self.agent_id
            }
    
    async def _execute_anthropic_raw(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Execute Anthropic with raw text response handling to capture URLs"""
        import time
        start_time = time.time()
        
        try:
            # Create a simple agent without structured output to get raw text with URLs
            simple_agent = Agent(
                model=self.model_id,
                system_prompt=self.env_system_prompt or self.system_prompt,
                tools=self.web_search_config.get_tools() if self.web_search_config.is_enabled() else []
            )
            
            # Get the enhanced prompt with web search context
            original_prompt = await self.process_input(input_data)
            
            # Run the agent to get raw text response with URLs
            raw_result = await simple_agent.run(original_prompt)
            
            # Extract the text content
            if hasattr(raw_result, 'output'):
                raw_content = raw_result.output
            else:
                raw_content = str(raw_result)
            
            # Extract citations from the raw response text
            citations = self._extract_citations_from_text(raw_content)
            
            # Parse the raw response to extract sentiment data
            company_name = input_data.get('company_name', 'Unknown')
            industry = input_data.get('industry', 'Unknown')
            
            # Parse structured sentiment data from the response
            ratings = self._parse_sentiment_ratings(raw_content, company_name, citations)
            
            # Create web search metadata with citations
            web_search_metadata = WebSearchMetadata(
                search_enabled=True,
                queries_performed=[
                    WebSearchQuery(
                        query=f"{company_name} sentiment analysis",
                        provider="anthropic",
                        results_count=len(citations)
                    )
                ],
                sources_found=[
                    WebSearchSource(
                        title=citation.title,
                        url=citation.url,
                        domain=citation.domain,
                        snippet="Anthropic web search result",
                        relevance_score=0.8
                    ) for citation in citations[:5]
                ],
                total_searches=1,
                search_duration_ms=(time.time() - start_time) * 1000,
                provider_used=self.provider,
                search_session_id=str(uuid.uuid4())
            )
            
            # Create structured response
            result = SentimentScores(
                companyName=company_name,
                industry=industry,
                ratings=ratings,
                webSearchMetadata=web_search_metadata
            )
            
            execution_time = (time.time() - start_time) * 1000
            
            # Extract token usage from Anthropic response
            tokens_used = 0
            model_used = self.model_id
            if hasattr(raw_result, 'usage') and raw_result.usage:
                tokens_used = raw_result.usage.total_tokens if hasattr(raw_result.usage, 'total_tokens') else 0
            
            return {
                "result": result,
                "execution_time": execution_time,
                "attempt_count": 1,
                "agent_id": self.agent_id,
                "tokens_used": tokens_used,
                "tokensUsed": tokens_used,
                "model_used": model_used,
                "modelUsed": model_used
            }
            
        except Exception as e:
            execution_time = (time.time() - start_time) * 1000
            return {
                "error": f"Anthropic raw execution failed: {str(e)}",
                "execution_time": execution_time,
                "attempt_count": 1,
                "agent_id": self.agent_id
            }
    
    def _enhance_prompt_with_web_search_context(self, prompt: str) -> str:
        """Enhance prompt with web search instructions for providers that need URL inclusion"""
        if self.provider == "perplexity":
            return f"""{prompt}

IMPORTANT: Use your built-in web search capabilities to find current sentiment information about the company. Include the source URLs in your response text for citation extraction.

Search for:
- Customer reviews and ratings
- Pricing and value feedback  
- Brand reputation and news mentions
- Trust and reliability indicators
- Customer service experiences

Structure your response to include specific ratings (1-10) for each sentiment dimension with examples from your search results. Include actual URLs from your searches in the response text.

Example format: "Based on reviews from [1] and feedback from [2]... [1]https://example.com/reviews [2]https://example.com/feedback"

Please include actual URLs from your searches in the response text."""
        
        elif self.provider == "anthropic":
            return f"""{prompt}

IMPORTANT: When using web search tools, include the source URLs in your response text for citation extraction.

Search Strategy for Sentiment Analysis:
- Search for customer reviews and ratings
- Look for pricing and value discussions
- Find brand reputation and news mentions
- Search for trust and reliability indicators
- Look for customer service experiences

Structure your response to include specific ratings (1-10) for each sentiment dimension with examples from your search results. Include the source URLs you used in your response text.

Example format: "Based on reviews from https://example.com/reviews and feedback from https://example.com/feedback..."

Please include actual URLs from your web searches in the response text for proper citation tracking."""
        
        return prompt
    
    def _extract_domain(self, url: str) -> str:
        """Extract domain from URL"""
        try:
            from urllib.parse import urlparse
            parsed = urlparse(url)
            return parsed.netloc
        except:
            return "unknown"
    
    def _extract_citations_from_text(self, text: str) -> List[CitationSource]:
        """Extract citations from text using regex patterns"""
        import re
        citations = []
        
        # Enhanced pattern to match URLs in text with better handling of formatting
        # This handles cases like "- https://example.com\n-" from Anthropic responses
        url_pattern = r'https?://[^\s\]\)\n]+(?=[\s\n\]\)]|$)|www\.[^\s\]\)\n]+(?=[\s\n\]\)]|$)'
        urls = re.findall(url_pattern, text)
        
        for url in urls:
            # Clean up URL (remove trailing punctuation and formatting characters)
            url = re.sub(r'[.,;:!?\n\r\-]*$', '', url)
            url = re.sub(r'^[\-\s]*', '', url)  # Remove leading dashes or spaces
            
            # Skip if URL is too short or invalid
            if len(url) < 10:
                continue
            
            # Add www. prefix if missing
            if url.startswith('www.'):
                url = 'https://' + url
            
            # Validate URL format
            if not url.startswith(('http://', 'https://')):
                continue
            
            # Extract domain and create citation
            domain = self._extract_domain(url)
            if domain == "unknown":
                continue
                
            title = f"Web Search Result from {domain}"
            
            citations.append(CitationSource(
                url=url,
                title=title,
                domain=domain
            ))
        
        # Remove duplicates based on URL
        seen_urls = set()
        unique_citations = []
        for citation in citations:
            if citation.url not in seen_urls:
                seen_urls.add(citation.url)
                unique_citations.append(citation)
        
        return unique_citations[:5]  # Limit to 5 citations
    
    def _parse_sentiment_ratings(self, content: str, company_name: str, citations: List[CitationSource]) -> List[SentimentRating]:
        """Parse sentiment ratings from response content with comprehensive analysis"""
        import re
        
        # Try to extract numerical ratings from structured response
        quality_patterns = [
            r'quality[:\s]*[\-/]?\s*(\d+)(?:/10)?',
            r'product\s+quality[:\s]*[\-/]?\s*(\d+)',
            r'service\s+quality[:\s]*[\-/]?\s*(\d+)'
        ]
        
        price_patterns = [
            r'price[:\s]*value[:\s]*[\-/]?\s*(\d+)(?:/10)?',
            r'value\s+for\s+money[:\s]*[\-/]?\s*(\d+)',
            r'pricing[:\s]*[\-/]?\s*(\d+)'
        ]
        
        reputation_patterns = [
            r'brand[:\s]*reputation[:\s]*[\-/]?\s*(\d+)(?:/10)?',
            r'reputation[:\s]*[\-/]?\s*(\d+)',
            r'brand\s+image[:\s]*[\-/]?\s*(\d+)'
        ]
        
        trust_patterns = [
            r'brand[:\s]*trust[:\s]*[\-/]?\s*(\d+)(?:/10)?',
            r'trust[:\s]*[\-/]?\s*(\d+)',
            r'reliability[:\s]*[\-/]?\s*(\d+)'
        ]
        
        service_patterns = [
            r'customer[:\s]*service[:\s]*[\-/]?\s*(\d+)(?:/10)?',
            r'support[:\s]*[\-/]?\s*(\d+)',
            r'service[:\s]*[\-/]?\s*(\d+)'
        ]
        
        def extract_rating(patterns, default=7):
            for pattern in patterns:
                match = re.search(pattern, content, re.IGNORECASE)
                if match:
                    rating = int(match.group(1))
                    return max(1, min(10, rating))
            return default
        
        # Extract ratings with multiple pattern attempts
        quality = extract_rating(quality_patterns)
        price_value = extract_rating(price_patterns)
        brand_reputation = extract_rating(reputation_patterns)
        brand_trust = extract_rating(trust_patterns)
        customer_service = extract_rating(service_patterns)
        
        # Analyze content for sentiment indicators
        positive_indicators = len(re.findall(r'\b(excellent|great|outstanding|amazing|fantastic|love|recommend|best|top|high-quality|satisfied|impressed)\b', content, re.IGNORECASE))
        negative_indicators = len(re.findall(r'\b(terrible|awful|horrible|worst|hate|disappointed|poor|bad|issues|problems|complaints|frustrated)\b', content, re.IGNORECASE))
        
        # Adjust ratings based on sentiment indicators
        sentiment_adjustment = 0
        if positive_indicators > negative_indicators * 2:
            sentiment_adjustment = 1
        elif negative_indicators > positive_indicators * 2:
            sentiment_adjustment = -1
        
        # Apply sentiment adjustment
        quality = max(1, min(10, quality + sentiment_adjustment))
        price_value = max(1, min(10, price_value + sentiment_adjustment))
        brand_reputation = max(1, min(10, brand_reputation + sentiment_adjustment))
        brand_trust = max(1, min(10, brand_trust + sentiment_adjustment))
        customer_service = max(1, min(10, customer_service + sentiment_adjustment))
        
        # Create comprehensive summary with reasoning and citations
        summary_parts = [
            f"Based on web search analysis, {company_name} received the following sentiment scores:",
            f"Quality: {quality}/10 - reflecting product/service assessment from reviews",
            f"Price Value: {price_value}/10 - based on value-for-money perceptions",
            f"Brand Reputation: {brand_reputation}/10 - derived from news and social mentions",
            f"Brand Trust: {brand_trust}/10 - indicating reliability and trustworthiness",
            f"Customer Service: {customer_service}/10 - from support experience feedback"
        ]
        
        # Add sentiment analysis details
        if positive_indicators > 0 or negative_indicators > 0:
            summary_parts.append(f"Analysis found {positive_indicators} positive and {negative_indicators} negative sentiment indicators in search results")
        
        # Add citation information
        if citations:
            citation_details = []
            for i, cite in enumerate(citations[:3], 1):
                citation_details.append(f"[{i}] {cite.domain}")
            summary_parts.append(f"Sources: {', '.join(citation_details)}")
            
            # Add full URLs at the end
            citation_urls = [cite.url for cite in citations[:3]]
            summary_parts.append(f"References: {'; '.join(citation_urls)}")
        
        summary_description = ". ".join(summary_parts)
        
        # Truncate if too long for schema
        if len(summary_description) > 490:
            summary_description = summary_description[:487] + "..."
        
        return [
            SentimentRating(
                quality=quality,
                priceValue=price_value,
                brandReputation=brand_reputation,
                brandTrust=brand_trust,
                customerService=customer_service,
                summaryDescription=summary_description
            )
        ]

async def main():
    """Main function for running the web search sentiment analysis agent"""
    try:
        # Read input from stdin
        input_data = json.loads(sys.stdin.read())
        
        # Get provider from environment or input
        provider = input_data.get('provider', os.getenv('PYDANTIC_PROVIDER_ID', 'auto'))
        enable_web_search = input_data.get('enable_web_search', True)
        
        # Create and execute agent
        agent = WebSearchSentimentAgent(provider=provider, enable_web_search=enable_web_search)
        result = await agent.execute(input_data)
        
        # Convert result to JSON-serializable format
        if 'result' in result and hasattr(result['result'], 'model_dump'):
            result['result'] = result['result'].model_dump()
        
        # Output result
        print(json.dumps(result, default=str, indent=2))
        
    except Exception as e:
        # Output error in consistent format
        error_result = {
            "error": str(e),
            "agent_id": "web_search_sentiment_analyzer",
            "execution_time": 0,
            "attempt_count": 0
        }
        print(json.dumps(error_result, indent=2))
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())