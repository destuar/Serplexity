#!/usr/bin/env python3
"""
Question Answering Agent for PydanticAI
Provides natural, comprehensive answers to questions with optional web search capabilities.
"""

import asyncio
import json
import logging
import os
import re
import sys
import time
import uuid
from datetime import datetime
from typing import Dict, Any, Type, List, Optional

from pydantic import BaseModel, Field
from ..base_agent import BaseAgent
from ..schemas import (
    SimpleQuestionResponse,
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

# Set up logging
logger = logging.getLogger(__name__)

# Simplified output schema for natural responses
class SimpleQuestionResponse(BaseModel):
    """Natural question response without artificial constraints"""
    question: str = Field(..., description="Original question")
    answer: str = Field(..., min_length=10, description="Natural model response")
    confidence: Optional[float] = Field(None, ge=0, le=1, description="Confidence score")
    has_web_search: bool = Field(default=False, description="Whether web search was used")
    citations: Optional[List[CitationSource]] = Field(default=[], description="Citations found in the response")
    brand_mentions_count: int = Field(default=0, description="Number of brand mentions found")

class QuestionInput(BaseModel):
    question: str
    system_prompt: Optional[str] = None
    context: Optional[str] = None
    question_id: Optional[str] = None
    company_name: Optional[str] = None
    competitors: Optional[List[str]] = None
    enable_web_search: bool = True

class QuestionAnsweringAgent(BaseAgent):
    def __init__(self, provider: str = "openai", enable_web_search: bool = True):
        self.provider = provider
        self.enable_web_search = enable_web_search
        self.web_search_config = WebSearchConfig.for_task("question_answering", provider)

        # Use centralized configuration with provider-specific overrides
        default_model = self._get_model_for_provider(provider)

        # Use longer timeout for web search operations
        timeout = 60000 if enable_web_search else 30000

        super().__init__(
            agent_id="question_answering_agent",
            default_model=default_model,
            system_prompt=self._get_natural_system_prompt(),
            temperature=0.7,
            timeout=timeout,
            max_retries=2
        )

    def _get_natural_system_prompt(self) -> str:
        """Get natural system prompt for each provider to match their actual behavior"""
        if self.provider == "anthropic":
            # Claude's natural system prompt is minimal and focused on being helpful
            return "You are Claude, a helpful AI assistant created by Anthropic. You provide accurate, thoughtful responses to questions and engage in helpful conversations."

        elif self.provider == "gemini":
            # Gemini's natural behavior is direct and informative
            return "You are a helpful AI assistant. Provide accurate and informative responses to user questions."

        elif self.provider in ["perplexity", "sonar"]:
            # Perplexity is naturally search-focused
            return "You are a helpful AI assistant that provides comprehensive answers using current information from the web."

        else:
            # OpenAI models (GPT-4.1-mini, etc.) - minimal natural system prompt
            return "You are a helpful assistant."

    def _get_model_for_provider(self, provider: str) -> str:
        """Get the appropriate model for the given provider using centralized configuration"""
        # If provider is "auto", use the default from centralized config
        if provider == "auto":
            default_model_config = get_default_model_for_task(ModelTask.QUESTION_ANSWERING)
            return default_model_config.get_pydantic_model_id() if default_model_config else "openai:gpt-4.1-mini"

        # For specific providers, find a model from that engine that can do question answering
        available_models = get_models_by_task(ModelTask.QUESTION_ANSWERING)

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
            if model_config and ModelTask.QUESTION_ANSWERING in model_config.tasks:
                return model_config.get_pydantic_model_id()
            else:
                # Fallback to default from centralized config
                default_model_config = get_default_model_for_task(ModelTask.QUESTION_ANSWERING)
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

    def get_output_type(self):
        return SimpleQuestionResponse

    async def process_input(self, input_data: dict) -> str:
        """Create natural user prompt - no artificial instructions"""

        # Extract input data
        question = input_data.get('question', input_data.get('prompt', ''))
        context = input_data.get('context', '')

        # Build natural prompt - just like a real user would ask
        prompt_parts = []

        # Add context naturally if provided (like a user giving background)
        if context:
            prompt_parts.append(f"Context: {context}")

        # Add the main question exactly as a user would ask
        prompt_parts.append(question)

        # For web search providers, they naturally use search without explicit instructions
        return "\n\n".join(prompt_parts)

    async def execute(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Execute with natural responses, then post-process for data extraction"""

        # Route to appropriate execution method based on provider
        if (self.provider == "openai" and
            input_data.get('enable_web_search', True) and
            self.enable_web_search and
            self.web_search_config.is_enabled()):

            return await self._execute_openai_natural(input_data)
        elif self.provider in ["perplexity", "sonar"]:
            return await self._execute_perplexity_natural(input_data)
        elif self.provider == "gemini" and self.enable_web_search:
            return await self._execute_gemini_natural(input_data)
        elif self.provider == "anthropic":
            return await self._execute_anthropic_natural(input_data)
        else:
            # Standard execution for non-web-search cases
            return await self._execute_standard_natural(input_data)

    async def _execute_openai_natural(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Execute OpenAI with natural responses using Responses API"""
        import time
        start_time = time.time()

        try:
            # Build natural prompt
            prompt = await self.process_input(input_data)

            # Create OpenAI client
            client = openai.OpenAI(api_key=os.getenv('OPENAI_API_KEY'))

            # Extract model name
            model_name = self.model_id.split(':')[-1] if ':' in self.model_id else self.model_id

            # Use Responses API with web search - this gives natural ChatGPT-like responses
            try:
                response = client.responses.create(
                    model=model_name,
                    input=prompt,
                    tools=[{"type": "web_search"}] if input_data.get('enable_web_search', True) else []
                )
            except Exception as oe:
                raise RuntimeError(f"OpenAI Responses API error: {oe}")

            # Extract natural response content
            answer_content = ""
            raw_citations = []

            if hasattr(response, 'output') and response.output:
                if isinstance(response.output, list):
                    # Find the assistant message in the response
                    for item in response.output:
                        if hasattr(item, 'content') and hasattr(item, 'role') and item.role == 'assistant':
                            if isinstance(item.content, list):
                                for content_item in item.content:
                                    if hasattr(content_item, 'text'):
                                        answer_content = content_item.text

                                    # Extract raw citation data
                                    if hasattr(content_item, 'annotations'):
                                        for annotation in content_item.annotations:
                                            if (hasattr(annotation, 'url') and
                                                hasattr(annotation, 'title') and
                                                hasattr(annotation, 'type') and
                                                annotation.type == 'url_citation'):
                                                raw_citations.append({
                                                    'url': annotation.url,
                                                    'title': annotation.title or "Web Search Result",
                                                    'domain': self._extract_domain(annotation.url)
                                                })
                elif isinstance(response.output, str):
                    answer_content = response.output
                else:
                    answer_content = str(response.output)

            # Post-process the natural response
            processed_result = await self._post_process_response(
                question=input_data.get('question', ''),
                answer=answer_content,
                raw_citations=raw_citations,
                has_web_search=bool(raw_citations),
                company_name=input_data.get('company_name'),
                competitors=input_data.get('competitors', [])
            )

            execution_time = (time.time() - start_time) * 1000

            # Extract token usage
            tokens_used = 0
            if hasattr(response, 'usage') and response.usage:
                tokens_used = response.usage.total_tokens

            return {
                "result": processed_result,
                "execution_time": execution_time,
                "attempt_count": 1,
                "agent_id": self.agent_id,
                "tokens_used": tokens_used,
                "tokensUsed": tokens_used,
                "model_used": model_name,
                "modelUsed": model_name,
                # Provide structured usage for precise accounting
                "usage": {"total_tokens": tokens_used},
                # Approximate search count by number of citations extracted
                "search_count": len(raw_citations) if raw_citations else 0
            }

        except Exception as e:
            execution_time = (time.time() - start_time) * 1000
            return {
                "error": f"OpenAI natural execution failed: {str(e)}",
                "execution_time": execution_time,
                "attempt_count": 1,
                "agent_id": self.agent_id
            }

    async def _execute_perplexity_natural(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Execute Perplexity with natural responses"""
        import time
        start_time = time.time()

        try:
            # Create a simple agent for natural responses
            simple_agent = Agent(
                model=self.model_id,
                system_prompt=self._get_natural_system_prompt(),
            )

            # Get natural prompt
            prompt = await self.process_input(input_data)

            # Run the agent to get natural Perplexity response
            raw_result = await simple_agent.run(prompt)

            # Extract the natural text content
            if hasattr(raw_result, 'output'):
                answer_content = raw_result.output
            elif hasattr(raw_result, 'data'):
                answer_content = str(raw_result.data)
            else:
                answer_content = str(raw_result)

            if not answer_content or answer_content.strip() == "":
                answer_content = "Error: Perplexity returned empty response"

            # CRITICAL FIX: Extract citations from Perplexity's numbered citation format
            perplexity_citations = self._extract_perplexity_citations(answer_content)

            # Post-process the natural response
            processed_result = await self._post_process_response(
                question=input_data.get('question', ''),
                answer=answer_content,
                raw_citations=perplexity_citations,  # Use extracted citations instead of empty array
                has_web_search=True,
                company_name=input_data.get('company_name'),
                competitors=input_data.get('competitors', [])
            )

            execution_time = (time.time() - start_time) * 1000

            # Extract token usage
            tokens_used = 0
            if hasattr(raw_result, 'usage') and raw_result.usage:
                tokens_used = raw_result.usage.total_tokens if hasattr(raw_result.usage, 'total_tokens') else 0

            return {
                "result": processed_result,
                "execution_time": execution_time,
                "attempt_count": 1,
                "agent_id": self.agent_id,
                "tokens_used": tokens_used,
                "tokensUsed": tokens_used,
                "model_used": "sonar",  # CONSISTENT MODEL NAME
                "modelUsed": "sonar",   # CONSISTENT MODEL NAME
                "usage": {"total_tokens": tokens_used},
                "search_count": len(perplexity_citations) if perplexity_citations else 0
            }

        except Exception as e:
            execution_time = (time.time() - start_time) * 1000
            return {
                "error": f"Perplexity natural execution failed: {str(e)}",
                "execution_time": execution_time,
                "attempt_count": 1,
                "agent_id": self.agent_id
            }

    def _extract_perplexity_citations(self, text: str) -> List[Dict]:
        """Extract citations from Perplexity's numbered citation format like [1] [2] etc."""
        import re
        citations = []

        # Pattern 1: Extract numbered citations with URLs that appear later in text
        # Look for patterns like "according to [1]" and match with URLs
        citation_refs = re.findall(r'\[(\d+)\]', text)

        # Pattern 2: Extract URLs that appear in the text
        url_pattern = r'https?://[^\s\]\)\,\;]+(?:[^\s\]\)\,\;\.]|$)'
        urls = re.findall(url_pattern, text)

        # Pattern 3: Try to extract citation-style patterns like "[1] Domain.com"
        citation_with_domain = re.findall(r'\[(\d+)\]\s*([A-Za-z0-9\-\.]+\.[A-Za-z]{2,})', text)

        print(f"[PERPLEXITY CITATIONS] Found {len(citation_refs)} citation refs, {len(urls)} URLs, {len(citation_with_domain)} domain citations")

        # Create citations from extracted URLs
        for i, url in enumerate(urls[:10]):  # Limit to 10 citations
            try:
                # Clean up URL
                url = re.sub(r'[.,;:!?]*$', '', url)
                domain = self._extract_domain(url)
                title = f"Perplexity Source {i+1} - {domain}"

                citations.append({
                    'url': url,
                    'title': title,
                    'domain': domain
                })
            except Exception as e:
                print(f"[PERPLEXITY CITATIONS] Error processing URL {url}: {e}")
                continue

        # If no URLs found but we have citation numbers, create placeholder citations
        if not citations and citation_refs:
            for ref_num in citation_refs[:5]:  # Limit to 5 placeholders
                citations.append({
                    'url': f"https://perplexity.ai/search?q=citation_{ref_num}",
                    'title': f"Perplexity Citation [{ref_num}]",
                    'domain': "perplexity.ai"
                })

        print(f"[PERPLEXITY CITATIONS] Extracted {len(citations)} citations")
        return citations

    async def _execute_gemini_natural(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Execute Gemini with natural grounding responses"""
        import time
        start_time = time.time()

        try:
            from google import genai
            from google.genai import types
            import os

            # Configure the client
            client = genai.Client(api_key=os.getenv('GEMINI_API_KEY'))

            # Build natural prompt
            prompt = await self.process_input(input_data)

            # Define the grounding tool for natural web search
            grounding_tool = types.Tool(
                google_search=types.GoogleSearch()
            )

            # Configure generation settings
            config = types.GenerateContentConfig(
                tools=[grounding_tool],
                system_instruction=self._get_natural_system_prompt()
            )

            # Make the request
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
                config=config,
            )

            # Extract natural response
            answer_content = response.text or ""
            raw_citations = []

            # Extract grounding citations
            if hasattr(response, 'candidates') and response.candidates:
                candidate = response.candidates[0]
                if hasattr(candidate, 'grounding_metadata') and candidate.grounding_metadata:
                    grounding_chunks = getattr(candidate.grounding_metadata, 'grounding_chunks', [])

                    for chunk in grounding_chunks[:5]:
                        if hasattr(chunk, 'web') and chunk.web:
                            raw_citations.append({
                                'url': chunk.web.uri,
                                'title': chunk.web.title or "Grounded Web Result",
                                'domain': self._extract_domain(chunk.web.uri)
                            })

            # Post-process the natural response
            processed_result = await self._post_process_response(
                question=input_data.get('question', ''),
                answer=answer_content,
                raw_citations=raw_citations,
                has_web_search=bool(raw_citations),
                company_name=input_data.get('company_name'),
                competitors=input_data.get('competitors', [])
            )

            execution_time = (time.time() - start_time) * 1000

            # Extract token usage
            tokens_used = 0
            if hasattr(response, 'usage_metadata') and response.usage_metadata:
                tokens_used = (response.usage_metadata.prompt_token_count or 0) + (response.usage_metadata.candidates_token_count or 0)

            return {
                "result": processed_result,
                "execution_time": execution_time,
                "attempt_count": 1,
                "agent_id": self.agent_id,
                "tokens_used": tokens_used,
                "tokensUsed": tokens_used,
                "model_used": self.model_id,
                "modelUsed": self.model_id,
                "usage": {"total_tokens": tokens_used},
                "search_count": len(raw_citations) if raw_citations else 0
            }

        except Exception as e:
            execution_time = (time.time() - start_time) * 1000
            return {
                "error": f"Gemini natural execution failed: {str(e)}",
                "execution_time": execution_time,
                "attempt_count": 1,
                "agent_id": self.agent_id
            }

    async def _execute_anthropic_natural(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Execute Anthropic Claude with natural responses"""
        import time
        start_time = time.time()

        try:
            # Create a simple agent for natural Claude responses
            simple_agent = Agent(
                model=self.model_id,
                system_prompt=self._get_natural_system_prompt(),
            )

            # Get natural prompt
            prompt = await self.process_input(input_data)

            # Run the agent to get natural Claude response
            raw_result = await simple_agent.run(prompt)

            # Extract the natural text content
            if hasattr(raw_result, 'output'):
                answer_content = raw_result.output
            elif hasattr(raw_result, 'data'):
                answer_content = str(raw_result.data)
            else:
                answer_content = str(raw_result)

            if not answer_content or answer_content.strip() == "":
                answer_content = "Error: Claude returned empty response"

            # Post-process the natural response
            processed_result = await self._post_process_response(
                question=input_data.get('question', ''),
                answer=answer_content,
                raw_citations=[],  # Claude doesn't have built-in web search
                has_web_search=False,
                company_name=input_data.get('company_name'),
                competitors=input_data.get('competitors', [])
            )

            execution_time = (time.time() - start_time) * 1000

            # Extract token usage
            tokens_used = 0
            if hasattr(raw_result, 'usage') and raw_result.usage:
                tokens_used = raw_result.usage.total_tokens if hasattr(raw_result.usage, 'total_tokens') else 0

            return {
                "result": processed_result,
                "execution_time": execution_time,
                "attempt_count": 1,
                "agent_id": self.agent_id,
                "tokens_used": tokens_used,
                "tokensUsed": tokens_used,
                "model_used": self.model_id.split(':')[-1],
                "modelUsed": self.model_id.split(':')[-1],
                "usage": {"total_tokens": tokens_used},
                "search_count": 0
            }

        except Exception as e:
            execution_time = (time.time() - start_time) * 1000
            return {
                "error": f"Anthropic natural execution failed: {str(e)}",
                "execution_time": execution_time,
                "attempt_count": 1,
                "agent_id": self.agent_id
            }

    async def _execute_standard_natural(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Standard execution for non-web-search cases"""
        import time
        start_time = time.time()

        try:
            # Use standard BaseAgent execution
            result = await super().execute(input_data)

            # Post-process if we have a valid result
            if 'result' in result and hasattr(result['result'], 'answer'):
                simple_response = result['result']

                # Post-process the natural response
                processed_result = await self._post_process_response(
                    question=simple_response.question,
                    answer=simple_response.answer,
                    raw_citations=[],
                    has_web_search=False,
                    company_name=input_data.get('company_name'),
                    competitors=input_data.get('competitors', [])
                )

                result['result'] = processed_result

            return result

        except Exception as e:
            execution_time = (time.time() - start_time) * 1000
            return {
                "error": f"Standard natural execution failed: {str(e)}",
                "execution_time": execution_time,
                "attempt_count": 1,
                "agent_id": self.agent_id
            }

    async def _post_process_response(self, question: str, answer: str, raw_citations: List[Dict],
                                   has_web_search: bool, company_name: str = None,
                                   competitors: List[str] = None) -> SimpleQuestionResponse:
        """Post-process natural response to add brand tags and parse citations"""

        # Step 1: Use mention_agent for intelligent brand detection
        processed_answer = await self._detect_and_tag_brands(answer, company_name, competitors or [])

        # Step 2: Parse citations from response and raw citations
        citations = self._parse_citations(processed_answer, raw_citations)

        # Step 3: Count brand and product mentions
        brand_mentions_count = len(self._extract_brand_mentions(processed_answer)) + len(self._extract_product_mentions(processed_answer))

        # Create the final structured response
        return SimpleQuestionResponse(
            question=question,
            answer=processed_answer,
            confidence=0.9 if has_web_search else 0.8,
            citations=citations,  # No citation limit
            has_web_search=has_web_search,
            brand_mentions_count=brand_mentions_count
        )

    async def _detect_and_tag_brands(self, text: str, company_name: str = None, competitors: List[str] = None) -> str:
        """Use intelligent mention agent to detect and tag ALL brands in text"""
        try:
            # Import mention agent directly
            from .mention_agent import MentionAgent, BrandMention

            # Create mention agent instance
            mention_agent = MentionAgent()

            # Prepare input for mention agent
            mention_input = {
                'text': text,
                'company_name': company_name,
                'competitors': competitors or []
            }

            # Call mention agent to detect brands
            logger.info("🔍 Running brand detection...")
            result = await mention_agent.execute(mention_input)

            if result.get('result'):
                mentions_result = result['result']

                # Get mentions from the result
                if hasattr(mentions_result, 'mentions'):
                    brand_mentions = mentions_result.mentions
                elif isinstance(mentions_result, dict) and 'mentions' in mentions_result:
                    # Convert dict mentions to BrandMention objects
                    brand_mentions = []
                    for mention_data in mentions_result['mentions']:
                        if isinstance(mention_data, dict):
                            brand_mentions.append(BrandMention(**mention_data))
                        else:
                            brand_mentions.append(mention_data)
                else:
                    brand_mentions = []

                # Use mention agent's tagging method
                tagged_text = mention_agent.tag_brands_in_text(text, brand_mentions, min_confidence=0.5)

                logger.info(f"✅ Brand detection tagged {len(brand_mentions)} mentions")
                return tagged_text

            else:
                logger.warning("⚠️ Mention agent returned no result; returning original text without tagging")
                return text

        except Exception as e:
            logger.error(f"❌ Brand detection failed: {str(e)}; returning original text without tagging")
            logger.error(f"🔍 Exception details: {type(e).__name__}: {str(e)}")
            return text

    def _parse_citations(self, text: str, raw_citations: List[Dict]) -> List[CitationSource]:
        """Parse citations from text and combine with raw citations"""
        citations = []

        # Add raw citations first (from web search APIs)
        for raw_cite in raw_citations:
            citations.append(CitationSource(
                url=raw_cite['url'],
                title=raw_cite['title'],
                domain=raw_cite['domain']
            ))

        # Extract additional URLs from text (common in Perplexity responses)
        url_pattern = r'https?://[^\s\]\)]+|www\.[^\s\]\)]+'
        urls = re.findall(url_pattern, text)

        for url in urls:
            # Clean up URL
            url = re.sub(r'[.,;:!?]*$', '', url)

            # Add protocol if missing
            if url.startswith('www.'):
                url = 'https://' + url

            # Skip if we already have this URL
            if any(cite.url == url for cite in citations):
                continue

            # Extract domain and create citation
            domain = self._extract_domain(url)
            title = f"Web Result from {domain}"

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

        return unique_citations  # No citation limit

    def _extract_brand_mentions(self, text: str) -> List[str]:
        """Extract brand mentions from text (brands wrapped in <brand> tags)"""
        brand_pattern = r'<brand>(.*?)</brand>'
        matches = re.findall(brand_pattern, text, re.IGNORECASE)
        return [match.strip() for match in matches if match.strip()]

    def _extract_product_mentions(self, text: str) -> List[str]:
        """Extract product mentions from text (products wrapped in <product> tags)"""
        product_pattern = r'<product>(.*?)</product>'
        matches = re.findall(product_pattern, text, re.IGNORECASE)
        return [match.strip() for match in matches if match.strip()]

    def _extract_domain(self, url: str) -> str:
        """Extract domain from URL"""
        try:
            from urllib.parse import urlparse
            parsed = urlparse(url)
            return parsed.netloc
        except:
            return "unknown"

async def main():
    """Main entry point for the natural question answering agent."""
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
        logger.info("🚀 Starting Natural Question Answering Agent")

        # Read input from stdin
        input_data = json.loads(sys.stdin.read())
        logger.info(f"📥 Received input: {json.dumps(input_data, indent=2)}")

        # Get provider and web search settings from input or environment
        provider = input_data.get('provider', os.getenv('PYDANTIC_PROVIDER_ID', 'auto'))
        enable_web_search = input_data.get('enable_web_search', True)

        logger.info(f"🤖 Provider: {provider}")
        logger.info(f"🔍 Web search enabled: {enable_web_search}")

        # Create agent with natural settings
        logger.info("🔨 Creating Natural QuestionAnsweringAgent...")
        agent = QuestionAnsweringAgent(provider=provider, enable_web_search=enable_web_search)
        logger.info(f"✅ Agent created with model: {agent.model_id}")

        # Execute the agent
        logger.info("🚀 Executing natural agent...")
        result = await agent.execute(input_data)
        logger.info("✅ Natural agent execution completed")

        # Log analysis of the result
        if 'result' in result and isinstance(result['result'], SimpleQuestionResponse):
            answer = result['result'].answer
            brand_mentions = len(re.findall(r'<brand>.*?</brand>', answer))
            citations_count = len(result['result'].citations) if result['result'].citations else 0

            logger.info(f"📊 Natural response analysis:")
            logger.info(f"   - Brand mentions: {brand_mentions}")
            logger.info(f"   - Citations: {citations_count}")
            logger.info(f"   - Answer length: {len(answer)} characters")
            logger.info(f"   - Web search used: {result['result'].has_web_search}")
            logger.info(f"   - Response feels natural: ✅")

        # Convert result to JSON-serializable format
        if 'result' in result and hasattr(result['result'], 'model_dump'):
            result['result'] = result['result'].model_dump()

        # Output result
        print(json.dumps(result, indent=2, default=str))
        logger.info("✅ Natural response sent successfully")

    except json.JSONDecodeError as e:
        logger.error(f"❌ JSON decode error: {e}")
        error_output = {
            "error": f"Invalid JSON input: {str(e)}",
            "type": "json_decode_error",
            "agent_id": "question_answering_agent"
        }
        print(json.dumps(error_output, indent=2))
        sys.exit(1)

    except Exception as e:
        logger.error(f"❌ Unexpected error: {e}")
        logger.error(f"📍 Traceback: {traceback.format_exc()}")

        error_output = {
            "error": str(e),
            "type": "question_answering_error",
            "agent_id": "question_answering_agent",
            "traceback": traceback.format_exc()
        }
        print(json.dumps(error_output, indent=2))
        sys.exit(1)

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
