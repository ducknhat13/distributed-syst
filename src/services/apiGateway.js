/**
 * =============================================================================
 * API GATEWAY - DISTRIBUTED MICROSERVICE
 * =============================================================================
 * 
 * API Gateway làm entry point cho toàn bộ distributed system
 * Chịu trách nhiệm route requests tới các microservices thích hợp
 * 
 * Features:
 * -  Request routing tới User Service & Order Service
 * -  Health check và monitoring endpoints
 * -  Logging và metrics collection
 * -  Error handling và response transformation
 * -  Web-based log viewer
 * 
 * Author: Distributed System Team
 * Version: 2.0.0
 * =============================================================================
 */

const express = require('express');
const axios = require('axios');

// =============================================================================
// EXPRESS APP CONFIGURATION
// =============================================================================

const app = express();

/**
 * Cấu hình body parser để parse JSON request bodies
 * Cho phép API Gateway nhận và xử lý JSON data từ clients
 */
app.use(express.json());

/**
 * Middleware để log tất cả incoming requests
 * Ghi lại timestamp, HTTP method, URL và headers cho debugging
 */
app.use((req, res, next) => {
    console.log(`📝 ${new Date().toISOString()} - ${req.method} ${req.url}`);
    console.log('🔍 Request headers:', req.headers);
    
    // Log request body cho POST/PUT requests (nếu có)
    if (req.body && Object.keys(req.body).length > 0) {
        console.log('📋 Request body:', req.body);
    }
    
    next();
});

// =============================================================================
// SERVICE DISCOVERY CONFIGURATION
// =============================================================================

/**
 * Định nghĩa URLs của các microservices
 * Sử dụng Docker service names để kết nối trong container network
 */
const USER_SERVICE = 'http://user_service:3001';    // User microservice
const ORDER_SERVICE = 'http://order_service:3002';  // Order microservice

console.log('🔗 Service Discovery Configuration:');
console.log('   - User Service:', USER_SERVICE);
console.log('   - Order Service:', ORDER_SERVICE);

// =============================================================================
// HEALTH CHECK & MONITORING ENDPOINTS
// =============================================================================

/**
 * API Gateway Health Check Endpoint
 * Kiểm tra trạng thái của API Gateway itself
 * 
 * GET /health
 * 
 * Response: {
 *   "status": "ok",
 *   "nodeId": 1,
 *   "service": "api-gateway",
 *   "timestamp": "2024-01-01T00:00:00.000Z",
 *   "uptime": 123.456
 * }
 */
app.get('/health', (req, res) => {
    console.log('❤️  Health check request received');
    
    const healthData = {
        status: 'ok',
        nodeId: 1,
        service: 'api-gateway',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: '2.0.0'
    };
    
    console.log('✅ Health check response:', healthData);
    res.status(200).json(healthData);
});

/**
 * System Monitoring Endpoint
 * Kiểm tra trạng thái của toàn bộ distributed system
 * Bao gồm API Gateway và tất cả connected microservices
 * 
 * GET /monitoring
 */
