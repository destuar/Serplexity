#!/usr/bin/env python3
"""
Search Agent for PydanticAI - Optimized for Browser-Like Responses
Provides natural, comprehensive search responses that mimic browser counterparts.
"""

import asyncio
import json
import logging
import os
import sys
import time
from datetime import datetime
from typing import Dict, Any, List, Optional

from pydantic import BaseModel, Field
from ..base_agent import BaseAgent
from ..schemas import (
    SimpleQuestionResponse,
    WebSearchMetadata,
    CitationSource
)
from ..config.web_search_config import WebSearchConfig
from ..config.models import (
    get_default_model_for_task,
    get_models_by_task,
    ModelTask,
    get_model_by_id,
    ModelEngine,
    MODELS
)
from pydantic_ai import Agent
import openai

# Set up logging
logger = logging.getLogger(__name__)

class SearchResponse(BaseModel):
    """Natural search response optimized for browser-like behavior"""
    query: str = Field(..., description="Original search query")
    answer: str = Field(..., min_length=50, description="Comprehensive natural response")
    citations: Optional[List[CitationSource]] = Field(default=[], description="Web sources")
    has_web_search: bool = Field(default=True, description="Web search used")
    model_used: str = Field(..., description="Model that generated response")
    execution_time: int = Field(..., description="Response time in ms")

class SearchInput(BaseModel):
    query: str
    model_id: str
    system_prompt: Optional[str] = None
    enable_web_search: bool = True
    temperature: Optional[float] = 0.7

