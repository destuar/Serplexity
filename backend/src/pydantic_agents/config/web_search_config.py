#!/usr/bin/env python3
"""
Web Search Configuration for PydanticAI Agents

This module provides a modular configuration system for enabling web search
capabilities across different LLM providers in a task-specific manner.

Key Features:
- Provider-specific web search tool configuration
- Task-based web search enablement
- Native API integration for each provider
- Fallback handling for unsupported providers

Supported Providers:
- OpenAI: Responses API with web_search tool
- Anthropic: Native web search tool
- Google Gemini: Google Search grounding tool
- Perplexity: Built-in web search (no tools needed)

Usage:
    from pydantic_agents.config.web_search_config import WebSearchConfig
    
    config = WebSearchConfig.for_task("sentiment", "openai")
    agent = Agent(model=model, tools=config.get_tools())
"""

import os
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from enum import Enum
from pydantic_ai.tools import Tool

class WebSearchProvider(Enum):
    """Supported web search providers"""
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    GEMINI = "gemini"
    PERPLEXITY = "perplexity"

class TaskType(Enum):
    """Task types that can utilize web search"""
    SENTIMENT = "sentiment"
    FANOUT_GENERATION = "fanout_generation"
    QUESTION_ANSWERING = "question_answering"
    WEBSITE_ENRICHMENT = "website_enrichment"
    OPTIMIZATION_TASKS = "optimization_tasks"

@dataclass
class WebSearchToolConfig:
    """Configuration for a specific web search tool"""
    provider: WebSearchProvider
    tool_name: str
    description: str
    enabled: bool = True
    pricing_per_1000: float = 0.0  # USD per 1000 searches
    max_results: int = 10
    timeout_seconds: int = 30
    
