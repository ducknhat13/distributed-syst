# Distributed Data Storage & Processing System

Hệ thống lưu trữ và xử lý dữ liệu phân tán sử dụng Apache Cassandra.

## Tính năng chính

- Fault Tolerance với cơ chế replication
- Distributed Communication qua REST API
- Sharding và Replication
- Logging và Monitoring
- Stress Testing

## Yêu cầu hệ thống

- Node.js >= 14.x
- Apache Cassandra >= 4.x
- npm hoặc yarn

## Cài đặt

1. Clone repository:
```bash
git clone <repository-url>
```

2. Cài đặt dependencies:
```bash
npm install
```

3. Cấu hình Cassandra:
- Cài đặt Apache Cassandra
- Cấu hình cluster với 3-5 nodes
- Cập nhật file cấu hình trong `config/cassandra.yaml`

4. Khởi động ứng dụng:
```bash
npm start
```

## Cấu trúc dự án

```
.
├── src/
│   ├── config/         # Cấu hình ứng dụng
│   ├── controllers/    # Xử lý logic
│   ├── models/         # Schema và models
│   ├── routes/         # API routes
│   └── utils/          # Tiện ích
├── tests/              # Unit tests và stress tests
├── logs/               # Log files
└── config/             # Cấu hình Cassandra
```

## API Endpoints

- GET /api/data/:key - Lấy dữ liệu
- POST /api/data - Thêm dữ liệu mới
- PUT /api/data/:key - Cập nhật dữ liệu
- DELETE /api/data/:key - Xóa dữ liệu

## Monitoring

- Log files được lưu trong thư mục `logs/`
- Sử dụng `nodetool` để theo dõi trạng thái cluster

## Testing

```bash
# Chạy unit tests
npm test

# Chạy stress test
npm run stress-test
``` 