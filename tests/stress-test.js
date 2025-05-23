const axios = require('axios');
const logger = require('../src/utils/logger');

// Cấu hình các endpoint
const SERVICES = {
    GATEWAY: process.env.GATEWAY_URL || 'http://localhost:3003',
    USER: process.env.USER_SERVICE_URL || 'http://localhost:3001',
    ORDER: process.env.ORDER_SERVICE_URL || 'http://localhost:3002'
};

// Cấu hình stress test
const STRESS_CONFIG = {
    CONCURRENT_USERS: 50,           // Số lượng user đồng thời
    REQUESTS_PER_USER: 20,          // Số request mỗi user
    REQUEST_TIMEOUT: 10000,         // Timeout cho mỗi request (10s)
    RAMP_UP_TIME: 5000             // Thời gian tăng dần load (5s)
};

// Metrics để theo dõi
let testMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    responseTimes: [],
    errors: [],
    startTime: null,
    endTime: null
};

// Test 1: Stress test cho User Service
async function stressTestUserService() {
    logger.info('Starting stress test for User Service...');
    
    resetMetrics();
    testMetrics.startTime = Date.now();
    
    const promises = [];
    
    // Tạo concurrent users
    for (let user = 0; user < STRESS_CONFIG.CONCURRENT_USERS; user++) {
        // Delay để ramp up
        const delay = (user / STRESS_CONFIG.CONCURRENT_USERS) * STRESS_CONFIG.RAMP_UP_TIME;
        
        const userPromise = new Promise(async (resolve) => {
            setTimeout(async () => {
                await simulateUserRequests(user);
                resolve();
            }, delay);
        });
        
        promises.push(userPromise);
    }
    
    // Đợi tất cả users hoàn thành
    await Promise.all(promises);
    
    testMetrics.endTime = Date.now();
    
    const results = calculateResults();
    logger.info('User Service stress test results:', results);
    
    return results.successRate >= 0.95; // 95% success rate
}

// Mô phỏng requests của một user
async function simulateUserRequests(userId) {
    for (let req = 0; req < STRESS_CONFIG.REQUESTS_PER_USER; req++) {
        try {
            const startTime = Date.now();
            
            // Tạo user mới
            const userData = {
                name: `Stress Test User ${userId}-${req}`,
                email: `stress${userId}-${req}@test.com`
            };
            
            const response = await axios.post(`${SERVICES.USER}/users`, userData, {
                timeout: STRESS_CONFIG.REQUEST_TIMEOUT
            });
            
            const endTime = Date.now();
            const responseTime = endTime - startTime;
            
            testMetrics.totalRequests++;
            testMetrics.successfulRequests++;
            testMetrics.responseTimes.push(responseTime);
            
            // Random delay giữa các requests
            await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
            
        } catch (error) {
            testMetrics.totalRequests++;
            testMetrics.failedRequests++;
            testMetrics.errors.push(error.message);
        }
    }
}

// Test 2: Stress test cho Order Service
async function stressTestOrderService() {
    logger.info('Starting stress test for Order Service...');
    
    resetMetrics();
    testMetrics.startTime = Date.now();
    
    const promises = [];
    
    // Tạo concurrent users
    for (let user = 0; user < STRESS_CONFIG.CONCURRENT_USERS; user++) {
        const delay = (user / STRESS_CONFIG.CONCURRENT_USERS) * STRESS_CONFIG.RAMP_UP_TIME;
        
        const userPromise = new Promise(async (resolve) => {
            setTimeout(async () => {
                await simulateOrderRequests(user);
                resolve();
            }, delay);
        });
        
        promises.push(userPromise);
    }
    
    await Promise.all(promises);
    
    testMetrics.endTime = Date.now();
    
    const results = calculateResults();
    logger.info('Order Service stress test results:', results);
    
    return results.successRate >= 0.95; // 95% success rate
}

