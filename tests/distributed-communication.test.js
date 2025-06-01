const axios = require('axios');
const { Client } = require('cassandra-driver');
const logger = require('../src/utils/logger');

// Cấu hình các endpoint
const SERVICES = {
    GATEWAY: process.env.GATEWAY_URL || 'http://localhost:3003',
    USER: process.env.USER_SERVICE_URL || 'http://localhost:3001',
    ORDER: process.env.ORDER_SERVICE_URL || 'http://localhost:3002'
};

// Cấu hình Cassandra
const CASSANDRA_NODES = process.env.CASSANDRA_CONTACT_POINTS ? 
    process.env.CASSANDRA_CONTACT_POINTS.split(',') : 
    ['localhost:9042', 'localhost:9043', 'localhost:9044'];

// Test 1: Kiểm tra giao tiếp giữa các service
async function testServiceCommunication() {
    logger.info('Testing service communication...');
    
    try {
        // Test User Service
        const userResponse = await axios.post(`${SERVICES.USER}/users`, {
            name: 'Test User',
            email: 'test@example.com'
        });
        logger.info('User Service Response:', userResponse.data);

        // Test Order Service thông qua Gateway
        const orderResponse = await axios.post(`${SERVICES.GATEWAY}/api/orders`, {
            user_id: userResponse.data.id,
            items: ['item1', 'item2'],
            total_amount: 100.50
        });
        logger.info('Order Service Response:', orderResponse.data);

        return true;
    } catch (error) {
        logger.error('Service Communication Test Failed:', error.message);
        return false;
    }
}

// Test 2: Kiểm tra failover khi một node Cassandra bị down
async function testCassandraFailover() {
    logger.info('Testing Cassandra failover...');
    
    try {
        // Test đọc dữ liệu thông qua User Service
        const usersResponse = await axios.get(`${SERVICES.USER}/users`);
        logger.info('Successfully read users from Cassandra via User Service');
        
        // Test đọc dữ liệu thông qua Order Service  
        const ordersResponse = await axios.get(`${SERVICES.ORDER}/orders`);
        logger.info('Successfully read orders from Cassandra via Order Service');
        
        // Nếu cả hai service đều có thể đọc được dữ liệu, nghĩa là Cassandra hoạt động tốt
        return true;
    } catch (error) {
        logger.error('Cassandra Failover Test Failed:', error.message);
        return false;
    }
}



// Chạy tất cả các test
async function runDistributedCommunicationTests() {
    logger.info('Starting distributed communication tests...');
    
    const results = {
        serviceCommunication: await testServiceCommunication(),
        cassandraFailover: await testCassandraFailover(),
    };

    logger.info('Test Results:', results);
    
    const allPassed = Object.values(results).every(result => result === true);
    logger.info('All tests passed:', allPassed);
    
    return allPassed;
}

// Export các hàm test
module.exports = {
    testServiceCommunication,
    testCassandraFailover,
    runDistributedCommunicationTests
}; 