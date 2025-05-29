# 🗄️ Cassandra Connection System - Hướng Dẫn Chi Tiết

## 📋 Tổng Quan

Hệ thống kết nối Apache Cassandra đã được refactor để tập trung hóa và chuẩn hóa việc quản lý database connections trong distributed system. Tất cả các microservices đều sử dụng chung một connection utility để đảm bảo consistency và dễ maintain.

## 🏗️ Kiến Trúc Mới

### 📁 Cấu Trúc File

```
src/
├── database/
│   └── cassandraConnection.js     # Centralized connection utility
├── services/
│   ├── userService.js            # User microservice (refactored)
│   ├── orderService.js           # Order microservice (refactored)
│   └── apiGateway.js             # API Gateway (enhanced)
```

### 🔗 Connection Flow

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   User Service  │    │  Order Service  │    │   API Gateway   │
│    Port 3001    │    │    Port 3002    │    │    Port 3003    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
         ┌───────────────────────▼───────────────────────┐
         │         cassandraConnection.js                │
         │    - Centralized connection management        │
         │    - Health checks & retry logic              │
         │    - Database initialization                  │
         │    - Query execution helpers                  │
         └───────────────────────┬───────────────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       │                       │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Cassandra 1   │    │   Cassandra 2   │    │   Cassandra 3   │
│   Port: 9042    │    │   Port: 9043    │    │   Port: 9044    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 📋 Chi Tiết Từng Component

### 🔧 1. cassandraConnection.js - Core Utility

**Mục đích:** Centralized connection management cho tất cả Cassandra operations

**Chức năng chính:**
```javascript
// Connection Configuration
const client = new Client({
    contactPoints: ['cassandra1', 'cassandra2', 'cassandra3'],  // 3-node cluster
    localDataCenter: 'datacenter1',                            // DC routing
    protocolOptions: { port: 9042 },                          // Default port
    policies: { retry: { retryDelay: 1000, maxRetryCount: 3 }} // Retry policy
});

// Health Check Functions
- checkCassandraHealth()      // Kiểm tra cluster health
- waitForCassandraReady()     // Đợi cluster sẵn sàng với retry

// Database Initialization
- createKeyspace()            // Tạo keyspace với RF=3
- useKeyspace()              // Switch tới keyspace
- createUsersTable()         // Tạo users table
- createOrdersTable()        // Tạo orders table
- initializeDatabase()       // Main initialization function

// Query Helpers
- executeQuery()             // Safe prepared statement execution
- closeConnection()          // Graceful shutdown
```

**Schema Management:**
```sql
-- Keyspace with Replication Factor = 3
CREATE KEYSPACE IF NOT EXISTS test_keyspace
WITH replication = {
    'class': 'SimpleStrategy', 
    'replication_factor': 3
};

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id text PRIMARY KEY,
    name text,
    email text,
    created_at timestamp,
    updated_at timestamp
);

-- Orders Table  
CREATE TABLE IF NOT EXISTS orders (
    id text PRIMARY KEY,
    user_id text,
    items text,                -- JSON serialized
    total_amount decimal,
    status text,
    created_at timestamp,
    updated_at timestamp
);
```

### 👤 2. userService.js - User Microservice

**Port:** 3001  
**Endpoints:**
- `GET /health` - Service health check
- `GET /users` - Lấy danh sách users
- `GET /users/:id` - Lấy user theo ID
- `POST /users` - Tạo user mới
- `PUT /users/:id` - Cập nhật user
- `DELETE /users/:id` - Xóa user

**Key Features:**
```javascript
// Import centralized connection
const { 
    initializeDatabase, 
    executeQuery, 
    checkCassandraHealth,
    closeConnection 
} = require('../database/cassandraConnection');

// Auto-initialization on startup
app.listen(port, async () => {
    await initializeDatabase();
    console.log('✅ USER SERVICE STARTED SUCCESSFULLY!');
});

// Prepared statements for security
const query = 'INSERT INTO users (id, name, email, created_at, updated_at) VALUES (?, ?, ?, ?, ?)';
await executeQuery(query, [id, name, email, created_at, created_at]);

// Graceful shutdown
process.on('SIGINT', async () => {
    await closeConnection();
    process.exit(0);
});
```

### 🛒 3. orderService.js - Order Microservice

**Port:** 3002  
**Endpoints:**
- `GET /health` - Service health check
- `GET /orders` - Lấy danh sách orders
- `GET /orders/:id` - Lấy order theo ID
- `GET /orders/user/:userId` - Lấy orders theo user
- `POST /orders` - Tạo order mới
- `PUT /orders/:id` - Cập nhật order
- `DELETE /orders/:id` - Xóa order

**Business Logic:**
```javascript
// JSON serialization cho complex data
const params = [
    id, 
    userId, 
    JSON.stringify(items),  // Serialize array to JSON string
    totalAmount, 
    status,
    created_at, 
    created_at
];

// Data transformation khi retrieve
const orders = result.rows.map(row => ({
    id: row.id,
    userId: row.user_id,
    items: JSON.parse(row.items),  // Parse JSON back to array
    totalAmount: parseFloat(row.total_amount),
    status: row.status || 'pending'
}));

// Status validation
const validStatuses = ['pending', 'processing', 'completed', 'cancelled'];
```

### 🌐 4. apiGateway.js - API Gateway

**Port:** 3003  
**Chức năng:** Entry point cho distributed system

