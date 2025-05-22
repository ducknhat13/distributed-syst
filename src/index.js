const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const config = require('./config/config');
const logger = require('./utils/logger');
const { initialize } = require('./config/cassandra');
const dataRoutes = require('./routes/dataRoutes');

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/data', dataRoutes);

// Error handling
app.use((err, req, res, next) => {
    logger.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Khởi động server
async function startServer() {
    try {
        // Khởi tạo database
        await initialize();
        
        // Khởi động server
        app.listen(config.port, () => {
            logger.info(`Server is running on port ${config.port}`);
        });
    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer(); 