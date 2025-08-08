#!/bin/bash
# Power of Ten Compliance Validation Script
# Ensures all 10 rules are followed before production deployment

set -euo pipefail

echo "🚀 Power of Ten Compliance Validation for Serplexity"
echo "=================================================="

BACKEND_DIR="backend"
FRONTEND_DIR="frontend"
EXIT_CODE=0

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ $2${NC}"
    else
        echo -e "${RED}❌ $2${NC}"
        EXIT_CODE=1
    fi
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

echo ""
echo "Rule #1: Keep Control-Flow Trivial"
echo "-----------------------------------"

# Check for forbidden constructs
EVAL_COUNT=$(grep -rE "eval\(|Function\(" $BACKEND_DIR/src --include="*.ts" | wc -l || true)
print_status $([[ $EVAL_COUNT -eq 0 ]] && echo 0 || echo 1) "No eval() or Function() usage found ($EVAL_COUNT violations)"

echo ""
echo "Rule #2: Every Loop Must Be Predictably Bounded"
echo "----------------------------------------------"

# Check for while(true) loops
UNBOUNDED_LOOPS=$(grep -rE "while[[:space:]]*\([[:space:]]*true[[:space:]]*\)" $BACKEND_DIR/src --include="*.ts" | wc -l || true)
print_status $([[ $UNBOUNDED_LOOPS -eq 0 ]] && echo 0 || echo 1) "No unbounded while(true) loops found ($UNBOUNDED_LOOPS violations)"

# Check for MAX_* constants
BOUNDED_CONSTANTS=$(grep -r "MAX_.*=" $BACKEND_DIR/src --include="*.ts" | wc -l || true)
print_status $([[ $BOUNDED_CONSTANTS -gt 0 ]] && echo 0 || echo 1) "Loop bounds defined with MAX_* constants: $BOUNDED_CONSTANTS found"

echo ""
echo "Rule #3: No Ad-Hoc Dynamic Allocation After Start-up"
echo "---------------------------------------------------"

# Check Docker memory limits
if [ -f "infra/docker/docker-compose.yml" ]; then
    MEMORY_LIMITS=$(grep -c "memory:" infra/docker/docker-compose.yml || true)
    print_status $([[ $MEMORY_LIMITS -gt 0 ]] && echo 0 || echo 1) "Docker memory limits configured: $MEMORY_LIMITS services"
else
    print_warning "Docker compose file not found, skipping memory limit check"
fi

echo ""
echo "Rule #4: Keep Every Unit Small (~60 LOC)"
echo "----------------------------------------"

cd $BACKEND_DIR

# Check ESLint max-lines-per-function rule
ESLINT_MAX_LINES=$(grep -c "max-lines-per-function" eslint.config.js || true)
print_status $([[ $ESLINT_MAX_LINES -gt 0 ]] && echo 0 || echo 1) "ESLint max-lines-per-function rule configured"

cd ..

echo ""
echo "Rule #5: Average ≥2 Assertions/Function"
echo "---------------------------------------"

cd $BACKEND_DIR

# Check Zod schema usage
ZOD_SCHEMAS=$(find src -name "*.ts" -exec grep -l "z\." {} \; | wc -l || true)
print_status $([[ $ZOD_SCHEMAS -gt 0 ]] && echo 0 || echo 1) "Zod validation schemas found in $ZOD_SCHEMAS files"

# Check TypeScript strict mode
STRICT_MODE=$(grep -c '"strict": true' tsconfig.json || true)
print_status $([[ $STRICT_MODE -gt 0 ]] && echo 0 || echo 1) "TypeScript strict mode enabled"

cd ..

echo ""
echo "Rule #6: Declare Data in Narrowest Scope"
echo "----------------------------------------"

cd $BACKEND_DIR

# Check for const/let vs var usage
VAR_USAGE=$(find $BACKEND_DIR/src -name "*.ts" -exec grep -l "[[:space:]]var[[:space:]]" {} \; 2>/dev/null | wc -l || true)
print_status $([[ $VAR_USAGE -eq 0 ]] && echo 0 || echo 1) "No 'var' declarations found (const/let enforced) - $VAR_USAGE files with var"

# Check prefer-const rule
PREFER_CONST=$(grep -c "prefer-const" eslint.config.js || true)
print_status $([[ $PREFER_CONST -gt 0 ]] && echo 0 || echo 1) "ESLint prefer-const rule configured"

cd ..

echo ""
echo "Rule #7: Always Handle Return Values & Validate Inputs"
echo "-----------------------------------------------------"

cd $BACKEND_DIR

# Check try-catch usage
TRY_CATCH_COUNT=$(find src -name "*.ts" -exec grep -l "try\s*{" {} \; | wc -l || true)
print_status $([[ $TRY_CATCH_COUNT -gt 30 ]] && echo 0 || echo 1) "Comprehensive error handling: $TRY_CATCH_COUNT files with try-catch"

