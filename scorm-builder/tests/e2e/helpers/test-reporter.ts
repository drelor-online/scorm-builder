/**
 * Enhanced Test Reporter for AI Analysis
 * Generates comprehensive test reports with detailed metrics and analysis
 */

import fs from 'fs';
import path from 'path';

export interface TestResult {
  testName: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  browser: string;
  platform: string;
  error?: string;
  screenshot?: string;
  metrics?: {
    performanceMetrics?: {
      loadTime?: number;
      interactionTime?: number;
      memoryUsage?: number;
    };
    accessibilityScore?: number;
    visualDifferences?: number;
    fileUploadSpeed?: number;
    scormGenerationTime?: number;
  };
}

export interface TestSuite {
  suiteName: string;
  startTime: Date;
  endTime?: Date;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  results: TestResult[];
  coverage?: {
    userJourneySteps: string[];
    completedSteps: string[];
    platformsCovered: string[];
    resolutionsTested: Array<{ width: number; height: number }>;
  };
}

export class TestReporter {
  private testSuites: TestSuite[] = [];
  private currentSuite: TestSuite | null = null;
  private reportDir: string;

  constructor(reportDirectory: string = 'test-results/ai-analysis') {
    this.reportDir = path.resolve(reportDirectory);
    this.ensureReportDirectory();
  }

  private ensureReportDirectory(): void {
    if (!fs.existsSync(this.reportDir)) {
      fs.mkdirSync(this.reportDir, { recursive: true });
    }
  }

  startSuite(suiteName: string): void {
    this.currentSuite = {
      suiteName,
      startTime: new Date(),
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0,
      results: []
    };
  }

  endSuite(): void {
    if (this.currentSuite) {
      this.currentSuite.endTime = new Date();
      this.testSuites.push(this.currentSuite);
      this.currentSuite = null;
    }
  }

  addTestResult(result: TestResult): void {
    if (!this.currentSuite) {
      throw new Error('No active test suite. Call startSuite() first.');
    }

    this.currentSuite.results.push(result);
    this.currentSuite.totalTests++;

    switch (result.status) {
      case 'passed':
        this.currentSuite.passedTests++;
        break;
      case 'failed':
        this.currentSuite.failedTests++;
        break;
      case 'skipped':
        this.currentSuite.skippedTests++;
        break;
    }
  }

  setCoverage(coverage: TestSuite['coverage']): void {
    if (this.currentSuite) {
      this.currentSuite.coverage = coverage;
    }
  }

  generateReport(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = path.join(this.reportDir, `test-report-${timestamp}.json`);
    
    const report = {
      generatedAt: new Date().toISOString(),
      summary: this.generateSummary(),
      testSuites: this.testSuites,
      analysis: this.generateAnalysis(),
      recommendations: this.generateRecommendations()
    };

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    // Also generate HTML report
    this.generateHTMLReport(report, timestamp);
    
    return reportPath;
  }

  private generateSummary() {
    const totalTests = this.testSuites.reduce((sum, suite) => sum + suite.totalTests, 0);
    const totalPassed = this.testSuites.reduce((sum, suite) => sum + suite.passedTests, 0);
    const totalFailed = this.testSuites.reduce((sum, suite) => sum + suite.failedTests, 0);
    const totalSkipped = this.testSuites.reduce((sum, suite) => sum + suite.skippedTests, 0);

    const successRate = totalTests > 0 ? (totalPassed / totalTests) * 100 : 0;
    
    const totalDuration = this.testSuites.reduce((sum, suite) => {
      if (suite.endTime) {
        return sum + (suite.endTime.getTime() - suite.startTime.getTime());
      }
      return sum;
    }, 0);

    return {
      totalTests,
      totalPassed,
      totalFailed,
      totalSkipped,
      successRate: Math.round(successRate * 100) / 100,
      totalDurationMs: totalDuration,
      averageTestDuration: totalTests > 0 ? Math.round(totalDuration / totalTests) : 0
    };
  }

