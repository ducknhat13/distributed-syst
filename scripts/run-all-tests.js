const { runDistributedCommunicationTests } = require('../tests/distributed-communication.test');
const { runReplicationTests } = require('../tests/replication.test');
const { runMonitoringLoggingTests } = require('../tests/monitoring-logging.test');
const { runAllStressTests } = require('../tests/stress-test');
const { runSystemRecoveryTests } = require('../tests/system-recovery.test');
const { runDeploymentAutomationTests } = require('../tests/deployment-automation.test');
const logger = require('../src/utils/logger');

async function runAllTests() {
    logger.info('='.repeat(80));
    logger.info('Starting Comprehensive Distributed System Testing');
    logger.info('='.repeat(80));
    
    const testResults = {};
    
    try {
        // Test 1: Distributed Communication
        logger.info('\n🌐 Test 1: Distributed Communication Testing');
        logger.info('-'.repeat(50));
        testResults.distributedCommunication = await runDistributedCommunicationTests();
        
        // Test 2: Replication
        logger.info('\n🔄 Test 2: Data Replication Testing');
        logger.info('-'.repeat(50));
        testResults.replication = await runReplicationTests();
        
        // Test 3: Monitoring & Logging
        logger.info('\n📊 Test 3: Monitoring & Logging Testing');
        logger.info('-'.repeat(50));
        testResults.monitoring = await runMonitoringLoggingTests();
        
        // Test 4: Stress Testing
        logger.info('\n⚡ Test 4: Stress Testing');
        logger.info('-'.repeat(50));
        testResults.stressTesting = await runAllStressTests();
        
        // Test 5: System Recovery
        logger.info('\n🔧 Test 5: System Recovery Testing');
        logger.info('-'.repeat(50));
        testResults.systemRecovery = await runSystemRecoveryTests();
        
        // Test 6: Deployment Automation
        logger.info('\n🚀 Test 6: Deployment Automation Testing');
        logger.info('-'.repeat(50));
        testResults.deploymentAutomation = await runDeploymentAutomationTests();
        
    } catch (error) {
        logger.error('Critical error during testing:', error);
        return false;
    }
    
    // Tổng kết kết quả
    logger.info('\n' + '='.repeat(80));
    logger.info('COMPREHENSIVE TEST RESULTS SUMMARY');
    logger.info('='.repeat(80));
    
    const testSuites = [
        { name: '🌐 Distributed Communication', key: 'distributedCommunication', required: true },
        { name: '🔄 Data Replication', key: 'replication', required: true },
        { name: '📊 Monitoring & Logging', key: 'monitoring', required: true },
        { name: '⚡ Stress Testing', key: 'stressTesting', required: true },
        { name: '🔧 System Recovery', key: 'systemRecovery', required: false },
        { name: '🚀 Deployment Automation', key: 'deploymentAutomation', required: false }
    ];
    
    let totalPassed = 0;
    let requiredPassed = 0;
    let totalRequired = 0;
    let optionalPassed = 0;
    let totalOptional = 0;
    
    testSuites.forEach(suite => {
        const status = testResults[suite.key] ? '✅ PASS' : '❌ FAIL';
        logger.info(`${suite.name}: ${status}`);
        
        if (testResults[suite.key]) {
            totalPassed++;
            if (suite.required) {
                requiredPassed++;
            } else {
                optionalPassed++;
            }
        }
        
        if (suite.required) {
            totalRequired++;
        } else {
            totalOptional++;
        }
    });
    
    logger.info('-'.repeat(80));
    logger.info(`📊 SUMMARY:`);
    logger.info(`   Required Tests: ${requiredPassed}/${totalRequired} passed`);
    logger.info(`   Optional Tests: ${optionalPassed}/${totalOptional} passed`);
    logger.info(`   Total Tests: ${totalPassed}/${testSuites.length} passed`);
    
    // Đánh giá tổng thể
    const allRequiredPassed = requiredPassed === totalRequired;
    const allTestsPassed = totalPassed === testSuites.length;
    
    if (allTestsPassed) {
        logger.info('\n🎉 EXCELLENT! All tests passed - System is production ready!');
        logger.info('✅ 4/4 Required criteria completed');
        logger.info('✅ 2/2 Optional criteria completed');
    } else if (allRequiredPassed) {
        logger.info('\n✅ GOOD! All required tests passed - System meets minimum requirements');
        logger.info('✅ 4/4 Required criteria completed');
        logger.info(`⚠️  ${totalOptional - optionalPassed}/${totalOptional} Optional criteria need attention`);
    } else {
        logger.info('\n❌ FAILED! Some required tests failed - System needs fixes');
        logger.info(`❌ ${totalRequired - requiredPassed}/${totalRequired} Required criteria failed`);
    }
    
    logger.info('\n' + '='.repeat(80));
    
    return allRequiredPassed;
}

async function main() {
    try {
        // Đợi system khởi động
        logger.info('Waiting for distributed system to start...');
        await new Promise(resolve => setTimeout(resolve, 30000));
        
        const success = await runAllTests();
        
        if (success) {
            logger.info('All required tests completed successfully!');
            process.exit(0);
        } else {
            logger.error('Some required tests failed!');
            process.exit(1);
        }
    } catch (error) {
        logger.error('Error running comprehensive tests:', error);
        process.exit(1);
    }
}

// Chỉ chạy nếu file này được execute trực tiếp
if (require.main === module) {
    main();
}

module.exports = {
    runAllTests
}; 