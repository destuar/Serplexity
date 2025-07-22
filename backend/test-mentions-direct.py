#!/usr/bin/env python3

import sys
import os
import json
import asyncio

# Add the backend src directory to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from pydantic_agents.agents.mention_agent import MentionAgent

# Test paragraph with both real brands and generic words that could be mistaken for brands
test_text = """
For advanced surgical procedures, patients often seek specialized care at top medical institutions. 
Mayo Clinic offers comprehensive cardiac surgery programs, while Johns Hopkins Hospital provides 
cutting-edge neurosurgery services. Many patients also consider Cleveland Clinic for their 
specialized orthopedic treatments. 

Remote consultations have become more accessible through telemedicine platforms. Virtual healthcare 
services are now available through companies like Teladoc and Amwell. These platforms seek to 
provide quality care while maintaining patient privacy.

In the technology sector, Apple continues to innovate with the iPhone, while Microsoft enhances 
productivity through Office 365. Google's search capabilities and Amazon's cloud services (AWS) 
dominate their respective markets. Tesla's electric vehicles represent the future of sustainable 
transportation.

Patients should access comprehensive information about their treatment options. They need to find 
providers who offer modern, innovative solutions for their healthcare needs.
""".strip()

async def test_mention_detection():
    print("🧪 Testing Intelligent Brand Mention Detection")
    print("=" * 60)
    print("📝 Test Text:")
    print(test_text)
    print("=" * 60)
    
    # Create mention agent
    agent = MentionAgent()
    
    # Test input
    test_input = {
        'text': test_text,
        'company_name': 'Mayo Clinic',
        'competitors': ['Johns Hopkins Hospital', 'Cleveland Clinic', 'Cedars-Sinai']
    }
    
    try:
        print("🚀 Running mention detection...")
        result = await agent.execute(test_input)
        
        print("\n📊 RESULTS:")
        print("=" * 60)
        
        if result.get('error'):
            print(f"❌ Error: {result['error']}")
            return
        
        mentions = result.get('result', {}).get('mentions', [])
        if hasattr(result.get('result'), 'mentions'):
            mentions = result['result'].mentions
            # Convert to dict if needed
            if hasattr(mentions[0], 'model_dump') if mentions else False:
                mentions = [m.model_dump() for m in mentions]
        
        print(f"Total mentions found: {len(mentions)}")
        print(f"Execution time: {result.get('execution_time', 'N/A')}ms")
        print(f"Model used: {result.get('model_used', 'N/A')}")
        
        if len(mentions) == 0:
            print("ℹ️ No mentions detected")
            return
        
        print("\n🏷️ DETECTED MENTIONS:")
        print("-" * 60)
        
        # Group by type
        brands = [m for m in mentions if m.get('type') == 'brand']
        products = [m for m in mentions if m.get('type') == 'product']
        
        print(f"\n🏢 BRANDS ({len(brands)}):")
        for i, mention in enumerate(sorted(brands, key=lambda x: x.get('confidence', 0), reverse=True), 1):
            print(f"  {i}. {mention.get('name')} ({mention.get('confidence', 'N/A')}) - {mention.get('category', 'N/A')}")
            print(f"     Context: \"{mention.get('context', 'N/A')}\"")
        
        print(f"\n📦 PRODUCTS ({len(products)}):")
        for i, mention in enumerate(sorted(products, key=lambda x: x.get('confidence', 0), reverse=True), 1):
            print(f"  {i}. {mention.get('name')} ({mention.get('confidence', 'N/A')}) - {mention.get('category', 'N/A')}")
            print(f"     Context: \"{mention.get('context', 'N/A')}\"")
        
        # Analysis
        print("\n🔍 ANALYSIS:")
        print("-" * 60)
        
        expected_brands = ['Mayo Clinic', 'Johns Hopkins Hospital', 'Cleveland Clinic', 'Apple', 'Microsoft', 'Google', 'Amazon', 'Tesla', 'Teladoc', 'Amwell']
        expected_products = ['iPhone', 'Office 365', 'AWS']
        generic_words = ['advanced', 'specialized', 'comprehensive', 'remote', 'virtual', 'accessible', 'quality', 'modern', 'innovative', 'seek', 'find', 'provide', 'offers']
        
        detected_names = [m.get('name', '').lower() for m in mentions]
        
        correct_brands = []
        for brand in expected_brands:
            if any(brand.lower() in detected.lower() or detected in brand.lower() for detected in detected_names):
                correct_brands.append(brand)
        
        incorrect_generic = []
        for word in generic_words:
            if any(word.lower() == detected.lower() for detected in detected_names):
                incorrect_generic.append(word)
        
        print(f"✅ Correctly identified brands: {', '.join(correct_brands) if correct_brands else 'None'}")
        print(f"❌ Incorrectly tagged generic words: {', '.join(incorrect_generic) if incorrect_generic else 'None'}")
        
        if expected_brands:
            accuracy = len(correct_brands) / len(expected_brands) * 100
            print(f"📈 Brand detection accuracy: {accuracy:.1f}%")
        
        if len(incorrect_generic) == 0:
            print("🎯 Perfect! No generic words were incorrectly tagged as brands.")
        else:
            print("⚠️ Some generic words were incorrectly tagged as brands.")
            
    except Exception as e:
        print(f"❌ Test failed: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_mention_detection())