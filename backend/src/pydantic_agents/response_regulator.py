#!/usr/bin/env python3
"""
Response Regulation Agent

This agent provides comprehensive response regulation and quality control for
PydanticAI outputs, ensuring all responses meet quality, safety, and business
standards before being returned to users.

Key Features:
- Content quality assessment
- Safety and compliance verification
- Brand alignment checking
- Performance impact evaluation
- Automatic response improvement suggestions

Usage:
    python response_regulator.py < input.json
    
Input Format:
    {
        "content": "Response content to evaluate",
        "context": {
            "company_name": "Apple Inc.",
            "industry": "Technology",
            "operation": "sentiment_analysis",
            "target_audience": "developers"
        },
        "criteria": {
            "min_quality_score": 0.8,
            "check_safety": true,
            "check_brand_alignment": true,
            "check_accuracy": true
        }
    }

Output Format:
    {
        "data": {
            "approved": true,
            "qualityScore": 0.92,
            "safetyScore": 0.98,
            "brandAlignmentScore": 0.87,
            "accuracyScore": 0.91,
            "issues": [],
            "suggestions": [...]
        },
        "metadata": {...}
    }
"""

import asyncio
import json
import sys
from typing import Dict, Any, Type, List, Optional

from .base_agent import BaseAgent
from .schemas import AgentExecutionMetadata
from pydantic import BaseModel, Field, validator

class ResponseIssue(BaseModel):
    """
    Represents an issue found in the response.
    
    Attributes:
        category: Category of the issue (quality, safety, brand, accuracy)
        severity: Severity level (low, medium, high, critical)
        description: Human-readable description of the issue
        location: Location in the response where the issue was found
        suggestion: Suggested fix for the issue
    """
    category: str = Field(..., description="Category of the issue")
    severity: str = Field(..., description="Severity level")
    description: str = Field(..., description="Description of the issue")
    location: Optional[str] = Field(None, description="Location of the issue")
    suggestion: str = Field(..., description="Suggested fix")

class ResponseSuggestion(BaseModel):
    """
    Represents a suggestion for improving the response.
    
    Attributes:
        type: Type of suggestion (improvement, enhancement, optimization)
        description: Description of the suggestion
        impact: Expected impact of implementing the suggestion
        priority: Priority level (low, medium, high)
    """
    type: str = Field(..., description="Type of suggestion")
    description: str = Field(..., description="Description of the suggestion")
    impact: str = Field(..., description="Expected impact")
    priority: str = Field(..., description="Priority level")

class ResponseRegulation(BaseModel):
    """
    Response regulation result.
    
    Attributes:
        approved: Whether the response is approved for use
        qualityScore: Overall quality score (0-1)
        safetyScore: Safety score (0-1)
        brandAlignmentScore: Brand alignment score (0-1)
        accuracyScore: Accuracy score (0-1)
        overallScore: Overall combined score (0-1)
        issues: List of issues found
        suggestions: List of improvement suggestions
        processingTime: Time taken to process the response
        regulationTimestamp: When the regulation was performed
    """
    approved: bool = Field(..., description="Whether the response is approved")
    qualityScore: float = Field(..., ge=0.0, le=1.0, description="Quality score")
    safetyScore: float = Field(..., ge=0.0, le=1.0, description="Safety score")
    brandAlignmentScore: float = Field(..., ge=0.0, le=1.0, description="Brand alignment score")
    accuracyScore: float = Field(..., ge=0.0, le=1.0, description="Accuracy score")
    overallScore: float = Field(..., ge=0.0, le=1.0, description="Overall score")
    issues: List[ResponseIssue] = Field(default=[], description="Issues found")
    suggestions: List[ResponseSuggestion] = Field(default=[], description="Improvement suggestions")
    processingTime: int = Field(..., ge=0, description="Processing time in milliseconds")
    regulationTimestamp: str = Field(..., description="When regulation was performed")

    @validator('overallScore')
    def calculate_overall_score(cls, v, values):
        """Calculate overall score from individual scores"""
        if 'qualityScore' in values and 'safetyScore' in values and 'brandAlignmentScore' in values and 'accuracyScore' in values:
            # Weighted average with safety being most important
            return (
                values['qualityScore'] * 0.3 +
                values['safetyScore'] * 0.4 +
                values['brandAlignmentScore'] * 0.2 +
                values['accuracyScore'] * 0.1
            )
        return v

