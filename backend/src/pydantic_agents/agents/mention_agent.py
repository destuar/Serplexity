#!/usr/bin/env python3
"""
Brand Mention Detection Agent for PydanticAI
Uses NLP and LLM intelligence to detect ALL brand/company mentions in natural text.
Designed to catch brands that aren't in any predefined list.
"""

import json
import sys
import os
import logging
import re
from typing import Optional, List, Dict, Any

from pydantic import BaseModel, Field
from ..base_agent import BaseAgent
from ..config.models import get_default_model_for_task, ModelTask
from pydantic_ai import Agent

# Set up logging
logger = logging.getLogger(__name__)

class BrandMention(BaseModel):
    """A single brand/product mention with metadata"""
    name: str = Field(..., min_length=1, max_length=100, description="Brand/company/product name")
    type: str = Field(..., description="Type: 'brand' for companies, 'product' for products/services")
    confidence: float = Field(..., ge=0, le=1, description="Confidence this is a real brand/product (0-1)")
    context: str = Field(..., max_length=200, description="Surrounding context where mention appears")
    position: int = Field(..., ge=0, description="Character position in original text")
    category: Optional[str] = Field(None, description="Category (tech, retail, saas, etc.)")

class BrandMentions(BaseModel):
    """Collection of all brand/product mentions found in text"""
    mentions: List[BrandMention] = Field(default_factory=list, description="All detected mentions")
    total_count: int = Field(..., ge=0, description="Total number of mentions found")
    unique_brands: int = Field(..., ge=0, description="Number of unique brands mentioned")
    unique_products: int = Field(..., ge=0, description="Number of unique products mentioned")

class TextInput(BaseModel):
    """Input text for brand mention detection"""
    text: str = Field(..., min_length=1, description="Text to analyze for brand mentions")
    context: Optional[str] = Field(None, description="Additional context about the text")