  private generateAnalysis() {
    const platformAnalysis = this.analyzePlatformPerformance();
    const performanceAnalysis = this.analyzePerformanceMetrics();
    const accessibilityAnalysis = this.analyzeAccessibilityScores();
    const visualRegressionAnalysis = this.analyzeVisualRegression();
    const userJourneyAnalysis = this.analyzeUserJourneys();

    return {
      platformPerformance: platformAnalysis,
      performance: performanceAnalysis,
      accessibility: accessibilityAnalysis,
      visualRegression: visualRegressionAnalysis,
      userJourney: userJourneyAnalysis,
      criticalIssues: this.identifyCriticalIssues(),
      trends: this.analyzeTestTrends()
    };
  }

  private analyzePlatformPerformance() {
    const platforms: { [key: string]: { passed: number; failed: number; avgDuration: number } } = {};

    this.testSuites.forEach(suite => {
      suite.results.forEach(result => {
        const platform = result.browser || 'unknown';
        
        if (!platforms[platform]) {
          platforms[platform] = { passed: 0, failed: 0, avgDuration: 0 };
        }

        if (result.status === 'passed') platforms[platform].passed++;
        if (result.status === 'failed') platforms[platform].failed++;
        platforms[platform].avgDuration += result.duration;
      });
    });

    // Calculate averages
    Object.keys(platforms).forEach(platform => {
      const total = platforms[platform].passed + platforms[platform].failed;
      if (total > 0) {
        platforms[platform].avgDuration = Math.round(platforms[platform].avgDuration / total);
      }
    });

    return platforms;
  }

  private analyzePerformanceMetrics() {
    const allMetrics = this.testSuites.flatMap(suite => 
      suite.results.map(result => result.metrics?.performanceMetrics).filter(Boolean)
    );

    if (allMetrics.length === 0) {
      return { message: 'No performance metrics collected' };
    }

    const loadTimes = allMetrics.map(m => m?.loadTime).filter(Boolean) as number[];
    const interactionTimes = allMetrics.map(m => m?.interactionTime).filter(Boolean) as number[];
    const memoryUsage = allMetrics.map(m => m?.memoryUsage).filter(Boolean) as number[];

    return {
      loadTime: {
        average: this.calculateAverage(loadTimes),
        min: Math.min(...loadTimes),
        max: Math.max(...loadTimes),
        p95: this.calculatePercentile(loadTimes, 95)
      },
      interactionTime: {
        average: this.calculateAverage(interactionTimes),
        min: Math.min(...interactionTimes),
        max: Math.max(...interactionTimes),
        p95: this.calculatePercentile(interactionTimes, 95)
      },
      memoryUsage: {
        average: this.calculateAverage(memoryUsage),
        peak: Math.max(...memoryUsage),
        trend: this.analyzeMemoryTrend(memoryUsage)
      }
    };
  }

  private analyzeAccessibilityScores() {
    const scores = this.testSuites.flatMap(suite => 
      suite.results.map(result => result.metrics?.accessibilityScore).filter(Boolean)
    ) as number[];

    if (scores.length === 0) {
      return { message: 'No accessibility scores collected' };
    }

    const averageScore = this.calculateAverage(scores);
    const minScore = Math.min(...scores);
    const failingTests = scores.filter(score => score < 90).length;

    return {
      averageScore: Math.round(averageScore * 100) / 100,
      minScore,
      maxScore: Math.max(...scores),
      passingTests: scores.filter(score => score >= 90).length,
      failingTests,
      distribution: this.createScoreDistribution(scores)
    };
  }

  private analyzeVisualRegression() {
    const visualDiffs = this.testSuites.flatMap(suite => 
      suite.results.map(result => result.metrics?.visualDifferences).filter(Boolean)
    ) as number[];

    if (visualDiffs.length === 0) {
      return { message: 'No visual regression data collected' };
    }

    const testsWithChanges = visualDiffs.filter(diff => diff > 0).length;
    const totalPixelDifferences = visualDiffs.reduce((sum, diff) => sum + diff, 0);

    return {
      totalTests: visualDiffs.length,
      testsWithChanges,
      testsStable: visualDiffs.length - testsWithChanges,
      totalPixelDifferences,
      averageDifference: this.calculateAverage(visualDiffs),
      maxDifference: Math.max(...visualDiffs)
    };
  }