// Mô phỏng order requests
async function simulateOrderRequests(userId) {
    for (let req = 0; req < STRESS_CONFIG.REQUESTS_PER_USER; req++) {
        try {
            const startTime = Date.now();
            
            // Tạo order mới
            const orderData = {
                user_id: `stress_user_${userId}`,
                items: [`item${req}`, `item${req + 1}`],
                total_amount: (Math.random() * 100).toFixed(2)
            };
            
            const response = await axios.post(`${SERVICES.GATEWAY}/api/orders`, orderData, {
                timeout: STRESS_CONFIG.REQUEST_TIMEOUT
            });
            
            const endTime = Date.now();
            const responseTime = endTime - startTime;
            
            testMetrics.totalRequests++;
            testMetrics.successfulRequests++;
            testMetrics.responseTimes.push(responseTime);
            
            // Random delay
            await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
            
        } catch (error) {
            testMetrics.totalRequests++;
            testMetrics.failedRequests++;
            testMetrics.errors.push(error.message);
        }
    }
}

// Test 3: Mixed load test (cả User và Order)
async function mixedLoadTest() {
    logger.info('Starting mixed load test...');
    
    resetMetrics();
    testMetrics.startTime = Date.now();
    
    const promises = [];
    
    // Tạo concurrent users với mixed operations
    for (let user = 0; user < STRESS_CONFIG.CONCURRENT_USERS; user++) {
        const delay = (user / STRESS_CONFIG.CONCURRENT_USERS) * STRESS_CONFIG.RAMP_UP_TIME;
        
        const userPromise = new Promise(async (resolve) => {
            setTimeout(async () => {
                await simulateMixedRequests(user);
                resolve();
            }, delay);
        });
        
        promises.push(userPromise);
    }
    
    await Promise.all(promises);
    
    testMetrics.endTime = Date.now();
    
    const results = calculateResults();
    logger.info('Mixed load test results:', results);
    
    return results.successRate >= 0.90; // 90% success rate cho mixed load
}

// Mô phỏng mixed requests
async function simulateMixedRequests(userId) {
    for (let req = 0; req < STRESS_CONFIG.REQUESTS_PER_USER; req++) {
        try {
            const startTime = Date.now();
            let response;
            
            // Random operation: 50% user creation, 30% order creation, 20% read operations
            const operation = Math.random();
            
            if (operation < 0.5) {
                // Tạo user
                const userData = {
                    name: `Mixed Test User ${userId}-${req}`,
                    email: `mixed${userId}-${req}@test.com`
                };
                response = await axios.post(`${SERVICES.USER}/users`, userData, {
                    timeout: STRESS_CONFIG.REQUEST_TIMEOUT
                });
            } else if (operation < 0.8) {
                // Tạo order
                const orderData = {
                    user_id: `mixed_user_${userId}`,
                    items: [`item${req}`],
                    total_amount: (Math.random() * 50).toFixed(2)
                };
                response = await axios.post(`${SERVICES.GATEWAY}/api/orders`, orderData, {
                    timeout: STRESS_CONFIG.REQUEST_TIMEOUT
                });
            } else {
                // Read operations
                if (Math.random() < 0.5) {
                    response = await axios.get(`${SERVICES.USER}/users`, {
                        timeout: STRESS_CONFIG.REQUEST_TIMEOUT
                    });
                } else {
                    response = await axios.get(`${SERVICES.GATEWAY}/api/orders`, {
                        timeout: STRESS_CONFIG.REQUEST_TIMEOUT
                    });
                }
            }
            
            const endTime = Date.now();
            const responseTime = endTime - startTime;
            
            testMetrics.totalRequests++;
            testMetrics.successfulRequests++;
            testMetrics.responseTimes.push(responseTime);
            
            // Random delay
            await new Promise(resolve => setTimeout(resolve, Math.random() * 150));
            
        } catch (error) {
            testMetrics.totalRequests++;
            testMetrics.failedRequests++;
            testMetrics.errors.push(error.message);
        }
    }
}

