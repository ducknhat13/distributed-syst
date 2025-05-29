/**
 * =============================================================================
 * ORDER SERVICE - DISTRIBUTED MICROSERVICE
 * =============================================================================
 * 
 * Service này quản lý tất cả operations liên quan đến Orders
 * Chạy trên port 3002 và kết nối tới 3-node Cassandra cluster
 * 
 * Features:
 * -  CRUD operations cho Orders
 * - Health check endpoint
 * -  Auto database initialization
 * -  JSON parsing cho items
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
const port = 3002;

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
 *   "service": "order-service", 
 *   "port": 3002,
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
            service: 'order-service',
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
            service: 'order-service',
            port: port,
            timestamp: new Date().toISOString(),
            error: error.message
        });
    }
});

// =============================================================================
// ORDER CRUD OPERATIONS
// =============================================================================

/**
 * Tạo Order Mới
 * 
 * POST /orders
 * Body: {
 *   "userId": "1704067200000",
 *   "items": [
 *     {"name": "Product A", "quantity": 2, "price": 100000},
 *     {"name": "Product B", "quantity": 1, "price": 50000}
 *   ],
 *   "totalAmount": 250000
 * }
 * 
 * Response: {
 *   "id": "1704067300000",
 *   "userId": "1704067200000",
 *   "items": [...],
 *   "totalAmount": 250000,
 *   "status": "pending",
 *   "created_at": "2024-01-01T00:05:00.000Z"
 * }
 */
