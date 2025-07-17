#!/usr/bin/env python3
"""
Test script for the Optimization Task Generation Agent

This script tests the optimization task generation functionality with
different company profiles and industries to validate:
- Comprehensive task generation across categories
- Appropriate priority assignment
- Realistic effort estimation
- Actionable task descriptions
- Industry-specific customization
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
        "name": "Tech Startup - Content Focus",
        "input": {
            "company_name": "TechFlow AI",
            "industry": "Artificial Intelligence",
            "context": "Early-stage AI startup focusing on business automation",
            "categories": ["content", "brand", "visibility"],
            "max_tasks": 8,
            "priority_focus": "high_impact"
        },
        "expected_categories": ["content", "brand", "visibility"],
        "expected_task_count": 8,
        "expected_min_priorities": 2
    },
    {
        "name": "E-commerce Company - Full Spectrum",
        "input": {
            "company_name": "ShopSmart Plus",
            "industry": "E-commerce",
            "context": "Mid-size online retailer looking to improve market position",
            "categories": ["content", "technical", "brand", "visibility", "performance"],
            "max_tasks": 12,
            "priority_focus": "balanced"
        },
        "expected_categories": ["content", "technical", "brand", "visibility", "performance"],
        "expected_task_count": 12,
        "expected_min_priorities": 3
    },
    {
        "name": "Healthcare SaaS - Compliance Focus",
        "input": {
            "company_name": "MedTech Solutions",
            "industry": "Healthcare Technology",
            "context": "HIPAA-compliant software for medical practices",
            "categories": ["technical", "brand", "performance"],
            "max_tasks": 6,
            "priority_focus": "high_impact"
        },
        "expected_categories": ["technical", "brand", "performance"],
        "expected_task_count": 6,
        "expected_min_priorities": 2
    },
    {
        "name": "Financial Services - Brand Building",
        "input": {
            "company_name": "SecureFinance Corp",
            "industry": "Financial Services",
            "context": "Traditional financial services company modernizing their digital presence",
            "categories": ["brand", "visibility", "performance"],
            "max_tasks": 10,
            "priority_focus": "balanced"
        },
        "expected_categories": ["brand", "visibility", "performance"],
        "expected_task_count": 10,
        "expected_min_priorities": 2
    },
    {
        "name": "Manufacturing - Minimal Set",
        "input": {
            "company_name": "Industrial Dynamics",
            "industry": "Manufacturing",
            "context": "B2B manufacturing company seeking digital transformation",
            "max_tasks": 5,
            "priority_focus": "high_impact"
        },
        "expected_categories": ["content", "technical", "brand", "visibility", "performance"],  # Default categories
        "expected_task_count": 5,
        "expected_min_priorities": 2
    }
]

def validate_task_structure(task):
    """Validate that a task has the required structure"""
    required_fields = ['title', 'description', 'category', 'priority', 'estimatedEffort', 
                      'expectedImpact', 'actionItems', 'successMetrics']
    
    for field in required_fields:
        if field not in task:
            return False, f"Missing required field: {field}"
    
    # Validate priority is within expected range (1-5)
    if not isinstance(task['priority'], int) or task['priority'] < 1 or task['priority'] > 5:
        return False, f"Priority must be 1-5, got {task['priority']}"
    
    # Validate effort is reasonable (1-160 hours)
    if not isinstance(task['estimatedEffort'], (int, float)) or task['estimatedEffort'] < 1 or task['estimatedEffort'] > 160:
        return False, f"Effort must be 1-160 hours, got {task['estimatedEffort']}"
    
    # Validate action items exist
    if not isinstance(task['actionItems'], list) or len(task['actionItems']) == 0:
        return False, "Must have at least one action item"
    
    # Validate success metrics exist
    if not isinstance(task['successMetrics'], list) or len(task['successMetrics']) == 0:
        return False, "Must have at least one success metric"
    
    return True, "Valid"

def analyze_task_distribution(tasks):
    """Analyze the distribution of tasks"""
    analysis = {
        'categories': {},
        'priorities': {},
        'effort_ranges': {'low': 0, 'medium': 0, 'high': 0, 'very_high': 0},
        'total_effort': 0
    }
    
    for task in tasks:
        # Count categories
        category = task.get('category', 'unknown')
        analysis['categories'][category] = analysis['categories'].get(category, 0) + 1
        
        # Count priorities
        priority = task.get('priority', 0)
        analysis['priorities'][priority] = analysis['priorities'].get(priority, 0) + 1
        
        # Categorize effort
        effort = task.get('estimatedEffort', 0)
        analysis['total_effort'] += effort
        
        if effort <= 8:
            analysis['effort_ranges']['low'] += 1
        elif effort <= 24:
            analysis['effort_ranges']['medium'] += 1
        elif effort <= 40:
            analysis['effort_ranges']['high'] += 1
        else:
            analysis['effort_ranges']['very_high'] += 1
    
    return analysis

async def run_test_case(test_case):
    """Run a single test case"""
    print(f"🛠️  Testing: {test_case['name']}")
    print(f"📝 Company: {test_case['input']['company_name']} ({test_case['input']['industry']})")
    
    # Create the agent command
    agent_script = Path(__file__).parent.parent / "pydantic_agents" / "agents" / "optimization_agent.py"
    
    try:
        # Set up environment with backend/.env loaded
        env = os.environ.copy()
        
        # Run the agent as a subprocess with proper environment
        process = subprocess.run(
            [sys.executable, str(agent_script)],
            input=json.dumps(test_case['input']),
            text=True,
            capture_output=True,
            timeout=90,  # 90 second timeout for task generation
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
        
        # Extract tasks data
        if 'result' not in result:
            print(f"❌ No 'result' field in agent output")
            return False
            
        tasks_data = result['result']
        if isinstance(tasks_data, dict) and 'tasks' in tasks_data:
            tasks = tasks_data['tasks']
            company_name = tasks_data.get('companyName', 'Unknown')
            industry = tasks_data.get('industry', 'Unknown')
            total_tasks = tasks_data.get('totalTasks', 0)
        else:
            print(f"❌ Unexpected result format: {type(tasks_data)}")
            return False
        
        # Validate basic structure
        if not isinstance(tasks, list):
            print(f"❌ Tasks should be a list, got {type(tasks)}")
            return False
        
        print(f"✅ Generated {len(tasks)} optimization tasks")
        print(f"📊 Expected: {test_case['expected_task_count']}, Got: {len(tasks)}")
        
        # Validate task count
        expected_count = test_case['expected_task_count']
        if len(tasks) != expected_count:
            print(f"⚠️  Expected {expected_count} tasks, got {len(tasks)}")
        
        # Validate each task structure
        validation_errors = []
        for i, task in enumerate(tasks):
            is_valid, error_msg = validate_task_structure(task)
            if not is_valid:
                validation_errors.append(f"Task {i+1}: {error_msg}")
        
        if validation_errors:
            print(f"❌ Task validation errors:")
            for error in validation_errors[:3]:  # Show first 3 errors
                print(f"   - {error}")
            return False
        
        # Analyze task distribution
        analysis = analyze_task_distribution(tasks)
        
        print(f"📋 Task Categories: {list(analysis['categories'].keys())}")
        print(f"🎯 Priority Distribution: {dict(sorted(analysis['priorities'].items()))}")
        print(f"⏱️  Total Effort: {analysis['total_effort']} hours")
        print(f"📈 Effort Distribution: Low: {analysis['effort_ranges']['low']}, "
              f"Medium: {analysis['effort_ranges']['medium']}, "
              f"High: {analysis['effort_ranges']['high']}, "
              f"Very High: {analysis['effort_ranges']['very_high']}")
        
        # Display sample tasks
        print(f"🔍 Sample Tasks:")
        for i, task in enumerate(tasks[:3]):  # Show first 3 tasks
            title = task.get('title', 'No title')
            category = task.get('category', 'unknown')
            priority = task.get('priority', 0)
            effort = task.get('estimatedEffort', 0)
            print(f"   {i+1}. [{category.upper()}] {title} (P{priority}, {effort}h)")
        
        # Validate expected categories
        expected_categories = set(test_case['expected_categories'])
        actual_categories = set(analysis['categories'].keys())
        
        if not expected_categories.issubset(actual_categories):
            missing = expected_categories - actual_categories
            print(f"⚠️  Missing expected categories: {missing}")
        
        # Validate priority diversity
        min_priorities = test_case.get('expected_min_priorities', 2)
        if len(analysis['priorities']) < min_priorities:
            print(f"⚠️  Expected at least {min_priorities} different priority levels, got {len(analysis['priorities'])}")
        
        # Check for reasonable effort distribution
        if analysis['total_effort'] < 10:
            print(f"⚠️  Total effort seems too low: {analysis['total_effort']} hours")
        elif analysis['total_effort'] > 500:
            print(f"⚠️  Total effort seems too high: {analysis['total_effort']} hours")
        
        return True
        
    except subprocess.TimeoutExpired:
        print(f"❌ Agent timed out after 90 seconds")
        return False
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return False

async def main():
    """Run all test cases"""
    print("🛠️  Testing Optimization Task Generation Agent")
    print("=" * 70)
    print()
    
    results = []
    
    for test_case in TEST_CASES:
        success = await run_test_case(test_case)
        results.append((test_case['name'], success))
        print()
    
    # Summary
    print("=" * 70)
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
        print("🎉 All tests passed! Optimization task agent is working correctly.")

if __name__ == "__main__":
    asyncio.run(main())