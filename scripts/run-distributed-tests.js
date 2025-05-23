const { runAllTests } = require('../tests/distributed-communication.test');
const logger = require('../src/utils/logger');

async function main() {
    try {
        logger.info('Starting distributed system tests...');
        
        // Đợi các service khởi động
        logger.info('Waiting for services to start...');
        await new Promise(resolve => setTimeout(resolve, 30000)); // Đợi 30 giây
        
        // Chạy tất cả các test
        const success = await runAllTests();
        
        if (success) {
            logger.info('All distributed communication tests passed successfully!');
            process.exit(0);
        } else {
            logger.error('Some distributed communication tests failed!');
            process.exit(1);
        }
    } catch (error) {
        logger.error('Error running distributed tests:', error);
        process.exit(1);
    }
}

main(); 