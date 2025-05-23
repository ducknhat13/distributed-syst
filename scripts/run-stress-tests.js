const { runAllStressTests } = require('../tests/stress-test');
const logger = require('../src/utils/logger');

async function main() {
    try {
        logger.info('Starting comprehensive stress testing...');
        logger.info('This test will simulate high load with concurrent users and multiple requests');
        
        // Đợi các service khởi động
        logger.info('Waiting for services to start...');
        await new Promise(resolve => setTimeout(resolve, 30000)); // Đợi 30 giây
        
        // Log cấu hình stress test
        logger.info('Stress test configuration:');
        logger.info('- Concurrent users: 50');
        logger.info('- Requests per user: 20');
        logger.info('- Total expected requests: ~1000 per test');
        logger.info('- Request timeout: 10 seconds');
        logger.info('- Ramp up time: 5 seconds');
        
        // Chạy tất cả stress tests
        const success = await runAllStressTests();
        
        if (success) {
            logger.info('All stress tests passed successfully!');
            logger.info('System demonstrated good performance under load');
            process.exit(0);
        } else {
            logger.error('Some stress tests failed!');
            logger.error('System may have performance issues under load');
            process.exit(1);
        }
    } catch (error) {
        logger.error('Error running stress tests:', error);
        process.exit(1);
    }
}

main(); 