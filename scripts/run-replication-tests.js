const { runReplicationTests } = require('../tests/replication.test');
const logger = require('../src/utils/logger');

async function main() {
    try {
        logger.info('Starting Replication tests...');
        
        // Đợi các service khởi động
        logger.info('Waiting for services to start...');
        await new Promise(resolve => setTimeout(resolve, 30000)); // Đợi 30 giây
        
        // Chạy tất cả các test
        const success = await runReplicationTests();
        
        if (success) {
            logger.info('All replication tests passed successfully!');
            process.exit(0);
        } else {
            logger.error('Some replication tests failed!');
            process.exit(1);
        }
    } catch (error) {
        logger.error('Error running replication tests:', error);
        process.exit(1);
    }
}

main(); 