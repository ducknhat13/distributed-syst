const axios = require('axios');
const { execSync } = require('child_process');
const logger = require('../src/utils/logger');

// Cấu hình các endpoint
const SERVICES = {
    GATEWAY: process.env.GATEWAY_URL || 'http://localhost:3003',
    USER: process.env.USER_SERVICE_URL || 'http://localhost:3001',
    ORDER: process.env.ORDER_SERVICE_URL || 'http://localhost:3002'
};

// Utility function để chạy docker compose commands
function runDockerCommand(command) {
    try {
        const result = execSync(`docker-compose -f docker-compose.distributed.yml ${command}`, {
            encoding: 'utf8',
            timeout: 60000 // 60 seconds timeout
        });
        return { success: true, output: result };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Wait for service to be ready
async function waitForService(url, maxRetries = 30, retryInterval = 2000) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            const response = await axios.get(`${url}/health`, { timeout: 5000 });
            if (response.status === 200) {
                return true;
            }
        } catch (error) {
            logger.info(`Waiting for service ${url} to be ready... (${i + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, retryInterval));
        }
    }
    return false;
}

// Test 1: Service Recovery after Container Restart
async function testServiceRecovery() {
    logger.info('Testing service recovery after container restart...');
    
    try {
        // Bước 1: Verify tất cả services đang chạy
        logger.info('Step 1: Verifying all services are running...');
        const initialHealth = await checkAllServicesHealth();
        if (!initialHealth) {
            throw new Error('Not all services are healthy initially');
        }
        
        // Bước 2: Tạo một số dữ liệu test
        logger.info('Step 2: Creating test data...');
        const userData = {
            name: 'Recovery Test User',
            email: 'recovery@test.com'
        };
        const userResponse = await axios.post(`${SERVICES.USER}/users`, userData);
        const testUserId = userResponse.data.id;
        logger.info('Created test user:', testUserId);
        
        // Bước 3: Restart User Service container
        logger.info('Step 3: Restarting User Service container...');
        const restartResult = runDockerCommand('restart user_service');
        if (!restartResult.success) {
            throw new Error(`Failed to restart user service: ${restartResult.error}`);
        }
        
        // Bước 4: Đợi service recovery
        logger.info('Step 4: Waiting for User Service to recover...');
        await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
        
        const isReady = await waitForService(SERVICES.USER);
        if (!isReady) {
            throw new Error('User Service failed to recover after restart');
        }
        
        // Bước 5: Verify dữ liệu vẫn tồn tại
        logger.info('Step 5: Verifying data persistence after recovery...');
        const usersResponse = await axios.get(`${SERVICES.USER}/users`);
        const recoveredUser = usersResponse.data.find(u => u.id === testUserId);
        
        if (!recoveredUser) {
            throw new Error('Data lost after service recovery');
        }
        
        logger.info('Service recovery test: PASS');
        return true;
        
    } catch (error) {
        logger.error('Service recovery test failed:', error.message);
        return false;
    }
}

// Test 2: Cassandra Node Recovery
async function testCassandraNodeRecovery() {
    logger.info('Testing Cassandra node recovery...');
    
    try {
        // Bước 1: Tạo dữ liệu test
        logger.info('Step 1: Creating test data for Cassandra recovery...');
        const testData = {
            name: 'Cassandra Recovery Test',
            email: 'cassandra-recovery@test.com'
        };
        const response = await axios.post(`${SERVICES.USER}/users`, testData);
        const testUserId = response.data.id;
        
        // Bước 2: Stop một Cassandra node
        logger.info('Step 2: Stopping Cassandra node...');
        const stopResult = runDockerCommand('stop cassandra2');
        if (!stopResult.success) {
            throw new Error(`Failed to stop cassandra2: ${stopResult.error}`);
        }
        
        // Bước 3: Verify hệ thống vẫn hoạt động với 2 nodes
        logger.info('Step 3: Verifying system works with 2 Cassandra nodes...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        const testData2 = {
            name: 'Test during node down',
            email: 'nodedown@test.com'
        };
        const response2 = await axios.post(`${SERVICES.USER}/users`, testData2);
        logger.info('Successfully created user while node is down:', response2.data.id);
        
        // Bước 4: Restart Cassandra node
        logger.info('Step 4: Restarting Cassandra node...');
        const startResult = runDockerCommand('start cassandra2');
        if (!startResult.success) {
            throw new Error(`Failed to start cassandra2: ${startResult.error}`);
        }
        
        // Bước 5: Đợi node rejoin cluster
        logger.info('Step 5: Waiting for Cassandra node to rejoin cluster...');
        await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30 seconds for rejoin
        
        // Bước 6: Verify dữ liệu consistency
        logger.info('Step 6: Verifying data consistency after node rejoin...');
        const usersResponse = await axios.get(`${SERVICES.USER}/users`);
        const user1 = usersResponse.data.find(u => u.id === testUserId);
        const user2 = usersResponse.data.find(u => u.id === response2.data.id);
        
        if (!user1 || !user2) {
            throw new Error('Data inconsistency after Cassandra node rejoin');
        }
        
        logger.info('Cassandra node recovery test: PASS');
        return true;
        
    } catch (error) {
        logger.error('Cassandra node recovery test failed:', error.message);
        return false;
    }
}

// Test 3: API Gateway Recovery
async function testAPIGatewayRecovery() {
    logger.info('Testing API Gateway recovery...');
    
    try {
        // Bước 1: Verify initial state
        logger.info('Step 1: Verifying API Gateway is working...');
        await axios.get(`${SERVICES.GATEWAY}/health`);
        
        // Bước 2: Stop API Gateway
        logger.info('Step 2: Stopping API Gateway...');
        const stopResult = runDockerCommand('stop api_gateway');
        if (!stopResult.success) {
            throw new Error(`Failed to stop api_gateway: ${stopResult.error}`);
        }
        
        // Bước 3: Verify gateway is down
        logger.info('Step 3: Verifying API Gateway is down...');
        try {
            await axios.get(`${SERVICES.GATEWAY}/health`, { timeout: 2000 });
            throw new Error('API Gateway should be down but still responding');
        } catch (error) {
            if (error.message.includes('should be down')) {
                throw error;
            }
            // Expected - gateway is down
            logger.info('API Gateway is down as expected');
        }
        
        // Bước 4: Start API Gateway
        logger.info('Step 4: Starting API Gateway...');
        const startResult = runDockerCommand('start api_gateway');
        if (!startResult.success) {
            throw new Error(`Failed to start api_gateway: ${startResult.error}`);
        }
        
        // Bước 5: Wait for recovery
        logger.info('Step 5: Waiting for API Gateway recovery...');
        const isReady = await waitForService(SERVICES.GATEWAY);
        if (!isReady) {
            throw new Error('API Gateway failed to recover');
        }
        
        // Bước 6: Verify functionality
        logger.info('Step 6: Verifying API Gateway functionality after recovery...');
        const healthResponse = await axios.get(`${SERVICES.GATEWAY}/health`);
        if (healthResponse.status !== 200) {
            throw new Error('API Gateway not functioning properly after recovery');
        }
        
        logger.info('API Gateway recovery test: PASS');
        return true;
        
    } catch (error) {
        logger.error('API Gateway recovery test failed:', error.message);
        return false;
    }
}

// Test 4: Complete System Recovery
async function testCompleteSystemRecovery() {
    logger.info('Testing complete system recovery...');
    
    try {
        // Bước 1: Tạo dữ liệu test trước khi restart
        logger.info('Step 1: Creating test data before system restart...');
        const userData = {
            name: 'System Recovery Test',
            email: 'system-recovery@test.com'
        };
        const userResponse = await axios.post(`${SERVICES.USER}/users`, userData);
        const testUserId = userResponse.data.id;
        
        const orderData = {
            user_id: testUserId,
            items: ['recovery-item'],
            total_amount: 99.99
        };
        const orderResponse = await axios.post(`${SERVICES.GATEWAY}/api/orders`, orderData);
        const testOrderId = orderResponse.data.id;
        
        // Bước 2: Restart toàn bộ hệ thống
        logger.info('Step 2: Restarting entire system...');
        const restartResult = runDockerCommand('restart');
        if (!restartResult.success) {
            throw new Error(`Failed to restart system: ${restartResult.error}`);
        }
        
        // Bước 3: Đợi hệ thống recovery
        logger.info('Step 3: Waiting for complete system recovery...');
        await new Promise(resolve => setTimeout(resolve, 60000)); // Wait 60 seconds
        
        // Bước 4: Verify tất cả services
        logger.info('Step 4: Verifying all services after recovery...');
        const isSystemReady = await waitForAllServices();
        if (!isSystemReady) {
            throw new Error('System failed to recover completely');
        }
        
        // Bước 5: Verify data persistence
        logger.info('Step 5: Verifying data persistence after system recovery...');
        const usersResponse = await axios.get(`${SERVICES.USER}/users`);
        const ordersResponse = await axios.get(`${SERVICES.GATEWAY}/api/orders`);
        
        const recoveredUser = usersResponse.data.find(u => u.id === testUserId);
        const recoveredOrder = ordersResponse.data.find(o => o.id === testOrderId);
        
        if (!recoveredUser || !recoveredOrder) {
            throw new Error('Data lost after complete system recovery');
        }
        
        logger.info('Complete system recovery test: PASS');
        return true;
        
    } catch (error) {
        logger.error('Complete system recovery test failed:', error.message);
        return false;
    }
}

// Helper functions
async function checkAllServicesHealth() {
    try {
        await axios.get(`${SERVICES.GATEWAY}/health`, { timeout: 5000 });
        await axios.get(`${SERVICES.USER}/health`, { timeout: 5000 });
        await axios.get(`${SERVICES.ORDER}/health`, { timeout: 5000 });
        return true;
    } catch (error) {
        return false;
    }
}

async function waitForAllServices() {
    const services = [
        { name: 'Gateway', url: SERVICES.GATEWAY },
        { name: 'User', url: SERVICES.USER },
        { name: 'Order', url: SERVICES.ORDER }
    ];
    
    for (const service of services) {
        logger.info(`Waiting for ${service.name} service...`);
        const isReady = await waitForService(service.url, 30, 3000);
        if (!isReady) {
            logger.error(`${service.name} service failed to start`);
            return false;
        }
        logger.info(`${service.name} service is ready`);
    }
    
    return true;
}

// Chạy tất cả recovery tests
async function runSystemRecoveryTests() {
    logger.info('Starting System Recovery tests...');
    
    const results = {
        serviceRecovery: await testServiceRecovery(),
        cassandraNodeRecovery: await testCassandraNodeRecovery(),
        apiGatewayRecovery: await testAPIGatewayRecovery(),
        completeSystemRecovery: await testCompleteSystemRecovery()
    };
    
    logger.info('System Recovery Test Results:', results);
    
    const allPassed = Object.values(results).every(result => result === true);
    logger.info('All system recovery tests passed:', allPassed);
    
    return allPassed;
}

module.exports = {
    testServiceRecovery,
    testCassandraNodeRecovery,
    testAPIGatewayRecovery,
    testCompleteSystemRecovery,
    runSystemRecoveryTests
}; 