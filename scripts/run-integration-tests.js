#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Colors for output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    log(`Running: ${command} ${args.join(' ')}`, 'cyan');
    
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: true,
      ...options
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve(code);
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });

    child.on('error', (error) => {
      reject(error);
    });
  });
}

async function checkPrerequisites() {
  log('🔍 Checking prerequisites...', 'yellow');
  
  // Check if package.json exists
  if (!fs.existsSync('package.json')) {
    throw new Error('package.json not found. Please run from project root.');
  }

  // Check if node_modules exists
  if (!fs.existsSync('node_modules')) {
    log('📦 Installing dependencies...', 'yellow');
    await runCommand('npm', ['install']);
  }

  // Check if .env file exists
  if (!fs.existsSync('.env')) {
    log('⚠️ .env file not found. Using .env.example as template...', 'yellow');
    if (fs.existsSync('.env.example')) {
      fs.copyFileSync('.env.example', '.env');
      log('✅ Created .env from .env.example', 'green');
    } else {
      log('❌ No .env.example found. Please create .env file manually.', 'red');
      throw new Error('Environment configuration missing');
    }
  }

  log('✅ Prerequisites check completed', 'green');
}

async function runDatabaseMigrations() {
  log('🗄️ Running database migrations...', 'yellow');
  
  try {
    await runCommand('npm', ['run', 'migrate:latest']);
    log('✅ Database migrations completed', 'green');
  } catch (error) {
    log('⚠️ Database migrations failed, continuing...', 'yellow');
    // Don't fail the entire process if migrations fail
  }
}

async function runIntegrationTests() {
  log('🧪 Running integration tests...', 'yellow');
  
  const testSuites = [
    {
      name: 'Core Integration Tests',
      command: 'npm',
      args: ['run', 'test:integration', '--', '--testPathPattern=CoreIntegration']
    },
    {
      name: 'System Integration Tests',
      command: 'npm',
      args: ['run', 'test:integration', '--', '--testPathPattern=SystemIntegration']
    },
    {
      name: 'Complete E2E Integration Tests',
      command: 'npm',
      args: ['run', 'test:integration', '--', '--testPathPattern=CompleteE2EIntegration']
    },
    {
      name: 'Complete System Integration Tests',
      command: 'npm',
      args: ['run', 'test:integration', '--', '--testPathPattern=CompleteSystemIntegration']
    }
  ];

  const results = [];

  for (const suite of testSuites) {
    log(`\n📋 Running ${suite.name}...`, 'blue');
    
    try {
      await runCommand(suite.command, suite.args);
      log(`✅ ${suite.name} passed`, 'green');
      results.push({ name: suite.name, status: 'passed' });
    } catch (error) {
      log(`❌ ${suite.name} failed: ${error.message}`, 'red');
      results.push({ name: suite.name, status: 'failed', error: error.message });
    }
  }

  return results;
}

async function runUnitTests() {
  log('🔬 Running unit tests...', 'yellow');
  
  try {
    await runCommand('npm', ['run', 'test:unit']);
    log('✅ Unit tests passed', 'green');
    return { status: 'passed' };
  } catch (error) {
    log(`❌ Unit tests failed: ${error.message}`, 'red');
    return { status: 'failed', error: error.message };
  }
}

async function generateTestReport(integrationResults, unitResults) {
  log('📊 Generating test report...', 'yellow');
  
  const timestamp = new Date().toISOString();
  const totalTests = integrationResults.length + 1; // +1 for unit tests
  const passedTests = integrationResults.filter(r => r.status === 'passed').length + 
                     (unitResults.status === 'passed' ? 1 : 0);
  const failedTests = totalTests - passedTests;

  const report = {
    timestamp,
    summary: {
      total: totalTests,
      passed: passedTests,
      failed: failedTests,
      success: failedTests === 0
    },
    unitTests: unitResults,
    integrationTests: integrationResults
  };

  // Write report to file
  const reportPath = path.join('logs', 'test-report.json');
  
  // Ensure logs directory exists
  if (!fs.existsSync('logs')) {
    fs.mkdirSync('logs', { recursive: true });
  }

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  log(`📄 Test report saved to ${reportPath}`, 'cyan');
  
  return report;
}

function printSummary(report) {
  log('\n' + '='.repeat(60), 'cyan');
  log('📊 TEST EXECUTION SUMMARY', 'cyan');
  log('='.repeat(60), 'cyan');
  
  log(`Timestamp: ${report.timestamp}`, 'blue');
  log(`Total Test Suites: ${report.summary.total}`, 'blue');
  log(`Passed: ${report.summary.passed}`, report.summary.passed > 0 ? 'green' : 'red');
  log(`Failed: ${report.summary.failed}`, report.summary.failed === 0 ? 'green' : 'red');
  
  log('\n📋 Detailed Results:', 'yellow');
  
  // Unit tests
  log(`  Unit Tests: ${report.unitTests.status}`, 
      report.unitTests.status === 'passed' ? 'green' : 'red');
  
  // Integration tests
  report.integrationTests.forEach(test => {
    log(`  ${test.name}: ${test.status}`, 
        test.status === 'passed' ? 'green' : 'red');
    if (test.error) {
      log(`    Error: ${test.error}`, 'red');
    }
  });
  
  log('\n' + '='.repeat(60), 'cyan');
  
  if (report.summary.success) {
    log('🎉 ALL TESTS PASSED! System integration is successful.', 'green');
  } else {
    log('⚠️ SOME TESTS FAILED. Please review the failures above.', 'red');
  }
  
  log('='.repeat(60), 'cyan');
}

async function main() {
  try {
    log('🚀 Starting Cloud Playout Integration Test Suite', 'magenta');
    log('=' .repeat(60), 'cyan');
    
    // Check prerequisites
    await checkPrerequisites();
    
    // Run database migrations
    await runDatabaseMigrations();
    
    // Run tests
    const unitResults = await runUnitTests();
    const integrationResults = await runIntegrationTests();
    
    // Generate and display report
    const report = await generateTestReport(integrationResults, unitResults);
    printSummary(report);
    
    // Exit with appropriate code
    process.exit(report.summary.success ? 0 : 1);
    
  } catch (error) {
    log(`💥 Fatal error: ${error.message}`, 'red');
    process.exit(1);
  }
}

// Handle process signals
process.on('SIGINT', () => {
  log('\n🛑 Test execution interrupted by user', 'yellow');
  process.exit(1);
});

process.on('SIGTERM', () => {
  log('\n🛑 Test execution terminated', 'yellow');
  process.exit(1);
});

// Run main function
main().catch(error => {
  log(`💥 Unhandled error: ${error.message}`, 'red');
  console.error(error.stack);
  process.exit(1);
});