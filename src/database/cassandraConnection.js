/**
 * =============================================================================
 * CASSANDRA DATABASE CONNECTION UTILITY
 * =============================================================================
 * 
 * File này chứa tất cả logic kết nối và quản lý Apache Cassandra database
 * Mục đích: Tái sử dụng code, dễ maintain và monitor connection
 * 
 * Author: Distributed System Team
 * Version: 1.0.0
 * =============================================================================
 */

const { Client } = require('cassandra-driver');

/**
 * Hàm delay - Tạm dừng thực thi trong một khoảng thời gian
 * @param {number} ms - Số milliseconds để delay
 * @returns {Promise} Promise resolve sau thời gian delay
 */
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * =============================================================================
 * CASSANDRA CLIENT CONFIGURATION
 * =============================================================================
 */

/**
 * Cấu hình Cassandra Client với 3-node cluster setup
 * - contactPoints: Danh sách các Cassandra nodes để kết nối
 * - localDataCenter: Data center mà client thuộc về (quan trọng cho routing)
 * - protocolOptions: Cấu hình port kết nối
 */
const client = new Client({
    // Danh sách 3 Cassandra nodes trong cluster
    contactPoints: [
        'cassandra1',    // Node 1 - Port 9042 (internal)
        'cassandra2',    // Node 2 - Port 9043 (external mapping)
        'cassandra3'     // Node 3 - Port 9044 (external mapping)
    ],
    
    // Data center để client biết routing preference
    localDataCenter: 'datacenter1',
    
    // Cấu hình protocol connection
    protocolOptions: {
        port: 9042  // Default Cassandra port
    },
    
    // Sử dụng default retry policy của cassandra-driver
    // (Bỏ custom retry config vì format không đúng)
});

/**
 * =============================================================================
 * HEALTH CHECK FUNCTIONS
 * =============================================================================
 */

/**
 * Kiểm tra trạng thái kết nối Cassandra cluster
 * Hàm này thực hiện health check bằng cách query system table
 * 
 * @returns {Promise<boolean>} true nếu cluster sẵn sàng, false nếu không
 */
async function checkCassandraHealth() {
    try {
        // Query system.local để kiểm tra connectivity
        const result = await client.execute('SELECT now() FROM system.local');
        console.log('✅ Cassandra cluster health check passed:', result.rows[0]);
        return true;
    } catch (error) {
        console.error('❌ Cassandra cluster health check failed:', error.message);
        return false;
    }
}

/**
 * Kiểm tra trạng thái Cassandra cluster với retry mechanism
 * Hàm này sẽ thử kết nối nhiều lần trước khi báo lỗi
 * 
 * @param {number} maxRetries - Số lần thử tối đa (default: 10)
 * @param {number} retryInterval - Khoảng thời gian giữa các lần thử (default: 5000ms)
 * @returns {Promise<boolean>} true nếu kết nối thành công
 */
async function waitForCassandraReady(maxRetries = 10, retryInterval = 5000) {
    console.log('🔄 Đang kiểm tra trạng thái Cassandra cluster...');
    
    let retries = maxRetries;
    while (retries > 0) {
        try {
            // Thực hiện health check
            const isHealthy = await checkCassandraHealth();
            if (isHealthy) {
                console.log('🎉 Cassandra cluster đã sẵn sàng!');
                return true;
            }
        } catch (error) {
            console.log(`⏳ Cassandra chưa sẵn sàng, thử lại... (${maxRetries - retries + 1}/${maxRetries})`);
            console.log(`📝 Lỗi: ${error.message}`);
        }
        
        retries--;
        if (retries === 0) {
            console.error('💥 Cassandra cluster không sẵn sàng sau', maxRetries, 'lần thử');
            return false;
        }
        
        // Đợi trước khi thử lại
        console.log(`⏰ Đợi ${retryInterval/1000}s trước khi thử lại...`);
        await delay(retryInterval);
    }
    
    return false;
}