class ResponseRegulatorAgent(BaseAgent):
    """
    PydanticAI agent for response regulation and quality control.
    
    This agent evaluates responses across multiple dimensions:
    - Content quality and coherence
    - Safety and compliance
    - Brand alignment and messaging
    - Accuracy and factual correctness
    - Performance and efficiency
    """
    
    def __init__(self):
        super().__init__(
            agent_id="response_regulator",
            default_model="openai:gpt-4o",
            system_prompt=self._build_system_prompt(),
            temperature=0.1,  # Very low temperature for consistent evaluation
            max_tokens=1000,
            timeout=30000,
            max_retries=3
        )
    
    def _build_system_prompt(self) -> str:
        """Build comprehensive system prompt for response regulation"""
        return """You are a professional response quality control expert specializing in AI-generated content evaluation.

Your task is to evaluate AI-generated responses across multiple dimensions and provide comprehensive feedback on their quality, safety, and appropriateness.

EVALUATION DIMENSIONS:

1. QUALITY SCORE (0.0-1.0):
   - Content coherence and clarity
   - Grammatical correctness
   - Completeness of response
   - Relevance to the query
   - Professional tone and style

2. SAFETY SCORE (0.0-1.0):
   - Absence of harmful content
   - Compliance with content policies
   - Appropriateness for target audience
   - Avoidance of sensitive topics
   - Ethical considerations

3. BRAND ALIGNMENT SCORE (0.0-1.0):
   - Consistency with brand voice
   - Appropriate messaging and tone
   - Alignment with company values
   - Professional representation
   - Industry-appropriate language

4. ACCURACY SCORE (0.0-1.0):
   - Factual correctness
   - Source reliability
   - Absence of misleading information
   - Appropriate disclaimers
   - Evidence-based claims

EVALUATION CRITERIA:

EXCELLENT (0.9-1.0):
- Exceptional quality across all dimensions
- No significant issues identified
- Exceeds expectations
- Ready for immediate use

GOOD (0.7-0.89):
- High quality with minor issues
- Meets most requirements
- May need minor adjustments
- Generally acceptable

ACCEPTABLE (0.5-0.69):
- Average quality with some issues
- Meets basic requirements
- Needs improvement in some areas
- Usable with modifications

POOR (0.3-0.49):
- Below average quality
- Multiple issues identified
- Requires significant improvements
- Not recommended for use

UNACCEPTABLE (0.0-0.29):
- Very poor quality
- Critical issues identified
- Unsuitable for use
- Requires complete revision

ISSUE CATEGORIES:
- QUALITY: Grammar, clarity, completeness, relevance
- SAFETY: Harmful content, policy violations, inappropriate material
- BRAND: Off-brand messaging, tone inconsistency, unprofessional content
- ACCURACY: Factual errors, misleading information, unsupported claims

SUGGESTION TYPES:
- IMPROVEMENT: Specific content modifications
- ENHANCEMENT: Additional value-adding elements
- OPTIMIZATION: Performance and efficiency improvements

Your response must be in the exact JSON format specified by the ResponseRegulation schema."""
    
    def get_result_type(self) -> Type[ResponseRegulation]:
        """Return the result type for this agent"""
        return ResponseRegulation
    
    async def process_input(self, input_data: Dict[str, Any]) -> str:
        """Process input data and create regulation prompt"""
        content = input_data.get('content', '')
        context = input_data.get('context', {})
        criteria = input_data.get('criteria', {})
        
        if not content:
            raise ValueError("content is required")
        
        company_name = context.get('company_name', 'the company')
        industry = context.get('industry', 'general')
        operation = context.get('operation', 'unknown')
        target_audience = context.get('target_audience', 'general audience')
        
        min_quality_score = criteria.get('min_quality_score', 0.7)
        check_safety = criteria.get('check_safety', True)
        check_brand_alignment = criteria.get('check_brand_alignment', True)
        check_accuracy = criteria.get('check_accuracy', True)
        
        # Build regulation prompt
        prompt = f"""Evaluate the following AI-generated response for quality, safety, brand alignment, and accuracy.

CONTEXT:
Company: {company_name}
Industry: {industry}
Operation: {operation}
Target Audience: {target_audience}

EVALUATION CRITERIA:
Minimum Quality Score: {min_quality_score}
Check Safety: {check_safety}
Check Brand Alignment: {check_brand_alignment}
Check Accuracy: {check_accuracy}

CONTENT TO EVALUATE:
{content}

EVALUATION REQUIREMENTS:
1. Assess the content across all four dimensions (quality, safety, brand alignment, accuracy)
2. Provide scores between 0.0 and 1.0 for each dimension
3. Identify any issues found, categorizing them by type and severity
4. Provide specific suggestions for improvement
5. Make an approval decision based on the evaluation

SPECIFIC FOCUS AREAS:
- Is the content appropriate for {target_audience}?
- Does it align with {company_name}'s brand in the {industry} industry?
- Are there any factual errors or misleading statements?
- Is the tone and style appropriate for the context?
- Does it meet the minimum quality threshold of {min_quality_score}?

Please provide a comprehensive evaluation following the ResponseRegulation schema format."""
        
        return prompt
    
    def _validate_regulation_result(self, result: ResponseRegulation) -> bool:
        """Validate the regulation result quality"""
        # Check that all scores are reasonable
        if not (0.0 <= result.qualityScore <= 1.0):
            return False
        if not (0.0 <= result.safetyScore <= 1.0):
            return False
        if not (0.0 <= result.brandAlignmentScore <= 1.0):
            return False
        if not (0.0 <= result.accuracyScore <= 1.0):
            return False
        
        # Check approval logic
        if result.approved and result.overallScore < 0.5:
            return False
        if not result.approved and result.overallScore > 0.8:
            return False
        
        # Check that critical issues result in disapproval
        critical_issues = [issue for issue in result.issues if issue.severity == 'critical']
        if critical_issues and result.approved:
            return False
        
        return True
    
    async def _post_process_result(self, result: ResponseRegulation, input_data: Dict[str, Any]) -> ResponseRegulation:
        """Post-process the regulation result"""
        import time
        
        # Validate result quality
        if not self._validate_regulation_result(result):
            raise ValueError("Regulation result failed validation checks")
        
        # Set processing time and timestamp
        result.processingTime = int(time.time() * 1000)
        result.regulationTimestamp = time.strftime('%Y-%m-%dT%H:%M:%SZ')
        
        # Ensure approval logic is consistent
        criteria = input_data.get('criteria', {})
        min_quality_score = criteria.get('min_quality_score', 0.7)
        
        # Override approval if scores are too low
        if result.overallScore < min_quality_score:
            result.approved = False
            
            # Add issue if not already present
            if not any(issue.category == 'quality' and 'minimum threshold' in issue.description.lower() for issue in result.issues):
                result.issues.append(ResponseIssue(
                    category='quality',
                    severity='high',
                    description=f'Overall score {result.overallScore:.2f} below minimum threshold {min_quality_score}',
                    suggestion='Improve content quality across all dimensions to meet minimum standards'
                ))
        
        # Add default suggestions if approved but could be improved
        if result.approved and result.overallScore < 0.9:
            if not result.suggestions:
                result.suggestions.append(ResponseSuggestion(
                    type='improvement',
                    description='Content meets approval criteria but could be enhanced for better performance',
                    impact='Minor improvement in user experience and engagement',
                    priority='low'
                ))
        
        return result

async def main():
    """Main function for running the response regulation agent"""
    try:
        # Read input from stdin
        input_data = json.loads(sys.stdin.read())
        
        # Create and execute agent
        agent = ResponseRegulatorAgent()
        result = await agent.execute(input_data)
        
        # Output result
        print(json.dumps(result))
        
    except Exception as e:
        # Output error in consistent format
        error_result = {
            "error": str(e),
            "agent_id": "response_regulator",
            "execution_time": 0,
            "attempt_count": 0
        }
        print(json.dumps(error_result))
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())