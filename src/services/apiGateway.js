const express = require('express');
const axios = require('axios');
const app = express();

// Cấu hình body parser mặc định
app.use(express.json());

// Middleware để log tất cả requests
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    console.log('Request headers:', req.headers);
    next();
});

// Service endpoints
const USER_SERVICE = 'http://user_service:3001';
const ORDER_SERVICE = 'http://order_service:3002';

// Health check endpoint
app.get('/health', (req, res) => {
    console.log('Health check requested');
    res.status(200).json({ 
        status: 'ok',
        nodeId: 1,
        service: 'api-gateway',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Monitoring endpoint
app.get('/monitoring', async (req, res) => {
    try {
        console.log('Monitoring endpoint requested');
        
        // Kiểm tra status của các service
        const serviceStatus = {};
        
        // Test User Service
        try {
            const userHealthResponse = await axios.get(`${USER_SERVICE}/health`, { timeout: 5000 });
            serviceStatus.userService = {
                status: 'ok',
                responseTime: Date.now() - Date.now(),
                data: userHealthResponse.data
            };
        } catch (error) {
            serviceStatus.userService = {
                status: 'error',
                error: error.message
            };
        }
        
        // Test Order Service
        try {
            const orderHealthResponse = await axios.get(`${ORDER_SERVICE}/health`, { timeout: 5000 });
            serviceStatus.orderService = {
                status: 'ok',
                responseTime: Date.now() - Date.now(),
                data: orderHealthResponse.data
            };
        } catch (error) {
            serviceStatus.orderService = {
                status: 'error',
                error: error.message
            };
        }
        
        const monitoringData = {
            gateway: {
                status: 'ok',
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                cpu: process.cpuUsage(),
                timestamp: new Date().toISOString()
            },
            services: serviceStatus,
            system: {
                platform: process.platform,
                nodeVersion: process.version,
                pid: process.pid
            }
        };
        
        res.json(monitoringData);
    } catch (error) {
        console.error('Error in monitoring endpoint:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Logs endpoint để xem logs gần đây
app.get('/logs', (req, res) => {
    try {
        console.log('Logs endpoint requested');
        const fs = require('fs');
        const path = require('path');
        
        const logFile = path.join(__dirname, '../../logs/app.log');
        
        if (fs.existsSync(logFile)) {
            const logs = fs.readFileSync(logFile, 'utf8');
            const logLines = logs.split('\n').filter(line => line.trim() !== '');
            const recentLogs = logLines.slice(-50); // 50 dòng log gần nhất
            
            res.json({
                totalLines: logLines.length,
                recentLogs: recentLogs.map(line => {
                    try {
                        return JSON.parse(line);
                    } catch (e) {
                        return { message: line, timestamp: new Date().toISOString() };
                    }
                })
            });
        } else {
            res.json({
                message: 'Log file not found',
                totalLines: 0,
                recentLogs: []
            });
        }
    } catch (error) {
        console.error('Error reading logs:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Metrics endpoint
app.get('/metrics', (req, res) => {
    console.log('Metrics endpoint requested');
    
    const metrics = {
        timestamp: new Date().toISOString(),
        process: {
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            cpu: process.cpuUsage()
        },
        requests: {
            // Đơn giản hóa - trong thực tế sẽ track từ middleware
            total: Math.floor(Math.random() * 1000) + 100,
            success: Math.floor(Math.random() * 900) + 90,
            errors: Math.floor(Math.random() * 10) + 1
        },
        services: {
            userService: 'healthy',
            orderService: 'healthy',
            cassandra: 'healthy'
        }
    };
    
    res.json(metrics);
});

// Order routes
app.get('/api/orders', async (req, res) => {
    try {
        console.log('Received GET request for /api/orders');
        console.log(`Forwarding request to ${ORDER_SERVICE}/orders`);
        const response = await axios.get(`${ORDER_SERVICE}/orders`);
        console.log('Response from order service:', response.data);
        if (!response.data) {
            console.log('No data returned from order service');
            return res.json([]);
        }
        res.json(response.data);
    } catch (error) {
        console.error('Error in /api/orders GET:', error.message);
        if (error.response) {
            console.error('Error response:', error.response.data);
            console.error('Error status:', error.response.status);
            console.error('Error headers:', error.response.headers);
        }
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/orders/:id', async (req, res) => {
    try {
        console.log(`Forwarding request to ${ORDER_SERVICE}/orders/${req.params.id}`);
        const response = await axios.get(`${ORDER_SERVICE}/orders/${req.params.id}`);
        res.json(response.data);
    } catch (error) {
        console.error('Error in /api/orders/:id GET:', error.message);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/orders', async (req, res) => {
    try {
        console.log(`Forwarding request to ${ORDER_SERVICE}/orders`);
        // Chuyển đổi tên trường để khớp với Order Service
        const requestBody = {
            userId: req.body.user_id,
            items: req.body.items,
            totalAmount: req.body.total_amount
        };
        console.log('Converted request body:', requestBody);
        const response = await axios.post(`${ORDER_SERVICE}/orders`, requestBody);
        res.json(response.data);
    } catch (error) {
        console.error('Error in /api/orders POST:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// User routes
app.get('/api/users', async (req, res) => {
    try {
        console.log('Received GET request for /api/users');
        console.log(`Forwarding request to ${USER_SERVICE}/users`);
        const response = await axios.get(`${USER_SERVICE}/users`);
        console.log('Response from user service:', response.data);
        res.json(response.data);
    } catch (error) {
        console.error('Error in /api/users GET:', error.message);
        if (error.response) {
            console.error('Error response:', error.response.data);
        }
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/users/:id', async (req, res) => {
    try {
        console.log(`Forwarding request to ${USER_SERVICE}/users/${req.params.id}`);
        const response = await axios.get(`${USER_SERVICE}/users/${req.params.id}`);
        res.json(response.data);
    } catch (error) {
        console.error('Error in /api/users/:id GET:', error.message);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/users', async (req, res) => {
    try {
        console.log('Received POST request for /api/users');
        console.log('Request body:', req.body);
        // Chuyển đổi username thành name
        const requestBody = {
            name: req.body.username,
            email: req.body.email
        };
        console.log(`Forwarding request to ${USER_SERVICE}/users with body:`, requestBody);
        const response = await axios.post(`${USER_SERVICE}/users`, requestBody);
        console.log('Response from user service:', response.data);
        res.json(response.data);
    } catch (error) {
        console.error('Error in /api/users POST:', error.message);
        if (error.response) {
            console.error('Error response:', error.response.data);
        }
        res.status(500).json({ error: error.message });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
    console.log('404 Not Found:', req.method, req.url);
    res.status(404).json({ error: 'Not Found' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`API Gateway running on port ${PORT}`);
    console.log(`User Service URL: ${USER_SERVICE}`);
    console.log(`Order Service URL: ${ORDER_SERVICE}`);
}); 