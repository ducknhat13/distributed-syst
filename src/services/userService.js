/**
 * =============================================================================
 * USER SERVICE - DISTRIBUTED MICROSERVICE
 * =============================================================================
 * 
 * Service này quản lý tất cả operations liên quan đến Users
 * Chạy trên port 3001 và kết nối tới 3-node Cassandra cluster
 * 
 * Features:
 * -  CRUD operations cho Users
 * -  Health check endpoint
 * -  Auto database initialization
 * -  Connection retry mechanism
 * -  Detailed logging
 * 
 * Author: Distributed System Team
 * Version: 2.0.0 (Updated with centralized connection)
 * =============================================================================
 */

const express = require('express');
const { 
    initializeDatabase, 
    executeQuery, 
    checkCassandraHealth,
    closeConnection 
} = require('../database/cassandraConnection');

// =============================================================================
// EXPRESS APP CONFIGURATION
// =============================================================================

const app = express();
const port = 3001;

// Middleware để parse JSON request body
app.use(express.json());

// =============================================================================
// HEALTH CHECK ENDPOINT
// =============================================================================

/**
 * Health Check Endpoint
 * Kiểm tra trạng thái service và database connection
 * 
 * GET /health
 * 
 * Response format:
 * {
 *   "status": "ok",
 *   "service": "user-service", 
 *   "port": 3001,
 *   "timestamp": "2024-01-01T00:00:00.000Z",
 *   "uptime": 123.456,
 *   "database": "cassandra-connected",
 *   "cluster_health": true
 * }
 */
app.get('/health', async (req, res) => {
    try {
        console.log('🔍 Health check request received');
        
        // Kiểm tra database health
        const isDatabaseHealthy = await checkCassandraHealth();
        
        const healthStatus = {
            status: isDatabaseHealthy ? 'ok' : 'degraded',
            service: 'user-service',
            port: port,
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            database: isDatabaseHealthy ? 'cassandra-connected' : 'cassandra-disconnected',
            cluster_health: isDatabaseHealthy,
            version: '2.0.0'
        };
        
        console.log('✅ Health check completed:', healthStatus.status);
        
        // Return appropriate HTTP status
        const statusCode = isDatabaseHealthy ? 200 : 503;
        res.status(statusCode).json(healthStatus);
        
    } catch (error) {
        console.error('❌ Health check failed:', error.message);
        
        res.status(503).json({
            status: 'error',
            service: 'user-service',
            port: port,
            timestamp: new Date().toISOString(),
            error: error.message
        });
    }
});

// =============================================================================
// USER CRUD OPERATIONS
// =============================================================================

/**
 * Tạo User Mới
 * 
 * POST /users
 * Body: {
 *   "name": "Nguyen Van A",
 *   "email": "nguyenvana@example.com"
 * }
 * 
 * Response: {
 *   "id": "1704067200000",
 *   "name": "Nguyen Van A", 
 *   "email": "nguyenvana@example.com",
 *   "created_at": "2024-01-01T00:00:00.000Z"
 * }
 */
