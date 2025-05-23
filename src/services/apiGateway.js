const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

// Service endpoints
const USER_SERVICE = 'http://user_service:3001';
const ORDER_SERVICE = 'http://order_service:3002';

// User routes
app.post('/api/users', async (req, res) => {
    try {
        console.log(`Forwarding request to ${USER_SERVICE}/users`);
        const response = await axios.post(`${USER_SERVICE}/users`, req.body);
        res.json(response.data);
    } catch (error) {
        console.error('Error in /api/users POST:', error.message);
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

// Order routes
app.post('/api/orders', async (req, res) => {
    try {
        console.log(`Forwarding request to ${ORDER_SERVICE}/orders`);
        const response = await axios.post(`${ORDER_SERVICE}/orders`, req.body);
        res.json(response.data);
    } catch (error) {
        console.error('Error in /api/orders POST:', error.message);
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`API Gateway running on port ${PORT}`);
    console.log(`User Service URL: ${USER_SERVICE}`);
    console.log(`Order Service URL: ${ORDER_SERVICE}`);
}); 