/**
 * =============================================================================
 * DATABASE INITIALIZATION FUNCTIONS
 * =============================================================================
 */

/**
 * Tạo keyspace cho application với replication factor = 3
 * Keyspace là namespace cao nhất trong Cassandra (tương đương database trong RDBMS)
 * 
 * @param {string} keyspaceName - Tên keyspace cần tạo
 * @param {number} replicationFactor - Số replica cho mỗi piece of data
 * @returns {Promise<boolean>} true nếu tạo thành công
 */
async function createKeyspace(keyspaceName = 'test_keyspace', replicationFactor = 3) {
    try {
        console.log('🏗️  Tạo keyspace:', keyspaceName);
        
        // CQL command để tạo keyspace với SimpleStrategy
        // SimpleStrategy: Replication strategy đơn giản, phù hợp cho single datacenter
        const query = `
            CREATE KEYSPACE IF NOT EXISTS ${keyspaceName}
            WITH replication = {
                'class': 'SimpleStrategy', 
                'replication_factor': ${replicationFactor}
            }
        `;
        
        await client.execute(query);
        console.log('✅ Keyspace', keyspaceName, 'đã được tạo với replication factor:', replicationFactor);
        
        // Đợi một chút để keyspace được propagate qua cluster
        await delay(2000);
        return true;
        
    } catch (error) {
        console.error('❌ Lỗi tạo keyspace:', error.message);
        throw error;
    }
}

/**
 * Kết nối tới keyspace cụ thể
 * Sau khi tạo keyspace, cần USE để switch context
 * 
 * @param {string} keyspaceName - Tên keyspace để kết nối
 * @returns {Promise<boolean>} true nếu kết nối thành công
 */
async function useKeyspace(keyspaceName = 'test_keyspace') {
    try {
        console.log('🔗 Kết nối tới keyspace:', keyspaceName);
        
        await client.execute(`USE ${keyspaceName}`);
        console.log('✅ Đã kết nối tới keyspace:', keyspaceName);
        return true;
        
    } catch (error) {
        console.error('❌ Lỗi kết nối keyspace:', error.message);
        throw error;
    }
}

/**
 * Tạo table users với schema định nghĩa trước
 * 
 * @returns {Promise<boolean>} true nếu tạo table thành công
 */
async function createUsersTable() {
    try {
        console.log('📋 Tạo table users...');
        
        const query = `
            CREATE TABLE IF NOT EXISTS users (
                id text PRIMARY KEY,        -- Primary key: Unique identifier
                name text,                  -- Tên người dùng
                email text,                 -- Email người dùng
                created_at timestamp,       -- Thời gian tạo (thêm vào)
                updated_at timestamp        -- Thời gian cập nhật (thêm vào)
            )
        `;
        
        await client.execute(query);
        console.log('✅ Table users đã được tạo thành công');
        return true;
        
    } catch (error) {
        console.error('❌ Lỗi tạo table users:', error.message);
        throw error;
    }
}

/**
 * Tạo table orders với schema định nghĩa trước
 * 
 * @returns {Promise<boolean>} true nếu tạo table thành công
 */
async function createOrdersTable() {
    try {
        console.log('📋 Tạo table orders...');
        
        const query = `
            CREATE TABLE IF NOT EXISTS orders (
                id text PRIMARY KEY,        -- Primary key: Unique identifier
                user_id text,              -- Foreign key reference tới users
                items text,                -- JSON string chứa danh sách items
                total_amount decimal,      -- Tổng tiền
                status text,               -- Trạng thái đơn hàng (thêm vào)
                created_at timestamp,      -- Thời gian tạo (thêm vào)
                updated_at timestamp       -- Thời gian cập nhật (thêm vào)
            )
        `;
        
        await client.execute(query);
        console.log('✅ Table orders đã được tạo thành công');
        return true;
        
    } catch (error) {
        console.error('❌ Lỗi tạo table orders:', error.message);
        throw error;
    }
}

