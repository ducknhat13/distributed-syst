-- Tạo keyspace
CREATE KEYSPACE IF NOT EXISTS distributed_storage
WITH replication = {
    'class': 'SimpleStrategy',
    'replication_factor': 3
};

-- Sử dụng keyspace
USE distributed_storage;

-- Tạo table
CREATE TABLE IF NOT EXISTS data (
    key text PRIMARY KEY,
    value text,
    created_at timestamp,
    updated_at timestamp
); 