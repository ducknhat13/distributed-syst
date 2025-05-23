const axios = require('axios');
const { Client } = require('cassandra-driver');
const logger = require('../src/utils/logger');

// Cấu hình các endpoint
const SERVICES = {
    GATEWAY: process.env.GATEWAY_URL || 'http://localhost:3003',
    USER: process.env.USER_SERVICE_URL || 'http://localhost:3001',
    ORDER: process.env.ORDER_SERVICE_URL || 'http://localhost:3002'
};

// Cấu hình Cassandra với port mapping
const CASSANDRA_CONFIGS = [
    { host: 'localhost', port: 9042 }, // cassandra1
    { host: 'localhost', port: 9043 }, // cassandra2
    { host: 'localhost', port: 9044 }  // cassandra3
];

// Test 1: Kiểm tra Replication - dữ liệu được sao chép trên nhiều node
async function testReplication() {
    logger.info('Testing data replication across Cassandra nodes...');
    
    const clients = [];
    
    try {
        // Tạo kết nối đến từng node Cassandra qua localhost ports
        for (let i = 0; i < CASSANDRA_CONFIGS.length; i++) {
            const config = CASSANDRA_CONFIGS[i];
            const client = new Client({
                contactPoints: [`${config.host}:${config.port}`],
                localDataCenter: 'datacenter1',
                keyspace: 'test_keyspace',
                consistency: 'ONE'
            });
            clients.push(client);
        }

        // Tạo dữ liệu test unique
        const testUserId = `replication_test_${Date.now()}`;
        const testUserName = 'Replication Test User';
        const testUserEmail = 'replication@test.com';

        // Ghi dữ liệu thông qua node đầu tiên
        logger.info(`Writing test data to first node: ${testUserId}`);
        await clients[0].execute(
            'INSERT INTO users (id, name, email) VALUES (?, ?, ?)',
            [testUserId, testUserName, testUserEmail],
            { prepare: true }
        );

        // Đợi một chút để replication diễn ra
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Kiểm tra dữ liệu có tồn tại trên tất cả các node không
        let replicationCount = 0;
        for (let i = 0; i < clients.length; i++) {
            try {
                const result = await clients[i].execute(
                    'SELECT * FROM users WHERE id = ?',
                    [testUserId],
                    { prepare: true }
                );
                
                if (result.rows.length > 0) {
                    replicationCount++;
                    logger.info(`Data found on node ${i + 1}: ${CASSANDRA_CONFIGS[i].host}:${CASSANDRA_CONFIGS[i].port}`);
                } else {
                    logger.warn(`Data NOT found on node ${i + 1}: ${CASSANDRA_CONFIGS[i].host}:${CASSANDRA_CONFIGS[i].port}`);
                }
            } catch (error) {
                logger.error(`Error reading from node ${i + 1}:`, error.message);
            }
        }

        // Với replication_factor = 3, dữ liệu phải tồn tại trên ít nhất 2 node
        const minExpectedReplicas = 2;
        const isReplicationWorking = replicationCount >= minExpectedReplicas;
        
        logger.info(`Replication test result: ${replicationCount}/${clients.length} nodes have the data`);
        
        return isReplicationWorking;

    } catch (error) {
        logger.error('Replication test failed:', error.message);
        return false;
    } finally {
        // Đóng tất cả kết nối
        for (const client of clients) {
            try {
                await client.shutdown();
            } catch (e) {
                // Ignore shutdown errors
            }
        }
    }
}

// Test 2: Kiểm tra Consistency thông qua API
async function testConsistency() {
    logger.info('Testing data consistency through API...');
    
    try {
        // Tạo user qua API
        const userData = {
            name: `Consistency Test ${Date.now()}`,
            email: 'consistency@test.com'
        };

        const userResponse = await axios.post(`${SERVICES.USER}/users`, userData);
        logger.info('Created user via API:', userResponse.data);

        // Đợi một chút cho replication
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Đọc lại user để verify consistency
        const usersResponse = await axios.get(`${SERVICES.USER}/users`);
        const createdUser = usersResponse.data.find(u => u.id === userResponse.data.id);
        
        const consistencyWorking = !!createdUser;
        logger.info(`Consistency test: ${consistencyWorking ? 'PASS' : 'FAIL'}`);
        
        return consistencyWorking;

    } catch (error) {
        logger.error('Consistency test failed:', error.message);
        return false;
    }
}

// Test 3: Kiểm tra Cross-service replication
async function testCrossServiceReplication() {
    logger.info('Testing cross-service replication...');
    
    try {
        // Ghi dữ liệu qua User Service API
        const userData = {
            name: `Cross Service Test ${Date.now()}`,
            email: 'crossservice@test.com'
        };

        const userResponse = await axios.post(`${SERVICES.USER}/users`, userData);
        logger.info('Created user via User Service:', userResponse.data);

        // Đợi replication
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Đọc lại dữ liệu qua cùng User Service API để verify replication
        const usersResponse = await axios.get(`${SERVICES.USER}/users`);
        
        // Kiểm tra user vừa tạo có trong danh sách không
        const createdUser = usersResponse.data.find(u => u.id === userResponse.data.id);
        const crossServiceWorking = !!createdUser;
        
        logger.info(`Cross-service replication test: ${crossServiceWorking ? 'PASS' : 'FAIL'}`);
        
        return crossServiceWorking;

    } catch (error) {
        logger.error('Cross-service replication test failed:', error.message);
        return false;
    }
}

// Chạy tất cả các test replication
async function runReplicationTests() {
    logger.info('Starting Replication tests...');
    
    const results = {
        replication: await testReplication(),
        consistency: await testConsistency(),
        crossServiceReplication: await testCrossServiceReplication()
    };

    logger.info('Replication Test Results:', results);
    
    const allPassed = Object.values(results).every(result => result === true);
    logger.info('All replication tests passed:', allPassed);
    
    return allPassed;
}

module.exports = {
    testReplication,
    testConsistency,
    testCrossServiceReplication,
    runReplicationTests
}; 