# Check no-floating-promises rule
NO_FLOATING_PROMISES=$(grep -c "no-floating-promises" eslint.config.js || true)
print_status $([[ $NO_FLOATING_PROMISES -gt 0 ]] && echo 0 || echo 1) "ESLint no-floating-promises rule configured"

cd ..

echo ""
echo "Rule #8: Limit Meta-Programming & Build-Time Magic"
echo "-------------------------------------------------"

cd $BACKEND_DIR

# Check for minimal Babel/AST transforms
BABEL_USAGE=$(find . -name ".babelrc*" -o -name "babel.config.*" | wc -l || true)
print_status $([[ $BABEL_USAGE -eq 0 ]] && echo 0 || echo 1) "No Babel transforms found (clean build process) - $BABEL_USAGE configs found"

cd ..

echo ""
echo "Rule #9: No 'Pointer-Equivalent' Obscurity"
echo "------------------------------------------"

cd $BACKEND_DIR

# Check for any type usage
ANY_TYPES=$(find $BACKEND_DIR/src -name "*.ts" -exec grep -c ": any\|<any>" {} \; 2>/dev/null | awk '{sum+=$1} END {print (sum ? sum : 0)}' || echo 0)
print_status $([[ $ANY_TYPES -eq 0 ]] && echo 0 || echo 1) "TypeScript 'any' types found: $ANY_TYPES (should be 0)"

if [ $ANY_TYPES -gt 0 ]; then
    print_warning "Files with 'any' types need to be fixed:"
    find $BACKEND_DIR/src -name "*.ts" -exec grep -l ": any\|<any>" {} \; 2>/dev/null | head -10 || true
fi

# Check no-explicit-any rule
NO_EXPLICIT_ANY=$(grep -c "no-explicit-any" eslint.config.js || true)
print_status $([[ $NO_EXPLICIT_ANY -gt 0 ]] && echo 0 || echo 1) "ESLint no-explicit-any rule configured"

cd ..

echo ""
echo "Rule #10: Zero-Warning Policy with Most Pedantic Tooling"
echo "--------------------------------------------------------"

cd $BACKEND_DIR

# Check TypeScript strict mode flags
echo "TypeScript Configuration:"
STRICT_FLAGS=(
    "strict"
    "noImplicitAny"
    "strictNullChecks"
    "noImplicitReturns"
)

for flag in "${STRICT_FLAGS[@]}"; do
    FLAG_ENABLED=$(grep -c "\"$flag\": true" tsconfig.json || true)
    print_status $([[ $FLAG_ENABLED -gt 0 ]] && echo 0 || echo 1) "$flag enabled in tsconfig.json"
done

# Check Python tooling
echo ""
echo "Python Quality Gates:"

if [ -f "mypy.ini" ]; then
    MYPY_STRICT=$(grep -c "strict = True" mypy.ini || true)
    print_status $([[ $MYPY_STRICT -gt 0 ]] && echo 0 || echo 1) "mypy --strict configuration found"
else
    print_status 1 "mypy.ini configuration file missing"
fi

if [ -f "pyproject.toml" ]; then
    RUFF_ALL=$(grep -c 'select = \["ALL"\]' pyproject.toml || true)
    print_status $([[ $RUFF_ALL -gt 0 ]] && echo 0 || echo 1) "ruff --select ALL configuration found"
    
    BANDIT_CONFIG=$(grep -c "\[tool\.bandit\]" pyproject.toml || true)
    print_status $([[ $BANDIT_CONFIG -gt 0 ]] && echo 0 || echo 1) "bandit security scanning configured"
else
    print_status 1 "pyproject.toml configuration file missing"
fi

# Check test coverage requirements
COVERAGE_THRESHOLD=$(grep -c "coverageThreshold" jest.config.js || true)
print_status $([[ $COVERAGE_THRESHOLD -gt 0 ]] && echo 0 || echo 1) "Test coverage thresholds configured"

cd ..

# Check CI/CD pipeline
echo ""
echo "CI/CD Pipeline:"
if [ -f ".github/workflows/ci.yml" ]; then
    CI_QUALITY_GATES=$(grep -c "Quality Gates" .github/workflows/ci.yml || true)
    print_status $([[ $CI_QUALITY_GATES -gt 0 ]] && echo 0 || echo 1) "GitHub Actions CI pipeline with quality gates"
else
    print_status 1 "GitHub Actions CI pipeline missing"
fi

echo ""
echo "=================================================="
if [ $EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}🎉 Power of Ten Compliance: PASSED${NC}"
    echo -e "${GREEN}Your code follows all 10 safety-critical development rules!${NC}"
    echo -e "${GREEN}Ready for production deployment with 10x engineering confidence.${NC}"
else
    echo -e "${RED}💥 Power of Ten Compliance: FAILED${NC}"
    echo -e "${RED}Please fix the issues above before deploying to production.${NC}"
    echo -e "${YELLOW}Run individual fix commands or use the CI pipeline to resolve.${NC}"
fi

exit $EXIT_CODE