class WebSearchConfig:
    """
    Central configuration for web search capabilities across providers and tasks.
    
    This class manages which tasks can use web search for which providers,
    and provides the appropriate tools and configurations.
    """
    
    # Task-specific web search enablement
    TASK_WEB_SEARCH_ENABLED: Dict[TaskType, bool] = {
        TaskType.SENTIMENT: True,           # Enable for sentiment analysis
        TaskType.FANOUT_GENERATION: False,  # Disable for fanout generation
        TaskType.QUESTION_ANSWERING: True,  # Enable for Q&A
        TaskType.WEBSITE_ENRICHMENT: False,  # Enable for website enrichment
        TaskType.OPTIMIZATION_TASKS: False, # Disable for optimization tasks
    }
    
    # Provider-specific web search tool configurations
    PROVIDER_TOOLS: Dict[WebSearchProvider, WebSearchToolConfig] = {
        WebSearchProvider.OPENAI: WebSearchToolConfig(
            provider=WebSearchProvider.OPENAI,
            tool_name="web_search",
            description="Search the web for current information using OpenAI's web search tool",
            enabled=True,
            pricing_per_1000=25.0,  # $25 per 1000 searches
            max_results=10,
            timeout_seconds=30
        ),
        WebSearchProvider.ANTHROPIC: WebSearchToolConfig(
            provider=WebSearchProvider.ANTHROPIC,
            tool_name="web_search",
            description="Search the web for up-to-date information using Anthropic's web search tool",
            enabled=True,
            pricing_per_1000=10.0,  # $10 per 1000 searches
            max_results=10,
            timeout_seconds=30
        ),
        WebSearchProvider.GEMINI: WebSearchToolConfig(
            provider=WebSearchProvider.GEMINI,
            tool_name="google_search",
            description="Search Google for grounded information using Gemini's Google Search tool",
            enabled=True,
            pricing_per_1000=35.0,  # $35 per 1000 searches
            max_results=10,
            timeout_seconds=30
        ),
        WebSearchProvider.PERPLEXITY: WebSearchToolConfig(
            provider=WebSearchProvider.PERPLEXITY,
            tool_name="built_in_search",
            description="Built-in web search capability (no tools needed)",
            enabled=True,
            pricing_per_1000=0.0,  # Included in model pricing
            max_results=10,
            timeout_seconds=30
        )
    }
    
    @classmethod
    def for_task(cls, task: str, provider: str) -> 'WebSearchConfig':
        """
        Create a web search configuration for a specific task and provider.
        
        Args:
            task: Task type (sentiment, fanout_generation, etc.)
            provider: Provider name (openai, anthropic, gemini, perplexity)
            
        Returns:
            WebSearchConfig instance configured for the task and provider
        """
        try:
            task_type = TaskType(task.lower())
            provider_type = WebSearchProvider(provider.lower())
        except ValueError as e:
            raise ValueError(f"Invalid task '{task}' or provider '{provider}': {e}")
        
        config = cls()
        config.task_type = task_type
        config.provider_type = provider_type
        config.enabled = cls.TASK_WEB_SEARCH_ENABLED.get(task_type, False)
        config.tool_config = cls.PROVIDER_TOOLS.get(provider_type)
        
        return config
    
    def __init__(self):
        self.task_type: Optional[TaskType] = None
        self.provider_type: Optional[WebSearchProvider] = None
        self.enabled: bool = False
        self.tool_config: Optional[WebSearchToolConfig] = None
    
    def is_enabled(self) -> bool:
        """Check if web search is enabled for this task and provider"""
        return (
            self.enabled and 
            self.tool_config and 
            self.tool_config.enabled and
            self._provider_available()
        )
    
    def get_tools(self) -> List[Tool]:
        """Get the web search tools for this configuration"""
        if not self.is_enabled():
            return []
        
        # Perplexity doesn't need explicit tools - has built-in search
        if self.provider_type == WebSearchProvider.PERPLEXITY:
            return []
        
        if not self.tool_config:
            return []
        
        # Create tool based on provider
        if self.provider_type == WebSearchProvider.OPENAI:
            return [self._create_openai_tool()]
        elif self.provider_type == WebSearchProvider.ANTHROPIC:
            return [self._create_anthropic_tool()]
        elif self.provider_type == WebSearchProvider.GEMINI:
            return [self._create_gemini_tool()]
        
        return []
    
    def get_system_prompt_enhancement(self) -> str:
        """Get system prompt enhancement for web search capabilities"""
        if not self.is_enabled():
            return ""
        
        provider_instructions = {
            WebSearchProvider.OPENAI: "You have access to OpenAI's web search tool. Use it to find current information.",
            WebSearchProvider.ANTHROPIC: "You have access to Anthropic's web search tool. Use it to find up-to-date information.",
            WebSearchProvider.GEMINI: "You have access to Google Search grounding. Use it to find verified information.",
            WebSearchProvider.PERPLEXITY: "You have built-in web search capabilities that automatically search for current information."
        }
        
        base_enhancement = f"""
🔍 WEB SEARCH ENABLED
{provider_instructions.get(self.provider_type, "You have web search capabilities.")}

Web Search Guidelines:
- Search for current, relevant information
- Use multiple search queries for comprehensive coverage
- Verify information across multiple sources
- Include search results in your analysis
- Cite sources when possible
"""
        
        # Add task-specific search instructions
        if self.task_type == TaskType.SENTIMENT:
            base_enhancement += """
Sentiment Analysis Search Strategy:
- Search for "[company] reviews 2024"
- Search for "[company] complaints"
- Search for "[company] customer service"
- Search for "[company] site:reddit.com"
- Search for "[company] site:trustpilot.com"
- Look for both positive and negative mentions
"""
        elif self.task_type == TaskType.QUESTION_ANSWERING:
            base_enhancement += """
Question Answering Search Strategy:
- Search for specific information related to the question
- Look for recent news and updates
- Find authoritative sources
- Cross-reference information
"""
        elif self.task_type == TaskType.WEBSITE_ENRICHMENT:
            base_enhancement += """
Website Enrichment Search Strategy:
- Search for official company websites
- Look for verified business information
- Find social media profiles and contact details
- Check for recent company news and updates
"""
        
        return base_enhancement
    
    def _provider_available(self) -> bool:
        """Check if the provider is available (has API key)"""
        api_key_map = {
            WebSearchProvider.OPENAI: 'OPENAI_API_KEY',
            WebSearchProvider.ANTHROPIC: 'ANTHROPIC_API_KEY',
            WebSearchProvider.GEMINI: 'GEMINI_API_KEY',
            WebSearchProvider.PERPLEXITY: 'PERPLEXITY_API_KEY'
        }
        
        required_key = api_key_map.get(self.provider_type)
        
        # Perplexity web search is now enabled with fixed model name
        # if self.provider_type == WebSearchProvider.PERPLEXITY:
        #     return False
        
        return bool(required_key and os.getenv(required_key))
    
    def _create_openai_tool(self) -> Tool:
        """Create OpenAI web search tool"""
        async def web_search(query: str) -> str:
            """Search the web using OpenAI's Responses API"""
            try:
                import openai
                
                api_key = os.getenv('OPENAI_API_KEY')
                if not api_key:
                    return f"Error: OpenAI API key not configured"
                
                client = openai.OpenAI(api_key=api_key)
                
                # Use OpenAI's Responses API with web search
                response = client.responses.create(
                    model="gpt-4o",
                    input=query,
                    tools=[{
                        "type": "web_search"
                    }]
                )
                
                # Extract content from response
                if hasattr(response, 'output') and response.output:
                    return response.output
                elif hasattr(response, 'content') and response.content:
                    return response.content
                else:
                    return f"Search completed but no content returned for: {query}"
                    
            except ImportError:
                return f"Error: OpenAI library not installed. Please install openai package."
            except Exception as e:
                return f"OpenAI web search error: {str(e)}"
        
        return Tool(
            web_search,
            name=self.tool_config.tool_name,
            description=self.tool_config.description
        )
    
    def _create_anthropic_tool(self) -> Tool:
        """Create Anthropic web search tool"""
        async def web_search(query: str) -> str:
            """Search the web using Anthropic's web search tool"""
            try:
                import anthropic
                
                api_key = os.getenv('ANTHROPIC_API_KEY')
                if not api_key:
                    return f"Error: Anthropic API key not configured"
                
                client = anthropic.Anthropic(api_key=api_key)
                
                # Use Anthropic's Messages API with web search tool
                message = client.messages.create(
                    model="claude-3-5-haiku-20241022",
                    max_tokens=1000,
                    tools=[{
                        "type": "web_search_20250305",
                        "name": "web_search",
                        "max_uses": 3
                    }],
                    messages=[{
                        "role": "user",
                        "content": query
                    }]
                )
                
                # Extract content from response
                if message.content:
                    # Handle different content types
                    response_text = ""
                    for content in message.content:
                        if hasattr(content, 'text'):
                            response_text += content.text
                        elif hasattr(content, 'content'):
                            response_text += str(content.content)
                    return response_text if response_text else f"Search completed but no content returned for: {query}"
                else:
                    return f"Search completed but no content returned for: {query}"
                    
            except ImportError:
                return f"Error: Anthropic library not installed. Please install anthropic package."
            except Exception as e:
                return f"Anthropic web search error: {str(e)}"
        
        return Tool(
            web_search,
            name=self.tool_config.tool_name,
            description=self.tool_config.description
        )
    
    def _create_gemini_tool(self) -> Tool:
        """Create Gemini Google Search tool"""
        async def google_search(query: str) -> str:
            """Search Google using Gemini's Google Search grounding tool"""
            try:
                import google.generativeai as genai
                from google.generativeai import types
                
                api_key = os.getenv('GEMINI_API_KEY')
                if not api_key:
                    return f"Error: Gemini API key not configured"
                
                # Configure Gemini API
                genai.configure(api_key=api_key)
                
                # Create a model with Google Search grounding
                model = genai.GenerativeModel('gemini-2.5-flash')
                
                # Configure with Google Search tool
                config = types.GenerateContentConfig(
                    tools=[types.Tool(google_search=types.GoogleSearch())]
                )
                
                # Generate content with search grounding
                response = model.generate_content(
                    contents=query,
                    config=config
                )
                
                # Extract content from response
                if response.text:
                    return response.text
                else:
                    return f"Search completed but no content returned for: {query}"
                    
            except ImportError:
                return f"Error: Google GenerativeAI library not installed. Please install google-generativeai package."
            except Exception as e:
                return f"Gemini web search error: {str(e)}"
        
        return Tool(
            google_search,
            name=self.tool_config.tool_name,
            description=self.tool_config.description
        )
    
    def get_cost_estimate(self, search_count: int) -> float:
        """Get cost estimate for a number of searches"""
        if not self.tool_config:
            return 0.0
        
        return (search_count / 1000.0) * self.tool_config.pricing_per_1000
    
    def get_configuration_summary(self) -> Dict[str, Any]:
        """Get a summary of the current configuration"""
        return {
            "task": self.task_type.value if self.task_type else None,
            "provider": self.provider_type.value if self.provider_type else None,
            "enabled": self.is_enabled(),
            "tool_name": self.tool_config.tool_name if self.tool_config else None,
            "pricing_per_1000": self.tool_config.pricing_per_1000 if self.tool_config else 0.0,
            "provider_available": self._provider_available(),
            "tools_count": len(self.get_tools())
        }

