const { runDeploymentAutomationTests } = require('../tests/deployment-automation.test');
const logger = require('../src/utils/logger');

async function main() {
    try {
        logger.info('Starting Deployment Automation tests...');
        logger.info('This test will verify automated deployment capabilities');
        
        // Log cấu hình test
        logger.info('Deployment Automation test configuration:');
        logger.info('- Docker Compose automation');
        logger.info('- Deployment script automation');
        logger.info('- Health check automation');
        logger.info('- Scaling automation');
        
        // Chạy tất cả deployment automation tests
        const success = await runDeploymentAutomationTests();
        
        if (success) {
            logger.info('All deployment automation tests passed successfully!');
            logger.info('System demonstrated excellent automated deployment capabilities');
            process.exit(0);
        } else {
            logger.error('Some deployment automation tests failed!');
            logger.error('System may have deployment automation issues');
            process.exit(1);
        }
    } catch (error) {
        logger.error('Error running deployment automation tests:', error);
        process.exit(1);
    }
}

main(); 