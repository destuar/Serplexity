#!/usr/bin/env python3
"""
Optimization Task Generation Agent

This agent generates comprehensive optimization tasks for companies using PydanticAI,
replacing the complex optimization task generation logic in the original LLM service.

Key Features:
- Generates actionable optimization tasks across multiple categories
- Industry-specific task generation
- Priority-based task ranking
- Effort estimation and impact assessment
- Comprehensive error handling and validation

Usage:
    python optimization_agent.py < input.json
    
Input Format:
    {
        "company_name": "Apple Inc.",
        "industry": "Technology",
        "context": "Focus on brand visibility and sentiment",
        "categories": ["content", "brand", "visibility"],
        "max_tasks": 10,
        "priority_focus": "high_impact"
    }

Output Format:
    {
        "data": {
            "companyName": "Apple Inc.",
            "industry": "Technology",
            "tasks": [...],
            "totalTasks": 10,
            "generationTimestamp": "2024-01-15T10:30:00Z"
        },
        "metadata": {...}
    }
"""

import asyncio
import json
import sys
import os
from pathlib import Path
from typing import Dict, Any, Type, List
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv(Path(__file__).parent.parent.parent.parent / '.env')

# Add the parent directory to the path to import schemas
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from pydantic_agents.base_agent import BaseAgent
from pydantic_agents.schemas import OptimizationTaskGeneration, OptimizationTask, OptimizationTaskCategory
from pydantic_agents.config.models import get_default_model_for_task, ModelTask

