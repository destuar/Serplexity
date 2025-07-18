#!/usr/bin/env ts-node

/**
 * @file run-report-generation-tests.ts
 * @description Comprehensive test automation script for report generation system
 * 
 * This script orchestrates:
 * - Pre-test environment validation
 * - Unit tests for PydanticAI agents
 * - Integration tests for report flow
 * - Data quality validation tests
 * - Performance benchmarking
 * - Test result analysis and reporting
 */

import { execSync, spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

interface TestSuite {
  name: string;
  path: string;
  timeout: number;
  critical: boolean;
  description: string;
}

interface TestResult {
  suite: string;
  passed: boolean;
  duration: number;
  output: string;
  coverage?: number;
  performance?: any;
  errors?: string[];
}

interface TestReport {
  timestamp: string;
  environment: string;
  gitCommit: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  overallDuration: number;
  overallCoverage: number;
  criticalFailures: string[];
  results: TestResult[];
  performance: {
    averageExecutionTime: number;
    tokenEfficiency: number;
    memoryUsage: number;
  };
  recommendations: string[];
}

class ReportGenerationTestRunner {
  private testSuites: TestSuite[] = [
    {
      name: 'PydanticAI Agent Unit Tests',
      path: 'src/__tests__/agents/pydanticAgentTests.test.ts',
      timeout: 60000,
      critical: true,
      description: 'Validates individual agent functionality and data structures'
    },
    {
      name: 'Report Flow Integration Tests',
      path: 'src/__tests__/integration/reportFlowIntegration.test.ts',
      timeout: 120000,
      critical: true,
      description: 'End-to-end validation of complete report generation pipeline'
    },
    {
      name: 'Data Quality Validation Tests',
      path: 'src/__tests__/quality/dataQualityValidation.test.ts',
      timeout: 90000,
      critical: true,
      description: 'Ensures data integrity and quality metrics compliance'
    },
    {
      name: 'Performance Benchmarking Tests',
      path: 'src/__tests__/performance/performanceBenchmarks.test.ts',
      timeout: 180000,
      critical: false,
      description: 'Performance and efficiency validation across all components'
    },
    {
      name: 'Existing Core Tests',
      path: 'src/__tests__/pydanticIntegration.test.ts',
      timeout: 30000,
      critical: false,
      description: 'Legacy integration tests for backward compatibility'
    }
  ];

  private results: TestResult[] = [];
  private startTime: number = Date.now();

  async runAllTests(): Promise<TestReport> {
    console.log('🚀 Starting Comprehensive Report Generation Test Suite');
    console.log('================================================================\n');

    // Pre-test validation
    await this.validateEnvironment();
    
    // Run each test suite
    for (const suite of this.testSuites) {
      const result = await this.runTestSuite(suite);
      this.results.push(result);
      
      // Stop on critical failures
      if (!result.passed && suite.critical) {
        console.log(`❌ Critical test suite failed: ${suite.name}`);
        console.log('Stopping execution due to critical failure.\n');
        break;
      }
    }

    // Generate comprehensive report
    const report = await this.generateTestReport();
    await this.saveTestReport(report);
    this.printTestSummary(report);

    return report;
  }

  private async validateEnvironment(): Promise<void> {
    console.log('🔍 Validating test environment...');
    
    try {
      // Check database connection
      execSync('npm run prisma:dev -- db push --force-reset --skip-seed', { stdio: 'pipe' });
      console.log('✅ Database connection validated');

      // Check environment variables
      const requiredEnvVars = ['DATABASE_URL', 'DISABLE_LOGFIRE'];
      for (const envVar of requiredEnvVars) {
        if (!process.env[envVar]) {
          throw new Error(`Missing required environment variable: ${envVar}`);
        }
      }
      console.log('✅ Environment variables validated');

      // Check Python dependencies
      try {
        execSync('python3 -c "import pydantic_ai; print(\\"OK\\")"', { stdio: 'pipe' });
        console.log('✅ PydanticAI dependencies validated');
      } catch (error) {
        console.log('⚠️  PydanticAI not available - some tests will use mocks');
      }

      // Check TypeScript compilation
      execSync('npm run build', { stdio: 'pipe' });
      console.log('✅ TypeScript compilation validated');

    } catch (error) {
      throw new Error(`Environment validation failed: ${error}`);
    }
    
    console.log('✅ Environment validation complete\n');
  }

  private async runTestSuite(suite: TestSuite): Promise<TestResult> {
    console.log(`📋 Running: ${suite.name}`);
    console.log(`   Description: ${suite.description}`);
    console.log(`   Timeout: ${suite.timeout / 1000}s`);
    
    const startTime = Date.now();
    
    try {
      // Run test with coverage
      const output = execSync(
        `npx jest "${suite.path}" --coverage --coverageReporters=json --testTimeout=${suite.timeout} --verbose`,
        { 
          encoding: 'utf8',
          timeout: suite.timeout + 10000, // Add buffer
          env: {
            ...process.env,
            NODE_ENV: 'test',
            DISABLE_LOGFIRE: '1'
          }
        }
      );

      const duration = Date.now() - startTime;
      const coverage = await this.extractCoverage();

      console.log(`✅ ${suite.name} - PASSED (${duration}ms)`);
      
      return {
        suite: suite.name,
        passed: true,
        duration,
        output,
        coverage
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorOutput = error instanceof Error ? error.message : String(error);
      
      console.log(`❌ ${suite.name} - FAILED (${duration}ms)`);
      console.log(`   Error: ${errorOutput.split('\n')[0]}`);
      
      return {
        suite: suite.name,
        passed: false,
        duration,
        output: errorOutput,
        errors: this.extractErrors(errorOutput)
      };
    }

    console.log('');
  }

  private async extractCoverage(): Promise<number> {
    try {
      const coveragePath = path.join(process.cwd(), 'coverage', 'coverage-final.json');
      const coverageData = JSON.parse(await fs.readFile(coveragePath, 'utf8'));
      
      let totalStatements = 0;
      let coveredStatements = 0;
      
      for (const file of Object.values(coverageData) as any[]) {
        if (file.s) {
          totalStatements += Object.keys(file.s).length;
          coveredStatements += Object.values(file.s).filter((count: number) => count > 0).length;
        }
      }
      
      return totalStatements > 0 ? (coveredStatements / totalStatements) * 100 : 0;
    } catch (error) {
      return 0;
    }
  }

  private extractErrors(output: string): string[] {
    const lines = output.split('\n');
    const errors: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes('Error:') || line.includes('Failed:') || line.includes('FAIL')) {
        errors.push(line.trim());
        
        // Include next few lines for context
        for (let j = 1; j <= 2 && i + j < lines.length; j++) {
          const nextLine = lines[i + j].trim();
          if (nextLine && !nextLine.includes('at ')) {
            errors.push(`  ${nextLine}`);
          }
        }
      }
    }
    
    return errors;
  }

  private async generateTestReport(): Promise<TestReport> {
    const totalDuration = Date.now() - this.startTime;
    const passedTests = this.results.filter(r => r.passed).length;
    const failedTests = this.results.filter(r => !r.passed).length;
    
    const criticalFailures = this.results
      .filter(r => !r.passed && this.testSuites.find(s => s.name === r.suite)?.critical)
      .map(r => r.suite);

    const overallCoverage = this.calculateOverallCoverage();
    const performance = this.extractPerformanceMetrics();
    const recommendations = this.generateRecommendations();

    return {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'unknown',
      gitCommit: this.getGitCommit(),
      totalTests: this.results.length,
      passedTests,
      failedTests,
      overallDuration: totalDuration,
      overallCoverage,
      criticalFailures,
      results: this.results,
      performance,
      recommendations
    };
  }

  private calculateOverallCoverage(): number {
    const coverageResults = this.results.filter(r => r.coverage !== undefined);
    if (coverageResults.length === 0) return 0;
    
    const totalCoverage = coverageResults.reduce((sum, r) => sum + (r.coverage || 0), 0);
    return totalCoverage / coverageResults.length;
  }

  private extractPerformanceMetrics(): { averageExecutionTime: number; tokenEfficiency: number; memoryUsage: number } {
    const performanceTest = this.results.find(r => r.suite.includes('Performance'));
    
    if (performanceTest && performanceTest.passed) {
      // Extract performance data from test output
      return {
        averageExecutionTime: this.extractMetricFromOutput(performanceTest.output, 'Average Execution Time'),
        tokenEfficiency: this.extractMetricFromOutput(performanceTest.output, 'Token Efficiency'),
        memoryUsage: this.extractMetricFromOutput(performanceTest.output, 'Memory Usage')
      };
    }
    
    return {
      averageExecutionTime: 0,
      tokenEfficiency: 0,
      memoryUsage: 0
    };
  }

  private extractMetricFromOutput(output: string, metric: string): number {
    const regex = new RegExp(`${metric}[^\\d]*(\\d+(?:\\.\\d+)?)`);
    const match = output.match(regex);
    return match ? parseFloat(match[1]) : 0;
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    
    // Coverage recommendations
    const overallCoverage = this.calculateOverallCoverage();
    if (overallCoverage < 70) {
      recommendations.push('Increase test coverage to at least 70% for better reliability');
    }
    
    // Performance recommendations
    const performanceTest = this.results.find(r => r.suite.includes('Performance'));
    if (!performanceTest?.passed) {
      recommendations.push('Address performance test failures to ensure system scalability');
    }
    
    // Critical failure recommendations
    const criticalFailures = this.results.filter(r => !r.passed && 
      this.testSuites.find(s => s.name === r.suite)?.critical);
    
    if (criticalFailures.length > 0) {
      recommendations.push('Fix critical test failures before deploying to production');
    }
    
    // Data quality recommendations
    const dataQualityTest = this.results.find(r => r.suite.includes('Data Quality'));
    if (!dataQualityTest?.passed) {
      recommendations.push('Resolve data quality issues to prevent production data corruption');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('All tests passing - system ready for deployment');
    }
    
    return recommendations;
  }

  private getGitCommit(): string {
    try {
      return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    } catch (error) {
      return 'unknown';
    }
  }

  private async saveTestReport(report: TestReport): Promise<void> {
    const reportsDir = path.join(process.cwd(), 'test-reports');
    await fs.mkdir(reportsDir, { recursive: true });
    
    const reportFile = path.join(reportsDir, `report-generation-tests-${Date.now()}.json`);
    await fs.writeFile(reportFile, JSON.stringify(report, null, 2));
    
    console.log(`📄 Test report saved to: ${reportFile}`);
  }

  private printTestSummary(report: TestReport): void {
    console.log('\n================================================================');
    console.log('🏁 TEST EXECUTION SUMMARY');
    console.log('================================================================');
    console.log(`📊 Total Tests: ${report.totalTests}`);
    console.log(`✅ Passed: ${report.passedTests}`);
    console.log(`❌ Failed: ${report.failedTests}`);
    console.log(`⏱️  Duration: ${(report.overallDuration / 1000).toFixed(2)}s`);
    console.log(`📈 Coverage: ${report.overallCoverage.toFixed(1)}%`);
    console.log(`🎯 Success Rate: ${((report.passedTests / report.totalTests) * 100).toFixed(1)}%`);
    
    if (report.criticalFailures.length > 0) {
      console.log(`\n🚨 CRITICAL FAILURES:`);
      report.criticalFailures.forEach(failure => {
        console.log(`   - ${failure}`);
      });
    }
    
    console.log(`\n📋 RECOMMENDATIONS:`);
    report.recommendations.forEach(rec => {
      console.log(`   • ${rec}`);
    });
    
    console.log('\n================================================================');
    
    // Exit with appropriate code
    if (report.criticalFailures.length > 0) {
      console.log('❌ Critical failures detected - exiting with error code');
      process.exit(1);
    } else if (report.failedTests > 0) {
      console.log('⚠️  Some tests failed - check logs for details');
      process.exit(1);
    } else {
      console.log('🎉 All tests passed successfully!');
      process.exit(0);
    }
  }
}

// Script execution
if (require.main === module) {
  const runner = new ReportGenerationTestRunner();
  
  runner.runAllTests().catch(error => {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  });
}

export { ReportGenerationTestRunner };