**Monitoring Endpoints:**
- `GET /health` - Gateway health check
- `GET /monitoring` - System-wide monitoring
- `GET /logs` - Web-based log viewer
- `GET /metrics` - Performance metrics

**Proxy Endpoints:**
- `GET /api/users` → `user_service:3001/users`
- `POST /api/users` → `user_service:3001/users`
- `GET /api/orders` → `order_service:3002/orders`
- `POST /api/orders` → `order_service:3002/orders`

**Field Mapping:**
```javascript
// External API format → Internal Service format
const requestBody = {
    userId: req.body.user_id || req.body.userId,           // Flexible field names
    items: req.body.items,
    totalAmount: req.body.total_amount || req.body.totalAmount
};

// Support multiple formats
const requestBody = {
    name: req.body.username || req.body.name,  // username OR name
    email: req.body.email
};
```

## 🚀 Cách Sử Dụng

### 1. **Khởi Động Hệ Thống**

```bash
# Start all services với Docker Compose
docker-compose -f docker-compose.distributed.yml up -d

# Kiểm tra logs
docker-compose -f docker-compose.distributed.yml logs -f
```

### 2. **Health Checks**

```bash
# Check API Gateway
curl http://localhost:3003/health

# Check User Service
curl http://localhost:3001/health

# Check Order Service  
curl http://localhost:3002/health

# System monitoring
curl http://localhost:3003/monitoring
```

### 3. **CRUD Operations via API Gateway**

```bash
# Tạo user mới
curl -X POST http://localhost:3003/api/users \
  -H "Content-Type: application/json" \
  -d '{"username": "Nguyen Van A", "email": "nguyenvana@example.com"}'

# Lấy danh sách users
curl http://localhost:3003/api/users

# Tạo order mới
curl -X POST http://localhost:3003/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "1704067200000",
    "items": [{"name": "Product A", "quantity": 2, "price": 100000}],
    "total_amount": 200000
  }'

# Lấy danh sách orders
curl http://localhost:3003/api/orders
```

## 🔍 Debugging & Monitoring

### 1. **Log Viewing**

```bash
# Web-based log viewer
curl http://localhost:3003/logs?lines=100

# Docker logs
docker logs user_service
docker logs order_service
docker logs api_gateway
```

### 2. **Performance Metrics**

```bash
# System metrics
curl http://localhost:3003/metrics

# Memory usage
docker stats
```

### 3. **Database Verification**

```bash
# Connect to Cassandra
docker exec -it cassandra1 cqlsh

# Check keyspace
DESCRIBE KEYSPACES;
USE test_keyspace;

# Check tables
DESCRIBE TABLES;
SELECT * FROM users LIMIT 10;
SELECT * FROM orders LIMIT 10;
```

## 🛠️ Troubleshooting

### ❌ Common Issues

**1. Services không start:**
```bash
# Check container status
docker-compose -f docker-compose.distributed.yml ps

# Check specific service logs
docker-compose -f docker-compose.distributed.yml logs user_service
```

**2. Cassandra connection timeout:**
```bash
# Wait longer cho cluster initialization
# Default wait time: 60s trong docker-compose

# Manual health check
curl http://localhost:3001/health
```

**3. API Gateway không reach services:**
```bash
# Check Docker network
docker network ls
docker network inspect apache-cassandra_cassandra_net

# Check service names resolution
docker exec api_gateway ping user_service
```

### ✅ Performance Tuning

**Memory Optimization:**
```yaml
# docker-compose.yml
services:
  cassandra1:
    environment:
      - MAX_HEAP_SIZE=2G
      - HEAP_NEWSIZE=400M
```

**Connection Pooling:**
```javascript
// cassandraConnection.js
const client = new Client({
    pooling: {
        heartBeatInterval: 30000,
        maxRequestsPerConnection: 32768
    }
});
```

## 📊 Best Practices

### 1. **Error Handling**
```javascript
// Always use try-catch với detailed logging
try {
    await executeQuery(query, params);
    console.log('✅ Operation successful');
} catch (error) {
    console.error('❌ Operation failed:', error.message);
    throw error;
}
```

### 2. **Prepared Statements**
```javascript
// ✅ GOOD - Use prepared statements
await executeQuery('SELECT * FROM users WHERE id = ?', [userId]);

// ❌ BAD - String concatenation (SQL injection risk)
await client.execute(`SELECT * FROM users WHERE id = '${userId}'`);
```

### 3. **Graceful Shutdown**
```javascript
// Handle SIGINT and SIGTERM
process.on('SIGINT', async () => {
    await closeConnection();
    process.exit(0);
});
```

### 4. **Health Monitoring**
```javascript
// Regular health checks
app.get('/health', async (req, res) => {
    const isHealthy = await checkCassandraHealth();
    const statusCode = isHealthy ? 200 : 503;
    res.status(statusCode).json({ status: isHealthy ? 'ok' : 'degraded' });
});
```

## 🎯 Kết Luận

Hệ thống connection mới provide:

- ✅ **Centralized Management** - Tất cả database logic tập trung
- ✅ **Better Error Handling** - Consistent error handling across services  
- ✅ **Improved Logging** - Detailed Vietnamese comments và logs
- ✅ **Health Monitoring** - Comprehensive health checks
- ✅ **Graceful Shutdown** - Proper resource cleanup
- ✅ **Scalability** - Easy to add new services
- ✅ **Maintainability** - Single source of truth cho DB operations

System giờ đây sẵn sàng cho production use với robust error handling và comprehensive monitoring capabilities! 🚀 