class OptimizationTaskAgent(BaseAgent):
    """
    PydanticAI agent for generating optimization tasks.
    
    This agent creates comprehensive, actionable optimization tasks designed to
    improve company visibility, brand sentiment, and AI response inclusion.
    """
    
    def __init__(self):
        # Get default model for optimization tasks
        try:
            default_model_config = get_default_model_for_task(ModelTask.OPTIMIZATION_TASKS)
            default_model = default_model_config.get_pydantic_model_id() if default_model_config else "openai:gpt-4.1-mini"
        except Exception:
            # Fallback to simple default model
            default_model = "openai:gpt-4.1-mini"
        
        super().__init__(
            agent_id="optimization_task_generator",
            default_model=default_model,
            system_prompt=self._build_system_prompt(),
            temperature=0.7,  # Balanced temperature for creative yet focused tasks
            timeout=60000,  # Increased timeout for complex task generation
            max_retries=2   # Reduced retries to avoid excessive timeout
        )
    
    def _build_system_prompt(self) -> str:
        """Build comprehensive system prompt for optimization task generation"""
        return """You are an expert digital marketing strategist specializing in AI search optimization and brand visibility.

Your task is to generate comprehensive, actionable optimization tasks that will improve a company's visibility in AI-powered search results and enhance brand sentiment.

TASK CATEGORIES:
1. CONTENT: Content creation, optimization, and distribution strategies
2. TECHNICAL: Technical SEO, website optimization, and infrastructure improvements
3. BRAND: Brand positioning, messaging, and reputation management
4. VISIBILITY: Search optimization, AI training data presence, and discoverability
5. PERFORMANCE: Analytics, monitoring, and continuous improvement

TASK GENERATION PRINCIPLES:
- Create specific, actionable tasks with clear outcomes
- Include detailed descriptions and step-by-step action items
- Provide realistic effort estimates (in hours)
- Assess expected impact and ROI
- Consider industry-specific challenges and opportunities
- Balance quick wins with long-term strategic initiatives
- Include measurable success metrics

PRIORITY LEVELS:
- Priority 1: Critical tasks with immediate high impact
- Priority 2: Important tasks with significant medium-term impact
- Priority 3: Valuable tasks for long-term growth
- Priority 4: Nice-to-have tasks for comprehensive coverage
- Priority 5: Exploratory tasks for future opportunities

EFFORT ESTIMATION GUIDELINES:
- 1-4 hours: Quick implementation tasks
- 5-16 hours: Medium complexity tasks
- 17-40 hours: Complex projects requiring multiple steps
- 41-80 hours: Major initiatives requiring significant resources
- 81-160 hours: Long-term strategic projects

IMPACT ASSESSMENT:
- Quantify expected improvements (e.g., "15% increase in positive mentions")
- Include timeframes for impact realization
- Consider both direct and indirect benefits
- Account for competitive advantages
- Include risk mitigation aspects

TASK STRUCTURE REQUIREMENTS:
- Each task must have a unique taskId (use snake_case format)
- Use priority levels: HIGH, MEDIUM, or LOW
- Put additional details in dependencies object including:
  * actionItems: List of specific steps to complete the task
  * estimatedEffort: Hours required to complete the task
  * successMetrics: Measurable outcomes
  * prerequisites: Any dependencies on other tasks

Your response must follow the exact JSON format specified by the OptimizationTaskGeneration schema."""
    
    def get_output_type(self) -> Type[OptimizationTaskGeneration]:
        """Return the output type for this agent"""
        return OptimizationTaskGeneration
    
    async def process_input(self, input_data: Dict[str, Any]) -> str:
        """Process input data and create task generation prompt"""
        company_name = input_data.get('company_name', '')
        industry = input_data.get('industry', '')
        context = input_data.get('context', '')
        categories = input_data.get('categories', [])
        max_tasks = input_data.get('max_tasks', 10)
        priority_focus = input_data.get('priority_focus', 'balanced')
        
        if not company_name:
            raise ValueError("company_name is required")
        if not industry:
            raise ValueError("industry is required")
        
        # Set default categories if not provided
        if not categories:
            categories = ["content", "technical", "brand", "visibility", "performance"]
        
        # Build generation prompt
        prompt = f"""Generate {max_tasks} comprehensive optimization tasks for {company_name}.

COMPANY: {company_name}
INDUSTRY: {industry}
CONTEXT: {context}

TASK CATEGORIES TO INCLUDE: {', '.join(categories)}
PRIORITY FOCUS: {priority_focus}

REQUIREMENTS:
- Generate exactly {max_tasks} unique, actionable tasks
- Include tasks from all requested categories
- Focus on AI search optimization and brand visibility
- Provide realistic effort estimates and impact assessments
- Include detailed action items for each task
- Assign appropriate priority levels based on impact and urgency
- Consider industry-specific challenges and opportunities

INDUSTRY CONTEXT FOR {industry}:
- Consider typical competitive landscape
- Include relevant compliance and regulatory factors
- Account for industry-specific customer behaviors
- Include appropriate technical considerations
- Focus on relevant marketing channels and strategies

OPTIMIZATION FOCUS AREAS:
1. AI Response Inclusion: Increase mentions in AI-generated responses
2. Brand Sentiment: Improve positive brand perception
3. Content Visibility: Enhance content discoverability
4. Technical Performance: Optimize website and technical infrastructure
5. Competitive Positioning: Strengthen position against competitors

EXAMPLES OF GOOD TASKS:
- "Develop comprehensive FAQ content targeting common industry questions"
- "Implement schema markup to improve search result visibility"
- "Create thought leadership content series for industry publications"
- "Optimize website loading speed and mobile responsiveness"
- "Establish brand monitoring and response strategy"

Each task should be specific enough to assign to a team member and include clear success metrics.

Ensure your response follows the exact JSON schema format for OptimizationTaskGeneration."""
        
        return prompt
    
    def _validate_task_quality(self, tasks: List[OptimizationTask]) -> bool:
        """Validate that tasks are high-quality and actionable (simplified validation)"""
        if not tasks:
            return False
        
        # Basic validation - check that we have tasks and they have basic required fields
        for task in tasks:
            if not hasattr(task, 'title') or not task.title:
                return False
            if not hasattr(task, 'description') or not task.description:
                return False
            if not hasattr(task, 'category') or not task.category:
                return False
        
        # Check for unique task titles (simplified)
        task_titles = [task.title.lower().strip() for task in tasks]
        if len(set(task_titles)) != len(task_titles):
            return False
        
        return True
    
    def _validate_effort_estimates(self, tasks: List[OptimizationTask]) -> bool:
        """Validate that effort estimates are realistic (simplified validation)"""
        # Simplified validation - just check that we have reasonable tasks
        if not tasks or len(tasks) == 0:
            return False
        
        # Basic sanity check - not too many tasks
        if len(tasks) > 50:
            return False
        
        # All validations pass for simplified approach
        return True
    
    async def _post_process_result(self, result: OptimizationTaskGeneration, input_data: Dict[str, Any]) -> OptimizationTaskGeneration:
        """Post-process the result to ensure quality"""
        max_tasks = input_data.get('max_tasks', 10)
        
        # Validate task quality
        if not self._validate_task_quality(result.tasks):
            raise ValueError("Generated tasks lack sufficient quality or diversity")
        
        # Validate effort estimates
        if not self._validate_effort_estimates(result.tasks):
            raise ValueError("Generated tasks have unrealistic effort estimates")
        
        # Ensure we have the right number of tasks
        if len(result.tasks) != max_tasks:
            # Truncate or pad as needed
            if len(result.tasks) > max_tasks:
                result.tasks = result.tasks[:max_tasks]
            result.totalTasks = len(result.tasks)
        
        # Sort tasks by priority (HIGH first, then MEDIUM, then LOW)
        priority_order = {"HIGH": 1, "MEDIUM": 2, "LOW": 3}
        result.tasks.sort(key=lambda x: priority_order.get(x.priority, 3))
        
        return result

async def main():
    """Main function for running the optimization task generation agent"""
    try:
        # Read input from stdin
        input_data = json.loads(sys.stdin.read())
        
        # Create and execute agent
        agent = OptimizationTaskAgent()
        result = await agent.execute(input_data)
        
        # Convert result to JSON-serializable format
        if 'result' in result and hasattr(result['result'], 'model_dump'):
            result['result'] = result['result'].model_dump()
        
        # Output result
        print(json.dumps(result, indent=2, default=str))
        
    except Exception as e:
        # Output error in consistent format
        error_result = {
            "error": str(e),
            "agent_id": "optimization_task_generator",
            "execution_time": 0,
            "attempt_count": 0
        }
        print(json.dumps(error_result))
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())