const express = require('express');
const { Client } = require('cassandra-driver');
const app = express();
const port = 3001;

// Hàm delay
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Cấu hình Cassandra client
const client = new Client({
    contactPoints: ['cassandra1', 'cassandra2', 'cassandra3'],
    localDataCenter: 'datacenter1',
    protocolOptions: {
        port: 9042
    }
});

// Hàm kiểm tra trạng thái Cassandra cluster
async function checkCassandraStatus() {
    let retries = 10;
    while (retries > 0) {
        try {
            await client.execute('SELECT now() FROM system.local');
            console.log('Cassandra cluster is ready');
            return true;
        } catch (error) {
            console.log(`Waiting for Cassandra cluster to be ready... (${11-retries}/10)`);
            retries--;
            if (retries === 0) {
                console.error('Cassandra cluster is not ready after 10 attempts');
                return false;
            }
            await delay(5000);
        }
    }
}

// Hàm khởi tạo database
async function initDatabase() {
    // Đợi Cassandra cluster sẵn sàng
    const isReady = await checkCassandraStatus();
    if (!isReady) {
        throw new Error('Cassandra cluster is not ready');
    }

    let retries = 5;
    while (retries > 0) {
        try {
            // Tạo keyspace
            await client.execute(`
                CREATE KEYSPACE IF NOT EXISTS test_keyspace
                WITH replication = {'class': 'SimpleStrategy', 'replication_factor': 3}
            `);
            
            // Đợi một chút để keyspace được tạo
            await delay(2000);
            
            // Kết nối đến keyspace
            await client.execute('USE test_keyspace');
            
            // Tạo table
            await client.execute(`
                CREATE TABLE IF NOT EXISTS users (
                    id text PRIMARY KEY,
                    name text,
                    email text
                )
            `);
            
            console.log('Database initialized successfully');
            return;
        } catch (error) {
            console.error(`Error initializing database (attempt ${6-retries}/5):`, error);
            retries--;
            if (retries === 0) {
                console.error('Failed to initialize database after 5 attempts');
                throw error;
            }
            // Đợi 5 giây trước khi thử lại
            await delay(5000);
        }
    }
}

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'ok',
        service: 'user-service',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: 'cassandra-connected'
    });
});

// Tạo user mới
app.post('/users', async (req, res) => {
    try {
        const { name, email } = req.body;
        const id = Date.now().toString();
        
        const query = 'INSERT INTO users (id, name, email) VALUES (?, ?, ?)';
        await client.execute(query, [id, name, email], { prepare: true });
        
        res.status(201).json({ id, name, email });
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Lấy danh sách users
app.get('/users', async (req, res) => {
    try {
        console.log('Getting all users...');
        const query = 'SELECT * FROM users';
        console.log('Executing query:', query);
        const result = await client.execute(query);
        console.log('Query result:', result.rows);
        res.json(result.rows);
    } catch (error) {
        console.error('Error getting users:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Khởi động server
app.listen(port, async () => {
    try {
        await initDatabase();
        console.log(`User Service running on port ${port}`);
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}); 