  private analyzeUserJourneys() {
    const journeys = this.testSuites.flatMap(suite => suite.coverage?.userJourneySteps || []);
    const completed = this.testSuites.flatMap(suite => suite.coverage?.completedSteps || []);

    const completionRate = journeys.length > 0 ? (completed.length / journeys.length) * 100 : 0;
    const incompleteSteps = journeys.filter(step => !completed.includes(step));

    return {
      totalSteps: journeys.length,
      completedSteps: completed.length,
      completionRate: Math.round(completionRate * 100) / 100,
      incompleteSteps,
      criticalPath: this.identifyCriticalPath(journeys, completed)
    };
  }

  private identifyCriticalIssues() {
    const issues: Array<{ severity: 'high' | 'medium' | 'low'; description: string; testName?: string }> = [];

    this.testSuites.forEach(suite => {
      suite.results.forEach(result => {
        if (result.status === 'failed') {
          const severity = this.determineSeverity(result);
          issues.push({
            severity,
            description: result.error || 'Test failed without specific error',
            testName: result.testName
          });
        }

        // Check performance thresholds
        if (result.metrics?.performanceMetrics?.loadTime && result.metrics.performanceMetrics.loadTime > 10000) {
          issues.push({
            severity: 'medium',
            description: `Slow load time: ${result.metrics.performanceMetrics.loadTime}ms`,
            testName: result.testName
          });
        }

        // Check accessibility scores
        if (result.metrics?.accessibilityScore && result.metrics.accessibilityScore < 80) {
          issues.push({
            severity: 'high',
            description: `Low accessibility score: ${result.metrics.accessibilityScore}`,
            testName: result.testName
          });
        }
      });
    });

    return {
      high: issues.filter(i => i.severity === 'high'),
      medium: issues.filter(i => i.severity === 'medium'),
      low: issues.filter(i => i.severity === 'low')
    };
  }

  private generateRecommendations() {
    const recommendations: string[] = [];
    const analysis = this.generateAnalysis();

    // Performance recommendations
    if (analysis.performance && typeof analysis.performance === 'object' && 'loadTime' in analysis.performance) {
      const perfAnalysis = analysis.performance as any;
      if (perfAnalysis.loadTime?.average > 5000) {
        recommendations.push('Consider optimizing page load times - average load time exceeds 5 seconds');
      }
      if (perfAnalysis.memoryUsage?.trend === 'increasing') {
        recommendations.push('Memory usage is trending upward - investigate potential memory leaks');
      }
    }

    // Accessibility recommendations
    if (analysis.accessibility && typeof analysis.accessibility === 'object' && 'averageScore' in analysis.accessibility) {
      const a11yAnalysis = analysis.accessibility as any;
      if (a11yAnalysis.averageScore < 90) {
        recommendations.push('Improve accessibility compliance - average score below 90');
      }
      if (a11yAnalysis.failingTests > 0) {
        recommendations.push(`Address accessibility issues in ${a11yAnalysis.failingTests} failing tests`);
      }
    }

    // Platform-specific recommendations
    const platformAnalysis = analysis.platformPerformance;
    Object.keys(platformAnalysis).forEach(platform => {
      const platformData = platformAnalysis[platform];
      const total = platformData.passed + platformData.failed;
      const successRate = total > 0 ? (platformData.passed / total) * 100 : 0;
      
      if (successRate < 90) {
        recommendations.push(`Address issues on ${platform} platform - success rate is ${Math.round(successRate)}%`);
      }
    });

    // User journey recommendations
    if (analysis.userJourney && typeof analysis.userJourney === 'object' && 'completionRate' in analysis.userJourney) {
      const journeyAnalysis = analysis.userJourney as any;
      if (journeyAnalysis.completionRate < 95) {
        recommendations.push('Improve user journey completion rate - some critical paths are failing');
      }
    }

    // Visual regression recommendations
    if (analysis.visualRegression && typeof analysis.visualRegression === 'object' && 'testsWithChanges' in analysis.visualRegression) {
      const visualAnalysis = analysis.visualRegression as any;
      if (visualAnalysis.testsWithChanges > visualAnalysis.totalTests * 0.1) {
        recommendations.push('High number of visual changes detected - review UI consistency');
      }
    }

    return recommendations;
  }