/**
 * =============================================================================
 * MAIN INITIALIZATION FUNCTION
 * =============================================================================
 */

/**
 * Khởi tạo toàn bộ database schema và kết nối
 * Hàm chính để setup database từ đầu
 * 
 * @param {number} maxRetries - Số lần thử tối đa cho việc initialization
 * @returns {Promise<boolean>} true nếu khởi tạo thành công
 */
async function initializeDatabase(maxRetries = 5) {
    console.log('🚀 Bắt đầu khởi tạo Cassandra database...');
    
    // Bước 1: Đợi Cassandra cluster sẵn sàng
    const isClusterReady = await waitForCassandraReady();
    if (!isClusterReady) {
        throw new Error('Cassandra cluster không sẵn sàng để khởi tạo database');
    }
    
    let retries = maxRetries;
    while (retries > 0) {
        try {
            console.log(`📝 Lần thử khởi tạo database: ${maxRetries - retries + 1}/${maxRetries}`);
            
            // Bước 2: Tạo keyspace
            await createKeyspace('test_keyspace', 3);
            
            // Bước 3: Kết nối tới keyspace
            await useKeyspace('test_keyspace');
            
            // Bước 4: Tạo tables
            await createUsersTable();
            await createOrdersTable();
            
            console.log('🎉 Database đã được khởi tạo thành công!');
            console.log('📊 Schema summary:');
            console.log('   - Keyspace: test_keyspace (RF=3)');
            console.log('   - Tables: users, orders');
            console.log('   - Cluster: 3 nodes (cassandra1, cassandra2, cassandra3)');
            
            return true;
            
        } catch (error) {
            console.error(`❌ Lỗi khởi tạo database (lần thử ${maxRetries - retries + 1}):`, error.message);
            retries--;
            
            if (retries === 0) {
                console.error('💥 Không thể khởi tạo database sau', maxRetries, 'lần thử');
                throw error;
            }
            
            // Đợi 5 giây trước khi thử lại
            console.log('⏰ Đợi 5 giây trước khi thử lại...');
            await delay(5000);
        }
    }
    
    return false;
}

/**
 * =============================================================================
 * DATABASE OPERATION HELPERS
 * =============================================================================
 */

/**
 * Thực thi prepared statement một cách an toàn
 * Prepared statements giúp prevent injection và improve performance
 * 
 * @param {string} query - CQL query string
 * @param {Array} params - Parameters cho query
 * @param {Object} options - Options cho execution
 * @returns {Promise<Object>} Query result
 */
async function executeQuery(query, params = [], options = { prepare: true }) {
    try {
        console.log('🔍 Executing query:', query);
        console.log('📝 Parameters:', params);
        
        const result = await client.execute(query, params, options);
        
        // Add null check for result.rows
        const rowCount = result && result.rows ? result.rows.length : 0;
        console.log('✅ Query executed successfully, rows returned:', rowCount);
        
        return result;
        
    } catch (error) {
        console.error('❌ Query execution failed:', error.message);
        console.error('📝 Query:', query);
        console.error('📝 Parameters:', params);
        throw error;
    }
}

/**
 * Đóng kết nối Cassandra client
 * Gọi hàm này khi shutdown application
 */
async function closeConnection() {
    try {
        console.log('🔒 Đóng kết nối Cassandra...');
        await client.shutdown();
        console.log('✅ Kết nối Cassandra đã được đóng');
    } catch (error) {
        console.error('❌ Lỗi đóng kết nối:', error.message);
    }
}

/**
 * =============================================================================
 * EXPORTS
 * =============================================================================
 */

module.exports = {
    // Client instance
    client,
    
    // Health check functions
    checkCassandraHealth,
    waitForCassandraReady,
    
    // Database initialization
    initializeDatabase,
    createKeyspace,
    useKeyspace,
    createUsersTable,
    createOrdersTable,
    
    // Query helpers
    executeQuery,
    closeConnection,
    
    // Utility
    delay
}; 