#!/usr/bin/env python3
"""
Question Generation Agent for PydanticAI
Generates 25 customer questions based on company research context using centralized model configuration.
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
from ..schemas import QueryType, PurchaseIntent

# Set up logging
logger = logging.getLogger(__name__)

# ================= QUESTION SCHEMAS =================
class CustomerQuestion(BaseModel):
    """A single customer-facing search question with metadata"""
    query: str = Field(..., min_length=5, max_length=250, description="Search question text")
    type: QueryType = Field(..., description="Fanout-style query type")
    intent: PurchaseIntent = Field(..., description="Purchase intent classification")

class CustomerQuestions(BaseModel):
    """Collection of customer questions for a company"""
    company_name: str = Field(..., description="Company name")
    industry: str = Field(..., description="Industry category")
    active_questions: List[CustomerQuestion] = Field(..., min_items=3, max_items=5, description="3-5 highest-value questions")
    suggested_questions: List[CustomerQuestion] = Field(..., min_items=10, max_items=25, description="10-25 additional questions")


class GenQuestionAgent(BaseAgent):

    def __init__(self, provider: str = "openai"):
        """Initialize with centralized model configuration for question generation"""
        # Use centralized configuration instead of hardcoded model
        default_model_config = get_default_model_for_task(ModelTask.QUESTION_GENERATION)
        default_model = default_model_config.get_pydantic_model_id() if default_model_config else "openai:gpt-4.1-mini"

        super().__init__(
            agent_id="gen_question_agent",
            default_model=default_model,
            system_prompt=self._build_system_prompt(),
            temperature=0.7,
            timeout=30000,
            max_retries=2
        )

    def _clean_text(self, text: str) -> str:
        """Clean text by removing markdown formatting, company names, and extra whitespace"""
        if not text:
            return ""

        import re

        # Remove markdown formatting
        text = re.sub(r'\*\*(.*?)\*\*', r'\1', text)  # Remove **bold**
        text = re.sub(r'\*(.*?)\*', r'\1', text)      # Remove *italic*
        text = re.sub(r'`(.*?)`', r'\1', text)        # Remove `code`

        # Remove extra whitespace and normalize
        text = ' '.join(text.split())

        return text.strip()

    def _build_system_prompt(self) -> str:
        """Build system prompt for question generation based on company research"""
        qt_values = ", ".join([qt.value for qt in QueryType])
        return (
            "You are a customer research specialist. Your job is to generate realistic search questions "
            "that potential customers would type into Google or AI assistants when looking for solutions "
            "to their problems.\n\n"
            "You will be provided with research about what a company offers, their target customers, "
            "and the problems they solve. Use this context to generate 25 customer-facing questions.\n\n"
            "CRITICAL REQUIREMENTS:\n"
            "- Generate questions that potential customers ask BEFORE they know about specific companies\n"
            "- Focus on the problems, needs, and use cases you see in the research\n"
            "- Use natural language that real people would type\n"
            "- NEVER include specific company names or brand names in questions\n"
            "- Cover the full customer journey: awareness, consideration, and purchase intent\n\n"
            "OUTPUT REQUIREMENTS (MUST BE VALID JSON – DO NOT WRAP IN MARKDOWN):\n"
            "{\n"
            "  \"company_name\": string,\n"
            "  \"industry\": string,\n"
            "  \"active_questions\": CustomerQuestion[5],  # exactly 5 highest-value questions\n"
            "  \"suggested_questions\": CustomerQuestion[20]  # exactly 20 additional questions (no more, no less)\n"
            "}\n\n"
            "Where CustomerQuestion = {\n"
            "  \"query\": string,                 # ends with ? and <200 chars\n"
            f"  \"type\": one of [{qt_values}],    # QUERY STYLE/FORMAT (NOT awareness/consideration/purchase!)\n"
            "  \"intent\": one of [awareness, consideration, purchase]    # CUSTOMER JOURNEY STAGE\n"
            "}.\n\n"
            "CRITICAL VALIDATION RULES:\n"
            "- Each question must have exactly ONE 'type' field and ONE 'intent' field\n"
            "- 'type' must ONLY be one of: 'paraphrase', 'comparison', 'temporal', 'topical', 'entity_broader', 'entity_narrower', 'session_context', 'user_profile', 'vertical', 'safety_probe'\n"
            "- 'intent' must ONLY be one of: 'awareness', 'consideration', 'purchase'\n"
            "- DO NOT use 'awareness', 'consideration', or 'purchase' for the 'type' field!\n"
            "- Generate exactly 5 active questions and exactly 20 suggested questions\n"
            "- Each question object must be complete and valid JSON\n\n"
            "Guidelines:\n"
            "1. Active questions should be high-value, purchase-oriented or mid-funnel queries\n"
            "2. Suggested questions should round out the funnel with awareness & comparison queries\n"
            "3. Use diverse query types (paraphrase, comparison, temporal, topical, etc.)\n"
            "4. Keep questions specific to the types of solutions and problems mentioned in the research\n"
            "5. Write exactly how real customers would ask - natural, conversational language\n"
            "6. EACH question must explicitly reference the solution CATEGORY (e.g., 'SERP analytics tools', 'competitive intelligence platforms') – never use vague words like 'this', 'it', or 'the software' without context.\n"
            "7. Avoid generic stand-alone asks such as 'Are there demos or free trials available?'. Instead frame them with the category: e.g., 'Which SERP analytics platforms offer a free trial?'\n"
            "8. Provide ONLY the JSON described – no commentary, no code fences"
        )

    def get_output_type(self):
        return CustomerQuestions

    async def process_input(self, input_data: dict) -> str:
        """Create prompt with company research context for question generation"""
        company_name = input_data.get('company_name', '')
        research_context = input_data.get('research_context', {})

        # Debug logging
        logger.info(f"Question agent input - Company: {company_name}")
        logger.info(f"Research context keys: {list(research_context.keys())}")
        logger.info(f"Research context: {json.dumps(research_context, indent=2)}")

        # Extract research data
        what_they_offer = research_context.get('what_they_offer', '')
        target_customers = research_context.get('target_customers', '')
        problems_solved = research_context.get('problems_solved', '')
        industry_category = research_context.get('industry_category', '')

        # Clean and extract key concepts from research data
        # Remove company names, markdown formatting, and citations
        clean_industry = self._clean_text(industry_category)
        clean_offer = self._clean_text(what_they_offer)
        clean_customers = self._clean_text(target_customers)
        clean_problems = self._clean_text(problems_solved)

        prompt = (
            f"RESEARCH CONTEXT (analyze but DO NOT include company names in questions):\n\n"
            f"Industry/Category: {clean_industry}\n\n"
            f"Solutions offered: {clean_offer}\n\n"
            f"Target customers: {clean_customers}\n\n"
            f"Problems addressed: {clean_problems}\n\n"
            f"TASK:\n"
            f"Based on this context, generate 25 customer search questions that potential customers "
            f"would naturally ask when looking for these types of solutions. Focus on the CATEGORY "
            f"of solution (e.g., 'business software', 'CRM tools', 'ecommerce platforms') rather than "
            f"specific company names.\n\n"
            f"Examples of good questions:\n"
            f"- 'What is the best CRM software for small businesses?'\n"
            f"- 'How much does business automation software cost?'\n"
            f"- 'Which ecommerce platforms offer a free trial for new users?'\n"
            f"- 'What features should I look for in SERP analytics tools?'\n"
            f"- 'Are AI-powered competitive-intelligence platforms more accurate than traditional solutions?'\n\n"
            f"Generate the JSON described above."
        )

        return prompt

    async def execute(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Execute question generation workflow"""
        import time
        start_time = time.time()

        try:
            # Simple agent for JSON generation
            simple_agent = Agent(
                model=self.model_id,
                system_prompt=self.env_system_prompt or self.system_prompt,
            )

            prompt = await self.process_input(input_data)

            # Add timeout protection
            import asyncio
            try:
                raw = await asyncio.wait_for(simple_agent.run(prompt), timeout=25.0)
            except asyncio.TimeoutError:
                execution_time = (time.time() - start_time) * 1000
                logger.error("Question generation timed out after 25 seconds")
                return {
                    "error": "Question generation timed out after 25 seconds. This indicates the LLM is taking too long to respond. Check model availability and network connectivity.",
                    "execution_time": execution_time,
                    "attempt_count": 1,
                    "agent_id": self.agent_id,
                    "error_type": "timeout"
                }

            if hasattr(raw, 'output'):
                content = raw.output.strip()
            else:
                content = str(raw).strip()

            # Debug: Log the raw LLM response
            logger.info(f"Raw LLM response (first 500 chars): {content[:500]}")

            # Attempt to parse JSON directly, then normalize invalid 'type' values
            try:
                parsed_dict = json.loads(content)
                # Normalize legacy or invalid enum values in both arrays
                def coerce_type(value: str) -> str:
                    allowed = {qt.value for qt in QueryType}
                    if value in allowed:
                        return value
                    # Common mislabels from LLM outputs to map to closest allowed types
                    mapping = {
                        "awareness": "topical",
                        "consideration": "comparison",
                        "purchase": "paraphrase",
                        "session": "session_context",
                        "user": "user_profile",
                        "entity_broaden": "entity_broader",
                        "entity_narrow": "entity_narrower",
                        "verticals": "vertical",
                    }
                    for k, v in mapping.items():
                        if isinstance(value, str) and k in value:
                            return v
                    # Default to topical
                    return "topical"

                def normalize_questions(arr):
                    out = []
                    for q in arr or []:
                        if not isinstance(q, dict):
                            continue
                        qn = dict(q)
                        if "type" in qn:
                            qn["type"] = coerce_type(str(qn["type"]))
                        out.append(qn)
                    return out

                parsed_dict["active_questions"] = normalize_questions(parsed_dict.get("active_questions") or parsed_dict.get("activeQuestions"))
                parsed_dict["suggested_questions"] = normalize_questions(parsed_dict.get("suggested_questions") or parsed_dict.get("suggestedQuestions"))

                logger.info(f"Parsed LLM response - Active questions: {len(parsed_dict.get('active_questions', []))}, Suggested: {len(parsed_dict.get('suggested_questions', []))}")
                if parsed_dict.get('active_questions'):
                    logger.info(f"Sample active question: {parsed_dict['active_questions'][0].get('query', 'N/A')}")
                result_obj = CustomerQuestions(**parsed_dict)
            except Exception as parse_err:
                execution_time = (time.time() - start_time) * 1000
                logger.error(f"Failed to parse LLM response as valid JSON: {parse_err}")
                logger.error(f"Raw LLM response content: {content}")
                return {
                    "error": f"Failed to parse LLM response as valid JSON. Parse error: {str(parse_err)}. Raw response: {content[:500]}...",
                    "execution_time": execution_time,
                    "attempt_count": 1,
                    "agent_id": self.agent_id,
                    "error_type": "parse_error",
                    "raw_response": content
                }

            execution_time = (time.time() - start_time) * 1000

            # Ensure company/industry present to satisfy downstream expectations
            if not result_obj.company_name:
                result_obj.company_name = input_data.get('company_name') or 'N/A'
            if not result_obj.industry:
                result_obj.industry = input_data.get('industry') or 'N/A'

            # Convert to the format expected by TypeScript worker (camelCase)
            result_dict = result_obj.model_dump() if hasattr(result_obj, 'model_dump') else result_obj
            logger.info(f"Question agent result_dict: {result_dict}")

            if not result_dict or not isinstance(result_dict, dict):
                logger.error("Question agent returned empty or invalid result")
                return {
                    "error": "Question agent returned empty or invalid result. The LLM response was successfully parsed but contained no valid question data.",
                    "execution_time": execution_time,
                    "attempt_count": 1,
                    "agent_id": self.agent_id,
                    "error_type": "empty_result",
                    "result_dict": result_dict
                }

            transformed_result = {
                "activeQuestions": result_dict.get("active_questions", []),
                "suggestedQuestions": result_dict.get("suggested_questions", [])
            }

            logger.info(f"Transformed result: activeQuestions={len(transformed_result['activeQuestions'])}, suggestedQuestions={len(transformed_result['suggestedQuestions'])}")

            return {
                "result": transformed_result,
                "execution_time": execution_time,
                "attempt_count": 1,
                "agent_id": self.agent_id,
                "model_used": self.model_id,
                "tokens_used": 0,
                "modelUsed": self.model_id,
                "tokensUsed": 0
            }
        except Exception as e:
            execution_time = (time.time() - start_time) * 1000
            logger.error(f"Unexpected error during question generation: {str(e)}")
            import traceback
            logger.error(f"Question generation traceback: {traceback.format_exc()}")
            return {
                "error": f"Question generation failed with unexpected error: {str(e)}. This indicates a bug in the question generation logic.",
                "execution_time": execution_time,
                "attempt_count": 1,
                "agent_id": self.agent_id,
                "error_type": "unexpected_error",
                "traceback": traceback.format_exc()
            }


async def main():
    """Main entry point for the question generation agent."""
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
        logger.info("🚀 Starting Question Generation Agent")

        # Read input from stdin
        input_data = json.loads(sys.stdin.read())
        logger.info(f"📥 Received input: {json.dumps(input_data, indent=2)}")

        # Create agent
        logger.info("🔨 Creating GenQuestionAgent...")
        agent = GenQuestionAgent()
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
            "agent_id": "gen_question_agent"
        }
        print(json.dumps(error_output, indent=2))
        sys.exit(1)

    except Exception as e:
        logger.error(f"❌ Unexpected error: {e}")
        logger.error(f"📍 Traceback: {traceback.format_exc()}")

        error_output = {
            "error": str(e),
            "type": "question_generation_error",
            "agent_id": "gen_question_agent",
            "traceback": traceback.format_exc()
        }
        print(json.dumps(error_output, indent=2))
        sys.exit(1)

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
