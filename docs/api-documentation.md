# API Documentation

Base path: `/api/v1`

Swagger UI: [http://localhost:8080/swagger-ui/index.html](http://localhost:8080/swagger-ui/index.html)  
OpenAPI JSON: [http://localhost:8080/v3/api-docs](http://localhost:8080/v3/api-docs)

---

## 1. Authentication (`/api/v1/auth`)

### 1.1 Đăng nhập (Login)
- **URL:** `POST /api/v1/auth/login`
- **Body:**
```json
{
  "username": "operator",
  "password": "Operator@123"
}
```
- **Response:** (200 OK)
```json
{
  "accessToken": "eyJhbGciOi...",
  "tokenType": "Bearer",
  "expiresIn": 86400,
  "role": "OPERATOR",
  "username": "operator",
  "fullName": "System Operator"
}
```

---

## 2. Devices (`/api/v1/devices`)

### 2.1 Lấy danh sách thiết bị
- **URL:** `GET /api/v1/devices`
- **Headers:** `Authorization: Bearer <token>`
- **Response:** (200 OK) Danh sách các thiết bị trong hệ thống.

### 2.2 Lấy chi tiết thiết bị
- **URL:** `GET /api/v1/devices/{deviceId}`
- **Headers:** `Authorization: Bearer <token>`
- **Response:** (200 OK)
```json
{
  "id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  "deviceId": "esp32-001",
  "name": "Smart Environment Sensor 1",
  "type": "ESP32",
  "status": "ONLINE",
  "ledState": false,
  "lastSeenAt": "2026-09-14T03:30:00Z"
}
```

---

## 3. Telemetry (`/api/v1/devices/{deviceId}/telemetry`)

### 3.1 Lấy dữ liệu cảm biến mới nhất
- **URL:** `GET /api/v1/devices/{deviceId}/telemetry/latest`
- **Headers:** `Authorization: Bearer <token>`

### 3.2 Lấy lịch sử đo lường (Phân trang)
- **URL:** `GET /api/v1/devices/{deviceId}/telemetry?page=0&size=20&from=ISO8601&to=ISO8601`
- **Headers:** `Authorization: Bearer <token>`

---

## 4. Commands (`/api/v1/devices/{deviceId}/commands`)

### 4.1 Gửi lệnh điều khiển (Chỉ ADMIN & OPERATOR)
- **URL:** `POST /api/v1/devices/{deviceId}/commands`
- **Headers:** `Authorization: Bearer <token>`
- **Body:**
```json
{
  "action": "LED_ON"
}
```
*(Hoặc `LED_OFF`)*
- **Response:** (200 OK)
```json
{
  "id": "b76b0d08-52e5-4978-bc60-7078fafd570b",
  "deviceId": "esp32-001",
  "action": "LED_ON",
  "status": "SENT",
  "createdBy": "operator",
  "createdAt": "2026-09-14T03:39:18Z"
}
```
*(Nếu là tài khoản `VIEWER`, trả về `403 Forbidden`)*

### 4.2 Lấy lịch sử lệnh & Trạng thái ACK
- **URL:** `GET /api/v1/devices/{deviceId}/commands?page=0&size=10`
- **Headers:** `Authorization: Bearer <token>`

---

## 5. Alerts (`/api/v1/devices/{deviceId}/alerts`) - Chức năng nâng cao

### 5.1 Lấy danh sách cảnh báo (Nhiệt độ > 35°C)
- **URL:** `GET /api/v1/devices/{deviceId}/alerts?page=0&size=10`
- **Headers:** `Authorization: Bearer <token>`
- **Response:** (200 OK)
```json
{
  "content": [
    {
      "id": "c1f7b0e2-...",
      "deviceId": "esp32-001",
      "type": "HIGH_TEMPERATURE",
      "message": "Temperature 36.2°C exceeded safety threshold 35.0°C",
      "val": 36.2,
      "threshold": 35.0,
      "createdAt": "2026-09-14T03:40:00Z"
    }
  ],
  "totalElements": 1,
  "totalPages": 1
}
```
