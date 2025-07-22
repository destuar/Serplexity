#!/usr/bin/env python3
"""
Simple test of OpenAI API for mention detection
"""

import json
import os
from pydantic_ai import Agent
from pydantic import BaseModel, Field
from typing import List, Optional

# Set API key
os.environ['OPENAI_API_KEY'] = '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'

class BrandMention(BaseModel):
    """A single brand/product mention with metadata"""
    name: str = Field(..., min_length=1, max_length=100)
    type: str = Field(..., description="'brand' or 'product'")
    confidence: float = Field(..., ge=0, le=1)
    context: str = Field(..., max_length=200)
    position: int = Field(default=0)
    category: str = Field(default="unknown")

class BrandMentions(BaseModel):
    """Collection of all brand/product mentions found in text"""
    mentions: List[BrandMention] = Field(default_factory=list)
    total_count: int = Field(default=0)
    unique_brands: int = Field(default=0)
    unique_products: int = Field(default=0)

system_prompt = """You are an expert brand intelligence analyst. Your job is to identify companies and products/services mentioned in text using CONTEXT-AWARE analysis.

KEY PRINCIPLE: Use context to determine if a word refers to a specific company/product vs. generic usage.

DETECTION RULES:
🏢 BRANDS (Companies/Organizations): Any company from any industry
📦 PRODUCTS (Products/Services/Tools): Any named product, service, software, platform, or offering

CONTEXT-AWARE ANALYSIS:
Use surrounding context to determine if a word is:
✅ COMPANY/PRODUCT: Used as a proper noun referring to a specific entity
❌ GENERIC WORD: Used as a descriptive term, adjective, or common word

CONTEXT CLUES FOR BRANDS/PRODUCTS:
- Proper noun usage: "Company X does Y", "Product X offers Z"
- Possessive: "X's platform", "X's service" 
- Usage context: "using X", "through X", "X provides"
- Institutional markers: "X Hospital", "X Corp", "X Inc"
- Product/service context: "X app", "X software", "X platform"

AVOID TAGGING GENERIC WORDS:
- Descriptive adjectives (advanced, comprehensive, virtual, specialized)
- Action verbs (seek, provide, access, find, offer)
- Industry terms (healthcare, technology, financial, retail)
- Common concepts (care, service, solution, support)

CONFIDENCE SCORING:
- 0.9+: Well-known entities with clear context
- 0.7+: Clear entity usage in context
- 0.5+: Possible entity (include with caution)
- <0.5: Don't include (likely generic word)

CRITICAL: Only tag words that CLEARLY refer to specific companies or products based on context. When in doubt, DON'T tag generic words."""

async def test_mention_detection():
    print("🧪 Testing Simple OpenAI Mention Detection")
    print("=" * 60)
    
    test_text = """Mayo Clinic offers specialized care. Johns Hopkins Hospital provides excellent service. Apple makes the iPhone. Patients seek advanced treatment options."""
    
    print(f"📝 Text: {test_text}")
    
    # Create agent
    agent = Agent(
        model='openai:gpt-4.1-mini',
        result_type=BrandMentions,
        system_prompt=system_prompt,
        temperature=0.3
    )
    
    try:
        print("\n🚀 Running detection...")
        result = await agent.run(f"ANALYZE THIS TEXT FOR BRAND MENTIONS:\n\n{test_text}\n\nFind ALL brand/company mentions in the text above.")
        
        print("\n📊 RESULTS:")
        print(f"Total mentions: {len(result.data.mentions)}")
        print(f"Unique brands: {result.data.unique_brands}")
        print(f"Unique products: {result.data.unique_products}")
        
        if result.data.mentions:
            print("\n🏷️ DETECTED MENTIONS:")
            for i, mention in enumerate(result.data.mentions, 1):
                print(f"  {i}. {mention.name} ({mention.type}) - confidence: {mention.confidence}")
                print(f"     Context: \"{mention.context}\"")
        else:
            print("\nℹ️ No mentions detected")
            
        # Check for problematic detections
        mention_names = [m.name.lower() for m in result.data.mentions]
        generic_words = ['specialized', 'advanced', 'excellent', 'seek', 'provides', 'offers']
        
        incorrectly_tagged = [word for word in generic_words if word in mention_names]
        
        if incorrectly_tagged:
            print(f"\n❌ Incorrectly tagged generic words: {', '.join(incorrectly_tagged)}")
        else:
            print("\n✅ No generic words incorrectly tagged!")
            
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    import asyncio
    asyncio.run(test_mention_detection())