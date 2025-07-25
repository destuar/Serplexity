/**
 * @file dataConsistencyDebugger.ts
 * @description Enterprise-grade data consistency debugging and validation utilities.
 * Provides comprehensive logging, validation, and monitoring for data pipeline issues.
 * 
 * @author Infrastructure Team
 * @version 1.0.0 - Enterprise-grade debugging tools
 */

export interface DataConsistencyReport {
  timestamp: string;
  source: string;
  dataPoints: number;
  dateRange: string;
  granularity?: string;
  firstDate?: string;
  lastDate?: string;
  sampleData: unknown[];
  hash: string;
}

export interface DataPipelineContext {
  component: string;
  operation: string;
  filters: Record<string, unknown>;
  companyId: string;
}

/**
 * Creates a hash of data for comparison
 */
function createDataHash(data: unknown[]): string {
  const dataStr = JSON.stringify(data.map(item => ({
    date: (item as { date: string }).date,
    value: (item as { shareOfVoice?: number; inclusionRate?: number }).shareOfVoice || 
           (item as { shareOfVoice?: number; inclusionRate?: number }).inclusionRate
  })));
  
  return btoa(dataStr).slice(0, 16);
}

/**
 * Generates comprehensive data consistency report
 */
export function generateDataConsistencyReport(
  data: unknown[],
  context: DataPipelineContext
): DataConsistencyReport {
  const report: DataConsistencyReport = {
    timestamp: new Date().toISOString(),
    source: `${context.component}.${context.operation}`,
    dataPoints: data.length,
    dateRange: context.filters.dateRange as string || 'unknown',
    granularity: context.filters.granularity as string,
    firstDate: data.length > 0 ? (data[0] as { date: string }).date : undefined,
    lastDate: data.length > 0 ? (data[data.length - 1] as { date: string }).date : undefined,
    sampleData: data.slice(0, 3),
    hash: createDataHash(data)
  };
  
  console.group(`🔍 [DATA CONSISTENCY] ${context.component} - ${context.operation}`);
  console.log('📊 Data Points:', report.dataPoints);
  console.log('📅 Date Range:', report.dateRange);
  console.log('⏱️ Granularity:', report.granularity || 'raw');
  console.log('🔑 Data Hash:', report.hash);
  
  if (data.length > 0) {
    console.log('📈 First Point:', report.firstDate);
    console.log('📉 Last Point:', report.lastDate);
    console.log('🔍 Sample Data:', report.sampleData);
  } else {
    console.warn('⚠️ NO DATA RETURNED');
  }
  
  console.groupEnd();
  
  return report;
}

/**
 * Compares data consistency between different sources
 */
export function compareDataSources(
  report1: DataConsistencyReport,
  report2: DataConsistencyReport
): void {
  console.group(`🔀 [DATA COMPARISON] ${report1.source} vs ${report2.source}`);
  
  const inconsistencies: string[] = [];
  
  if (report1.dataPoints !== report2.dataPoints) {
    inconsistencies.push(`Data point count mismatch: ${report1.dataPoints} vs ${report2.dataPoints}`);
  }
  
  if (report1.hash !== report2.hash) {
    inconsistencies.push(`Data hash mismatch: ${report1.hash} vs ${report2.hash}`);
  }
  
  if (report1.dateRange !== report2.dateRange) {
    inconsistencies.push(`Date range mismatch: ${report1.dateRange} vs ${report2.dateRange}`);
  }
  
  if (inconsistencies.length > 0) {
    console.error('🚨 DATA INCONSISTENCY DETECTED:');
    inconsistencies.forEach(issue => console.error(`  ❌ ${issue}`));
    
    // Log for monitoring systems
    console.error('[MONITORING] Data consistency violation', {
      source1: report1.source,
      source2: report2.source,
      inconsistencies,
      timestamp: new Date().toISOString()
    });
  } else {
    console.log('✅ Data sources are consistent');
  }
  
  console.groupEnd();
}

/**
 * Enterprise-grade data validation with detailed reporting
 */
export function validateDataPipeline(
  data: unknown[],
  context: DataPipelineContext,
  expectedMinPoints: number = 1
): boolean {
  const report = generateDataConsistencyReport(data, context);
  
  const validations = [
    {
      name: 'Minimum data points',
      check: data.length >= expectedMinPoints,
      message: `Expected at least ${expectedMinPoints} points, got ${data.length}`
    },
    {
      name: 'Data structure integrity',
      check: data.every(item => 
        item && 
        typeof item === 'object' && 
        'date' in item &&
        (item as { date: unknown }).date
      ),
      message: 'Invalid data structure detected'
    },
    {
      name: 'Date chronology',
      check: data.length <= 1 || (() => {
        const dates = data.map(item => new Date((item as { date: string }).date));
        return dates.every((date, i) => i === 0 || date >= dates[i - 1]);
      })(),
      message: 'Data points are not in chronological order'
    }
  ];
  
  const failures = validations.filter(v => !v.check);
  
  if (failures.length > 0) {
    console.group('🚨 [DATA VALIDATION] Failures detected');
    failures.forEach(failure => {
      console.error(`❌ ${failure.name}: ${failure.message}`);
    });
    console.groupEnd();
    
    return false;
  }
  
  console.log(`✅ [DATA VALIDATION] All checks passed for ${context.component}`);
  return true;
}

/**
 * Monitors data pipeline performance and consistency
 */
export class DataPipelineMonitor {
  private static reports: Map<string, DataConsistencyReport> = new Map();
  
  static recordData(
    key: string,
    data: unknown[],
    context: DataPipelineContext
  ): DataConsistencyReport {
    const report = generateDataConsistencyReport(data, context);
    this.reports.set(key, report);
    
    // Check for inconsistencies with related data sources
    const relatedKeys = Array.from(this.reports.keys()).filter(k => 
      k !== key && 
      k.includes(context.companyId)
    );
    
    relatedKeys.forEach(relatedKey => {
      const relatedReport = this.reports.get(relatedKey);
      if (relatedReport && 
          relatedReport.dateRange === report.dateRange &&
          Math.abs(Date.now() - new Date(relatedReport.timestamp).getTime()) < 30000) {
        compareDataSources(report, relatedReport);
      }
    });
    
    return report;
  }
  
  static getReport(key: string): DataConsistencyReport | undefined {
    return this.reports.get(key);
  }
  
  static clearOldReports(): void {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    for (const [key, report] of this.reports.entries()) {
      if (new Date(report.timestamp).getTime() < oneHourAgo) {
        this.reports.delete(key);
      }
    }
  }
}