app.post('/users', async (req, res) => {
    try {
        console.log('👤 Tạo user mới - Request received');
        console.log('📝 Request body:', req.body);
        
        // Validation input
        const { name, email } = req.body;
        
        if (!name || !email) {
            console.log('❌ Validation failed: Missing required fields');
            return res.status(400).json({ 
                error: 'Name và email là bắt buộc',
                required_fields: ['name', 'email']
            });
        }
        
        // Validate email format (basic)
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            console.log('❌ Validation failed: Invalid email format');
            return res.status(400).json({ 
                error: 'Email format không hợp lệ',
                provided_email: email
            });
        }
        
        // Generate unique ID using timestamp
        const id = Date.now().toString();
        const created_at = new Date();
        
        console.log('🔄 Inserting user vào database...');
        console.log('📊 User data:', { id, name, email, created_at });
        
        // Sử dụng prepared statement để insert user
        const query = `
            INSERT INTO users (id, name, email, created_at, updated_at) 
            VALUES (?, ?, ?, ?, ?)
        `;
        
        const params = [id, name, email, created_at, created_at];
        
        // Execute query through centralized connection
        await executeQuery(query, params);
        
        // Response data
        const responseData = {
            id,
            name,
            email,
            created_at: created_at.toISOString(),
            message: 'User đã được tạo thành công'
        };
        
        console.log('✅ User created successfully:', responseData);
        res.status(201).json(responseData);
        
    } catch (error) {
        console.error('❌ Error creating user:', error.message);
        console.error('📝 Stack trace:', error.stack);
        
        res.status(500).json({ 
            error: 'Lỗi server khi tạo user',
            details: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * Lấy Danh Sách Tất Cả Users
 * 
 * GET /users
 * Query params (optional):
 * - limit: Giới hạn số lượng records (default: 100)
 * 
 * Response: [
 *   {
 *     "id": "1704067200000",
 *     "name": "Nguyen Van A",
 *     "email": "nguyenvana@example.com", 
 *     "created_at": "2024-01-01T00:00:00.000Z"
 *   }
 * ]
 */
app.get('/users', async (req, res) => {
    try {
        console.log('📋 Get all users - Request received');
        
        // Parse query parameters
        const limit = parseInt(req.query.limit) || 100;
        console.log('📊 Query params:', { limit });
        
        // Build query with limit
        const query = 'SELECT * FROM users LIMIT ?';
        const params = [limit];
        
        console.log('🔍 Executing query to get users...');
        
        // Execute query
        const result = await executeQuery(query, params);
        
        // Transform result để format timestamps
        const users = result.rows.map(row => ({
            id: row.id,
            name: row.name,
            email: row.email,
            created_at: row.created_at ? row.created_at.toISOString() : null,
            updated_at: row.updated_at ? row.updated_at.toISOString() : null
        }));
        
        console.log('✅ Users retrieved successfully. Count:', users.length);
        console.log('📊 Sample data:', users.slice(0, 2)); // Log first 2 records only
        
        res.json({
            users,
            count: users.length,
            limit: limit,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Error getting users:', error.message);
        console.error('📝 Stack trace:', error.stack);
        
        res.status(500).json({ 
            error: 'Lỗi server khi lấy danh sách users',
            details: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * Lấy Thông Tin User Theo ID
 * 
 * GET /users/:id
 * 
 * Response: {
 *   "id": "1704067200000",
 *   "name": "Nguyen Van A",
 *   "email": "nguyenvana@example.com",
 *   "created_at": "2024-01-01T00:00:00.000Z"
 * }
 */
app.get('/users/:id', async (req, res) => {
    try {
        const userId = req.params.id;
        console.log('🔍 Get user by ID - Request received:', userId);
        
        // Validate ID format
        if (!userId || userId.trim() === '') {
            console.log('❌ Validation failed: Invalid user ID');
            return res.status(400).json({ 
                error: 'User ID không hợp lệ',
                provided_id: userId
            });
        }
        
        console.log('🔍 Executing query to get user by ID...');
        
        // Query user by ID
        const query = 'SELECT * FROM users WHERE id = ?';
        const params = [userId];
        
        const result = await executeQuery(query, params);
        
        // Check if user exists
        if (result.rows.length === 0) {
            console.log('❌ User not found:', userId);
            return res.status(404).json({ 
                error: 'User không tìm thấy',
                user_id: userId,
                timestamp: new Date().toISOString()
            });
        }
        
        // Transform result
        const user = result.rows[0];
        const responseData = {
            id: user.id,
            name: user.name,
            email: user.email,
            created_at: user.created_at ? user.created_at.toISOString() : null,
            updated_at: user.updated_at ? user.updated_at.toISOString() : null
        };
        
        console.log('✅ User found successfully:', responseData);
        res.json(responseData);
        
    } catch (error) {
        console.error('❌ Error getting user by ID:', error.message);
        console.error('📝 Stack trace:', error.stack);
        
        res.status(500).json({ 
            error: 'Lỗi server khi lấy thông tin user',
            details: error.message,
            user_id: req.params.id,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * Cập Nhật Thông Tin User
 * 
 * PUT /users/:id
 * Body: {
 *   "name": "Nguyen Van B",
 *   "email": "nguyenvanb@example.com"
 * }
 */
app.put('/users/:id', async (req, res) => {
    try {
        const userId = req.params.id;
        const { name, email } = req.body;
        
        console.log('✏️  Update user - Request received:', userId);
        console.log('📝 Update data:', { name, email });
        
        // Validation
        if (!name || !email) {
            return res.status(400).json({ 
                error: 'Name và email là bắt buộc cho việc cập nhật' 
            });
        }
        
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ 
                error: 'Email format không hợp lệ' 
            });
        }
        
        const updated_at = new Date();
        
        // Update query
        const query = `
            UPDATE users 
            SET name = ?, email = ?, updated_at = ? 
            WHERE id = ?
        `;
        const params = [name, email, updated_at, userId];
        
        await executeQuery(query, params);
        
        console.log('✅ User updated successfully:', userId);
        
        res.json({
            id: userId,
            name,
            email,
            updated_at: updated_at.toISOString(),
            message: 'User đã được cập nhật thành công'
        });
        
    } catch (error) {
        console.error('❌ Error updating user:', error.message);
        
        res.status(500).json({ 
            error: 'Lỗi server khi cập nhật user',
            details: error.message
        });
    }
});

/**
 * Xóa User
 * 
 * DELETE /users/:id
 */
app.delete('/users/:id', async (req, res) => {
    try {
        const userId = req.params.id;
        console.log('🗑️  Delete user - Request received:', userId);
        
        // Delete query
        const query = 'DELETE FROM users WHERE id = ?';
        const params = [userId];
        
        await executeQuery(query, params);
        
        console.log('✅ User deleted successfully:', userId);
        
        res.json({
            message: 'User đã được xóa thành công',
            user_id: userId,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Error deleting user:', error.message);
        
        res.status(500).json({ 
            error: 'Lỗi server khi xóa user',
            details: error.message
        });
    }
});

// =============================================================================
// SERVER STARTUP & SHUTDOWN HANDLERS
// =============================================================================

/**
 * Graceful Shutdown Handler
 * Đóng kết nối database khi server shutdown
 */
process.on('SIGINT', async () => {
    console.log('\n🛑 SIGINT received. Shutting down gracefully...');
    
    try {
        await closeConnection();
        console.log('✅ User Service shutdown completed');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error during shutdown:', error.message);
        process.exit(1);
    }
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 SIGTERM received. Shutting down gracefully...');
    
    try {
        await closeConnection();
        console.log('✅ User Service shutdown completed');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error during shutdown:', error.message);
        process.exit(1);
    }
});

/**
 * Khởi Động Server
 * 
 * Sequence:
 * 1. Initialize Cassandra database
 * 2. Start Express server  
 * 3. Log startup information
 */
app.listen(port, async () => {
    try {
        console.log('\n' + '='.repeat(80));
        console.log('🚀 USER SERVICE STARTING...');
        console.log('='.repeat(80));
        
        // Step 1: Initialize database
        console.log('📊 Step 1: Initializing Cassandra database...');
        await initializeDatabase();
        
        // Step 2: Log startup success
        console.log('\n✅ USER SERVICE STARTED SUCCESSFULLY!');
        console.log('📊 Service Information:');
        console.log('   - Service: User Service');
        console.log('   - Port:', port);
        console.log('   - Version: 2.0.0');
        console.log('   - Node.js:', process.version);
        console.log('   - Environment:', process.env.NODE_ENV || 'development');
        console.log('   - Uptime: 0s');
        
        console.log('\n🔗 Available Endpoints:');
        console.log('   - GET    /health        - Health check');
        console.log('   - GET    /users         - Lấy danh sách users');
        console.log('   - GET    /users/:id     - Lấy user theo ID');
        console.log('   - POST   /users         - Tạo user mới');
        console.log('   - PUT    /users/:id     - Cập nhật user');
        console.log('   - DELETE /users/:id     - Xóa user');
        
        console.log('\n🗄️  Database Information:');
        console.log('   - Database: Apache Cassandra');
        console.log('   - Cluster: 3 nodes');
        console.log('   - Keyspace: test_keyspace');
        console.log('   - Replication Factor: 3');
        console.log('   - Table: users');
        
        console.log('\n' + '='.repeat(80));
        console.log('🎉 Ready to accept requests!');
        console.log('='.repeat(80) + '\n');
        
    } catch (error) {
        console.error('\n💥 STARTUP FAILED!');
        console.error('❌ Error:', error.message);
        console.error('📝 Stack trace:', error.stack);
        console.error('\n🛑 Shutting down due to startup failure...');
        process.exit(1);
    }
}); 