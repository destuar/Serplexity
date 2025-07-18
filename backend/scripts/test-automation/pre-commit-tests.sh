#!/bin/bash

# Pre-commit test script for report generation system
# This script runs essential tests before allowing commits

set -e

echo "🔍 Running pre-commit report generation tests..."
echo "================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    local status=$1
    local message=$2
    case $status in
        "success") echo -e "${GREEN}✅ $message${NC}" ;;
        "error") echo -e "${RED}❌ $message${NC}" ;;
        "warning") echo -e "${YELLOW}⚠️  $message${NC}" ;;
        "info") echo -e "ℹ️  $message" ;;
    esac
}

# Function to run a test with timeout
run_test_with_timeout() {
    local test_name=$1
    local test_command=$2
    local timeout_seconds=$3
    
    print_status "info" "Running $test_name (timeout: ${timeout_seconds}s)..."
    
    if timeout $timeout_seconds bash -c "$test_command"; then
        print_status "success" "$test_name passed"
        return 0
    else
        local exit_code=$?
        if [ $exit_code -eq 124 ]; then
            print_status "error" "$test_name timed out after ${timeout_seconds}s"
        else
            print_status "error" "$test_name failed with exit code $exit_code"
        fi
        return $exit_code
    fi
}

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "src/__tests__" ]; then
    print_status "error" "Must be run from backend root directory"
    exit 1
fi

# Set environment for testing
export NODE_ENV=test
export DISABLE_LOGFIRE=1

# Initialize test results tracking
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Array to track failed tests
FAILED_TEST_NAMES=()

# Function to track test results
track_test_result() {
    local test_name=$1
    local result=$2
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if [ $result -eq 0 ]; then
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        FAILED_TESTS=$((FAILED_TESTS + 1))
        FAILED_TEST_NAMES+=("$test_name")
    fi
}

print_status "info" "Starting pre-commit validation..."

# 1. TypeScript compilation check
print_status "info" "Checking TypeScript compilation..."
if npm run build > /dev/null 2>&1; then
    print_status "success" "TypeScript compilation check passed"
    track_test_result "TypeScript Compilation" 0
else
    print_status "error" "TypeScript compilation failed"
    track_test_result "TypeScript Compilation" 1
fi

# 2. Linting check (if available)
if npm run lint > /dev/null 2>&1; then
    print_status "success" "Linting check passed"
    track_test_result "Linting" 0
elif [ $? -ne 0 ]; then
    print_status "warning" "Linting failed or not configured"
    # Don't fail the commit for linting issues
fi

# 3. Quick PydanticAI agent unit tests
print_status "info" "Running PydanticAI agent unit tests..."
if run_test_with_timeout "PydanticAI Unit Tests" \
   "npx jest src/__tests__/agents/pydanticAgentTests.test.ts --testTimeout=30000 --silent" 60; then
    track_test_result "PydanticAI Unit Tests" 0
else
    track_test_result "PydanticAI Unit Tests" 1
fi

# 4. Critical integration tests (subset)
print_status "info" "Running critical integration tests..."
if run_test_with_timeout "Critical Integration Tests" \
   "npx jest src/__tests__/integration/reportFlowIntegration.test.ts --testNamePattern='should process a complete report' --testTimeout=60000 --silent" 90; then
    track_test_result "Critical Integration Tests" 0
else
    track_test_result "Critical Integration Tests" 1
fi

# 5. Data quality validation (essential checks only)
print_status "info" "Running essential data quality checks..."
if run_test_with_timeout "Data Quality Checks" \
   "npx jest src/__tests__/quality/dataQualityValidation.test.ts --testNamePattern='should validate complete report metrics structure' --testTimeout=30000 --silent" 45; then
    track_test_result "Data Quality Checks" 0
else
    track_test_result "Data Quality Checks" 1
fi

# 6. Basic performance sanity check
print_status "info" "Running performance sanity check..."
if run_test_with_timeout "Performance Sanity Check" \
   "npx jest src/__tests__/performance/performanceBenchmarks.test.ts --testNamePattern='should benchmark sentiment analysis agent performance' --testTimeout=45000 --silent" 60; then
    track_test_result "Performance Sanity Check" 0
else
    # Performance tests are not critical for commits
    print_status "warning" "Performance tests failed (non-blocking)"
fi

# 7. Database schema validation
print_status "info" "Validating database schema..."
if npx prisma validate > /dev/null 2>&1; then
    print_status "success" "Database schema validation passed"
    track_test_result "Database Schema" 0
else
    print_status "error" "Database schema validation failed"
    track_test_result "Database Schema" 1
fi

# 8. Environment configuration check
print_status "info" "Checking environment configuration..."
CONFIG_ISSUES=()

# Check for required environment variables in test
if [ -z "$DATABASE_URL" ]; then
    CONFIG_ISSUES+=("DATABASE_URL not set")
fi

if [ ${#CONFIG_ISSUES[@]} -gt 0 ]; then
    print_status "warning" "Environment configuration issues:"
    for issue in "${CONFIG_ISSUES[@]}"; do
        echo "   - $issue"
    done
else
    print_status "success" "Environment configuration check passed"
fi

# Print summary
echo ""
echo "================================================="
print_status "info" "PRE-COMMIT TEST SUMMARY"
echo "================================================="
echo "📊 Total Tests: $TOTAL_TESTS"
echo "✅ Passed: $PASSED_TESTS"
echo "❌ Failed: $FAILED_TESTS"

if [ $FAILED_TESTS -gt 0 ]; then
    echo ""
    print_status "error" "Failed tests:"
    for test_name in "${FAILED_TEST_NAMES[@]}"; do
        echo "   - $test_name"
    done
fi

# Calculate success rate
SUCCESS_RATE=$((PASSED_TESTS * 100 / TOTAL_TESTS))
echo "🎯 Success Rate: ${SUCCESS_RATE}%"

# Determine exit code based on critical failures
CRITICAL_FAILURES=0

# Check for critical test failures
for test_name in "${FAILED_TEST_NAMES[@]}"; do
    case "$test_name" in
        "TypeScript Compilation"|"PydanticAI Unit Tests"|"Critical Integration Tests"|"Database Schema")
            CRITICAL_FAILURES=$((CRITICAL_FAILURES + 1))
            ;;
    esac
done

echo ""
if [ $CRITICAL_FAILURES -gt 0 ]; then
    print_status "error" "COMMIT BLOCKED: $CRITICAL_FAILURES critical test(s) failed"
    echo ""
    echo "Please fix the following critical issues before committing:"
    for test_name in "${FAILED_TEST_NAMES[@]}"; do
        case "$test_name" in
            "TypeScript Compilation"|"PydanticAI Unit Tests"|"Critical Integration Tests"|"Database Schema")
                echo "   🚨 $test_name"
                ;;
        esac
    done
    echo ""
    echo "Run 'npm run test:report-generation' for detailed analysis"
    exit 1
elif [ $FAILED_TESTS -gt 0 ]; then
    print_status "warning" "COMMIT ALLOWED: Non-critical tests failed"
    echo ""
    echo "Consider fixing these issues in a follow-up commit:"
    for test_name in "${FAILED_TEST_NAMES[@]}"; do
        case "$test_name" in
            "TypeScript Compilation"|"PydanticAI Unit Tests"|"Critical Integration Tests"|"Database Schema")
                ;;
            *)
                echo "   ⚠️  $test_name"
                ;;
        esac
    done
    exit 0
else
    print_status "success" "COMMIT APPROVED: All tests passed!"
    echo ""
    echo "🎉 Your changes are ready for commit."
    exit 0
fi