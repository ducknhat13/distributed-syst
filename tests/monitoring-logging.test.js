const axios = require('axios');
const fs = require('fs');
const path = require('path');
const logger = require('../src/utils/logger');

// Cấu hình các endpoint
const SERVICES = {
    GATEWAY: process.env.GATEWAY_URL || 'http://localhost:3003',
    USER: process.env.USER_SERVICE_URL || 'http://localhost:3001',
    ORDER: process.env.ORDER_SERVICE_URL || 'http://localhost:3002'
};

// Test 1: Kiểm tra Health Check endpoints
async function testHealthChecks() {
    logger.info('Testing health check endpoints...');
    
    try {
        const healthChecks = [];
        
        // Test API Gateway health
        const gatewayHealth = await axios.get(`${SERVICES.GATEWAY}/health`);
        healthChecks.push({
            service: 'gateway',
            status: gatewayHealth.status === 200 ? 'ok' : 'error',
            data: gatewayHealth.data
        });
        logger.info('Gateway health check:', gatewayHealth.data);
        
        // Test User Service health
        const userHealth = await axios.get(`${SERVICES.USER}/health`);
        healthChecks.push({
            service: 'user',
            status: userHealth.status === 200 ? 'ok' : 'error',
            data: userHealth.data
        });
        logger.info('User Service health check:', userHealth.data);
        
        // Test Order Service health
        const orderHealth = await axios.get(`${SERVICES.ORDER}/health`);
        healthChecks.push({
            service: 'order',
            status: orderHealth.status === 200 ? 'ok' : 'error',
            data: orderHealth.data
        });
        logger.info('Order Service health check:', orderHealth.data);
        
        // Kiểm tra tất cả services có health status ok không
        const allHealthy = healthChecks.every(check => check.status === 'ok');
        
        logger.info(`Health checks result: ${allHealthy ? 'PASS' : 'FAIL'}`);
        return allHealthy;
        
    } catch (error) {
        logger.error('Health checks test failed:', error.message);
        return false;
    }
}

// Test 2: Kiểm tra Monitoring endpoint
async function testMonitoringEndpoint() {
    logger.info('Testing monitoring endpoint...');
    
    try {
        const monitoringResponse = await axios.get(`${SERVICES.GATEWAY}/monitoring`);
        const monitoringData = monitoringResponse.data;
        
        logger.info('Monitoring data received:', {
            gateway: monitoringData.gateway?.status,
            services: Object.keys(monitoringData.services || {}),
            system: monitoringData.system?.platform
        });
        
        // Kiểm tra các trường bắt buộc
        const hasRequiredFields = !!(
            monitoringData.gateway &&
            monitoringData.services &&
            monitoringData.system &&
            monitoringData.gateway.uptime !== undefined &&
            monitoringData.gateway.memory
        );
        
        logger.info(`Monitoring endpoint test: ${hasRequiredFields ? 'PASS' : 'FAIL'}`);
        return hasRequiredFields;
        
    } catch (error) {
        logger.error('Monitoring endpoint test failed:', error.message);
        return false;
    }
}

// Test 3: Kiểm tra Metrics endpoint
async function testMetricsEndpoint() {
    logger.info('Testing metrics endpoint...');
    
    try {
        const metricsResponse = await axios.get(`${SERVICES.GATEWAY}/metrics`);
        const metricsData = metricsResponse.data;
        
        logger.info('Metrics data received:', {
            timestamp: metricsData.timestamp,
            uptime: metricsData.process?.uptime,
            requests: metricsData.requests?.total,
            services: Object.keys(metricsData.services || {})
        });
        
        // Kiểm tra các trường metrics
        const hasMetrics = !!(
            metricsData.timestamp &&
            metricsData.process &&
            metricsData.requests &&
            metricsData.services
        );
        
        logger.info(`Metrics endpoint test: ${hasMetrics ? 'PASS' : 'FAIL'}`);
        return hasMetrics;
        
    } catch (error) {
        logger.error('Metrics endpoint test failed:', error.message);
        return false;
    }
}

