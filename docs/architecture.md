# Architecture

```text
Device Simulator hoặc ESP32 thật
        ↕ MQTT
EMQX MQTT Broker
        ↕ MQTT
Spring Boot Backend
        ↕
PostgreSQL
        ↕ REST API
ReactJS Website / Flutter Mobile App
```

## Luồng hoạt động

### 1. Luồng Telemetry (Dữ liệu cảm biến)
1. Device (Simulator/ESP32) đọc cảm biến (nhiệt độ, độ ẩm).
2. Device publish JSON payload lên topic `device/{deviceId}/telemetry`.
3. EMQX Broker nhận và chuyển tiếp message.
4. Spring Boot Backend subscribe topic này, nhận message.
5. Backend validate JSON payload, tìm Device trong database.
6. Backend lưu bản ghi vào bảng `telemetry`.

### 2. Luồng Command (Điều khiển)
1. Người dùng trên Web/Mobile nhấn nút "Bật LED".
2. Web/Mobile gọi REST API `POST /api/v1/devices/{deviceId}/commands` với payload `{"action": "LED_ON"}`.
3. Backend nhận request, tạo bản ghi Command trạng thái `PENDING` trong DB.
4. Backend publish JSON payload lên topic `device/{deviceId}/command`.
5. Cập nhật trạng thái Command thành `SENT`.
6. Device (Simulator/ESP32) subscribe topic command, nhận lệnh.
7. Device thực thi (Bật LED).
8. Device publish phản hồi lên `device/{deviceId}/command/ack`.
9. Backend nhận phản hồi, cập nhật DB thành `ACKNOWLEDGED`.
10. Web/Mobile định kỳ gọi API lấy danh sách command hoặc lấy trạng thái LED mới nhất.

### 3. Luồng Online/Offline (Last Will)
- Khi kết nối MQTT, Device gửi message có cờ Retained lên topic `status` là `ONLINE`.
- Đồng thời Device cấu hình Last Will Message (LWM) tại Broker với nội dung `OFFLINE`.
- Nếu Device ngắt kết nối đột ngột (rớt mạng, cúp điện), Broker tự động publish LWM.
- Backend nhận trạng thái, cập nhật DB field `status` thành `OFFLINE`.