// Test 4: Monitor system performance during load
async function monitorSystemPerformance() {
    logger.info('Monitoring system performance during load...');
    
    const performanceMetrics = [];
    const monitoringInterval = 2000; // 2 seconds
    const monitoringDuration = 30000; // 30 seconds
    
    const startTime = Date.now();
    
    const monitoringPromise = new Promise((resolve) => {
        const interval = setInterval(async () => {
            try {
                const currentTime = Date.now();
                
                // Get metrics from API Gateway
                const metricsResponse = await axios.get(`${SERVICES.GATEWAY}/metrics`, {
                    timeout: 5000
                });
                
                performanceMetrics.push({
                    timestamp: currentTime,
                    uptime: metricsResponse.data.process?.uptime,
                    memory: metricsResponse.data.process?.memory,
                    requests: metricsResponse.data.requests
                });
                
                if (currentTime - startTime >= monitoringDuration) {
                    clearInterval(interval);
                    resolve();
                }
                
            } catch (error) {
                logger.error('Error monitoring performance:', error.message);
            }
        }, monitoringInterval);
    });
    
    // Tạo load trong khi monitor
    const loadPromise = new Promise(async (resolve) => {
        const promises = [];
        
        for (let i = 0; i < 20; i++) {
            promises.push(simulateUserRequests(i));
        }
        
        await Promise.all(promises);
        resolve();
    });
    
    await Promise.all([monitoringPromise, loadPromise]);
    
    logger.info('Performance monitoring results:', {
        totalSnapshots: performanceMetrics.length,
        averageUptime: performanceMetrics.reduce((sum, m) => sum + (m.uptime || 0), 0) / performanceMetrics.length,
        memoryUsage: performanceMetrics.map(m => m.memory)
    });
    
    return performanceMetrics.length > 0;
}

// Utility functions
function resetMetrics() {
    testMetrics = {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        responseTimes: [],
        errors: [],
        startTime: null,
        endTime: null
    };
}

function calculateResults() {
    const duration = testMetrics.endTime - testMetrics.startTime;
    const successRate = testMetrics.totalRequests > 0 ? 
        testMetrics.successfulRequests / testMetrics.totalRequests : 0;
    
    const avgResponseTime = testMetrics.responseTimes.length > 0 ?
        testMetrics.responseTimes.reduce((sum, time) => sum + time, 0) / testMetrics.responseTimes.length : 0;
    
    const minResponseTime = testMetrics.responseTimes.length > 0 ?
        Math.min(...testMetrics.responseTimes) : 0;
    
    const maxResponseTime = testMetrics.responseTimes.length > 0 ?
        Math.max(...testMetrics.responseTimes) : 0;
    
    const requestsPerSecond = duration > 0 ? 
        (testMetrics.totalRequests / duration) * 1000 : 0;
    
    return {
        totalRequests: testMetrics.totalRequests,
        successfulRequests: testMetrics.successfulRequests,
        failedRequests: testMetrics.failedRequests,
        successRate: successRate,
        duration: duration,
        avgResponseTime: avgResponseTime,
        minResponseTime: minResponseTime,
        maxResponseTime: maxResponseTime,
        requestsPerSecond: requestsPerSecond,
        errorTypes: [...new Set(testMetrics.errors)]
    };
}

// Chạy tất cả stress tests
async function runAllStressTests() {
    logger.info('Starting comprehensive stress testing...');
    
    const results = {
        userServiceStress: await stressTestUserService(),
        orderServiceStress: await stressTestOrderService(),
        mixedLoadTest: await mixedLoadTest(),
        performanceMonitoring: await monitorSystemPerformance()
    };
    
    logger.info('Stress Test Results:', results);
    
    const allPassed = Object.values(results).every(result => result === true);
    logger.info('All stress tests passed:', allPassed);
    
    return allPassed;
}

module.exports = {
    stressTestUserService,
    stressTestOrderService,
    mixedLoadTest,
    monitorSystemPerformance,
    runAllStressTests
}; 