app.get('/monitoring', async (req, res) => {
    try {
        console.log('📊 System monitoring request received');
        
        // Object để store status của tất cả services
        const serviceStatus = {};
        
        // =============================================================
        // Test User Service Health
        // =============================================================
        console.log('🔍 Checking User Service health...');
        try {
            const startTime = Date.now();
            const userHealthResponse = await axios.get(`${USER_SERVICE}/health`, { 
                timeout: 5000  // 5 second timeout
            });
            const responseTime = Date.now() - startTime;
            
            serviceStatus.userService = {
                status: 'healthy',
                responseTime: responseTime + 'ms',
                lastCheck: new Date().toISOString(),
                data: userHealthResponse.data
            };
            console.log('✅ User Service is healthy, response time:', responseTime + 'ms');
            
        } catch (error) {
            serviceStatus.userService = {
                status: 'unhealthy',
                error: error.message,
                lastCheck: new Date().toISOString()
            };
            console.log('❌ User Service is unhealthy:', error.message);
        }
        
        // =============================================================
        // Test Order Service Health
        // =============================================================
        console.log('🔍 Checking Order Service health...');
        try {
            const startTime = Date.now();
            const orderHealthResponse = await axios.get(`${ORDER_SERVICE}/health`, { 
                timeout: 5000  // 5 second timeout
            });
            const responseTime = Date.now() - startTime;
            
            serviceStatus.orderService = {
                status: 'healthy',
                responseTime: responseTime + 'ms',
                lastCheck: new Date().toISOString(),
                data: orderHealthResponse.data
            };
            console.log('✅ Order Service is healthy, response time:', responseTime + 'ms');
            
        } catch (error) {
            serviceStatus.orderService = {
                status: 'unhealthy',
                error: error.message,
                lastCheck: new Date().toISOString()
            };
            console.log('❌ Order Service is unhealthy:', error.message);
        }
        
        // =============================================================
        // Compile Complete Monitoring Data
        // =============================================================
        const monitoringData = {
            // API Gateway status
            gateway: {
                status: 'ok',
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                cpu: process.cpuUsage(),
                timestamp: new Date().toISOString(),
                version: '2.0.0'
            },
            
            // All microservices status
            services: serviceStatus,
            
            // System information
            system: {
                platform: process.platform,
                nodeVersion: process.version,
                pid: process.pid,
                environment: process.env.NODE_ENV || 'development'
            },
            
            // Overall system health
            overallHealth: Object.values(serviceStatus).every(service => service.status === 'healthy') ? 'healthy' : 'degraded'
        };
        
        console.log('📊 Monitoring data compiled successfully');
        res.json(monitoringData);
        
    } catch (error) {
        console.error('❌ Error in monitoring endpoint:', error.message);
        res.status(500).json({ 
            error: 'Monitoring system failure',
            details: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * Application Logs Viewer Endpoint
 * Đọc và trả về logs gần đây từ file system
 * Hữu ích cho debugging và monitoring
 * 
 * GET /logs
 * Query params:
 * - lines: số dòng log muốn xem (default: 50)
 */
app.get('/logs', (req, res) => {
    try {
        console.log('📋 Logs viewer request received');
        
        const fs = require('fs');
        const path = require('path');
        
        // Parse query parameters
        const requestedLines = parseInt(req.query.lines) || 50;
        console.log('📊 Requested log lines:', requestedLines);
        
        // Đường dẫn tới log file
        const logFile = path.join(__dirname, '../../logs/app.log');
        console.log('📁 Log file path:', logFile);
        
        if (fs.existsSync(logFile)) {
            // Đọc toàn bộ log file
            const logs = fs.readFileSync(logFile, 'utf8');
            const logLines = logs.split('\n').filter(line => line.trim() !== '');
            
            // Lấy số dòng logs gần nhất theo yêu cầu
            const recentLogs = logLines.slice(-requestedLines);
            
            // Parse JSON logs nếu có thể, fallback về plain text
            const parsedLogs = recentLogs.map((line, index) => {
                try {
                    return JSON.parse(line);
                } catch (e) {
                    return { 
                        level: 'info',
                        message: line, 
                        timestamp: new Date().toISOString(),
                        lineNumber: logLines.length - recentLogs.length + index + 1
                    };
                }
            });
            
            const response = {
                success: true,
                totalLines: logLines.length,
                requestedLines: requestedLines,
                returnedLines: recentLogs.length,
                lastUpdated: fs.statSync(logFile).mtime.toISOString(),
                logs: parsedLogs
            };
            
            console.log('✅ Logs retrieved successfully, total lines:', logLines.length);
            res.json(response);
            
        } else {
            console.log('⚠️  Log file not found');
            res.json({
                success: false,
                message: 'Log file not found - may not have been created yet',
                totalLines: 0,
                logs: [],
                suggestion: 'Make some requests to generate logs first'
            });
        }
    } catch (error) {
        console.error('❌ Error reading logs:', error.message);
        res.status(500).json({ 
            success: false,
            error: 'Failed to read log file',
            details: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * System Metrics Endpoint
 * Trả về performance metrics của API Gateway
 * Bao gồm thống kê process, memory, CPU usage
 * 
 * GET /metrics
 */
app.get('/metrics', async (req, res) => {
    try {
        console.log('📈 Metrics request received');
        
        // Collect system metrics
        const memoryUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();
        
        const metrics = {
            timestamp: new Date().toISOString(),
            
            // Process metrics
            process: {
                uptime: process.uptime(),
                pid: process.pid,
                version: process.version,
                platform: process.platform
            },
            
            // Memory metrics (in MB)
            memory: {
                rss: Math.round(memoryUsage.rss / 1024 / 1024),           // Resident Set Size
                heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024), // Total heap
                heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),   // Used heap
                external: Math.round(memoryUsage.external / 1024 / 1024)    // External memory
            },
            
            // CPU metrics (in microseconds)
            cpu: {
                user: cpuUsage.user,
                system: cpuUsage.system
            },
            
            // Request statistics (simplified for demo)
            requests: {
                total: Math.floor(Math.random() * 1000) + 100,     // Mock data
                success: Math.floor(Math.random() * 900) + 90,     // Mock data
                errors: Math.floor(Math.random() * 10) + 1,        // Mock data
                averageResponseTime: Math.floor(Math.random() * 100) + 50 + 'ms'
            },
            
            // Service health summary
            services: {
                userService: 'unknown',      // Would be updated by actual health checks
                orderService: 'unknown',     // Would be updated by actual health checks
                cassandra: 'unknown'         // Would be updated by actual health checks
            }
        };
        
        console.log('📊 Metrics compiled successfully');
        res.json(metrics);
        
    } catch (error) {
        console.error('❌ Error collecting metrics:', error.message);
        res.status(500).json({ 
            error: 'Failed to collect metrics',
            details: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// =============================================================================
// ORDER SERVICE PROXY ENDPOINTS
// =============================================================================

/**
 * Get All Orders - Proxy to Order Service
 * 
 * GET /api/orders
 * Query params được forward tới Order Service
 */
app.get('/api/orders', async (req, res) => {
    try {
        console.log('🛒 GET /api/orders request received');
        console.log('🔄 Forwarding to Order Service...');
        
        // Build query string từ request parameters
        const queryString = Object.keys(req.query).length > 0 
            ? '?' + new URLSearchParams(req.query).toString()
            : '';
        
        const targetUrl = `${ORDER_SERVICE}/orders${queryString}`;
        console.log('🎯 Target URL:', targetUrl);
        
        // Forward request tới Order Service
        const response = await axios.get(targetUrl, {
            timeout: 10000  // 10 second timeout
        });
        
        console.log('✅ Response received from Order Service');
        console.log('📊 Orders count:', response.data.orders ? response.data.orders.length : 'N/A');
        
        // Return response từ Order Service
        res.json(response.data);
        
    } catch (error) {
        console.error('❌ Error in /api/orders GET:', error.message);
        
        if (error.response) {
            console.error('📝 Error response data:', error.response.data);
            console.error('📝 Error status:', error.response.status);
            
            // Forward error response từ Order Service
            res.status(error.response.status).json(error.response.data);
        } else {
            // Network hoặc timeout errors
            res.status(503).json({ 
                error: 'Order Service unavailable',
                details: error.message,
                service: 'order-service'
            });
        }
    }
});

/**
 * Get Order by ID - Proxy to Order Service
 * 
 * GET /api/orders/:id
 */
app.get('/api/orders/:id', async (req, res) => {
    try {
        const orderId = req.params.id;
        console.log('🔍 GET /api/orders/:id request received, ID:', orderId);
        
        const targetUrl = `${ORDER_SERVICE}/orders/${orderId}`;
        console.log('🎯 Target URL:', targetUrl);
        
        const response = await axios.get(targetUrl, {
            timeout: 10000
        });
        
        console.log('✅ Order details retrieved successfully');
        res.json(response.data);
        
    } catch (error) {
        console.error('❌ Error in /api/orders/:id GET:', error.message);
        
        if (error.response) {
            res.status(error.response.status).json(error.response.data);
        } else {
            res.status(503).json({ 
                error: 'Order Service unavailable',
                details: error.message
            });
        }
    }
});

/**
 * Create New Order - Proxy to Order Service
 * Thực hiện field mapping nếu cần thiết
 * 
 * POST /api/orders
 * Body: {
 *   "user_id": "123",          // Mapped to "userId"
 *   "items": [...],
 *   "total_amount": 250000     // Mapped to "totalAmount"
 * }
 */
app.post('/api/orders', async (req, res) => {
    try {
        console.log('📝 POST /api/orders request received');
        console.log('📋 Original request body:', req.body);
        
        /**
         * Field Mapping: External API format -> Internal Service format
         * Gateway làm translator giữa external clients và internal services
         */
        const requestBody = {
            userId: req.body.user_id || req.body.userId,           // Support both formats
            items: req.body.items,
            totalAmount: req.body.total_amount || req.body.totalAmount  // Support both formats
        };
        
        console.log('🔄 Mapped request body:', requestBody);
        
        // Validation cơ bản
        if (!requestBody.userId || !requestBody.items || !requestBody.totalAmount) {
            console.log('❌ Validation failed - missing required fields');
            return res.status(400).json({
                error: 'Missing required fields',
                required: ['user_id', 'items', 'total_amount'],
                received: Object.keys(req.body)
            });
        }
        
        const targetUrl = `${ORDER_SERVICE}/orders`;
        console.log('🎯 Target URL:', targetUrl);
        
        const response = await axios.post(targetUrl, requestBody, {
            timeout: 10000
        });
        
        console.log('✅ Order created successfully via proxy');
        res.status(201).json(response.data);
        
    } catch (error) {
        console.error('❌ Error in /api/orders POST:', error.message);
        
        if (error.response) {
            console.error('📝 Error details:', error.response.data);
            res.status(error.response.status).json(error.response.data);
        } else {
            res.status(503).json({ 
                error: 'Order Service unavailable',
                details: error.message
            });
        }
    }
});

// =============================================================================
// USER SERVICE PROXY ENDPOINTS
// =============================================================================

/**
 * Get All Users - Proxy to User Service
 * 
 * GET /api/users
 */
app.get('/api/users', async (req, res) => {
    try {
        console.log('👤 GET /api/users request received');
        console.log('🔄 Forwarding to User Service...');
        
        const queryString = Object.keys(req.query).length > 0 
            ? '?' + new URLSearchParams(req.query).toString()
            : '';
        
        const targetUrl = `${USER_SERVICE}/users${queryString}`;
        console.log('🎯 Target URL:', targetUrl);
        
        const response = await axios.get(targetUrl, {
            timeout: 10000
        });
        
        console.log('✅ Response received from User Service');
        console.log('📊 Users count:', response.data.users ? response.data.users.length : 'N/A');
        
        res.json(response.data);
        
    } catch (error) {
        console.error('❌ Error in /api/users GET:', error.message);
        
        if (error.response) {
            console.error('📝 Error response:', error.response.data);
            res.status(error.response.status).json(error.response.data);
        } else {
            res.status(503).json({ 
                error: 'User Service unavailable',
                details: error.message
            });
        }
    }
});

/**
 * Get User by ID - Proxy to User Service
 * 
 * GET /api/users/:id
 */
app.get('/api/users/:id', async (req, res) => {
    try {
        const userId = req.params.id;
        console.log('🔍 GET /api/users/:id request received, ID:', userId);
        
        const targetUrl = `${USER_SERVICE}/users/${userId}`;
        console.log('🎯 Target URL:', targetUrl);
        
        const response = await axios.get(targetUrl, {
            timeout: 10000
        });
        
        console.log('✅ User details retrieved successfully');
        res.json(response.data);
        
    } catch (error) {
        console.error('❌ Error in /api/users/:id GET:', error.message);
        
        if (error.response) {
            res.status(error.response.status).json(error.response.data);
        } else {
            res.status(503).json({ 
                error: 'User Service unavailable',
                details: error.message
            });
        }
    }
});

/**
 * Create New User - Proxy to User Service
 * Thực hiện field mapping cho compatibility
 * 
 * POST /api/users
 * Body: {
 *   "username": "John Doe",    // Mapped to "name"
 *   "email": "john@example.com"
 * }
 */
app.post('/api/users', async (req, res) => {
    try {
        console.log('📝 POST /api/users request received');
        console.log('📋 Original request body:', req.body);
        
        /**
         * Field Mapping: External API format -> Internal Service format
         * External clients có thể sử dụng "username", nhưng User Service expect "name"
         */
        const requestBody = {
            name: req.body.username || req.body.name,  // Support both "username" and "name"
            email: req.body.email
        };
        
        console.log('🔄 Mapped request body:', requestBody);
        
        // Validation cơ bản
        if (!requestBody.name || !requestBody.email) {
            console.log('❌ Validation failed - missing required fields');
            return res.status(400).json({
                error: 'Missing required fields',
                required: ['username or name', 'email'],
                received: Object.keys(req.body)
            });
        }
        
        const targetUrl = `${USER_SERVICE}/users`;
        console.log('🎯 Target URL:', targetUrl);
        
        const response = await axios.post(targetUrl, requestBody, {
            timeout: 10000
        });
        
        console.log('✅ User created successfully via proxy');
        res.status(201).json(response.data);
        
    } catch (error) {
        console.error('❌ Error in /api/users POST:', error.message);
        
        if (error.response) {
            console.error('📝 Error details:', error.response.data);
            res.status(error.response.status).json(error.response.data);
        } else {
            res.status(503).json({ 
                error: 'User Service unavailable',
                details: error.message
            });
        }
    }
});

// =============================================================================
// ERROR HANDLING & MIDDLEWARE
// =============================================================================

/**
 * Global Error Handler Middleware
 * Catch tất cả unhandled errors và return proper error response
 */
app.use((err, req, res, next) => {
    console.error('💥 Unhandled error caught by global handler:', err);
    console.error('📝 Stack trace:', err.stack);
    
    res.status(500).json({ 
        error: 'Internal server error',
        message: 'An unexpected error occurred in API Gateway',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
    });
});

/**
 * 404 Not Found Handler
 * Handle tất cả requests không match với routes đã define
 */
app.use((req, res) => {
    console.log('🔍 404 Not Found:', req.method, req.url);
    console.log('🌐 Available endpoints:');
    console.log('   - GET  /health          - API Gateway health check');
    console.log('   - GET  /monitoring      - System monitoring');
    console.log('   - GET  /logs           - View application logs');
    console.log('   - GET  /metrics        - System metrics');
    console.log('   - GET  /api/users      - Get all users');
    console.log('   - POST /api/users      - Create new user');
    console.log('   - GET  /api/orders     - Get all orders');
    console.log('   - POST /api/orders     - Create new order');
    
    res.status(404).json({ 
        error: 'Endpoint not found',
        method: req.method,
        path: req.url,
        timestamp: new Date().toISOString(),
        availableEndpoints: [
            'GET /health', 'GET /monitoring', 'GET /logs', 'GET /metrics',
            'GET /api/users', 'POST /api/users', 'GET /api/orders', 'POST /api/orders'
        ]
    });
});

// =============================================================================
// SERVER STARTUP
// =============================================================================

/**
 * Start API Gateway Server
 * Khởi động server và log thông tin configuration
 */
const PORT = process.env.PORT || 3000;  // Changed from 3003 to 3000 to match Docker mapping

app.listen(PORT, () => {
    console.log('\n' + '='.repeat(80));
    console.log('🚀 API GATEWAY STARTING...');
    console.log('='.repeat(80));
    
    console.log('📊 Server Information:');
    console.log('   - Service: API Gateway');
    console.log('   - Port:', PORT);
    console.log('   - Version: 2.0.0');
    console.log('   - Node.js:', process.version);
    console.log('   - Environment:', process.env.NODE_ENV || 'development');
    
    console.log('\n🔗 Service Discovery:');
    console.log('   - User Service:', USER_SERVICE);
    console.log('   - Order Service:', ORDER_SERVICE);
    
    console.log('\n🌐 Available Endpoints:');
    console.log('   - GET    /health         - API Gateway health check');
    console.log('   - GET    /monitoring     - Complete system monitoring');
    console.log('   - GET    /logs          - Application logs viewer');
    console.log('   - GET    /metrics       - Performance metrics');
    console.log('   - GET    /api/users     - Proxy to User Service');
    console.log('   - POST   /api/users     - Create user via proxy');
    console.log('   - GET    /api/orders    - Proxy to Order Service');
    console.log('   - POST   /api/orders    - Create order via proxy');
    
    console.log('\n🛡️  Gateway Features:');
    console.log('   - Request routing và load balancing');
    console.log('   - Health checking các microservices');
    console.log('   - Request/response logging');
    console.log('   - Field mapping và validation');
    console.log('   - Error handling và retry logic');
    
    console.log('\n' + '='.repeat(80));
    console.log('🎉 API Gateway is ready to handle requests!');
    console.log('='.repeat(80) + '\n');
}); 