class MentionAgent(BaseAgent):

    def __init__(self):
        """Initialize with centralized model configuration for mention detection"""
        # Use centralized configuration instead of hardcoded model
        default_model_config = get_default_model_for_task(ModelTask.MENTION_DETECTION)
        default_model = default_model_config.get_pydantic_model_id() if default_model_config else "openai:gpt-4.1-mini"
        
        super().__init__(
            agent_id="mention_detection_agent",
            default_model=default_model,
            system_prompt=self._build_system_prompt(),
            temperature=0.3,
            timeout=30000,
            max_retries=2
        )

    def _build_system_prompt(self) -> str:
        """Build comprehensive system prompt for brand mention detection"""
        return """You are an expert brand intelligence analyst. Your job is to identify companies and products/services mentioned in text using PRECISE CONTEXT-AWARE analysis.

CORE PRINCIPLE: Only tag words when they CLEARLY refer to specific companies/products based on surrounding context.

DETECTION RULES:
🏢 BRANDS: Specific companies, organizations, institutions (Target, Apple, Shell Oil)
📦 PRODUCTS: Named products, services, software, platforms (iPhone, Slack, AWS)

STRICT CONTEXT ANALYSIS:
✅ TAG when word is used as PROPER NOUN referring to specific entity:
- Company actions: "Target announced", "Apple released", "Shell reported"
- Possessive references: "Apple's iPhone", "Microsoft's Office", "Google's platform" 
- Service contexts: "using Slack", "through Zoom", "via PayPal"
- Institutional references: "Mayo Clinic offers", "JP Morgan provides"
- Clear brand/product context: "Stripe processes payments", "Netflix streams content"

❌ DO NOT TAG when word is used generically:
- Descriptive usage: "customers target deals", "apple harvest", "shell scripts"
- Action verbs: "we seek solutions", "they discover opportunities", "users scale operations"
- Adjectives: "advanced features", "smart solutions", "progressive policies"
- Generic references: "the company aims", "universal healthcare", "general guidelines"

AMBIGUITY RESOLUTION:
For words that can be both brands AND generic terms (Target/target, Apple/apple, Scale/scale):
- ONLY tag if context clearly indicates the SPECIFIC COMPANY/PRODUCT
- Example: "Target stores" ✅ vs "target audience" ❌
- Example: "Apple iPhone" ✅ vs "apple juice" ❌
- Example: "Slack messaging" ✅ vs "work can slack" ❌

HIGH-PRECISION INDICATORS:
- Corporate suffixes: "Inc", "Corp", "LLC", "Ltd"
- Proper capitalization in business context
- Brand-specific products/services mentioned together
- Industry-specific usage patterns
- Clear subject-verb-object relationships with entities

CONFIDENCE SCORING:
- 0.95+: Unambiguous brand/product references with clear context
- 0.85+: Clear entity usage with supporting context
- 0.75+: Likely entity with reasonable context
- <0.75: Don't include (ambiguous or generic)

CRITICAL EDGE CASES:
- Multi-word brands: "American Express", "Goldman Sachs", "JP Morgan"
- Action verbs as brands: Only tag "Zoom" if clearly the video platform, not the action
- Geographic terms: Only tag if clearly referring to the specific company
- Common words: Be extremely cautious with words like "target", "discover", "chase"

OUTPUT FORMAT (JSON only):
{
  "mentions": [
    {
      "name": "exact name as it appears",
      "type": "brand|product", 
      "confidence": 0.95,
      "context": "precise context showing proper noun usage",
      "position": character_position,
      "category": "industry"
    }
  ],
  "total_count": 0,
  "unique_brands": 0,
  "unique_products": 0
}

FINAL RULE: When in doubt between generic word vs. brand name, ALWAYS choose generic (don't tag). Precision over recall."""
    
    def get_output_type(self):
        return BrandMentions
    
    async def process_input(self, input_data: dict) -> str:
        """Process text for brand mention detection"""
        text = input_data.get('text', '')
        company_name = input_data.get('company_name', '')
        competitors = input_data.get('competitors', [])
        
        # Build context for the LLM
        context_parts = [f"ANALYZE THIS TEXT FOR BRAND MENTIONS:\n\n{text}"]
        
        # Add company context to help with competitor detection
        if company_name:
            context_parts.append(f"\nCOMPANY CONTEXT: The target company is '{company_name}'.")
            
        if competitors:
            competitor_list = "', '".join(competitors)
            context_parts.append(f"Known competitors include: '{competitor_list}'.")
            
        context_parts.append(f"\nFind ALL brand/company mentions in the text above. Include obvious ones and subtle ones.")
        
        return "\n".join(context_parts)
    
    def _fallback_regex_detection(self, text: str, company_name: str = None, competitors: List[str] = None) -> BrandMentions:
        """Fallback regex-based brand/product detection if LLM fails"""
        mentions = []
        
        # Common brand/product patterns
        patterns = [
            # Capitalized words that could be brands (basic heuristic)
            r'\b[A-Z][a-z]+(?:[A-Z][a-z]*)*\b',  # CamelCase or TitleCase
            # Known corporate suffixes
            r'\b[A-Z][a-zA-Z\s]+(?:Inc\.?|LLC\.?|Corp\.?|Ltd\.?|Co\.?)\b',
            # .com domains as brands
            r'\b[A-Za-z0-9-]+\.com\b',
        ]
        
        # Known high-confidence brands and products with types
        known_entities = {
            # Companies (brands)
            'Apple': {'confidence': 0.95, 'type': 'brand'}, 
            'Microsoft': {'confidence': 0.95, 'type': 'brand'}, 
            'Google': {'confidence': 0.95, 'type': 'brand'}, 
            'Amazon': {'confidence': 0.95, 'type': 'brand'}, 
            'Meta': {'confidence': 0.95, 'type': 'brand'},
            'Tesla': {'confidence': 0.95, 'type': 'brand'}, 
            'Adobe': {'confidence': 0.95, 'type': 'brand'},
            'Salesforce': {'confidence': 0.95, 'type': 'brand'},
            
            # Products/Services
            'iPhone': {'confidence': 0.95, 'type': 'product'}, 
            'Excel': {'confidence': 0.9, 'type': 'product'}, 
            'Photoshop': {'confidence': 0.95, 'type': 'product'},
            'Instagram': {'confidence': 0.95, 'type': 'product'}, 
            'WhatsApp': {'confidence': 0.95, 'type': 'product'},
            'Slack': {'confidence': 0.9, 'type': 'product'}, 
            'Zoom': {'confidence': 0.9, 'type': 'product'}, 
            'Notion': {'confidence': 0.9, 'type': 'product'}, 
            'Figma': {'confidence': 0.9, 'type': 'product'}, 
            'Asana': {'confidence': 0.9, 'type': 'product'},
            'Netflix': {'confidence': 0.95, 'type': 'product'}, 
            'Uber': {'confidence': 0.95, 'type': 'product'}, 
            'Airbnb': {'confidence': 0.95, 'type': 'product'},
            'Spotify': {'confidence': 0.95, 'type': 'product'},
            'HubSpot': {'confidence': 0.85, 'type': 'product'}, 
            'Dropbox': {'confidence': 0.9, 'type': 'product'}
        }
        
        # Add target company and competitors as brands
        if company_name:
            known_entities[company_name] = {'confidence': 0.95, 'type': 'brand'}
        if competitors:
            for comp in competitors:
                known_entities[comp] = {'confidence': 0.9, 'type': 'brand'}
        
        # Find mentions using patterns and known entities
        found_entities = set()
        brands_count = 0
        products_count = 0
        
        for pattern in patterns:
            matches = re.finditer(pattern, text)
            for match in matches:
                potential_entity = match.group().strip()
                
                # Skip common false positives
                if potential_entity.lower() in ['The', 'This', 'That', 'With', 'From', 'Your', 'Our', 'More', 'Most', 'Best', 'New', 'Old']:
                    continue
                
                if len(potential_entity) < 2 or len(potential_entity) > 50:
                    continue
                
                # Determine confidence and type
                if potential_entity in known_entities:
                    confidence = known_entities[potential_entity]['confidence']
                    entity_type = known_entities[potential_entity]['type']
                else:
                    confidence = 0.6  # Default medium confidence
                    entity_type = 'brand'  # Default to brand for unknown entities
                
                # Boost confidence for certain patterns
                if potential_entity.endswith('.com'):
                    confidence = min(0.8, confidence + 0.2)
                if any(suffix in potential_entity for suffix in ['Inc', 'LLC', 'Corp', 'Ltd', 'Co']):
                    confidence = min(0.85, confidence + 0.15)
                    entity_type = 'brand'  # Corporate suffixes are always brands
                
                # Get context
                start_pos = max(0, match.start() - 50)
                end_pos = min(len(text), match.end() + 50)
                context = text[start_pos:end_pos].replace('\n', ' ').strip()
                
                if potential_entity not in found_entities and confidence >= 0.5:
                    found_entities.add(potential_entity)
                    mentions.append(BrandMention(
                        name=potential_entity,
                        type=entity_type,
                        confidence=confidence,
                        context=context,
                        position=match.start(),
                        category="unknown"
                    ))
                    
                    if entity_type == 'brand':
                        brands_count += 1
                    else:
                        products_count += 1
        
        # Sort by confidence
        mentions.sort(key=lambda x: x.confidence, reverse=True)
        
        return BrandMentions(
            mentions=mentions,
            total_count=len(mentions),
            unique_brands=brands_count,
            unique_products=products_count
        )
    
    async def execute(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Execute brand mention detection with intelligent LLM only"""
        import time
        start_time = time.time()
        
        try:
            # Use LLM-based detection only
            result = await super().execute(input_data)
            
            # Process result regardless of mention count (LLM may correctly find zero mentions)
            if 'result' in result and hasattr(result['result'], 'mentions'):
                execution_time = (time.time() - start_time) * 1000
                
                # Count unique brands and products from LLM result
                mentions = result['result'].mentions
                unique_brands = len([m for m in mentions if m.type == 'brand'])
                unique_products = len([m for m in mentions if m.type == 'product'])
                
                # Update the counts in the result
                result['result'].unique_brands = unique_brands
                result['result'].unique_products = unique_products
                result['result'].total_count = len(mentions)
                
                logger.info(f"✅ LLM detected {len(mentions)} mentions ({unique_brands} brands, {unique_products} products)")
                return result
            else:
                logger.error("❌ LLM returned invalid result format")
                raise Exception("LLM returned invalid result format")
                
        except Exception as e:
            execution_time = (time.time() - start_time) * 1000
            logger.error(f"❌ LLM brand detection failed: {str(e)}")
            
            # Return error instead of fallback
            return {
                "error": f"Brand detection failed: {str(e)}",
                "execution_time": execution_time,
                "attempt_count": 1,
                "agent_id": self.agent_id,
                "model_used": None,
                "tokens_used": 0,
                "fallback_used": False
            }
    
    def tag_brands_in_text(self, text: str, mentions: List[BrandMention], min_confidence: float = 0.5) -> str:
        """Tag detected brands/products in text with appropriate tags using robust name-based matching"""
        import re
        
        tagged_text = text
        tagged_entities = set()  # Avoid duplicate tagging
        
        # Sort mentions by length (longer first) to avoid partial matches
        sorted_mentions = sorted(mentions, key=lambda x: len(x.name), reverse=True)
        
        for mention in sorted_mentions:
            if mention.confidence >= min_confidence and mention.name not in tagged_entities:
                # Choose tag type based on mention type
                if mention.type == 'brand':
                    tag_start = '<brand>'
                    tag_end = '</brand>'
                else:  # product
                    tag_start = '<product>'
                    tag_end = '</product>'
                
                # Use regex to find and replace all instances of the brand name
                # Word boundaries ensure we don't match partial words
                # Case-insensitive matching with preserved original case
                def replace_match(match):
                    original_text = match.group(0)
                    return f'{tag_start}{original_text}{tag_end}'
                
                # Create regex pattern with word boundaries for exact matching
                # Escape special regex characters in brand name
                escaped_name = re.escape(mention.name)
                pattern = r'\b' + escaped_name + r'\b'
                
                # Replace all instances (case-insensitive)
                new_tagged_text = re.sub(pattern, replace_match, tagged_text, flags=re.IGNORECASE)
                
                # Only mark as tagged if we actually made replacements
                if new_tagged_text != tagged_text:
                    tagged_text = new_tagged_text
                    tagged_entities.add(mention.name)
        
        return tagged_text

async def main():
    """Main entry point for the mention detection agent."""
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
        logger.info("🔍 Starting Brand Mention Detection Agent")
        
        # Read input from stdin
        input_data = json.loads(sys.stdin.read())
        logger.info(f"📥 Received input: {json.dumps(input_data, indent=2)}")
        
        # Create agent
        logger.info("🔨 Creating MentionAgent...")
        agent = MentionAgent()
        logger.info(f"✅ Agent created with model: {agent.model_id}")
        
        # Execute the agent
        logger.info("🚀 Executing brand detection...")
        result = await agent.execute(input_data)
        logger.info("✅ Brand detection completed")
        
        # Log analysis of the result
        if 'result' in result and isinstance(result['result'], BrandMentions):
            mentions = result['result'].mentions
            high_conf = len([m for m in mentions if m.confidence >= 0.8])
            medium_conf = len([m for m in mentions if 0.6 <= m.confidence < 0.8])
            
            logger.info(f"🎯 Brand detection analysis:")
            logger.info(f"   - Total mentions: {len(mentions)}")
            logger.info(f"   - High confidence (≥0.8): {high_conf}")
            logger.info(f"   - Medium confidence (0.6-0.8): {medium_conf}")
            logger.info(f"   - Unique brands: {result['result'].unique_brands}")
            
            # Show top brands detected
            top_brands = [m.name for m in sorted(mentions, key=lambda x: x.confidence, reverse=True)[:5]]
            logger.info(f"   - Top brands: {', '.join(top_brands)}")
        
        # Convert result to JSON-serializable format
        if 'result' in result and hasattr(result['result'], 'model_dump'):
            result['result'] = result['result'].model_dump()
        
        # Output result
        print(json.dumps(result, indent=2, default=str))
        logger.info("✅ Brand mentions sent successfully")
        
    except json.JSONDecodeError as e:
        logger.error(f"❌ JSON decode error: {e}")
        error_output = {
            "error": f"Invalid JSON input: {str(e)}",
            "type": "json_decode_error",
            "agent_id": "mention_agent"
        }
        print(json.dumps(error_output, indent=2))
        sys.exit(1)
        
    except Exception as e:
        logger.error(f"❌ Unexpected error: {e}")
        logger.error(f"📍 Traceback: {traceback.format_exc()}")
        
        error_output = {
            "error": str(e),
            "type": "brand_mention_error",
            "agent_id": "mention_agent",
            "traceback": traceback.format_exc()
        }
        print(json.dumps(error_output, indent=2))
        sys.exit(1)

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())