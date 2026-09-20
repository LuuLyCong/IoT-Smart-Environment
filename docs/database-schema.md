# Database Schema

Cơ sở dữ liệu: PostgreSQL 16 (Database name: `iotdb`)
Quản lý migration: Flyway (`classpath:db/migration`)

## 1. Bảng `roles`
- `id` (UUID, PK)
- `name` (VARCHAR(50), Unique) (`ROLE_ADMIN`, `ROLE_OPERATOR`, `ROLE_VIEWER`)

## 2. Bảng `users`
- `id` (UUID, PK)
- `username` (VARCHAR(50), Unique)
- `password_hash` (VARCHAR(255), BCrypt encrypted)
- `full_name` (VARCHAR(100))
- `enabled` (BOOLEAN, Default TRUE)
- `role_id` (UUID, FK -> `roles.id`)

## 3. Bảng `devices`
- `id` (UUID, PK)
- `device_id` (VARCHAR(100), Unique) (`esp32-001`)
- `name` (VARCHAR(255))
- `type` (VARCHAR(100))
- `status` (VARCHAR(50)) (`ONLINE` / `OFFLINE`)
- `led_state` (BOOLEAN, Default FALSE)
- `last_seen_at` (TIMESTAMP WITH TIME ZONE)
- `created_at` (TIMESTAMP WITH TIME ZONE)
- `updated_at` (TIMESTAMP WITH TIME ZONE)

## 4. Bảng `telemetry`
- `id` (UUID, PK)
- `device_id` (VARCHAR(100), FK -> `devices.device_id`)
- `temperature` (DOUBLE PRECISION)
- `humidity` (DOUBLE PRECISION)
- `illuminance` (DOUBLE PRECISION, có thể null)
- `soil_moisture` (DOUBLE PRECISION, có thể null)
- `led_state` (BOOLEAN)
- `recorded_at` (TIMESTAMP WITH TIME ZONE, từ timestamp thiết bị gửi lên)
- `received_at` (TIMESTAMP WITH TIME ZONE, thời điểm server lưu bản ghi)
- *Index on (device_id, recorded_at)*

## 5. Bảng `commands`
- `id` (UUID, PK, dùng làm commandId duy nhất)
- `device_id` (VARCHAR(100), FK -> `devices.device_id`)
- `action` (VARCHAR(50)) (`LED_ON`, `LED_OFF`)
- `payload` (JSONB)
- `status` (VARCHAR(50)) (`SENT`, `ACKNOWLEDGED`, `TIMEOUT`, `FAILED`)
- `created_by` (VARCHAR(50), username người gửi)
- `created_at` (TIMESTAMP WITH TIME ZONE)
- `sent_at` (TIMESTAMP WITH TIME ZONE)
- `acknowledged_at` (TIMESTAMP WITH TIME ZONE)
- *Index on (status, created_at)*

## 6. Bảng `alerts` (Chức năng nâng cao)
- `id` (UUID, PK)
- `device_id` (VARCHAR(100), FK -> `devices.device_id`)
- `type` (VARCHAR(50)) (`HIGH_TEMPERATURE`)
- `message` (VARCHAR(255))
- `val` (DOUBLE PRECISION, giá trị nhiệt độ thực tế)
- `threshold` (DOUBLE PRECISION, ngưỡng kích hoạt, mặc định 35.0°C)
- `created_at` (TIMESTAMP WITH TIME ZONE)
- *Index on (device_id, created_at)*
