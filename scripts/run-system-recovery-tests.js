const { runSystemRecoveryTests } = require('../tests/system-recovery.test');
const logger = require('../src/utils/logger');

async function main() {
    try {
        logger.info('Starting System Recovery tests...');
        logger.info('This test will verify the system can recover from various failure scenarios');
        
        // Đợi các service khởi động
        logger.info('Waiting for services to start...');
        await new Promise(resolve => setTimeout(resolve, 30000)); // Đợi 30 giây
        
        // Log cấu hình test
        logger.info('System Recovery test configuration:');
        logger.info('- Container restart testing');
        logger.info('- Cassandra node failure and rejoin');
        logger.info('- API Gateway recovery');
        logger.info('- Complete system recovery');
        
        // Chạy tất cả system recovery tests
        const success = await runSystemRecoveryTests();
        
        if (success) {
            logger.info('All system recovery tests passed successfully!');
            logger.info('System demonstrated excellent recovery capabilities');
            process.exit(0);
        } else {
            logger.error('Some system recovery tests failed!');
            logger.error('System may have recovery issues');
            process.exit(1);
        }
    } catch (error) {
        logger.error('Error running system recovery tests:', error);
        process.exit(1);
    }
}

main(); 