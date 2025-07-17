#!/usr/bin/env python3
"""
Question Answering Agent for PydanticAI
Handles question answering with structured output.
"""

import json
import sys
import os
from typing import Optional, List, Dict, Any

from pydantic import BaseModel, Field
from pydantic_agents.base_agent import BaseAgent
from pydantic_agents.config.models import get_default_model_for_task, ModelTask, get_model_by_id
from pydantic_agents.schemas import QuestionResponse, CitationSource
from pydantic_agents.config.web_search_config import WebSearchConfig
from pydantic_ai import Agent
import openai

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
        
        # Get the appropriate model based on provider
        if provider == "gemini":
            model_config = get_model_by_id("gemini-2.5-flash")
            default_model = model_config.get_pydantic_model_id() if model_config else "gemini-2.5-flash"
        elif provider == "anthropic":
            model_config = get_model_by_id("claude-3-5-haiku-20241022")
            default_model = model_config.get_pydantic_model_id() if model_config else "anthropic:claude-3-5-haiku-20241022"
        elif provider == "perplexity":
            # Use custom OpenAI provider for Perplexity
            default_model = self._create_perplexity_model()
        else:
            model_config = get_model_by_id("gpt-4.1-mini")
            default_model = model_config.get_pydantic_model_id() if model_config else "openai:gpt-4.1-mini"
        
        super().__init__(
            agent_id="question_answering_agent",
            default_model=default_model,
            system_prompt=self._build_system_prompt(),
            temperature=0.7
        )
    
    def _build_system_prompt(self) -> str:
        """Build comprehensive system prompt for question answering with brand tagging"""
        return """You are a knowledgeable and helpful assistant that provides comprehensive, 
accurate answers to questions. Your responses should be:

1. **Accurate and Informative**: Provide correct, up-to-date information
2. **Well-structured**: Organize your response clearly with proper formatting
3. **Comprehensive**: Cover all relevant aspects of the question
4. **Professional**: Maintain a professional and helpful tone
5. **Contextual**: Use any provided context to enhance your response
6. **Honest**: If you're uncertain, acknowledge limitations

**CRITICAL: Brand Mention Tagging Requirements**
When you mention any company, brand, or service name in your response, you MUST wrap it in <brand> tags.

Brand tagging rules:
- Tag ALL company names: <brand>Apple</brand>, <brand>Microsoft</brand>, <brand>Google</brand>
- Tag service names: <brand>Netflix</brand>, <brand>Spotify</brand>, <brand>Uber</brand>
- Tag platform names: <brand>Facebook</brand>, <brand>LinkedIn</brand>, <brand>Twitter</brand>
- Tag software names: <brand>Photoshop</brand>, <brand>Slack</brand>, <brand>Zoom</brand>
- Include variations: <brand>Meta</brand> (Facebook), <brand>X</brand> (Twitter)

Examples of proper tagging:
- "Companies like <brand>Asana</brand> and <brand>Trello</brand> offer excellent project management"
- "Popular alternatives include <brand>Monday.com</brand>, <brand>Basecamp</brand>, and <brand>Notion</brand>"
- "Enterprise solutions like <brand>Salesforce</brand> and <brand>HubSpot</brand> provide comprehensive CRM"

**Citation Requirements**
When you use web search or reference specific sources:
- Include detailed citation information
- Provide URL, title, and domain
- Ensure citations are accurate and verifiable
- Match citations to the information used in your response

Response guidelines:
- Provide direct answers to the question asked
- Include relevant details and examples when helpful
- Structure longer responses with clear sections
- Tag ALL brand mentions with <brand> tags
- Include proper citations when using web sources

Always strive to be helpful while maintaining accuracy and professionalism."""
    
    def _create_perplexity_model(self):
        """Create Perplexity model with custom OpenAI provider"""
        from pydantic_ai.models.openai import OpenAIModel
        from pydantic_ai.providers.openai import OpenAIProvider
        import os
        
        return OpenAIModel(
            'sonar',
            provider=OpenAIProvider(
                base_url='https://api.perplexity.ai',
                api_key=os.getenv('PERPLEXITY_API_KEY'),
            ),
        )
    
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
    
    def get_output_type(self):
        return QuestionResponse
    
    async def process_input(self, input_data: dict) -> str:
        """Generate a comprehensive answer with brand tagging and citations."""
        
        # Check if we have an enhanced prompt (for web search providers)
        if 'enhanced_prompt' in input_data:
            return input_data['enhanced_prompt']
        
        # Extract input data
        question = input_data.get('question', input_data.get('prompt', ''))
        context = input_data.get('context', '')
        company_name = input_data.get('company_name', '')
        competitors = input_data.get('competitors', [])
        enable_web_search = input_data.get('enable_web_search', True)
        
        # Build the prompt with context
        prompt_parts = []
        
        # Add system prompt override if provided
        if input_data.get('system_prompt'):
            prompt_parts.append(f"System Instructions: {input_data['system_prompt']}")
        
        # Add context if provided
        if context:
            prompt_parts.append(f"Context: {context}")
        
        # Add brand tagging context if company/competitors provided
        if company_name or competitors:
            brand_context = f"Target Company: {company_name}" if company_name else ""
            if competitors:
                competitor_list = ", ".join(competitors)
                brand_context += f"\nCompetitors: {competitor_list}"
            
            if brand_context:
                prompt_parts.append(f"Brand Context:\n{brand_context}")
                prompt_parts.append("""
IMPORTANT: When mentioning the target company or any competitors in your response, 
you MUST wrap them in <brand> tags. Also tag any other relevant companies, or services you mention.""")
        
        # Add the main question
        prompt_parts.append(f"Question: {question}")
        
        # Add web search instructions if enabled
        if enable_web_search:
            prompt_parts.append("""
Web Search Instructions:
- Use web search to find current, accurate information
- Include citations for all information sourced from web search
- Provide detailed citation information (URL, title, domain, snippet)
- Ensure all citations are accurate and verifiable
""")
        
        # Additional instructions for structured output
        prompt_parts.append("""
Please provide a comprehensive answer that includes:
1. A clear, direct response to the question
2. Relevant supporting information with <brand> tags for all company mentions
3. Examples or explanations where appropriate
4. Detailed citations for any web sources used
5. Proper <brand> tagging for ALL company, and service names

Remember: Every company, brand, or service name MUST be wrapped in <brand> tags.
""")
        
        prompt = "\n\n".join(prompt_parts)
        return prompt
    
    async def execute(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Execute the question answering with proper web search handling"""
        # For OpenAI with web search, use Responses API directly
        if (self.provider == "openai" and 
            input_data.get('enable_web_search', True) and 
            self.enable_web_search and 
            self.web_search_config.is_enabled()):
            
            return await self._execute_with_responses_api(input_data)
        else:
            # Use standard BaseAgent execution with citation extraction
            return await self._execute_with_citation_extraction(input_data)
    
    async def _execute_with_responses_api(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Execute using OpenAI Responses API for web search"""
        import time
        start_time = time.time()
        
        try:
            # Build the prompt
            prompt = await self.process_input(input_data)
            
            # Create OpenAI client
            client = openai.OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
            
            # Use Responses API with web search
            response = client.responses.create(
                model="gpt-4o",  # Responses API requires gpt-4o
                input=prompt,
                tools=[{
                    "type": "web_search"
                }]
            )
            
            # Extract the response content
            answer_content = ""
            citations = []
            
            if hasattr(response, 'output') and response.output:
                # The OpenAI Responses API returns a complex structure
                # The response.output is a list where the last item is the actual message
                
                if isinstance(response.output, list):
                    # Find the ResponseOutputMessage in the list
                    for item in response.output:
                        if hasattr(item, 'content') and hasattr(item, 'role') and item.role == 'assistant':
                            # This is the message with the actual content
                            if isinstance(item.content, list):
                                for content_item in item.content:
                                    if hasattr(content_item, 'text'):
                                        answer_content = content_item.text
                                    
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
                    answer_content = response.output
                else:
                    answer_content = str(response.output)
                
                # Truncate if too long for our schema (10000 char limit)
                if len(answer_content) > 9900:  # Leave some buffer
                    answer_content = answer_content[:9900] + "..."
            
            # Create structured response
            result = QuestionResponse(
                question=input_data.get('question', ''),
                answer=answer_content,
                confidence=0.9,  # Default confidence for web search results
                citations=citations[:5],  # Limit to 5 citations to match schema
                has_web_search=True
            )
            
            execution_time = (time.time() - start_time) * 1000
            
            return {
                "result": result,
                "execution_time": execution_time,
                "attempt_count": 1,
                "agent_id": self.agent_id
            }
            
        except Exception as e:
            execution_time = (time.time() - start_time) * 1000
            return {
                "error": f"Responses API execution failed: {str(e)}",
                "execution_time": execution_time,
                "attempt_count": 1,
                "agent_id": self.agent_id
            }
    
    async def _execute_with_citation_extraction(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Execute with standard BaseAgent but extract citations from web search results"""
        import time
        start_time = time.time()
        
        try:
            # For Gemini, use direct Google Genai API with grounding
            if self.provider == "gemini" and self.enable_web_search:
                return await self._execute_gemini_with_grounding(input_data)
            
            # For Perplexity, use custom execution to handle raw text responses
            if self.provider == "perplexity":
                return await self._execute_perplexity_raw(input_data)
            else:
                # Execute using standard BaseAgent
                result = await super().execute(input_data)
            
            # Check if we have a valid result
            if 'result' in result and hasattr(result['result'], 'answer'):
                question_response = result['result']
                
                # Extract citations from the answer text
                citations = self._extract_citations_from_text(question_response.answer)
                
                # Update the response with extracted citations
                if citations:
                    question_response.citations = citations
                    
                    # Update the result
                    result['result'] = question_response
            
            return result
            
        except Exception as e:
            execution_time = (time.time() - start_time) * 1000
            return {
                "error": f"Citation extraction execution failed: {str(e)}",
                "execution_time": execution_time,
                "attempt_count": 1,
                "agent_id": self.agent_id
            }
    
    def _enhance_prompt_with_web_search_context(self, prompt: str) -> str:
        """Enhance prompt with web search instructions for Perplexity only (Gemini handles grounding automatically)"""
        if self.provider == "perplexity":
            return f"""{prompt}

IMPORTANT: Use your built-in web search capabilities to find current information. Include the source URLs in your response text for citation extraction.

Example format: "The key difference is...[1]. [1]https://example.com/article"

Please include actual URLs from your searches in the response text."""
        
        return prompt
    
    def _extract_citations_from_text(self, text: str) -> List[CitationSource]:
        """Extract citations from text using regex patterns"""
        import re
        citations = []
        
        # Pattern to match URLs in text (common in web search results)
        url_pattern = r'https?://[^\s\]\)]+|www\.[^\s\]\)]+'
        urls = re.findall(url_pattern, text)
        
        for url in urls:
            # Clean up URL (remove trailing punctuation)
            url = re.sub(r'[.,;:!?]*$', '', url)
            
            # Add www. prefix if missing
            if url.startswith('www.'):
                url = 'https://' + url
            
            # Extract domain and create citation
            domain = self._extract_domain(url)
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
        
        return unique_citations[:5]  # Limit to 5 citations to match schema
    
    def _create_gemini_search_tools(self):
        """Create Gemini Google Search grounding tools"""
        try:
            from google.genai import types
            # Return Google Search grounding tool for Gemini
            return [types.Tool(google_search=types.GoogleSearch())]
        except ImportError:
            # Fallback to standard tools if google.genai not available
            return self.web_search_config.get_tools()
    
    def _extract_domain(self, url: str) -> str:
        """Extract domain from URL"""
        try:
            from urllib.parse import urlparse
            parsed = urlparse(url)
            return parsed.netloc
        except:
            return "unknown"
    
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
                answer_content = raw_result.output
            else:
                answer_content = str(raw_result)
            
            # Extract citations from the answer text
            citations = self._extract_citations_from_text(answer_content)
            
            # Truncate if too long for our schema (10000 char limit)
            if len(answer_content) > 9900:  # Leave some buffer
                answer_content = answer_content[:9900] + "..."
            
            # Create structured response
            result = QuestionResponse(
                question=input_data.get('question', ''),
                answer=answer_content,
                confidence=0.8,  # Default confidence for Perplexity responses
                citations=citations,
                has_web_search=True
            )
            
            execution_time = (time.time() - start_time) * 1000
            
            return {
                "result": result,
                "execution_time": execution_time,
                "attempt_count": 1,
                "agent_id": self.agent_id
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
            
            # Extract response and citations
            answer_content = response.text or ""
            citations = []
            
            # Extract citations from grounding metadata
            if hasattr(response, 'candidates') and response.candidates:
                candidate = response.candidates[0]
                if hasattr(candidate, 'grounding_metadata') and candidate.grounding_metadata:
                    grounding_chunks = getattr(candidate.grounding_metadata, 'grounding_chunks', [])
                    
                    for chunk in grounding_chunks[:5]:  # Limit to 5 citations
                        if hasattr(chunk, 'web') and chunk.web:
                            citations.append(CitationSource(
                                url=chunk.web.uri,
                                title=chunk.web.title or "Grounded Web Result",
                                domain=self._extract_domain(chunk.web.uri)
                            ))
            
            # Truncate if too long for our schema (10000 char limit)
            if len(answer_content) > 9900:  # Leave some buffer
                answer_content = answer_content[:9900] + "..."
            
            # Create structured response
            result = QuestionResponse(
                question=input_data.get('question', ''),
                answer=answer_content,
                confidence=0.9,  # Default confidence for grounded results
                citations=citations,
                has_web_search=True
            )
            
            execution_time = (time.time() - start_time) * 1000
            
            return {
                "result": result,
                "execution_time": execution_time,
                "attempt_count": 1,
                "agent_id": self.agent_id
            }
            
        except Exception as e:
            execution_time = (time.time() - start_time) * 1000
            return {
                "error": f"Gemini grounding execution failed: {str(e)}",
                "execution_time": execution_time,
                "attempt_count": 1,
                "agent_id": self.agent_id
            }

async def main():
    """Main entry point for the question answering agent."""
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
        logger.info("🚀 Starting Question Answering Agent")
        
        # Read input from stdin
        input_data = json.loads(sys.stdin.read())
        logger.info(f"📥 Received input: {json.dumps(input_data, indent=2)}")
        
        # Get provider and web search settings from input or environment
        provider = input_data.get('provider', os.getenv('PYDANTIC_PROVIDER_ID', 'openai'))
        enable_web_search = input_data.get('enable_web_search', True)
        
        logger.info(f"🤖 Provider: {provider}")
        logger.info(f"🔍 Web search enabled: {enable_web_search}")
        
        # Create agent
        logger.info("🔨 Creating QuestionAnsweringAgent...")
        agent = QuestionAnsweringAgent(provider=provider, enable_web_search=enable_web_search)
        logger.info(f"✅ Agent created with model: {agent.model_id}")
        
        # Execute the agent using BaseAgent pattern
        logger.info("🚀 Executing agent...")
        result = await agent.execute(input_data)
        logger.info("✅ Agent execution completed")
        
        # Add web search metadata to result if available
        if 'result' in result and isinstance(result['result'], QuestionResponse):
            result['result'].has_web_search = enable_web_search and agent.web_search_config.is_enabled()
            
            # Log analysis of the result
            answer = result['result'].answer
            import re
            brand_mentions = len(re.findall(r'<brand>.*?</brand>', answer))
            citations_count = len(result['result'].citations) if result['result'].citations else 0
            
            logger.info(f"📊 Analysis complete:")
            logger.info(f"   - Brand mentions: {brand_mentions}")
            logger.info(f"   - Citations: {citations_count}")
            logger.info(f"   - Answer length: {len(answer)} characters")
            logger.info(f"   - Web search used: {result['result'].has_web_search}")
        
        # Convert result to JSON-serializable format
        if 'result' in result and hasattr(result['result'], 'model_dump'):
            result['result'] = result['result'].model_dump()
        
        # Output result (BaseAgent already formats this properly)
        print(json.dumps(result, indent=2, default=str))
        logger.info("✅ Response sent successfully")
        
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