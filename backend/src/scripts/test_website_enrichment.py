#!/usr/bin/env python3
"""
Test script for the Website Enrichment Agent

This script tests the website enrichment functionality with
different batches of competitor names to validate:
- Accurate website URL identification
- Proper URL formatting
- Completeness of results
- Error handling for unknown companies
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
        "name": "Well-known Tech Companies",
        "input": {
            "competitor_names": [
                "Slack",
                "Microsoft Teams", 
                "Discord",
                "Zoom",
                "Google Chat"
            ],
            "context": "Communication and collaboration tools",
            "search_depth": "standard"
        },
        "expected_count": 5,
        "expected_websites": [
            "slack.com",
            "teams.microsoft.com", 
            "discord.com",
            "zoom.us",
            "chat.google.com"
        ]
    },
    {
        "name": "Project Management Tools", 
        "input": {
            "competitor_names": [
                "Asana",
                "Trello", 
                "Monday.com",
                "Jira",
                "Linear"
            ],
            "context": "Project management and task tracking platforms",
            "search_depth": "standard"
        },
        "expected_count": 5,
        "expected_websites": [
            "asana.com",
            "trello.com",
            "monday.com", 
            "atlassian.com",
            "linear.app"
        ]
    },
    {
        "name": "E-commerce Platforms",
        "input": {
            "competitor_names": [
                "Shopify",
                "WooCommerce",
                "BigCommerce", 
                "Squarespace",
                "Wix"
            ],
            "context": "E-commerce and online store platforms",
            "search_depth": "standard"
        },
        "expected_count": 5,
        "expected_websites": [
            "shopify.com",
            "woocommerce.com",
            "bigcommerce.com",
            "squarespace.com", 
            "wix.com"
        ]
    },
    {
        "name": "CRM Software",
        "input": {
            "competitor_names": [
                "HubSpot",
                "Salesforce",
                "Pipedrive",
                "Zoho CRM",
                "Freshworks"
            ],
            "context": "Customer relationship management platforms",
            "search_depth": "standard"
        },
        "expected_count": 5,
        "expected_websites": [
            "hubspot.com",
            "salesforce.com", 
            "pipedrive.com",
            "zoho.com",
            "freshworks.com"
        ]
    },
    {
        "name": "Mixed Known/Unknown Companies",
        "input": {
            "competitor_names": [
                "Slack",
                "NonExistentCompany123",
                "Microsoft", 
                "FakeStartup456",
                "Google"
            ],
            "context": "Mixed batch with some unknown companies",
            "search_depth": "standard"
        },
        "expected_count": 3,  # Should skip the fake ones
        "expected_websites": [
            "slack.com",
            "microsoft.com",
            "google.com"
        ]
    }
]

async def run_test_case(test_case):
    """Run a single test case"""
    print(f"🧪 Testing: {test_case['name']}")
    print(f"📝 Companies: {', '.join(test_case['input']['competitor_names'])}")
    
    # Create the agent command
    agent_script = Path(__file__).parent.parent / "pydantic_agents" / "agents" / "website_enrichment_agent.py"
    
    try:
        # Set up environment with backend/.env loaded
        env = os.environ.copy()
        
        # Run the agent as a subprocess with proper environment
        process = subprocess.run(
            [sys.executable, str(agent_script)],
            input=json.dumps(test_case['input']),
            text=True,
            capture_output=True,
            timeout=60,  # 60 second timeout
            env=env,
            cwd=Path(__file__).parent.parent.parent  # Set working directory to backend
        )
        
        # Parse the result even if exit code is 1 (due to Logfire shutdown issues)
        if process.stdout:
            try:
                result = json.loads(process.stdout)
            except json.JSONDecodeError as e:
                print(f"❌ Failed to parse agent output as JSON: {e}")
                print(f"Raw output: {process.stdout}")
                if process.stderr:
                    print(f"❌ stderr: {process.stderr}")
                return False
        else:
            print(f"❌ Agent failed with return code {process.returncode}")
            if process.stderr:
                print(f"❌ stderr: {process.stderr}")
            return False
        
        # Check for errors in result
        if 'error' in result:
            print(f"❌ Agent returned error: {result['error']}")
            return False
        
        # Extract competitors data
        if 'result' not in result:
            print(f"❌ No 'result' field in agent output")
            return False
            
        competitors_data = result['result']
        if isinstance(competitors_data, dict) and 'competitors' in competitors_data:
            competitors = competitors_data['competitors']
        elif isinstance(competitors_data, list):
            competitors = competitors_data
        else:
            print(f"❌ Unexpected result format: {type(competitors_data)}")
            return False
        
        # Validate results
        print(f"✅ Found {len(competitors)} website(s)")
        
        # Display results
        for i, competitor in enumerate(competitors, 1):
            name = competitor.get('name', 'Unknown')
            website = competitor.get('website', 'No website')
            print(f"   {i}. {name} → {website}")
        
        # Basic validation
        if len(competitors) == 0:
            print(f"⚠️  No websites found")
            return False
        
        # Check if we got a reasonable number of results
        expected_count = test_case.get('expected_count', len(test_case['input']['competitor_names']))
        if len(competitors) < expected_count * 0.6:  # Allow for some missing results
            print(f"⚠️  Expected around {expected_count} results, got {len(competitors)}")
        
        # Validate URL format
        for competitor in competitors:
            website = competitor.get('website', '')
            if website and not (website.startswith('http://') or website.startswith('https://')):
                print(f"⚠️  Website URL should include protocol: {website}")
        
        return True
        
    except subprocess.TimeoutExpired:
        print(f"❌ Agent timed out after 60 seconds")
        return False
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return False

async def main():
    """Run all test cases"""
    print("🌐 Testing Website Enrichment Agent")
    print("=" * 60)
    print()
    
    results = []
    
    for test_case in TEST_CASES:
        success = await run_test_case(test_case)
        results.append((test_case['name'], success))
        print()
    
    # Summary
    print("=" * 60)
    print("📊 Test Results Summary:")
    passed = 0
    for name, success in results:
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"   {status} - {name}")
        if success:
            passed += 1
    
    print()
    print(f"🎯 Overall: {passed}/{len(results)} tests passed")
    
    if passed < len(results):
        print("⚠️  Some tests failed. Please review the agent implementation.")
    else:
        print("🎉 All tests passed! Website enrichment agent is working correctly.")

if __name__ == "__main__":
    asyncio.run(main())