# Convenience functions for common configurations
def get_sentiment_web_search_config(provider: str) -> WebSearchConfig:
    """Get web search configuration for sentiment analysis"""
    return WebSearchConfig.for_task("sentiment", provider)

def get_qa_web_search_config(provider: str) -> WebSearchConfig:
    """Get web search configuration for question answering"""
    return WebSearchConfig.for_task("question_answering", provider)

def get_website_enrichment_web_search_config(provider: str) -> WebSearchConfig:
    """Get web search configuration for website enrichment"""
    return WebSearchConfig.for_task("website_enrichment", provider)

# Export task type mapping for integration with models.ts
TASK_TYPE_MAPPING = {
    "sentiment": TaskType.SENTIMENT,
    "fanout_generation": TaskType.FANOUT_GENERATION,
    "question_answering": TaskType.QUESTION_ANSWERING,
    "website_enrichment": TaskType.WEBSITE_ENRICHMENT,
    "optimization_tasks": TaskType.OPTIMIZATION_TASKS
}

if __name__ == "__main__":
    # Example usage
    config = WebSearchConfig.for_task("sentiment", "openai")
    print(f"Configuration: {config.get_configuration_summary()}")
    print(f"Tools: {len(config.get_tools())}")
    print(f"System prompt enhancement: {config.get_system_prompt_enhancement()}")