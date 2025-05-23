const { Client } = require('cassandra-driver');
const config = require('./config');
const logger = require('../utils/logger');

const contactPoints = ['localhost:9042', 'localhost:9043', 'localhost:9044'];
const localDataCenter = 'datacenter1';

const client = new Client({
    contactPoints: contactPoints,
    localDataCenter: localDataCenter,
    keyspace: 'your_keyspace',
    pooling: {
        maxRequestsPerConnection: 32768
    },
    socketOptions: {
        connectTimeout: 5000
    }
});

// Khởi tạo keyspace nếu chưa tồn tại
async function initializeKeyspace() {
    try {
        const query = `
            CREATE KEYSPACE IF NOT EXISTS ${config.cassandra.keyspace}
            WITH replication = {
                'class': '${config.cassandra.replication.class}',
                'replication_factor': ${config.cassandra.replication.replication_factor}
            }
        `;
        await client.execute(query);
        logger.info('Keyspace initialized successfully');
    } catch (error) {
        logger.error('Error initializing keyspace:', error);
        throw error;
    }
}

// Khởi tạo tables
async function initializeTables() {
    try {
        const queries = [
            `CREATE TABLE IF NOT EXISTS ${config.cassandra.keyspace}.data (
                key text PRIMARY KEY,
                value text,
                created_at timestamp,
                updated_at timestamp
            )`
        ];

        for (const query of queries) {
            await client.execute(query);
        }
        logger.info('Tables initialized successfully');
    } catch (error) {
        logger.error('Error initializing tables:', error);
        throw error;
    }
}

// Khởi tạo database
async function initialize() {
    try {
        await initializeKeyspace();
        await initializeTables();
        logger.info('Database initialized successfully');
    } catch (error) {
        logger.error('Error initializing database:', error);
        throw error;
    }
}

module.exports = {
    client,
    initialize
}; 