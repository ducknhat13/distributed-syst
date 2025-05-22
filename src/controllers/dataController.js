const { client } = require('../config/cassandra');
const logger = require('../utils/logger');
const config = require('../config/config');

// Lấy dữ liệu theo key
async function getData(req, res) {
    try {
        const { key } = req.params;
        const query = `SELECT * FROM ${config.cassandra.keyspace}.data WHERE key = ?`;
        const result = await client.execute(query, [key], { prepare: true });
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Data not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        logger.error('Error getting data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// Thêm dữ liệu mới
async function createData(req, res) {
    try {
        const { key, value } = req.body;
        const now = new Date();
        
        const query = `
            INSERT INTO ${config.cassandra.keyspace}.data (key, value, created_at, updated_at)
            VALUES (?, ?, ?, ?)
        `;
        
        await client.execute(query, [key, value, now, now], { prepare: true });
        res.status(201).json({ message: 'Data created successfully' });
    } catch (error) {
        logger.error('Error creating data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// Cập nhật dữ liệu
async function updateData(req, res) {
    try {
        const { key } = req.params;
        const { value } = req.body;
        const now = new Date();

        const query = `
            UPDATE ${config.cassandra.keyspace}.data
            SET value = ?, updated_at = ?
            WHERE key = ?
        `;

        await client.execute(query, [value, now, key], { prepare: true });
        res.json({ message: 'Data updated successfully' });
    } catch (error) {
        logger.error('Error updating data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// Xóa dữ liệu
async function deleteData(req, res) {
    try {
        const { key } = req.params;
        const query = `DELETE FROM ${config.cassandra.keyspace}.data WHERE key = ?`;
        
        await client.execute(query, [key], { prepare: true });
        res.json({ message: 'Data deleted successfully' });
    } catch (error) {
        logger.error('Error deleting data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

module.exports = {
    getData,
    createData,
    updateData,
    deleteData
}; 