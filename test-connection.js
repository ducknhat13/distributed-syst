const axios = require('axios');

async function testConnection() {
    try {
        // Test User Service
        console.log('Testing User Service...');
        const userResponse = await axios.post('http://localhost:3001/users', {
            name: 'Test User',
            email: 'test@example.com'
        });
        console.log('User Service Response:', userResponse.data);

        // Test Order Service
        console.log('Testing Order Service...');
        const orderResponse = await axios.post('http://localhost:3002/orders', {
            user_id: userResponse.data.id,
            items: ['item1', 'item2'],
            total_amount: 100.50
        });
        console.log('Order Service Response:', orderResponse.data);

    } catch (error) {
        console.error('Error:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
            console.error('Response status:', error.response.status);
        }
    }
}

testConnection(); 