#!/usr/bin/env python3
"""
Test script for the Intelligent Fanout Agent

This script tests the new intelligent fanout query generation with
different company profiles and benchmark questions to validate:
- Strategic query type selection (3-5 types)
- Quality of generated queries
- Appropriate rationale for selections
- Diverse query coverage
"""

import asyncio
import json
import subprocess
import sys
import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv(Path(__file__).parent.parent.parent / '.env')

# Test cases with different scenarios
TEST_CASES = [
    {
        "name": "Communication Software - Slack",
        "input": {
            "company_name": "Slack",
            "industry": "Communication Software",
            "base_question": "What are the best team communication tools for remote work?",
            "context": "Enterprise messaging platform with channels and integrations",
            "competitors": ["Microsoft Teams", "Discord", "Zoom Chat", "Google Chat"]
        },
        "expected_types": ["paraphrase", "comparison", "temporal", "user_profile"],
        "expected_count": 4
    },
    {
        "name": "Project Management - Asana",
        "input": {
            "company_name": "Asana",
            "industry": "Project Management Software",
            "base_question": "Which project management tool is best for agile development teams?",
            "context": "Work management platform with task tracking and team collaboration",
            "competitors": ["Jira", "Trello", "Monday.com", "Linear"]
        },
        "expected_types": ["paraphrase", "comparison", "topical", "entity_narrower"],
        "expected_count": 4
    },
    {
        "name": "CRM Software - HubSpot",
        "input": {
            "company_name": "HubSpot",
            "industry": "Customer Relationship Management",
            "base_question": "What's the best CRM for small businesses?", 
            "context": "All-in-one CRM, marketing, and sales platform",
            "competitors": ["Salesforce", "Pipedrive", "Zoho CRM", "Freshworks"]
        },
        "expected_types": ["paraphrase", "comparison", "user_profile", "temporal"],
        "expected_count": 4
    },
    {
        "name": "Healthcare Tech - Teladoc",
        "input": {
            "company_name": "Teladoc",
            "industry": "Healthcare Technology",
            "base_question": "What are the best telemedicine platforms?",
            "context": "Virtual healthcare platform for remote consultations",
            "competitors": ["Amwell", "MDLive", "Doctor on Demand", "Doxy.me"]
        },
        "expected_types": ["paraphrase", "comparison", "safety_probe", "temporal"],
        "expected_count": 4
    },
    {
        "name": "E-commerce - Shopify",
        "input": {
            "company_name": "Shopify",
            "industry": "E-commerce Platform",
            "base_question": "Which e-commerce platform is easiest for beginners?",
            "context": "Complete e-commerce solution for online stores",
            "competitors": ["WooCommerce", "BigCommerce", "Squarespace", "Wix"]
        },
        "expected_types": ["paraphrase", "comparison", "user_profile", "vertical"],
        "expected_count": 4
    }
]

async def run_fanout_test(test_case):
    """Run a single fanout test case"""
    print(f"\n🧪 Testing: {test_case['name']}")
    print(f"📝 Base Question: {test_case['input']['base_question']}")
    
    try:
        # Run the fanout agent
        process = subprocess.run([
            sys.executable, 
            "/Users/diegoestuar/Desktop/Serplexity/backend/src/pydantic_agents/agents/fanout_agent.py"
        ], 
        input=json.dumps(test_case['input']), 
        text=True, 
        capture_output=True, 
        timeout=60
        )
        
        if process.returncode != 0:
            print(f"❌ Agent failed with return code {process.returncode}")
            print(f"❌ stderr: {process.stderr}")
            return False
        
        # Parse the result
        try:
            result = json.loads(process.stdout)
        except json.JSONDecodeError as e:
            print(f"❌ Failed to parse agent output as JSON: {e}")
            print(f"Raw output: {process.stdout}")
            return False
        
        # Check for errors in result
        if 'error' in result:
            print(f"❌ Agent returned error: {result['error']}")
            return False
        
        if 'result' not in result:
            print(f"❌ No result field in agent output")
            return False
        
        data = result['result']
        
        # Validate the result structure
        required_fields = ['companyName', 'industry', 'baseQuestion', 'selectedQueryTypes', 'queries', 'totalQueries']
        for field in required_fields:
            if field not in data:
                print(f"❌ Missing required field: {field}")
                return False
        
        # Validate query count (3-5)
        query_count = len(data['queries'])
        if query_count < 3 or query_count > 5:
            print(f"❌ Invalid query count: {query_count} (expected 3-5)")
            return False
        
        # Validate selectedQueryTypes count matches queries count
        selection_count = len(data['selectedQueryTypes'])
        if selection_count != query_count:
            print(f"❌ Mismatched counts: {selection_count} selections vs {query_count} queries")
            return False
        
        # Validate no duplicate query types
        selected_types = [sel['query_type'] for sel in data['selectedQueryTypes']]
        if len(set(selected_types)) != len(selected_types):
            print(f"❌ Duplicate query types detected: {selected_types}")
            return False
        
        # Validate each query matches its selection type
        for i, query in enumerate(data['queries']):
            expected_type = data['selectedQueryTypes'][i]['query_type']
            if query['type'] != expected_type:
                print(f"❌ Query {i} type mismatch: got {query['type']}, expected {expected_type}")
                return False
        
        # Validate rationale quality
        for i, selection in enumerate(data['selectedQueryTypes']):
            rationale = selection['rationale']
            if len(rationale.split()) < 5:
                print(f"❌ Selection {i} rationale too brief: {rationale}")
                return False
        
        # Validate purchase intent is assigned
        valid_intents = ['awareness', 'consideration', 'purchase']
        for i, query in enumerate(data['queries']):
            if 'intent' not in query or query['intent'] not in valid_intents:
                print(f"❌ Query {i} missing valid purchase intent: {query.get('intent', 'missing')}")
                return False
        
        # Success - print analysis
        print(f"✅ Generated {query_count} strategic queries")
        print(f"📊 Selected Query Types:")
        for i, selection in enumerate(data['selectedQueryTypes']):
            query_type = selection['query_type']
            priority = selection['priority']
            rationale = selection['rationale'][:80] + "..." if len(selection['rationale']) > 80 else selection['rationale']
            print(f"   {i+1}. {query_type.upper()} (P{priority}): {rationale}")
        
        print(f"🎯 Generated Queries:")
        for i, query in enumerate(data['queries']):
            query_text = query['query']
            intent = query['intent']
            query_type = query['type']
            print(f"   {i+1}. [{query_type.upper()}] \"{query_text}\" → Intent: {intent}")
        
        return True
        
    except subprocess.TimeoutExpired:
        print(f"❌ Test timed out after 60 seconds")
        return False
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return False

async def main():
    """Run all fanout agent tests"""
    print("🧠 Testing Intelligent Fanout Query Generation Agent")
    print("=" * 60)
    
    results = []
    
    for test_case in TEST_CASES:
        success = await run_fanout_test(test_case)
        results.append({
            'name': test_case['name'],
            'success': success
        })
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 Test Results Summary:")
    
    successful = sum(1 for r in results if r['success'])
    total = len(results)
    
    for result in results:
        status = "✅ PASS" if result['success'] else "❌ FAIL"
        print(f"   {status} - {result['name']}")
    
    print(f"\n🎯 Overall: {successful}/{total} tests passed")
    
    if successful == total:
        print("🎉 All tests passed! Intelligent Fanout Agent is working correctly.")
        return 0
    else:
        print(f"⚠️  {total - successful} test(s) failed. Please review the agent implementation.")
        return 1

if __name__ == "__main__":
    sys.exit(asyncio.run(main()))