app.post('/orders', async (req, res) => {
    try {
        console.log('🛒 Tạo order mới - Request received');
        console.log('📝 Request body:', req.body);
        
        // Validation input
        const { userId, items, totalAmount } = req.body;
        
        if (!userId || !items || !totalAmount) {
            console.log('❌ Validation failed: Missing required fields');
            return res.status(400).json({ 
                error: 'userId, items và totalAmount là bắt buộc',
                required_fields: ['userId', 'items', 'totalAmount']
            });
        }
        
        // Validate items format
        if (!Array.isArray(items) || items.length === 0) {
            console.log('❌ Validation failed: Invalid items format');
            return res.status(400).json({ 
                error: 'Items phải là array không rỗng',
                provided_items: items
            });
        }
        
        // Validate totalAmount
        if (typeof totalAmount !== 'number' || totalAmount <= 0) {
            console.log('❌ Validation failed: Invalid totalAmount');
            return res.status(400).json({ 
                error: 'totalAmount phải là số dương',
                provided_amount: totalAmount
            });
        }
        
        // Generate unique ID using timestamp
        const id = Date.now().toString();
        const created_at = new Date();
        const status = 'pending'; // Default status
        
        console.log('🔄 Inserting order vào database...');
        console.log('📊 Order data:', { id, userId, items, totalAmount, status, created_at });
        
        // Sử dụng prepared statement để insert order
        // Serialize items array thành JSON string để lưu trong Cassandra
        const query = `
            INSERT INTO orders (id, user_id, items, total_amount, status, created_at, updated_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        
        const params = [
            id, 
            userId, 
            JSON.stringify(items),  // Convert array to JSON string
            totalAmount, 
            status,
            created_at, 
            created_at
        ];
        
        // Execute query through centralized connection
        await executeQuery(query, params);
        
        // Response data
        const responseData = {
            id,
            userId,
            items,
            totalAmount,
            status,
            created_at: created_at.toISOString(),
            message: 'Order đã được tạo thành công'
        };
        
        console.log('✅ Order created successfully:', responseData);
        res.status(201).json(responseData);
        
    } catch (error) {
        console.error('❌ Error creating order:', error.message);
        console.error('📝 Stack trace:', error.stack);
        
        res.status(500).json({ 
            error: 'Lỗi server khi tạo order',
            details: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * Lấy Danh Sách Tất Cả Orders
 * 
 * GET /orders
 * Query params (optional):
 * - limit: Giới hạn số lượng records (default: 100)
 * - userId: Filter theo user ID
 * 
 * Response: [
 *   {
 *     "id": "1704067300000",
 *     "userId": "1704067200000",
 *     "items": [...],
 *     "totalAmount": 250000,
 *     "status": "pending",
 *     "created_at": "2024-01-01T00:05:00.000Z"
 *   }
 * ]
 */
app.get('/orders', async (req, res) => {
    try {
        console.log('📋 Get all orders - Request received');
        
        // Parse query parameters
        const limit = parseInt(req.query.limit) || 100;
        const userId = req.query.userId;
        console.log('📊 Query params:', { limit, userId });
        
        let query, params;
        
        // Build query based on filters
        if (userId) {
            // Filter by user ID - Note: Trong production nên có secondary index
            query = 'SELECT * FROM orders WHERE user_id = ? LIMIT ? ALLOW FILTERING';
            params = [userId, limit];
            console.log('🔍 Filtering orders by userId:', userId);
        } else {
            query = 'SELECT * FROM orders LIMIT ?';
            params = [limit];
        }
        
        console.log('🔍 Executing query to get orders...');
        
        // Execute query
        const result = await executeQuery(query, params);
        
        // Transform result để parse JSON items và format timestamps
        const orders = result.rows.map(row => ({
            id: row.id,
            userId: row.user_id,
            items: JSON.parse(row.items), // Parse JSON string back to array
            totalAmount: parseFloat(row.total_amount),
            status: row.status || 'pending',
            created_at: row.created_at ? row.created_at.toISOString() : null,
            updated_at: row.updated_at ? row.updated_at.toISOString() : null
        }));
        
        console.log('✅ Orders retrieved successfully. Count:', orders.length);
        console.log('📊 Sample data:', orders.slice(0, 2)); // Log first 2 records only
        
        res.json({
            orders,
            count: orders.length,
            limit: limit,
            userId: userId || null,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Error getting orders:', error.message);
        console.error('📝 Stack trace:', error.stack);
        
        res.status(500).json({ 
            error: 'Lỗi server khi lấy danh sách orders',
            details: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * Lấy Chi Tiết Order Theo ID
 * 
 * GET /orders/:id
 * 
 * Response: {
 *   "id": "1704067300000",
 *   "userId": "1704067200000",
 *   "items": [...],
 *   "totalAmount": 250000,
 *   "status": "pending",
 *   "created_at": "2024-01-01T00:05:00.000Z"
 * }
 */
app.get('/orders/:id', async (req, res) => {
    try {
        const orderId = req.params.id;
        console.log('🔍 Get order by ID - Request received:', orderId);
        
        // Validate ID format
        if (!orderId || orderId.trim() === '') {
            console.log('❌ Validation failed: Invalid order ID');
            return res.status(400).json({ 
                error: 'Order ID không hợp lệ',
                provided_id: orderId
            });
        }
        
        console.log('🔍 Executing query to get order by ID...');
        
        // Query order by ID
        const query = 'SELECT * FROM orders WHERE id = ?';
        const params = [orderId];
        
        const result = await executeQuery(query, params);
        
        // Check if order exists
        if (result.rows.length === 0) {
            console.log('❌ Order not found:', orderId);
            return res.status(404).json({ 
                error: 'Order không tìm thấy',
                order_id: orderId,
                timestamp: new Date().toISOString()
            });
        }
        
        // Transform result
        const order = result.rows[0];
        const responseData = {
            id: order.id,
            userId: order.user_id,
            items: JSON.parse(order.items),
            totalAmount: parseFloat(order.total_amount),
            status: order.status || 'pending',
            created_at: order.created_at ? order.created_at.toISOString() : null,
            updated_at: order.updated_at ? order.updated_at.toISOString() : null
        };
        
        console.log('✅ Order found successfully:', responseData);
        res.json(responseData);
        
    } catch (error) {
        console.error('❌ Error getting order by ID:', error.message);
        console.error('📝 Stack trace:', error.stack);
        
        res.status(500).json({ 
            error: 'Lỗi server khi lấy thông tin order',
            details: error.message,
            order_id: req.params.id,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * Cập Nhật Trạng Thái Order
 * 
 * PUT /orders/:id
 * Body: {
 *   "status": "completed",
 *   "items": [...], // optional
 *   "totalAmount": 300000 // optional
 * }
 */
app.put('/orders/:id', async (req, res) => {
    try {
        const orderId = req.params.id;
        const { status, items, totalAmount } = req.body;
        
        console.log('✏️  Update order - Request received:', orderId);
        console.log('📝 Update data:', { status, items, totalAmount });
        
        // Validation - ít nhất một field cần được update
        if (!status && !items && !totalAmount) {
            return res.status(400).json({ 
                error: 'Cần ít nhất một field để cập nhật (status, items, hoặc totalAmount)' 
            });
        }
        
        // Validate status nếu có
        const validStatuses = ['pending', 'processing', 'completed', 'cancelled'];
        if (status && !validStatuses.includes(status)) {
            return res.status(400).json({ 
                error: 'Status không hợp lệ',
                valid_statuses: validStatuses,
                provided_status: status
            });
        }
        
        const updated_at = new Date();
        
        // Build dynamic update query
        let setParts = [];
        let params = [];
        
        if (status) {
            setParts.push('status = ?');
            params.push(status);
        }
        
        if (items) {
            setParts.push('items = ?');
            params.push(JSON.stringify(items));
        }
        
        if (totalAmount) {
            setParts.push('total_amount = ?');
            params.push(totalAmount);
        }
        
        setParts.push('updated_at = ?');
        params.push(updated_at);
        params.push(orderId); // WHERE clause parameter
        
        const query = `UPDATE orders SET ${setParts.join(', ')} WHERE id = ?`;
        
        await executeQuery(query, params);
        
        console.log('✅ Order updated successfully:', orderId);
        
        res.json({
            id: orderId,
            status: status || undefined,
            items: items || undefined,
            totalAmount: totalAmount || undefined,
            updated_at: updated_at.toISOString(),
            message: 'Order đã được cập nhật thành công'
        });
        
    } catch (error) {
        console.error('❌ Error updating order:', error.message);
        
        res.status(500).json({ 
            error: 'Lỗi server khi cập nhật order',
            details: error.message
        });
    }
});

/**
 * Xóa Order
 * 
 * DELETE /orders/:id
 */
app.delete('/orders/:id', async (req, res) => {
    try {
        const orderId = req.params.id;
        console.log('🗑️  Delete order - Request received:', orderId);
        
        // Delete query
        const query = 'DELETE FROM orders WHERE id = ?';
        const params = [orderId];
        
        await executeQuery(query, params);
        
        console.log('✅ Order deleted successfully:', orderId);
        
        res.json({
            message: 'Order đã được xóa thành công',
            order_id: orderId,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Error deleting order:', error.message);
        
        res.status(500).json({ 
            error: 'Lỗi server khi xóa order',
            details: error.message
        });
    }
});

// =============================================================================
// BUSINESS LOGIC ENDPOINTS
// =============================================================================

/**
 * Lấy Orders Theo User ID
 * Endpoint tiện ích để lấy tất cả orders của một user
 * 
 * GET /orders/user/:userId
 */
app.get('/orders/user/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        console.log('👤 Get orders by user ID - Request received:', userId);
        
        const query = 'SELECT * FROM orders WHERE user_id = ? ALLOW FILTERING';
        const params = [userId];
        
        const result = await executeQuery(query, params);
        
        const orders = result.rows.map(row => ({
            id: row.id,
            userId: row.user_id,
            items: JSON.parse(row.items),
            totalAmount: parseFloat(row.total_amount),
            status: row.status || 'pending',
            created_at: row.created_at ? row.created_at.toISOString() : null,
            updated_at: row.updated_at ? row.updated_at.toISOString() : null
        }));
        
        console.log('✅ User orders retrieved successfully. Count:', orders.length);
        
        res.json({
            userId: userId,
            orders,
            count: orders.length,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Error getting orders by user ID:', error.message);
        
        res.status(500).json({ 
            error: 'Lỗi server khi lấy orders theo user ID',
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
        console.log('✅ Order Service shutdown completed');
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
        console.log('✅ Order Service shutdown completed');
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
        console.log('🚀 ORDER SERVICE STARTING...');
        console.log('='.repeat(80));
        
        // Step 1: Initialize database
        console.log('📊 Step 1: Initializing Cassandra database...');
        await initializeDatabase();
        
        // Step 2: Log startup success
        console.log('\n✅ ORDER SERVICE STARTED SUCCESSFULLY!');
        console.log('📊 Service Information:');
        console.log('   - Service: Order Service');
        console.log('   - Port:', port);
        console.log('   - Version: 2.0.0');
        console.log('   - Node.js:', process.version);
        console.log('   - Environment:', process.env.NODE_ENV || 'development');
        console.log('   - Uptime: 0s');
        
        console.log('\n🔗 Available Endpoints:');
        console.log('   - GET    /health            - Health check');
        console.log('   - GET    /orders            - Lấy danh sách orders');
        console.log('   - GET    /orders/:id        - Lấy order theo ID');
        console.log('   - GET    /orders/user/:userId - Lấy orders theo user ID');
        console.log('   - POST   /orders            - Tạo order mới');
        console.log('   - PUT    /orders/:id        - Cập nhật order');
        console.log('   - DELETE /orders/:id        - Xóa order');
        
        console.log('\n🗄️  Database Information:');
        console.log('   - Database: Apache Cassandra');
        console.log('   - Cluster: 3 nodes');
        console.log('   - Keyspace: test_keyspace');
        console.log('   - Replication Factor: 3');
        console.log('   - Table: orders');
        
        console.log('\n📊 Business Logic:');
        console.log('   - JSON serialization cho items');
        console.log('   - Status tracking (pending/processing/completed/cancelled)');
        console.log('   - User-order relationship management');
        console.log('   - Validation cho business rules');
        
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