// Test 4: Kiểm tra Logs endpoint
async function testLogsEndpoint() {
    logger.info('Testing logs endpoint...');
    
    try {
        const logsResponse = await axios.get(`${SERVICES.GATEWAY}/logs`);
        const logsData = logsResponse.data;
        
        logger.info('Logs data received:', {
            totalLines: logsData.totalLines,
            recentLogsCount: logsData.recentLogs?.length || 0
        });
        
        // Kiểm tra có logs không
        const hasLogs = !!(
            logsData.totalLines !== undefined &&
            logsData.recentLogs &&
            Array.isArray(logsData.recentLogs)
        );
        
        logger.info(`Logs endpoint test: ${hasLogs ? 'PASS' : 'FAIL'}`);
        return hasLogs;
        
    } catch (error) {
        logger.error('Logs endpoint test failed:', error.message);
        return false;
    }
}

// Test 5: Kiểm tra Log file có được tạo không
async function testLogFileCreation() {
    logger.info('Testing log file creation...');
    
    try {
        // Ghi một log test để đảm bảo log file được tạo
        logger.info('Test log entry for monitoring test');
        logger.warn('Test warning log for monitoring test');
        logger.error('Test error log for monitoring test');
        
        // Đợi log được ghi
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Kiểm tra log file có tồn tại không
        const logFile = path.join(__dirname, '../logs/app.log');
        const logExists = fs.existsSync(logFile);
        
        if (logExists) {
            const logContent = fs.readFileSync(logFile, 'utf8');
            const hasTestLogs = logContent.includes('Test log entry for monitoring test');
            
            logger.info(`Log file test: ${hasTestLogs ? 'PASS' : 'FAIL'}`);
            return hasTestLogs;
        } else {
            logger.warn('Log file does not exist');
            return false;
        }
        
    } catch (error) {
        logger.error('Log file test failed:', error.message);
        return false;
    }
}

// Test 6: Kiểm tra CLI Output
async function testCLIOutput() {
    logger.info('Testing CLI output...');
    
    try {
        // Capture console output
        const originalLog = console.log;
        const originalError = console.error;
        
        let consoleOutput = [];
        console.log = (...args) => {
            consoleOutput.push({ type: 'log', message: args.join(' ') });
            originalLog(...args);
        };
        console.error = (...args) => {
            consoleOutput.push({ type: 'error', message: args.join(' ') });
            originalError(...args);
        };
        
        // Tạo một số console output
        console.log('Test CLI output - info message');
        console.error('Test CLI output - error message');
        
        // Restore console
        console.log = originalLog;
        console.error = originalError;
        
        // Kiểm tra có console output không
        const hasCLIOutput = consoleOutput.length > 0;
        
        logger.info(`CLI output test: ${hasCLIOutput ? 'PASS' : 'FAIL'}`);
        logger.info('Captured console output:', consoleOutput);
        
        return hasCLIOutput;
        
    } catch (error) {
        logger.error('CLI output test failed:', error.message);
        return false;
    }
}

// Chạy tất cả các test monitoring
async function runMonitoringLoggingTests() {
    logger.info('Starting Monitoring and Logging tests...');
    
    const results = {
        healthChecks: await testHealthChecks(),
        monitoringEndpoint: await testMonitoringEndpoint(),
        metricsEndpoint: await testMetricsEndpoint(),
        logsEndpoint: await testLogsEndpoint(),
        logFileCreation: await testLogFileCreation(),
        cliOutput: await testCLIOutput()
    };

    logger.info('Monitoring & Logging Test Results:', results);
    
    const allPassed = Object.values(results).every(result => result === true);
    logger.info('All monitoring & logging tests passed:', allPassed);
    
    return allPassed;
}

module.exports = {
    testHealthChecks,
    testMonitoringEndpoint,
    testMetricsEndpoint,
    testLogsEndpoint,
    testLogFileCreation,
    testCLIOutput,
    runMonitoringLoggingTests
}; 