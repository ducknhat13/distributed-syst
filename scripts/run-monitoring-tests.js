const { runMonitoringLoggingTests } = require('../tests/monitoring-logging.test');
const logger = require('../src/utils/logger');

async function main() {
    try {
        logger.info('Starting Monitoring and Logging tests...');
        
        // Đợi các service khởi động
        logger.info('Waiting for services to start...');
        await new Promise(resolve => setTimeout(resolve, 30000)); // Đợi 30 giây
        
        // Chạy tất cả các test
        const success = await runMonitoringLoggingTests();
        
        if (success) {
            logger.info('All monitoring and logging tests passed successfully!');
            process.exit(0);
        } else {
            logger.error('Some monitoring and logging tests failed!');
            process.exit(1);
        }
    } catch (error) {
        logger.error('Error running monitoring and logging tests:', error);
        process.exit(1);
    }
}

main(); 