  private generateHTMLReport(report: any, timestamp: string): void {
    const htmlPath = path.join(this.reportDir, `test-report-${timestamp}.html`);
    
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SCORM Builder Test Report</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { border-bottom: 3px solid #4CAF50; padding-bottom: 20px; margin-bottom: 30px; }
        .title { color: #333; margin: 0; font-size: 2.5em; }
        .subtitle { color: #666; margin: 5px 0; font-size: 1.2em; }
        .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 30px 0; }
        .metric-card { background: #f8f9fa; padding: 20px; border-radius: 6px; border-left: 4px solid #4CAF50; }
        .metric-value { font-size: 2em; font-weight: bold; color: #4CAF50; margin: 0; }
        .metric-label { color: #666; margin: 5px 0 0 0; font-size: 0.9em; }
        .section { margin: 40px 0; }
        .section-title { font-size: 1.5em; color: #333; border-bottom: 2px solid #eee; padding-bottom: 10px; margin-bottom: 20px; }
        .issue { padding: 15px; margin: 10px 0; border-left: 4px solid #ff4444; background: #fff5f5; border-radius: 4px; }
        .issue.medium { border-left-color: #ff9800; background: #fff8e1; }
        .issue.low { border-left-color: #2196f3; background: #e3f2fd; }
        .recommendation { padding: 15px; margin: 10px 0; border-left: 4px solid #4CAF50; background: #f1f8e9; border-radius: 4px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background: #f5f5f5; font-weight: 600; }
        .passed { color: #4CAF50; font-weight: bold; }
        .failed { color: #f44336; font-weight: bold; }
        .skipped { color: #ff9800; font-weight: bold; }
        .progress-bar { width: 100%; height: 20px; background: #eee; border-radius: 10px; overflow: hidden; }
        .progress-fill { height: 100%; background: linear-gradient(90deg, #4CAF50, #66bb6a); }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 class="title">SCORM Builder Test Report</h1>
            <p class="subtitle">Generated on ${new Date().toLocaleString()}</p>
        </div>

        <div class="summary-grid">
            <div class="metric-card">
                <p class="metric-value">${report.summary.totalTests}</p>
                <p class="metric-label">Total Tests</p>
            </div>
            <div class="metric-card">
                <p class="metric-value">${report.summary.successRate}%</p>
                <p class="metric-label">Success Rate</p>
            </div>
            <div class="metric-card">
                <p class="metric-value">${Math.round(report.summary.totalDurationMs / 1000)}s</p>
                <p class="metric-label">Total Duration</p>
            </div>
            <div class="metric-card">
                <p class="metric-value">${report.summary.totalFailed}</p>
                <p class="metric-label">Failed Tests</p>
            </div>
        </div>

        <div class="section">
            <h2 class="section-title">Test Results Overview</h2>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${report.summary.successRate}%"></div>
            </div>
            <p>Passed: <span class="passed">${report.summary.totalPassed}</span> | 
               Failed: <span class="failed">${report.summary.totalFailed}</span> | 
               Skipped: <span class="skipped">${report.summary.totalSkipped}</span></p>
        </div>

        <div class="section">
            <h2 class="section-title">Critical Issues</h2>
            ${report.analysis.criticalIssues.high.map((issue: any) => `
                <div class="issue">
                    <strong>HIGH:</strong> ${issue.description}
                    ${issue.testName ? `<br><small>Test: ${issue.testName}</small>` : ''}
                </div>
            `).join('')}
            ${report.analysis.criticalIssues.medium.map((issue: any) => `
                <div class="issue medium">
                    <strong>MEDIUM:</strong> ${issue.description}
                    ${issue.testName ? `<br><small>Test: ${issue.testName}</small>` : ''}
                </div>
            `).join('')}
        </div>

        <div class="section">
            <h2 class="section-title">Recommendations</h2>
            ${report.recommendations.map((rec: string) => `
                <div class="recommendation">${rec}</div>
            `).join('')}
        </div>

        <div class="section">
            <h2 class="section-title">Platform Performance</h2>
            <table>
                <thead>
                    <tr>
                        <th>Platform</th>
                        <th>Passed</th>
                        <th>Failed</th>
                        <th>Success Rate</th>
                        <th>Avg Duration</th>
                    </tr>
                </thead>
                <tbody>
                    ${Object.entries(report.analysis.platformPerformance).map(([platform, data]: [string, any]) => {
                        const total = data.passed + data.failed;
                        const successRate = total > 0 ? Math.round((data.passed / total) * 100) : 0;
                        return `
                        <tr>
                            <td>${platform}</td>
                            <td class="passed">${data.passed}</td>
                            <td class="failed">${data.failed}</td>
                            <td>${successRate}%</td>
                            <td>${data.avgDuration}ms</td>
                        </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>

        <div class="section">
            <h2 class="section-title">Detailed Results</h2>
            <pre style="background: #f5f5f5; padding: 20px; border-radius: 4px; overflow-x: auto; font-size: 0.9em;">
${JSON.stringify(report, null, 2)}
            </pre>
        </div>
    </div>
</body>
</html>
    `;

    fs.writeFileSync(htmlPath, html);
  }

  // Utility methods
  private calculateAverage(numbers: number[]): number {
    return numbers.length > 0 ? numbers.reduce((sum, n) => sum + n, 0) / numbers.length : 0;
  }

  private calculatePercentile(numbers: number[], percentile: number): number {
    const sorted = numbers.sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index] || 0;
  }

  private createScoreDistribution(scores: number[]): { [range: string]: number } {
    const ranges = { '90-100': 0, '80-89': 0, '70-79': 0, '60-69': 0, '0-59': 0 };
    
    scores.forEach(score => {
      if (score >= 90) ranges['90-100']++;
      else if (score >= 80) ranges['80-89']++;
      else if (score >= 70) ranges['70-79']++;
      else if (score >= 60) ranges['60-69']++;
      else ranges['0-59']++;
    });

    return ranges;
  }

  private analyzeMemoryTrend(memoryUsage: number[]): 'stable' | 'increasing' | 'decreasing' {
    if (memoryUsage.length < 2) return 'stable';
    
    const firstHalf = memoryUsage.slice(0, Math.floor(memoryUsage.length / 2));
    const secondHalf = memoryUsage.slice(Math.floor(memoryUsage.length / 2));
    
    const firstAvg = this.calculateAverage(firstHalf);
    const secondAvg = this.calculateAverage(secondHalf);
    
    const difference = secondAvg - firstAvg;
    const threshold = firstAvg * 0.1; // 10% threshold
    
    if (difference > threshold) return 'increasing';
    if (difference < -threshold) return 'decreasing';
    return 'stable';
  }

  private determineSeverity(result: TestResult): 'high' | 'medium' | 'low' {
    const testName = result.testName.toLowerCase();
    
    // High severity for critical user journeys and accessibility
    if (testName.includes('user journey') || testName.includes('accessibility') || testName.includes('scorm generation')) {
      return 'high';
    }
    
    // Medium severity for performance and cross-platform
    if (testName.includes('performance') || testName.includes('cross-platform') || testName.includes('visual regression')) {
      return 'medium';
    }
    
    return 'low';
  }

  private identifyCriticalPath(journeys: string[], completed: string[]): string[] {
    // Define critical path steps for SCORM Builder
    const criticalSteps = [
      'project-creation',
      'course-seed-input',
      'media-enhancement',
      'content-review',
      'audio-narration',
      'activities-creation',
      'scorm-generation'
    ];

    return criticalSteps.filter(step => journeys.includes(step) && !completed.includes(step));
  }

  private analyzeTestTrends(): any {
    // This would typically compare with historical data
    // For now, return basic trend analysis based on current run
    const failureRate = this.testSuites.reduce((sum, suite) => sum + suite.failedTests, 0) / 
                       Math.max(this.testSuites.reduce((sum, suite) => sum + suite.totalTests, 0), 1);

    return {
      failureRate: Math.round(failureRate * 100),
      trend: failureRate < 0.05 ? 'improving' : failureRate > 0.15 ? 'deteriorating' : 'stable',
      note: 'Trend analysis requires historical data for accurate comparison'
    };
  }
}

// Export utility function for easy integration with Playwright
export function createTestReporter(): TestReporter {
  return new TestReporter();
}