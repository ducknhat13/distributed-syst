require('dotenv').config();

module.exports = {
    port: process.env.PORT || 3000,
    cassandra: {
        contactPoints: process.env.CASSANDRA_CONTACT_POINTS ? 
            process.env.CASSANDRA_CONTACT_POINTS.split(',') : 
            ['localhost'],
        localDataCenter: process.env.CASSANDRA_DATACENTER || 'datacenter1',
        keyspace: process.env.CASSANDRA_KEYSPACE || 'distributed_storage',
        replication: {
            class: 'SimpleStrategy',
            replication_factor: 3
        }
    },
    logging: {
        level: process.env.LOG_LEVEL || 'info',
        file: process.env.LOG_FILE || 'logs/app.log'
    }
}; 