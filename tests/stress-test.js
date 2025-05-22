const axios = require('axios');
const logger = require('../src/utils/logger');

const API_URL = 'http://localhost:3000/api/data';
const NUM_REQUESTS = 1000;
const CONCURRENT_REQUESTS = 10;

async function makeRequest(key, value) {
    try {
        const response = await axios.post(API_URL, { key, value });
        return response.data;
    } catch (error) {
        logger.error(`Error in request for key ${key}:`, error.message);
        return null;
    }
}

async function runStressTest() {
    logger.info('Starting stress test...');
    const startTime = Date.now();
    let successCount = 0;
    let failureCount = 0;

    // Tạo các request
    const requests = Array.from({ length: NUM_REQUESTS }, (_, i) => ({
        key: `test_key_${i}`,
        value: `test_value_${i}`
    }));

    // Chia nhỏ requests thành các batch
    for (let i = 0; i < requests.length; i += CONCURRENT_REQUESTS) {
        const batch = requests.slice(i, i + CONCURRENT_REQUESTS);
        const results = await Promise.all(
            batch.map(req => makeRequest(req.key, req.value))
        );

        // Đếm kết quả
        results.forEach(result => {
            if (result) successCount++;
            else failureCount++;
        });

        // Log tiến độ
        logger.info(`Progress: ${i + batch.length}/${NUM_REQUESTS} requests completed`);
    }

    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000; // Convert to seconds

    // Log kết quả
    logger.info('Stress test completed:');
    logger.info(`Total requests: ${NUM_REQUESTS}`);
    logger.info(`Successful requests: ${successCount}`);
    logger.info(`Failed requests: ${failureCount}`);
    logger.info(`Duration: ${duration} seconds`);
    logger.info(`Requests per second: ${NUM_REQUESTS / duration}`);
}

runStressTest().catch(error => {
    logger.error('Stress test failed:', error);
    process.exit(1);
}); 