class SearchAgent(BaseAgent):
    """Search Agent optimized for browser-like responses across different models"""

    def __init__(self, model_id: str = "auto", enable_web_search: bool = True):
        self.model_id = model_id
        self.enable_web_search = enable_web_search
        self.web_search_config = WebSearchConfig.for_task("question_answering", "openai")

        # Determine provider from model_id
        self.provider = self._extract_provider_from_model(model_id)

        # Get browser-optimized model
        optimized_model = self._get_browser_optimized_model(model_id)

        # Use longer timeout for web search operations
        timeout = 90000 if enable_web_search else 45000

        super().__init__(
            agent_id="search_agent",
            default_model=optimized_model,
            system_prompt=self._get_browser_like_system_prompt(),
            temperature=0.7,  # Will be overridden by input
            timeout=timeout,
            max_retries=2
        )

    def _extract_provider_from_model(self, model_id: str) -> str:
        """Extract provider from model ID"""
        if model_id.startswith("gpt-") or model_id.startswith("openai:"):
            return "openai"
        elif model_id.startswith("claude-") or model_id.startswith("anthropic:"):
            return "anthropic"
        elif model_id.startswith("gemini-") or "gemini" in model_id.lower():
            return "gemini"
        elif "sonar" in model_id.lower() or "perplexity" in model_id.lower():
            return "perplexity"
        else:
            return "openai"  # Default fallback

    def _get_browser_optimized_model(self, model_id: str) -> str:
        """Get the browser-optimized version of the model using centralized config"""
        if model_id == "auto":
            # Use default model for question answering from config
            default_model = get_default_model_for_task(ModelTask.QUESTION_ANSWERING)
            return default_model.get_pydantic_model_id() if default_model else "openai:gpt-4.1-mini"

        # Check if model exists in our centralized config
        model_config = get_model_by_id(model_id)
        if model_config:
            return model_config.get_pydantic_model_id()

        # For backwards compatibility, handle models not in config
        if ":" not in model_id:
            # Add provider prefix if missing
            if model_id.startswith("gpt-"):
                return f"openai:{model_id}"
            elif model_id.startswith("claude-"):
                return f"anthropic:{model_id}"
            elif model_id.startswith("gemini-"):
                return f"gemini:{model_id}"
            else:
                return f"openai:{model_id}"
        else:
            return model_id

    def _get_optimal_temperature(self) -> float:
        """Get optimal temperature for browser-like responses"""
        if self.provider == "openai":
            return 0.7  # ChatGPT browser default
        elif self.provider == "anthropic":
            return 0.8  # Claude browser default
        elif self.provider == "gemini":
            return 0.7  # Gemini browser default
        elif self.provider == "perplexity":
            return 0.2  # Perplexity is more focused
        else:
            return 0.7

    def _get_browser_like_system_prompt(self) -> str:
        """Get browser-like system prompt optimized for each provider"""
        base_search_instructions = """
When answering search queries:
1. Provide comprehensive, well-structured responses
2. Use current information from web searches when available
3. Include specific details, examples, and context
4. Organize information clearly with headings when appropriate
5. Cite sources naturally in your response
6. Be conversational but informative
7. Address the query completely and anticipate follow-up questions
"""

        if self.provider == "openai":
            # ChatGPT-like system prompt based on leaked prompts
            return f"""You are ChatGPT, a large language model trained by OpenAI.
Knowledge cutoff: 2024-04
Current date: {datetime.now().strftime('%Y-%m-%d')}

You are a helpful assistant that provides comprehensive, accurate responses to search queries.
{base_search_instructions}

Respond naturally as you would in a conversation, using web search capabilities to provide up-to-date information."""

        elif self.provider == "anthropic":
            # Claude-like system prompt
            return f"""You are Claude, a helpful AI assistant created by Anthropic.
{base_search_instructions}

Provide thoughtful, nuanced responses that acknowledge complexity when appropriate.
Be honest about limitations while still being as helpful as possible."""

        elif self.provider == "gemini":
            # Gemini-like system prompt
            return f"""You are a helpful AI assistant powered by Google's Gemini.
{base_search_instructions}

Provide accurate, informative responses using the latest information available.
Focus on being precise while remaining accessible and easy to understand."""

        elif self.provider == "perplexity":
            # Perplexity-like system prompt
            return f"""You are a helpful AI assistant optimized for search and research.
{base_search_instructions}

Focus on providing comprehensive answers with strong source attribution.
Prioritize accuracy and recency of information."""

        else:
            return f"You are a helpful search assistant.{base_search_instructions}"

    def get_output_type(self):
        return SearchResponse

    async def process_input(self, input_data: dict) -> str:
        """Create natural search prompt optimized for each provider"""
        query = input_data.get('query', input_data.get('question', ''))

        # For search queries, we want natural prompts that encourage comprehensive responses
        if self.provider == "perplexity":
            # Perplexity naturally searches without explicit instructions
            return query
        elif self.provider == "gemini":
            # Gemini with grounding works best with clear search intent
            return f"Search for and provide comprehensive information about: {query}"
        else:
            # OpenAI and Claude benefit from natural conversational queries
            return query

    async def execute(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Execute search with browser-optimized responses for each provider"""
        start_time = time.time()

        # Override temperature if provided in input
        if 'temperature' in input_data and input_data['temperature'] is not None:
            self.temperature = float(input_data['temperature'])

        try:
            # Route to provider-specific execution
            if self.provider == "openai":
                return await self._execute_openai_search(input_data, start_time)
            elif self.provider == "anthropic":
                return await self._execute_claude_search(input_data, start_time)
            elif self.provider == "gemini":
                return await self._execute_gemini_search(input_data, start_time)
            elif self.provider == "perplexity":
                return await self._execute_perplexity_search(input_data, start_time)
            else:
                return await self._execute_fallback_search(input_data, start_time)

        except Exception as e:
            execution_time = int((time.time() - start_time) * 1000)
            logger.error(f"Search execution failed: {str(e)}")
            return {
                "error": f"Search execution failed: {str(e)}",
                "execution_time": execution_time,
                "agent_id": self.agent_id
            }

    async def _execute_openai_search(self, input_data: Dict[str, Any], start_time: float) -> Dict[str, Any]:
        """Execute OpenAI search using Responses API for ChatGPT-like behavior"""
        try:
            prompt = await self.process_input(input_data)
            client = openai.OpenAI(api_key=os.getenv('OPENAI_API_KEY'))

            # Extract model name
            model_name = self.model_id.split(':')[-1] if ':' in self.model_id else self.model_id

            # Use Responses API with web search for ChatGPT-like experience
            response = client.responses.create(
                model=model_name,
                input=prompt,
                tools=[{"type": "web_search"}] if self.enable_web_search else []
            )

            # Extract response content and citations
            answer_content = ""
            raw_citations = []

            if hasattr(response, 'output') and response.output:
                if isinstance(response.output, list):
                    for item in response.output:
                        if hasattr(item, 'content') and hasattr(item, 'role') and item.role == 'assistant':
                            if isinstance(item.content, list):
                                for content_item in item.content:
                                    if hasattr(content_item, 'text'):
                                        answer_content = content_item.text

                                    # Extract citations
                                    if hasattr(content_item, 'annotations'):
                                        for annotation in content_item.annotations:
                                            if (hasattr(annotation, 'url') and
                                                hasattr(annotation, 'title') and
                                                hasattr(annotation, 'type') and
                                                annotation.type == 'url_citation'):
                                                raw_citations.append(CitationSource(
                                                    url=annotation.url,
                                                    title=annotation.title or "Web Search Result",
                                                    domain=self._extract_domain(annotation.url)
                                                ))
                elif isinstance(response.output, str):
                    answer_content = response.output
                else:
                    answer_content = str(response.output)

            execution_time = int((time.time() - start_time) * 1000)

            # Create optimized response
            search_response = SearchResponse(
                query=input_data.get('query', ''),
                answer=answer_content or "I couldn't generate a response to your search query.",
                citations=raw_citations,
                has_web_search=bool(raw_citations),
                model_used=model_name,
                execution_time=execution_time
            )

            return {
                "result": search_response.model_dump(),
                "execution_time": execution_time,
                "attempt_count": 1,
                "agent_id": self.agent_id,
                "model_used": model_name
            }

        except Exception as e:
            execution_time = int((time.time() - start_time) * 1000)
            logger.error(f"OpenAI search failed: {str(e)}")
            return {
                "error": f"OpenAI search failed: {str(e)}",
                "execution_time": execution_time,
                "agent_id": self.agent_id
            }

    async def _execute_claude_search(self, input_data: Dict[str, Any], start_time: float) -> Dict[str, Any]:
        """Execute Claude search with browser-like behavior"""
        try:
            prompt = await self.process_input(input_data)

            # Create Claude agent with browser-like system prompt
            claude_agent = Agent(
                model=self.model_id,
                system_prompt=self._get_browser_like_system_prompt(),
            )

            # Execute with Claude
            result = await claude_agent.run(prompt)

            # Extract response
            if hasattr(result, 'output'):
                answer_content = result.output
            elif hasattr(result, 'data'):
                answer_content = str(result.data)
            else:
                answer_content = str(result)

            execution_time = int((time.time() - start_time) * 1000)

            # Create response
            search_response = SearchResponse(
                query=input_data.get('query', ''),
                answer=answer_content or "I couldn't generate a response to your search query.",
                citations=[],
                has_web_search=False,
                model_used=self.model_id.split(':')[-1],
                execution_time=execution_time
            )

            return {
                "result": search_response.model_dump(),
                "execution_time": execution_time,
                "attempt_count": 1,
                "agent_id": self.agent_id,
                "model_used": self.model_id.split(':')[-1]
            }

        except Exception as e:
            execution_time = int((time.time() - start_time) * 1000)
            logger.error(f"Claude search failed: {str(e)}")
            return {
                "error": f"Claude search failed: {str(e)}",
                "execution_time": execution_time,
                "agent_id": self.agent_id
            }

    async def _execute_gemini_search(self, input_data: Dict[str, Any], start_time: float) -> Dict[str, Any]:
        """Execute Gemini search with grounding for browser-like behavior"""
        try:
            from google import genai
            from google.genai import types

            client = genai.Client(api_key=os.getenv('GEMINI_API_KEY'))
            prompt = await self.process_input(input_data)

            # Configure with grounding for search
            grounding_tool = types.Tool(google_search=types.GoogleSearch())
            config = types.GenerateContentConfig(
                tools=[grounding_tool] if self.enable_web_search else [],
                system_instruction=self._get_browser_like_system_prompt()
            )

            # Get the actual Gemini model from config
            gemini_model = get_model_by_id("gemini-2.5-flash")
            model_name = gemini_model.id if gemini_model else "gemini-2.5-flash"

            # Execute with Gemini
            response = client.models.generate_content(
                model=model_name,
                contents=prompt,
                config=config,
            )

            # Extract response and citations
            answer_content = response.text or ""
            citations = []

            # Extract grounding citations
            if hasattr(response, 'candidates') and response.candidates:
                candidate = response.candidates[0]
                if hasattr(candidate, 'grounding_metadata') and candidate.grounding_metadata:
                    grounding_chunks = getattr(candidate.grounding_metadata, 'grounding_chunks', [])

                    for chunk in grounding_chunks[:10]:  # Top 10 sources
                        if hasattr(chunk, 'web') and chunk.web:
                            citations.append(CitationSource(
                                url=chunk.web.uri,
                                title=chunk.web.title or "Grounded Web Result",
                                domain=self._extract_domain(chunk.web.uri)
                            ))

            execution_time = int((time.time() - start_time) * 1000)

            # Create response
            search_response = SearchResponse(
                query=input_data.get('query', ''),
                answer=answer_content or "I couldn't generate a response to your search query.",
                citations=citations,
                has_web_search=bool(citations),
                model_used=model_name,
                execution_time=execution_time
            )

            return {
                "result": search_response.model_dump(),
                "execution_time": execution_time,
                "attempt_count": 1,
                "agent_id": self.agent_id,
                "model_used": model_name
            }

        except Exception as e:
            execution_time = int((time.time() - start_time) * 1000)
            logger.error(f"Gemini search failed: {str(e)}")
            return {
                "error": f"Gemini search failed: {str(e)}",
                "execution_time": execution_time,
                "agent_id": self.agent_id
            }

    async def _execute_perplexity_search(self, input_data: Dict[str, Any], start_time: float) -> Dict[str, Any]:
        """Execute Perplexity search for natural search behavior"""
        try:
            prompt = await self.process_input(input_data)

            # Create Perplexity model
            perplexity_model = self._create_perplexity_model()

            # Create agent with Perplexity-optimized settings
            perplexity_agent = Agent(
                model=perplexity_model,
                system_prompt=self._get_browser_like_system_prompt(),
            )

            # Execute search
            result = await perplexity_agent.run(prompt)

            # Extract response
            if hasattr(result, 'output'):
                answer_content = result.output
            elif hasattr(result, 'data'):
                answer_content = str(result.data)
            else:
                answer_content = str(result)

            execution_time = int((time.time() - start_time) * 1000)

            # Create response
            search_response = SearchResponse(
                query=input_data.get('query', ''),
                answer=answer_content or "I couldn't generate a response to your search query.",
                citations=[],  # Perplexity includes URLs in text
                has_web_search=True,
                model_used=self.model_id.split(':')[-1] if isinstance(self.model_id, str) and ':' in self.model_id else str(self.model_id),
                execution_time=execution_time
            )

            return {
                "result": search_response.model_dump(),
                "execution_time": execution_time,
                "attempt_count": 1,
                "agent_id": self.agent_id,
                "model_used": self.model_id.split(':')[-1] if isinstance(self.model_id, str) and ':' in self.model_id else str(self.model_id)
            }

        except Exception as e:
            execution_time = int((time.time() - start_time) * 1000)
            logger.error(f"Perplexity search failed: {str(e)}")
            return {
                "error": f"Perplexity search failed: {str(e)}",
                "execution_time": execution_time,
                "agent_id": self.agent_id
            }

    async def _execute_fallback_search(self, input_data: Dict[str, Any], start_time: float) -> Dict[str, Any]:
        """Fallback search execution"""
        try:
            prompt = await self.process_input(input_data)

            # Use base agent execution as fallback
            result = await super().execute(input_data)

            execution_time = int((time.time() - start_time) * 1000)

            if 'result' in result:
                return result
            else:
                # Create basic response
                search_response = SearchResponse(
                    query=input_data.get('query', ''),
                    answer="I encountered an issue processing your search query.",
                    citations=[],
                    has_web_search=False,
                    model_used=self.model_id,
                    execution_time=execution_time
                )

                return {
                    "result": search_response.model_dump(),
                    "execution_time": execution_time,
                    "agent_id": self.agent_id
                }

        except Exception as e:
            execution_time = int((time.time() - start_time) * 1000)
            logger.error(f"Fallback search failed: {str(e)}")
            return {
                "error": f"Fallback search failed: {str(e)}",
                "execution_time": execution_time,
                "agent_id": self.agent_id
            }

    def _create_perplexity_model(self):
        """Create Perplexity model with custom OpenAI provider"""
        try:
            from pydantic_ai.models.openai import OpenAIChatModel as ChatModel
        except Exception:
            from pydantic_ai.models.openai import OpenAIModel as ChatModel
        from pydantic_ai.providers.openai import OpenAIProvider

        api_key = os.getenv('PERPLEXITY_API_KEY')

        model = ChatModel(
            'sonar',
            provider=OpenAIProvider(
                base_url='https://api.perplexity.ai',
                api_key=api_key,
            ),
        )
        # Tag for downstream logging/pricing normalization
        try:
            setattr(model, '_serplexity_model_id', 'sonar')
        except Exception:
            pass
        return model

    def _extract_domain(self, url: str) -> str:
        """Extract domain from URL"""
        try:
            from urllib.parse import urlparse
            parsed = urlparse(url)
            return parsed.netloc
        except:
            return "unknown"

async def main():
    """Main entry point for search agent"""
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
        logger.info("🔍 Starting Search Agent")

        # Read input from stdin
        input_data = json.loads(sys.stdin.read())
        logger.info(f"📥 Received search query: {input_data.get('query', 'N/A')}")

        # Get model ID from input
        model_id = input_data.get('model_id', input_data.get('modelId', 'auto'))
        enable_web_search = input_data.get('enable_web_search', True)

        logger.info(f"🤖 Model: {model_id}")
        logger.info(f"🔍 Web search: {enable_web_search}")

        # Create search agent
        search_agent = SearchAgent(model_id=model_id, enable_web_search=enable_web_search)
        logger.info(f"✅ Search agent created with optimized model: {search_agent.model_id}")

        # Execute search
        result = await search_agent.execute(input_data)
        logger.info("✅ Search completed")

        # Log search analysis
        if 'result' in result and isinstance(result['result'], dict):
            search_result = result['result']
            logger.info(f"📊 Search analysis:")
            logger.info(f"   - Answer length: {len(search_result.get('answer', ''))}")
            logger.info(f"   - Citations: {len(search_result.get('citations', []))}")
            logger.info(f"   - Web search: {search_result.get('has_web_search', False)}")
            logger.info(f"   - Model: {search_result.get('model_used', 'N/A')}")

        # Output result
        print(json.dumps(result, indent=2, default=str))
        logger.info("✅ Search response sent")

    except json.JSONDecodeError as e:
        logger.error(f"❌ JSON decode error: {e}")
        error_output = {
            "error": f"Invalid JSON input: {str(e)}",
            "type": "json_decode_error",
            "agent_id": "search_agent"
        }
        print(json.dumps(error_output, indent=2))
        sys.exit(1)

    except Exception as e:
        logger.error(f"❌ Search agent error: {e}")
        logger.error(f"📍 Traceback: {traceback.format_exc()}")

        error_output = {
            "error": str(e),
            "type": "search_error",
            "agent_id": "search_agent",
            "traceback": traceback.format_exc()
        }
        print(json.dumps(error_output, indent=2))
        sys.exit(1)

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
